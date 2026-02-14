import { auth, db } from "./firebase-config.js";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Elements
const navList = document.querySelector('nav ul');
const loginForm = document.getElementById('login-form');
const uploadForm = document.getElementById('upload-form');
const applyFiltersBtn = document.getElementById('apply-filters');
const recentOrdersTable = document.querySelector('table tbody');
const gallery = document.getElementById('upload-gallery');

// 1. Authentication State Observer
onAuthStateChanged(auth, (user) => {
    updateNavigation(user);

    // Protect Admin Page
    if (window.location.pathname.includes('admin.html') && !user) {
        window.location.href = 'login.html';
    }

    // Admin Page Logic on Load
    if (window.location.pathname.includes('admin.html') && user) {
        renderGallery();
        renderStats(); // Simulated for now
    }
});

function updateNavigation(user) {
    if (!navList) return;

    // Remove existing auth links
    const existingAuthLink = document.getElementById('auth-link');
    if (existingAuthLink) existingAuthLink.remove();
    const existingDashboardLink = document.getElementById('dashboard-link');
    if (existingDashboardLink) existingDashboardLink.remove();

    if (user) {
        // Dashboard Link
        const dashboardLi = document.createElement('li');
        dashboardLi.id = 'dashboard-link';
        dashboardLi.innerHTML = `<a href="admin.html" class="${window.location.pathname.includes('admin.html') ? 'active' : ''}">Dashboard</a>`;
        navList.appendChild(dashboardLi);

        // Logout Link
        const logoutLi = document.createElement('li');
        logoutLi.id = 'auth-link';
        const logoutBtn = document.createElement('a');
        logoutBtn.href = "#";
        logoutBtn.innerText = "Logout";
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            signOut(auth).then(() => {
                window.location.href = 'index.html';
            }).catch((error) => {
                console.error("Logout error", error);
            });
        });
        logoutLi.appendChild(logoutBtn);
        navList.appendChild(logoutLi);
    } else {
        // Login Link
        const loginLi = document.createElement('li');
        loginLi.id = 'auth-link';
        loginLi.innerHTML = `<a href="login.html" class="${window.location.pathname.includes('login.html') ? 'active' : ''}">Login</a>`;
        navList.appendChild(loginLi);
    }
}

// 2. Handle Login
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = loginForm.username.value; // Using username input as email for simplicity
        const password = loginForm.password.value;
        const errorMsg = document.getElementById('error-msg');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            window.location.href = 'admin.html';
        } catch (error) {
            console.error(error);
            errorMsg.innerText = "Invalid credentials: " + error.message;
            errorMsg.style.display = 'block';
        }
    });
}

// 3. Admin: Upload Image (Base64 to Firestore)
// Helper: Compress Image
function compressImage(file, maxWidth, quality, statusCallback) {
    return new Promise((resolve, reject) => {
        if (statusCallback) statusCallback("Reading File...");
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            if (statusCallback) statusCallback("Loading Image...");
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                if (statusCallback) statusCallback("Compressing...");
                try {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;

                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality));
                } catch (e) {
                    reject(e);
                }
            };
            img.onerror = error => reject(new Error("Failed to load image"));
        };
        reader.onerror = error => reject(new Error("Failed to read file"));
    });
}

// 3. Admin: Upload Image (Compressed Base64 to Firestore)
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const category = document.getElementById('upload-category').value;
        const color = document.getElementById('upload-color').value;
        const file = document.getElementById('upload-file').files[0];
        const submitBtn = uploadForm.querySelector('button');

        if (!file) return;

        submitBtn.disabled = true;

        try {
            // Updated to provide feedback
            const base64String = await compressImage(file, 600, 0.6, (status) => {
                submitBtn.innerText = status;
            });

            submitBtn.innerText = "Uploading to Cloud...";

            // Debug: Check size
            const sizeInBytes = new Blob([base64String]).size;
            const sizeInKB = (sizeInBytes / 1024).toFixed(2);
            console.log(`Payload size: ${sizeInKB} KB`);

            if (sizeInBytes > 1000000) { // 1MB limit check
                throw new Error(`Image is too large (${sizeInKB} KB). Max is 1MB.`);
            }

            // Timeout Helper
            const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), ms));

            // REST API Fallback (Bypasses Firewall/SDK issues)
            const uploadToFirestoreRest = async () => {
                const user = auth.currentUser;
                if (!user) throw new Error("User not authenticated");

                const token = await user.getIdToken();
                const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents/products?key=${API_KEY}`;

                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fields: {
                            category: { stringValue: category },
                            color: { stringValue: color },
                            image: { stringValue: base64String },
                            createdAt: { stringValue: new Date().toISOString() }
                        }
                    })
                });

                if (!response.ok) {
                    const err = await response.text();
                    throw new Error(`REST API Error: ${response.status} ${err}`);
                }

                return await response.json();
            };

            // Race REST API against 15s timeout
            await Promise.race([
                uploadToFirestoreRest(),
                timeout(15000)
            ]);

            alert(`Upload Successful! (${sizeInKB} KB)`);
            uploadForm.reset();
            renderGallery();
        } catch (error) {
            console.error("Upload error:", error);
            if (error.message === "Request timed out") {
                alert("Upload timed out (15s). \nStealth Mode failed. Internet is very restricted.");
            } else {
                alert("Upload failed: " + error.message);
            }
        } finally {
            submitBtn.innerText = "Upload Design";
            submitBtn.disabled = false;
        }
    });
}

// --- REST API HELPERS (Bypass Firewall) ---
const PROJECT_ID = "keypeepanch-786b9";
const API_KEY = "AIzaSyDmbvH3x89JLk-uj_QoyuwVLXMQ3EGImao"; // Required for REST API Quota/Auth
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents`;

async function getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) {
        console.warn("getAuthHeaders: No user logged in.");
        return {};
    }
    console.log("getAuthHeaders: Getting token for user", user.email);
    try {
        const token = await user.getIdToken();
        return { 'Authorization': `Bearer ${token}` };
    } catch (e) {
        console.error("getAuthHeaders Error:", e);
        return {};
    }
}

