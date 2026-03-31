window.onload = function(){

const params = new URLSearchParams(window.location.search)
const type = params.get("type")

if(type === "register"){
showRegister()
}else{
showLogin()
}

}

const BASE_URL = "https://zivvi-tracker.onrender.com/";  //Backend URL - Change this to your actual backend URL


function showLogin(){
document.getElementById("login-form").classList.remove("hidden")
document.getElementById("register-form").classList.add("hidden")
}

function showRegister(){
document.getElementById("register-form").classList.remove("hidden")
document.getElementById("login-form").classList.add("hidden")
}

function openReset() {
    const modal = document.getElementById('reset-modal');

    modal.style.display = 'flex';

    /* Optional animation */
    modal.style.animation = 'fadeIn 0.3s ease';
}

function closeReset() {
    document.getElementById('reset-modal').style.display = 'none';
}

/* Close modal when clicking outside the card */
window.onclick = function (event) {
    const modal = document.getElementById('reset-modal');

    if (event.target === modal) {
        closeReset();
    }
};

async function forgotPassword(){
    const email = document.querySelector('#reset-modal input').value;

    const res = await fetch(`${BASE_URL}/api/auth/forgot-password`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({email})
    });

    const data = await res.json();
    alert(data.message);
}

let isLoading = false;

async function registerUser() {

    // 🚫 Prevent multiple clicks
    if (isLoading) return;

    const btn = document.querySelector('#register-form button');

    const name = document.querySelector('#register-form input[type="text"]').value.trim();
    const email = document.querySelector('#register-form input[type="email"]').value.trim();
    const password = document.querySelector('#register-form input[type="password"]').value.trim();

    // ✅ Validation
    if (!name || !email || !password) {
        alert("⚠️ Please fill all fields");
        return;
    }

    try {
        isLoading = true;

        // 🔒 Disable button
        btn.innerText = "Please wait...";
        btn.disabled = true;

        const res = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });

        const data = await res.json();

        console.log("STATUS:", res.status);
        console.log("DATA:", data);

        // ✅ SUCCESS
        if (res.status === 200) {
            alert("🎉 Registration Successful!");
            showLogin();
        }

        // ❌ DUPLICATE EMAIL / ERROR
        else {
            alert("❌ " + (data.message || "Registration failed"));
        }

    } catch (error) {
        console.error(error);
        alert("❌ Server error");
    }

    finally {
        // 🔓 Enable button again
        isLoading = false;
        btn.innerText = "Sign Up Now";
        btn.disabled = false;
    }
}

let isLoginLoading = false;

// 🔐 BRUTE FORCE STATE
let failedAttempts = 0;
let lockUntil = 0;

async function loginUser(){

    // 🔒 LOCK CHECK
    if(Date.now() < lockUntil){
        showLockPopup();
        return;
    }

    if(isLoginLoading) return;

    const btn = document.querySelector('#login-form button');

    const email = document.querySelector('#login-form input[type="email"]').value.trim();
    const password = document.querySelector('#login-form input[type="password"]').value.trim();

    if(!email || !password){
        showMessage("⚠️ Please fill all fields", "red");
        return;
    }

    try{
        isLoginLoading = true;

        btn.innerText = "Signing in...";
        btn.disabled = true;

        const res = await fetch(`${BASE_URL}/api/auth/login`,{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify({email,password})
        });

        const data = await res.json();

        console.log("LOGIN STATUS:", res.status);
        console.log("LOGIN DATA:", data);

        if(res.ok && data.token){

            // ✅ SUCCESS RESET
            failedAttempts = 0;
            lockUntil = 0;

            localStorage.setItem("token", data.token);
            window.location.href = "../zivvi_dashboard/zivvi_home.html";

        }else{

            failedAttempts++;

            // 🔥 LOCK CONDITION
            if(failedAttempts >= 5){
                lockUntil = Date.now() + (30 * 1000); // 30 sec
                showLockPopup();
            }else{
                showMessage(`❌ Invalid credentials (${failedAttempts}/5)`, "red");
            }
        }

    }catch(err){
        console.error(err);
        showMessage("❌ Server error", "red");
    }

    finally{
        isLoginLoading = false;
        btn.innerText = "Access Account";
        btn.disabled = false;
    }
}

function showLockPopup(){

    let popup = document.getElementById("lock-popup");

    if(!popup){
        popup = document.createElement("div");
        popup.id = "lock-popup";

        popup.innerHTML = `
            <div style="
                position:fixed;
                top:0;
                left:0;
                width:100%;
                height:100%;
                background:rgba(0,0,0,0.7);
                display:flex;
                align-items:center;
                justify-content:center;
                z-index:9999;
            ">
                <div style="
                    background:#0b0b0f;
                    padding:30px;
                    border-radius:16px;
                    width:90%;
                    max-width:400px;
                    text-align:center;
                    box-shadow:0 20px 60px rgba(0,0,0,0.5);
                ">

                    <h2 style="color:#ff4d79; margin-bottom:10px;">
                        🔒 Account Locked
                    </h2>

                    <p style="color:#aaa; font-size:14px; margin-bottom:20px;">
                        Too many failed login attempts.<br>
                        For security reasons, your account is temporarily locked.
                    </p>

                    <button onclick="openReset(); closeLockPopup()"
                        style="
                            width:100%;
                            padding:12px;
                            background:linear-gradient(135deg,#ff4d79,#ff758c);
                            border:none;
                            border-radius:10px;
                            color:#fff;
                            font-weight:bold;
                            cursor:pointer;
                            margin-bottom:10px;
                        ">
                        🔑 Reset Password
                    </button>

                    <button onclick="closeLockPopup()"
                        style="
                            width:100%;
                            padding:10px;
                            background:transparent;
                            border:1px solid rgba(255,255,255,0.1);
                            border-radius:10px;
                            color:#aaa;
                            cursor:pointer;
                        ">
                        Close
                    </button>

                </div>
            </div>
        `;

        document.body.appendChild(popup);
    }

    popup.style.display = "block";
}

function closeLockPopup(){
    const popup = document.getElementById("lock-popup");
    if(popup) popup.style.display = "none";
}

function showMessage(text, color){
    const msg = document.getElementById("login-msg");
    if(!msg) return;

    msg.innerText = text;
    msg.style.color = color;
}

function togglePassword(id, el){
    const input = document.getElementById(id);

    if(input.type === "password"){
        input.type = "text";
        el.innerText = "🙈"; // hide icon
    } else {
        input.type = "password";
        el.innerText = "👁️"; // show icon
    }
}

// ENTER key for LOGIN
document.querySelectorAll('#login-form input').forEach(input => {
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            loginUser();
        }
    });
});

// ENTER key for REGISTER
document.querySelectorAll('#register-form input').forEach(input => {
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            registerUser();
        }
    });
});
