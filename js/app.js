// Main App Logic

// Constants
const VIEWS = ['login-view', 'dashboard-view', 'lesson-overview', 'practice-view', 'game-view'];
let currentUnit = null;
let currentLesson = null;

// --- Router ---

function showView(viewId) {
    VIEWS.forEach(id => {
        document.getElementById(id).style.display = (id === viewId) ? 'block' : 'none';
    });
}

// --- Initialization ---

window.addEventListener('DOMContentLoaded', () => {
    // Start at Login
    showView('login-view');

    // Setup UI Bindings
    document.getElementById('login-btn').addEventListener('click', () => {
        renderDashboard();
        showView('dashboard-view');
    });

    document.getElementById('back-to-dash').addEventListener('click', () => {
        showView('dashboard-view');
    });

    document.getElementById('back-to-lesson').addEventListener('click', () => {
        if (currentUnit && currentLesson) {
            renderLessonOverview(currentUnit, currentLesson);
            showView('lesson-overview');
        } else {
            showView('dashboard-view');
        }
    });
});

// --- Dashboard Logic ---

function renderDashboard() {
    const container = document.getElementById('units-container');
    container.innerHTML = '<h3>Power Up 1</h3>';

    if (!window.curriculum) {
        container.innerHTML = "Error: Curriculum data not found.";
        return;
    }

    const units = curriculum.book1.units;

    Object.keys(units).forEach(unitKey => {
        const unit = units[unitKey];
        const btn = document.createElement('div');
        btn.className = 'card unit-card';
        btn.innerHTML = `<h4>${unit.title}</h4>`;
        btn.onclick = () => {
            // Default to lesson 1
            renderLessonOverview(unitKey, "1");
            showView('lesson-overview');
        };
        container.appendChild(btn);
    });
}

function renderLessonOverview(unitKey, lessonKey) {
    currentUnit = unitKey;
    currentLesson = lessonKey;

    const lessonData = curriculum.book1.units[unitKey].lessons[lessonKey];
    const container = document.getElementById('lesson-details');

    container.innerHTML = `
        <h2>${lessonData.title}</h2>
        <div class="activity-list">
            <button onclick="startPractice('${unitKey}', '${lessonKey}')">🗣️ Practice Speaking</button>
            <button onclick="alert('Flashcards not impl.')">🎴 Flashcards</button>
            <button onclick="alert('Game not impl.')">🎮 Play Game</button>
        </div>
    `;
}

// --- Practice Logic (Speaking) ---

function startPractice(unitKey, lessonKey) {
    const lessonData = curriculum.book1.units[unitKey].lessons[lessonKey];
    const practiceData = lessonData.activities.practice;

    if (practiceData && practiceData.sentences) {
        // DATA BRIDGE
        if (window.setTargetSentences) {
            window.setTargetSentences(practiceData.sentences);
        } else {
            console.error("setTargetSentences not found in global scope!");
        }

        // Render UI
        const container = document.getElementById('practice-container');
        container.innerHTML = `
            <h3>${lessonData.title} - Speaking</h3>
            <div class="target-sentence">Say: "${practiceData.sentences.join('" or "')}"</div>
            <div id="practice-result" class="result-box">...</div>
            <button id="mic-btn" class="mic-btn">🎤 Start</button>
        `;

        // Bind Mic
        const btn = document.getElementById('mic-btn');
        btn.onclick = () => {
            if (window.isListening) {
                window.stopMicrophone(); // defined in vosk-logic.js
                btn.textContent = "🎤 Start";
                btn.classList.remove('active');
            } else {
                btn.textContent = "🛑 Stop";
                btn.classList.add('active');

                // Check if engine is ready
                if (!window.isVoskReady) {
                    alert("Engine is still loading... please wait.");
                    return;
                }

                window.startMicrophone((text, matchResult) => {
                    const resBox = document.getElementById('practice-result');
                    resBox.innerText = `Heard: "${text}"`;

                    if (matchResult.match) {
                        resBox.innerHTML += `<br><strong style="color:green">✅ Correct! (${matchResult.target})</strong>`;
                    } else {
                        resBox.innerHTML += `<br><span style="color:orange">Try again...</span>`;
                    }
                });
            }
        };

        showView('practice-view');
    } else {
        alert("No speaking practice for this lesson.");
    }
}

// Global Exports
window.renderDashboard = renderDashboard;
window.renderLessonOverview = renderLessonOverview;
window.startPractice = startPractice;
