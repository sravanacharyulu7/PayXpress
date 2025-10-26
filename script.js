// --- CREDENTIAL STORE FOR DEMO ---
let userCredentials = { user: { username: "user", password: "payxpress" } };
let ownerCredentials = { owner: { username: "owner", password: "payxpress" } };

// --- LOGIN HANDLING ---
const loginForm = document.getElementById("login-form");
const roleSelect = document.getElementById("role");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const showPassword = document.getElementById("show-password");
const loginErrorMsg = document.getElementById("login-error");
const loginContainer = document.getElementById("login-container");
const userApp = document.getElementById("user-app");
const ownerApp = document.getElementById("owner-app");

// Show Password
showPassword.addEventListener("change", () => {
  passwordInput.type = showPassword.checked ? "text" : "password";
});

loginForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const role = roleSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  let valid = false;

  if (role === "user" && userCredentials[username] && userCredentials[username].password === password) {
    valid = true;
    loginContainer.style.display = "none";
    userApp.style.display = "block";
    startBarcodeAppUser();
  } else if (role === "owner" && ownerCredentials[username] && ownerCredentials[username].password === password) {
    valid = true;
    loginContainer.style.display = "none";
    ownerApp.style.display = "block";
    startBarcodeAppOwner();
  }
  if (!valid) {
    loginErrorMsg.textContent = "Invalid username or password!";
    loginErrorMsg.style.display = "block";
  }
});

// --- SIGNUP LOGIC ---
const signupModal = document.getElementById("signup-modal");
const openSignupBtn = document.getElementById("open-signup-btn");
const closeSignupBtn = document.getElementById("close-signup-btn");
const signupForm = document.getElementById("signup-form");
const signupRole = document.getElementById("signup-role");
const signupUsername = document.getElementById("signup-username");
const signupPassword = document.getElementById("signup-password");
const signupShowPassword = document.getElementById("signup-show-password");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");

signupShowPassword.addEventListener("change", () => {
  signupPassword.type = signupShowPassword.checked ? "text" : "password";
});
openSignupBtn.addEventListener("click", () => {
  signupModal.style.display = "flex";
  signupError.style.display = "none";
  signupSuccess.style.display = "none";
  signupUsername.value = "";
  signupPassword.value = "";
});
closeSignupBtn.addEventListener("click", () => signupModal.style.display = "none");
signupForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const role = signupRole.value;
  const username = signupUsername.value.trim();
  const password = signupPassword.value;
  if (!username || !password) {
    signupError.textContent = "Enter username and password";
    signupError.style.display = "block";
    signupSuccess.style.display = "none";
    return;
  }
  if (role === "user") {
    if (userCredentials[username]) {
      signupError.textContent = "User already exists!";
      signupError.style.display = "block";
      signupSuccess.style.display = "none";
      return;
    }
    userCredentials[username] = { username, password };
  } else {
    if (ownerCredentials[username]) {
      signupError.textContent = "Officer already exists!";
      signupError.style.display = "block";
      signupSuccess.style.display = "none";
      return;
    }
    ownerCredentials[username] = { username, password };
  }
  signupError.style.display = "none";
  signupSuccess.textContent = "Registered successfully! Please login.";
  signupSuccess.style.display = "block";
  setTimeout(() => { signupModal.style.display = "none"; }, 1200);
});

// --- LOGOUT (APPLIES TO BOTH ROLES) ---
document.body.addEventListener('click', function(e){
  if (e.target && e.target.id === "logout-btn") {
    userApp.style.display = "none";
    ownerApp.style.display = "none";
    loginContainer.style.display = "block";
    // Optionally, clear all dynamic fields, or use location.reload();
  }
});

// --- SHARED PRICE DATA ---
let ownerProductPrices = {};

