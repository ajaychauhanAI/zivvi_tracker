const express = require("express");
const router = express.Router();
const auth = require("../middleware/authMiddleware");
const pool = require("../db");

// ===============================
// 🧠 CONTEXT MEMORY (SMART)
// ===============================
const userContext = new Map();

function getMemory(userId){
    return userContext.get(userId) || {
        lastIntent: null,
        lastEntities: {},
        history: []
    };
}

function updateMemory(userId, intent, entities){
    const mem = getMemory(userId);

    mem.lastIntent = intent;

    mem.lastEntities = {
        ...mem.lastEntities,
        ...entities
    };

    mem.history.push({
        intent,
        entities,
        time: Date.now()
    });

    if(mem.history.length > 10){
        mem.history.shift();
    }

    userContext.set(userId, mem);

    return mem;
}

// ===============================
// 🔍 PREPROCESS
// ===============================
function preprocess(msg = ""){
    return msg.toLowerCase()
        .replace(/[^\w₹\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

// ===============================
// 🌐 LANGUAGE DETECTION
// ===============================
function detectLanguage(msg){
    const hinglish = /(kya|kitna|mera|hai|karu|bacha|kharcha)/;
    return hinglish.test(msg) ? "HINGLISH" : "ENGLISH";
}

// ===============================
// 🧠 ENTITY EXTRACTION (ADVANCED)
// ===============================
function extractEntities(msg){

    const entities = {};

    // ======================
    // 💰 ADVANCED AMOUNT DETECTION
    // ======================
    const amountPatterns = [
        /₹\s*(\d+)/,          // ₹200
        /(\d+)\s*rs/,        // 200 rs
        /rs\s*(\d+)/,        // rs 200
        /(\d+)/              // fallback
    ];

    for(let pattern of amountPatterns){
        const match = msg.match(pattern);
        if(match){
            entities.amount = Number(match[1]);
            break;
        }
    }

    // ======================
    // 🏷️ CATEGORY (SMART MATCH)
    // ======================
    const categories = {
        food: ["food","khana","eat"],
        travel: ["travel","uber","ola","bus"],
        shopping: ["shopping","buy","amazon"],
        fuel: ["fuel","petrol","diesel"],
        grocery: ["grocery","ration"],
        health: ["medicine","doctor"],
        bill: ["bill","electricity","wifi"]
    };

    for(let key in categories){
        if(categories[key].some(word => msg.includes(word))){
            entities.category = key;
        }
    }

    // ======================
    // ⏰ TIME
    // ======================
    if(msg.includes("today") || msg.includes("aaj")) entities.time="today";
    if(msg.includes("week")) entities.time="week";
    if(msg.includes("month")) entities.time="month";

    return entities;
}

// ===============================
// 🧠 INTENT ENGINE (ULTRA ADVANCED)
// ===============================
function detectIntent(msg, entities){

    const score = {
        ADD_EXPENSE: 0,
        ANALYTICS: 0,
        BALANCE: 0,
        ADVICE: 0,
        GREETING: 0
    };

    if(/add|spent|pay|kharcha/.test(msg)) score.ADD_EXPENSE += 2;
    if(/kitna|total|report|analysis/.test(msg)) score.ANALYTICS += 2;
    if(/balance|bacha|remaining/.test(msg)) score.BALANCE += 2;
    if(/save|advice|suggest/.test(msg)) score.ADVICE += 2;
    if(/hi|hello|hey|namaste/.test(msg)) score.GREETING += 2;

    if(entities.amount) score.ADD_EXPENSE += 3;

    return Object.keys(score).reduce((a,b)=> score[a]>score[b]?a:b);
}

// ===============================
// 📊 ANALYSIS ENGINE
// ===============================
function analyze(total, budget){
    const ratio = total/(budget||1);

    if(ratio > 1) return "OVER";
    if(ratio > 0.7) return "WARNING";
    return "GOOD";
}

// ===============================
// 🧠 CONTEXT ENGINE
// ===============================
function getContext(userId){
    return userContext.get(userId) || {};
}

function setContext(userId, data){
    userContext.set(userId, data);
}

function getSmartInsight(data){

    const { total, budget } = data;

    if(total === 0){
        return "🚀 Start tracking your expenses";
    }

    const percent = (total/(budget||1))*100;

    if(percent > 100){
        return "🚨 Budget cross ho gaya!";
    }

    if(percent > 80){
        return "⚠️ Budget ke bahut close ho";
    }

    if(percent < 30){
        return "🔥 Aapka control bahut accha hai";
    }

    return "📊 Spending balanced hai";
}

// ===============================
// 💬 RESPONSE ENGINE (PRO LEVEL)
// ===============================
function generateReply(intent, lang, data, entities = {}, context = {}){

    const { total = 0, budget = 0 } = data || {};
    const balance = budget - total;
    const status = analyze(total, budget);

    const isHi = lang === "HINGLISH";

    // ============================
    // 🎯 SAFE VALUES
    // ============================
    const amount = entities.amount ?? null;
    const category = entities.category ?? "";
    const hasAmount = amount !== null && !isNaN(amount);

    // ============================
    // 🎲 RANDOMIZER (Human feel)
    // ============================
    const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // ============================
    // 📊 STATUS MESSAGE
    // ============================
    const statusMsg = {
        OVER: isHi
            ? "🚨 Aap budget cross kar chuke ho!"
            : "🚨 You have exceeded your budget!",
        WARNING: isHi
            ? "⚠️ Budget ke bahut close ho."
            : "⚠️ You are close to your budget.",
        GOOD: isHi
            ? "✅ Sab control me hai."
            : "✅ Everything is under control."
    };

    // ============================
    // 💬 RESPONSES
    // ============================
    const t = {

        greet: pick(
            isHi
            ? [
                "👋 Hey! Main Zivvi hoon, aapka finance assistant.",
                "👋 Namaste! Main aapki madad karne ke liye hoon.",
                "👋 Hello! Chaliye aaj ke expenses track karte hain."
            ]
            : [
                "👋 Hello! I'm Zivvi, your finance assistant.",
                "👋 Hi there! Let's track your expenses.",
                "👋 Welcome! I'm here to manage your finances."
            ]
        ),

        balance: isHi
            ? `💰 Aapke paas abhi ₹${balance} bacha hai.`
            : `💰 You currently have ₹${balance} remaining.`,

        analytics: isHi
            ? total === 0
                ? "📊 Abhi tak koi expense record nahi hua."
                : `📊 Aapne total ₹${total} spend kiya hai. ${statusMsg[status]}`
            : total === 0
                ? "📊 No expenses recorded yet."
                : `📊 You have spent ₹${total}. ${statusMsg[status]}`,

        advice: pick(
            isHi
            ? [
                "💡 Tip: Daily tracking karo, unnecessary kharcha avoid karo.",
                "💡 Suggestion: Budget set karo aur usko follow karo.",
                "💡 Smart move: Chhote expenses bhi track karo."
            ]
            : [
                "💡 Tip: Track daily expenses and cut unnecessary spending.",
                "💡 Suggestion: Set a budget and stick to it.",
                "💡 Smart move: Even small expenses matter."
            ]
        ),

        add: hasAmount
            ? pick(
                isHi
                ? [
                    `💸 ₹${amount} add ho gaya ${category}`,
                    `✅ ₹${amount} successfully record ho gaya`,
                    `🧾 ₹${amount} save kar liya ${category}`
                ]
                : [
                    `💸 ₹${amount} added successfully.`,
                    `✅ ₹${amount} recorded.`,
                    `🧾 Expense of ₹${amount} saved.`
                ]
            )
            : isHi
                ? "⚠️ Amount samajh nahi aaya, dobara likhiye."
                : "⚠️ Couldn't detect the amount. Please try again.",

        default: pick(
            isHi
            ? [
                "🤖 Main aapka data analyze kar raha hoon...",
                "🤖 Thoda detail me bataiye.",
                "🤖 Main samajhne ki koshish kar raha hoon..."
            ]
            : [
                "🤖 I'm analyzing your data...",
                "🤖 Could you provide more details?",
                "🤖 I'm trying to understand..."
            ]
        )
    };

    // ============================
    // 🎯 CONTEXT INTELLIGENCE
    // ============================
    if(!hasAmount && context?.lastAmount){
        entities.amount = context.lastAmount;
    }

    // ============================
    // 🔀 FINAL SWITCH
    // ============================
    switch(intent){
        case "GREETING": return t.greet;
        case "BALANCE": return t.balance;
        case "ANALYTICS": return t.analytics;
        case "ADVICE": return t.advice;
        case "ADD_EXPENSE": return t.add;
        default: return t.default;
    }
}

// ===============================
// ⚡ STREAM ENGINE
// ===============================
async function stream(res, text){
    const words = text.split(" ");
    for(const w of words){
        res.write(w + " ");
        await new Promise(r=>setTimeout(r,20));
    }
}

// ===============================
// 🚀 MAIN ROUTE
// ===============================
router.post("/stream", auth, async (req,res)=>{

    try{

        const userId = req.user.id;
        const rawMsg = req.body.message || "";
        const msg = preprocess(rawMsg);

        if(!msg) return res.status(400).end();

        // ===============================
        // ⚡ HEADERS (STREAM MODE)
        // ===============================
        res.setHeader("Content-Type","text/plain");
        res.setHeader("Transfer-Encoding","chunked");

        // ===============================
        // 📊 DB FETCH (OPTIMIZED)
        // ===============================
        const [exp,bud] = await Promise.all([
            pool.query("SELECT amount FROM expenses WHERE user_id=$1",[userId]),
            pool.query("SELECT amount FROM budget WHERE user_id=$1",[userId])
        ]);

        const total = exp.rows.reduce((s,e)=>s+Number(e.amount||0),0);
        const budget = Number(bud.rows[0]?.amount)||0;

        const data = {total,budget};

        // ===============================
        // 🧠 NLP PROCESSING
        // ===============================
        const entities = extractEntities(msg);
        const intent = detectIntent(msg,entities);
        const lang = detectLanguage(msg);

        // ===============================
        // 🧠 MEMORY LOAD
        // ===============================
        const memory = getMemory(userId);

        // 🔥 CONTEXT FILL (SMART AI)
        if(!entities.category && memory.lastEntities?.category){
            entities.category = memory.lastEntities.category;
        }

        if(!entities.amount && memory.lastEntities?.amount){
            entities.amount = memory.lastEntities.amount;
        }

        // ===============================
        // 🎯 FINAL INTENT
        // ===============================
        const finalIntent = intent || memory.lastIntent || "AI";

        // ===============================
        // 🧠 MEMORY UPDATE
        // ===============================
        const updatedMemory = updateMemory(userId, finalIntent, entities);

        // ===============================
        // 💬 MAIN REPLY
        // ===============================
        const replyText = generateReply(
            finalIntent,
            lang,
            data,
            entities,
            updatedMemory
        );

        // ===============================
        // 📊 SMART INSIGHT
        // ===============================
        function getSmartInsight(data){
            const { total, budget } = data;

            if(total === 0){
                return "🚀 Start tracking your expenses";
            }

            const percent = (total/(budget||1))*100;

            if(percent > 100){
                return "🚨 Budget cross ho gaya!";
            }

            if(percent > 80){
                return "⚠️ Budget ke bahut close ho";
            }

            if(percent < 30){
                return "🔥 Aapka control bahut accha hai";
            }

            return "📊 Spending balanced hai";
        }

        const insight = getSmartInsight(data);

        // ===============================
        // 🧠 HABIT DETECTION
        // ===============================
        let habit = "";

        const addCount = updatedMemory.history
            .filter(h => h.intent === "ADD_EXPENSE")
            .length;

        if(addCount >= 3){
            habit = "\n\n🧠 Habit: Aap frequently expense add kar rahe ho";
        }

        // ===============================
        // 🧾 FINAL RESPONSE BUILD
        // ===============================
        const finalReply = replyText + "\n\n" + insight + habit;

        // ===============================
        // ⚡ STREAM RESPONSE
        // ===============================
        await stream(res, finalReply);

        res.end();

    }catch(err){
        console.error(err);
        res.write("⚠️ Error");
        res.end();
    }
});

module.exports = router;