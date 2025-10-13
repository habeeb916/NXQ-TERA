// Standardized Toast Notification System
// Usage: showToast(message, type)
// Types: 'success', 'error', 'warning', 'info'

window.showToast = function(message, type = 'info') {
  // Remove existing toasts to prevent stacking
  const existingToasts = document.querySelectorAll('.hsm-toast');
  existingToasts.forEach(toast => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  });
  
  // Create toast element
  const toast = document.createElement('div');
  toast.className = 'hsm-toast fixed top-4 right-4 z-50 max-w-sm w-full bg-white rounded-xl shadow-lg border border-slate-200 p-4 transform transition-all duration-300 translate-x-full';
  
  // Set icon and colors based on type
  let iconSvg = '';
  let iconColor = '';
  let borderColor = '';
  
  switch (type) {
    case 'success':
      iconSvg = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>';
      iconColor = 'text-green-500';
      borderColor = 'border-l-4 border-green-500';
      break;
    case 'error':
      iconSvg = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>';
      iconColor = 'text-red-500';
      borderColor = 'border-l-4 border-red-500';
      break;
    case 'warning':
      iconSvg = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"></path>';
      iconColor = 'text-yellow-500';
      borderColor = 'border-l-4 border-yellow-500';
      break;
    default: // info
      iconSvg = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>';
      iconColor = 'text-blue-500';
      borderColor = 'border-l-4 border-blue-500';
  }
  
  toast.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="flex-shrink-0 ${iconColor}">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${iconSvg}
        </svg>
      </div>
      <div class="flex-1">
        <p class="text-sm font-medium text-slate-800">${message}</p>
      </div>
      <button onclick="this.closest('.hsm-toast').remove()" class="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    </div>
    <div class="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-brand-500 to-brand-600 rounded-b-xl toast-progress-bar"></div>
  `;
  
  // Add border color class
  toast.classList.add(borderColor);
  
  document.body.appendChild(toast);
  
  // Animate in
  setTimeout(() => {
    toast.classList.remove('translate-x-full');
  }, 100);
  
  // Auto remove toast after 4 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.style.opacity = '0';
      toast.classList.add('translate-x-full');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }
  }, 4000);
};

// Add CSS styles for toast animations
if (!document.querySelector('#hsm-toast-styles')) {
  const style = document.createElement('style');
  style.id = 'hsm-toast-styles';
  style.textContent = `
    .hsm-toast {
      backdrop-filter: blur(8px);
    }
    
    .toast-progress-bar {
      animation: toast-progress 4s linear forwards;
    }
    
    @keyframes toast-progress {
      from {
        width: 100%;
      }
      to {
        width: 0%;
      }
    }
    
    .hsm-toast:hover .toast-progress-bar {
      animation-play-state: paused;
    }
  `;
  document.head.appendChild(style);
}
