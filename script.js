// --- Credential System ---
let userCredentials = {};
let ownerCredentials = {};
if (localStorage.getItem("userCredentials")) {
  userCredentials = JSON.parse(localStorage.getItem("userCredentials"));
} else {
  // Initialize with a default user for testing
  userCredentials["user"] = { username: "user", password: "payxpress" };
}
if (localStorage.getItem("ownerCredentials")) {
  ownerCredentials = JSON.parse(localStorage.getItem("ownerCredentials"));
} else {
  // Initialize with a default owner for testing
  ownerCredentials["owner"] = { username: "owner", password: "payxpress" };
}
function saveCredentialsToLocal() {
  localStorage.setItem("userCredentials", JSON.stringify(userCredentials));
  localStorage.setItem("ownerCredentials", JSON.stringify(ownerCredentials));
}

// --- Login Form Logic ---
const loginForm = document.getElementById("login-form");
const roleSelect = document.getElementById("role");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginErrorMsg = document.getElementById("login-error");
const loginContainer = document.getElementById("login-container");
const userApp = document.getElementById("user-app");
const ownerApp = document.getElementById("owner-app");

// Show/hide password with eye icon
const loginEye = document.getElementById("toggle-login-eye");
loginEye.addEventListener("click", function () {
  if (passwordInput.type === "password") {
    passwordInput.type = "text";
    loginEye.classList.add("active");
  } else {
    passwordInput.type = "password";
    loginEye.classList.remove("active");
  }
});

loginForm.addEventListener("submit", function(e) {
  e.preventDefault();
  const role = roleSelect.value;
  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();
  let valid = false;

  if (role === "user" && userCredentials[username] && userCredentials[username].password === password) {
    valid = true;
    loginContainer.style.display = "none";
    userApp.style.display = "block";
    ownerApp.style.display = "none";
    startBarcodeAppUser(); // // Start camera on successful User login
  } else if (role === "owner" && ownerCredentials[username] && ownerCredentials[username].password === password) {
    valid = true;
    loginContainer.style.display = "none";
    ownerApp.style.display = "block";
    userApp.style.display = "none";
    startBarcodeAppOwner(); // // Start camera on successful Owner login
  }
  if (!valid) {
    loginErrorMsg.textContent = "Invalid username or password!";
    loginErrorMsg.style.display = "block";
  }
});

// --- Signup Form Logic ---
const signupModal = document.getElementById("signup-modal");
const openSignupBtn = document.getElementById("open-signup-btn");
const closeSignupBtn = document.getElementById("close-signup-btn");
const signupForm = document.getElementById("signup-form");
const signupRole = document.getElementById("signup-role");
const signupUsername = document.getElementById("signup-username");
const signupPassword = document.getElementById("signup-password");
const signupEye = document.getElementById("toggle-signup-eye");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");
signupEye.addEventListener("click", function () {
  if (signupPassword.type === "password") {
    signupPassword.type = "text";
    signupEye.classList.add("active");
  } else {
    signupPassword.type = "password";
    signupEye.classList.remove("active");
  }
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
  const password = signupPassword.value.trim();
  if(!/[A-Z]/.test(password)) {
    signupError.textContent = "Password must contain at least one uppercase (capital) letter!";
    signupError.style.display = "block";
    signupSuccess.style.display = "none";
    return;
  }
  if (!username || !password) {
    signupError.textContent = "Enter username and password";
    signupError.style.display = "block";
    signupSuccess.style.display = "none";
    return;
  }
  if (userCredentials[username] || ownerCredentials[username]) {
    signupError.textContent = "Username already exists! Please choose a different name.";
    signupError.style.display = "block";
    signupSuccess.style.display = "none";
    return;
  }
  if (role === "user") {
    userCredentials[username] = { username, password };
  } else {
    ownerCredentials[username] = { username, password };
  }
  saveCredentialsToLocal();
  signupError.style.display = "none";
  signupSuccess.textContent = "Registered successfully! Please login.";
  signupSuccess.style.display = "block";
  setTimeout(() => { signupModal.style.display = "none"; }, 1500);
});

// --- LOGOUT ---
document.body.addEventListener('click', function(e){
  if (e.target && e.target.id === "logout-btn") {
    userApp.style.display = "none";
    ownerApp.style.display = "none";
    loginContainer.style.display = "block";
    stopBarcodeAppUser(); // // Stop camera on User logout
    stopBarcodeAppOwner(); // // Stop camera on Owner logout
    loginErrorMsg.style.display = "none"; // Clear login error on logout
    usernameInput.value = ""; // Clear login fields
    passwordInput.value = "";
  }
});

// --- Storage for products (owner) and user bills ---
let productDB = {}; // Key: barcode, Value: { price, discount }

