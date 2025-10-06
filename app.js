// Register service worker for offline support and PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed:', err);
            });
    });
}

let state = 'initial';
let activeStopwatch = null;
let startTime = null;
let times = { 1: 0, 2: 0 };
let currentStart = null;
let animationFrame = null;
let showCentiseconds = false;
let showTimestampSeconds = true;
let currentScheme = 'purple';
let sessionHistory = [];
let minDurationEnabled = false;
let minDurationMinutes = 5;

const colorSchemes = {
    purple: {
        top: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        bottom: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
    },
    ocean: {
        top: 'linear-gradient(135deg, #2E3192 0%, #1BFFFF 100%)',
        bottom: 'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)'
    },
    sunset: {
        top: 'linear-gradient(135deg, #FF512F 0%, #F09819 100%)',
        bottom: 'linear-gradient(135deg, #FF416C 0%, #FF4B2B 100%)'
    },
    forest: {
        top: 'linear-gradient(135deg, #134E5E 0%, #71B280 100%)',
        bottom: 'linear-gradient(135deg, #56ab2f 0%, #a8e063 100%)'
    },
    candy: {
        top: 'linear-gradient(135deg, #FFB6B9 0%, #FEC7D7 100%)',
        bottom: 'linear-gradient(135deg, #FAD0C4 0%, #FFD1FF 100%)'
    },
    midnight: {
        top: 'linear-gradient(135deg, #232526 0%, #414345 100%)',
        bottom: 'linear-gradient(135deg, #0F2027 0%, #203A43 100%)'
    },
    fire: {
        top: 'linear-gradient(135deg, #8E0E00 0%, #1F1C18 100%)',
        bottom: 'linear-gradient(135deg, #C33764 0%, #1D2671 100%)'
    },
    neon: {
        top: 'linear-gradient(135deg, #00F260 0%, #0575E6 100%)',
        bottom: 'linear-gradient(135deg, #B721FF 0%, #21D4FD 100%)'
    }
};

const container = document.getElementById('container');
const stopwatch1 = document.getElementById('stopwatch1');
const stopwatch2 = document.getElementById('stopwatch2');
const centerBtn = document.getElementById('centerBtn');
const stopBtn = document.getElementById('stopBtn');
const timestamp = document.getElementById('timestamp');
const time1 = document.getElementById('time1');
const time2 = document.getElementById('time2');
const label1 = document.getElementById('label1');
const label2 = document.getElementById('label2');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const name1Input = document.getElementById('name1');
const name2Input = document.getElementById('name2');
const saveSettingsBtn = document.getElementById('saveSettings');
const centiToggle = document.getElementById('centiToggle');
const timestampToggle = document.getElementById('timestampToggle');
const analyticsBtn = document.getElementById('analyticsBtn');
const analyticsModal = document.getElementById('analyticsModal');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const minDurationToggle = document.getElementById('minDurationToggle');
const minDurationInputWrapper = document.getElementById('minDurationInputWrapper');
const minDurationValue = document.getElementById('minDurationValue');

async function getAppVersion() {
    try {
        const response = await fetch('./get-version');
        const data = await response.json();
        return data.version;
    } catch (error) {
        // Fallback: parse from cache name
        const cacheNames = await caches.keys();
        if (cacheNames.length > 0) {
            const match = cacheNames[0].match(/dual-stopwatch-(v[\d.]+)/);
            return match ? match[1] : 'Unknown';
        }
        return 'Unknown';
    }
}

async function displayVersion() {
    const version = await getAppVersion();
    const versionElement = document.getElementById('appVersion');
    if (versionElement) {
        versionElement.textContent = version;
    }
}