// --- USER BARCODE SCAN AND PAY ---
function startBarcodeAppUser() {
  const video = document.getElementById("camera-user");
  const codeDisplay = document.getElementById("code-user");
  const productDisplay = document.getElementById("product-user");
  const addAnotherBtn = document.getElementById("add-another-btn-user");
  const productList = document.getElementById("product-list-user");
  const payBillBtn = document.getElementById("pay-bill-btn");
  const totalBillDiv = document.getElementById("total-bill");

  let scannedCodes = [];
  let scannedProducts = [];
  let scanning = true;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => { video.srcObject = stream; startScanner(); })
    .catch(err => productDisplay.innerHTML = "<span style='color:#b22222;'>Camera access error.</span>");

  async function startScanner() {
    if (!("BarcodeDetector" in window)) {
      productDisplay.innerHTML = "<span style='color:#b22222;'>Barcode Detector not supported.</span>";
      return;
    }
    const detector = new BarcodeDetector({ formats: ["ean_13", "qr_code", "upc_a"] });
    setInterval(async () => {
      if (!scanning) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (scannedCodes[scannedCodes.length - 1] !== code) {
            codeDisplay.textContent = code;
            scanning = false;
            fetchProductDetails(code);
          }
        }
      } catch (err) {
        productDisplay.innerHTML = "<span style='color:#b22222;'>Scanning error.</span>";
      }
    }, 1000);
  }

  async function fetchProductDetails(code) {
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await response.json();
    let html = '';
    let prices = ownerProductPrices[code];
    if (data.status === 1) {
      html += `<h3>${data.product.product_name || "Unknown Product"}</h3>
               <p>Brand: ${data.product.brands || "N/A"}</p>`;
      if (prices) {
        html += `<p>Actual Price: ₹${prices.actual || "?"}</p>
                 <p>Discounted Price: ₹${prices.discount || "?"}</p>`;
      } else {
        html += `<p style="color:#a44738;">No price info (ask shop owner)</p>`;
      }
      html += `<img src="${data.product.image_front_url || ''}" width="120" style="border-radius:8px;">`;
      addProductToList(data.product.product_name, code, data.product.brands, data.product.image_front_url, prices);
    } else {
      html = `<span style="color:#a44738;">Product not found.<br>Code: ${code}</span>`;
    }
    productDisplay.innerHTML = html;
    addAnotherBtn.style.display = "block";
  }

  function addProductToList(name, code, brand, imageUrl, prices) {
    scannedCodes.push(code);
    scannedProducts.push({ name, code, brand, imageUrl, prices });
    if (!productList.innerHTML) productList.innerHTML = `<h3>Scanned Products</h3>`;
    productList.innerHTML += `
      <div style="margin-bottom:14px; padding-bottom:8px; border-bottom:1px dotted #c69d78;">
        <strong>${name}</strong><br>
        <span style="color:#835339;">Code:</span> ${code}<br>
        <span style="color:#835339;">Brand:</span> ${brand}<br>
        ${prices ?
          `<span style="color:#835339;">Actual Price:</span> ₹${prices.actual}<br>
          <span style="color:#835339;">Discount Price:</span> ₹${prices.discount}<br>` :
          `<span style="color:#a44738;">No Price Info</span><br>`
        }
        ${imageUrl ? `<img src="${imageUrl}" width="70" style="border-radius:6px;">` : ""}
      </div>`;
  }
  addAnotherBtn.onclick = () => {
    productDisplay.innerHTML = ""; codeDisplay.textContent = "None";
    scanning = true; addAnotherBtn.style.display = "none";
  };
  payBillBtn.onclick = () => {
    let total = 0;
    scannedProducts.forEach(p => {
      if (p.prices) total += parseFloat(p.prices.discount || p.prices.actual || 0);
    });
    totalBillDiv.innerHTML = `Total Amount to Bill: ₹${total.toFixed(2)}`;
  };
}