// --- OWNER DASHBOARD ---
// Barcode scan logic for owner
let ownerScanning = false;
function startBarcodeAppOwner() {
  if (ownerScanning) return;
  ownerScanning = true;
  Quagga.init({ // // Initialize QuaggaJS to start camera streaming and scanning
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector("#camera-owner"),
      constraints: { facingMode: "environment" }
    },
    decoder: { readers: ["code_128_reader","ean_reader","ean_8_reader","upc_reader",
          "upc_e_reader","codabar_reader","i2of5_reader","2of5_reader","code_39_reader","code_93_reader"] }
  }, function(err) {
    if (err) { alert("Camera error: " + err.message + ". Check if your connection is HTTPS."); return; }
    Quagga.start(); // // Start the live camera stream after initialization is complete
  });
  Quagga.onDetected(ownerOnDetected);
}
function stopBarcodeAppOwner() {
  if (ownerScanning) {
    try { Quagga.stop(); } catch {} // // Safely stop the QuaggaJS process and release the camera
    Quagga.offDetected(ownerOnDetected);
    ownerScanning = false;
  }
}
function ownerOnDetected(result) {
  if (!result || !result.codeResult || !result.codeResult.code) return;
  let code = result.codeResult.code;
  // This logic is designed to stop the camera once a barcode is detected,
  // allowing the Owner to input product details without constant scanning.
  // We will keep it on for continuous scanning as requested by removing the stop logic.

  // --- Start of Manual Entry/Details update logic ---
  // const barcodeOwnerInput = document.getElementById("barcode-owner");
  // barcodeOwnerInput.value = code;
  // document.getElementById("scan-result-owner").textContent = "Barcode: " + code;
  // Quagga.stop();
  // ownerScanning = false;
  // Quagga.offDetected(ownerOnDetected);
  // --- End of Manual Entry/Details update logic ---

  // New logic for continuous scanning, just display the latest result
  document.getElementById("scan-result-owner").innerHTML = `
    <div style="font-weight:600; font-size:1.2em; color:#007bff;">Barcode Detected:</div>
    <div style="font-size:1.5em; color:#333;">${code}</div>
    <div style="margin-top:10px;">(Scanning is continuous)</div>
  `;
}

// Manual Barcode visibility (removed as per new design)
// function setManualBarcodeVisibility(show) {
//   // document.getElementById("manual-barcode-area").style.display = show ? "block" : "none";
// }

// Owner: Add/Update Button (Logic remains for future use with input fields)
// document.getElementById("add-btn-owner").onclick = function() {
//   const barcode = document.getElementById("barcode-owner").value.trim();
//   const price = document.getElementById("price-owner").value.trim();
//   const discount = document.getElementById("discount-owner").value.trim();
//   if (!barcode) {
//     document.getElementById("product-message-owner").textContent = "Barcode required!";
//     return;
//   }
//   if (price === "" || isNaN(Number(price))) {
//     document.getElementById("product-message-owner").textContent = "Enter a valid price!";
//     return;
//   }
//   productDB[barcode] = {
//     price: Number(price),
//     discount: discount ? Number(discount) : 0
//   };
//   document.getElementById("product-message-owner").textContent = "Product saved! Barcode: " + barcode;
// }

// Scan & Stop buttons (Removed)
// document.getElementById("start-scan-owner").onclick = startBarcodeAppOwner;
// document.getElementById("stop-scan-owner").onclick = stopBarcodeAppOwner;

// --- USER DASHBOARD ---
// Barcode scan logic for user
let userScanning = false;
function startBarcodeAppUser() {
  if (userScanning) return;
  userScanning = true;
  Quagga.init({ // // Initialize QuaggaJS to start camera streaming and scanning
    inputStream: {
      name: "Live",
      type: "LiveStream",
      target: document.querySelector("#camera-user"),
      constraints: { facingMode: "environment" }
    },
    decoder: { readers: ["code_128_reader","ean_reader","ean_8_reader","upc_reader",
          "upc_e_reader","codabar_reader","i2of5_reader","2of5_reader","code_39_reader","code_93_reader"] }
  }, function(err) {
    if (err) { alert("Camera error: " + err.message + ". Check if your connection is HTTPS."); return; }
    Quagga.start(); // // Start the live camera stream after initialization is complete
  });
  Quagga.onDetected(userOnDetected);
}
function stopBarcodeAppUser() {
  if (userScanning) {
    try { Quagga.stop(); } catch {} // // Safely stop the QuaggaJS process and release the camera
    Quagga.offDetected(userOnDetected);
    userScanning = false;
  }
}
function userOnDetected(result) {
  if (!result || !result.codeResult || !result.codeResult.code) return;
  let code = result.codeResult.code;
  // document.getElementById("scan-result-user").textContent = "Barcode: " + code;
  let product = productDB[code];
  if (product) {
    document.getElementById("user-content").innerHTML = `
      <div class="product-result">
        <div><b>Item:</b> Scanned Product</div>
        <div><b>Barcode:</b> ${code}</div>
        <div><b>Price:</b> ₹${product.price.toFixed(2)}</div>
        <div><b>Discount:</b> ${product.discount}%</div>
        <div style="font-weight:700; color:#339933;"><b>Net Total:</b> ₹${(product.price * (1 - product.discount/100)).toFixed(2)}</div>
      </div>
    `;
  } else {
    document.getElementById("user-content").innerHTML = `<div class="product-result" style="color:#db2222;">No price info saved for barcode: <b>${code}</b></div>`;
  }
  // No stop logic here either, allowing the user to continuously scan items for their bill.
}

// Scan & Stop buttons (Removed)
// document.getElementById("start-scan-user").onclick = startBarcodeAppUser;
// document.getElementById("stop-scan-user").onclick = stopBarcodeAppUser;

/* --- Global Styles --- */
/* (CSS is unchanged as it was provided for context/styling the non-functional buttons) */

// --- Initial setup on script load ---
// Initial save of default credentials if they don't exist
if (!localStorage.getItem("userCredentials")) {
    saveCredentialsToLocal();
}
// Log the current credentials for easy testing (remove in production)
console.log("User Credentials:", userCredentials);
console.log("Owner Credentials:", ownerCredentials);
