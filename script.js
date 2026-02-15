// =============================================
// KEYPEE PANCH — Cloudinary-Only Script
// No Firestore. No Firebase. Just Cloudinary.
// =============================================

const CLOUD_NAME = "dabwa174p";
const UPLOAD_PRESET = "Keypeepanch"; // Unsigned preset
const CLOUDINARY_LIST_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/list`;
const CLOUDINARY_API_KEY = "791274659166275";
const CLOUDINARY_API_SECRET = "KqoMlHuFEr0dYTVEaw92ccY4mVM";
const ADMIN_PASSWORD = "admin123"; // Change this to your preferred password

// --- SHA-1 Helper for Cloudinary Signatures ---
async function sha1(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-1', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateSignature(params) {
    const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
    return await sha1(sorted + CLOUDINARY_API_SECRET);
}

// --- DOM Elements ---
const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const gallery = document.getElementById('upload-gallery');
const applyFiltersBtn = document.getElementById('apply-filters');

// =============================================
// 1. SIMPLE AUTH (No Firebase)
// =============================================
const isAdminPage = window.location.pathname.includes('/admin');

// Check if logged in
function isLoggedIn() {
    return sessionStorage.getItem('kp_admin') === 'true';
}

// Protect admin page
if (isAdminPage && !isLoggedIn()) {
    window.location.href = '../login.html';
}

// Show admin content if logged in
if (isAdminPage && isLoggedIn()) {
    const wrapper = document.getElementById('admin-page-wrapper');
    if (wrapper) wrapper.style.display = 'block';
    renderGallery();
}

// Update navigation
updateNavigation();

function updateNavigation() {
    const navList = document.querySelector('nav ul');
    if (!navList) return;

    if (isLoggedIn()) {
        // Dashboard Link
        const dashboardLi = document.createElement('li');
        dashboardLi.id = 'dashboard-link';
        const dashPath = isAdminPage ? '#' : 'admin/';
        dashboardLi.innerHTML = `<a href="${dashPath}" class="${isAdminPage ? 'active' : ''}">Dashboard</a>`;
        navList.appendChild(dashboardLi);

        // Logout Link
        const logoutLi = document.createElement('li');
        logoutLi.id = 'auth-link';
        const logoutBtn = document.createElement('a');
        logoutBtn.href = "#";
        logoutBtn.innerText = "Logout";
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (!confirm("Are you sure you want to log out?")) return;
            sessionStorage.removeItem('kp_admin');
            window.location.href = isAdminPage ? '../index.html' : 'index.html';
        });
        logoutLi.appendChild(logoutBtn);
        navList.appendChild(logoutLi);
    }
}

// Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const password = loginForm.password.value;
        const errorMsg = document.getElementById('error-msg');

        if (password === ADMIN_PASSWORD) {
            sessionStorage.setItem('kp_admin', 'true');
            window.location.href = 'admin/';
        } else {
            errorMsg.innerText = "Invalid password";
            errorMsg.style.display = 'block';
        }
    });
}

// =============================================
// 2. ADMIN: Upload to Cloudinary
// =============================================
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const category = document.getElementById('upload-category').value;
        const color = document.getElementById('upload-color').value;
        const file = document.getElementById('upload-file').files[0];
        const isFeatured = document.getElementById('upload-featured')?.checked || false;
        const submitBtn = uploadForm.querySelector('button[type="submit"]');

        if (!file) {
            alert("Please select an image file.");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.innerText = "Uploading...";

        try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("upload_preset", UPLOAD_PRESET);

            // Tags for filtering: "all" (everything), category, color, optionally "featured"
            const tags = ["all", category, color];
            if (isFeatured) tags.push("featured");
            formData.append("tags", tags.join(","));

            // Context metadata for display
            formData.append("context", `category=${category}|color=${color}|featured=${isFeatured}`);

            const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
                method: "POST",
                body: formData
            });

            if (!resp.ok) {
                const errData = await resp.json();
                throw new Error(errData.error?.message || "Upload failed");
            }

            alert("Upload Successful!");
            uploadForm.reset();
            renderGallery();

        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed: " + error.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerText = "Upload Design";
        }
    });
}

// =============================================
// 3. ADMIN: Render Gallery from Cloudinary
// =============================================
async function renderGallery() {
    if (!gallery) return;
    gallery.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">Loading...</p>';

    try {
        const resp = await fetch(`${CLOUDINARY_LIST_URL}/all.json`);
        if (!resp.ok) {
            if (resp.status === 404) {
                gallery.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">No images uploaded yet. Upload your first design!</p>';
                return;
            }
            throw new Error("Failed to load gallery: " + resp.status);
        }

        const data = await resp.json();
        const resources = data.resources || [];

        if (resources.length === 0) {
            gallery.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">No images uploaded yet.</p>';
            return;
        }

        // Sort by created_at descending (newest first)
        resources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        gallery.innerHTML = '';
        resources.forEach(img => {
            const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_300,h_300/${img.public_id}`;
            const context = img.context?.custom || {};
            const category = context.category || 'Unknown';
            const color = context.color || '';
            const currentTags = img.tags || [];
            const isFeatured = currentTags.includes('featured');
            const tagsJson = JSON.stringify(currentTags).replace(/'/g, "\\'");

            const el = document.createElement('div');
            el.style.cssText = 'position: relative; border: 1px solid var(--color-text-secondary); border-radius: 8px; overflow: hidden;';
            el.innerHTML = `
                <img src="${imageUrl}" alt="${category}" style="width: 100%; height: 150px; object-fit: cover; display: block;">
                <div style="padding: 0.5rem;">
                    <p style="margin: 0; font-weight: bold; font-size: 0.85rem;">${category}</p>
                    <p style="margin: 0; font-size: 0.75rem; color: var(--color-text-secondary);">${color}</p>
                    ${isFeatured ? '<span style="font-size: 0.7rem; color: gold;">⭐ Featured</span>' : '<span style="font-size: 0.7rem; color: var(--color-text-secondary);">Not Featured</span>'}
                </div>
                <div style="display: flex; gap: 0.25rem; padding: 0 0.5rem 0.5rem;">
                    <button class="toggle-btn"
                        style="flex: 1; padding: 0.3rem; font-size: 0.7rem; cursor: pointer; border: 1px solid ${isFeatured ? '#ff4444' : 'gold'}; background: ${isFeatured ? 'rgba(255,68,68,0.2)' : 'rgba(255,215,0,0.2)'}; color: ${isFeatured ? '#ff4444' : 'gold'}; border-radius: 4px;">
                        ${isFeatured ? '★ Unfeature' : '☆ Feature'}
                    </button>
                    <button class="delete-btn"
                        style="flex: 1; padding: 0.3rem; font-size: 0.7rem; cursor: pointer; border: 1px solid #ff4444; background: rgba(255,68,68,0.2); color: #ff4444; border-radius: 4px;">
                        🗑 Delete
                    </button>
                </div>
            `;

            // Attach event listeners (avoids inline onclick issues with special chars)
            el.querySelector('.toggle-btn').addEventListener('click', () => toggleFeatured(img.public_id, currentTags));
            el.querySelector('.delete-btn').addEventListener('click', () => deleteImage(img.public_id));

            gallery.appendChild(el);
        });

    } catch (error) {
        console.error("Gallery error:", error);
        gallery.innerHTML = `<p style="color: red; font-weight: bold;">${error.message}</p>`;
    }
}