function loadState() {
    const saved = {
        names: [
            localStorage.getItem('name1') || 'Stopwatch 1',
            localStorage.getItem('name2') || 'Stopwatch 2'
        ],
        scheme: localStorage.getItem('colorScheme') || 'purple',
        showCenti: localStorage.getItem('showCentiseconds') === 'true',
        showTsSeconds: localStorage.getItem('showTimestampSeconds') !== 'false',
        times: [
            parseInt(localStorage.getItem('time1')) || 0,
            parseInt(localStorage.getItem('time2')) || 0
        ],
        state: localStorage.getItem('state') || 'initial',
        activeWatch: localStorage.getItem('activeStopwatch') ? parseInt(localStorage.getItem('activeStopwatch')) : null,
        startTimestamp: localStorage.getItem('startTimestamp') || null,
        currentStart: localStorage.getItem('currentStart') || null,
        minDurationEnabled: localStorage.getItem('minDurationEnabled') === 'true',
        minDurationMinutes: parseInt(localStorage.getItem('minDurationMinutes')) || 5
    };

    // Load history if available
    const historyData = localStorage.getItem('sessionHistory');
    if (historyData) {
        try {
            sessionHistory = JSON.parse(historyData);
        } catch (e) {
            sessionHistory = [];
        }
    }

    // Apply names
    label1.textContent = saved.names[0];
    label2.textContent = saved.names[1];
    name1Input.value = saved.names[0];
    name2Input.value = saved.names[1];

    // Apply color scheme
    currentScheme = saved.scheme;
    applyColorScheme(currentScheme);
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.scheme === currentScheme);
    });

    // Apply toggles
    showCentiseconds = saved.showCenti;
    showTimestampSeconds = saved.showTsSeconds;
    minDurationEnabled = saved.minDurationEnabled;
    minDurationMinutes = saved.minDurationMinutes;
    
    centiToggle.classList.toggle('active', showCentiseconds);
    timestampToggle.classList.toggle('active', showTimestampSeconds);
    minDurationToggle.classList.toggle('active', minDurationEnabled);
    minDurationValue.value = minDurationMinutes;
    minDurationInputWrapper.classList.toggle('disabled', !minDurationEnabled);

    // Restore stopwatch times
    times[1] = saved.times[0];
    times[2] = saved.times[1];

    // If it was running when the page closed, add elapsed offline time
    if (saved.state === 'running' && saved.activeWatch && saved.currentStart) {
        const elapsed = Date.now() - parseInt(saved.currentStart, 10);
        times[saved.activeWatch] += elapsed;
    }

    // Update displays
    time1.textContent = formatTime(times[1]);
    time2.textContent = formatTime(times[2]);

    // Restore state
    state = saved.state;
    activeStopwatch = saved.activeWatch;

    if (saved.startTimestamp) {
        startTime = new Date(saved.startTimestamp);
        updateTimestamp();
    }

    // If it was running, set UI to reflect that
    if (state === 'running' && activeStopwatch) {
        centerBtn.textContent = 'SWITCH';
        stopBtn.style.display = 'block';
        stopBtn.textContent = 'STOP';
        currentStart = Date.now();

        if (activeStopwatch === 1) {
            stopwatch1.classList.add('active');
            stopwatch2.classList.add('inactive');
        } else {
            stopwatch2.classList.add('active');
            stopwatch1.classList.add('inactive');
        }

        updateDisplay();
    } else if (state === 'stopped') {
        centerBtn.textContent = 'SWITCH';
        stopBtn.style.display = 'block';
        stopBtn.textContent = 'RESET';

        if (activeStopwatch === 1) {
            stopwatch1.classList.add('active');
            stopwatch2.classList.add('inactive');
        } else if (activeStopwatch === 2) {
            stopwatch2.classList.add('active');
            stopwatch1.classList.add('inactive');
        }
    }
}

function saveState() {
    localStorage.setItem('name1', label1.textContent);
    localStorage.setItem('name2', label2.textContent);
    localStorage.setItem('colorScheme', currentScheme);
    localStorage.setItem('showCentiseconds', showCentiseconds);
    localStorage.setItem('showTimestampSeconds', showTimestampSeconds);
    localStorage.setItem('time1', times[1]);
    localStorage.setItem('time2', times[2]);
    localStorage.setItem('state', state);
    localStorage.setItem('activeStopwatch', activeStopwatch || '');
    localStorage.setItem('startTimestamp', startTime ? startTime.toISOString() : '');
    localStorage.setItem('sessionHistory', JSON.stringify(sessionHistory));
    localStorage.setItem('minDurationEnabled', minDurationEnabled);
    localStorage.setItem('minDurationMinutes', minDurationMinutes);

    if (state === 'running' && currentStart) {
        localStorage.setItem('currentStart', currentStart);
    } else {
        localStorage.removeItem('currentStart');
    }
}

function checkOrientation() {
    if (window.innerHeight > window.innerWidth) {
        container.className = 'container portrait';
    } else {
        container.className = 'container landscape';
    }
}

window.addEventListener('resize', checkOrientation);
checkOrientation();

