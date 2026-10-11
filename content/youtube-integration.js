/**
 * youtube-integration.js
 * PlanUP YouTube Integration - Toolbar Icon
 * Injects a native-looking icon into YouTube's top toolbar
 */

(function() {
  'use strict';

  // ========================================
  // Configuration
  // ========================================
  const CONFIG = {
    ICON_ID: 'planup-toolbar-icon',
    HEADER_SELECTOR: 'ytd-masthead #end',
    CHECK_INTERVAL: 250,
    MAX_WAIT_TIME: 10000
  };

  // ========================================
  // State
  // ========================================
  let iconInjected = false;

  // ========================================
  // Wait for YouTube Header
  // ========================================
  function waitForYouTubeHeader() {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const check = () => {
        const headerEnd = document.querySelector(CONFIG.HEADER_SELECTOR);
        if (headerEnd) {
          resolve(headerEnd);
          return;
        }

        if (Date.now() - startTime > CONFIG.MAX_WAIT_TIME) {
          reject(new Error('YouTube header did not load in time'));
          return;
        }

        setTimeout(check, CONFIG.CHECK_INTERVAL);
      };

      check();
    });
  }

  // ========================================
  // Inject Toolbar Icon
  // ========================================
  function injectToolbarIcon(headerEnd) {
    if (document.getElementById(CONFIG.ICON_ID)) return;
    if (!headerEnd) return;

    const iconButton = document.createElement('div');
    iconButton.id = CONFIG.ICON_ID;
    iconButton.setAttribute('role', 'button');
    iconButton.setAttribute('aria-label', 'PlanUP');
    iconButton.setAttribute('tabindex', '0');
    iconButton.title = 'PlanUP';

    iconButton.style.cssText = `
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      cursor: pointer;
      border-radius: 50%;
      margin-right: 8px;
      position: relative;
      transition: background-color 0.1s cubic-bezier(0.05, 0, 0, 1);
    `;

    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('assets/icon32.png');
    icon.alt = 'PlanUP';
    icon.style.cssText = `
      width: 24px;
      height: 24px;
      user-select: none;
      pointer-events: none;
      opacity: 0.9;
      transition: opacity 0.1s cubic-bezier(0.05, 0, 0, 1);
    `;

    iconButton.appendChild(icon);

    iconButton.addEventListener('mouseenter', () => {
      iconButton.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      icon.style.opacity = '1';
    });

    iconButton.addEventListener('mouseleave', () => {
      iconButton.style.backgroundColor = 'transparent';
      icon.style.opacity = '0.9';
    });

    iconButton.addEventListener('click', handleIconClick);

    iconButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleIconClick();
      }
    });

    if (headerEnd.firstElementChild) {
      headerEnd.insertBefore(iconButton, headerEnd.firstElementChild);
    } else {
      headerEnd.appendChild(iconButton);
    }

    iconInjected = true;
  }

  // ========================================
  // Handle Icon Click
  // ========================================
  function handleIconClick() {
    chrome.runtime.sendMessage(
      { type: 'OPEN_PLANUP_POPUP' },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error('PlanUP: Error opening popup', chrome.runtime.lastError);
        } else if (response && !response.success) {
          console.error('PlanUP: Popup failed to open', response.error);
        }
      }
    );
  }

  // ========================================
  // Handle YouTube SPA Navigation
  // ========================================
  function handleNavigation() {
    if (!document.getElementById(CONFIG.ICON_ID)) {
      iconInjected = false;
      initializeToolbarIcon();
    }
  }

  function setupNavigationListeners() {
    document.addEventListener('yt-navigate-finish', handleNavigation);

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function(...args) {
      originalPushState.apply(this, args);
      handleNavigation();
    };

    history.replaceState = function(...args) {
      originalReplaceState.apply(this, args);
      handleNavigation();
    };

    window.addEventListener('popstate', handleNavigation);
  }

  // ========================================
  // Initialize Toolbar Icon
  // ========================================
  async function initializeToolbarIcon() {
    if (iconInjected) return;

    try {
      const headerEnd = await waitForYouTubeHeader();
      injectToolbarIcon(headerEnd);
    } catch (error) {
      console.error('PlanUP: Failed to initialize toolbar icon', error);
    }
  }

  // ========================================
  // Main Entry Point
  // ========================================
  function init() {
    if (!window.location.hostname.includes('youtube.com')) return;
    initializeToolbarIcon();
    setupNavigationListeners();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
