// ============================
// PayXpress – Unified Script
// Handles Login, Scanner, Cart, Officer Dashboard
// ============================

// --- Officer credentials ---
const OFFICER_EMAIL = 'sravanacharyulu7@gmail.com';
const OFFICER_PASSWORD = 'Sravan26';

// --- Grocery Barcodes (sample database) ---
const KNOWN_PRODUCTS = {
  "8901000000001": { name: "Lays Classic 52g", description: "Salted potato chips" },
  "8901000000002": { name: "Kurkure Masala 60g", description: "Spicy crunchy snack" },
  "8901000000101": { name: "Coca-Cola 500ml", description: "Classic cola drink" },
  "8901000000102": { name: "Sprite 600ml", description: "Lemon-lime soda" },
  "8901000000300": { name: "Maggi Noodles 70g", description: "Masala instant noodles" },
  "8901000000401": { name: "Aashirvaad Atta 1kg", description: "Whole wheat flour" },
  "8901000000500": { name: "Dove Soap 100g", description: "Moisturizing soap" },
  "8901000000600": { name: "Tata Tea 250g", description: "Tea leaves" },
  "8901000000700": { name: "Haldiram's Bhujia 200g", description: "Spicy namkeen snack" },
  "8901000000800": { name: "Kissan Ketchup 500g", description: "Tomato ketchup" },
  "8901000000900": { name: "Johnson's Baby Oil 200ml", description: "Baby oil" },
  "8901000001100": { name: "Surf Excel 1kg", description: "Laundry detergent" },
  "8901000001200": { name: "Red Bull 250ml", description: "Energy drink" },
  "8901000001300": { name: "Britannia Cake 200g", description: "Packaged cake" },
  "8901000002300": { name: "Fortune Sunflower Oil 1L", description: "Cooking oil" },
  "8901000002500": { name: "Camlin Ball Pen", description: "Smooth writing pen" }
};

// --- Merge officer-updated products from localStorage ---
const storedProducts = JSON.parse(localStorage.getItem("productDB")) || {};
let PRODUCT_DB = { ...KNOWN_PRODUCTS, ...storedProducts };

// --- Global State ---
let currentMode = 'user';
let userCart = [];
let lastScanned = null;
let lastScanTime = 0;

// ============================
// Utility Functions
// ============================

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
}

function showMessage(type, text, duration = 3000) {
  const msg = document.getElementById('message-display');
  if (!msg) return;
  msg.textContent = text;
  msg.className = 'message-display';
  msg.classList.add(type === 'success' ? 'message-success' : 'message-error');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), duration);
}

// ============================
// AUDIO FEEDBACK 
// ============================

function playScanSound() {
    // Only run if the browser supports AudioContext
    if (!window.AudioContext && !window.webkitAudioContext) return;

    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    // Connect the oscillator to the gain node, and the gain node to the speakers
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 🔊 Standard Checkout Beep (Default Profile)
    const frequency = 800; // High pitch
    const duration = 0.08; // 80 milliseconds
    
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
    
    // Set the gain to 1.0 (full volume) immediately
    gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);

    // Fade out quickly for a crisp stop
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration); 

    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
}


// ============================
// LOGIN & REGISTER 
// ============================

function setMode(mode) {
  currentMode = mode;
  const userBtn = document.getElementById('user-mode');
  const officerBtn = document.getElementById('officer-mode');
  if (userBtn) userBtn.classList.toggle('active', mode === 'user');
  if (officerBtn) officerBtn.classList.toggle('active', mode === 'officer');
  const createLink = document.getElementById('create-account-link');
  if (createLink) createLink.classList.toggle('hidden', mode === 'officer');
  showLoginView();
}

function showLoginView() {
  const lv = document.getElementById('login-view');
  const rv = document.getElementById('register-view');
  if (lv) lv.classList.remove('hidden');
  if (rv) rv.classList.add('hidden');
}

function showRegisterView() {
  const lv = document.getElementById('login-view');
  const rv = document.getElementById('register-view');
  if (lv) lv.classList.add('hidden');
  if (rv) rv.classList.remove('hidden');
}