function formatTime(ms) {
    const totalMs = ms;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const centiseconds = Math.floor((totalMs % 1000) / 10);
    
    let timeStr = '';
    
    if (hours > 0) {
        timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else if (minutes > 0) {
        timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    } else {
        timeStr = `${String(seconds).padStart(2, '0')}`;
    }
    
    if (showCentiseconds) {
        timeStr += `.${String(centiseconds).padStart(2, '0')}`;
    }
    
    return timeStr;
}

function updateDisplay() {
    if (activeStopwatch && currentStart) {
        times[activeStopwatch] += Date.now() - currentStart;
        currentStart = Date.now();
    }
    time1.textContent = formatTime(times[1]);
    time2.textContent = formatTime(times[2]);
    saveState();
    if (state === 'running') {
        animationFrame = requestAnimationFrame(updateDisplay);
    }
}

function updateTimestamp() {
    if (startTime) {
        const options = showTimestampSeconds 
            ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
            : { hour: '2-digit', minute: '2-digit' };
        timestamp.textContent = startTime.toLocaleTimeString([], options);
    }
}

function applyColorScheme(scheme) {
    stopwatch1.style.background = colorSchemes[scheme].top;
    stopwatch2.style.background = colorSchemes[scheme].bottom;
}

function makeLabelEditable(labelElement, inputElement, stopwatchNum) {
    labelElement.addEventListener('click', function(e) {
        if (state === 'selecting' || state === 'running') return;
        e.stopPropagation();
        
        const currentText = labelElement.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'label-input';
        input.value = currentText;
        input.maxLength = 20;
        
        labelElement.style.display = 'none';
        labelElement.parentNode.insertBefore(input, labelElement);
        input.focus();
        input.select();
        
        function finishEdit() {
            const newValue = input.value.trim() || `Stopwatch ${stopwatchNum}`;
            labelElement.textContent = newValue;
            inputElement.value = newValue;
            input.remove();
            labelElement.style.display = 'block';
            saveState();
        }
        
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                finishEdit();
            }
        });
    });
}

makeLabelEditable(label1, name1Input, 1);
makeLabelEditable(label2, name2Input, 2);

centerBtn.addEventListener('click', function() {
    if (state === 'initial') {
        state = 'selecting';
        centerBtn.textContent = 'SELECT';
        stopwatch1.classList.add('highlight');
        stopwatch2.classList.add('highlight');
        startTime = new Date();
        updateTimestamp();
        saveState();
    } else if (state === 'running') {
        if (activeStopwatch) {
            times[activeStopwatch] += Date.now() - currentStart;
            activeStopwatch = activeStopwatch === 1 ? 2 : 1;
            currentStart = Date.now();
            
            if (activeStopwatch === 1) {
                stopwatch1.classList.add('active');
                stopwatch1.classList.remove('inactive');
                stopwatch2.classList.add('inactive');
                stopwatch2.classList.remove('active');
            } else {
                stopwatch2.classList.add('active');
                stopwatch2.classList.remove('inactive');
                stopwatch1.classList.add('inactive');
                stopwatch1.classList.remove('active');
            }
            saveState();
        }
    }
});

stopwatch1.addEventListener('click', function() {
    if (state === 'selecting') {
        startStopwatch(1);
    }
});

stopwatch2.addEventListener('click', function() {
    if (state === 'selecting') {
        startStopwatch(2);
    }
});

function startStopwatch(num) {
    state = 'running';
    activeStopwatch = num;
    currentStart = Date.now();
    centerBtn.textContent = 'SWITCH';
    stopBtn.style.display = 'block';
    stopBtn.textContent = 'STOP';
    
    stopwatch1.classList.remove('highlight');
    stopwatch2.classList.remove('highlight');
    
    if (num === 1) {
        stopwatch1.classList.add('active');
        stopwatch2.classList.add('inactive');
    } else {
        stopwatch2.classList.add('active');
        stopwatch1.classList.add('inactive');
    }
    
    updateDisplay();
    saveState();
}

stopBtn.addEventListener('click', function() {
    if (state === 'running') {
        state = 'stopped';
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        if (activeStopwatch && currentStart) {
            times[activeStopwatch] += Date.now() - currentStart;
            currentStart = null;
        }
        time1.textContent = formatTime(times[1]);
        time2.textContent = formatTime(times[2]);
        stopBtn.textContent = 'RESET';
        saveState();
        saveSession();
    } else if (state === 'stopped') {
        resetAll();
    }
});

function resetAll() {
    state = 'initial';
    activeStopwatch = null;
    times = { 1: 0, 2: 0 };
    currentStart = null;
    startTime = null;
    
    time1.textContent = '00';
    time2.textContent = '00';
    centerBtn.textContent = 'START';
    stopBtn.style.display = 'none';
    timestamp.textContent = '';
    
    stopwatch1.classList.remove('active', 'inactive');
    stopwatch2.classList.remove('active', 'inactive');
    
    saveState();
}

