// 🔹 Initialize icons (safe)
if (window.lucide) {
    lucide.createIcons();
}

// 🔥 GLOBAL CHART PERFORMANCE FIX
if (typeof Chart !== "undefined") {
    Chart.defaults.animation = false;
}

// 🔹 Global state
let pie = null;
let trend = null;

let appData = {
    budget: 0,
    rawData: [],
    profile: {}
};

let currentFilters = {
    search: "",
    method: "",
    date: "all"
};

const BASE_URL = "http://localhost:5000"; // Backend URL - Change this to your actual backend URL

// ==============================
// 📌 PAGE NAVIGATION SYSTEM
// ==============================

let trendRendered = false;

function showPage(page, el) {
    try {
        ['dashboard', 'analytics', 'settings'].forEach(p => {
            const pageEl = document.getElementById('page-' + p);
            if (pageEl) pageEl.classList.add('hidden');
        });

        document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));

        const activePage = document.getElementById('page-' + page);
        if (activePage) activePage.classList.remove('hidden');

        if (el) el.classList.add('active');

        // 🔥 FIX
        if (page === 'analytics' && !trendRendered) {
            trendRendered = true;
            setTimeout(renderTrend, 200);
        }

    } catch (err) {
        console.error("Navigation error:", err);
    }
}

function escapeHTML(str) {
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[m]));
}

// ==============================
// 🚀 APP INITIALIZATION
// ==============================
async function sync() {
    let token = null;

    try {
        document.body.classList.add("loading");

        // ==============================
        // 🔐 TOKEN CHECK
        // ==============================
        token = localStorage.getItem("token");

        if (!token || token === "undefined" || token === "null") {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ==============================
        // 🌐 API CALL
        // ==============================
        const res = await fetch(`${BASE_URL}/api/dashboard`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            }
        });

        // ==============================
        // ❌ AUTH FAIL (STOP EXECUTION)
        // ==============================
        if (res.status === 401 || res.status === 403) {
            console.error("Unauthorized");

            showToast("Session expired, login again");

            localStorage.removeItem("token");

            // 🔥 IMPORTANT: return after redirect
            window.location.href = "../login/login.html";
            return;
        }

        // ==============================
        // ❌ API ERROR
        // ==============================
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || `API Error: ${res.status}`);
        }

        // ==============================
        // 📦 SAFE JSON PARSE
        // ==============================
        let data;
        try {
            data = await res.json();
        } catch {
            throw new Error("Invalid JSON response");
        }

        if (!data || typeof data !== "object") {
            throw new Error("Invalid API response");
        }

        // ==============================
        // 📊 SAFE DATA EXTRACTION
        // ==============================
        const resData = data.data || {};

        appData = {
            budget: Number(resData.budget) || 0,
            rawData: Array.isArray(resData.rawData) ? resData.rawData : [],
            profile: resData.profile || {}
        };

        // ==============================
        // 🎨 RENDER UI
        // ==============================
        renderAll();
        
        initFilters();
        applyFilters();

    } catch (err) {
        console.error("Sync error:", err);

        // ⚠️ Network ya server issue
        showToast("⚠️ Network issue, retrying...");

        // ❌ DO NOT logout here (important fix)
        // sirf error show karo

    } finally {
        document.body.classList.remove("loading");
    }
}

function renderAll() {
    renderDash();
    renderPie();
    renderSettings();
    renderLedger();
    renderBankStats();
    updateGreeting();
    updateTodaySpend();
    updateFinanceScore();
    updateTrendAlert();
    updateCoachText();
    updateAnalyticsCards();
    renderHeatmap();

    initHeatmapRealtime();

    initAISettings();
    
    updateAICoach(appData.rawData);
    
    renderPaymentAnalytics();

    UserGuide.init();
    initSessionTracker();
    initLiveDateTime();

    setDefaultDate();   // ✅ SAFE CALL
    initDateListener(); // 🔥 IMPORTANT
}

function setDefaultDate() {
    const dateInput = document.getElementById("date");

    if (!dateInput) return;

    // 🔥 ONLY FIRST TIME (no override after user change)
    if (!dateInput.value && !dateInput.dataset.locked) {
        const today = new Date().toLocaleDateString("en-CA");
        dateInput.value = today;
    }
}

function initDateListener() {
    const dateInput = document.getElementById("date");

    if (!dateInput) return;

    // ❗ duplicate listener avoid
    if (dateInput.dataset.listenerAdded) return;

    dateInput.addEventListener("change", () => {
        dateInput.dataset.locked = "true"; // 🔥 LOCK USER DATE
    });

    dateInput.dataset.listenerAdded = "true";
}

function toNumber(val) {
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
}

function renderDash() {
    try {
        // ==============================
        // 🔥 1. USE FILTERED DATA
        // ==============================
        const data = getFilteredData();

        // ==============================
        // 📊 TOTAL SPENT (FILTERED)
        // ==============================
        const total = data.reduce((sum, e) => sum + toNumber(e.amount), 0);

        const totalEl = document.getElementById('totalVal');
        if (totalEl) {
            totalEl.innerText = `₹${total.toLocaleString()}`;
        }

        // ==============================
        // 📈 SMART BUDGET (FILTER BASED)
        // ==============================
        let budget = appData.budget || 0;

        switch (currentFilters.date) {

            case "6_months":
               budget = budget * 6;
            break;

            case "this_year":
            case "last_year":
                budget = budget * 12;
            break;
        }

        // ==============================
        // 📊 CALCULATIONS
        // ==============================
        const percent = budget > 0
            ? Math.min(100, (total / budget) * 100)
            : 0;

        const remaining = Math.max(0, budget - total);

        // ==============================
        // 📊 OLD UI
        // ==============================
        const progBar = document.getElementById('progBar');
        const limitTxt = document.getElementById('limitTxt');

        if (progBar) progBar.style.width = percent + '%';
        if (limitTxt) limitTxt.innerText = `₹${Math.round(budget).toLocaleString()}`;

        // ==============================
        // 🔥 NEW UI VALUES
        // ==============================
        const totalSpentEl = document.getElementById("totalSpent");
        const monthlyLimitEl = document.getElementById("monthlyLimit");
        const remainingEl = document.getElementById("remainingAmount");
        const availableEl = document.getElementById("availableBalance");
        const usagePercentEl = document.getElementById("usagePercent");
        const usageBar = document.getElementById("usageBar");

        if (totalSpentEl) totalSpentEl.innerText = `₹${total.toLocaleString()}`;
        if (monthlyLimitEl) monthlyLimitEl.innerText = `₹${Math.round(budget).toLocaleString()}`;
        if (remainingEl) remainingEl.innerText = `₹${remaining.toLocaleString()}`;
        if (availableEl) availableEl.innerText = `₹${remaining.toLocaleString()}`;

        if (usagePercentEl) usagePercentEl.innerText = `${percent.toFixed(0)}%`;

        if (usageBar) {
            usageBar.style.width = percent + "%";

            // 🔥 SMART COLOR
            if (percent < 40) {
                usageBar.style.background = "linear-gradient(to right, #10b981, #22c55e)";
            } else if (percent < 80) {
                usageBar.style.background = "linear-gradient(to right, #f59e0b, #f97316)";
            } else {
                usageBar.style.background = "linear-gradient(to right, #ef4444, #dc2626)";
            }
        }

        // ==============================
        // 🎯 SMART BOX COLOR
        // ==============================
        const spentBox = document.getElementById("spentBox");
        const leftBox = document.getElementById("leftBox");

        if (spentBox) {
            spentBox.style.backgroundImage =
                percent < 40
                    ? "linear-gradient(135deg, rgba(239,68,68,0.2), transparent)"
                    : percent < 80
                    ? "linear-gradient(135deg, rgba(239,68,68,0.4), transparent)"
                    : "linear-gradient(135deg, rgba(239,68,68,0.7), transparent)";
        }

        if (leftBox) {
            const leftPercent = budget > 0 ? (remaining / budget) * 100 : 0;

            leftBox.style.backgroundImage =
                leftPercent > 60
                    ? "linear-gradient(135deg, rgba(16,185,129,0.4), transparent)"
                    : leftPercent > 30
                    ? "linear-gradient(135deg, rgba(16,185,129,0.25), transparent)"
                    : "linear-gradient(135deg, rgba(16,185,129,0.12), transparent)";
        }

        // ==============================
        // 👤 PROFILE
        // ==============================
        const profile = appData.profile || {};

        const name = profile.name || "User";
        const email = profile.email || "no-email";
        const tier = profile.tier || "Standard";

        const nameEl = document.getElementById("user-name");
        const emailEl = document.getElementById("user-email");
        const tierEl = document.getElementById("user-tier");
        const avatarEl = document.getElementById("user-avatar");

        if (nameEl) nameEl.innerText = name;
        if (emailEl) emailEl.innerText = email;
        if (tierEl) tierEl.innerText = tier.toUpperCase();

        if (avatarEl) {
            avatarEl.src = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(name)}`;
        }

        const shimmer = document.getElementById('avatar-shimmer');
        if (shimmer) shimmer.classList.add('hidden');

    } catch (err) {
        console.error("renderDash error:", err);
    }
}

function getEmo(category) {
    const emojiMap = {
        // --- Pehle se maujood categories (Standard) ---
        food: '🍲',          // Groceries ya general khana
        bills: '⚡',         // Electricity, water, etc.
        electricity: '💡',   // Specific Light/Power Bill
        travel: '🚲',        // Transport (Cycle/Bus/Train)
        fun: '🎡',           // Entertainment/Hobbies
        'fast food': '🍔',   // Pizza, Burger, Street Food
        vegetable: '🥦',     // Sabzi, Fruit Mandi
        rent: '🏠',          // Ghar ka kiraya
        shopping: '🛍️',      // Kapde, general accessories
        health: '💊',        // Dawai, doctor, hospital fee
        education: '📚',     // Fees, books, courses
        fuel: '⛽',          // Gaadi ka tel (Petrol/Diesel)
        gifts: '🎁',         // Doosron ke liye tohfe
        recharge: '📱',      // Mobile/Internet/DTH recharge
        savings: '💰',       // Paisa bachana
        investment: '📈',    // Stocks, mutual funds, gold
        electronic: '💻',    // Laptop, Mobile, Gadgets
        party: '🎉',         // Celebrations, clubbing, outings

        // --- Naye useful additions (Complete) ---

        // 🏡 Home Maintenance & Utilites (Aham Kharche)
        'home repair': '🔨',    // Ghar ki marammat, plumbing, painting
        cleaning: '🧹',         // Safai, house help, dustbin bags, etc.
        furniture: '🛋️',        // Sofas, beds, decor items

        // 🚗 Vehicle & Transport (Detailed)
        insurance: '🛡️',     // Gaadi, Health, ya Life insurance premium
        car: '🚗',           // Car se related koi bada kharcha (Repair, Service)
        taxi: '🚕',          // Taxi, Auto, Ola/Uber ride

        // 🧸 Personal Care & Family
        personal: '💇',      // Salon, haircuting, grooming products
        beauty: '💄',        // Cosmetics, skincare
        baby: '🍼',          // Diapers, toys, baby food
        pets: '🐾',          // Pet food, vet bills, toys

        // ☕ Lifestyle & Miscellaneous
        coffee: '☕',        // Café, chai/coffee shop visits
        donations: '🤝',     // Charity, religious contributions, helping
        fees: '💳',          // Bank fees, late fees, hidden charges
        fines: '👮',         // Challan, penalties (traffic fine, library fine)

        gym: '🏋️',           // Gym membership, equipment, protein

        // 🚗🏍️ Vehicle Insurance (Detailed)
        'bike insurance': '🏍️',    // Specifically for bike premium
        'car insurance': '🚗',     // Specifically for car premium        
    };

    // return standard approach, specific logic remains same
    return emojiMap[(category || "").toLowerCase()] ?? '💰';
}

function renderPie() {
    try {
        const isEnabled = localStorage.getItem("ai_enabled") === "true";
        const insightEl = document.getElementById('smartInsightText');

        if (!isEnabled) {
            if (insightEl) {
                insightEl.innerText = "🚫 Smart Insights is OFF";
                insightEl.style.opacity = "0.5";
                insightEl.style.filter = "blur(1px)";
            }
            return;
        }

        if (typeof Chart === "undefined") return;

        const data = getFilteredData();
        if (!Array.isArray(data)) return;

        const cats = [...new Set(data.map(e => e.category || "Other"))];

        const colors = cats.map((_, i) =>
            `hsl(${i * 60}, 70%, 60%)`
        );

        // ==============================
        // 📊 VALUES
        // ==============================
        const vals = cats.map(c =>
            data
                .filter(e => (e.category || "").toLowerCase() === c.toLowerCase())
                .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
        );

        // ==============================
        // 🔥 DETAILED DATA (SAFE)
        // ==============================
        const detailedData = cats.map(c =>
            data.filter(e =>
                (e.category || "").toLowerCase() === c.toLowerCase()
            )
        );

        const total = vals.reduce((a, b) => a + b, 0);

        const totalEl = document.getElementById('pieTotal');
        if (totalEl) totalEl.innerText = `₹${total.toLocaleString()}`;

        const canvas = document.getElementById('pieChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');

        if (pie instanceof Chart) {
            pie.destroy();
        }

        // ==============================
        // 📭 EMPTY STATE
        // ==============================
        if (total === 0) {
            pie = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    datasets: [{
                        data: [1],
                        backgroundColor: ['#1f2937'],
                        borderWidth: 0
                    }]
                },
                options: {
                    plugins: { legend: { display: false } }
                }
            });

            if (insightEl) {
                insightEl.innerText = "🚀 Start logging your expenses.";
                insightEl.style.opacity = "1";
                insightEl.style.filter = "none";
            }

            const legend = document.getElementById('legendBox');
            if (legend) legend.innerHTML = "";

            return;
        }

        // ==============================
        // 🎨 CHART (FINAL FIXED TOOLTIP)
        // ==============================
        pie = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: cats, // 🔥 IMPORTANT FIX
                datasets: [{
                    data: vals,
                    backgroundColor: colors,
                    borderWidth: 0,
                    cutout: '85%',
                    borderRadius: 15,
                    hoverOffset: 10
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },

                    tooltip: {
                        callbacks: {

                            // ✅ TITLE SAFE
                            title: function(context) {
                                if (!context || !context.length) return "";
                                const index = context[0].dataIndex;
                                return cats[index] || "";
                            },

                            // ✅ MAIN VALUE SAFE
                            label: function(context) {
                                return `Total: ₹${context.raw || 0}`;
                            },

                            // ✅ EXTRA DATA SAFE
                            afterLabel: function(context) {
                                const index = context.dataIndex;
                                const items = detailedData[index] || [];

                                if (!items.length) return "No items";

                                return items.slice(0, 3).map(e =>
                                    `${e.name || "Item"} (${e.category || "Other"}) - ₹${e.amount || 0}`
                                );
                            }
                        }
                    }
                }
            }
        });

        // ==============================
        // 🤖 INSIGHT (UNCHANGED)
        // ==============================
        const maxVal = Math.max(...vals);
        const topCatIndex = vals.indexOf(maxVal);
        const topCategory = cats[topCatIndex] || "Unknown";

        const percentage = total
            ? ((maxVal / total) * 100).toFixed(1)
            : 0;

        let insightText =
            percentage > 80
                ? `⚠️ High spending on ${topCategory} (${percentage}%)`
                : percentage > 30
                ? `📊 Highest spending on ${topCategory} (${percentage}%)`
                : `✅ Balanced spending (${topCategory} ${percentage}%)`;

        if (insightEl) {
            insightEl.innerText = insightText;
            insightEl.style.opacity = "1";
            insightEl.style.filter = "none";
        }

        const legend = document.getElementById('legendBox');
        if (!legend) return;

        legend.innerHTML = cats.map((c, i) => {
            const value = vals[i];
            const perc = total ? ((value / total) * 100).toFixed(1) : 0;

            return `
                <div class="flex justify-between items-center p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <span class="text-xs text-white/60">${c}</span>
                    <span class="text-xs text-indigo-400">₹${value.toLocaleString()} (${perc}%)</span>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("renderPie error:", err);
    }
}

