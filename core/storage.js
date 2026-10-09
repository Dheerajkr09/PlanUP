/**
 * storage.js
 * Handles all chrome.storage.local operations
 * Provides simple get/set/clear functions for persistent data
 * Falls back to standard localStorage if run outside of Chrome Extension environment.
 */

// Helper to check if chrome storage is available
function hasChromeStorage() {
  return typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;
}

// Save data to chrome storage
async function saveToStorage(key, value) {
  if (!hasChromeStorage()) {
    localStorage.setItem(key, JSON.stringify(value));
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Get data from chrome storage
async function getFromStorage(key) {
  if (!hasChromeStorage()) {
    const data = localStorage.getItem(key);
    return Promise.resolve(data ? JSON.parse(data) : undefined);
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([key], (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}

// Clear specific key from storage
async function removeFromStorage(key) {
  if (!hasChromeStorage()) {
    localStorage.removeItem(key);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.remove([key], () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Clear all storage
async function clearAllStorage() {
  if (!hasChromeStorage()) {
    localStorage.clear();
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    chrome.storage.local.clear(() => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}
