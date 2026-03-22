// Popup logic
const toggleBtn = document.getElementById('toggleBtn');
const statusText = document.getElementById('statusText');
const sessIdSpan = document.getElementById('sessId');

let isTracking = true;

// Load initial state
chrome.storage.local.get(['isTracking', 'sessionId'], (result) => {
    isTracking = result.isTracking !== false;
    updateUI();
    sessIdSpan.textContent = result.sessionId || 'N/A';
});

toggleBtn.addEventListener('click', () => {
    isTracking = !isTracking;
    chrome.storage.local.set({ isTracking });
    updateUI();
});

document.getElementById('resetBtn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: "RESET_SESSION" }, (response) => {
        sessIdSpan.textContent = response.newSessionId;
        alert("Session Reset! Please refresh your active tabs to track under the new ID.");
    });
});

function updateUI() {
    if (isTracking) {
        toggleBtn.textContent = 'ON';
        toggleBtn.className = 'toggle-btn';
        statusText.textContent = 'Actively capturing events...';
    } else {
        toggleBtn.textContent = 'OFF';
        toggleBtn.className = 'toggle-btn off';
        statusText.textContent = 'Tracking paused.';
    }
}