function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username')?.value.trim();
  const password = document.getElementById('password')?.value.trim();

  if (currentMode === 'officer') {
    if (username === OFFICER_EMAIL && password === OFFICER_PASSWORD) {
      showMessage('success', 'Officer Login Successful', 1200);
      setTimeout(() => window.location.href = "scan.html?role=officer", 600);
    } else {
      showMessage('error', 'Invalid Officer Credentials', 2500);
    }
  } else {
    if (username && password) {
      showMessage('success', 'User Login Successful', 1200);
      setTimeout(() => window.location.href = "scan.html?role=user", 600); 
    } else {
      showMessage('error', 'Enter valid credentials', 2500);
    }
  }
}

function handleRegister(e) {
  e.preventDefault();
  const p1 = document.getElementById('reg-password')?.value;
  const p2 = document.getElementById('confirm-password')?.value;
  if (p1 !== p2) return showMessage('error', 'Passwords do not match');
  showMessage('success', 'Account Created. Please Login.');
  setTimeout(showLoginView, 1200);
}

// ============================
// CAMERA SCANNER (Quagga)
// ============================

function initCamera() {
  const targetContainer = document.getElementById('camera-container');
  if (!targetContainer) return;
  
  // Hide the initial instruction text and video element (if present)
  const instruction = targetContainer.querySelector('.initial-instruction');
  const video = document.getElementById('camera-feed');

  if (instruction) instruction.classList.add('hidden');
  if (video) video.classList.add('hidden'); 
  
  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      // Fix applied: Use the selector string for reliability
      target: '#camera-container', 
      // CRITICAL FIX: Simplified constraints for better compatibility
      constraints: { facingMode: "environment" } 
    },
    decoder: { readers: ["ean_reader", "upc_reader", "code_128_reader"] },
    locate: true
  }, err => {
    if (err) {
      console.error(err);
      showMessage('error', 'Camera access failed. Check browser permissions and ensure the site is loaded over **HTTPS**.');
      return;
    }
    Quagga.start();
    showMessage('success', 'Scanner Ready');
  });

  Quagga.onDetected(result => {
    const code = result.codeResult.code;
    // Debounce logic
    const currentTime = Date.now();
    if (!code || code.length < 8 || (code === lastScanned && (currentTime - lastScanTime) < 1500)) return;
    
    lastScanned = code;
    lastScanTime = currentTime;
    
    handleBarcodeScan(code);
  });
}

// ============================
// BARCODE HANDLER (Updated with sound)
// ============================

function handleBarcodeScan(barcode) {
  const entry = PRODUCT_DB[barcode];
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');

  if (entry && typeof entry.finalPrice !== 'undefined' && entry.finalPrice > 0) {
    // --- Plays the beep sound on successful scan ---
    playScanSound(); 
    // ----------------------------------------------
    const product = { ...entry, barcode };
    displayProductDetails(product);

    if (role === 'user') {
      addToCart(product);
      document.getElementById("user-cart-view")?.classList.remove("hidden");
      document.getElementById("finish-scan-btn")?.classList.remove("hidden");
    }

  } else if (KNOWN_PRODUCTS[barcode] && (typeof entry.finalPrice === 'undefined' || entry.finalPrice <= 0)) {
    const item = KNOWN_PRODUCTS[barcode];
    displayProductDetails({ ...item, barcode, finalPrice: 0 });
    showMessage('error', 'Price not set — please update in officer mode');
  } else {
    displayProductDetails({ name: 'Unknown Product', description: 'No record found', barcode, finalPrice: 0 });
    showMessage('error', 'Item not available');
  }

  // Only autoFillOfficerForm if the current role is officer
  if (role === 'officer') {
    autoFillOfficerForm(barcode);
  }
}

// ============================
// DISPLAY PRODUCT DETAILS 
// ============================

function displayProductDetails(product) {
  document.getElementById('product-result')?.classList.remove('hidden');
  document.getElementById('product-name').textContent = product.name || '—';
  document.getElementById('product-barcode').textContent = product.barcode || '—';
  document.getElementById('product-description').textContent = product.description || '—';
  document.getElementById('final-price-display').textContent =
    product.finalPrice && product.finalPrice > 0 ? formatCurrency(product.finalPrice) : '—';
}

// ============================
// CART LOGIC (for user) 
// ============================

function addToCart(product) {
  if (!product.finalPrice || product.finalPrice <= 0) {
    showMessage('error', 'Product has no price set');
    return;
  }
  userCart.push(product);
  renderCart();
}