function renderBankStats() {
    try {
        const container = document.getElementById("bankStats");
        if (!container) return;

        const data = getFilteredData();

        // ==============================
        // 📭 EMPTY STATE
        // ==============================
        if (!data.length) {
            container.innerHTML = `
                <p class="text-xs text-white/30 text-center py-4">
                    No bank data available
                </p>
            `;
            return;
        }

        // ==============================
        // 📊 CALCULATE TOTAL (BANK + METHOD)
        // ==============================
        const banks = {};

        data.forEach(e => {
            const bank = (e.bank_name || "Unknown").trim();
            const method = (e.payment_method || "Unknown").trim();
            const amount = parseFloat(e.amount) || 0;

            // 🔥 KEY = BANK + METHOD
            const key = `${bank} (${method})`;

            banks[key] = (banks[key] || 0) + amount;
        });

        // ==============================
        // 🔽 SORT
        // ==============================
        const sortedBanks = Object.entries(banks)
            .sort((a, b) => b[1] - a[1]);

        // ==============================
        // 🎨 UI RENDER (UPGRADED)
        // ==============================
        container.innerHTML = sortedBanks.map(([bank, total]) => {

            // 🔥 METHOD EXTRACT (for badge color)
            let method = "Unknown";
            if (bank.includes("(")) {
                method = bank.split("(")[1].replace(")", "").trim();
            }

            // 🎨 COLOR BASED ON METHOD
            let badgeColor = "bg-white/10 text-white/60";

            if (method === "UPI") badgeColor = "bg-emerald-500/10 text-emerald-400";
            else if (method === "Card") badgeColor = "bg-indigo-500/10 text-indigo-400";
            else if (method === "Cash") badgeColor = "bg-yellow-500/10 text-yellow-400";

            return `
                <div class="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all duration-300">

                    <!-- 🏦 Bank + Method -->
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-white/70 truncate">
                            ${bank.split("(")[0]}
                        </span>

                        <span class="px-2 py-0.5 rounded-full text-[9px] font-bold ${badgeColor}">
                            ${method}
                        </span>
                    </div>

                    <!-- 💰 Amount -->
                    <span class="text-xs font-black text-indigo-400">
                        ₹${total.toLocaleString()}
                    </span>

                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("renderBankStats error:", err);
    }
}

function renderTrend() {
    try {
        if (typeof Chart === "undefined") return;

        const canvas = document.getElementById('trendChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const data = getFilteredData();
        const last10 = data.slice(-10);

        const avgEl = document.getElementById('avgDaily');
        const peakEl = document.getElementById('peakSpend');
        const predEl = document.getElementById('predictedBalance');

        const healthEl = document.getElementById('spendingHealth');
        const healthBar = document.getElementById('healthBar');
        const hintEl = document.getElementById('healthHint');

        const burnText = document.getElementById("burnStatusText");
        const burnDot = document.getElementById("burnStatusDot");

        const predictBar = document.getElementById('predictiveBar');
        const container = document.getElementById('categoryIntensity');

        // ==============================
        // 📭 EMPTY STATE
        // ==============================
        if (!data.length) {
            if (avgEl) avgEl.innerText = "₹0";
            if (peakEl) peakEl.innerText = "₹0";
            if (predEl) predEl.innerText = "₹0";
            if (healthEl) healthEl.innerText = "No Data";
            if (container) container.innerHTML = "";
            return;
        }

        // ==============================
        // 📊 CALCULATIONS
        // ==============================
        const totalAll = data.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

        const total = last10.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const avg = last10.length ? Math.round(total / last10.length) : 0;
        const peak = last10.length ? Math.max(...last10.map(e => parseFloat(e.amount) || 0)) : 0;

        if (avgEl) avgEl.innerText = `₹${avg.toLocaleString()}`;
        if (peakEl) peakEl.innerText = `₹${peak.toLocaleString()}`;

        // ==============================
        // 🔥 SMART PREDICTION
        // ==============================
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysPassed = Math.max(1, today.getDate());

        const longAvg = totalAll / daysPassed;
        const shortAvg = avg;

        const dailyAvg = (longAvg * 0.7) + (shortAvg * 0.3);
        const predictedTotal = dailyAvg * daysInMonth;

        const predictedBalance = appData.budget > 0
            ? Math.round(appData.budget - predictedTotal)
            : 0;

        if (predEl) {
            predEl.innerText = `₹${predictedBalance.toLocaleString()}`;
        }

        if (predictBar) {
            const perc = appData.budget > 0
                ? Math.min(100, (predictedTotal / appData.budget) * 100)
                : 0;
            predictBar.style.width = perc + "%";
        }

        // ==============================
        // 📈 HEALTH
        // ==============================
        const percent = appData.budget > 0
            ? (totalAll / appData.budget) * 100
            : 0;

        const remaining = Math.max(0, 100 - percent);

        if (healthBar) healthBar.style.width = remaining + "%";

        if (healthEl && hintEl) {
            if (percent < 30) {
                healthEl.innerText = "Excellent";
                hintEl.innerText = "You're in top financial control 🚀";
            } else if (percent < 60) {
                healthEl.innerText = "Good";
                hintEl.innerText = "Spending is balanced 👍";
            } else if (percent < 90) {
                healthEl.innerText = "Warning";
                hintEl.innerText = "You're approaching your limit ⚠️";
            } else {
                healthEl.innerText = "Critical";
                hintEl.innerText = "High risk of overspending 🚨";
            }
        }

        // ==============================
        // 🔥 BURN STATUS
        // ==============================
        if (burnText && burnDot) {
            if (avg < 300) {
                burnText.innerText = "Low Spend";
                burnDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
            } else if (avg < 700) {
                burnText.innerText = "Moderate";
                burnDot.className = "w-2 h-2 rounded-full bg-yellow-400 animate-pulse";
            } else {
                burnText.innerText = "High Burn";
                burnDot.className = "w-2 h-2 rounded-full bg-red-400 animate-pulse";
            }
        }

        // ==============================
        // 📊 CATEGORY INTENSITY
        // ==============================
        if (container) {
            const cats = [...new Set(data.map(e => e.category || "Other"))];

            const colors = cats.map((_, i) => `hsl(${i * 60}, 70%, 60%)`);

            container.innerHTML = cats.map((c, i) => {
                const catTotal = data
                    .filter(e => (e.category || "").toLowerCase() === c.toLowerCase())
                    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

                const perc = totalAll > 0 ? (catTotal / totalAll) * 100 : 0;

                return `
                    <div>
                        <div class="flex justify-between text-[10px] font-black uppercase mb-2">
                            <span>${c}</span>
                            <span>₹${catTotal.toLocaleString()}</span>
                        </div>
                        <div class="w-full bg-white/5 h-2 rounded-full">
                            <div style="width:${perc}%;background:${colors[i]}" class="h-full rounded-full"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // ==============================
        // 📉 CHART FIX (MAIN ISSUE SOLVED)
        // ==============================
        if (trend instanceof Chart) {
            trend.destroy();
            trend = null;
       }
 
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(99,102,241,0.3)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');

        trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: last10.map((e, i) => {
                    if (!e.date) return `#${i+1}`;
                    const d = new Date(e.date + "T00:00:00");
                    return isNaN(d) ? `#${i+1}` : d.toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short"
                    });
                }),
                datasets: [{
                    data: last10.map(e => parseFloat(e.amount) || 0),
                    borderColor: '#6366f1',
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });

    } catch (err) {
        console.error("renderTrend error:", err);
    }
}

async function save() {
    let btn = null;

    try {
        // ==============================
        // 🔐 TOKEN CHECK
        // ==============================
        const token = localStorage.getItem("token");

        if (!token || token === "undefined" || token === "null") {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ==============================
        // 📥 INPUT FETCH
        // ==============================
        const nameEl = document.getElementById('name');
        const dateEl = document.getElementById('date');
        const catEl = document.getElementById('cat');
        const amtEl = document.getElementById('amt');
        const payEl = document.getElementById('payment');
        const bankEl = document.getElementById('bank');

        const inputBox = document.getElementById("catInputBox");
        const newInput = document.getElementById('newCatInput');

        // 🔥 IMPORTANT: STORE USER DATE
        const selectedDate = dateEl?.value;

        const obj = {
            date: selectedDate,
            name: nameEl?.value?.trim(),
            category: getSelectedCategory(),
            amount: parseFloat(amtEl?.value),
            paymentMethod: payEl?.value,
            bankName: bankEl?.value?.trim()
        };

        // ==============================
        // ⚠️ VALIDATION
        // ==============================
        if (!obj.name || !obj.category || isNaN(obj.amount) || obj.amount <= 0 || !obj.date) {
            showToast("⚠️ Enter valid data");
            return;
        }

        // ==============================
        // 🔘 BUTTON LOADING STATE
        // ==============================
        btn = document.getElementById("saveBtn");
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Saving...";
        }

        // ==============================
        // 🌐 API CALL
        // ==============================
        const res = await fetch(`${BASE_URL}/api/dashboard/expense`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(obj)
        });

        // ❌ Unauthorized
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ❌ Other error
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Save failed");
        }

        // ==============================
        // ✅ SUCCESS
        // ==============================
        showToast("✅ Expense added");

        // ==============================
        // 🧹 CLEAR FORM (EXCEPT DATE 🔥)
        // ==============================
        if (nameEl) nameEl.value = "";
        if (amtEl) amtEl.value = "";
        if (bankEl) bankEl.value = "";
        if (newInput) newInput.value = "";

        // ❗ DATE CLEAR NAHI KARNA
        // dateEl.value = ""; ❌ REMOVE THIS IF EXISTS

        // ==============================
        // 🔥 CATEGORY UI RESET
        // ==============================
        if (inputBox) inputBox.classList.add("hidden");
        if (catEl) {
            catEl.classList.remove("hidden");
            catEl.selectedIndex = 0;
        }

        // ==============================
        // 🔄 REFRESH DATA (WITH DATE PRESERVE)
        // ==============================
        sync();

        // 🔥 AFTER SYNC, RESTORE DATE
        setTimeout(() => {
            const dateInput = document.getElementById("date");
            if (dateInput && selectedDate) {
                dateInput.value = selectedDate;

                // 🔥 LOCK so auto overwrite na ho
                dateInput.dataset.locked = "true";
            }
        }, 300);

    } catch (err) {
        console.error("Save error:", err);
        showToast("❌ Failed to save");

    } finally {
        // ==============================
        // 🔁 BUTTON RESTORE
        // ==============================
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Add Expense";
        }
    }
}

