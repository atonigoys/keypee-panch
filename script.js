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
        // Sync Button Logic
        const syncBtn = document.getElementById('sync-public-btn');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                if (!confirm("This will overwrite Cloudinary tags with your local Admin list. Continue?")) return;

                syncBtn.innerText = "Syncing...";
                syncBtn.disabled = true;

                try {
                    const featuredIds = JSON.parse(localStorage.getItem('kp_featured_ids') || '[]');
                    const unfeaturedIds = JSON.parse(localStorage.getItem('kp_unfeatured_ids') || '[]');

                    const authHeader = 'Basic ' + btoa(CLOUDINARY_API_KEY + ':' + CLOUDINARY_API_SECRET);
                    const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/tags`;

                    // Helper to update tag
                    const updateTag = async (id, cmd) => {
                        await fetch(url, {
                            method: 'POST',
                            headers: { 'Authorization': authHeader, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ tag: 'featured', public_ids: [id], command: cmd })
                        });
                    };

                    // Process all featured
                    for (const id of featuredIds) {
                        await updateTag(id, 'add');
                    }

                    // Process all unfeatured
                    for (const id of unfeaturedIds) {
                        await updateTag(id, 'remove');
                    }

                    alert("Sync Complete! Public site should be updated.");
                    // Clear local list of 'unfeatured' since cloud is now consistent? 
                    // No, keep it for strict local override potential.

                } catch (e) {
                    console.error("Sync failed", e);
                    alert("Sync failed: " + e.message);
                } finally {
                    syncBtn.innerText = "🔄 Force Sync Featured to Public Site";
                    syncBtn.disabled = false;
                }
            });
        }

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

            const cloudData = await resp.json();

            alert("Upload Successful!");
            uploadForm.reset();

            // Instantly add to gallery (no 60s wait!)
            if (gallery) {
                // Remove "no images" placeholder if present
                const placeholder = gallery.querySelector('p');
                if (placeholder && placeholder.textContent.includes('No images')) {
                    gallery.innerHTML = '';
                }

                const newImg = {
                    public_id: cloudData.public_id,
                    tags: cloudData.tags || [],
                    context: { custom: { category, color, featured: String(isFeatured) } },
                    created_at: cloudData.created_at
                };
                allResources.unshift(newImg); // Add to in-memory list
                saveGalleryCache();
                addGalleryCard(newImg, true); // prepend to DOM
            }

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
let allResources = []; // Store all images for filtering
let currentFilter = 'all';
const CACHE_KEY = 'kp_gallery_cache';

// Save gallery to localStorage
function saveGalleryCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(allResources));
    } catch (e) { /* ignore quota errors */ }
}

// Load gallery from localStorage (instant!)
function loadGalleryCache() {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        return cached ? JSON.parse(cached) : null;
    } catch (e) { return null; }
}

async function renderGallery() {
    if (!gallery) return;

    // Step 1: Show cached data INSTANTLY
    const cached = loadGalleryCache();
    if (cached && cached.length > 0) {
        allResources = cached;
        applyGalleryFilter();
    } else {
        gallery.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">Loading...</p>';
    }

    // Step 2: Fetch ALL tag lists in parallel and merge by public_id
    const tagNames = [
        'all', 'featured',
        'Shirt', 'Poloshirt', 'Longsleeve', 'Sleeveless', 'Full Set Jersey', 'Logo',
        'Black', 'White', 'Blue', 'Red', 'Green', 'Yellow', 'Orange', 'Purple', 'Pink', 'Cyan', 'Beige'
    ];

    const timestamp = new Date().getTime();

    try {
        const fetches = tagNames.map(tag =>
            fetch(`${CLOUDINARY_LIST_URL}/${encodeURIComponent(tag)}.json?t=${timestamp}`)
                .then(r => r.ok ? r.json() : { resources: [] })
                .catch(() => ({ resources: [] }))
        );

        const results = await Promise.all(fetches);

        // Create a map of the local cache for quick lookup
        const localCacheMap = new Map();
        if (cached && cached.length > 0) {
            cached.forEach(item => localCacheMap.set(item.public_id, item));
        }

        // --- LOAD FEATURED/UNFEATURED IDS (Optimistic UI) ---
        let featuredIds = [];
        let unfeaturedIds = [];
        try {
            featuredIds = JSON.parse(localStorage.getItem('kp_featured_ids') || '[]');
            unfeaturedIds = JSON.parse(localStorage.getItem('kp_unfeatured_ids') || '[]');
        } catch (e) { }
        const featuredSet = new Set(featuredIds);
        const unfeaturedSet = new Set(unfeaturedIds);

        // Merge all resources by unique public_id
        const merged = new Map();
        results.forEach(data => {
            (data.resources || []).forEach(img => {
                if (!merged.has(img.public_id)) {
                    merged.set(img.public_id, img);
                } else {
                    // Merge tags from different list responses
                    const existing = merged.get(img.public_id);
                    const allTags = new Set([...(existing.tags || []), ...(img.tags || [])]);
                    existing.tags = [...allTags];
                }
            });
        });

        // Apply local overrides
        merged.forEach(img => {
            // 1. Apply cache overrides (context, etc.)
            const localItem = localCacheMap.get(img.public_id);
            if (localItem && localItem.context) {
                img.context = localItem.context;
            }

            // 2. OVERRIDE FEATURED STATUS (Optimistic)
            if (featuredSet.has(img.public_id)) {
                // FORCE ON
                if (!(img.tags || []).includes('featured')) {
                    if (!img.tags) img.tags = [];
                    img.tags.push('featured');
                }
                if (!img.context) img.context = { custom: {} };
                if (!img.context.custom) img.context.custom = {};
                img.context.custom.featured = 'true';
            } else if (unfeaturedSet.has(img.public_id)) {
                // FORCE OFF
                if ((img.tags || []).includes('featured')) {
                    img.tags = img.tags.filter(t => t !== 'featured');
                }
                if (img.context?.custom?.featured === 'true') {
                    img.context.custom.featured = 'false';
                }
            }
            // ELSE: Trust Cloudinary (Do nothing)
        });

        const cloudResources = [...merged.values()];

        // Also keep any locally-cached items not yet in any cloud list
        const cloudIds = new Set(cloudResources.map(r => r.public_id));
        const localOnly = (cached || []).filter(r => !cloudIds.has(r.public_id));

        allResources = [...localOnly, ...cloudResources];
        allResources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        saveGalleryCache(); // Save the merged correctness back to cache
        applyGalleryFilter();

    } catch (error) {
        console.error("Gallery sync error:", error);
    }
}


function applyGalleryFilter() {
    if (!gallery) return;

    let filtered = allResources;
    if (currentFilter === 'featured') {
        filtered = allResources.filter(img => (img.tags || []).includes('featured'));
    } else if (currentFilter.startsWith('cat:')) {
        const cat = currentFilter.replace('cat:', '');
        filtered = allResources.filter(img => {
            const context = img.context?.custom || {};
            return context.category === cat;
        });
    }

    // Update image count
    const countEl = document.getElementById('image-count');
    if (countEl) {
        countEl.textContent = `${filtered.length} image${filtered.length !== 1 ? 's' : ''}`;
    }

    if (filtered.length === 0) {
        let msg = 'No images uploaded yet. Upload your first design!';
        if (currentFilter === 'featured') msg = 'No featured images yet.';
        else if (currentFilter.startsWith('cat:')) msg = `No ${currentFilter.replace('cat:', '')} images yet.`;
        gallery.innerHTML = `<p style="grid-column: 1/-1; color: var(--color-text-secondary); font-style: italic;">${msg}</p>`;
        return;
    }

    gallery.innerHTML = '';
    filtered.forEach(img => addGalleryCard(img, false));
}

// Gallery filter buttons
document.querySelectorAll('.gallery-filter').forEach(btn => {
    btn.addEventListener('click', () => {
        currentFilter = btn.dataset.filter;

        // Reset all buttons
        document.querySelectorAll('.gallery-filter').forEach(b => {
            b.style.background = 'transparent';
            if (b.dataset.filter === 'featured') {
                b.style.color = 'gold';
                b.style.borderColor = 'gold';
            } else if (b.dataset.filter === 'all') {
                b.style.color = 'var(--color-text-primary)';
                b.style.borderColor = 'var(--color-text-primary)';
            } else {
                b.style.color = 'var(--color-text-secondary)';
                b.style.borderColor = 'var(--color-text-secondary)';
            }
        });

        // Highlight active button
        if (btn.dataset.filter === 'featured') {
            btn.style.background = 'gold';
            btn.style.color = 'var(--color-bg)';
        } else {
            btn.style.background = 'var(--color-text-primary)';
            btn.style.color = 'var(--color-bg)';
            btn.style.borderColor = 'var(--color-text-primary)';
        }

        applyGalleryFilter();
    });
});

// =============================================
// 3a-helper. Create a gallery card element
// =============================================
function addGalleryCard(img, prepend) {
    if (!gallery) return;

    const imageUrl = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,w_300,h_300/${img.public_id}`;
    const context = img.context?.custom || {};
    const category = context.category || 'Unknown';
    const color = context.color || '';
    const currentTags = img.tags || [];
    const isFeatured = currentTags.includes('featured');

    const el = document.createElement('div');
    el.dataset.publicId = img.public_id;
    el.style.cssText = `position: relative; border: ${isFeatured ? '2px solid gold' : '1px solid var(--color-text-secondary)'}; border-radius: 8px; overflow: hidden; ${isFeatured ? 'box-shadow: 0 0 10px rgba(255,215,0,0.35);' : ''}`;
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

    el.querySelector('.toggle-btn').addEventListener('click', () => toggleFeatured(img.public_id, currentTags));
    el.querySelector('.delete-btn').addEventListener('click', () => deleteImage(img.public_id));

    if (prepend) {
        gallery.prepend(el);
    } else {
        gallery.appendChild(el);
    }
}

