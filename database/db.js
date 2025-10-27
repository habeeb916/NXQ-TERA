const Database_sqlite = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

class Database {
  constructor() {
    // Singleton pattern - only one instance allowed
    if (Database.instance) {
      return Database.instance;
    }
    
    this.db = null;
    this.isInitialized = false;
    
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
    
    Database.instance = this;
  }

  // Get singleton instance
  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
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
    if (this.isInitialized && this.db) {
      console.log('Database: Already initialized, returning existing connection');
      return Promise.resolve();
    }
    
    try {
      this.db = new Database_sqlite(this.dbPath);
      console.log('Connected to SQLite database');
      
      this.isInitialized = true;
      await this.createTables();
      return Promise.resolve();
    } catch (err) {
      console.error('Error opening database:', err.message);
      return Promise.reject(err);
    }
  }

  // Create necessary tables
  async createTables() {
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

    const createSchemesTable = `
      CREATE TABLE IF NOT EXISTS schemes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        prefix TEXT UNIQUE NOT NULL,
        start_date DATE NOT NULL,
        duration INTEGER NOT NULL,
        amounts TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCustomersTable = `
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scheme_id INTEGER,
        customer_code TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        address TEXT NOT NULL,
        start_date DATE NOT NULL,
        monthly_amount DECIMAL(10,2) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scheme_id) REFERENCES schemes (id) ON DELETE CASCADE
      )
    `;

    const createPaymentsTable = `
      CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        scheme_id INTEGER NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        payment_date DATE NOT NULL,
        month_year TEXT NOT NULL,
        payment_method TEXT NOT NULL,
        transaction_id TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        FOREIGN KEY (scheme_id) REFERENCES schemes (id) ON DELETE CASCADE
      )
    `;

    const createWinnersTable = `
      CREATE TABLE IF NOT EXISTS winners (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL,
        scheme_id INTEGER NOT NULL,
        month_year TEXT NOT NULL,
        gold_rate DECIMAL(10,2) NOT NULL,
        winning_amount DECIMAL(10,2) NOT NULL,
        position INTEGER NOT NULL,
        is_delivered BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE,
        FOREIGN KEY (scheme_id) REFERENCES schemes (id) ON DELETE CASCADE,
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

    try {
      this.db.exec(createUsersTable);
      this.db.exec(createSchemesTable);
      this.db.exec(createCustomersTable);
      this.db.exec(createPaymentsTable);
      this.db.exec(createWinnersTable);
      this.db.exec(createDeliveriesTable);
      
      console.log('Database tables created successfully');
      await this.handleMigrations();
      await this.initializeDefaultUser();
    } catch (err) {
      console.error('Error creating tables:', err.message);
      throw err;
    }
  }

  // Handle database migrations
  async handleMigrations() {
    // Check if customer_code column exists in customers table
    const columns = this.db.prepare("PRAGMA table_info(customers)").all();
    const hasCustomerCode = columns.some(col => col.name === 'customer_code');
    
    if (!hasCustomerCode) {
      console.log('Adding customer_code column to customers table...');
      // First add the column without UNIQUE constraint
      this.db.exec("ALTER TABLE customers ADD COLUMN customer_code TEXT");
      console.log('customer_code column added successfully');
      
      // Now populate existing records with generated codes
      await this.populateExistingCustomerCodes();
      await this.handleSchemeMigration();
    } else {
      console.log('customer_code column already exists');
      await this.handleSchemeMigration();
    }
  }

  // Handle scheme migration
  async handleSchemeMigration() {
    const columns = this.db.prepare("PRAGMA table_info(customers)").all();
    const hasSchemeIdInCustomers = columns.some(col => col.name === 'scheme_id');
    
    if (!hasSchemeIdInCustomers) {
      console.log('Adding scheme_id column to customers table...');
      
      // Add scheme_id column to customers table (without creating default scheme)
      this.db.exec("ALTER TABLE customers ADD COLUMN scheme_id INTEGER");
      console.log('scheme_id column added to customers successfully');
      
      // Continue with other migrations
      await this.migratePaymentsAndWinners();
    } else {
      console.log('scheme_id column already exists in customers');
      // Check other tables
      await this.migratePaymentsAndWinners();
    }
  }

  async migratePaymentsAndWinners() {
    // Check payments table
    const columns = this.db.prepare("PRAGMA table_info(payments)").all();
    const hasSchemeIdInPayments = columns.some(col => col.name === 'scheme_id');
    
    if (!hasSchemeIdInPayments) {
      console.log('Adding scheme_id column to payments table...');
      
      this.db.exec("ALTER TABLE payments ADD COLUMN scheme_id INTEGER");
      console.log('scheme_id column added to payments successfully');
      
      // Continue with winners
      await this.migrateWinnersTable();
    } else {
      console.log('scheme_id column already exists in payments');
      await this.migrateWinnersTable();
    }
  }

  async migrateWinnersTable() {
    // Check winners table
    const columns = this.db.prepare("PRAGMA table_info(winners)").all();
    const hasSchemeIdInWinners = columns.some(col => col.name === 'scheme_id');
    
    if (!hasSchemeIdInWinners) {
      console.log('Adding scheme_id column to winners table...');
      
      this.db.exec("ALTER TABLE winners ADD COLUMN scheme_id INTEGER");
      console.log('scheme_id column added to winners successfully');
    } else {
      console.log('scheme_id column already exists in winners');
    }
  }

  // Populate existing customer records with generated codes
  async populateExistingCustomerCodes() {
    const prefix = process.env.CUSTOMER_CODE_PREFIX || 'GD7';
    
    // Get all customers without customer_code
    const customers = this.db.prepare("SELECT id FROM customers WHERE customer_code IS NULL OR customer_code = ''").all();

    if (customers.length === 0) {
      console.log('No customers need code generation');
      return;
    }

    console.log(`Generating codes for ${customers.length} existing customers...`);
    
    // Generate codes for each customer
    const stmt = this.db.prepare("UPDATE customers SET customer_code = ? WHERE id = ?");
    customers.forEach((customer, index) => {
      const customerCode = `${prefix} ${(index + 1).toString().padStart(3, '0')}`;
      stmt.run(customerCode, customer.id);
    });
    
    console.log('All existing customers have been assigned codes');
  }

  // Initialize default admin user
  async initializeDefaultUser() {
    const defaultUsername = 'admin';
    const defaultPassword = 'admin123';
    const defaultEmail = 'admin@nxq.com';

    // Check if admin user already exists
    const user = this.db.prepare('SELECT id FROM users WHERE username = ?').get(defaultUsername);

    if (!user) {
      // Create default admin user
      const hashedPassword = await bcrypt.hash(defaultPassword, 12);
      
      this.db.prepare(
        'INSERT INTO users (username, password_hash, email, role) VALUES (?, ?, ?, ?)'
      ).run(defaultUsername, hashedPassword, defaultEmail, 'admin');
      
      console.log('Default admin user created successfully');
      console.log('Username: admin, Password: admin123');
    } else {
      console.log('Default admin user already exists');
    }
  }

  // Authenticate user
  async authenticateUser(username, password) {
    console.log('Authenticating user:', username);
    const user = this.db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);

    if (!user) {
      console.log('User not found:', username);
      return { success: false, message: 'Invalid credentials' };
    }

    console.log('User found, checking password...');

    try {
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      console.log('Password comparison result:', isValidPassword);
      
      if (isValidPassword) {
        // Update last login
        this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);
        
        return {
          success: true,
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role
          }
        };
      } else {
        return { success: false, message: 'Invalid credentials' };
      }
    } catch (error) {
      throw error;
    }
  }

  // Get user by ID
  async getUserById(userId) {
    return this.db.prepare('SELECT id, username, email, role, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
  }

  // Generate unique customer code
  async generateCustomerCode(schemeId = null) {
    // If schemeId is provided, get the scheme prefix
    if (schemeId) {
      const scheme = this.db.prepare('SELECT prefix FROM schemes WHERE id = ?').get(schemeId);
      
      if (!scheme) {
        throw new Error('Scheme not found');
      }
      
      const prefix = scheme.prefix;
      console.log('Generating customer code with scheme prefix:', prefix);
      
      // Get the last customer code for this scheme
      const row = this.db.prepare(
        'SELECT customer_code FROM customers WHERE customer_code LIKE ? AND scheme_id = ? ORDER BY id DESC LIMIT 1'
      ).get(`${prefix}-%`, schemeId);

      let nextNumber = 1;
      if (row) {
        // Extract number from existing code (e.g., GD7-1 -> 1)
        const match = row.customer_code.match(/-(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }
      
      const customerCode = `${prefix}-${nextNumber}`;
      console.log('Generated customer code:', customerCode);
      return customerCode;
    } else {
      // Fallback to default prefix for backward compatibility
      const prefix = process.env.CUSTOMER_CODE_PREFIX || 'GD7';
      console.log('Generating customer code with default prefix:', prefix);
      
      // Get the last customer code
      const row = this.db.prepare(
        'SELECT customer_code FROM customers WHERE customer_code LIKE ? ORDER BY id DESC LIMIT 1'
      ).get(`${prefix}%`);

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
      const customerCode = `${prefix}${formattedNumber}`;
      
      console.log('Generated customer code:', customerCode);
      return customerCode;
    }
  }

  // Add new customer
  async addCustomer(customerData) {
    console.log('Database: Starting customer addition process');
    
    // Ensure database is initialized
    if (!this.isInitialized) {
      console.log('Database: Not initialized, initializing now...');
      await this.init();
    }

    try {
      console.log('Database: Adding customer with data:', customerData);
      
      // Basic validation
      if (!customerData || typeof customerData !== 'object') {
        throw new Error('Customer data is required and must be an object');
      }

      const { customer_code, name, phone, address, start_date, monthly_amount, scheme_id } = customerData;

      // Validate required fields
      if (!name || !phone || !address || !start_date || !monthly_amount) {
        throw new Error('All required fields must be provided');
      }

      // Sanitize inputs
      const sanitizedData = {
        customer_code: customer_code ? customer_code.trim() : null,
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        start_date: start_date.trim(),
        monthly_amount: parseFloat(monthly_amount),
        scheme_id: scheme_id ? parseInt(scheme_id) : null
      };

      // Use provided customer code or generate one
      const customerCode = sanitizedData.customer_code || await this.generateCustomerCode();
      
      console.log('Database: Inserting customer with code:', customerCode);
      
      // Insert customer
      const result = this.db.prepare(
        'INSERT INTO customers (customer_code, name, phone, address, start_date, monthly_amount, scheme_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(customerCode, sanitizedData.name, sanitizedData.phone, sanitizedData.address, sanitizedData.start_date, sanitizedData.monthly_amount, sanitizedData.scheme_id);
      
      console.log('Database: Customer inserted successfully with ID:', result.lastInsertRowid);
      
      return { 
        id: result.lastInsertRowid, 
        customer_code: customerCode,
        ...customerData 
      };
    } catch (error) {
      console.error('Database: Customer addition failed:', error);
      throw error;
    }
  }


  // Get customer by phone number
  async getCustomerByPhone(phone) {
    return this.db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
  }

  // Get customer by customer code
  async getCustomerByCode(customerCode) {
    return this.db.prepare('SELECT * FROM customers WHERE customer_code = ?').get(customerCode);
  }

  // Get all customers
  async getCustomers() {
    console.log('Database: Getting all customers...');
    console.log('Database: Database connection exists:', !!this.db);
    
    if (!this.db) {
      console.error('Database: Database connection is null');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM customers ORDER BY created_at DESC').all();
    console.log('Database: Found customers:', rows.length);
    console.log('Database: Customer rows:', rows);
    return rows;
  }

  // Get customers by scheme
  async getCustomersByScheme(schemeId) {
    console.log('Database: Getting customers for scheme:', schemeId);
    console.log('Database: Database connection exists:', !!this.db);
    
    if (!this.db) {
      console.error('Database: Database connection is null');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM customers WHERE scheme_id = ? ORDER BY created_at DESC').all(schemeId);
    console.log('Database: Found customers for scheme', schemeId, ':', rows.length);
    console.log('Database: Customer rows:', rows);
    return rows;
  }

  // Check if customer code already exists
  async checkCustomerCodeExists(customerCode) {
    console.log('Database: Checking if customer code exists:', customerCode);
    const row = this.db.prepare('SELECT id FROM customers WHERE customer_code = ?').get(customerCode);
    const exists = !!row;
    console.log('Database: Customer code exists:', exists);
    return exists;
  }

  // Get customer by ID
  async getCustomerById(customerId) {
    console.log('Database: Getting customer by ID:', customerId);
    const row = this.db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
    console.log('Database: Customer found:', row);
    return row;
  }

  // Add payment
  async addPayment(paymentData) {
    const { customer_id, scheme_id, amount, payment_date, month_year, payment_method, transaction_id, notes } = paymentData;
    
    const result = this.db.prepare(
      'INSERT INTO payments (customer_id, scheme_id, amount, payment_date, month_year, payment_method, transaction_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(customer_id, scheme_id, amount, payment_date, month_year, payment_method, transaction_id, notes);
    
    return { id: result.lastInsertRowid, ...paymentData };
  }

  // Get payments for a customer
  async getCustomerPayments(customerId) {
    return this.db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY payment_date DESC').all(customerId);
  }

  // Get all payments
  async getAllPayments() {
    console.log('Database: Getting all payments...');
    console.log('Database: Database connection exists for payments:', !!this.db);
    
    if (!this.db) {
      console.error('Database: Database connection is null for payments');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM payments ORDER BY payment_date DESC').all();
    console.log('Database: Found payments:', rows.length);
    console.log('Database: Payment rows:', rows);
    return rows;
  }

  // Get payments by scheme
  async getPaymentsByScheme(schemeId) {
    console.log('Database: Getting payments for scheme:', schemeId);
    console.log('Database: Database connection exists for payments:', !!this.db);
    
    if (!this.db) {
      console.error('Database: Database connection is null for payments');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM payments WHERE scheme_id = ? ORDER BY payment_date DESC').all(schemeId);
    console.log('Database: Found payments for scheme', schemeId, ':', rows.length);
    console.log('Database: Payment rows:', rows);
    return rows;
  }

  // Get payments by date
  async getPaymentsByDate(paymentDate, schemeId = null) {
    console.log('Database: Getting payments for date:', paymentDate, 'scheme:', schemeId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for payments by date');
      throw new Error('Database connection is null');
    }
    
    let query, params;
    if (schemeId) {
      query = `SELECT p.*, c.name as customer_name, c.customer_code 
               FROM payments p 
               JOIN customers c ON p.customer_id = c.id 
               WHERE DATE(p.payment_date) = DATE(?) AND p.scheme_id = ?
               ORDER BY p.payment_date DESC`;
      params = [paymentDate, schemeId];
    } else {
      query = `SELECT p.*, c.name as customer_name, c.customer_code 
               FROM payments p 
               JOIN customers c ON p.customer_id = c.id 
               WHERE DATE(p.payment_date) = DATE(?) 
               ORDER BY p.payment_date DESC`;
      params = [paymentDate];
    }
    
    const rows = this.db.prepare(query).all(...params);
    console.log('Database: Found payments for date:', rows.length);
    return rows;
  }

  async getPaymentsByDateRange(startDate, endDate) {
    console.log('Database: Getting payments for date range:', startDate, 'to', endDate);
    
    if (!this.db) {
      console.error('Database: Database connection is null for payments by date range');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare(
      `SELECT p.*, c.name as customer_name, c.customer_code 
       FROM payments p 
       JOIN customers c ON p.customer_id = c.id 
       WHERE DATE(p.payment_date) >= DATE(?) AND DATE(p.payment_date) <= DATE(?) 
       ORDER BY p.payment_date DESC`
    ).all(startDate, endDate);
    
    console.log('Database: Found payments for date range:', rows.length);
    return rows;
  }

  // Get dashboard statistics for a specific scheme
  async getDashboardStats(schemeId = null) {
    if (!schemeId) {
      return {
        totalCustomers: 0,
        unpaidThisMonth: 0,
        paidThisMonth: 0,
        totalOutstanding: 0
      };
    }

    const totalCustomers = this.db.prepare('SELECT COUNT(*) as count FROM customers WHERE scheme_id = ?').get(schemeId).count || 0;
    
    const unpaidThisMonth = this.db.prepare(`SELECT COUNT(*) as count FROM customers c 
                                              WHERE c.scheme_id = ? 
                                              AND NOT EXISTS (
                                                SELECT 1 FROM payments p 
                                                WHERE p.customer_id = c.id 
                                                AND p.month_year = strftime('%Y-%m', 'now')
                                                AND p.scheme_id = ?
                                              )
                                              AND NOT EXISTS (
                                                SELECT 1 FROM winners w 
                                                WHERE w.customer_id = c.id
                                                AND w.scheme_id = ?
                                              )`).get(schemeId, schemeId, schemeId).count || 0;
    
    const paidThisMonth = this.db.prepare(`SELECT COUNT(*) as count FROM customers c 
                                            WHERE c.scheme_id = ?
                                            AND EXISTS (
                                              SELECT 1 FROM payments p 
                                              WHERE p.customer_id = c.id 
                                              AND p.month_year = strftime('%Y-%m', 'now')
                                              AND p.scheme_id = ?
                                            )
                                            AND NOT EXISTS (
                                              SELECT 1 FROM winners w 
                                              WHERE w.customer_id = c.id
                                              AND w.scheme_id = ?
                                            )`).get(schemeId, schemeId, schemeId).count || 0;
    
    const totalOutstanding = this.db.prepare(`SELECT COALESCE(SUM(c.monthly_amount), 0) as total FROM customers c 
                                               WHERE c.scheme_id = ?
                                               AND NOT EXISTS (
                                                 SELECT 1 FROM payments p 
                                                 WHERE p.customer_id = c.id 
                                                 AND p.month_year = strftime('%Y-%m', 'now')
                                                 AND p.scheme_id = ?
                                               )
                                               AND NOT EXISTS (
                                                 SELECT 1 FROM winners w 
                                                 WHERE w.customer_id = c.id
                                                 AND w.scheme_id = ?
                                               )`).get(schemeId, schemeId, schemeId).total || 0;

    return {
      totalCustomers,
      unpaidThisMonth,
      paidThisMonth,
      totalOutstanding
    };
  }

  // Scheme management functions
  async addScheme(schemeData) {
    console.log('Database: Adding scheme:', schemeData);
    
    if (!this.db) {
      console.error('Database: Database connection is null for adding scheme');
      throw new Error('Database connection is null');
    }

    const { name, prefix, start_date, duration, amounts } = schemeData;
    const amountsJson = JSON.stringify(amounts);

    const result = this.db.prepare(
      'INSERT INTO schemes (name, prefix, start_date, duration, amounts) VALUES (?, ?, ?, ?, ?)'
    ).run(name, prefix, start_date, duration, amountsJson);
    
    console.log('Database: Scheme added successfully with ID:', result.lastInsertRowid);
    return { id: result.lastInsertRowid, ...schemeData };
  }

  async getAllSchemes() {
    console.log('Database: Getting all schemes');
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting schemes');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM schemes ORDER BY created_at DESC').all();
    console.log('Database: Found schemes:', rows.length);
    
    // Parse amounts JSON for each scheme
    const schemes = rows.map(scheme => ({
      ...scheme,
      amounts: JSON.parse(scheme.amounts)
    }));
    return schemes;
  }

  async getSchemeById(schemeId) {
    console.log('Database: Getting scheme by ID:', schemeId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting scheme');
      throw new Error('Database connection is null');
    }
    
    const row = this.db.prepare('SELECT * FROM schemes WHERE id = ?').get(schemeId);
    
    if (row) {
      console.log('Database: Scheme found');
      return {
        ...row,
        amounts: JSON.parse(row.amounts)
      };
    } else {
      console.log('Database: Scheme not found');
      return null;
    }
  }

  async updateScheme(schemeId, schemeData) {
    console.log('Database: Updating scheme:', schemeId, schemeData);
    
    if (!this.db) {
      console.error('Database: Database connection is null for updating scheme');
      throw new Error('Database connection is null');
    }

    const { name, prefix, start_date, duration, amounts } = schemeData;
    const amountsJson = JSON.stringify(amounts);

    this.db.prepare(
      'UPDATE schemes SET name = ?, prefix = ?, start_date = ?, duration = ?, amounts = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(name, prefix, start_date, duration, amountsJson, schemeId);
    
    console.log('Database: Scheme updated successfully');
    return { id: schemeId, ...schemeData };
  }

  async deleteScheme(schemeId) {
    console.log('Database: Deleting scheme:', schemeId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for deleting scheme');
      throw new Error('Database connection is null');
    }

    // Start transaction for cascade deletion
    this.db.transaction((schemeId) => {
      // Delete related records first (in case cascade doesn't work due to table structure)
      this.db.prepare('DELETE FROM payments WHERE scheme_id = ?').run(schemeId);
      this.db.prepare('DELETE FROM winners WHERE scheme_id = ?').run(schemeId);
      this.db.prepare('DELETE FROM customers WHERE scheme_id = ?').run(schemeId);
      
      // Finally delete the scheme itself
      this.db.prepare('DELETE FROM schemes WHERE id = ?').run(schemeId);
    })(schemeId);
    
    console.log('Database: Scheme and all related data deleted successfully');
    return { id: schemeId };
  }

  // Close database connection
  close() {
    if (this.db) {
      this.db.close();
      console.log('Database connection closed');
    }
  }

  // Clear all data from database (except admin user)
  async clearAllData() {
    console.log('Database: Clearing all data...');
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    // Start transaction
    this.db.transaction(() => {
      // Delete all payments
      this.db.prepare('DELETE FROM payments').run();
      console.log('Database: Payments deleted');

      // Delete all customers
      this.db.prepare('DELETE FROM customers').run();
      console.log('Database: Customers deleted');

      // Delete all deliveries
      this.db.prepare('DELETE FROM deliveries').run();
      console.log('Database: Deliveries deleted');

      // Delete all winners
      this.db.prepare('DELETE FROM winners').run();
      console.log('Database: Winners deleted');

      // Reset auto-increment counters
      this.db.prepare('DELETE FROM sqlite_sequence WHERE name IN ("customers", "payments", "winners", "deliveries")').run();
      console.log('Database: Auto-increment counters reset');
    })();
    
    console.log('Database: All data cleared successfully');
  }

  // Winners methods
  async addWinner(customerId, schemeId, monthYear, goldRate, winningAmount, position) {
    console.log('Database: Adding winner:', { customerId, schemeId, monthYear, goldRate, winningAmount, position });
    
    if (!this.db) {
      console.error('Database: Database connection is null for adding winner');
      throw new Error('Database connection is null');
    }
    
    const result = this.db.prepare(
      'INSERT INTO winners (customer_id, scheme_id, month_year, gold_rate, winning_amount, position) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(customerId, schemeId, monthYear, goldRate, winningAmount, position);
    
    console.log('Database: Winner added successfully with ID:', result.lastInsertRowid);
    return { id: result.lastInsertRowid, customer_id: customerId, scheme_id: schemeId, month_year: monthYear, gold_rate: goldRate, winning_amount: winningAmount, position: position };
  }

  async getAllWinners() {
    console.log('Database: Getting all winners');
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting winners');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare(`SELECT w.*, c.name as customer_name, c.customer_code,
                                   COALESCE(SUM(d.amount), 0) as delivered_amount,
                                   (w.winning_amount - COALESCE(SUM(d.amount), 0)) as remaining_balance
                                   FROM winners w
                                   JOIN customers c ON w.customer_id = c.id
                                   LEFT JOIN deliveries d ON w.id = d.winner_id
                                   GROUP BY w.id
                                   ORDER BY w.created_at DESC`).all();
    
    console.log('Database: Found winners:', rows.length);
    return rows;
  }

  async getWinnersByScheme(schemeId) {
    console.log('Database: Getting winners for scheme:', schemeId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting winners');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare(`SELECT w.*, c.name as customer_name, c.customer_code,
                                   COALESCE(SUM(d.amount), 0) as delivered_amount,
                                   (w.winning_amount - COALESCE(SUM(d.amount), 0)) as remaining_balance
                                   FROM winners w
                                   JOIN customers c ON w.customer_id = c.id
                                   LEFT JOIN deliveries d ON w.id = d.winner_id
                                   WHERE w.scheme_id = ?
                                   GROUP BY w.id
                                   ORDER BY w.created_at DESC`).all(schemeId);
    
    console.log('Database: Found winners for scheme', schemeId, ':', rows.length);
    return rows;
  }

  async getAvailableMonths(schemeId = null) {
    console.log('Database: Getting available months for scheme:', schemeId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting available months');
      throw new Error('Database connection is null');
    }

    if (!schemeId) {
      console.log('Database: No scheme ID provided, returning empty array');
      return [];
    }

    // Get scheme details to generate months from scheme start date and duration
    const scheme = this.db.prepare('SELECT start_date, duration FROM schemes WHERE id = ?').get(schemeId);
    
    if (!scheme) {
      console.log('Database: Scheme not found, returning empty array');
      return [];
    }

    // Generate months from scheme start date for the scheme duration
    const months = [];
    const startDate = new Date(scheme.start_date);
    
    for (let i = 0; i < scheme.duration; i++) {
      const date = new Date(startDate);
      date.setMonth(date.getMonth() + i);
      const monthYear = date.toISOString().slice(0, 7);
      months.push(monthYear);
    }
    
    // Get months that already have winners for this scheme
    const winnerRows = this.db.prepare('SELECT DISTINCT month_year FROM winners WHERE scheme_id = ?').all(schemeId);
    const winnerMonths = winnerRows.map(row => row.month_year);
    const availableMonths = months.filter(month => !winnerMonths.includes(month));
    
    console.log('Database: Available months for scheme', schemeId, ':', availableMonths.length);
    return availableMonths;
  }

  // Delivery methods
  async addDelivery(winnerId, billNumber, amount, notes = null) {
    console.log('Database: Adding delivery:', { winnerId, billNumber, amount, notes });
    
    if (!this.db) {
      console.error('Database: Database connection is null for adding delivery');
      throw new Error('Database connection is null');
    }

    // First, get the winner's winning amount and current delivered amount
    const result = this.db.prepare(
      `SELECT w.winning_amount, COALESCE(SUM(d.amount), 0) as delivered_amount
       FROM winners w
       LEFT JOIN deliveries d ON w.id = d.winner_id
       WHERE w.id = ?
       GROUP BY w.id, w.winning_amount`
    ).get(winnerId);

    if (!result) {
      throw new Error('Winner not found');
    }

    const { winning_amount, delivered_amount } = result;
    const newTotal = delivered_amount + amount;

    console.log(`Database: Winner ${winnerId} - Winning: ${winning_amount}, Delivered: ${delivered_amount}, New delivery: ${amount}, New total: ${newTotal}`);

    // Check if the new delivery would exceed the winning amount
    if (newTotal > winning_amount) {
      const remaining = winning_amount - delivered_amount;
      throw new Error(`Delivery amount (₹${amount}) exceeds remaining balance. Maximum allowed: ₹${remaining}`);
    }
    
    // Proceed with adding the delivery
    const insertResult = this.db.prepare(
      'INSERT INTO deliveries (winner_id, bill_number, amount, notes) VALUES (?, ?, ?, ?)'
    ).run(winnerId, billNumber, amount, notes);
    
    console.log('Database: Delivery added successfully with ID:', insertResult.lastInsertRowid);
    
    // Update winner delivery status if fully delivered
    this.db.prepare(
      `UPDATE winners SET is_delivered = 1 
       WHERE id = ? AND winning_amount <= (
         SELECT COALESCE(SUM(amount), 0) FROM deliveries WHERE winner_id = ?
       )`
    ).run(winnerId, winnerId);
    
    return { id: insertResult.lastInsertRowid, winnerId, billNumber, amount, notes };
  }

  async getDeliveriesByWinner(winnerId) {
    console.log('Database: Getting deliveries for winner:', winnerId);
    
    if (!this.db) {
      console.error('Database: Database connection is null for getting deliveries');
      throw new Error('Database connection is null');
    }
    
    const rows = this.db.prepare('SELECT * FROM deliveries WHERE winner_id = ? ORDER BY delivery_date DESC').all(winnerId);
    console.log('Database: Found deliveries:', rows.length);
    return rows;
  }
}

module.exports = Database;