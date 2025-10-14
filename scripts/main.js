const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const AuthService = require('../scripts/auth');
require('dotenv').config();

// Keep a global reference of the window object
let mainWindow;
let authService;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "HSM-TERA",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js')
    },
    show: false, // Don't show until ready
    titleBarStyle: 'default'
  });

  // Load the HTML file (default to login.html)
  const startPage = process.argv.includes('--main') ? 'pages/index.html' : 'pages/login.html';
  mainWindow.loadFile(path.join(__dirname, '..', startPage));

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // Open DevTools in development
    if (process.argv.includes('--dev')) {
      mainWindow.webContents.openDevTools();
    }
  });

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  // Initialize authentication service
  try {
    authService = new AuthService();
    await authService.init();
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
  }

  createWindow();

  // On macOS, re-create window when dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Create application menu
  createMenu();
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  // On macOS, keep app running even when all windows are closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Security: Prevent new window creation
app.on('web-contents-created', (event, contents) => {
  contents.on('new-window', (event, navigationUrl) => {
    event.preventDefault();
    require('electron').shell.openExternal(navigationUrl);
  });
  
  // Handle navigation within the app
  contents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // Allow navigation to our local HTML files
    if (parsedUrl.protocol === 'file:') {
      const allowedFiles = ['pages/index.html', 'pages/login.html', 'pages/scheme-selection.html', 'pages/dashboard.html', 'pages/add-customer.html', 'pages/add-payment.html', 'pages/customer.html', 'pages/customers.html', 'pages/unpaid.html', 'pages/settings.html', 'pages/transactions.html', 'pages/winners.html'];
      const filePath = parsedUrl.pathname;
      
      if (allowedFiles.some(file => filePath.endsWith(file))) {
        return; // Allow navigation
      }
    }
    
    // Prevent other navigation
    event.preventDefault();
  });
});

