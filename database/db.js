const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

class Database {
  constructor() {
    this.db = null;
    // Check if we're in development or built version
    const isDev = process.env.NODE_ENV === 'development' || !require('electron').app.isPackaged;
    
    if (isDev) {
      // Development: use the database in the project folder
      this.dbPath = path.join(__dirname, 'nxq.db');
    } else {
      // Built version: use userData directory
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      this.dbPath = path.join(userDataPath, 'nxq.db');
      
      // Copy the database from resources to userData if it doesn't exist
      this.ensureDatabaseExists();
    }
  }
  
  // Ensure database exists in built version
  async ensureDatabaseExists() {
    const fs = require('fs');
    const { app } = require('electron');
    
    if (!fs.existsSync(this.dbPath)) {
      try {
        // Try to copy from resources
        const resourcePath = path.join(process.resourcesPath, 'database', 'nxq.db');
        if (fs.existsSync(resourcePath)) {
          fs.copyFileSync(resourcePath, this.dbPath);
          console.log('Database copied from resources to userData');
        }
      } catch (error) {
        console.log('Could not copy database from resources, will create new one');
      }
    }
  }

  // Initialize database connection
  async init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database:', err.message);
          reject(err);
        } else {
          console.log('Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  // Create necessary tables
  async createTables() {
    return new Promise((resolve, reject) => {
      const createUsersTable = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          role TEXT DEFAULT 'admin',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_login DATETIME,
          is_active BOOLEAN DEFAULT 1
        )
      `;

      const createCustomersTable = `
        CREATE TABLE IF NOT EXISTS customers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address TEXT NOT NULL,
          start_date DATE NOT NULL,
          monthly_amount DECIMAL(10,2) NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      const createPaymentsTable = `
        CREATE TABLE IF NOT EXISTS payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          payment_date DATE NOT NULL,
          month_year TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          transaction_id TEXT,
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id)
        )
      `;

      const createWinnersTable = `
        CREATE TABLE IF NOT EXISTS winners (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          customer_id INTEGER NOT NULL,
          month_year TEXT NOT NULL,
          gold_rate DECIMAL(10,2) NOT NULL,
          winning_amount DECIMAL(10,2) NOT NULL,
          position INTEGER NOT NULL,
          is_delivered BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
          UNIQUE(customer_id, month_year)
        )
      `;

      const createDeliveriesTable = `
        CREATE TABLE IF NOT EXISTS deliveries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          winner_id INTEGER NOT NULL,
          bill_number TEXT NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          delivery_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          notes TEXT,
          FOREIGN KEY (winner_id) REFERENCES winners (id) ON DELETE CASCADE
        )
      `;

      this.db.serialize(() => {
        this.db.run(createUsersTable);
        this.db.run(createCustomersTable);
        this.db.run(createPaymentsTable);
        this.db.run(createWinnersTable);
        this.db.run(createDeliveriesTable, (err) => {
          if (err) {
            console.error('Error creating tables:', err.message);
            reject(err);
          } else {
            console.log('Database tables created successfully');
            this.handleMigrations().then(() => {
              this.initializeDefaultUser().then(resolve).catch(reject);
            }).catch(reject);
          }
        });
      });
    });
  }

  // Handle database migrations
  async handleMigrations() {
    return new Promise((resolve, reject) => {
      // Check if customer_code column exists in customers table
      this.db.get("PRAGMA table_info(customers)", (err, row) => {
        if (err) {
          console.error('Error checking table info:', err.message);
          reject(err);
          return;
        }

        // Check if customer_code column exists
        this.db.all("PRAGMA table_info(customers)", (err, columns) => {
          if (err) {
            console.error('Error getting table columns:', err.message);
            reject(err);
            return;
          }

          const hasCustomerCode = columns.some(col => col.name === 'customer_code');
          
          if (!hasCustomerCode) {
            console.log('Adding customer_code column to customers table...');
            // First add the column without UNIQUE constraint
            this.db.run("ALTER TABLE customers ADD COLUMN customer_code TEXT", (err) => {
              if (err) {
                console.error('Error adding customer_code column:', err.message);
                reject(err);
              } else {
                console.log('customer_code column added successfully');
                // Now populate existing records with generated codes
                this.populateExistingCustomerCodes().then(() => {
                  resolve();
                }).catch(reject);
              }
            });
          } else {
            console.log('customer_code column already exists');
            resolve();
          }
        });
      });
    });
  }

  // Populate existing customer records with generated codes
  async populateExistingCustomerCodes() {
    return new Promise((resolve, reject) => {
      const prefix = process.env.CUSTOMER_CODE_PREFIX || 'GD7';
      
      // Get all customers without customer_code
      this.db.all("SELECT id FROM customers WHERE customer_code IS NULL OR customer_code = ''", (err, customers) => {
        if (err) {
          console.error('Error fetching customers without codes:', err.message);
          reject(err);
          return;
        }

        if (customers.length === 0) {
          console.log('No customers need code generation');
          resolve();
          return;
        }

        console.log(`Generating codes for ${customers.length} existing customers...`);
        
        // Generate codes for each customer
        let completed = 0;
        customers.forEach((customer, index) => {
          const customerCode = `${prefix} ${(index + 1).toString().padStart(3, '0')}`;
          
          this.db.run(
            "UPDATE customers SET customer_code = ? WHERE id = ?",
            [customerCode, customer.id],
            (err) => {
              if (err) {
                console.error(`Error updating customer ${customer.id}:`, err.message);
                reject(err);
                return;
              }
              
              completed++;
              if (completed === customers.length) {
                console.log('All existing customers have been assigned codes');
                resolve();
              }
            }
          );
        });
      });
    });
  }

  // Initialize default admin user
  async initializeDefaultUser() {
    return new Promise((resolve, reject) => {
      const defaultUsername = 'admin';
      const defaultPassword = 'admin123';
      const defaultEmail = 'admin@nxq.com';

      // Check if admin user already exists
      this.db.get(
        'SELECT id FROM users WHERE username = ?',
        [defaultUsername],
        async (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          if (!row) {
            // Create default admin user
            const hashedPassword = await bcrypt.hash(defaultPassword, 12);
            
            this.db.run(
              'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)',
              [defaultUsername, hashedPassword, defaultEmail, 'admin'],
              (err) => {
                if (err) {
                  console.error('Error creating default user:', err.message);
                  reject(err);
                } else {
                  console.log('Default admin user created successfully');
                  console.log('Username: admin, Password: admin123');
                  resolve();
                }
              }
            );
          } else {
            console.log('Default admin user already exists');
            resolve();
          }
        }
      );
    });
  }

  // Authenticate user
  async authenticateUser(username, password) {
    return new Promise((resolve, reject) => {
      console.log('Authenticating user:', username);
      this.db.get(
        'SELECT * FROM users WHERE username = ? AND is_active = 1',
        [username],
        async (err, user) => {
          if (err) {
            console.error('Database error during authentication:', err.message);
            reject(err);
            return;
          }

          if (!user) {
            console.log('User not found:', username);
            resolve({ success: false, message: 'Invalid credentials' });
            return;
          }

          console.log('User found, checking password...');

          try {
            const isValidPassword = await bcrypt.compare(password, user.password_hash);
            console.log('Password comparison result:', isValidPassword);
            
            if (isValidPassword) {
              // Update last login
              this.db.run(
                'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
                [user.id]
              );
              
              resolve({
                success: true,
                user: {
                  id: user.id,
                  username: user.username,
                  email: user.email,
                  role: user.role
                }
              });
            } else {
              resolve({ success: false, message: 'Invalid credentials' });
            }
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  // Get user by ID
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ? AND is_active = 1',
        [userId],
        (err, user) => {
          if (err) {
            reject(err);
          } else {
            resolve(user);
          }
        }
      );
    });
  }

  // Generate unique customer code
  async generateCustomerCode() {
    return new Promise((resolve, reject) => {
      const prefix = process.env.CUSTOMER_CODE_PREFIX || 'GD7';
      console.log('Generating customer code with prefix:', prefix);
      
      // Get the last customer code
      this.db.get(
        'SELECT customer_code FROM customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1',
        [`${prefix}%`],
        (err, row) => {
          if (err) {
            reject(err);
            return;
          }

          let nextNumber = 1;
          if (row) {
            // Extract number from existing code (e.g., GD7001 -> 1)
            const match = row.customer_code.match(/\d+$/);
            if (match) {
              nextNumber = parseInt(match[0]) + 1;
            }
          }

          // Format with leading zeros (e.g., 1 -> 001)
          const formattedNumber = nextNumber.toString().padStart(3, '0');
          const customerCode = `${prefix} ${formattedNumber}`;
          
          resolve(customerCode);
        }
      );
    });
  }

  // Add new customer
  async addCustomer(customerData) {
    return new Promise(async (resolve, reject) => {
      try {
        console.log('Database: Adding customer with data:', customerData);
        
        // Strict input validation
        if (!customerData || typeof customerData !== 'object') {
          throw new Error('Customer data is required and must be an object');
        }

        const { customer_code, name, phone, address, start_date, monthly_amount } = customerData;

        // Validate customer code if provided
        if (customer_code && (typeof customer_code !== 'string' || customer_code.trim().length === 0)) {
          throw new Error('Customer code must be a non-empty string');
        }

        // Validate customer code format if provided
        if (customer_code) {
          const codeMatch = customer_code.match(/^GD7-(\d+)$/);
          if (!codeMatch) {
            throw new Error('Customer code must be in format GD7-XXX');
          }
          const codeNumber = parseInt(codeMatch[1]);
          if (codeNumber < 1 || codeNumber > 2000) {
            throw new Error('Customer code number must be between 1 and 2000');
          }
        }

        // Validate required fields
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
          throw new Error('Customer name is required and must be a non-empty string');
        }

        if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
          throw new Error('Phone number is required and must be a non-empty string');
        }

        if (!address || typeof address !== 'string' || address.trim().length === 0) {
          throw new Error('Address is required and must be a non-empty string');
        }

        if (!start_date || typeof start_date !== 'string' || start_date.trim().length === 0) {
          throw new Error('Start date is required and must be a valid date string');
        }

        if (!monthly_amount || typeof monthly_amount !== 'number' || monthly_amount <= 0) {
          throw new Error('Monthly amount is required and must be a positive number');
        }

        // Sanitize inputs
        const sanitizedData = {
          customer_code: customer_code ? customer_code.trim() : null,
          name: name.trim(),
          phone: phone.trim(),
          address: address.trim(),
          start_date: start_date.trim(),
          monthly_amount: parseFloat(monthly_amount)
        };

        // Additional validation
        if (sanitizedData.name.length < 2 || sanitizedData.name.length > 100) {
          throw new Error('Customer name must be between 2 and 100 characters');
        }

        if (!/^[\d\s\-\+\(\)]+$/.test(sanitizedData.phone)) {
          throw new Error('Phone number contains invalid characters');
        }

        if (sanitizedData.phone.length < 10 || sanitizedData.phone.length > 15) {
          throw new Error('Phone number must be between 10 and 15 characters');
        }

        if (sanitizedData.address.length < 10 || sanitizedData.address.length > 200) {
          throw new Error('Address must be between 10 and 200 characters');
        }

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(sanitizedData.start_date)) {
          throw new Error('Start date must be in YYYY-MM-DD format');
        }

        // Validate date is not in the future
        const startDate = new Date(sanitizedData.start_date);
        const today = new Date();
        if (startDate > today) {
          throw new Error('Start date cannot be in the future');
        }

        if (sanitizedData.monthly_amount < 100 || sanitizedData.monthly_amount > 100000) {
          throw new Error('Monthly amount must be between ₹100 and ₹100,000');
        }

        // Phone number uniqueness check removed - same user can have multiple accounts with same number

        // Check for duplicate customer code
        const existingCode = await this.getCustomerByCode(sanitizedData.customer_code);
        if (existingCode) {
          throw new Error('A customer with this code already exists');
        }
        
        // Use provided customer code or generate one
        const customerCode = sanitizedData.customer_code || await this.generateCustomerCode();
        
        console.log('Database: Inserting customer with code:', customerCode);
        this.db.run(
          'INSERT INTO customers (customer_code, name, phone, address, start_date, monthly_amount) VALUES (?, ?, ?, ?, ?, ?)',
          [customerCode, sanitizedData.name, sanitizedData.phone, sanitizedData.address, sanitizedData.start_date, sanitizedData.monthly_amount],
          function(err) {
            if (err) {
              console.error('Database: Error inserting customer:', err);
              reject(err);
            } else {
              console.log('Database: Customer inserted successfully with ID:', this.lastID);
              resolve({ 
                id: this.lastID, 
                customer_code: customerCode,
                ...customerData 
              });
            }
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  // Get customer by phone number
  async getCustomerByPhone(phone) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM customers WHERE phone = ?',
        [phone],
        (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        }
      );
    });
  }

  // Get customer by customer code
  async getCustomerByCode(customerCode) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM customers WHERE customer_code = ?',
        [customerCode],
        (err, customer) => {
          if (err) {
            reject(err);
          } else {
            resolve(customer);
          }
        }
      );
    });
  }

  // Get all customers
  async getCustomers() {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting all customers...');
      console.log('Database: Database connection exists:', !!this.db);
      
      if (!this.db) {
        console.error('Database: Database connection is null');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        'SELECT * FROM customers ORDER BY created_at DESC',
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting customers:', err);
            console.error('Database: Error details:', err.message, err.code);
            reject(err);
          } else {
            console.log('Database: Found customers:', rows.length);
            console.log('Database: Customer rows:', rows);
            resolve(rows);
          }
        }
      );
    });
  }

  // Check if customer code already exists
  async checkCustomerCodeExists(customerCode) {
    return new Promise((resolve, reject) => {
      console.log('Database: Checking if customer code exists:', customerCode);
      this.db.get(
        'SELECT id FROM customers WHERE customer_code = ?',
        [customerCode],
        (err, row) => {
          if (err) {
            console.error('Database: Error checking customer code:', err);
            reject(err);
          } else {
            const exists = !!row;
            console.log('Database: Customer code exists:', exists);
            resolve(exists);
          }
        }
      );
    });
  }

  // Get customer by ID
  async getCustomerById(customerId) {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting customer by ID:', customerId);
      this.db.get(
        'SELECT * FROM customers WHERE id = ?',
        [customerId],
        (err, row) => {
          if (err) {
            console.error('Database: Error getting customer by ID:', err);
            reject(err);
          } else {
            console.log('Database: Customer found:', row);
            resolve(row);
          }
        }
      );
    });
  }

  // Add payment
  async addPayment(paymentData) {
    return new Promise((resolve, reject) => {
      const { customer_id, amount, payment_date, month_year, payment_method, transaction_id, notes } = paymentData;
      
      this.db.run(
        'INSERT INTO payments (customer_id, amount, payment_date, month_year, payment_method, transaction_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [customer_id, amount, payment_date, month_year, payment_method, transaction_id, notes],
        function(err) {
          if (err) {
            reject(err);
          } else {
            resolve({ id: this.lastID, ...paymentData });
          }
        }
      );
    });
  }

  // Get payments for a customer
  async getCustomerPayments(customerId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC',
        [customerId],
        (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Get all payments
  async getAllPayments() {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting all payments...');
      console.log('Database: Database connection exists for payments:', !!this.db);
      
      if (!this.db) {
        console.error('Database: Database connection is null for payments');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        'SELECT * FROM payments ORDER BY payment_date DESC',
        [],
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting payments:', err);
            console.error('Database: Payment error details:', err.message, err.code);
            reject(err);
          } else {
            console.log('Database: Found payments:', rows.length);
            console.log('Database: Payment rows:', rows);
            resolve(rows);
          }
        }
      );
    });
  }

  // Get payments by date
  async getPaymentsByDate(paymentDate) {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting payments for date:', paymentDate);
      
      if (!this.db) {
        console.error('Database: Database connection is null for payments by date');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        `SELECT p.*, c.name as customer_name, c.customer_code 
         FROM payments p 
         JOIN customers c ON p.customer_id = c.id 
         WHERE DATE(p.payment_date) = DATE(?) 
         ORDER BY p.payment_date DESC`,
        [paymentDate],
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting payments by date:', err);
            reject(err);
          } else {
            console.log('Database: Found payments for date:', rows.length);
            resolve(rows);
          }
        }
      );
    });
  }

  async getPaymentsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting payments for date range:', startDate, 'to', endDate);
      
      if (!this.db) {
        console.error('Database: Database connection is null for payments by date range');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        `SELECT p.*, c.name as customer_name, c.customer_code 
         FROM payments p 
         JOIN customers c ON p.customer_id = c.id 
         WHERE DATE(p.payment_date) >= DATE(?) AND DATE(p.payment_date) <= DATE(?) 
         ORDER BY p.payment_date DESC`,
        [startDate, endDate],
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting payments by date range:', err);
            reject(err);
          } else {
            console.log('Database: Found payments for date range:', rows.length);
            resolve(rows);
          }
        }
      );
    });
  }

  // Get dashboard statistics
  async getDashboardStats() {
    return new Promise((resolve, reject) => {
      const queries = {
        totalCustomers: 'SELECT COUNT(*) as count FROM customers',
        unpaidThisMonth: `SELECT COUNT(*) as count FROM customers c 
                         WHERE NOT EXISTS (
                           SELECT 1 FROM payments p 
                           WHERE p.customer_id = c.id 
                           AND p.month_year = strftime('%Y-%m', 'now')
                         )
                         AND NOT EXISTS (
                           SELECT 1 FROM winners w 
                           WHERE w.customer_id = c.id
                         )`,
        paidThisMonth: `SELECT COUNT(*) as count FROM customers c 
                       WHERE EXISTS (
                         SELECT 1 FROM payments p 
                         WHERE p.customer_id = c.id 
                         AND p.month_year = strftime('%Y-%m', 'now')
                       )
                       AND NOT EXISTS (
                         SELECT 1 FROM winners w 
                         WHERE w.customer_id = c.id
                       )`,
        totalOutstanding: `SELECT COALESCE(SUM(c.monthly_amount), 0) as total FROM customers c 
                          WHERE NOT EXISTS (
                            SELECT 1 FROM payments p 
                            WHERE p.customer_id = c.id 
                            AND p.month_year = strftime('%Y-%m', 'now')
                          )
                          AND NOT EXISTS (
                            SELECT 1 FROM winners w 
                            WHERE w.customer_id = c.id
                          )`
      };

      const results = {};
      let completed = 0;
      const total = Object.keys(queries).length;

      Object.entries(queries).forEach(([key, query]) => {
        this.db.get(query, (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          
          results[key] = row.count || row.total || 0;
          completed++;
          
          if (completed === total) {
            resolve(results);
          }
        });
      });
    });
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing database:', err.message);
        } else {
          console.log('Database connection closed');
        }
      });
    }
  }

  // Clear all data from database (except admin user)
  async clearAllData() {
    return new Promise((resolve, reject) => {
      console.log('Database: Clearing all data...');
      
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      // Start transaction
      this.db.serialize(() => {
        this.db.run('BEGIN TRANSACTION', (err) => {
          if (err) {
            console.error('Database: Error starting transaction:', err.message);
            reject(err);
            return;
          }

          // Delete all payments
          this.db.run('DELETE FROM payments', (err) => {
            if (err) {
              console.error('Database: Error deleting payments:', err.message);
              this.db.run('ROLLBACK');
              reject(err);
              return;
            }
            console.log('Database: Payments deleted');

            // Delete all customers
            this.db.run('DELETE FROM customers', (err) => {
              if (err) {
                console.error('Database: Error deleting customers:', err.message);
                this.db.run('ROLLBACK');
                reject(err);
                return;
              }
              console.log('Database: Customers deleted');

              // Delete all deliveries
              this.db.run('DELETE FROM deliveries', (err) => {
                if (err) {
                  console.error('Database: Error deleting deliveries:', err.message);
                  this.db.run('ROLLBACK');
                  reject(err);
                  return;
                }
                console.log('Database: Deliveries deleted');

                // Delete all winners
                this.db.run('DELETE FROM winners', (err) => {
                  if (err) {
                    console.error('Database: Error deleting winners:', err.message);
                    this.db.run('ROLLBACK');
                    reject(err);
                    return;
                  }
                  console.log('Database: Winners deleted');

                  // Reset auto-increment counters
                  this.db.run('DELETE FROM sqlite_sequence WHERE name IN ("customers", "payments", "winners", "deliveries")', (err) => {
                    if (err) {
                      console.error('Database: Error resetting sequences:', err.message);
                      this.db.run('ROLLBACK');
                      reject(err);
                      return;
                    }
                    console.log('Database: Auto-increment counters reset');

                    // Commit transaction
                    this.db.run('COMMIT', (err) => {
                      if (err) {
                        console.error('Database: Error committing transaction:', err.message);
                        reject(err);
                        return;
                      }
                      console.log('Database: All data cleared successfully');
                      resolve();
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // Winners methods
  async addWinner(customerId, monthYear, goldRate, winningAmount, position) {
    return new Promise((resolve, reject) => {
      console.log('Database: Adding winner:', { customerId, monthYear, goldRate, winningAmount, position });
      
      if (!this.db) {
        console.error('Database: Database connection is null for adding winner');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.run(
        'INSERT INTO winners (customer_id, month_year, gold_rate, winning_amount, position) VALUES (?, ?, ?, ?, ?)',
        [customerId, monthYear, goldRate, winningAmount, position],
        function(err) {
          if (err) {
            console.error('Database: Error adding winner:', err);
            reject(err);
          } else {
            console.log('Database: Winner added successfully with ID:', this.lastID);
            resolve({ id: this.lastID, ...arguments[1] });
          }
        }
      );
    });
  }

  async getAllWinners() {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting all winners');
      
      if (!this.db) {
        console.error('Database: Database connection is null for getting winners');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        `SELECT w.*, c.name as customer_name, c.customer_code,
         COALESCE(SUM(d.amount), 0) as delivered_amount,
         (w.winning_amount - COALESCE(SUM(d.amount), 0)) as remaining_balance
         FROM winners w
         JOIN customers c ON w.customer_id = c.id
         LEFT JOIN deliveries d ON w.id = d.winner_id
         GROUP BY w.id
         ORDER BY w.created_at DESC`,
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting winners:', err);
            reject(err);
          } else {
            console.log('Database: Found winners:', rows.length);
            resolve(rows);
          }
        }
      );
    });
  }

  async getAvailableMonths() {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting available months');
      
      if (!this.db) {
        console.error('Database: Database connection is null for getting available months');
        reject(new Error('Database connection is null'));
        return;
      }
      
      // Generate 30 months from default start date
      const months = [];
      const startDate = new Date('2024-12-15');
      
      for (let i = 0; i < 30; i++) {
        const date = new Date(startDate);
        date.setMonth(date.getMonth() + i);
        const monthYear = date.toISOString().slice(0, 7);
        months.push(monthYear);
      }
      
      // Get months that already have winners
      this.db.all(
        'SELECT DISTINCT month_year FROM winners',
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting winner months:', err);
            reject(err);
          } else {
            const winnerMonths = rows.map(row => row.month_year);
            const availableMonths = months.filter(month => !winnerMonths.includes(month));
            console.log('Database: Available months:', availableMonths.length);
            resolve(availableMonths);
          }
        }
      );
    });
  }

  // Delivery methods
  async addDelivery(winnerId, billNumber, amount, notes = null) {
    return new Promise((resolve, reject) => {
      console.log('Database: Adding delivery:', { winnerId, billNumber, amount, notes });
      
      if (!this.db) {
        console.error('Database: Database connection is null for adding delivery');
        reject(new Error('Database connection is null'));
        return;
      }

      // Store database reference to avoid context issues
      const db = this.db;

      // First, get the winner's winning amount and current delivered amount
      db.get(
        `SELECT w.winning_amount, COALESCE(SUM(d.amount), 0) as delivered_amount
         FROM winners w
         LEFT JOIN deliveries d ON w.id = d.winner_id
         WHERE w.id = ?
         GROUP BY w.id, w.winning_amount`,
        [winnerId],
        (err, result) => {
          if (err) {
            console.error('Database: Error getting winner details:', err);
            reject(err);
            return;
          }

          if (!result) {
            reject(new Error('Winner not found'));
            return;
          }

          const { winning_amount, delivered_amount } = result;
          const newTotal = delivered_amount + amount;

          console.log(`Database: Winner ${winnerId} - Winning: ${winning_amount}, Delivered: ${delivered_amount}, New delivery: ${amount}, New total: ${newTotal}`);

          // Check if the new delivery would exceed the winning amount
          if (newTotal > winning_amount) {
            const remaining = winning_amount - delivered_amount;
            reject(new Error(`Delivery amount (₹${amount}) exceeds remaining balance. Maximum allowed: ₹${remaining}`));
            return;
          }
          
          // Proceed with adding the delivery
          db.run(
            'INSERT INTO deliveries (winner_id, bill_number, amount, notes) VALUES (?, ?, ?, ?)',
            [winnerId, billNumber, amount, notes],
            function(err) {
              if (err) {
                console.error('Database: Error adding delivery:', err);
                reject(err);
              } else {
                console.log('Database: Delivery added successfully with ID:', this.lastID);
                
                // Update winner delivery status if fully delivered
                db.run(
                  `UPDATE winners SET is_delivered = 1 
                   WHERE id = ? AND winning_amount <= (
                     SELECT COALESCE(SUM(amount), 0) FROM deliveries WHERE winner_id = ?
                   )`,
                  [winnerId, winnerId],
                  (updateErr) => {
                    if (updateErr) {
                      console.error('Database: Error updating winner delivery status:', updateErr);
                    }
                  }
                );
                
                resolve({ id: this.lastID, ...arguments[1] });
              }
            }
          );
        }
      );
    });
  }

  async getDeliveriesByWinner(winnerId) {
    return new Promise((resolve, reject) => {
      console.log('Database: Getting deliveries for winner:', winnerId);
      
      if (!this.db) {
        console.error('Database: Database connection is null for getting deliveries');
        reject(new Error('Database connection is null'));
        return;
      }
      
      this.db.all(
        'SELECT * FROM deliveries WHERE winner_id = ? ORDER BY delivery_date DESC',
        [winnerId],
        (err, rows) => {
          if (err) {
            console.error('Database: Error getting deliveries:', err);
            reject(err);
          } else {
            console.log('Database: Found deliveries:', rows.length);
            resolve(rows);
          }
        }
      );
    });
  }
}

module.exports = Database;