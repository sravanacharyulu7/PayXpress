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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR'
  }).format(amount || 0);
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
  if (!window.AudioContext && !window.webkitAudioContext) return;

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  const frequency = 800;
  const duration = 0.08;

  oscillator.type = 'square';
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  gainNode.gain.setValueAtTime(1.0, audioContext.currentTime);
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
      setTimeout(() => {
        window.location.href = "scan.html?role=officer";
      }, 600);
    } else {
      showMessage('error', 'Invalid Officer Credentials', 2500);
    }
  } else {
    if (username && password) {
      showMessage('success', 'User Login Successful', 1200);
      setTimeout(() => {
        window.location.href = "scan.html?role=user";
      }, 600);
    } else {
      showMessage('error', 'Enter valid credentials', 2500);
    }
  }
}

function handleRegister(e) {
  e.preventDefault();

  const p1 = document.getElementById('reg-password')?.value;
  const p2 = document.getElementById('confirm-password')?.value;

  if (p1 !== p2) {
    return showMessage('error', 'Passwords do not match');
  }

  showMessage('success', 'Account Created. Please Login.');
  setTimeout(showLoginView, 1200);
}

// ============================
// CAMERA SCANNER (Quagga)
// ============================
function initCamera() {
  const targetContainer = document.getElementById('camera-container');
  if (!targetContainer || typeof Quagga === 'undefined') return;

  const instruction = targetContainer.querySelector('.initial-instruction');
  const video = document.getElementById('camera-feed');

  if (instruction) instruction.classList.add('hidden');
  if (video) video.classList.add('hidden');

  Quagga.init({
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: '#camera-container',
      constraints: {
        facingMode: "environment"
      }
    },
    decoder: {
      readers: [
        "ean_reader",
        "ean_8_reader",
        "upc_reader",
        "upc_e_reader",
        "code_128_reader",
        "code_39_reader"
      ]
    }
  }, err => {
    if (err) {
      console.error(err);
      showMessage('error', 'Camera access failed. Check browser permissions and ensure the site is loaded over HTTPS.');
      return;
    }

    Quagga.start();
    showMessage('success', 'Scanner Ready');
  });

  Quagga.offDetected?.();

  Quagga.onDetected(result => {
    const code = result?.codeResult?.code;
    const currentTime = Date.now();

    if (!code) return;
    if (code === lastScanned && (currentTime - lastScanTime) < 1500) return;

    lastScanned = code;
    lastScanTime = currentTime;

    handleBarcodeScan(code);
  });
}

// ============================
// BARCODE HANDLER
// ============================
function handleBarcodeScan(barcode) {
  const entry = PRODUCT_DB[barcode];
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');

  if (entry && typeof entry.finalPrice !== 'undefined' && Number(entry.finalPrice) > 0) {
    playScanSound();

    const product = {
      ...entry,
      barcode,
      finalPrice: Number(entry.finalPrice)
    };

    displayProductDetails(product);

    if (role === 'user') {
      addToCart(product);
      document.getElementById('user-cart-view')?.classList.remove('hidden');
      document.getElementById('finish-scan-btn')?.classList.remove('hidden');
    }
  } else if (KNOWN_PRODUCTS[barcode]) {
    const item = KNOWN_PRODUCTS[barcode];
    displayProductDetails({
      ...item,
      barcode,
      finalPrice: 0
    });

    if (role === 'officer') {
      autoFillOfficerForm(barcode);
    } else {
      showMessage('error', 'Price not set — please update in officer mode');
    }
  } else {
    displayProductDetails({
      name: 'Unknown Product',
      description: 'No record found',
      barcode,
      finalPrice: 0
    });

    if (role === 'officer') {
      autoFillOfficerForm(barcode);
    } else {
      showMessage('error', 'Item not available');
    }
  }

  if (role === 'officer') {
    autoFillOfficerForm(barcode);
  }
}

// ============================
// DISPLAY PRODUCT DETAILS
// ============================
function displayProductDetails(product) {
  document.getElementById('product-result')?.classList.remove('hidden');

  const nameEl = document.getElementById('product-name');
  const barcodeEl = document.getElementById('product-barcode');
  const descEl = document.getElementById('product-description');
  const priceEl = document.getElementById('final-price-display');

  if (nameEl) nameEl.textContent = product.name || '—';
  if (barcodeEl) barcodeEl.textContent = product.barcode || '—';
  if (descEl) descEl.textContent = product.description || '—';
  if (priceEl) {
    priceEl.textContent =
      product.finalPrice && Number(product.finalPrice) > 0
        ? formatCurrency(Number(product.finalPrice))
        : '—';
  }
}