function renderLedger() {
    try {
        const container = document.getElementById('ledgerBody');
        if (!container) return;

        const data = getFilteredData();

        // ==============================
        // 📭 EMPTY STATE
        // ==============================
        if (!data.length) {
            container.innerHTML = `
                <div class="text-center text-white/30 py-10">
                    <p class="text-sm font-semibold">No transactions yet</p>
                    <p class="text-xs mt-2">Start adding expenses to track your spending 🚀</p>
                </div>
            `;
            return;
        }

        // ==============================
        // 🔽 SORT (LATEST FIRST)
        // ==============================
        const sortedData = [...data].reverse();

        // ==============================
        // 📊 RENDER LEDGER
        // ==============================
        container.innerHTML = sortedData.map(e => {
            const name = escapeHTML(e.name || "Untitled");
            const category = escapeHTML(e.category || "Other");
            const amount = toNumber(e.amount).toLocaleString();

            return `
                <div class="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all duration-300 group">

                    <!-- 🔹 LEFT -->
                    <div class="flex items-center gap-3">
                        <span class="text-lg">${getEmo(category)}</span>
                        <div>
                            <p class="text-sm font-bold text-white group-hover:text-white/90">
                                ${name}
                            </p>
                            <p class="text-[10px] text-white/30 uppercase tracking-widest">
                                ${category} • ${e.payment_method || "N/A"} • ${e.bank_name || "N/A"} • ${e.date || "N/A"}
                            </p>
                        </div>
                    </div>

                    <!-- 🔹 RIGHT -->
                    <div class="flex items-center gap-5">

                        <!-- 💰 AMOUNT -->
                        <p class="text-sm font-black text-indigo-400">
                            ₹${amount}
                        </p>

                        <!-- ✏️ EDIT -->
                        <button onclick="editExpense(${e.id})"
                            class="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition opacity-0 group-hover:opacity-100">
                            Edit
                        </button>

                        <!-- 🗑️ DELETE -->
                        <button onclick="deleteExpense(${e.id})"
                            class="text-[10px] font-bold text-red-400 hover:text-red-300 transition opacity-0 group-hover:opacity-100">
                            Delete
                        </button>

                    </div>

                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("renderLedger error:", err);
    }
}

function renderFilteredLedger(data) {
    try {
        const container = document.getElementById('ledgerBody');
        if (!container) return;

        // ==============================
        // 🛡️ SAFE DATA CHECK
        // ==============================
        if (!Array.isArray(data) || data.length === 0) {
            container.innerHTML = `
                <div class="text-center text-white/30 py-10">
                    <p class="text-sm font-semibold">No results found</p>
                    <p class="text-xs mt-2">Try different search or filter 🔍</p>
                </div>
            `;
            return;
        }

        // ==============================
        // 🔽 SORT (LATEST FIRST)
        // ==============================
        const sorted = [...data].reverse();

        // ==============================
        // 📊 RENDER LIST (FINAL UI)
        // ==============================
        container.innerHTML = sorted.map(e => {
            const name = escapeHTML(e.name || "Untitled");
            const category = escapeHTML(e.category || "Other");
            const amount = (parseFloat(e.amount) || 0).toLocaleString();
            const payment = escapeHTML(e.payment_method || "N/A");
            const bank = escapeHTML(e.bank_name || "N/A");
            const date = escapeHTML(e.date || "N/A");

            return `
                <div class="flex justify-between items-center p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] transition-all duration-300">

                    <!-- 🔹 LEFT -->
                    <div class="flex items-center gap-3">
                        <span class="text-lg">${getEmo(category)}</span>
                        <div>
                            <p class="text-sm font-bold text-white">
                                ${name}
                            </p>
                            <p class="text-[10px] text-white/30 uppercase tracking-widest">
                                ${category} • ${payment} • ${bank} • ${date}
                            </p>
                        </div>
                    </div>

                    <!-- 🔹 RIGHT -->
                    <div class="flex items-center gap-4">

                        <!-- 💰 AMOUNT -->
                        <p class="text-sm font-black text-indigo-400">
                            ₹${amount}
                        </p>

                        <!-- ✏️ EDIT -->
                        <button onclick="editExpense(${e.id})"
                            class="px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 text-xs font-bold transition">
                            ✏️
                        </button>

                        <!-- 🗑️ DELETE -->
                        <button onclick="deleteExpense(${e.id})"
                            class="px-2 py-1 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-bold transition">
                            🗑️
                        </button>

                    </div>

                </div>
            `;
        }).join('');

    } catch (err) {
        console.error("renderFilteredLedger error:", err);
    }
}

async function deleteExpense(id) {
    if (!confirm("Delete this expense?")) return;

    try {
        // 🔥 1. REMOVE FROM MAIN DATA
        appData.rawData = (appData.rawData || []).filter(e => e.id !== id);

        // 🔥 2. REFRESH UI (FILTER AUTO APPLY)
        applyFilters();

        // 🔥 3. BACKEND DELETE
        await fetch(`${BASE_URL}/api/dashboard/expense/${id}`, {
            method: "DELETE",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });

        showToast("🗑️ Deleted successfully");

    } catch (err) {
        console.error(err);
        showToast("❌ Delete failed");

        sync(); // fallback
    }
}

async function editExpense(id) {

    const existing = appData.rawData.find(e => e.id === id);

    // 🔥 OLD VALUES (default ke liye)
    const name = prompt("Edit name:", existing?.name);
    const amount = prompt("Edit amount:", existing?.amount);
    const category = prompt("Category:", existing?.category);
    const paymentMethod = prompt("Payment:", existing?.payment_method);
    const bankName = prompt("Bank:", existing?.bank_name);

    // 🔥 DATE PROMPT (IMPORTANT)
    const date = prompt("Edit date (YYYY-MM-DD):", existing?.date);

    if (!name || !amount || !category || !date) {
        showToast("⚠️ All fields required");
        return;
    }

    const parsedAmount = Number(amount);

    if (isNaN(parsedAmount) || parsedAmount <= 0) {
        showToast("⚠️ Invalid amount");
        return;
    }

    try {

        const res = await fetch(`${BASE_URL}/api/dashboard/expense/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${localStorage.getItem("token")}`
            },
            body: JSON.stringify({
                name,
                amount: parsedAmount,
                category,
                paymentMethod,
                bankName,
                date // ✅ FIXED
            })
        });

        const text = await res.text();
        console.log(text);

        if (!res.ok) throw new Error(text);

        await sync();

        showToast("✅ Updated successfully");

    } catch (err) {
        console.error(err);
        showToast("❌ Update failed");
    }
}

// ==============================
// 💰 UPDATE BUDGET LIMIT
// ==============================
async function updateLimit() {
    let btn = null;

    try {
        // ✅ 1. Token check (strong)
        const token = localStorage.getItem("token");

        if (!token || token === "undefined" || token === "null") {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ✅ 2. Input safe handling
        const input = document.getElementById('newLimit');

        if (!input) {
            showToast("❌ Input not found");
            return;
        }

        let value = Number(input.value.trim());

        if (!value || value <= 0 || isNaN(value)) {
            showToast("⚠️ Please enter a valid amount");
            input.focus();
            return;
        }

        // ✅ 3. Button state
        btn = document.getElementById("limitBtn");
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Updating...";
        }

        // ✅ 4. API call
        const res = await fetch(`${BASE_URL}/api/dashboard/budget`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ amount: value })
        });

        // ❌ Unauthorized → logout
        if (res.status === 401 || res.status === 403) {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ❌ Other error
        if (!res.ok) {
            const text = await res.text();
            throw new Error(text || "Budget update failed");
        }

        // ✅ 5. Success
        showToast("✅ Your monthly budget has been set successfully!");

        // 🔥 Clear input AFTER success (better UX)
        input.value = "";

        // ✅ Refresh data
        sync();

    } catch (err) {
        console.error("Update limit error:", err);
        showToast("❌ Failed to update budget");

    } finally {
        // ✅ Restore button
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Set Limit ⚡";
        }
    }
}

function showToast(message) {
    const toast = document.getElementById("toastMsg");

    if (!toast) {
        alert(message);
        return;
    }

    toast.innerText = message;

    // reset state
    toast.classList.remove("hidden", "opacity-0", "translate-y-2");
    toast.classList.add("opacity-100", "translate-y-0");

    // auto hide
    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");

        setTimeout(() => {
            toast.classList.add("hidden");
        }, 300);
    }, 3000);
}

function renderSettings() {
    try {
        const profile = appData?.profile || {};
        const userName = profile.name || "User";
        const userTier = profile.tier || "Standard";
        const userStatus = profile.status || "ACTIVE";
        const userPlan = profile.plan || "FREE";
        const instance = profile.instance || "v2.1.0";

        // ==============================
        // 🧑 AVATAR GENERATION
        // ==============================

        const avatarUrl = `https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(userName)}`;

        const avatarMain = document.getElementById('user-avatar');
        const avatarSettings = document.getElementById('set-avatar');

        if (avatarMain) avatarMain.src = avatarUrl;
        if (avatarSettings) avatarSettings.src = avatarUrl;

        // ==============================
        // 👤 SIDEBAR PROFILE
        // ==============================

        const nameEl = document.getElementById('user-name');
        const tierEl = document.getElementById('user-tier');

        if (nameEl) nameEl.innerText = userName;
        if (tierEl) tierEl.innerText = userTier;

        // ==============================
        // ⚙️ SETTINGS PROFILE DETAILS
        // ==============================

        const setName = document.getElementById('set-name');
        const setTier = document.getElementById('set-tier');
        const setStatus = document.getElementById('set-status');
        const setPlan = document.getElementById('set-plan');

        if (setName) setName.innerText = userName;
        if (setTier) setTier.innerText = userTier;
        if (setStatus) setStatus.innerText = userStatus;
        if (setPlan) setPlan.innerText = userPlan;

        // ==============================
        // 💰 BUDGET SYNC
        // ==============================

        const budgetInput = document.getElementById('newLimit');
        if (budgetInput && document.activeElement !== budgetInput) {
            budgetInput.value = "";
        }

        // ==============================
        // 🧠 SYSTEM INFO
        // ==============================

        const instanceEl = document.getElementById('instance-text');
        if (instanceEl) {
            instanceEl.innerText = instance;
        }

        // ==============================
        // ✨ REMOVE LOADING SHIMMER
        // ==============================

        const shimmer = document.getElementById('avatar-shimmer');
        if (shimmer) shimmer.classList.add('hidden');

    } catch (err) {
        console.error("renderSettings error:", err);
    }
}

// ==============================
// 👋 REAL-TIME GREETING SYSTEM
// ==============================

function updateGreeting() {
    try {
        const el = document.getElementById("greetingText");
        if (!el) return;

        // 🔹 Time-based greeting
        const hour = new Date().getHours();
        let greeting = "Hello";

        if (hour < 12) greeting = "Good Morning ☀️";
        else if (hour < 17) greeting = "Good Afternoon 🌤️";
        else if (hour < 21) greeting = "Good Evening 🌙";
        else greeting = "Good Night 🌌";

        // 🔹 Backend name (IMPORTANT)
        const name = appData?.profile?.name || "User";

        // 🔹 Final output
        el.innerText = `${greeting}, ${name}`;

    } catch (err) {
        console.error("Greeting error:", err);
    }
}

// ==============================
// 🚀 AUTO RUN (REAL-TIME UPDATE)
// ==============================

// 1. Jab data load ho (sync ke baad call karo)
updateGreeting();

// 2. Har 1 minute update (real-time feel)
setInterval(updateGreeting, 60000);

function updateTodaySpend() {
    try {
        const el = document.getElementById("todaySpendText");
        if (!el) return;

        // ==============================
        // 📅 GET TODAY (LOCAL TIME SAFE)
        // ==============================

        const today = new Date();
        const todayStr = today.toLocaleDateString('en-CA'); // YYYY-MM-DD (safe)

        // ==============================
        // 💰 CALCULATE TODAY SPENDING
        // ==============================

        const todayTotal = (appData.rawData || [])
            .filter(e => {
                if (!e.date) return false;

                // Normalize date
                const entryDate = e.date;
                return entryDate === todayStr;
            })
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        // ==============================
        // 🎯 UX OUTPUT
        // ==============================

        if (todayTotal === 0) {
            el.innerText = "No spending today 🚀";
        } else {
            el.innerText = `You spent ₹${todayTotal.toLocaleString()} today 💸`;
        }

    } catch (err) {
        console.error("Today spend error:", err);
    }
}

function updateFinanceScore() {
    try {
        const el = document.getElementById("financeScore");
        if (!el) return;

        // ==============================
        // 🔥 FILTERED DATA
        // ==============================
        const data = Array.isArray(getFilteredData()) ? getFilteredData() : [];

        // ==============================
        // 📭 EMPTY CASE
        // ==============================
        if (!data.length) {
            el.innerText = "0";
            el.style.color = "#6b7280";
            el.style.textShadow = "none";
            return;
        }

        // ==============================
        // 💰 TOTAL SPENT (SAFE)
        // ==============================
        const total = data.reduce((s, e) => {
            const amt = Number(e.amount);
            return s + (isNaN(amt) ? 0 : amt);
        }, 0);

        // ==============================
        // 📊 SMART BUDGET (UNCHANGED)
        // ==============================
        let budget = Number(appData?.budget) || 0;
        const baseBudget = Number(appData?.budget) || 0; // 🔥 MAIN FIX BASE

        const now = new Date();
        const daysInMonth = new Date(
            now.getFullYear(),
            now.getMonth() + 1,
            0
        ).getDate();

        switch (currentFilters?.date) {
            case "today":
            case "yesterday":
                budget = budget / daysInMonth;
                break;

            case "6_months":
                budget *= 6;
                break;

            case "this_year":
            case "last_year":
                budget *= 12;
                break;
        }

        // ==============================
        // 📊 SAFETY CHECK
        // ==============================
        if (baseBudget <= 0) {
            el.innerText = "0";
            el.style.color = "#6b7280";
            el.style.textShadow = "none";
            return;
        }

        // ==============================
        // 📈 USAGE % (FINAL FIX)
        // ==============================
        const percent = (total / baseBudget) * 100;

        // ==============================
        // 🔥 STABILITY CHECK (SAFE)
        // ==============================
        const last5 = data.slice(-5);
        const prev5 = data.slice(-10, -5);

        const avgLast =
            last5.reduce((s, e) => s + (Number(e.amount) || 0), 0) /
            (last5.length || 1);

        const avgPrev =
            prev5.reduce((s, e) => s + (Number(e.amount) || 0), 0) /
            (prev5.length || 1);

        let stabilityPenalty = 0;

        if (prev5.length > 0 && avgLast > avgPrev * 1.5) {
            stabilityPenalty = 15;
        }

        // ==============================
        // 🔥 FINAL SCORE
        // ==============================
        let score = 100 - percent;

        score -= stabilityPenalty;

        score = Math.max(0, Math.min(100, Math.round(score)));

        // ==============================
        // 🎯 UI UPDATE
        // ==============================
        el.innerText = score;

        el.style.fontSize = "28px";
        el.style.fontWeight = "900";
        el.style.letterSpacing = "1px";

        if (score >= 75) {
            el.style.color = "#22c55e";
            el.style.textShadow = "0 0 12px rgba(34,197,94,0.7)";
        } 
        else if (score >= 50) {
            el.style.color = "#f59e0b";
            el.style.textShadow = "0 0 12px rgba(245,158,11,0.7)";
        } 
        else {
            el.style.color = "#ef4444";
            el.style.textShadow = "0 0 12px rgba(239,68,68,0.7)";
        }

    } catch (err) {
        console.error("finance score error:", err);
    }
}

function updateTrendAlert() {
    const last = [...(appData.rawData || [])].slice(-5);

    const total = last.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);

    const alertBox = document.getElementById("trendAlert");

    if (!alertBox) return;

    if (total > (appData.budget * 0.3)) {
        alertBox.classList.remove("hidden");
    } else {
        alertBox.classList.add("hidden");
    }
}

function openModal() {
    document.getElementById("confirmModal").classList.remove("hidden");
    document.getElementById("confirmInput").value = "";
}

function closeModal() {

    const modal = document.getElementById("confirmModal");
    const confirmInput = document.getElementById("confirmInput");
    const passwordInput = document.getElementById("deletePassword");
    const deleteBtn = document.getElementById("deleteBtn");

    // 🔒 Hide modal
    if (modal) {
        modal.classList.add("hidden");
    }

    // 🔄 Reset confirm input
    if (confirmInput) {
        confirmInput.value = "";
    }

    // 🔄 Reset password input
    if (passwordInput) {
        passwordInput.value = "";
        passwordInput.classList.add("hidden");
    }

    // 🔄 Disable delete button again
    if (deleteBtn) {
        deleteBtn.classList.add("disabled");
    }
}

// 🔥 FINAL DELETE LOGIC
async function confirmDelete() {

    const confirmInputEl = document.getElementById("confirmInput");
    const passwordInputEl = document.getElementById("deletePassword");

    if (!confirmInputEl || !passwordInputEl) {
        console.error("Inputs missing ❌");
        showToast("Something went wrong");
        return;
    }

    const input = confirmInputEl.value.trim().toLowerCase();

    // ✅ STEP 1: confirm check
    if (input !== "confirm") {
        showToast("❌ Please type 'confirm' to proceed");
        return;
    }

    // ✅ STEP 2: password field show karo
    if (passwordInputEl.classList.contains("hidden")) {
        passwordInputEl.classList.remove("hidden");
        passwordInputEl.focus();
        showToast("🔐 Enter your password");
        return; // ⚠️ yaha rukna zaroori hai
    }

    const password = passwordInputEl.value;

    // ✅ STEP 3: password empty check
    if (!password) {
        showToast("❌ Enter your password");
        return;
    }

    try {
        const token = localStorage.getItem("token");

        // 🔥 IMPORTANT CHANGE: new secure API
        const res = await fetch(`${BASE_URL}/api/dashboard/reset-secure`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ password }) // 🔥 password send
        });

        const data = await res.json();

        if (!res.ok) throw new Error(data.message);

        closeModal();

        resetDeleteModal();

        showToast("✅ All data erased successfully!");

        sync();

        // 🔥 optional hard refresh
        setTimeout(() => {
           window.location.reload();
        }, 1000);

    } catch (err) {
        console.error(err);
        showToast("❌ " + err.message);
    }
}

function resetDeleteModal() {
    const confirmInput = document.getElementById("confirmInput");
    const passwordInput = document.getElementById("deletePassword");

    if (confirmInput) confirmInput.value = "";
    
    if (passwordInput) {
        passwordInput.value = "";
        passwordInput.classList.add("hidden");
    }
}

// ✅ Attach events safely (single place)
window.addEventListener("load", () => {
    try {
        setTimeout(sync, 100);

        initSocket();
        initFilters();
        initPaymentAutoFill();
        renderCategories();

    } catch (err) {
        console.error("App init error:", err);
    }
});

let socket = null;

function initSocket() {
    try {
        if (typeof io === "undefined") {
            console.warn("Socket.io not loaded");
            return;
        }

        socket = io(BASE_URL, {
            transports: ["websocket"],
            reconnectionAttempts: 5
        });

        socket.on("connect", () => {
            console.log("✅ Realtime connected");
        });

        socket.on("disconnect", () => {
            console.warn("❌ Socket disconnected");
        });

        socket.on("expenseAdded", (data) => {
            console.log("📥 New expense:", data);

            appData.rawData.push(data);
            applyFilters();
        });

    } catch (err) {
        console.error("Socket init error:", err);
    }
}
// ==============================
// 🚀 INIT FILTERS (CALL ON LOAD)
// ==============================
function initFilters() {
    const searchBox = document.getElementById("searchBox");
    const method = document.getElementById("filterMethod");
    const date = document.getElementById("dateFilter");

    if (searchBox) {
        let timeout;
        searchBox.addEventListener("input", () => {
            clearTimeout(timeout);
            timeout = setTimeout(applyFilters, 300);
        });
    }

    if (method) {
        method.addEventListener("change", applyFilters);
    }

    if (date) {
        date.addEventListener("change", applyFilters);
    }
}

// ==============================
// 🎯 MAIN FILTER FUNCTION
// ==============================
function applyFilters() {
    try {
        const search = document.getElementById("searchBox")?.value.toLowerCase() || "";
        const method = document.getElementById("filterMethod")?.value || "";
        const dateType = document.getElementById("dateFilter")?.value || "all";

        currentFilters = { search, method, date: dateType };

        let data = appData.rawData || [];

        // 🔍 SEARCH FILTER
        if (search) {
            data = data.filter(e =>
                (e.name || "").toLowerCase().includes(search) ||
                (e.category || "").toLowerCase().includes(search)
            );
        }

        // 💳 PAYMENT FILTER
        if (method) {
            data = data.filter(e =>
                (e.payment_method || "") === method
            );
        }

        // 📅 DATE FILTER
        if (dateType !== "all") {
            data = filterByDate(data, dateType);
        }

        // ==============================
        // 🎨 RENDER
        // ==============================
        renderFilteredLedger(data);

        renderTrend();   // 🔥 important
        renderPie();     // already handled but safe
        renderBankStats();
        renderHeatmap();

        // 🔥 FULL DASHBOARD UPDATE
        updateDashboardWithFilteredData(data);
        
        renderDash(); 
        
        updateFinanceScore();  // 🔥 MUST
        
        renderPaymentAnalytics();
        


    } catch (err) {
        console.error("applyFilters error:", err);
    }
}

// ==============================
// 📅 DATE FILTER ENGINE (FINAL)
// ==============================
function filterByDate(data, type) {
    if (!Array.isArray(data)) return [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    return data.filter(item => {
        if (!item?.date) return false;

        const d = new Date(item.date);
        if (isNaN(d)) return false;

        const itemDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

        switch (type) {

            case "today":
                return itemDate.getTime() === today.getTime();

            case "yesterday":
                const y = new Date(today);
                y.setDate(today.getDate() - 1);
                return itemDate.getTime() === y.getTime();

            case "this_month":
                return itemDate.getMonth() === today.getMonth() &&
                       itemDate.getFullYear() === today.getFullYear();

            case "last_month":
                const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                return itemDate.getMonth() === lm.getMonth() &&
                       itemDate.getFullYear() === lm.getFullYear();

            case "6_months":
                const six = new Date(today);
                six.setMonth(today.getMonth() - 6);
                return itemDate >= six && itemDate <= today;

            case "this_year":
                return itemDate.getFullYear() === today.getFullYear();

            case "last_year":
                return itemDate.getFullYear() === today.getFullYear() - 1;

            default:
                return true;
        }
    });
}

function getFilteredData() {
    let data = appData.rawData || [];

    const { search, method, date } = currentFilters;

    // 🔍 SEARCH
    if (search) {
        data = data.filter(e =>
            (e.name || "").toLowerCase().includes(search) ||
            (e.category || "").toLowerCase().includes(search)
        );
    }

    // 💳 PAYMENT
    if (method) {
        data = data.filter(e =>
            (e.payment_method || "") === method
        );
    }

    // 📅 DATE
    if (date && date !== "all") {
        data = filterByDate(data, date);
    }

    return data;
}

// ==============================
// 📊 DASHBOARD SYNC (FILTERED)
// ==============================
function updateDashboardWithFilteredData(data) {

    // 💰 TOTAL SPENT
    const total = data.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

    const totalEl = document.getElementById("totalSpent");
    if (totalEl) totalEl.innerText = `₹${total.toLocaleString()}`;

    // 📊 PIE
    updatePieWithFilter(data);

    // 📈 TREND
    updateTrendWithFilter(data);
}

// ==============================
// 🥧 PIE CHART (FILTERED)
// ==============================
function updatePieWithFilter(data) {
    if (typeof Chart === "undefined") return;

    const cats = [...new Set(data.map(e => e.category || "Other"))];

    const vals = cats.map(c =>
        data
            .filter(e => (e.category || "").toLowerCase() === c.toLowerCase())
            .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0)
    );

    const total = vals.reduce((a, b) => a + b, 0);

    const totalEl = document.getElementById("pieTotal");
    if (totalEl) totalEl.innerText = `₹${total.toLocaleString()}`;

    const ctx = document.getElementById("pieChart")?.getContext("2d");
    if (!ctx) return;

    if (pie instanceof Chart) pie.destroy();

    pie = new Chart(ctx, {
        type: "doughnut",
        data: {
            datasets: [{
                data: vals,
                backgroundColor: cats.map((_, i) => `hsl(${i * 60},70%,60%)`)
            }]
        },
        options: {
            plugins: { legend: { display: false } }
        }
    });
}

// ==============================
// 📈 TREND CHART (FILTERED)
// ==============================
function updateTrendWithFilter(data) {
    if (!Array.isArray(data)) return;

    const last10 = data.slice(-10);

    const ctx = document.getElementById("trendChart")?.getContext("2d");
    if (!ctx) return;

    if (trend instanceof Chart) trend.destroy();

    trend = new Chart(ctx, {
        type: "line",
        data: {
            labels: last10.map(e => e.date || ""),
            datasets: [{
                data: last10.map(e => parseFloat(e.amount) || 0),
                borderColor: "#6366f1"
            }]
        }
    });
}

function initPaymentAutoFill() {
    const payment = document.getElementById("payment");
    const bank = document.getElementById("bank");

    if (!payment || !bank) return;

    // 🔥 Always keep blank
    bank.value = "";

    payment.addEventListener("change", function () {
        // 🔥 Har baar blank hi rahe
        bank.value = "";
    });
}

// ==============================
// 🔥 CATEGORY SYSTEM (PRO VERSION)
// ==============================

let defaultCategories = ["Food", "Bills", "Travel", "Party"];

// 🔹 Load from storage
let categories = JSON.parse(localStorage.getItem("categories")) || defaultCategories;

const catSelect = document.getElementById("cat");
const newInput = document.getElementById("newCatInput");
const catInputBox = document.getElementById("catInputBox");
const cancelBtn = document.getElementById("cancelCat");

// ==============================
// 🔹 Render Dropdown
// ==============================
function renderCategories(selectedValue = "") {
    const catSelect = document.getElementById("cat");
    const inputBox = document.getElementById("catInputBox");
    const input = document.getElementById("newCatInput");
    const cancelBtn = document.getElementById("cancelCat");

    if (!catSelect) return;

    // ==============================
    // 🛡️ SAFE CATEGORY ARRAY
    // ==============================
    const safeCategories = Array.isArray(categories) ? categories : [];

    // ==============================
    // 🔥 RENDER OPTIONS
    // ==============================
    catSelect.innerHTML =
        safeCategories.map(c =>
            `<option value="${c}">${c}</option>`
        ).join("") +
        `<option value="__add__">+ Add</option>`;

    // ==============================
    // ✅ RESTORE SELECTION
    // ==============================
    if (selectedValue && safeCategories.includes(selectedValue)) {
        catSelect.value = selectedValue;
    } else {
        catSelect.selectedIndex = 0;
    }

    // ==============================
    // 🔥 SINGLE EVENT (NO DUPLICATE)
    // ==============================
    catSelect.onchange = null;
    catSelect.onchange = function () {
        if (this.value === "__add__") {
            this.classList.add("hidden");
            inputBox?.classList.remove("hidden");
            input?.focus();
        }
    };

    // ==============================
    // ➕ ADD NEW CATEGORY (ENTER KEY)
    // ==============================
    if (input) {
        input.onkeydown = null;
        input.onkeydown = function (e) {
            if (e.key === "Enter") {
                const val = this.value.trim();

                if (!val) return;

                // prevent duplicate
                if (!safeCategories.includes(val)) {
                    categories.push(val);
                }

                this.value = "";

                // re-render with new selection
                renderCategories(val);
            }
        };
    }

    // ==============================
    // ❌ CANCEL BUTTON
    // ==============================
    if (cancelBtn) {
        cancelBtn.onclick = function () {
            inputBox?.classList.add("hidden");
            catSelect.classList.remove("hidden");
            catSelect.selectedIndex = 0;

            if (input) input.value = "";
        };
    }

    // ==============================
    // 🔄 RESET STATE (IMPORTANT)
    // ==============================
    inputBox?.classList.add("hidden");
    catSelect.classList.remove("hidden");
}

document.getElementById("cancelCat")?.addEventListener("click", () => {
    const cat = document.getElementById("cat");
    const inputBox = document.getElementById("catInputBox");

    inputBox.classList.add("hidden");
    cat.classList.remove("hidden");
    cat.value = "";
});

// ==============================
// 🔹 Handle "+ Add"
// ==============================
if (catSelect) {
    catSelect.addEventListener("change", function () {
        if (this.value === "__add__") {
            catSelect.classList.add("hidden");
            catInputBox?.classList.remove("hidden");
            newInput?.focus();
        }
    });
}

// ==============================
// 🔹 Add Category (ENTER)
// ==============================
if (newInput) {
    newInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
            let value = this.value.trim();

            if (!value) return;

            // 🔥 Normalize
            value = value.charAt(0).toUpperCase() + value.slice(1);

            // 🔥 Prevent duplicate
            if (!categories.includes(value)) {
                categories.push(value);

                // 🔥 Save
                localStorage.setItem("categories", JSON.stringify(categories));
            }

            // 🔥 Re-render with selected value
            renderCategories(value);

            // 🔥 Reset UI
            this.value = "";
            catInputBox?.classList.add("hidden");
            catSelect.classList.remove("hidden");
        }
    });
}

// ==============================
// 🔹 Cancel Button
// ==============================
if (cancelBtn) {
    cancelBtn.addEventListener("click", function () {
        catInputBox?.classList.add("hidden");
        catSelect.classList.remove("hidden");

        newInput.value = "";
        catSelect.selectedIndex = 0;
    });
}

// ==============================
// 🔹 Safe Getter (IMPORTANT)
// ==============================
function getSelectedCategory() {
    try {
        const select = document.getElementById("cat");
        const input = document.getElementById("newCatInput");
        const inputBox = document.getElementById("catInputBox");

        // ==============================
        // 🧠 CASE 1: Custom category input active
        // ==============================
        if (
            input &&
            inputBox &&
            !inputBox.classList.contains("hidden")
        ) {
            const val = input.value.trim();

            if (val.length > 0) {
                return val;
            }
        }

        // ==============================
        // 📌 CASE 2: Dropdown selected
        // ==============================
        if (select && select.value && select.value !== "") {
            return select.value.trim();
        }

        // ==============================
        // 🛡️ FALLBACK
        // ==============================
        return "Other";

    } catch (err) {
        console.error("getSelectedCategory error:", err);
        return "Other";
    }
}

// ==============================
// 🔹 Init
// ==============================
renderCategories();

function updateCoachText() {
    const textEl = document.getElementById("coachText");
    if (!textEl) return;

    const total = (Array.isArray(appData?.rawData) ? appData.rawData : [])
        .reduce((sum, item) => sum + (parseFloat(item?.amount) || 0), 0);
        
    const budget = appData.budget || 1;

    const percent = (total / budget) * 100;

    let msg = "";

    if (percent > 90) {
        msg = "⚠️ Critical overspending detected. Immediate correction required.";
    } else if (percent > 60) {
        msg = "⚡ Spending is rising. Consider optimizing your expenses.";
    } else if (percent > 30) {
        msg = "📊 You're maintaining a moderate spending pattern.";
    } else {
        msg = "🚀 Excellent financial discipline. Keep it up!";
    }

    textEl.innerText = msg;
}

function updateAnalyticsCards() {
    try {
        const data = getFilteredData();
        const budget = appData.budget || 0;

        const avgEl = document.getElementById("avgDaily");
        const peakEl = document.getElementById("peakSpend");
        const healthEl = document.getElementById("spendingHealth");
        const hintEl = document.getElementById("healthHint");
        const bar = document.getElementById("healthBar");
        const burnText = document.getElementById("burnStatusText");
        const burnDot = document.getElementById("burnStatusDot");

        if (!data.length) {
            if (avgEl) avgEl.innerText = "₹0";
            if (peakEl) peakEl.innerText = "₹0";
            return;
        }

        // ==============================
        // 📊 CALCULATIONS
        // ==============================
        const last10 = data.slice(-10);

        const total = last10.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        const avg = last10.length ? Math.round(total / last10.length) : 0;
        const peak = Math.max(...last10.map(e => parseFloat(e.amount)||0));

        if (avgEl) avgEl.innerText = `₹${avg.toLocaleString()}`;
        if (peakEl) peakEl.innerText = `₹${peak.toLocaleString()}`;

        // ==============================
        // 🔥 BURN STATUS
        // ==============================
        if (burnText && burnDot) {
            if (avg < 300) {
                burnText.innerText = "Low Spend";
                burnText.className = "text-[10px] font-bold uppercase text-emerald-400";
                burnDot.className = "w-2 h-2 rounded-full bg-emerald-400 animate-pulse";
            } else if (avg < 700) {
                burnText.innerText = "Moderate";
                burnText.className = "text-[10px] font-bold uppercase text-yellow-400";
                burnDot.className = "w-2 h-2 rounded-full bg-yellow-400 animate-pulse";
            } else {
                burnText.innerText = "High Burn";
                burnText.className = "text-[10px] font-bold uppercase text-red-400";
                burnDot.className = "w-2 h-2 rounded-full bg-red-400 animate-pulse";
            }
        }

        // ==============================
        // 📈 HEALTH SYSTEM
        // ==============================
        const totalAll = data.reduce((s,e)=>s+(parseFloat(e.amount)||0),0);
        const percent = budget > 0 ? (totalAll / budget) * 100 : 0;
        const remaining = Math.max(0, 100 - percent);

        if (bar) bar.style.width = remaining + "%";

        if (healthEl && hintEl) {
            if (percent < 30) {
                healthEl.innerText = "Excellent";
                hintEl.innerText = "You're in top control 🚀";
            } else if (percent < 60) {
                healthEl.innerText = "Good";
                hintEl.innerText = "Balanced spending 👍";
            } else if (percent < 90) {
                healthEl.innerText = "Warning";
                hintEl.innerText = "Approaching limit ⚠️";
            } else {
                healthEl.innerText = "Critical";
                hintEl.innerText = "Overspending risk 🚨";
            }
        }

    } catch (err) {
        console.error("Analytics Cards Error:", err);
    }
}

function logoutUser() {
    localStorage.removeItem("token");
    window.location.href = "../login/login.html";
}

// ================= SECURITY =================
async function changePassword() {
    let btn = null;

    try {
        // ==============================
        // 🔐 TOKEN CHECK
        // ==============================
        const token = localStorage.getItem("token");

        if (!token || token === "undefined" || token === "null") {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return;
        }

        // ==============================
        // 📥 INPUT FETCH
        // ==============================
        const oldPassEl = document.getElementById("oldPass");
        const newPassEl = document.getElementById("newPass");

        if (!oldPassEl || !newPassEl) {
            showToast("❌ Input fields not found");
            return;
        }

        const oldPass = oldPassEl.value?.trim();
        const newPass = newPassEl.value?.trim();

        // ==============================
        // ⚠️ VALIDATION
        // ==============================
        if (!oldPass || !newPass) {
            showToast("⚠️ Please fill all fields");
            return;
        }

        if (newPass.length < 6) {
            showToast("⚠️ Password must be at least 6 characters");
            return;
        }

        // ==============================
        // 🔘 BUTTON LOADING (SAFE)
        // ==============================
        btn = document.getElementById("changePassBtn");
        if (btn) {
            btn.disabled = true;
            btn.innerText = "Updating...";
        }

        // ==============================
        // 🌐 API CALL
        // ==============================
        const res = await fetch(`${BASE_URL}/api/dashboard/settings/change-password`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ oldPass, newPass })
        });

        // ==============================
        // ❌ AUTH ERROR (STOP EXECUTION)
        // ==============================
        if (res.status === 401 || res.status === 403) {
            showToast("Session expired");

            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
            return; // 🔥 IMPORTANT
        }

        // ==============================
        // 📦 SAFE RESPONSE HANDLE
        // ==============================
        let data = null;

        try {
            data = await res.json();
        } catch {
            showToast("❌ Invalid server response");
            return;
        }

        console.log("CHANGE PASSWORD RESPONSE:", data);

        // ==============================
        // ❌ BACKEND ERROR (PROPER MESSAGE)
        // ==============================
        if (!res.ok || !data?.success) {
            showToast(data?.message ?? "❌ Failed to change password");
            return;
        }

        // ==============================
        // ✅ SUCCESS
        // ==============================
        showToast("✅ Password changed successfully");

        // clear inputs
        oldPassEl.value = "";
        newPassEl.value = "";

        // 🔐 FORCE LOGOUT (SECURITY)
        setTimeout(() => {
            localStorage.removeItem("token");
            window.location.href = "../login/login.html";
        }, 1200);

    } catch (err) {
        console.error("Change password error:", err);
        showToast("❌ Server error, please try again");

    } finally {
        // ==============================
        // 🔁 BUTTON RESET (SAFE)
        // ==============================
        if (btn) {
            btn.disabled = false;
            btn.innerText = "Change Password";
        }
    }
}

async function logoutAllDevices() {
    try {
        await fetch(`${BASE_URL}/api/settings/logout-all`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${localStorage.getItem("token")}`
            }
        });
    } catch {
        console.warn("Logout API failed");
    }

    localStorage.removeItem("token");
    window.location.href = "../login/login.html";
}