function renderCart() {
  const cartView = document.getElementById('user-cart-view');
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const finishBtn = document.getElementById('finish-scan-btn');

  if (!cartView || !cartItems || !cartTotal || !finishBtn) return;
  
  let total = 0;
  let html = '<table class="cart-table" style="width:100%;color:#E0E0E0;font-size:0.9em;"><tr><th style="text-align:left;">Item</th><th style="text-align:right;">Price</th></tr>';
  userCart.forEach(p => {
    total += p.finalPrice || 0;
    html += `<tr><td>${p.name}</td><td style="text-align:right;">₹${(p.finalPrice || 0).toFixed(2)}</td></tr>`;
  });
  html += '</table>';
  cartItems.innerHTML = html;
  cartTotal.textContent = `₹${total.toFixed(2)}`;

  if (userCart.length > 0) finishBtn.classList.remove('hidden');
  else finishBtn.classList.add('hidden');
}

function finishUserCart() {
  const summary = document.getElementById("cart-summary");
  if (summary) summary.classList.remove("hidden");
  const btn = document.getElementById("finish-scan-btn");
  if (btn) btn.classList.add("hidden");
  showMessage("success", "Cart total calculated ✅", 1500);
  
  userCart = [];
  renderCart();
}

// ============================
// OFFICER FUNCTIONS 
// ============================

function addOrUpdateProduct() {
  const barcode = document.getElementById('barcode-input')?.value.trim();
  const name = document.getElementById('product-name-input')?.value.trim();
  const desc = document.getElementById('product-desc-input')?.value.trim();
  const price = parseFloat(document.getElementById('product-price-input')?.value.trim());

  if (!barcode || !name || isNaN(price) || price <= 0) {
    showMessage('error', 'Please fill barcode, product name, and a valid price (> 0)');
    return;
  }

  PRODUCT_DB[barcode] = { name, description: desc, finalPrice: price };
  localStorage.setItem("productDB", JSON.stringify(PRODUCT_DB));
  showMessage('success', `${name} saved successfully`);
}

function autoFillOfficerForm(barcode) {
  const b = document.getElementById('barcode-input');
  const n = document.getElementById('product-name-input');
  const d = document.getElementById('product-desc-input');
  const p = document.getElementById('product-price-input');
  if (!b || !n || !d) return;

  b.value = barcode;
  
  if (PRODUCT_DB[barcode]) {
    const prod = PRODUCT_DB[barcode];
    n.value = prod.name || '';
    d.value = prod.description || '';
    p.value = prod.finalPrice || '';
  } 
  else if (KNOWN_PRODUCTS[barcode]) {
    const prod = KNOWN_PRODUCTS[barcode];
    n.value = prod.name || '';
    d.value = prod.description || '';
    p.value = '';
  } 
  else {
    n.value = '';
    d.value = '';
    p.value = '';
  }
}

// ============================
// DASHBOARD SETUP 
// ============================

function renderDashboard(role) {
  document.getElementById('dashboard-view')?.classList.remove('hidden');
  document.getElementById('dashboard-greeting').textContent =
    role === 'officer' ? 'Welcome Officer – Manage your products.' : 'Welcome! Scan your items below.';
  
  document.getElementById('current-role').textContent = role.toUpperCase();

  if (role === 'officer') {
    document.getElementById('add-product-form')?.classList.remove('hidden');
    document.getElementById('user-cart-view')?.classList.add('hidden');
    document.getElementById('finish-scan-btn')?.classList.add('hidden');
  } else {
    document.getElementById('user-cart-view')?.classList.remove('hidden');
    document.getElementById('add-product-form')?.classList.add('hidden');
  }

  initCamera();

  const barcodeInput = document.getElementById('barcode-input');
  if (barcodeInput) barcodeInput.addEventListener('input', e => autoFillOfficerForm(e.target.value.trim()));
  
  const finishBtn = document.getElementById("finish-scan-btn");
  if (finishBtn) finishBtn.onclick = finishUserCart;
}

// ============================
// LOGOUT 
// ============================

function logout() {
  try { Quagga.stop(); } catch {}
  window.location.href = "index.html";
}

// ============================
// INIT 
// ============================

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  document.getElementById('user-mode')?.addEventListener('click', () => setMode('user'));
  document.getElementById('officer-mode')?.addEventListener('click', () => setMode('officer'));

  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');
  
  if (role) {
    renderDashboard(role);
  } 
  else {
    setMode('user');
  }
});