// Create application menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu-new-file');
          }
        },
        {
          label: 'Open',
          accelerator: 'CmdOrCtrl+O',
          click: () => {
            mainWindow.webContents.send('menu-open-file');
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            mainWindow.webContents.send('menu-about');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC handlers for communication with renderer process
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

ipcMain.handle('get-app-name', () => {
  return app.getName();
});


// Authentication IPC handlers
ipcMain.handle('auth-login', async (event, credentials) => {
  try {
    if (!authService) {
      throw new Error('Authentication service not initialized');
    }
    
    console.log('IPC: Received login request for:', credentials.username);
    const { username, password } = credentials;
    const result = await authService.login(username, password);
    console.log('IPC: Login result:', result);
    return result;
  } catch (error) {
    console.error('IPC: Login error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('auth-validate-session', async (event, token) => {
  try {
    if (!authService) {
      throw new Error('Authentication service not initialized');
    }
    
    const result = await authService.validateSession(token);
    return result;
  } catch (error) {
    console.error('Session validation error:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
});

ipcMain.handle('auth-logout', async (event, token) => {
  try {
    if (!authService) {
      throw new Error('Authentication service not initialized');
    }
    
    const result = await authService.logout(token);
    return result;
  } catch (error) {
    console.error('Logout error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Customer management IPC handlers
ipcMain.handle('customer-add', async (event, customerData) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Adding customer with data:', customerData);
    const result = await authService.db.addCustomer(customerData);
    console.log('IPC: Customer added successfully:', result);
    
    return {
      success: true,
      customer: result
    };
  } catch (error) {
    console.error('IPC: Add customer error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('customer-get-all', async (event, schemeId = null) => {
  console.log('IPC: customer-get-all handler called for scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized');
      throw new Error('Database service not initialized');
    }
    
    let customers;
    if (schemeId) {
      console.log('IPC: Getting customers for scheme:', schemeId);
      customers = await authService.db.getCustomersByScheme(schemeId);
    } else {
      console.log('IPC: Getting all customers');
      customers = await authService.db.getCustomers();
    }
    console.log('IPC: All customers found:', customers.length);
    
    return {
      success: true,
      customers: customers
    };
  } catch (error) {
    console.error('IPC: Get customers error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('customer-check-code', async (event, customerCode) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Checking if customer code exists:', customerCode);
    const exists = await authService.db.checkCustomerCodeExists(customerCode);
    console.log('IPC: Customer code exists:', exists);
    
    return {
      success: true,
      exists: exists
    };
  } catch (error) {
    console.error('IPC: Check customer code error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('customer-get-by-id', async (event, customerId) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Getting customer by ID:', customerId);
    const customer = await authService.db.getCustomerById(customerId);
    console.log('IPC: Customer found:', customer);
    
    return {
      success: true,
      customer: customer
    };
  } catch (error) {
    console.error('IPC: Get customer by ID error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('customer-get-payments', async (event, customerId) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Getting payments for customer:', customerId);
    const payments = await authService.db.getCustomerPayments(customerId);
    console.log('IPC: Payments found:', payments.length);
    
    return {
      success: true,
      payments: payments
    };
  } catch (error) {
    console.error('IPC: Get customer payments error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Payment management IPC handlers
ipcMain.handle('payment-add', async (event, paymentData) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Adding payment with data:', paymentData);
    const result = await authService.db.addPayment(paymentData);
    console.log('IPC: Payment added successfully:', result);
    
    return {
      success: true,
      payment: result
    };
  } catch (error) {
    console.error('IPC: Add payment error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('payment-get-by-customer', async (event, customerId) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Getting payments for customer:', customerId);
    const payments = await authService.db.getCustomerPayments(customerId);
    console.log('IPC: Payments found:', payments.length);
    
    return {
      success: true,
      payments: payments
    };
  } catch (error) {
    console.error('IPC: Get payments by customer error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('payment-get-all', async (event, schemeId = null) => {
  console.log('IPC: payment-get-all handler called for scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for payments');
      throw new Error('Database service not initialized');
    }
    
    let payments;
    if (schemeId) {
      console.log('IPC: Getting payments for scheme:', schemeId);
      payments = await authService.db.getPaymentsByScheme(schemeId);
    } else {
      console.log('IPC: Getting all payments');
      payments = await authService.db.getAllPayments();
    }
    console.log('IPC: All payments found:', payments.length);
    
    return {
      success: true,
      payments: payments
    };
  } catch (error) {
    console.error('IPC: Get all payments error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('transactions-get-by-date', async (event, paymentDate, schemeId = null) => {
  console.log('IPC: transactions-get-by-date handler called for date:', paymentDate, 'scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for transactions by date');
      throw new Error('Database service not initialized');
    }

    console.log('IPC: Getting transactions for date:', paymentDate, 'scheme:', schemeId);
    const transactions = await authService.db.getPaymentsByDate(paymentDate, schemeId);
    console.log('IPC: Transactions found:', transactions.length);

    return {
      success: true,
      transactions: transactions
    };
  } catch (error) {
    console.error('IPC: Get transactions by date error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('transactions-get-by-date-range', async (event, startDate, endDate) => {
  console.log('IPC: transactions-get-by-date-range handler called for range:', startDate, 'to', endDate);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for transactions by date range');
      throw new Error('Database service not initialized');
    }

    console.log('IPC: Getting transactions for date range:', startDate, 'to', endDate);
    const transactions = await authService.db.getPaymentsByDateRange(startDate, endDate);
    console.log('IPC: Transactions found for range:', transactions.length);

    return {
      success: true,
      transactions: transactions
    };
  } catch (error) {
    console.error('IPC: Get transactions by date range error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Winners IPC handlers
ipcMain.handle('winners-add', async (event, winnerData) => {
  console.log('IPC: winners-add handler called:', winnerData);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for adding winner');
      throw new Error('Database service not initialized');
    }

    const { customerId, schemeId, monthYear, goldRate, winningAmount, position } = winnerData;
    const winner = await authService.db.addWinner(customerId, schemeId, monthYear, goldRate, winningAmount, position);
    
    return {
      success: true,
      winner: winner
    };
  } catch (error) {
    console.error('IPC: Add winner error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('winners-get-all', async (event, schemeId = null) => {
  console.log('IPC: winners-get-all handler called for scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for getting winners');
      throw new Error('Database service not initialized');
    }

    let winners;
    if (schemeId) {
      console.log('IPC: Getting winners for scheme:', schemeId);
      winners = await authService.db.getWinnersByScheme(schemeId);
    } else {
      console.log('IPC: Getting all winners');
      winners = await authService.db.getAllWinners();
    }
    
    return {
      success: true,
      winners: winners
    };
  } catch (error) {
    console.error('IPC: Get winners error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('winners-get-available-months', async (event, schemeId = null) => {
  console.log('IPC: winners-get-available-months handler called for scheme:', schemeId);
  console.log('IPC: schemeId type:', typeof schemeId);
  console.log('IPC: schemeId value:', JSON.stringify(schemeId));
  
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for getting available months');
      throw new Error('Database service not initialized');
    }

    // If no schemeId provided, try to get it from the request context
    if (!schemeId) {
      console.log('IPC: No scheme ID provided, this will return empty array');
    }

    const availableMonths = await authService.db.getAvailableMonths(schemeId);
    console.log('IPC: Available months result:', availableMonths);
    
    return {
      success: true,
      availableMonths: availableMonths
    };
  } catch (error) {
    console.error('IPC: Get available months error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Delivery IPC handlers
ipcMain.handle('delivery-add', async (event, deliveryData) => {
  console.log('IPC: delivery-add handler called:', deliveryData);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for adding delivery');
      throw new Error('Database service not initialized');
    }

    const { winnerId, billNumber, amount, notes } = deliveryData;
    const delivery = await authService.db.addDelivery(winnerId, billNumber, amount, notes);
    
    return {
      success: true,
      delivery: delivery
    };
  } catch (error) {
    console.error('IPC: Add delivery error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('delivery-get-by-winner', async (event, winnerId) => {
  console.log('IPC: delivery-get-by-winner handler called for winner:', winnerId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for getting deliveries');
      throw new Error('Database service not initialized');
    }

    const deliveries = await authService.db.getDeliveriesByWinner(winnerId);
    
    return {
      success: true,
      deliveries: deliveries
    };
  } catch (error) {
    console.error('IPC: Get deliveries error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('dashboard-stats', async (event, schemeId = null) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: dashboard-stats handler called for scheme:', schemeId);
    const stats = await authService.db.getDashboardStats(schemeId);
    return {
      success: true,
      stats: stats
    };
  } catch (error) {
    console.error('Get dashboard stats error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Scheme IPC handlers
ipcMain.handle('schemes-add', async (event, schemeData) => {
  console.log('IPC: schemes-add handler called:', schemeData);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for adding scheme');
      throw new Error('Database service not initialized');
    }

    const scheme = await authService.db.addScheme(schemeData);
    
    return {
      success: true,
      scheme: scheme
    };
  } catch (error) {
    console.error('IPC: Add scheme error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('schemes-get-all', async (event) => {
  console.log('IPC: schemes-get-all handler called');
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for getting schemes');
      throw new Error('Database service not initialized');
    }

    const schemes = await authService.db.getAllSchemes();
    
    return {
      success: true,
      schemes: schemes
    };
  } catch (error) {
    console.error('IPC: Get schemes error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('schemes-get-by-id', async (event, schemeId) => {
  console.log('IPC: schemes-get-by-id handler called for scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for getting scheme');
      throw new Error('Database service not initialized');
    }

    const scheme = await authService.db.getSchemeById(schemeId);
    
    return {
      success: true,
      scheme: scheme
    };
  } catch (error) {
    console.error('IPC: Get scheme error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('schemes-update', async (event, schemeId, schemeData) => {
  console.log('IPC: schemes-update handler called for scheme:', schemeId, schemeData);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for updating scheme');
      throw new Error('Database service not initialized');
    }

    const scheme = await authService.db.updateScheme(schemeId, schemeData);
    
    return {
      success: true,
      scheme: scheme
    };
  } catch (error) {
    console.error('IPC: Update scheme error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('schemes-delete', async (event, schemeId) => {
  console.log('IPC: schemes-delete handler called for scheme:', schemeId);
  try {
    if (!authService || !authService.db) {
      console.error('IPC: Database service not initialized for deleting scheme');
      throw new Error('Database service not initialized');
    }

    const result = await authService.db.deleteScheme(schemeId);
    
    return {
      success: true,
      result: result
    };
  } catch (error) {
    console.error('IPC: Delete scheme error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Navigation handler
ipcMain.handle('navigate-to', (event, targetPath) => {
  console.log('IPC: Navigate to:', targetPath);
  if (mainWindow) {
    const fullPath = path.join(__dirname, '..', targetPath);
    console.log('IPC: Full path:', fullPath);
    mainWindow.loadFile(fullPath);
  }
});

// Customer Code Generation Handler
ipcMain.handle('get-next-customer-code', async (event, schemeId = null) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Getting next customer code for scheme:', schemeId);
    
    // Use the database method to generate customer code
    const customerCode = await authService.db.generateCustomerCode(schemeId);
    
    console.log('IPC: Generated customer code:', customerCode);
    
    return {
      success: true,
      nextCode: customerCode
    };
  } catch (error) {
    console.error('IPC: Get next customer code error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Customer Code Validation Handler
ipcMain.handle('validate-customer-code', async (event, customerCode) => {
  try {
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    console.log('IPC: Validating customer code:', customerCode);
    const customers = await authService.db.getCustomers();
    
    // Check if code already exists (normalize both codes for comparison)
    const exists = customers.some(customer => {
      if (!customer.customer_code) return false;
      // Normalize both codes by removing spaces and converting to lowercase
      const normalizedExisting = customer.customer_code.replace(/\s+/g, '').toLowerCase();
      const normalizedNew = customerCode.replace(/\s+/g, '').toLowerCase();
      return normalizedExisting === normalizedNew;
    });
    
    console.log('IPC: Customer code exists:', exists);
    
    return {
      success: true,
      exists: exists,
      valid: !exists
    };
  } catch (error) {
    console.error('IPC: Validate customer code error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});

// Get Default Start Date Handler
ipcMain.handle('get-default-start-date', async (event) => {
  try {
    console.log('IPC: Getting default start date');
    
    // Read from environment or use default
    const defaultStartDate = process.env.DEFAULT_START_DATE || '2024-12-15';
    
    console.log('IPC: Default start date:', defaultStartDate);
    
    return {
      success: true,
      startDate: defaultStartDate
    };
  } catch (error) {
    console.error('IPC: Get default start date error:', error.message);
    return {
      success: false,
      error: error.message,
      startDate: '2024-12-15' // fallback
    };
  }
});

// Clear Database Handler
ipcMain.handle('clear-database', async (event) => {
  try {
    console.log('IPC: Clearing database');
    
    if (!authService || !authService.db) {
      throw new Error('Database service not initialized');
    }
    
    // Clear all data from database
    await authService.db.clearAllData();
    
    console.log('IPC: Database cleared successfully');
    
    return {
      success: true,
      message: 'Database cleared successfully'
    };
  } catch (error) {
    console.error('IPC: Clear database error:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
});