// ================= EXPORT =================
function exportCSV() {
    try {
        // ==============================
        // 🔥 1. USE FILTERED DATA
        // ==============================
        const data = getFilteredData();

        if (!data.length) {
            showToast("⚠️ No data to export");
            return;
        }

        // ==============================
        // 📄 HEADERS
        // ==============================
        const headers = ["Name", "Amount", "Category", "Payment", "Bank", "Date"];

        // ==============================
        // 🧾 ROWS (SAFE FORMAT)
        // ==============================
        const rows = data.map(e => [
            `"${(e.name || "").replace(/"/g, '""')}"`,
            e.amount || 0,
            `"${(e.category || "").replace(/"/g, '""')}"`,
            `"${(e.payment_method || "").replace(/"/g, '""')}"`,
            `"${(e.bank_name || "").replace(/"/g, '""')}"`,
            e.date || ""
        ]);

        // ==============================
        // 🧠 ADD FILTER INFO (PRO)
        // ==============================
        const filterInfo = [`Filter: ${currentFilters.date || "all"}`];

        const csvContent = [
            filterInfo.join(","),
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        // ==============================
        // 📦 BLOB (BEST PRACTICE)
        // ==============================
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);

        // 🔥 dynamic filename
        link.download = `zivvi_${currentFilters.date || "all"}_expenses.csv`;

        link.click();

        showToast("📊 CSV Exported");

    } catch (err) {
        console.error("CSV export error:", err);
        showToast("❌ Export failed");
    }
}

