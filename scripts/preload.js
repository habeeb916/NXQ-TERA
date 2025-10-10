const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
  getDefaultStartDate: () => ipcRenderer.invoke('get-default-start-date'),

  // Authentication
  auth: {
    login: (credentials) => ipcRenderer.invoke('auth-login', credentials),
    validateSession: (token) => ipcRenderer.invoke('auth-validate-session', token),
    logout: (token) => ipcRenderer.invoke('auth-logout', token)
  },

  // Customer management
  customer: {
    add: (customerData) => ipcRenderer.invoke('customer-add', customerData),
    getAll: () => ipcRenderer.invoke('customer-get-all'),
    getById: (id) => ipcRenderer.invoke('customer-get-by-id', id),
    checkCode: (code) => ipcRenderer.invoke('customer-check-code', code),
    getPayments: (customerId) => ipcRenderer.invoke('customer-get-payments', customerId),
    getNextCode: () => ipcRenderer.invoke('get-next-customer-code'),
    validateCode: (code) => ipcRenderer.invoke('validate-customer-code', code)
  },

  // Payment management
  payment: {
    add: (paymentData) => ipcRenderer.invoke('payment-add', paymentData),
    getByCustomerId: (customerId) => ipcRenderer.invoke('payment-get-by-customer', customerId),
    getAll: () => ipcRenderer.invoke('payment-get-all')
  },

        // Transactions
        getTransactionsByDate: (paymentDate) => ipcRenderer.invoke('transactions-get-by-date', paymentDate),
        getTransactionsByDateRange: (startDate, endDate) => ipcRenderer.invoke('transactions-get-by-date-range', startDate, endDate),

  // Winners
  winners: {
    add: (winnerData) => ipcRenderer.invoke('winners-add', winnerData),
    getAll: () => ipcRenderer.invoke('winners-get-all'),
    getAvailableMonths: () => ipcRenderer.invoke('winners-get-available-months')
  },

  // Deliveries
  deliveries: {
    add: (deliveryData) => ipcRenderer.invoke('delivery-add', deliveryData),
    getByWinner: (winnerId) => ipcRenderer.invoke('delivery-get-by-winner', winnerId)
  },

  // Dashboard
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard-stats')
  },

  // Navigation
  navigation: {
    navigateTo: (path) => ipcRenderer.invoke('navigate-to', path)
  },

  // Database management
  clearDatabase: () => ipcRenderer.invoke('clear-database')
});
