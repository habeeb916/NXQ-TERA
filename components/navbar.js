// Dynamic Navbar Component for HSM-Tera Management System
function loadNavbar(currentPage = '') {
    const navbarContainer = document.getElementById('navbar-container');
    if (!navbarContainer) return;

    // Define navigation items
    const navItems = [
        {
            href: 'dashboard.html',
            label: 'Dashboard',
            icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"></path>
            </svg>`
        },
        {
            href: 'customers.html',
            label: 'Customers',
            icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>`
        },
        {
            href: 'add-customer.html',
            label: 'Add Customer',
            icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
            </svg>`
        },
        {
            href: 'unpaid.html',
            label: 'Unpaid',
            icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"></path>
            </svg>`
        },
        {
            href: 'settings.html',
            label: 'Settings',
            icon: `<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
            </svg>`
        }
    ];

    // Generate navigation links
    const navLinks = navItems.map(item => {
        // Simple and clean active state logic
        const isActive = currentPage === item.href;
        
        const activeClass = isActive 
            ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/25' 
            : 'text-slate-600 hover:text-brand-600 hover:bg-brand-100/50';
        
        return `
            <a href="${item.href}" class="px-4 py-2.5 rounded-xl text-sm font-semibold ${activeClass} transition-all duration-300 flex items-center gap-2">
                ${item.icon}
                ${item.label}
            </a>
        `;
    }).join('');

    navbarContainer.innerHTML = `
        <header class="bg-white shadow-2xl border-b border-brand-200">
            <div class="max-w-7xl mx-auto px-6 py-4">
                <div class="flex items-center justify-between">
                    <!-- Logo Section -->
                    <a href="dashboard.html" class="group flex items-center gap-3 text-slate-800 hover:text-brand-600 transition-all duration-300">
                        <div class="relative">
                            <div class="h-12 w-12 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shadow-lg group-hover:shadow-brand-500/25 transition-all duration-300 group-hover:scale-105">
                                <span class="text-white font-bold text-lg">HSM</span>
                            </div>
                            <div class="absolute -inset-1 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity duration-300"></div>
                        </div>
                        <div class="flex flex-col">
                            <span class="text-xl font-bold tracking-tight">HSM-Tera</span>
                            <span class="text-xs text-slate-500 font-medium">Management System</span>
                        </div>
                    </a>

                    <!-- Navigation Links -->
                    <nav class="hidden md:flex items-center gap-1 bg-brand-100/50 rounded-2xl p-1.5 backdrop-blur-sm">
                        ${navLinks}
                    </nav>

                    <!-- User Actions -->
                    <div class="flex items-center gap-3">
                        <!-- User Profile -->
                        <div class="flex items-center gap-3 bg-brand-100/50 rounded-xl px-3 py-2 backdrop-blur-sm">
                            <div class="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-400 to-brand-500 flex items-center justify-center">
                                <span class="text-white text-sm font-semibold">A</span>
                            </div>
                            <div class="hidden sm:block">
                                <div class="text-sm font-semibold text-slate-800">Admin</div>
                                <div class="text-xs text-slate-500">Administrator</div>
                            </div>
                        </div>

                        <!-- Logout Button -->
                        <button id="logout-btn" class="group px-4 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-white hover:bg-red-600/20 hover:border-red-500/30 border border-transparent transition-all duration-300 flex items-center gap-2">
                            <svg class="w-4 h-4 group-hover:rotate-12 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                            </svg>
                            <span class="hidden sm:inline">Logout</span>
                        </button>
                    </div>
                </div>
            </div>
        </header>
    `;

    // Add logout functionality
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function() {
            if (confirm('Are you sure you want to logout?')) {
                localStorage.removeItem('authToken');
                localStorage.removeItem('user');
                window.location.href = 'login.html';
            }
        });
    }
}

// Auto-detect current page and load navbar
document.addEventListener('DOMContentLoaded', function() {
    const currentPage = window.location.pathname.split('/').pop() || 'dashboard.html';
    loadNavbar(currentPage);
});