async function exportPDF() {
    try {
        const token = localStorage.getItem("token");

        if (!token) {
            alert("Login required");
            return;
        }

        // 🔥 KEEP FETCH (structure same)
        const res = await fetch(`${BASE_URL}/api/dashboard`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const json = await res.json();

        // ==============================
        // 🔥 ONLY CHANGE: APPLY FILTER
        // ==============================
        const fullData = json.data?.rawData || [];
        const budget = json.data?.budget || 0;

        // 🔥 APPLY FILTER HERE
        let data = fullData;

        const { search, method, date } = currentFilters;

        // 🔍 search
        if (search) {
            data = data.filter(e =>
                (e.name || "").toLowerCase().includes(search) ||
                (e.category || "").toLowerCase().includes(search)
            );
        }

        // 💳 payment
        if (method) {
            data = data.filter(e =>
                (e.payment_method || "") === method
            );
        }

        // 📅 date
        if (date && date !== "all") {
            data = filterByDate(data, date);
        }

        // ==============================
        // बाकी code SAME है
        // ==============================

        if (!data.length) {
            alert("No data to export");
            return;
        }

        const total = data.reduce((s, e) => s + Number(e.amount), 0);
        const remaining = Math.max(0, budget - total);

        let rows = data.map((e, i) => `
            <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
                <td>${e.name}</td>
                <td>${e.category}</td>
                <td>₹${Number(e.amount).toLocaleString()}</td>
                <td>${e.payment_method || "-"}</td>
                <td>${e.bank_name || "-"}</td>
                <td>${new Date(e.date + "T00:00:00").toLocaleDateString("en-IN")}</td>
            </tr>
        `).join("");

const html = `
<html>
<head>
    <title>ZIVVI Report</title>

    <style>
        body {
            font-family: 'Segoe UI', sans-serif;
            padding: 40px;
            color: #111;
            background: #f8fafc;
        }

        /* 🔥 HEADER */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 12px;
        }

        .logo {
            font-size: 22px;
            font-weight: 800;
            color: #4f46e5;
        }

        .date {
            font-size: 12px;
            color: #6b7280;
        }

        /* 🔥 TITLE */
        .title {
            text-align: center;
            font-size: 30px;
            font-weight: 900;
            margin: 30px 0 10px;
        }

        .subtitle {
            text-align: center;
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 20px;
        }

        /* 🔥 SUMMARY CARDS */
        .summary {
            display: flex;
            gap: 15px;
            margin: 25px 0;
        }

        .card {
            flex: 1;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
            background: white;
            border: 1px solid #e5e7eb;
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }

        .card h3 {
            margin: 0;
            font-size: 22px;
            font-weight: 800;
        }

        .card p {
            margin-top: 5px;
            font-size: 12px;
            color: #6b7280;
        }

        .spent { border-top: 4px solid #ef4444; }
        .budget { border-top: 4px solid #6366f1; }
        .remaining { border-top: 4px solid #10b981; }

        /* 🔥 TABLE */
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 25px;
            font-size: 13px;
            background: white;
            border-radius: 12px;
            overflow: hidden;
        }

        th {
            background: #6366f1;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }

        td {
            padding: 10px;
            border-bottom: 1px solid #f1f5f9;
        }

        tr:nth-child(even) {
            background: #f9fafb;
        }

        /* 🔥 AMOUNT STYLE */
        .amount {
            font-weight: bold;
            color: #111;
        }

        /* 🔥 FOOTER */
        .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
        }

        /* 🔥 BADGES */
        .badge {
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 10px;
            font-weight: 600;
        }

        .upi { background: #eef2ff; color: #4f46e5; }
        .cardPay { background: #fef3c7; color: #92400e; }
        .cash { background: #ecfdf5; color: #065f46; }

    </style>
</head>

<body>

    <!-- 🔥 HEADER -->
    <div class="header">
        <div class="logo">⚡ ZIVVI</div>
        <div class="date">${new Date().toLocaleDateString()}</div>
    </div>

    <!-- 🔥 TITLE -->
    <div class="title">Expense Report</div>
    <div class="subtitle">Filtered View: ${currentFilters.date || "All Time"}</div>

    <!-- 🔥 SUMMARY -->
    <div class="summary">
        <div class="card spent">
            <h3>₹${total.toLocaleString()}</h3>
            <p>Total Spent</p>
        </div>
        <div class="card budget">
            <h3>₹${budget.toLocaleString()}</h3>
            <p>Budget</p>
        </div>
        <div class="card remaining">
            <h3>₹${remaining.toLocaleString()}</h3>
            <p>Remaining</p>
        </div>
    </div>

    <!-- 🔥 TABLE -->
    <table>
        <thead>
            <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Bank</th>
                <th>Date</th>
            </tr>
        </thead>
        <tbody>
            ${data.map((e, i) => `
                <tr>
                    <td>${e.name}</td>
                    <td>${e.category}</td>
                    <td class="amount">₹${Number(e.amount).toLocaleString()}</td>
                    <td>
                        <span class="badge ${
                            e.payment_method === "UPI" ? "upi" :
                            e.payment_method === "Card" ? "cardPay" :
                            "cash"
                        }">
                            ${e.payment_method || "-"}
                        </span>
                    </td>
                    <td>${e.bank_name || "-"}</td>
                    <td>${e.date}</td>
                </tr>
            `).join("")}
        </tbody>
    </table>

    <!-- 🔥 FOOTER -->
    <div class="footer">
        Generated by ZIVVI • Smart Finance Intelligence 🚀
    </div>

</body>
</html>
`;

        const win = window.open("", "_blank");
        win.document.write(html);
        win.document.close();

        setTimeout(() => {
            win.print();
            win.close();
        }, 500);

    } catch (err) {
        console.error(err);
        alert("PDF generation failed");
    }
}