// ============================
// CART LOGIC
// ============================
function addToCart(product) {
  if (!product.finalPrice || Number(product.finalPrice) <= 0) {
    showMessage('error', 'Product has no price set');
    return;
  }

  userCart.push({
    ...product,
    finalPrice: Number(product.finalPrice)
  });

  renderCart();
}

function renderCart() {
  const cartView = document.getElementById('user-cart-view');
  const cartItems = document.getElementById('cart-items');
  const cartTotal = document.getElementById('cart-total');
  const finishBtn = document.getElementById('finish-scan-btn');

  if (!cartView || !cartItems || !cartTotal || !finishBtn) return;

  let total = 0;
  let html = `<table class="cart-table">
    <tr>
      <th style="text-align:left;">Item</th>
      <th style="text-align:right;">Price</th>
    </tr>`;

  userCart.forEach(p => {
    const price = Number(p.finalPrice || 0);
    total += price;

    html += `
      <tr>
        <td>${p.name}</td>
        <td style="text-align:right;">${formatCurrency(price)}</td>
      </tr>`;
  });

  html += `</table>`;

  cartItems.innerHTML = html;
  cartTotal.textContent = formatCurrency(total);
  cartView.classList.remove('hidden');
  finishBtn.classList.toggle('hidden', userCart.length === 0);
}

function finishUserCart() {
  const summary = document.getElementById('cart-summary');
  if (summary) summary.classList.remove('hidden');

  const btn = document.getElementById('finish-scan-btn');
  if (btn) btn.classList.add('hidden');

  showMessage('success', 'Cart total calculated', 1500);
  renderCart();
}

// ============================
// ROLE INITIALIZATION
// ============================
function setupRoleFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const role = params.get('role') || 'user';

  const officerPanel = document.getElementById('officer-panel');
  const userCartView = document.getElementById('user-cart-view');
  const greet = document.getElementById('dashboard-greeting');

  if (role === 'officer') {
    if (officerPanel) officerPanel.classList.remove('hidden');
    if (userCartView) userCartView.classList.add('hidden');
    if (greet) greet.textContent = 'Officer Mode - Update prices for items';
  } else {
    if (userCartView) userCartView.classList.remove('hidden');
    if (officerPanel) officerPanel.classList.add('hidden');
    if (greet) greet.textContent = 'Scan items and pay quickly';
    setupPaymentHandlers();
  }
}

// ============================
// PAYMENT SECTION
// ============================
function showPaymentSection() {
  const paymentSection = document.getElementById('payment-section');
  const cartTotalEl = document.getElementById('cart-total');
  const paymentAmount = document.getElementById('payment-amount');

  if (!paymentSection || !cartTotalEl || !paymentAmount) return;

  paymentAmount.value = cartTotalEl.textContent;
  paymentSection.classList.remove('hidden');
}

function setupPaymentHandlers() {
  const finishBtn = document.getElementById('finish-scan-btn');
  const methodSelect = document.getElementById('payment-method');
  const upiSection = document.getElementById('upi-section');
  const cardSection = document.getElementById('card-section');
  const confirmBtn = document.getElementById('confirm-payment-btn');
  const statusEl = document.getElementById('payment-status');

  if (finishBtn) {
    finishBtn.addEventListener('click', () => {
      if (!userCart.length) {
        showMessage('error', 'Cart is empty. Please scan at least one item.');
        return;
      }

      showPaymentSection();
      showMessage('success', 'Review your cart total and complete payment.');
    });
  }

  if (methodSelect) {
    methodSelect.addEventListener('change', () => {
      const method = methodSelect.value;

      if (upiSection) upiSection.classList.toggle('hidden', method !== 'upi');
      if (cardSection) cardSection.classList.toggle('hidden', method !== 'card');

      if (method === 'cash') {
        if (upiSection) upiSection.classList.add('hidden');
        if (cardSection) cardSection.classList.add('hidden');
      }

      if (statusEl) statusEl.textContent = '';
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      const method = methodSelect ? methodSelect.value : '';

      if (!method) {
        showMessage('error', 'Please select a payment method.');
        return;
      }

      if (statusEl) {
        statusEl.textContent = `Payment successful using ${method.toUpperCase()}. Thank you!`;
      }

      showMessage('success', 'Payment successful. You may now proceed to exit.');
      userCart = [];
      renderCart();
    });
  }
}

