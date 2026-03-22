// Background worker for batching and reliability
let eventQueue = [];
const BATCH_SIZE = 10;
const UPLOAD_INTERVAL = 10000; // 10 seconds
const BACKEND_URL = "http://localhost:8000/events/batch";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "TRACK_EVENT") {
        eventQueue.push(message.event);
        if (eventQueue.length >= BATCH_SIZE) {
            uploadBatch();
        }
    } else if (message.action === "RESET_SESSION") {
        const newSessionId = "sess_" + Date.now();
        chrome.storage.local.set({ sessionId: newSessionId }, () => {
            sendResponse({ newSessionId });
        });
        return true; // Keep channel open for async response
    }
    return true;
});

async function uploadBatch() {
    if (eventQueue.length === 0) return;

    const batch = [...eventQueue];
    eventQueue = [];

    try {
        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ events: batch })
        });

        if (!response.ok) {
            console.error("Failed to upload batch, status:", response.status);
            // Push back to queue for retry (simple version)
            eventQueue = [...batch, ...eventQueue];
        } else {
            console.log("Uploaded batch of", batch.length, "events");
        }
    } catch (error) {
        console.error("Error uploading batch:", error);
        eventQueue = [...batch, ...eventQueue];
    }
}

// Periodic upload
setInterval(uploadBatch, UPLOAD_INTERVAL);

// Session Management
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(["sessionId", "userId"], (result) => {
        if (!result.sessionId) {
            const sessionId = "sess_" + Date.now();
            const userId = "user_" + Math.random().toString(36).substr(2, 9);
            chrome.storage.local.set({ sessionId, userId });
        }
    });
});