function togglePassword(inputId, iconWrapper) {
    const input = document.getElementById(inputId);
    const icon = iconWrapper.querySelector("i");

    if (!input) return;

    if (input.type === "password") {
        input.type = "text";
        icon.setAttribute("data-lucide", "eye-off");
    } else {
        input.type = "password";
        icon.setAttribute("data-lucide", "eye");
    }

    // 🔥 Refresh icon
    if (window.lucide) {
        lucide.createIcons();
    }
}

// ================= THEME SYSTEM =================

// 🔥 Apply Theme
function applyTheme(theme) {
    try {
        const root = document.documentElement;

        // Remove old classes
        root.classList.remove("light", "dark");

        let finalTheme = theme;

        // 🔥 System mode handling
        if (theme === "system") {
            const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
            finalTheme = systemDark ? "dark" : "light";
        }

        // Apply class
        root.classList.add(finalTheme);

        // Save preference
        localStorage.setItem("theme", theme);

        // Debug (optional)
        console.log("Theme applied:", finalTheme);

    } catch (err) {
        console.error("Theme error:", err);
    }
}

// 🔥 Init Theme
function initTheme() {
    try {
        const select = document.getElementById("themeSelect");
        if (!select) return;

        // Load saved theme
        const saved = localStorage.getItem("theme") || "dark";

        // Apply immediately
        applyTheme(saved);

        // Sync dropdown
        select.value = saved;

        // Prevent duplicate binding
        select.onchange = null;

        // Handle change
        select.addEventListener("change", (e) => {
            const value = e.target.value;
            applyTheme(value);

            if (typeof showToast === "function") {
                showToast("🎨 Theme updated");
            }
        });

        // 🔥 Auto update when system theme changes
        const media = window.matchMedia("(prefers-color-scheme: dark)");

        media.addEventListener("change", () => {
            const current = localStorage.getItem("theme");

            if (current === "system") {
                applyTheme("system");
            }
        });

    } catch (err) {
        console.error("Init theme error:", err);
    }
}

// ==============================
// 🧠 AI SETTINGS (FINAL PRO VERSION)
// ==============================

const AI_KEY = "ai_enabled";

// 🔐 Safe token getter
function getSafeToken() {
    const token = localStorage.getItem("token");

    if (!token || token === "undefined" || token === "null") {
        localStorage.removeItem("token");
        return null;
    }

    return token;
}

// ==============================
// 🚀 UPDATE AI SETTINGS (SERVER + LOCAL)
// ==============================
async function updateAISettings(enabled) {
    const toggle = document.getElementById("smartToggle");

    try {
        const token = localStorage.getItem("token");

        if (!token) {
            showToast("⚠️ Login required");
            return;
        }

        toggle.disabled = true;

        const res = await fetch(`${BASE_URL}/api/dashboard/settings/ai`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ enabled })
        });

        console.log("STATUS:", res.status);

        if (!res.ok) {
            const text = await res.text();
            console.error("API ERROR:", text);
            throw new Error(text);
        }

        localStorage.setItem("ai_enabled", enabled);

        showToast(enabled ? "🤖 AI Enabled" : "🤖 AI Disabled");

        applyAIState(enabled);

    } catch (err) {
        console.error("AI ERROR:", err);

        toggle.checked = !enabled;

        showToast("❌ AI update failed");

    } finally {
        toggle.disabled = false;
    }
}

function updateAICoach(data) {
    try {
        // 🔥 SAFE DATA
        if (!data) data = getFilteredData();

        const insightEl = document.getElementById("aiInsight");
        const warningEl = document.getElementById("aiWarning");
        const tipsEl = document.getElementById("aiTips");
        const riskBar = document.getElementById("riskBar");
        const riskLabel = document.getElementById("riskLabel");

        if (!data || !data.length) {
            if (insightEl) insightEl.innerText = "No data available yet.";
            if (warningEl) warningEl.classList.add("hidden");
            if (tipsEl) tipsEl.innerHTML = "";
            return;
        }

        // ======================
        // 📊 TOTAL
        // ======================
        const total = data.reduce((sum, e) => sum + Number(e.amount || 0), 0);

        // ======================
        // 📅 UNIQUE DAYS (FIXED)
        // ======================
        const uniqueDays = new Set(
            data.map(e => {
                const d = new Date(e.date + "T00:00:00");
                return isNaN(d) ? "invalid" : d.toDateString();
            })
        );

        const days = Math.max(uniqueDays.size, 1);

        // ======================
        // 📊 DAILY AVG
        // ======================
        const dailyAvg = total / days;

        // ======================
        // 💰 LIMIT
        // ======================
        const limit = Number(appData.limit || appData.budget || 0);
        const remaining = Math.max(0, limit - total);

        // ======================
        // 🔮 PREDICTION (NEW)
        // ======================
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const daysPassed = Math.max(1, today.getDate());

        const smartAvg = total / daysPassed;
        const predictedTotal = smartAvg * daysInMonth;
        const diff = predictedTotal - limit;

        // ======================
        // 🧠 INSIGHT (UPGRADED)
        // ======================
        if (insightEl) {
            if (limit === 0) {
                insightEl.innerHTML = "⚠️ Set a monthly budget to unlock AI insights.";
            } 
            else if (predictedTotal > limit) {
                insightEl.innerHTML = `
                    ⚠️ You may exceed your budget by 
                    <span class="text-red-400 font-bold">₹${Math.round(diff).toLocaleString()}</span>
                `;
            } 
            else {
                insightEl.innerHTML = `
                    🚀 You're likely to save 
                    <span class="text-emerald-400 font-bold">₹${Math.abs(Math.round(diff)).toLocaleString()}</span>
                    this month
                `;
            }
        }

        // ======================
        // ⚠️ WARNING
        // ======================
        const daysLeft =
            dailyAvg > 0 ? Math.floor(remaining / dailyAvg) : 0;

        if (warningEl) {
            if (daysLeft < 7 && daysLeft > 0) {
                warningEl.classList.remove("hidden");
                warningEl.className =
                    "p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold";

                warningEl.innerHTML =
                    `⚠️ Budget may run out in <b>${daysLeft} days</b>`;
            } else {
                warningEl.classList.add("hidden");
            }
        }

        // ======================
        // 💡 TIPS (SMART UPGRADE)
        // ======================
        const tips = [];

        if (predictedTotal > limit) {
            tips.push("⚠️ Reduce daily spending");
            tips.push("📉 Cut unnecessary expenses");
        }

        if (dailyAvg > limit / 30 && limit > 0) {
            tips.push("📊 Your daily average is high");
        }

        if (remaining < limit * 0.3 && limit > 0) {
            tips.push("💰 Low budget remaining");
        }

        if (data.some(e => (e.payment || "").toLowerCase() === "card")) {
            tips.push("💳 Track card expenses");
        }

        if (total === 0) {
            tips.push("🚀 Start tracking your expenses");
        }

        if (tipsEl) {
            tipsEl.innerHTML = tips.map(t => `<div>${t}</div>`).join("");
        }

        // ======================
        // 📊 RISK (UNCHANGED)
        // ======================
        const usage = limit > 0 ? (total / limit) * 100 : 0;

        let color = "emerald";
        let label = "Safe";

        if (usage > 80) {
            color = "red";
            label = "High";
        } else if (usage > 50) {
            color = "yellow";
            label = "Medium";
        }

        if (riskLabel) riskLabel.innerText = label;

        if (riskBar) {
            riskBar.style.width = `${Math.min(usage, 100)}%`;

            riskBar.className = `h-full transition-all duration-700 ${
                color === "red"
                    ? "bg-red-500"
                    : color === "yellow"
                    ? "bg-yellow-400"
                    : "bg-emerald-400"
            }`;
        }

    } catch (err) {
        console.error("AI Coach Error:", err);
    }
}

