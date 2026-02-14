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

            // Save directly to Firestore
            await addDoc(collection(db, "products"), {
                category: category,
                color: color,
                image: base64String,
                createdAt: new Date().toISOString()
            });

            alert("Upload Successful!");
            uploadForm.reset();
            renderGallery();
        } catch (error) {
            console.error("Upload error:", error);
            alert("Upload failed: " + error.message);
        } finally {
            submitBtn.innerText = "Upload Design";
            submitBtn.disabled = false;
        }
    });
}

// 4. Admin: Render Gallery
async function renderGallery() {
    if (!gallery) return;
    gallery.innerHTML = '<p style="grid-column: 1/-1;">Loading images...</p>';

    try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            gallery.innerHTML = '<p style="grid-column: 1/-1; color: var(--color-text-secondary); font-style: italic;">No images uploaded yet.</p>';
            return;
        }

        gallery.innerHTML = '';
        querySnapshot.forEach((doc) => {
            const data = doc.data();
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
            delBtn.onclick = () => deleteProduct(doc.id);

            el.appendChild(delBtn);
            gallery.appendChild(el);
        });

    } catch (error) {
        console.error("Error loading gallery:", error);
        gallery.innerHTML = `<p style="color: red;">Error loading gallery: ${error.message}</p>`;
    }
}

// 5. Admin: Delete Product
async function deleteProduct(docId) {
    if (!confirm('Are you sure you want to remove this image?')) return;

    try {
        // Delete from Firestore
        await deleteDoc(doc(db, "products", docId));

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
        // Fetch ALL products then filter client-side (simplest for avoiding complex Firestore composite indices right now)
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);

        const filteredDocs = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
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