// =============================================
// 3b. ADMIN: Delete Image
// =============================================
async function deleteImage(publicId) {
    if (!confirm(`Delete this image?\nThis cannot be undone.`)) return;

    try {
        const timestamp = Math.round(Date.now() / 1000);
        const signature = await generateSignature({ public_id: publicId, timestamp });

        const formData = new FormData();
        formData.append("public_id", publicId);
        formData.append("api_key", CLOUDINARY_API_KEY);
        formData.append("timestamp", timestamp);
        formData.append("signature", signature);

        const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/destroy`, {
            method: "POST",
            body: formData
        });

        const result = await resp.json();
        if (result.result === "ok") {
            alert("Image deleted!");
            renderGallery();
        } else {
            throw new Error(result.result || "Delete failed");
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Delete failed: " + error.message);
    }
}

// =============================================
// 3c. ADMIN: Toggle Featured (via /image/explicit)
// =============================================
async function toggleFeatured(publicId, currentTags) {
    const isFeatured = currentTags.includes('featured');

    // Build new tags list
    let newTags;
    if (isFeatured) {
        newTags = currentTags.filter(t => t !== 'featured');
    } else {
        newTags = [...currentTags, 'featured'];
    }
    const tagsString = newTags.join(',');

    try {
        const timestamp = Math.round(Date.now() / 1000);
        const params = {
            public_id: publicId,
            tags: tagsString,
            timestamp: timestamp,
            type: 'upload'
        };
        const signature = await generateSignature(params);

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('tags', tagsString);
        formData.append('type', 'upload');
        formData.append('api_key', CLOUDINARY_API_KEY);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        const resp = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/explicit`, {
            method: 'POST',
            body: formData
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.error?.message || 'Failed to update');
        }

        alert(isFeatured ? 'Removed from Featured!' : 'Added to Featured!');
        renderGallery();
    } catch (error) {
        console.error('Toggle error:', error);
        alert('Toggle failed: ' + error.message);
    }
}

