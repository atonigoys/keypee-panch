document.addEventListener('DOMContentLoaded', () => {
    // 1. Check Auth State on Load
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const path = window.location.pathname;
    const isLoginPage = path.includes('login.html');
    const isAdminPage = path.includes('admin.html');

    // Protect Admin Routes
    if (isAdminPage && (!currentUser || currentUser.role !== 'admin')) {
        window.location.href = 'login.html';
        return;
    }

    // Redirect logged-in users away from login page
    if (isLoginPage && currentUser) {
        window.location.href = currentUser.role === 'admin' ? 'admin.html' : 'index.html';
        return;
    }

    // 2. Update Navigation
    updateNavigation(currentUser);

    // 3. Highlight Active Link
    const navLinks = document.querySelectorAll('nav a');
    navLinks.forEach(link => {
        if (link.href.includes(path.split('/').pop())) { // Compare filename
            link.classList.add('active');
        }
    });

    // 4. Handle Login Form
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const username = loginForm.username.value;
            const password = loginForm.password.value;

            if (username === 'admin' && password === 'admin123') {
                login({ username: 'Admin User', role: 'admin' });
            } else if (username === 'user' && password === 'user123') {
                login({ username: 'Standard User', role: 'user' });
            } else {
                document.getElementById('error-msg').style.display = 'block';
            }
        });
    }

    // 6. Handle Public Filtering

    // A. Apply Button Logic (Redirects to products.html with params)
    const applyFiltersBtn = document.getElementById('apply-filters');
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            const selectedColors = Array.from(document.querySelectorAll('input[data-filter-type="color"]:checked')).map(cb => cb.value);
            const selectedCategories = Array.from(document.querySelectorAll('input[data-filter-type="category"]:checked')).map(cb => cb.value);

            const params = new URLSearchParams();
            if (selectedColors.length) params.set('colors', selectedColors.join(','));
            if (selectedCategories.length) params.set('categories', selectedCategories.join(','));

            window.location.href = `products.html?${params.toString()}`;
        });
    }

    // B. Results Page Logic (Reads params and renders)
    if (window.location.pathname.includes('products.html')) {
        const params = new URLSearchParams(window.location.search);
        const colorParam = params.get('colors');
        const categoryParam = params.get('categories');

        const colors = colorParam ? colorParam.split(',') : [];
        const categories = categoryParam ? categoryParam.split(',') : [];

        // Pre-check checkboxes based on URL
        colors.forEach(c => {
            const cb = document.querySelector(`input[value="${c}"][data-filter-type="color"]`);
            if (cb) cb.checked = true;
        });
        categories.forEach(c => {
            const cb = document.querySelector(`input[value="${c}"][data-filter-type="category"]`);
            if (cb) cb.checked = true;
        });

        // Filter and Render
        const uploadedImages = JSON.parse(localStorage.getItem('uploadedImages')) || [];
        const filteredImages = uploadedImages.filter(img => {
            const colorMatch = colors.length === 0 || colors.includes(img.color);
            const categoryMatch = categories.length === 0 || categories.includes(img.category);
            return colorMatch && categoryMatch;
        });

        const productGrid = document.querySelector('.product-grid');
        if (productGrid) {
            if (filteredImages.length === 0) {
                productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--color-text-secondary);">No products found matching these filters.</p>';
            } else {
                productGrid.innerHTML = filteredImages.map(img => `
                    <div class="product-card">
                        <div class="product-image" style="background-image: url('${img.image}'); background-size: cover; background-position: center;"></div>
                        <h3>${img.category}</h3>
                        <p style="color: var(--color-text-secondary)">${img.color}</p>
                    </div>
                `).join('');
            }
        }

        // Update Title
        const title = document.getElementById('page-title');
        if (title) {
            const criteria = [];
            if (colors.length) criteria.push(colors.join(', '));
            if (categories.length) criteria.push(categories.join(', '));
            title.innerText = criteria.length ? `Results for: ${criteria.join(' + ')}` : 'All Products';
        }
    }

    // 5. Handle Admin Uploads
    if (isAdminPage) {
        renderGallery();

        const uploadForm = document.getElementById('upload-form');
        if (uploadForm) {
            uploadForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const category = document.getElementById('upload-category').value;
                const color = document.getElementById('upload-color').value;
                const fileInput = document.getElementById('upload-file');
                const file = fileInput.files[0];

                if (file) {
                    const reader = new FileReader();
                    reader.onload = function (event) {
                        const imageBase64 = event.target.result;
                        saveImage(category, color, imageBase64);
                        uploadForm.reset();
                        renderGallery();
                        alert('Image uploaded successfully!');
                    };
                    reader.readAsDataURL(file);
                }
            });
        }
    }

    console.log('KEYPEE PANCH loaded');
});

function saveImage(category, color, imageBase64) {
    const images = JSON.parse(localStorage.getItem('uploadedImages')) || [];
    images.unshift({
        id: Date.now(),
        category,
        color,
        image: imageBase64,
        date: new Date().toLocaleString()
    });
    localStorage.setItem('uploadedImages', JSON.stringify(images));
}

function renderGallery() {
    const gallery = document.getElementById('upload-gallery');
    if (!gallery) return;

    const images = JSON.parse(localStorage.getItem('uploadedImages')) || [];

    if (images.length === 0) {
        gallery.innerHTML = '<p style="grid-column: 1/-1; color: var(--color-text-secondary); font-style: italic;">No images uploaded yet.</p>';
        return;
    }

    gallery.innerHTML = images.map(img => `
        <div style="background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; position: relative;">
            <div style="height: 150px; background-image: url('${img.image}'); background-size: cover; background-position: center;"></div>
            <div style="padding: 0.5rem;">
                <p style="font-weight: bold; font-size: 0.9rem;">${img.category}</p>
                <p style="color: var(--color-text-secondary); font-size: 0.8rem;">${img.color}</p>
            </div>
            <button onclick="deleteImage(${img.id})" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1;">&times;</button>
        </div>
    `).join('');
}

// Global function for onclick access
window.deleteImage = function (id) {
    if (!confirm('Are you sure you want to remove this image?')) return;

    let images = JSON.parse(localStorage.getItem('uploadedImages')) || [];
    images = images.filter(img => img.id !== id);
    localStorage.setItem('uploadedImages', JSON.stringify(images));
    renderGallery();
};

function login(user) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    window.location.href = user.role === 'admin' ? 'admin.html' : 'index.html';
}

function logout() {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}

function updateNavigation(user) {
    const navList = document.querySelector('nav ul');
    if (!navList) return;

    if (user) {
        // Add Dashboard link if admin
        if (user.role === 'admin' && !document.querySelector('a[href="admin.html"]')) {
            const adminLi = document.createElement('li');
            adminLi.innerHTML = '<a href="admin.html">Dashboard</a>';
            navList.insertBefore(adminLi, navList.children[0]); // Add to start
        }

        // Add Logout button
        const logoutLi = document.createElement('li');
        logoutLi.innerHTML = `<a href="#" onclick="logout(); return false;">Logout (${user.username})</a>`;
        navList.appendChild(logoutLi);
    } else {
        // Add Login button
        const loginLi = document.createElement('li');
        loginLi.innerHTML = '<a href="login.html">Login</a>';
        navList.appendChild(loginLi);
    }
}
