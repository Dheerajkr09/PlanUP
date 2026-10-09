/**
 * background.js
 * PlanYT Background Service Worker
 * Handles messages from content scripts to open the extension popup
 */

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle request to open PlanYT popup
  if (message.type === 'OPEN_PLANYT_POPUP') {
    // Open the extension popup (legacy simple open)
    chrome.action.openPopup()
      .then(() => {
        console.log('PlanYT: Popup opened successfully');
        sendResponse({ success: true });
      })
      .catch((error) => {
        console.error('PlanYT: Failed to open popup', error);
        sendResponse({ success: false, error: error.message });
      });
    return true;
  }

  // Open a specific plan by playlistId (widget -> background -> popup)
  if (message.type === 'OPEN_SPECIFIC_PLAN') {
    const playlistId = message.playlistId || null;
    const pending = { type: 'openPlan', playlistId };
    chrome.storage.local.set({ pendingPopupAction: pending }, () => {
      chrome.action.openPopup().catch(err => console.error('PlanYT: Failed to open popup', err));
      sendResponse({ success: true });
    });
    return true;
  }

  // Create a plan for current playlist: prefill popup with URL and trigger fetch
  if (message.type === 'CREATE_PLAN_FOR_PLAYLIST') {
    const playlistUrl = message.playlistUrl || window.location?.href || '';
    const playlistId = message.playlistId || null;
    const pending = { type: 'createPlan', playlistUrl, playlistId };
    chrome.storage.local.set({ pendingPopupAction: pending }, () => {
      chrome.action.openPopup().catch(err => console.error('PlanYT: Failed to open popup', err));
      sendResponse({ success: true });
    });
  }
  
  // Proxy fetch requests through background to bypass CORS
  if (message.type === 'FETCH_URL') {
    fetch(message.url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(text => {
        sendResponse({ success: true, data: text });
      })
      .catch(error => {
        console.error('PlanYT Fetch error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Indicates async response
  }
});

// Optional: Log when service worker starts
console.log('PlanYT: Background service worker initialized');

// Handle installation and updates for rating prompt feature
chrome.runtime.onInstalled.addListener((details) => {
  setUninstallRedirect();
  chrome.storage.local.get(['installDate', 'playlistPlans', 'ratingPrompt'], (result) => {
    const updates = {};
    
    // Initialize ratingPrompt status if not exists
    if (!result.ratingPrompt) {
      updates.ratingPrompt = { status: 'pending', lastShown: null };
    }

    if (!result.installDate) {
      if (details.reason === 'update') {
        // Check if user has plans with progress
        let hasProgress = false;
        if (result.playlistPlans && result.playlistPlans.plans) {
          hasProgress = result.playlistPlans.plans.some(plan => 
            plan.progress && (plan.progress.percent > 0 || plan.progress.lastWatchedIndex > 0)
          );
        }
        
        if (hasProgress) {
          // Backdate 4 days to make them immediately eligible
          updates.installDate = Date.now() - (4 * 24 * 60 * 60 * 1000);
        } else {
          updates.installDate = Date.now();
        }
      } else {
        // Genuinely new install
        updates.installDate = Date.now();
      }
    }
    
    if (Object.keys(updates).length > 0) {
      chrome.storage.local.set(updates);
    }
  });
});

function setUninstallRedirect() {
  const version = chrome.runtime.getManifest().version;
  chrome.runtime.setUninstallURL(
    `https://planyt.vercel.app/uninstall?v=${version}&src=ext`,
    () => { if (chrome.runtime.lastError) console.error(chrome.runtime.lastError); }
  );
}

chrome.runtime.onStartup.addListener(() => {
  setUninstallRedirect();
}); 
