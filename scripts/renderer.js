// Renderer process JavaScript
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Renderer process loaded');
    
    // Initialize the application
    await initializeApp();
    setupEventListeners();
    loadAppInfo();
});

// Initialize the application
async function initializeApp() {
    try {
        // Set initial theme
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        updateThemeButton(savedTheme);
        
        console.log('App initialized successfully');
    } catch (error) {
        console.error('Error initializing app:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Theme toggle button
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Login button
    const loginBtn = document.getElementById('login-btn');
    if (loginBtn) {
        loginBtn.addEventListener('click', openLoginPage);
    }
    
    // Info button
    const infoBtn = document.getElementById('info-btn');
    if (infoBtn) {
        infoBtn.addEventListener('click', showInfoModal);
    }
    
    // Demo button
    const demoBtn = document.getElementById('demo-btn');
    if (demoBtn) {
        demoBtn.addEventListener('click', handleDemoClick);
    }
    
    // Demo input
    const demoInput = document.getElementById('demo-input');
    if (demoInput) {
        demoInput.addEventListener('input', handleDemoInput);
    }
    
    // Modal close button
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', hideInfoModal);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideInfoModal();
            }
        });
    }
    
    // Menu event listeners (if electronAPI is available)
    if (window.electronAPI) {
        window.electronAPI.onMenuNewFile(() => {
            console.log('New file menu item clicked');
            showNotification('New file action triggered');
        });
        
        window.electronAPI.onMenuOpenFile(() => {
            console.log('Open file menu item clicked');
            showNotification('Open file action triggered');
        });
        
        window.electronAPI.onMenuAbout(() => {
            showInfoModal();
        });
    }
}

// Load application information
async function loadAppInfo() {
    try {
        if (window.electronAPI) {
            const appName = await window.electronAPI.getAppName();
            const appVersion = await window.electronAPI.getAppVersion();
            const platform = window.electronAPI.platform;
            
            document.getElementById('app-name').textContent = appName;
            document.getElementById('app-version').textContent = appVersion;
            document.getElementById('app-platform').textContent = platform;
        } else {
            // Fallback values when not running in Electron
            document.getElementById('app-name').textContent = 'NXQ Electron App';
            document.getElementById('app-version').textContent = '1.0.0';
            document.getElementById('app-platform').textContent = 'Web Browser';
        }
    } catch (error) {
        console.error('Error loading app info:', error);
        document.getElementById('app-name').textContent = 'Error loading';
        document.getElementById('app-version').textContent = 'Error loading';
        document.getElementById('app-platform').textContent = 'Error loading';
    }
}

// Theme management
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
    
    console.log(`Theme changed to: ${newTheme}`);
}

function updateThemeButton(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
        themeToggle.title = `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`;
    }
}

// Login page navigation
function openLoginPage() {
    window.location.href = 'login.html';
}

// Modal management
function showInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function hideInfoModal() {
    const modal = document.getElementById('info-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Demo functionality
function handleDemoClick() {
    const output = document.getElementById('demo-output');
    const input = document.getElementById('demo-input');
    
    const timestamp = new Date().toLocaleTimeString();
    const message = input.value || 'Button clicked!';
    
    const newEntry = document.createElement('div');
    newEntry.innerHTML = `<strong>[${timestamp}]</strong> ${message}`;
    newEntry.style.marginBottom = '0.5rem';
    newEntry.style.padding = '0.5rem';
    newEntry.style.background = 'var(--bg-primary)';
    newEntry.style.borderRadius = '4px';
    newEntry.style.border = '1px solid var(--border-color)';
    
    output.appendChild(newEntry);
    output.scrollTop = output.scrollHeight;
    
    // Clear input after action
    input.value = '';
    
    // Add some visual feedback
    const demoBtn = document.getElementById('demo-btn');
    demoBtn.style.transform = 'scale(0.95)';
    setTimeout(() => {
        demoBtn.style.transform = 'scale(1)';
    }, 150);
}

function handleDemoInput(event) {
    const value = event.target.value;
    const demoBtn = document.getElementById('demo-btn');
    
    // Update button text based on input
    if (value.trim()) {
        demoBtn.textContent = `Click to send: "${value}"`;
    } else {
        demoBtn.textContent = 'Click Me!';
    }
}

// Utility functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: var(--primary-color);
        color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--border-radius);
        box-shadow: var(--shadow-medium);
        z-index: 1001;
        animation: slideInRight 0.3s ease;
        max-width: 300px;
    `;
    
    // Add animation keyframes if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            @keyframes slideOutRight {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (event) => {
    // Ctrl/Cmd + T to toggle theme
    if ((event.ctrlKey || event.metaKey) && event.key === 't') {
        event.preventDefault();
        toggleTheme();
    }
    
    // Escape to close modal
    if (event.key === 'Escape') {
        hideInfoModal();
    }
    
    // Enter in demo input to trigger demo
    if (event.key === 'Enter' && event.target.id === 'demo-input') {
        handleDemoClick();
    }
});

// Performance monitoring
if (window.performance) {
    window.addEventListener('load', () => {
        const loadTime = window.performance.timing.loadEventEnd - window.performance.timing.navigationStart;
        console.log(`Page loaded in ${loadTime}ms`);
    });
}

// Error handling
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showNotification('An error occurred. Check console for details.', 'error');
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showNotification('An unexpected error occurred.', 'error');
});

console.log('Renderer script loaded successfully');