// ==============================
// 🎯 APPLY AI STATE (UI CONTROL)
// ==============================
function applyAIState(enabled) {
    const insight = document.getElementById("smartInsightText");

    if (!insight) return;

    if (enabled) {
        renderPie(); // AI ON
        insight.style.opacity = "1";
        insight.style.filter = "none";
    } else {
        insight.innerText = "Smart Insights is OFF";
        insight.style.opacity = "0.5";
        insight.style.filter = "blur(1px)";
    }
}

// ================= UTIL =================
function getToken() {
    const token = localStorage.getItem("token");
    if (!token || token === "undefined" || token === "null") {
        localStorage.removeItem("token");
        window.location.href = "../login/login.html";
        return null;
    }
    return token;
}

// ================= SOCKET REAL-TIME =================
function initRealtime() {
    try {
        const token = getToken();
        if (!token) return;

        // 🔥 prevent duplicate connection
        if (socket && socket.connected) return;
        if (socket) socket.disconnect();

        socket = io(BASE_URL, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 2000,
            timeout: 5000
        });

        socket.on("connect", () => {
            console.log("🟢 Realtime connected");
        });

        socket.on("update", () => {
            console.log("🔄 Realtime update received");
            if (typeof sync === "function") sync();
        });

        socket.on("disconnect", () => {
            console.warn("🔴 Realtime disconnected");
        });

        socket.on("connect_error", (err) => {
            console.warn("⚠️ Socket error:", err.message);
        });

    } catch (err) {
        console.warn("Socket init failed:", err);
    }
}


// ================= AUTO START =================
document.addEventListener("DOMContentLoaded", () => {
    initSettingsPage();
    initRealtime(); // 🔥 ADD THIS
});

// ==============================
// ⚙️ INIT AI SETTINGS (LOAD)
// ==============================
function initAISettings() {
    const toggle = document.getElementById("smartToggle");
    if (!toggle) return;

    const saved = localStorage.getItem("ai_enabled") === "true";
    toggle.checked = saved;

    toggle.addEventListener("change", (e) => {
        localStorage.setItem("ai_enabled", e.target.checked);
        renderPie();
    });
}

// ==============================
// 🧩 SETTINGS PAGE INIT
// ==============================
function initSettingsPage() {
    try {
        initTheme();
        initNotificationToggles();
        initAISettings();
        initRealtime(); // 🔥 realtime start

    } catch (err) {
        console.error("Init error:", err);
    }
}

function initNotificationToggles() {
    try {
        console.log("Notification toggles initialized");

        const toggles = document.querySelectorAll(".toggle-input");

        toggles.forEach(t => {
            t.addEventListener("change", () => {
                console.log("Toggle changed:", t.checked);
            });
        });

    } catch (err) {
        console.error("initNotificationToggles error:", err);
    }
}

function getAdvancedIntensity(amount) {
    if (amount === 0) return "#020617";

    if (amount < 200) return "linear-gradient(135deg,#022c22,#064e3b)";
    if (amount < 500) return "linear-gradient(135deg,#064e3b,#065f46)";
    if (amount < 1000) return "linear-gradient(135deg,#065f46,#047857)";
    if (amount < 2000) return "linear-gradient(135deg,#047857,#059669)";

    return "linear-gradient(135deg,#10b981,#34d399)";
}

function groupByDate(data = []) {
    const map = Object.create(null);

    data.forEach(e => {
        if (!e || !e.date) return;

        const d = new Date(e.date);
        if (isNaN(d)) return;

        // 🔥 FIXED FORMAT (CRITICAL)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const amt = Number(e.amount) || 0;

        if (!map[key]) {
            map[key] = { total: 0, items: [] };
        }

        map[key].total += amt;
        map[key].items.push(e);
    });

    return map;
}

function groupByDate(data = []) {
    const map = Object.create(null);

    data.forEach(e => {
        if (!e || !e.date) return;

        const d = new Date(e.date);
        if (isNaN(d)) return;

        // 🔥 FIXED FORMAT (CRITICAL)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        const amt = Number(e.amount) || 0;

        if (!map[key]) {
            map[key] = { total: 0, items: [] };
        }

        map[key].total += amt;
        map[key].items.push(e);
    });

    return map;
}

function getMonthShort(index) {
    const months = [
        "JAN","FEB","MAR","APR","MAY","JUN",
        "JUL","AUG","SEP","OCT","NOV","DEC"
    ];
    return months[index] || "";
}

function getHeatColor(val) {
    if (!val) return "#111827"; // dark base

    if (val < 100) return "#22c55e";
    if (val < 500) return "#eab308";
    if (val < 1000) return "#f97316";

    return "#ef4444";
}

function buildTooltipHTML(d) {
    return `
        <div style="font-size:11px; color:#9ca3af; margin-bottom:4px; font-weight:600;">
            ${d.date}
        </div>

        <div style="font-size:18px; font-weight:900; color:#34d399; margin-bottom:8px;">
            ₹${d.total}
        </div>

        ${
            d.items.length
                ? d.items.map(i => `
                    <div style="
                        display:flex;
                        justify-content:space-between;
                        font-size:12px;
                        padding:4px 0;
                        border-bottom:1px solid rgba(255,255,255,0.06);
                    ">
                        <span style="color:#d1d5db;">
                            ${i.name || "Item"}
                        </span>
                        <span style="color:#818cf8; font-weight:700;">
                            ₹${parseFloat(i.amount) || 0}
                        </span>
                    </div>
                `).join('')
                : `<div style="color:#6b7280; font-size:12px;">No spending</div>`
        }
    `;
}

function renderHeatmap() {

    const container = document.getElementById("heatmapGrid");
    const tooltip = document.getElementById("heatmapTooltip");
    const monthsRow = document.getElementById("heatmapMonths");

    if (!container || !tooltip) return;

    const data = getFilteredData();
    const grouped = groupByDate(data);

    const today = new Date();

    const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

    const days = [];

    for (let i = 364; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);

        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

        days.push({
            date: key,
            total: grouped[key]?.total || 0,
            items: grouped[key]?.items || [],
            day: (d.getDay() + 6) % 7,
            month: d.getMonth()
        });
    }

    container.innerHTML = "";

    let col = document.createElement("div");
    col.className = "flex flex-col gap-[3px] flex-1";

    let lastMonth = -1;

    days.forEach((d, index) => {

        if (d.day === 0 && col.childElementCount > 0) {
            container.appendChild(col);
            col = document.createElement("div");
            col.className = "flex flex-col gap-[3px] flex-1";
        }

        const box = document.createElement("div");
        box.className = "heat-box";

        box.style.background = getHeatColor(d.total);

        if (d.date === todayStr) {
            box.classList.add("today-box");
        }

        attachHeatmapTooltip(box, tooltip, d);

        box.addEventListener("click", () => {
            if (!d.items.length) return;
            renderFilteredLedger(d.items);
        });

        col.appendChild(box);
    });

    container.appendChild(col);

    // ==============================
    // 🔥 FINAL MONTH FIX (PERFECT ALIGNMENT)
    // ==============================
    if (monthsRow) {

    monthsRow.innerHTML = "";

    const weeks = container.children;
    let shownMonths = new Set();

    for (let i = 0; i < weeks.length; i++) {

        // 🔥 RIGHT SIDE CALCULATION (IMPORTANT)
        const dayIndex = days.length - ((weeks.length - i) * 7);
        const d = days[dayIndex];

        const span = document.createElement("span");

        span.style.display = "inline-block";
        span.style.width = "14px";
        span.style.textAlign = "left";
        span.style.fontSize = "10px";
        span.style.color = "rgba(255,255,255,0.4)";

        if (d && !shownMonths.has(d.month)) {
            span.innerText = getMonthShort(d.month);
            shownMonths.add(d.month);
        } else {
            span.innerText = "";
        }

        monthsRow.appendChild(span);
    }
}
}

function attachHeatmapTooltip(box, tooltip, data) {

    const wrapper = document.getElementById("heatmapWrapper");

    box.addEventListener("mouseenter", () => {

        tooltip.innerHTML = buildTooltipHTML(data);
        tooltip.classList.remove("hidden");

        const boxRect = box.getBoundingClientRect();
        const wrapperRect = wrapper.getBoundingClientRect();
        const tipRect = tooltip.getBoundingClientRect();

        // 🔥 SCROLL OFFSET ADD (THIS IS THE REAL FIX)
        let scrollLeft = wrapper.scrollLeft;
        let scrollTop = wrapper.scrollTop;

        // 👉 RIGHT SIDE (FIXED)
        let left = boxRect.right - wrapperRect.left + scrollLeft + 10;

        // 👉 VERTICAL CENTER
        let top = boxRect.top - wrapperRect.top + scrollTop + (boxRect.height / 2) - (tipRect.height / 2);

        // 🔥 RIGHT OVERFLOW → LEFT SIDE
        if (left + tipRect.width > wrapper.scrollWidth) {
            left = boxRect.left - wrapperRect.left + scrollLeft - tipRect.width - 10;
        }

        // 🔥 TOP FIX
        if (top < 0) top = 0;

        // 🔥 BOTTOM FIX
        if (top + tipRect.height > wrapper.scrollHeight) {
            top = wrapper.scrollHeight - tipRect.height;
        }

        tooltip.style.left = left + "px";
        tooltip.style.top = top + "px";
    });

    box.addEventListener("mouseleave", () => {
        tooltip.classList.add("hidden");
    });
}

function initHeatmapRealtime() {

    setInterval(() => {
        renderHeatmap();
    }, 60000);

    const now = new Date();

    const msToMidnight =
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) - now;

    setTimeout(() => {
        renderHeatmap();
        initHeatmapRealtime();
    }, msToMidnight);
}

// ==============================
// 📘 USER GUIDE SYSTEM (FINAL)
// ==============================
const UserGuide = (() => {

    let bound = false; // 🔥 ONLY THIS NEEDED

    function init() {
        try {
            const container = document.getElementById("guideContainer");
            const toggleBtn = document.getElementById("toggleAllBtn");

            if (!container) return;

            // 🔥 PREVENT MULTIPLE BINDING
            if (bound) return;
            bound = true;

            // ==============================
            // 🔹 ACCORDION
            // ==============================
            container.addEventListener("click", (e) => {
                const header = e.target.closest(".guide-header");
                if (!header) return;

                const items = container.querySelectorAll(".guide-item");

                const item = header.parentElement;
                const isOpen = item.classList.contains("active");

                items.forEach(i => {
                    i.classList.remove("active");
                    updateArrow(i, false);
                });

                if (!isOpen) {
                    item.classList.add("active");
                    updateArrow(item, true);
                }

                if (toggleBtn) toggleBtn.innerText = "Expand All";
            });

            // ==============================
            // 🔹 TOGGLE ALL (FINAL FIX)
            // ==============================
            if (toggleBtn) {
                toggleBtn.addEventListener("click", () => {

                    const items = container.querySelectorAll(".guide-item");

                    // 🔥 TEXT BASED LOGIC (MOST STABLE)
                    const shouldExpand = toggleBtn.innerText.trim() === "Expand All";

                    items.forEach(i => {
                        i.classList.toggle("active", shouldExpand);
                        updateArrow(i, shouldExpand);
                    });

                    toggleBtn.innerText = shouldExpand ? "Collapse All" : "Expand All";
                });
            }

            // ==============================
            // 🔹 ESC KEY CLOSE
            // ==============================
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    const items = container.querySelectorAll(".guide-item");

                    items.forEach(i => {
                        i.classList.remove("active");
                        updateArrow(i, false);
                    });

                    if (toggleBtn) toggleBtn.innerText = "Expand All";
                }
            });

            // ==============================
            // 🔹 AUTO OPEN FIRST
            // ==============================
            const items = container.querySelectorAll(".guide-item");

            if (items.length > 0) {
                items[0].classList.add("active");
                updateArrow(items[0], true);
            }

            // ==============================
            // 🔹 DATE
            // ==============================
            const dateEl = document.getElementById("guideUpdated");
            if (dateEl) {
                dateEl.innerText = new Date().toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
            }

        } catch (err) {
            console.error("UserGuide Error:", err);
        }
    }

    // ==============================
    // 🔹 ARROW CONTROL
    // ==============================
    function updateArrow(item, isOpen) {
        const arrow = item.querySelector(".arrow");
        if (!arrow) return;

        arrow.innerText = isOpen ? "−" : "+";
        arrow.style.transform = isOpen ? "rotate(180deg)" : "rotate(0deg)";
    }

    return { init };

})();

