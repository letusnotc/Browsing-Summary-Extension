// Content script to capture user events responsibly
console.log("User Journey Miner: Tracking initialized.");

let sessionId = null;
let isTracking = true;
let userId = "user_" + Math.random().toString(36).substr(2, 9); // Placeholder ID

// Get/Sync Session ID and Tracking Status from storage
try {
    chrome.storage.local.get(["sessionId", "userId", "isTracking"], (result) => {
        if (chrome.runtime.lastError) return; // Context invalidated
        if (result.sessionId) sessionId = result.sessionId;
        if (result.userId) userId = result.userId;
        if (result.isTracking !== undefined) isTracking = result.isTracking;
    });

    // Listen for changes (live pause/resume)
    chrome.storage.onChanged.addListener((changes) => {
        if (changes.isTracking) isTracking = changes.isTracking.newValue;
        if (changes.sessionId) sessionId = changes.sessionId.newValue;
    });
} catch (e) {
    // Context invalidated, stop initialization
    console.log("User Journey Miner: Old context detected, silencing script.");
}

function getXPath(element) {
    if (element.id !== "") return `//*[@id="${element.id}"]`;
    if (element === document.body) return element.tagName.toLowerCase();

    let ix = 0;
    let siblings = element.parentNode.childNodes;
    for (let i = 0; i < siblings.length; i++) {
        let sibling = siblings[i];
        if (sibling === element) {
            return getXPath(element.parentNode) + "/" + element.tagName.toLowerCase() + "[" + (ix + 1) + "]";
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            ix++;
        }
    }
}

function getLinkInfo(element) {
    const link = element.closest("a");
    return link ? { href: link.href, text: link.innerText?.substring(0, 100) } : null;
}

function getDeepPageContext() {
    const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(h => h.innerText.trim()).slice(0, 5);
    const mainContent = document.querySelector("main, article, .content, #content")?.innerText?.substring(0, 300) || "";
    
    // Extract JSON-LD (Schema.org)
    let schemaData = null;
    try {
        const script = document.querySelector('script[type="application/ld+json"]');
        if (script) {
            const parsed = JSON.parse(script.innerText);
            // Handle both single object and array of objects
            const item = Array.isArray(parsed) ? parsed[0] : (parsed['@graph'] ? parsed['@graph'][0] : parsed);
            schemaData = {
                type: item['@type'],
                name: item.name || item.headline,
                brand: item.brand?.name
            };
        }
    } catch (e) {}

    return { headings, mainContent, schemaData };
}

function getPageMetadata() {
    return {
        description: document.querySelector('meta[name="description"]')?.content || null,
        ogTitle: document.querySelector('meta[property="og:title"]')?.content || null,
        h1: document.querySelector('h1')?.innerText || null
    };
}

function parseSearchQuery(url) {
    const searchParams = new URL(url).searchParams;
    const queryKeys = ['q', 'query', 's', 'search', 'p', 'text', 'k'];
    for (const key of queryKeys) {
        if (searchParams.has(key)) return searchParams.get(key);
    }
    return null;
}

function getFormData(form) {
    const data = {};
    const elements = form.elements;
    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.name && !isSensitive(el) && el.type !== "password") {
            data[el.name] = el.value;
        }
    }
    return Object.keys(data).length > 0 ? data : null;
}

function isSensitive(element) {
    if (!element) return false;
    const type = element.getAttribute("type") || "";
    const name = element.getAttribute("name") || "";
    const id = element.getAttribute("id") || "";
    const sensitiveTerms = ["password", "otp", "cvv", "creditcard", "ssn", "secret", "token"];
    
    return sensitiveTerms.some(term => 
        type.toLowerCase().includes(term) || 
        name.toLowerCase().includes(term) || 
        id.toLowerCase().includes(term)
    );
}

function captureEvent(type, target, details = {}) {
    if (!sessionId || !isTracking) return; 
    if (isSensitive(target)) return; 

    const linkInfo = target ? getLinkInfo(target) : null;
    const pageMeta = getPageMetadata();
    const deepContext = getDeepPageContext();
    const query = parseSearchQuery(window.location.href);

    const event = {
        session_id: sessionId,
        user_id: userId,
        timestamp: new Date().toISOString(),
        domain: window.location.hostname,
        url: window.location.href,
        page_title: document.title,
        event_type: type,
        metadata: {
            element: target ? target.tagName : null,
            xpath: target ? getXPath(target) : null,
            selector: target ? (target.id ? `#${target.id}` : target.className) : null,
            text: target ? (target.innerText || target.value)?.substring(0, 500) : null,
            link_url: linkInfo?.href || null,
            link_text: linkInfo?.text || null,
            page_description: pageMeta.description,
            page_h1: pageMeta.h1,
            page_headings: deepContext.headings,
            page_snippet: deepContext.mainContent,
            page_schema: deepContext.schemaData,
            search_query: query || null,
            form_data: type === "submit" && target ? getFormData(target) : null,
            coordinates: details.coordinates || null
        }
    };

    if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action: "TRACK_EVENT", event: event });
    }
}

// Event Listeners
document.addEventListener("click", (e) => {
    captureEvent("click", e.target, {
        coordinates: { x: e.clientX, y: e.clientY }
    });
}, true);

document.addEventListener("input", (e) => {
    // Only track fact of input, not content, for general privacy unless configured
    captureEvent("input", e.target);
}, true);

document.addEventListener("submit", (e) => {
    captureEvent("submit", e.target);
}, true);

document.addEventListener("copy", () => captureEvent("copy", null));
document.addEventListener("paste", () => captureEvent("paste", null));

// Navigation / Scroll (Throttle scroll)
let scrollTimeout;
window.addEventListener("scroll", () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        captureEvent("scroll", null);
    }, 2000);
});

// Periodic heartbeat / Visibility
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
        captureEvent("tab_switch", null);
    }
});

// Capture page metadata on load
window.addEventListener("DOMContentLoaded", () => {
    captureEvent("page_load", null);
});

// Also capture if already loaded (for slow extensions)
if (document.readyState === "complete" || document.readyState === "interactive") {
    captureEvent("page_load", null);
}
