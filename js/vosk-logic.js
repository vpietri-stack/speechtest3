// Vosk Engine & Logic
const FAST_MODEL_URL = 'https://ghp.ci/https://github.com/vpietri-stack/speechtest3/raw/main/model.tar.gz';
const LOCAL_MODEL_URL = './model.tar.gz';
const CACHE_NAME = 'vosk-model-cache-v1';

let model = null;
let recognizer = null;
let mediaStream = null;
let audioContext = null;
let recognizerNode = null;
let ruleBasedSentences = []; 

// Exposed State
window.isVoskReady = false;
window.isListening = false;

// --- Initialization ---

async function initVosk() {
    console.log("Initializing Vosk...");
    updateStatus("Initializing Engine...", "loading");

    if (typeof Vosk === 'undefined' || typeof stringSimilarity === 'undefined') {
        updateStatus("Speech libraries missing.", "error");
        return;
    }

    try {
        const blob = await loadModelSmartly();
        updateStatus("Extracting Model...", "loading");
        
        const modelUrl = URL.createObjectURL(blob);
        const channel = new MessageChannel();
        model = await Vosk.createModel(modelUrl);
        
        recognizer = new model.KaldiRecognizer(48000);
        recognizer.setWords(true);
        
        window.isVoskReady = true;
        updateStatus("Engine Ready", "ready");
        console.log("Vosk Ready");

    } catch (err) {
        console.error("Vosk Init Failed:", err);
        updateStatus("Engine Failed: " + err.message, "error");
    }
}

async function loadModelSmartly() {
    // 1. Cache
    try {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(FAST_MODEL_URL);
        if (cached) {
            console.log("Loaded model from cache");
            return await cached.blob();
        }
    } catch (e) { console.warn("Cache check failed", e); }

    // 2. Fast Mirror
    try {
        updateStatus("Downloading (Fast Mirror)...", "loading");
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(FAST_MODEL_URL, { signal: controller.signal });
        clearTimeout(timeout);
        if (!response.ok) throw new Error("Fast mirror failed");

        const blob = await response.blob(); 
        saveToCache(blob);
        return blob;

    } catch (err) {
        console.warn("Mirror failed, switching to local...", err);
        updateStatus("Downloading (Local Backup)...", "loading");
        const response = await fetch(LOCAL_MODEL_URL);
        if (!response.ok) throw new Error("Local model missing");
        const blob = await response.blob();
        saveToCache(blob);
        return blob;
    }
}

async function saveToCache(blob) {
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(FAST_MODEL_URL, new Response(blob));
    } catch (e) { console.warn("Cache save failed", e); }
}

// --- Data Bridge ---

function setTargetSentences(sentences) {
    console.log("Setting Target Sentences:", sentences);
    ruleBasedSentences = sentences.map(s => s.toLowerCase());
}

// --- Audio Handling ---

async function startMicrophone(onResultCallback) {
    if (!window.isVoskReady) {
        alert("Engine not ready yet. Please wait.");
        return;
    }

    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
        mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                channelCount: 1,
                sampleRate: 48000
            }
        });

        const source = audioContext.createMediaStreamSource(mediaStream);
        recognizerNode = audioContext.createScriptProcessor(4096, 1, 1);

        recognizerNode.onaudioprocess = (event) => {
            if (!recognizer) return;
            recognizer.acceptWaveform(event.inputBuffer);
        };

        recognizer.on("result", (ctx) => {
            const text = ctx.result.text;
            if (text && onResultCallback) {
                onResultCallback(text, checkMatch(text));
            }
        });

        source.connect(recognizerNode);
        recognizerNode.connect(audioContext.destination);
        window.isListening = true;

    } catch (err) {
        console.error("Mic Error:", err);
        alert("Microphone Error: " + err.message);
    }
}

function stopMicrophone() {
    if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
    if (audioContext) audioContext.close();
    window.isListening = false;
}

// --- Helper Utilities ---

function checkMatch(spokenText) {
    if (!spokenText) return { match: false, score: 0, target: null };
    
    let bestMatch = { match: false, score: 0, target: null };
    
    for (let target of ruleBasedSentences) {
        const sim = stringSimilarity.compareTwoStrings(spokenText.toLowerCase(), target);
        const score = Math.round(sim * 100);
        if (score > bestMatch.score) {
            bestMatch = { match: score >= 80, score: score, target: target };
        }
    }
    
    if (!bestMatch.match) {
         for (let target of ruleBasedSentences) {
             if (spokenText.toLowerCase().includes(target)) {
                 bestMatch = { match: true, score: 100, target: target };
             }
         }
    }
    
    return bestMatch;
}

function updateStatus(msg, type) {
    const el = document.getElementById('engine-status');
    if (el) {
        el.textContent = msg;
        el.className = "status-indicator " + type; 
    }
    console.log(`[Status] ${type.toUpperCase()}: ${msg}`);
}

// --- Auto Start ---
window.addEventListener('load', initVosk);

// Export to Global
window.setTargetSentences = setTargetSentences;
window.startMicrophone = startMicrophone;
window.stopMicrophone = stopMicrophone;
