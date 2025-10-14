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
    getAll: (schemeId = null) => ipcRenderer.invoke('customer-get-all', schemeId),
    getById: (id) => ipcRenderer.invoke('customer-get-by-id', id),
    checkCode: (code) => ipcRenderer.invoke('customer-check-code', code),
    getPayments: (customerId) => ipcRenderer.invoke('customer-get-payments', customerId),
    getNextCode: (schemeId) => ipcRenderer.invoke('get-next-customer-code', schemeId),
    validateCode: (code) => ipcRenderer.invoke('validate-customer-code', code)
  },

  // Payment management
  payment: {
    add: (paymentData) => ipcRenderer.invoke('payment-add', paymentData),
    getByCustomerId: (customerId) => ipcRenderer.invoke('payment-get-by-customer', customerId),
    getAll: (schemeId = null) => ipcRenderer.invoke('payment-get-all', schemeId)
  },

        // Transactions
        getTransactionsByDate: (paymentDate, schemeId = null) => ipcRenderer.invoke('transactions-get-by-date', paymentDate, schemeId),
        getTransactionsByDateRange: (startDate, endDate) => ipcRenderer.invoke('transactions-get-by-date-range', startDate, endDate),

  // Winners
  winners: {
    add: (winnerData) => ipcRenderer.invoke('winners-add', winnerData),
    getAll: (schemeId = null) => ipcRenderer.invoke('winners-get-all', schemeId),
    getAvailableMonths: (schemeId = null) => ipcRenderer.invoke('winners-get-available-months', schemeId)
  },

  // Deliveries
  deliveries: {
    add: (deliveryData) => ipcRenderer.invoke('delivery-add', deliveryData),
    getByWinner: (winnerId) => ipcRenderer.invoke('delivery-get-by-winner', winnerId)
  },

  // Schemes
  schemes: {
    add: (schemeData) => ipcRenderer.invoke('schemes-add', schemeData),
    getAll: () => ipcRenderer.invoke('schemes-get-all'),
    getById: (schemeId) => ipcRenderer.invoke('schemes-get-by-id', schemeId),
    update: (schemeId, schemeData) => ipcRenderer.invoke('schemes-update', schemeId, schemeData),
    delete: (schemeId) => ipcRenderer.invoke('schemes-delete', schemeId)
  },

  // Dashboard
  dashboard: {
    getStats: (schemeId = null) => ipcRenderer.invoke('dashboard-stats', schemeId)
  },

  // Navigation
  navigation: {
    navigateTo: (path) => ipcRenderer.invoke('navigate-to', path)
  },

  // Database management
  clearDatabase: () => ipcRenderer.invoke('clear-database')
});