// --- OWNER BARCODE SCAN/EDIT ---
function startBarcodeAppOwner() {
  const video = document.getElementById("camera-owner");
  const codeDisplay = document.getElementById("code-owner");
  const productDisplay = document.getElementById("product-owner");
  const addForm = document.getElementById("add-details-form");
  const actualInput = document.getElementById("actual-price");
  const discountInput = document.getElementById("discount-price");
  const addAnotherBtn = document.getElementById("add-another-btn-owner");
  const productList = document.getElementById("product-list-owner");

  let scannedCodes = [];
  let scanning = true;
  let currentCode = null;
  let currentProduct = null;

  navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
    .then(stream => { video.srcObject = stream; startScanner(); })
    .catch(err => productDisplay.innerHTML = "<span style='color:#b22222;'>Camera access error.</span>");

  async function startScanner() {
    if (!("BarcodeDetector" in window)) {
      productDisplay.innerHTML = "<span style='color:#b22222;'>Barcode Detector not supported.</span>";
      return;
    }
    const detector = new BarcodeDetector({ formats: ["ean_13", "qr_code", "upc_a"] });
    setInterval(async () => {
      if (!scanning) return;
      try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
          const code = barcodes[0].rawValue;
          if (scannedCodes[scannedCodes.length - 1] !== code) {
            codeDisplay.textContent = code;
            scanning = false;
            fetchProductDetails(code);
          }
        }
      } catch (err) {
        productDisplay.innerHTML = "<span style='color:#b22222;'>Scanning error.</span>";
      }
    }, 1000);
  }

  async function fetchProductDetails(code) {
    currentCode = code;
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${code}.json`);
    const data = await response.json();
    let html = '';
    if (data.status === 1) {
      currentProduct = data.product;
      html += `<h3>${data.product.product_name || "Unknown Product"}</h3>
               <p>Brand: ${data.product.brands || "N/A"}</p>
               <img src="${data.product.image_front_url || ''}" width="120" style="border-radius:8px;">`;
      if (ownerProductPrices[code]) {
        actualInput.value = ownerProductPrices[code].actual;
        discountInput.value = ownerProductPrices[code].discount;
      } else {
        actualInput.value = '';
        discountInput.value = '';
      }
      addForm.style.display = "block";
      addAnotherBtn.style.display = "none";
    } else {
      html = `<span style="color:#a44738;">Product not found.<br>Code: ${code}</span>`;
      addForm.style.display = "none";
      addAnotherBtn.style.display = "block";
    }
    productDisplay.innerHTML = html;
  }

  addForm.onsubmit = function(e) {
    e.preventDefault();
    if (currentCode) {
      ownerProductPrices[currentCode] = {
        actual: actualInput.value,
        discount: discountInput.value
      };
      addProductToList(
        currentProduct ? currentProduct.product_name : "Unknown Product",
        currentCode,
        currentProduct ? currentProduct.brands : "N/A",
        currentProduct ? currentProduct.image_front_url : "",
        actualInput.value,
        discountInput.value
      );
      addForm.style.display = "none";
      addAnotherBtn.style.display = "block";
    }
  };

  function addProductToList(name, code, brand, imageUrl, actual, discount) {
    scannedCodes.push(code);
    if (!productList.innerHTML) productList.innerHTML = `<h3>Managed Products</h3>`;
    productList.innerHTML += `
      <div style="margin-bottom:14px; padding-bottom:8px; border-bottom:1px dotted #c69d78;">
        <strong>${name}</strong><br>
        <span style="color:#835339;">Code:</span> ${code}<br>
        <span style="color:#835339;">Brand:</span> ${brand}<br>
        <span style="color:#835339;">Actual Price:</span> ₹${actual}<br>
        <span style="color:#835339;">Discount Price:</span> ₹${discount}<br>
        ${imageUrl ? `<img src="${imageUrl}" width="70" style="border-radius:6px;">` : ""}
      </div>`;
  }

  addAnotherBtn.onclick = () => {
    productDisplay.innerHTML = "";
    codeDisplay.textContent = "None";
    scanning = true;
    addAnotherBtn.style.display = "none";
    addForm.style.display = "none";
    actualInput.value = "";
    discountInput.value = "";
    currentCode = null;
    currentProduct = null;
  };
}