// =============================================
// 4. PUBLIC: Filter Logic (Home Page)
// =============================================
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

const allProductsBtn = document.getElementById('all-products-btn');
if (allProductsBtn) {
    allProductsBtn.addEventListener('click', () => {
        window.location.href = 'products.html';
    });
}

// =============================================
// 5. PUBLIC: Products Page
// =============================================
if (window.location.pathname.includes('products.html')) {
    initProductsPage();
}

async function initProductsPage() {
    const params = new URLSearchParams(window.location.search);
    const colors = params.get('colors') ? params.get('colors').split(',') : [];
    const categories = params.get('categories') ? params.get('categories').split(',') : [];
    const productGrid = document.querySelector('.product-grid');
    const title = document.getElementById('page-title');

    // Update Title
    const criteria = [];
    if (colors.length) criteria.push(colors.join(', '));
    if (categories.length) criteria.push(categories.join(', '));
    if (title) title.innerText = criteria.length ? `Results for: ${criteria.join(' + ')}` : 'All Products';

    // Pre-check checkboxes
    colors.forEach(c => {
        const cb = document.querySelector(`input[value="${c}"][data-filter-type="color"]`);
        if (cb) cb.checked = true;
    });
    categories.forEach(c => {
        const cb = document.querySelector(`input[value="${c}"][data-filter-type="category"]`);
        if (cb) cb.checked = true;
    });

    if (!productGrid) return;
    productGrid.innerHTML = '<p>Loading products...</p>';

    try {
        const allImages = await fetchAllImages();

        const filtered = allImages.filter(img => {
            const context = img.context?.custom || {};
            const colorMatch = colors.length === 0 || colors.includes(context.color);
            const categoryMatch = categories.length === 0 || categories.includes(context.category);
            return colorMatch && categoryMatch;
        });

        if (filtered.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--color-text-secondary);">No products found matching these filters.</p>';
        } else {
            productGrid.innerHTML = filtered.map(img => {
                const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_400,h_400/${img.public_id}`;
                const context = img.context?.custom || {};
                return `
                    <div class="product-card">
                        <div class="product-image" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
                        <h3>${context.category || 'Design'}</h3>
                        <p style="color: var(--color-text-secondary)">${context.color || ''}</p>
                    </div>
                `;
            }).join('');
        }

    } catch (error) {
        console.error("Error loading products:", error);
        productGrid.innerHTML = `<p style="color: red;">Error loading products: ${error.message}</p>`;
    }
}

// =============================================
// 6. PUBLIC: New Arrivals (Home Page — Featured)
// =============================================
if (document.getElementById('new-arrivals-container')) {
    loadNewArrivals();
}

async function loadNewArrivals() {
    const container = document.getElementById('new-arrivals-container');
    if (!container) return;

    try {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">Loading...</p>';

        // Fetch only "featured" tagged images
        const resp = await fetch(`${CLOUDINARY_LIST_URL}/featured.json`);

        if (!resp.ok) {
            if (resp.status === 404) {
                container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">No featured items yet.</p>';
                return;
            }
            throw new Error("Failed to load featured items");
        }

        const data = await resp.json();
        const resources = (data.resources || []).slice(0, 8);

        if (resources.length === 0) {
            container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--color-text-secondary);">No featured items yet.</p>';
            return;
        }

        container.innerHTML = resources.map(img => {
            const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_400,h_400/${img.public_id}`;
            const context = img.context?.custom || {};
            return `
                <div class="product-card">
                    <div class="product-image" style="background-image: url('${imageUrl}'); background-size: cover; background-position: center;"></div>
                    <h3>${context.category || 'Design'}</h3>
                    <p style="color: var(--color-text-secondary)">${context.color || ''}</p>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading new arrivals:", error);
        container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: red;">Failed to load items.</p>`;
    }
}

// =============================================
// HELPER: Fetch all images from Cloudinary
// =============================================
async function fetchAllImages() {
    const resp = await fetch(`${CLOUDINARY_LIST_URL}/all.json`);
    if (!resp.ok) {
        if (resp.status === 404) return [];
        throw new Error("Failed to fetch images");
    }
    const data = await resp.json();
    return data.resources || [];
}