function saveSession() {
    const totalTime = times[1] + times[2];
    
    // Check if session meets minimum duration requirement
    if (minDurationEnabled) {
        const totalMinutes = totalTime / (1000 * 60);
        if (totalMinutes < minDurationMinutes) {
            console.log(`Session not saved: ${totalMinutes.toFixed(1)} min < ${minDurationMinutes} min minimum`);
            return;
        }
    }

    const session = {
        id: Date.now(), // Unique ID for deletion
        date: startTime ? startTime.toISOString() : new Date().toISOString(),
        stopwatch1Name: label1.textContent,
        stopwatch2Name: label2.textContent,
        time1: times[1],
        time2: times[2],
        totalTime: totalTime
    };
    
    sessionHistory.unshift(session);
    
    if (sessionHistory.length > 50) {
        sessionHistory = sessionHistory.slice(0, 50);
    }
    
    saveState();
}

function deleteSession(sessionId) {
    if (confirm('Delete this session?')) {
        sessionHistory = sessionHistory.filter(s => s.id !== sessionId);
        saveState();
        renderAnalytics();
    }
}

function renderAnalytics() {
    const totalSessions = sessionHistory.length;
    let totalTime = 0;
    
    sessionHistory.forEach(session => {
        totalTime += session.totalTime;
    });
    
    const avgTime = totalSessions > 0 ? totalTime / totalSessions : 0;
    
    document.getElementById('totalSessions').textContent = totalSessions;
    document.getElementById('totalTime').textContent = formatTime(totalTime);
    document.getElementById('avgSession').textContent = formatTime(avgTime);
    
    const historyList = document.getElementById('historyList');
    
    if (totalSessions === 0) {
        historyList.innerHTML = '<div class="no-history">No sessions recorded yet</div>';
    } else {
        historyList.innerHTML = sessionHistory.map(session => {
            const date = new Date(session.date);
            const dateStr = date.toLocaleDateString();
            const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            return `
                <div class="session-entry">
                    <button class="delete-session-btn" onclick="deleteSession(${session.id})">×</button>
                    <div class="session-header">
                        <span class="session-date">${dateStr} at ${timeStr}</span>
                        <span class="session-duration">Total: ${formatTime(session.totalTime)}</span>
                    </div>
                    <div class="session-times">
                        <div class="time-entry">
                            <span class="name">${session.stopwatch1Name}</span>
                            <span class="time">${formatTime(session.time1)}</span>
                        </div>
                        <div class="time-entry">
                            <span class="name">${session.stopwatch2Name}</span>
                            <span class="time">${formatTime(session.time2)}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

settingsBtn.addEventListener('click', function() {
    displayVersion();
    settingsModal.classList.add('show');
});

analyticsBtn.addEventListener('click', function() {
    renderAnalytics();
    analyticsModal.classList.add('show');
});

settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) {
        settingsModal.classList.remove('show');
    }
});

analyticsModal.addEventListener('click', function(e) {
    if (e.target === analyticsModal) {
        analyticsModal.classList.remove('show');
    }
});

document.querySelectorAll('.color-option').forEach(option => {
    option.addEventListener('click', function() {
        document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
        this.classList.add('selected');
    });
});

centiToggle.addEventListener('click', function() {
    this.classList.toggle('active');
});

timestampToggle.addEventListener('click', function() {
    this.classList.toggle('active');
});

minDurationToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    const isActive = this.classList.contains('active');
    minDurationInputWrapper.classList.toggle('disabled', !isActive);
});

saveSettingsBtn.addEventListener('click', function() {
    label1.textContent = name1Input.value || 'Stopwatch 1';
    label2.textContent = name2Input.value || 'Stopwatch 2';
    
    const selectedScheme = document.querySelector('.color-option.selected');
    if (selectedScheme) {
        currentScheme = selectedScheme.dataset.scheme;
        applyColorScheme(currentScheme);
    }
    
    showCentiseconds = centiToggle.classList.contains('active');
    showTimestampSeconds = timestampToggle.classList.contains('active');
    minDurationEnabled = minDurationToggle.classList.contains('active');
    minDurationMinutes = parseInt(minDurationValue.value) || 5;
    
    time1.textContent = formatTime(times[1]);
    time2.textContent = formatTime(times[2]);
    updateTimestamp();
    
    saveState();
    settingsModal.classList.remove('show');
});

clearHistoryBtn.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all session history? This cannot be undone.')) {
        sessionHistory = [];
        saveState();
        renderAnalytics();
    }
});

loadState();
