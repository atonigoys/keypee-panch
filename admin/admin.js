
// =============================================
// KEYPEE PANCH — Admin Dashboard Logic
// =============================================

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth (Redundant but safe)
    if (typeof isLoggedIn === 'function' && !isLoggedIn()) {
        window.location.href = '../login.html';
    } else if (!sessionStorage.getItem('kp_admin')) {
        window.location.href = '../login.html';
    }

    initDashboard();
});

function initDashboard() {
    setupNavigation();
    setupMobileMenu();
    updateDashboardStats(); // Initial load

    // Refresh stats whenever gallery changes (using a simple observer or interval if needed, 
    // but for now we'll trigger it on tab switch or manual actions)

    // Listen for global custom events if we add them, 
    // or just poll/update when tab is clicked.
}

// ---------------------------------------------
// 1. Navigation & Tab Switching
// ---------------------------------------------
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item[data-tab]');
    const sections = document.querySelectorAll('.tab-section');

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();

            // Handle Logout specifically
            if (item.id === 'nav-logout') {
                if (confirm("Are you sure you want to log out?")) {
                    sessionStorage.removeItem('kp_admin');
                    window.location.href = '../index.html';
                }
                return;
            }

            const targetId = item.dataset.tab;
            if (!targetId) return; // External links like "Back to Website"

            // Update UI
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            sections.forEach(sec => {
                sec.classList.remove('active'); // Hide all first
                if (sec.id === targetId) {
                    sec.style.display = 'block'; // Ensure block display
                    setTimeout(() => sec.classList.add('active'), 10); // Add class for opacity transition
                } else {
                    sec.style.display = 'none';
                }
            });

            // Specific refresh actions
            if (targetId === 'dashboard-section') {
                updateDashboardStats();
            } else if (targetId === 'gallery-section') {
                if (typeof renderGallery === 'function') renderGallery();
            } else if (targetId === 'background-section') {
                if (typeof renderBackgroundGallery === 'function') renderBackgroundGallery();
            }
        });
    });
}

function setupMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggle && sidebar) {
        toggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            if (overlay) overlay.classList.toggle('active');
        });
    }

    // Close sidebar when clicking a link on mobile
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('open');
                if (overlay) overlay.classList.remove('active');
            }
        });
    });
}


// ---------------------------------------------
// 2. Stats Calculation
// ---------------------------------------------
function updateDashboardStats() {
    // Ensure we have data
    // 'allResources' is a global from script.js
    if (typeof allResources === 'undefined') {
        // Retry shortly if script.js hasn't loaded data yet
        setTimeout(updateDashboardStats, 500);
        return;
    }

    const totalCount = allResources.length;
    let featuredCount = 0;

    // Category Breakdown
    const categories = {};

    allResources.forEach(img => {
        // Count Featured
        if ((img.tags && img.tags.includes('featured')) || (img.context?.custom?.featured === 'true')) {
            featuredCount++;
        }

        // Count Categories
        let cat = img.context?.custom?.category || 'Uncategorized';
        categories[cat] = (categories[cat] || 0) + 1;
    });

    // Update DOM
    safeSetText('stat-total-designs', totalCount);
    safeSetText('stat-total-featured', featuredCount);

    // Find top category
    let topCat = '-';
    let max = 0;
    for (const [cat, count] of Object.entries(categories)) {
        if (count > max) {
            max = count;
            topCat = cat;
        }
    }
    safeSetText('stat-top-category', topCat);
}

function safeSetText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}