function initSessionTracker() {
    try {
        const token = localStorage.getItem("token");
        if (!token) return;

        const payload = JSON.parse(atob(token.split(".")[1]));

        if (!payload.exp || !payload.iat) return;

        const exp = payload.exp * 1000;
        const iat = payload.iat * 1000;
        const total = exp - iat;

        const timerEl = document.getElementById("sessionTimer");
        const statusEl = document.getElementById("sessionStatus");
        const warnEl = document.getElementById("sessionWarning");
        const progressEl = document.getElementById("sessionProgress");
        const percentEl = document.getElementById("sessionPercent");

        let warned5Min = false;
        let warned1Min = false;
        let expiredHandled = false;

        // ==============================
        // 🧠 FORMAT TIME
        // ==============================
        function formatTime(ms) {
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
        }

        // ==============================
        // 🎨 UPDATE STATUS UI
        // ==============================
        function setStatus(type) {
            if (!statusEl) return;

            if (type === "active") {
                statusEl.innerHTML = `
                    <span class="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
                    ACTIVE
                `;
                statusEl.className =
                    "flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
            }

            if (type === "expiring") {
                statusEl.innerHTML = `
                    <span class="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse"></span>
                    EXPIRING
                `;
                statusEl.className =
                    "flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20";
            }

            if (type === "expired") {
                statusEl.innerHTML = `
                    <span class="w-1.5 h-1.5 bg-red-400 rounded-full"></span>
                    EXPIRED
                `;
                statusEl.className =
                    "flex items-center gap-1 text-[10px] font-bold px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20";
            }
        }

        // ==============================
        // ⏱ MAIN TIMER LOOP
        // ==============================
        function updateTimer() {
            const now = Date.now();
            const diff = exp - now;

            // 🔴 EXPIRED
            if (diff <= 0) {
                if (!expiredHandled) {
                    expiredHandled = true;

                    if (timerEl) timerEl.innerText = "00:00";
                    setStatus("expired");

                    if (progressEl) progressEl.style.width = "0%";
                    if (percentEl) percentEl.innerText = "0%";

                    showToast("🔐 Session expired. Logging out...");

                    setTimeout(() => logoutUser(), 1500);
                }
                return;
            }

            // ⏱ TIMER
            if (timerEl) timerEl.innerText = formatTime(diff);

            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);

            // 📊 PROGRESS CALCULATION
            const percent = Math.max((diff / total) * 100, 0);

            if (progressEl) progressEl.style.width = percent + "%";
            if (percentEl) percentEl.innerText = Math.round(percent) + "%";

            // 🟡 EXPIRING (UNDER 5 MIN)
            if (mins < 5) {
                if (!warned5Min) {
                    warned5Min = true;

                    if (warnEl) warnEl.classList.remove("hidden");
                    setStatus("expiring");

                    // subtle animation
                    if (timerEl) timerEl.classList.add("animate-pulse");
                }
            }

            // 🚨 1 MIN ALERT
            if (mins === 1 && secs === 0 && !warned1Min) {
                warned1Min = true;
                showToast("⚠️ Session ending in 1 minute");
            }

            // 🟢 NORMAL STATE
            if (mins >= 5) {
                setStatus("active");

                if (timerEl) timerEl.classList.remove("animate-pulse");
            }
        }

        // ==============================
        // 🚀 INIT
        // ==============================
        updateTimer();

        const interval = setInterval(() => {
            updateTimer();

            if (expiredHandled) {
                clearInterval(interval);
            }
        }, 1000);

    } catch (err) {
        console.error("Session tracker error:", err);
    }
}

function initLiveDateTime() {
    try {
        const timeEl = document.getElementById("liveTime");
        const dateEl = document.getElementById("liveDate");

        if (!timeEl || !dateEl) return;

        function update() {
            const now = new Date();

            // ⏱ TIME (12hr format)
            const time = now.toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: true
            });

            // 📅 DATE
            const date = now.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "2-digit",
                month: "short",
                year: "numeric"
            });

            timeEl.innerText = time;
            dateEl.innerText = date;
        }

        update(); // initial
        setInterval(update, 1000); // live

    } catch (err) {
        console.error("Live time error:", err);
    }
}

 
//NEW FEATURES BELOW

function renderPaymentAnalytics() {
    try {
        if (typeof Chart === "undefined") return;

        // ==============================
        // 🔥 GET FILTERED DATA (IMPORTANT)
        // ==============================
        let data = getFilteredData();

        // fallback safety
        if (!Array.isArray(data)) data = [];

        // ==============================
        // 📭 EMPTY STATE
        // ==============================
        if (!data.length) {
            const container = document.getElementById("paymentStats");
            if (container) {
                container.innerHTML = `
                    <div class="text-center text-white/30 text-xs py-6">
                        No payment data available
                    </div>
                `;
            }

            if (window.paymentChartInstance) {
                window.paymentChartInstance.destroy();
                window.paymentChartInstance = null;
            }

            return;
        }

        // ==============================
        // 📊 CALCULATE TOTALS
        // ==============================
        const methods = { UPI: 0, Card: 0, Cash: 0 };

        data.forEach(e => {
            const method = (e.payment_method || "").trim();
            const amt = parseFloat(e.amount) || 0;

            if (methods.hasOwnProperty(method)) {
                methods[method] += amt;
            }
        });

        const labels = Object.keys(methods);
        const values = Object.values(methods);
        const total = values.reduce((a, b) => a + b, 0);

        // ==============================
        // 📊 CHART SETUP
        // ==============================
        const canvas = document.getElementById("paymentChart");
        if (!canvas) return;

        const ctx = canvas.getContext("2d");

        if (window.paymentChartInstance) {
            window.paymentChartInstance.destroy();
        }

        // ==============================
        // 🔥 CENTER TEXT PLUGIN
        // ==============================
const centerTextPlugin = {
    id: "centerText",

    afterDraw(chart) {
        const { width, height, ctx } = chart;

        ctx.save();

        // 🔥 CRITICAL FIX (hover pe fade / color change issue)
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";

        // 🔥 LIGHT MODE DETECT (SAFE)
        const isLight =
            document.documentElement.classList.contains("light") ||
            document.body.classList.contains("light");

        // 🔥 MAIN AMOUNT
        ctx.font = "bold 20px sans-serif";
        ctx.fillStyle = isLight ? "#0f172a" : "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`₹${total.toLocaleString()}`, width / 2, height / 2 - 6);

        // 🔥 LABEL
        ctx.font = "10px sans-serif";
        ctx.fillStyle = isLight ? "#475569" : "#888";
        ctx.fillText("Total Spend", width / 2, height / 2 + 14);

        ctx.restore();
    }
};

        // ==============================
        // 📊 CREATE CHART
        // ==============================
        window.paymentChartInstance = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: ["#10b981", "#6366f1", "#f59e0b"],
                    borderWidth: 0,
                    cutout: "75%"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                return `₹${context.raw.toLocaleString()}`;
                            }
                        }
                    }
                }
            },
            plugins: [centerTextPlugin]
        });

        // ==============================
        // 🏆 MOST USED METHOD
        // ==============================
        const maxIndex = values.indexOf(Math.max(...values));
        const topMethod = labels[maxIndex];
        const topPercent = total
            ? ((values[maxIndex] / total) * 100).toFixed(1)
            : 0;

        // ==============================
        // 📊 RENDER STATS
        // ==============================
        const container = document.getElementById("paymentStats");
        if (!container) return;

        container.innerHTML = `
            <div class="text-[11px] text-indigo-400 font-bold mb-3">
                💳 Most Used: ${topMethod} (${topPercent}%)
            </div>

            ${labels.map((m, i) => {
                const val = values[i];
                const perc = total ? ((val / total) * 100).toFixed(1) : 0;

                return `
                    <div class="flex justify-between text-xs py-1 border-b border-white/5">
                        <span class="text-white/60">${m}</span>
                        <span class="text-indigo-400 font-bold">
                            ₹${val.toLocaleString()} (${perc}%)
                        </span>
                    </div>
                `;
            }).join("")}

            <div class="text-[10px] text-white/40 mt-4 italic">
                💡 ${
                    topPercent > 85
                        ? `High reliance on ${topMethod}. Consider balancing usage`
                        : `You mostly use ${topMethod} for payments`
                }
            </div>
        `;

    } catch (err) {
        console.error("Payment Analytics error:", err);
    }
}



// ==========================
// 🤖 TOGGLE CHATBOT
// ==========================
function toggleChatbot(){
  const panel = document.getElementById("chatPanel");

  if(panel.classList.contains("hidden")){
    panel.classList.remove("hidden");

    setTimeout(()=>{
      panel.classList.remove("scale-95","opacity-0");
      panel.classList.add("scale-100","opacity-100");
    },10);

  } else {
    panel.classList.add("scale-95","opacity-0");

    setTimeout(()=>{
      panel.classList.add("hidden");
    },200);
  }
}

function useSuggestion(text){
  document.getElementById("chatInput").value = text;
}

// ==========================
// 💬 SEND MESSAGE (FINAL)
// ==========================
async function sendMessage(){

  const input = document.getElementById("chatInput");
  const box = document.getElementById("chatMessages");

  let msg = input.value.trim();
  if(!msg) return;

  appendMessage("user", msg);
  input.value = "";

  showTyping();

  try {

    const res = await fetch(`${BASE_URL}/api/chatbot/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + localStorage.getItem("token")
      },
      body: JSON.stringify({ message: msg })
    });

    if(!res.ok){
      removeTyping();
      appendMessage("bot", "⚠️ Server error. Try again.");
      return;
    }

    // ==========================
    // 🤖 BOT MESSAGE CREATE
    // ==========================
    const botId = "bot-" + Date.now();

    appendMessage("bot", "", botId);

    const bubble = document.getElementById(botId);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let fullText = "";
    let typingRemoved = false;

    while(true){

      const { done, value } = await reader.read();
      if(done) break;

      const chunk = decoder.decode(value, { stream: true });

      if(!typingRemoved){
        removeTyping();
        typingRemoved = true;
      }

      fullText += chunk;
      fullText = fullText.replace(/\s+/g, " ");

      bubble.innerHTML = formatMessage(fullText);

      box.scrollTo({
        top: box.scrollHeight,
        behavior: "smooth"
      });

    }

  } catch (err) {

    console.error(err);
    removeTyping();
    appendMessage("bot", "⚠️ Network error. Please try again.");

  }
}

function formatMessage(text){

  return text
    .replace(/\n/g, "<br>")
    .replace(/₹(\d+)/g, "<span class='text-indigo-400 font-bold'>₹$1</span>")
    .replace(/⚠️|🚨/g, "<span class='text-yellow-400'>$&</span>")
    .replace(/✅/g, "<span class='text-green-400'>$&</span>")
    .replace(/💡/g, "<span class='text-purple-400'>$&</span>");
}

// ==========================
// 🧱 MESSAGE RENDER
// ==========================
function appendMessage(type, text, id=null){

  const box = document.getElementById("chatMessages");

  const html = type === "user"
    ? createUserMessage(text)
    : createBotMessage(text, id);

  box.insertAdjacentHTML("beforeend", html);
  box.scrollTop = box.scrollHeight;
}

function createBotMessage(text, id){

  return `
  <div class="flex gap-3 items-start animate-[fadeIn_0.25s_ease]">

    <!-- avatar -->
    <div class="w-9 h-9 flex items-center justify-center rounded-xl 
                bg-gradient-to-br from-indigo-500 to-purple-600 text-xs shadow-md">
      🤖
    </div>

    <!-- message -->
    <div class="flex flex-col gap-1 max-w-[80%]">

      <span class="text-[10px] text-indigo-400 font-bold tracking-widest uppercase">
        Zivvi AI
      </span>

      <div id="${id || ""}"
           class="px-4 py-3 rounded-2xl 
                  bg-gradient-to-br from-white/[0.08] to-white/[0.03]
                  border border-white/10 backdrop-blur-xl 
                  text-white/90 leading-relaxed
                  shadow-[0_6px_30px_rgba(0,0,0,0.4)]
                  whitespace-pre-line">
        ${formatMessage(text)}
      </div>

    </div>

  </div>
  `;
}

function createUserMessage(text){
  return `
  <div class="self-end max-w-[70%]">

    <div class="
      px-4 py-2
      rounded-2xl
      bg-gradient-to-br from-indigo-500 to-purple-600
      text-white text-sm

      inline-block
      break-words
    ">
      ${text}
    </div>

  </div>
  `;
}

// ==========================
// ✨ TYPING ANIMATION
// ==========================
function showTyping(){

  const box = document.getElementById("chatMessages");

  const typing = document.createElement("div");
  typing.id = "typingBubble";

  typing.innerHTML = `
    <div class="flex items-center gap-2 text-white/40 text-xs">
      🤖 typing
      <span class="dot"></span>
      <span class="dot"></span>
      <span class="dot"></span>
    </div>
  `;

  box.appendChild(typing);
  box.scrollTop = box.scrollHeight;
}

function removeTyping(){
  const t = document.getElementById("typingBubble");
  if(t) t.remove();
}

// ==========================
// ⌨️ ENTER KEY SUPPORT
// ==========================
document.getElementById("chatInput").addEventListener("keypress", function(e){
  if(e.key === "Enter"){
    sendMessage();
  }
});

// ==========================
// 🔥 AUTO SCROLL FIX (SMOOTH)
// ==========================
const observer = new MutationObserver(() => {
  const box = document.getElementById("chatMessages");
  box.scrollTop = box.scrollHeight;
});

observer.observe(document.getElementById("chatMessages"), {
  childList: true
});