// ============================
// OFFICER FUNCTIONS
// ============================
function autoFillOfficerForm(barcode) {
  const b = document.getElementById('officer-barcode');
  const n = document.getElementById('officer-name');
  const d = document.getElementById('officer-description');
  const p = document.getElementById('officer-final-price');

  if (!b || !n || !d || !p) return;

  b.value = barcode;

  if (PRODUCT_DB[barcode]) {
    const prod = PRODUCT_DB[barcode];
    n.value = prod.name || '';
    d.value = prod.description || '';
    p.value = prod.finalPrice || '';
  } else if (KNOWN_PRODUCTS[barcode]) {
    const prod = KNOWN_PRODUCTS[barcode];
    n.value = prod.name || '';
    d.value = prod.description || '';
    p.value = '';
  } else {
    n.value = '';
    d.value = '';
    p.value = '';
  }
}

function saveOfficerProduct() {
  const barcode = document.getElementById('officer-barcode')?.value.trim();
  const name = document.getElementById('officer-name')?.value.trim();
  const description = document.getElementById('officer-description')?.value.trim();
  const finalPrice = parseFloat(document.getElementById('officer-final-price')?.value);

  if (!barcode || !name || !description || isNaN(finalPrice) || finalPrice <= 0) {
    showMessage('error', 'Please fill all officer product fields correctly.');
    return;
  }

  PRODUCT_DB[barcode] = {
    name,
    description,
    finalPrice
  };

  localStorage.setItem('productDB', JSON.stringify(PRODUCT_DB));
  showMessage('success', 'Product saved successfully.');

  displayProductDetails({
    barcode,
    name,
    description,
    finalPrice
  });
}

// ============================
// DASHBOARD SETUP
// ============================
function renderDashboard(role) {
  document.getElementById('dashboard-view')?.classList.remove('hidden');

  const greeting = document.getElementById('dashboard-greeting');
  const currentRoleEl = document.getElementById('current-role');

  if (greeting) {
    greeting.textContent =
      role === 'officer'
        ? 'Welcome Officer! Manage your products.'
        : 'Welcome! Scan your items below.';
  }

  if (currentRoleEl) currentRoleEl.textContent = role.toUpperCase();

  if (role === 'officer') {
    document.getElementById('officer-panel')?.classList.remove('hidden');
    document.getElementById('user-cart-view')?.classList.add('hidden');
    document.getElementById('finish-scan-btn')?.classList.add('hidden');
  } else {
    document.getElementById('user-cart-view')?.classList.remove('hidden');
    document.getElementById('officer-panel')?.classList.add('hidden');
  }

  initCamera();

  const barcodeInput = document.getElementById('officer-barcode');
  if (barcodeInput) {
    barcodeInput.addEventListener('input', e => {
      autoFillOfficerForm(e.target.value.trim());
    });
  }

  const finishBtn = document.getElementById('finish-scan-btn');
  if (finishBtn) finishBtn.onclick = finishUserCart;
}

// ============================
// LOGOUT
// ============================
function logout() {
  try {
    if (typeof Quagga !== 'undefined') Quagga.stop();
  } catch (e) {
    console.warn(e);
  }

  window.location.href = 'index.html';
}

// ============================
// INIT
// ============================
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const saveProductBtn = document.getElementById('save-product-btn');

  if (loginForm) loginForm.addEventListener('submit', handleLogin);
  if (registerForm) registerForm.addEventListener('submit', handleRegister);

  document.getElementById('user-mode')?.addEventListener('click', () => setMode('user'));
  document.getElementById('officer-mode')?.addEventListener('click', () => setMode('officer'));
  document.getElementById('create-account-link')?.addEventListener('click', showRegisterView);

  if (saveProductBtn) saveProductBtn.addEventListener('click', saveOfficerProduct);

  const params = new URLSearchParams(window.location.search);
  const role = params.get('role');

  if (role) {
    setupRoleFromQuery();
    renderDashboard(role);
  } else {
    setMode('user');
  }
});

if (typeof window !== 'undefined') {
  window.setMode = setMode;
  window.showLoginView = showLoginView;
  window.showRegisterView = showRegisterView;
  window.initCamera = initCamera;
  window.setupRoleFromQuery = setupRoleFromQuery;
  window.logout = logout;
}