// =============================================
// 3b. ADMIN: Delete Image (Instant)
// =============================================
async function deleteImage(publicId) {
    if (!confirm(`Delete this image?\nThis cannot be undone.`)) return;

    // Instantly remove from DOM + cache
    allResources = allResources.filter(r => r.public_id !== publicId);
    saveGalleryCache();
    const card = gallery?.querySelector(`[data-public-id="${publicId}"]`);
    if (card) card.remove();
    if (gallery && gallery.children.length === 0) {
        gallery.innerHTML = '<p style="color: var(--color-text-secondary); font-style: italic;">No images uploaded yet.</p>';
    }

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
        if (result.result !== "ok") {
            throw new Error(result.result || "Delete failed");
        }
    } catch (error) {
        console.error("Delete error:", error);
        alert("Delete failed: " + error.message);
        renderGallery(); // Re-render on failure to restore
    }
}

// =============================================
// 3c. ADMIN: Toggle Featured (Instant)
// =============================================
async function toggleFeatured(publicId, currentTags) {
    const isFeatured = currentTags.includes('featured');
    let newTags;
    if (isFeatured) {
        newTags = currentTags.filter(t => t !== 'featured');
    } else {
        newTags = [...currentTags, 'featured'];
    }
    const tagsString = newTags.join(',');

    // RELOAD verify state from local storage first to be safe
    // This prevents potential race conditions where allResources might be stale
    const currentCache = loadGalleryCache();
    if (currentCache && currentCache.length > 0) {
        // Merge current allResources with cache to be safe
        const cacheMap = new Map(currentCache.map(i => [i.public_id, i]));
        allResources = allResources.map(r => cacheMap.has(r.public_id) ? cacheMap.get(r.public_id) : r);
    }

    // Instantly update the card in DOM + cache
    const resIdx = allResources.findIndex(r => r.public_id === publicId);

    if (resIdx !== -1) {
        // --- NEW LOGIC: Dual List Source of Truth (Featured vs Unfeatured) ---
        let featuredIds = [];
        let unfeaturedIds = [];
        try {
            featuredIds = JSON.parse(localStorage.getItem('kp_featured_ids') || '[]');
            unfeaturedIds = JSON.parse(localStorage.getItem('kp_unfeatured_ids') || '[]');
        } catch (e) {
            console.warn('Failed to parse local lists', e);
        }

        // Determine current effective state (Local Override > Cloud)
        // Note: We need to know if cloud *thinks* it is featured
        // But for toggle, we just invert the current *known* state.
        // If we rely on `isFeatured` passed in or derived?
        // Let's derive it from effective state logic to be safe:
        const isCloudFeatured = currentTags.includes('featured');
        const isLocallyFeatured = featuredIds.includes(publicId);
        const isLocallyUnfeatured = unfeaturedIds.includes(publicId);

        // Effective state:
        // If in featured list -> TRUE
        // If in unfeatured list -> FALSE
        // Else -> Cloud state
        let effectiveState = isCloudFeatured;
        if (isLocallyFeatured) effectiveState = true;
        if (isLocallyUnfeatured) effectiveState = false;

        const isFeatured = !effectiveState; // New Desired State

        // Update Local Lists
        if (isFeatured) {
            // User wants to FEATURE it.
            // Add to featured list (to force it ON locally)
            if (!featuredIds.includes(publicId)) featuredIds.push(publicId);
            // Remove from unfeatured list (if it was forced OFF)
            unfeaturedIds = unfeaturedIds.filter(id => id !== publicId);
        } else {
            // User wants to UNFEATURE it.
            // Add to unfeatured list (to force it OFF locally)
            if (!unfeaturedIds.includes(publicId)) unfeaturedIds.push(publicId);
            // Remove from featured list (if it was forced ON)
            featuredIds = featuredIds.filter(id => id !== publicId);
        }

        localStorage.setItem('kp_featured_ids', JSON.stringify(featuredIds));
        localStorage.setItem('kp_unfeatured_ids', JSON.stringify(unfeaturedIds));

        // Update Cloudinary in background (Eventual Consistency)
        let newTags = [...currentTags];
        if (isFeatured) {
            if (!newTags.includes('featured')) newTags.push('featured');
        } else {
            newTags = newTags.filter(t => t !== 'featured');
        }

        // Optimistically update UI
        const card = gallery?.querySelector(`[data-public-id="${publicId}"]`);
        if (card) {
            // Update styling
            card.style.border = isFeatured ? '2px solid gold' : '1px solid var(--color-text-secondary)';
            card.style.boxShadow = isFeatured ? '0 0 10px rgba(255,215,0,0.35)' : 'none';

            // Update label
            const statusSpan = card.querySelector('div span');
            if (statusSpan) {
                statusSpan.innerHTML = isFeatured
                    ? '<span style="color: gold;">⭐ Featured</span>'
                    : '<span style="color: var(--color-text-secondary);">Not Featured</span>';
            }

            // Update button
            const toggleBtn = card.querySelector('.toggle-btn');
            if (toggleBtn) {
                toggleBtn.innerHTML = isFeatured ? '★ Unfeature' : '☆ Feature';
                toggleBtn.style.borderColor = isFeatured ? '#ff4444' : 'gold';
                toggleBtn.style.color = isFeatured ? '#ff4444' : 'gold';
                toggleBtn.style.background = isFeatured ? 'rgba(255,68,68,0.2)' : 'rgba(255,215,0,0.2)';
                // Update onclick to reflect new state
                toggleBtn.onclick = () => toggleFeatured(publicId, newTags);
            }
        }

        // Call Cloudinary Admin API (Reliable Sync)
        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/image/tags`;

        try {
            // Use Basic Auth since we have the secret (matches user's simple-setup preference)
            const authHeader = 'Basic ' + btoa(CLOUDINARY_API_KEY + ':' + CLOUDINARY_API_SECRET);

            const resp = await fetch(url, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    tag: 'featured',
                    public_ids: [publicId],
                    command: isFeatured ? 'add' : 'remove'
                })
            });

            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error?.message || 'Failed to update');
            }

            console.log(isFeatured ? 'Removed from Featured (Cloud)!' : 'Added to Featured (Cloud)!');
        } catch (error) {
            console.error('Toggle error:', error);
            alert('Toggle failed: ' + error.message);
            // Re-render only on failure to restore correct state
            renderGallery();
        }
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

        // Use the unified fetchAllImages function which respects local overrides
        const allImages = await fetchAllImages();

        // Filter for featured items
        // fetchAllImages already ensures the 'featured' tag is accurate based on local list
        let resources = allImages.filter(img => (img.tags || []).includes('featured'));

        // Sort by creation date (newest first)
        resources.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Limit to 8 items
        resources = resources.slice(0, 8);

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
    // Fetch from multiple tags to ensure we get everything (in case 'all' tag is lagging)
    const tags = ['all', 'Shirt', 'Poloshirt', 'Longsleeve', 'Sleeveless', 'Full Set Jersey', 'Logo'];

    try {
        const fetches = tags.map(tag =>
            fetch(`${CLOUDINARY_LIST_URL}/${encodeURIComponent(tag)}.json`)
                .then(r => r.ok ? r.json() : { resources: [] })
                .catch(() => ({ resources: [] }))
        );

        const results = await Promise.all(fetches);

        // Merge by public_id to remove duplicates
        const merged = new Map();
        results.forEach(data => {
            (data.resources || []).forEach(img => {
                // Determine context if missing (some list endpoints might not return context full details)
                if (!merged.has(img.public_id)) {
                    merged.set(img.public_id, img);
                } else {
                    // Merge tags
                    const existing = merged.get(img.public_id);
                    const allTags = new Set([...(existing.tags || []), ...(img.tags || [])]);
                    existing.tags = [...allTags];
                    // Merge context if newer has it
                    if (img.context) {
                        existing.context = { ...(existing.context || {}), ...(img.context || {}) };
                    }
                }
            });
        });

        // 2. Overlay Local Cache (for instant updates for Admin)
        try {
            const cached = JSON.parse(localStorage.getItem('kp_gallery_cache') || '[]');
            cached.forEach(img => {
                // If it exists in cache, it's the latest version (tags, context, etc.)
                // so we overwrite or add it.
                if (img.public_id) {
                    merged.set(img.public_id, img);
                }
            });
        } catch (e) {
            console.warn("Failed to read local cache");
        }

        // 3. OVERRIDE FEATURED STATUS (Optimistic UI) - Dual List
        let featuredIds = [];
        let unfeaturedIds = [];
        try {
            featuredIds = JSON.parse(localStorage.getItem('kp_featured_ids') || '[]');
            unfeaturedIds = JSON.parse(localStorage.getItem('kp_unfeatured_ids') || '[]');
        } catch (e) { }
        const featuredSet = new Set(featuredIds);
        const unfeaturedSet = new Set(unfeaturedIds);

        merged.forEach(img => {
            if (featuredSet.has(img.public_id)) {
                // FORCE ON
                if (!(img.tags || []).includes('featured')) {
                    if (!img.tags) img.tags = [];
                    img.tags.push('featured');
                }
                if (!img.context) img.context = { custom: {} };
                if (!img.context.custom) img.context.custom = {};
                img.context.custom.featured = 'true';
            } else if (unfeaturedSet.has(img.public_id)) {
                // FORCE OFF
                if ((img.tags || []).includes('featured')) {
                    img.tags = img.tags.filter(t => t !== 'featured');
                }
                if (img.context?.custom?.featured === 'true') {
                    img.context.custom.featured = 'false';
                }
            }
            // ELSE: Trust Cloudinary (Do nothing)
        });

        return [...merged.values()];
    } catch (error) {
        console.error("Failed to fetch all images:", error);
        return [];
    }
}