function parseFirestoreDoc(doc) {
    const data = {};
    if (doc.fields) {
        for (const [key, value] of Object.entries(doc.fields)) {
            // Simplify parsing for our specific string-heavy data
            data[key] = value.stringValue || value.booleanValue || value.integerValue || value.timestampValue || "";
        }
    }
    // Extract ID from full path "projects/.../documents/products/ID"
    const id = doc.name.split('/').pop();
    return { id, ...data };
}

// Helper: Fetch products using POST-based :runQuery (bypasses GET firewall block)
async function fetchProductsRunQuery() {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/default/documents:runQuery`;
    const headers = await getAuthHeaders();
    headers['Content-Type'] = 'application/json';

    const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            structuredQuery: {
                from: [{ collectionId: "products" }]
            }
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`API Error (${response.status}): ${errText}`);
    }

    const results = await response.json();
    // runQuery returns [{document: {...}}, ...] - filter out empty results
    return results
        .filter(r => r.document)
        .map(r => parseFirestoreDoc(r.document));
}

// 4. Admin: Render Gallery (REST API via runQuery POST)
async function renderGallery() {
    if (!gallery) return;
    gallery.innerHTML = '<p style="grid-column: 1/-1;">Loading images...</p>';

    try {
        const allDocs = await fetchProductsRunQuery();

        if (allDocs.length === 0) {
            gallery.innerHTML = '<p style="grid-column: 1/-1; color: var(--color-text-secondary); font-style: italic;">No images uploaded yet.</p>';
            return;
        }

        // Sort Client-Side (descending by createdAt)
        allDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        gallery.innerHTML = '';
        allDocs.forEach((data) => {
            const el = document.createElement('div');
            el.style = "background: var(--color-surface); border: 1px solid var(--color-border); border-radius: 4px; overflow: hidden; position: relative;";
            el.innerHTML = `
                <div style="height: 150px; background-image: url('${data.image}'); background-size: cover; background-position: center;"></div>
                <div style="padding: 0.5rem;">
                    <p style="font-weight: bold; font-size: 0.9rem;">${data.category}</p>
                    <p style="color: var(--color-text-secondary); font-size: 0.8rem;">${data.color}</p>
                </div>
            `;

            const delBtn = document.createElement('button');
            delBtn.innerHTML = "&times;";
            delBtn.style = "position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.7); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; cursor: pointer; font-size: 14px; line-height: 1;";
            delBtn.onclick = () => deleteProduct(data.id);

            el.appendChild(delBtn);
            gallery.appendChild(el);
        });

    } catch (error) {
        console.error("Error loading gallery:", error);
        gallery.innerHTML = `<p style="color: red; font-weight: bold;">${error.message}</p>`;
    }
}

// 5. Admin: Delete Product (REST API)
async function deleteProduct(docId) {
    if (!confirm('Are you sure you want to remove this image?')) return;

    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${BASE_URL}/products/${docId}?key=${API_KEY}`, {
            method: 'DELETE',
            headers
        });

        if (!response.ok) throw new Error("Delete failed: " + response.status);

        renderGallery();
    } catch (error) {
        console.error("Delete error:", error);
        alert("Delete failed: " + error.message);
    }
}

// 6. Public: Filter Logic (Home Page)
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

// 7. Public: Render Results (Products Page)
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
        // Fetch ALL products via POST-based runQuery (bypasses GET firewall block)
        const allDocs = await fetchProductsRunQuery();
        allDocs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        const filteredDocs = [];
        allDocs.forEach((data) => {
            const colorMatch = colors.length === 0 || colors.includes(data.color);
            const categoryMatch = categories.length === 0 || categories.includes(data.category);

            if (colorMatch && categoryMatch) {
                filteredDocs.push(data);
            }
        });

        if (filteredDocs.length === 0) {
            productGrid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--color-text-secondary);">No products found matching these filters.</p>';
        } else {
            productGrid.innerHTML = filteredDocs.map(img => `
                <div class="product-card">
                    <div class="product-image" style="background-image: url('${img.image}'); background-size: cover; background-position: center;"></div>
                    <h3>${img.category}</h3>
                    <p style="color: var(--color-text-secondary)">${img.color}</p>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error("Error loading products:", error);
        productGrid.innerHTML = `<p style="color: red;">Error loading products: ${error.message}</p>`;
    }
}

function renderStats() {
    // Determine stats from DB or keep static for now
}
