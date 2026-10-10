/**
 * progress-widget.js
 * PlanYT Progress Widget - YouTube Playlist Sidebar Integration
 * Injects a native-looking progress card into YouTube playlist pages
 */

(function() {
  'use strict';

  const CONFIG = {
    WIDGET_ID: 'planyt-progress-widget-container',
    WIDGET_HOST_ID: 'planyt-progress-widget-host',
    SIDEBAR_SELECTOR: 'ytd-playlist-panel-renderer',
    SECONDARY_SELECTOR: '#secondary',
    CHECK_INTERVAL: 300,
    MAX_INIT_ATTEMPTS: 15,
    UPDATE_DEBOUNCE: 200,
    STORAGE_KEY: 'playlistPlans'
  };

  const STATE = {
    initialized: false,
    currentPlaylistId: null,
    shadowRoot: null,
    updateDebounceTimer: null,
    navigationCheckInterval: null,
    navigationDebounceTimer: null,
    lastPath: window.location.pathname,
    activeInjectionPromise: null
  };

  async function injectWidgetSafely() {
    if (!isPlaylistPage()) {
      return;
    }

    const existing = document.getElementById(CONFIG.WIDGET_HOST_ID);
    if (existing && existing.isConnected) {
      return;
    }

    if (STATE.activeInjectionPromise) {
      return STATE.activeInjectionPromise;
    }

    STATE.activeInjectionPromise = (async () => {
      try {
        try {
          const staleWidget = document.getElementById(CONFIG.WIDGET_HOST_ID);
          if (staleWidget) {
            staleWidget.remove();
          }
        } catch (err) {
          console.warn('PlanYT: Could not remove stale widget', err);
        }

        const playlistPanel = await waitForSidebar();
        if (!playlistPanel) {
          console.warn('PlanUp: Playlist sidebar not found');
          return;
        }

        // Double check connected state under the lock after awaiting the sidebar
        const existingAfterWait = document.getElementById(CONFIG.WIDGET_HOST_ID);
        if (existingAfterWait && existingAfterWait.isConnected) {
          return;
        }

        const widget = createWidgetContainer();
        if (!widget) {
          console.warn('PlanUp: Failed to create widget');
          return;
        }

        const referenceElement = playlistPanel.querySelector('#header-description');

        try {
          if (referenceElement && referenceElement.parentNode === playlistPanel) {
            playlistPanel.insertBefore(widget, referenceElement);
          } else {
            playlistPanel.appendChild(widget);
          }
        } catch (err) {
          console.warn('PlanUp: insertBefore failed, using appendChild fallback', err);
          try {
            playlistPanel.appendChild(widget);
          } catch (err2) {
            console.warn('PlanUp: appendChild also failed', err2);
            return;
          }
        }

        STATE.initialized = true;
      } finally {
        STATE.activeInjectionPromise = null;
      }
    })();

    return STATE.activeInjectionPromise;
  }

  async function waitForSidebar(maxAttempts = CONFIG.MAX_INIT_ATTEMPTS) {
    for (let i = 0; i < maxAttempts; i++) {
      const sidebar = document.querySelector(CONFIG.SIDEBAR_SELECTOR);
      if (sidebar && sidebar.isConnected) {
        return sidebar;
      }

      await new Promise((resolve) => setTimeout(resolve, CONFIG.CHECK_INTERVAL));
    }

    return null;
  }

  function removeWidget() {
    try {
      const widget = document.getElementById(CONFIG.WIDGET_HOST_ID);
      if (widget && widget.isConnected) {
        widget.remove();
      }
    } catch (err) {
      console.warn('PlanYT: Error removing widget', err);
    }

    STATE.shadowRoot = null;
    STATE.activeInjectionPromise = null;
  }

  function createWidgetContainer() {
    const host = document.createElement('div');
    host.id = CONFIG.WIDGET_HOST_ID;

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = getWidgetStyles();

    const container = document.createElement('div');
    container.className = 'planyt-widget-container';

    shadow.appendChild(style);
    shadow.appendChild(container);

    shadow.widgetContainer = container;
    STATE.shadowRoot = shadow;

    return host;
  }

  async function renderWidget() {
    let widgetHost = document.getElementById(CONFIG.WIDGET_HOST_ID);

    if (!STATE.shadowRoot || !STATE.shadowRoot.widgetContainer || !widgetHost || !widgetHost.isConnected) {
      console.warn('PlanYT: Widget detached during render, reinjecting safely');
      STATE.initialized = false;
      await injectWidgetSafely();
      
      widgetHost = document.getElementById(CONFIG.WIDGET_HOST_ID);
      if (!widgetHost || !widgetHost.isConnected) {
        return;
      }
    }

    const container = STATE.shadowRoot.widgetContainer;
    const playlistId = extractPlaylistIdFromPage();

    if (!playlistId) {
      renderEmptyState(container, 'Unable to detect playlist');
      return;
    }

    STATE.currentPlaylistId = playlistId;

    try {
      const plansData = await getPlansFromStorage();
      const plan = findMatchingPlan(playlistId, plansData);

      if (!plan) {
        renderEmptyState(container, 'Plan this playlist with PlanUP');
        return;
      }

      const progress = deriveProgressFromPlan(plan.planData || []);

      if (progress.totalDays === 0) {
        renderEmptyState(container, 'Plan this playlist with PlanUP');
        return;
      }

      if (progress.percent === 100 && progress.completedDays === progress.totalDays) {
        renderCompletedState(container);
      } else {
        renderActivePlan(container, plan, progress);
      }
    } catch (error) {
      console.warn('PlanYT widget: Error rendering', error);
      renderEmptyState(container, 'Error loading plan');
    }
  }

  function renderEmptyState(container, message = 'Plan this playlist with PlanUP') {
    container.innerHTML = `
      <div class="container">
        <section class="section section-compact">
          <h3 class="plans-title">Plan Progress</h3>
          <div class="progress-hero progress-hero-empty">
            <div class="progress-hero-percent">${message}</div>
            <div class="progress-hero-subtext">Create a plan in PlanUP to track progress</div>
          </div>

          <div class="plans-footer">
            <button class="btn btn-secondary" id="planyt-empty-cta">Create Plan</button>
          </div>
        </section>
      </div>
    `;

    const btn = container.querySelector('#planyt-empty-cta');
    if (btn) {
      btn.addEventListener('click', () => openPlanYTPopup('create'));
    }
  }

  function renderCompletedState(container) {
    container.innerHTML = `
      <div class="container">
        <section class="section section-compact">
          <h3 class="plans-title">Plan Progress</h3>
          <div class="progress-hero progress-hero-complete">
            <div class="progress-hero-percent">Playlist Completed</div>
            <div class="progress-hero-subtext">Great job! You've finished this playlist.</div>
          </div>

          <div class="plans-footer">
            <button class="btn btn-secondary" id="planyt-view-cta">View Plan</button>
          </div>
        </section>
      </div>
    `;

    const btn = container.querySelector('#planyt-view-cta');
    if (btn) {
      btn.addEventListener('click', () => openPlanYTPopup('open'));
    }
  }

  function renderActivePlan(container, plan, progress) {
    const todayTarget = getTodayTarget(plan.planData || [], progress.currentDay);
    const daysRemaining = calculateDaysRemaining(progress.currentDay, progress.totalDays);
    const minutesRemaining = calculateRemainingMinutes(plan.planData || [], progress.currentDay);

    const todayStatus = todayTarget.completed ? 'completed' : '';
    const todayLabel = todayTarget.completed ? "Today's target completed ✓" : `${todayTarget.videosCount} video${todayTarget.videosCount !== 1 ? 's' : ''}`;
    const todayTime = formatMinutes(todayTarget.totalMinutes);

    container.innerHTML = `
      <div class="container">
        <section class="section section-compact">
          <h3 class="plans-title">Plan Progress</h3>
          <div class="progress-hero">
            <div class="progress-hero-percent">${progress.percent}% Complete</div>
            <div class="progress-bar-container progress-bar-container-hero">
              <div class="progress-bar" style="width: ${progress.percent}%"></div>
            </div>
          </div>

          <div class="meta-list" id="progressSection">
            <div class="meta-row">
              <span class="meta-label">Today</span>
              <span class="meta-value ${todayStatus}">${todayLabel}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Remaining</span>
              <span class="meta-value">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</span>
            </div>
            <div class="meta-row">
              <span class="meta-label">Watch time</span>
              <span class="meta-value">${todayTime || formatMinutes(minutesRemaining)}</span>
            </div>
          </div>

          <div class="plans-footer">
            <button class="btn btn-secondary" id="planyt-open-cta">Open Plan</button>
          </div>
        </section>
      </div>
    `;

    const btn = container.querySelector('#planyt-open-cta');
    if (btn) {
      btn.addEventListener('click', () => openPlanYTPopup('open'));
    }
  }

  async function getPlansFromStorage() {
    return new Promise((resolve) => {
      chrome.storage.local.get([CONFIG.STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) {
          console.warn('PlanYT widget: Storage error', chrome.runtime.lastError);
          resolve({ plans: [] });
        } else {
          const data = result[CONFIG.STORAGE_KEY] || { plans: [], activePlanId: null };
          resolve(data.plans || []);
        }
      });
    });
  }

  function setupStorageListener() {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (!changes[CONFIG.STORAGE_KEY]) return;

      clearTimeout(STATE.updateDebounceTimer);
      STATE.updateDebounceTimer = setTimeout(() => {
        renderWidget();
      }, CONFIG.UPDATE_DEBOUNCE);
    });
  }

  function setupNavigationListeners() {
    document.addEventListener('yt-navigate-finish', () => {
      try {
        const stale = document.getElementById(CONFIG.WIDGET_HOST_ID);
        if (stale) {
          stale.remove();
        }
      } catch (err) {
        console.warn('PlanYT: Error removing stale widget on navigation', err);
      }
      handlePageChangeDebounced();
    });

    setInterval(() => {
      if (window.location.pathname !== STATE.lastPath) {
        STATE.lastPath = window.location.pathname;
        handlePageChangeDebounced();
      }
    }, 1000);
  }

  function handlePageChangeDebounced() {
    clearTimeout(STATE.navigationDebounceTimer);
    STATE.navigationDebounceTimer = setTimeout(() => {
      handlePageChange();
    }, 250);
  }

  function handlePageChange() {
    const wasPreviouslyPlaylist = STATE.currentPlaylistId !== null;
    const isNowPlaylist = isPlaylistPage();

    if (!isNowPlaylist && wasPreviouslyPlaylist) {
      removeWidget();
      STATE.initialized = false;
    } else if (isNowPlaylist) {
      const newPlaylistId = extractPlaylistIdFromPage();

      if (newPlaylistId !== STATE.currentPlaylistId) {
        removeWidget();
        STATE.initialized = false;
        initialize();
      } else {
        if (STATE.shadowRoot && STATE.shadowRoot.widgetContainer) {
          renderWidget();
        } else if (!STATE.initialized) {
          injectWidgetSafely();
        }
      }
    }
  }

  function openPlanYTPopup() {
    // Backwards-compatible simple open
    chrome.runtime.sendMessage(
      { type: 'OPEN_PLANYT_POPUP' },
      () => {
        if (chrome.runtime.lastError) {
          console.warn('PlanYT widget: Error opening popup', chrome.runtime.lastError);
        }
      }
    );
  }

  function openPlanYTPopup(action) {
    // action: 'open' -> open existing plan; 'create' -> create new plan for current playlist
    const playlistId = extractPlaylistIdFromPage();
    const playlistUrl = window.location.href;

    if (action === 'open') {
      chrome.runtime.sendMessage({ type: 'OPEN_SPECIFIC_PLAN', playlistId }, () => {
        if (chrome.runtime.lastError) console.warn('PlanYT widget: OPEN_SPECIFIC_PLAN error', chrome.runtime.lastError);
      });
      return;
    }

    if (action === 'create') {
      chrome.runtime.sendMessage({ type: 'CREATE_PLAN_FOR_PLAYLIST', playlistUrl, playlistId }, () => {
        if (chrome.runtime.lastError) console.warn('PlanYT widget: CREATE_PLAN_FOR_PLAYLIST error', chrome.runtime.lastError);
      });
      return;
    }

    // Fallback
    chrome.runtime.sendMessage({ type: 'OPEN_PLANYT_POPUP' });
  }

  async function initialize() {
    if (STATE.initialized) {
      return;
    }

    if (!isPlaylistPage()) {
      return;
    }

    await injectWidgetSafely();
    await renderWidget();
  }

  function getWidgetStyles() {
    return `
      :host {
        --yt-bg-primary: #050510;
        --yt-bg-secondary: #050510;
        --yt-bg-tertiary: #11111f;
        --yt-bg-hover: rgba(0, 243, 255, 0.1);
        --yt-text-primary: #ffffff;
        --yt-text-secondary: #e6e6e6;
        --yt-text-tertiary: #bfbfbf;
        --yt-brand-red: #ff0000;
        --yt-brand-red-hover: #cc0000;
        --yt-accent: #00f3ff;
        --yt-accent-hover: #bc13fe;
        --yt-success: #0fb556;
        --yt-error: #ff4444;
        --yt-warning: #ff9800;
        --yt-space-xs: 4px;
        --yt-space-sm: 8px;
        --yt-space-md: 12px;
        --yt-space-lg: 16px;
        --yt-space-xl: 24px;
        --yt-radius-sm: 2px;
        --yt-radius-md: 8px;
        --yt-radius-lg: 12px;
        --yt-radius-full: 999px;
        --yt-transition: 0.1s cubic-bezier(0.05, 0, 0, 1);
      }

      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      .planyt-widget-container {
        display: block;
        width: 100%;
        color: var(--yt-text-primary);
        font-family: "Space Grotesk", "Roboto", "Arial", sans-serif;
        font-size: 14px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-bottom: 12px;
      }

      .container {
        padding: var(--yt-space-lg);
      }

      .section {
        margin-bottom: var(--yt-space-md);
        padding: var(--yt-space-lg);
        background-color: var(--yt-bg-secondary);
        border-radius: var(--yt-radius-md);
        border: 1px solid var(--yt-accent);
        box-shadow: 0 0 15px rgba(0, 243, 255, 0.15), inset 0 0 10px rgba(0, 243, 255, 0.05);
      }

      .section-compact {
        padding: var(--yt-space-md);
        margin-bottom: var(--yt-space-xs);
      }

      .plans-title {
        font-size: 13px;
        font-weight: 500;
        color: var(--yt-text-primary);
        letter-spacing: 0.2px;
        margin-bottom: var(--yt-space-sm);
        display: block;
      }

      .progress-hero {
        display: flex;
        flex-direction: column;
        gap: var(--yt-space-sm);
        margin-bottom: var(--yt-space-md);
      }

      .progress-hero-empty,
      .progress-hero-complete {
        gap: var(--yt-space-xs);
      }

      .progress-hero-percent {
        font-size: 20px;
        font-weight: 500;
        color: var(--yt-text-primary);
        letter-spacing: -0.2px;
      }

      .progress-hero-empty .progress-hero-percent,
      .progress-hero-complete .progress-hero-percent {
        font-size: 15px;
      }

      .progress-hero-subtext {
        font-size: 12px;
        color: var(--yt-text-secondary);
        font-weight: 400;
      }

      .progress-bar-container-hero {
        height: 10px;
        margin-top: var(--yt-space-xs);
      }

      .progress-bar-container {
        width: 100%;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .progress-bar {
        height: 100%;
        background-color: var(--yt-accent);
        transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 2px;
      }

      .meta-list {
        display: flex;
        flex-direction: column;
        gap: var(--yt-space-xs);
        margin-top: var(--yt-space-sm);
      }

      .meta-row {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: var(--yt-space-sm);
        padding: 0;
        min-height: 0;
      }

      .meta-label {
        font-weight: 500;
        color: var(--yt-text-secondary);
        font-size: 13px;
      }

      .meta-value {
        font-weight: 500;
        color: var(--yt-text-primary);
        font-size: 13px;
        text-align: right;
      }

      .meta-value.completed {
        color: var(--yt-success);
      }

      .progress-section {
        margin-top: var(--yt-space-xs);
      }

      .progress-bar-container {
        width: 100%;
        height: 4px;
        background-color: rgba(255, 255, 255, 0.1);
        border-radius: 2px;
        overflow: hidden;
      }

      .plans-footer {
        margin-top: var(--yt-space-xs);
        margin-bottom: var(--yt-space-md);
      }

      .btn {
        width: 100%;
        padding: 10px 16px;
        font-size: 14px;
        font-weight: 500;
        border: none;
        border-radius: var(--yt-radius-full);
        cursor: pointer;
        transition: all var(--yt-transition);
        text-align: center;
        font-family: "Roboto", sans-serif;
        letter-spacing: 0.2px;
      }

      .btn-secondary {
        background-color: var(--yt-accent);
        color: #050510;
        font-weight: 600;
        border: 1px solid var(--yt-accent);
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.4);
      }

      .btn-secondary:hover {
        background-color: var(--yt-accent-hover);
        color: #ffffff;
        border-color: var(--yt-accent-hover);
        box-shadow: 0 0 15px rgba(188, 19, 254, 0.6);
      }

      .btn-secondary:active {
        opacity: 0.9;
      }

      .btn-small {
        width: auto;
        padding: 6px 14px;
        font-size: 12px;
        background-color: rgba(80, 0, 0, 0.45);
        color: var(--yt-text-primary);
        border-radius: var(--yt-radius-full);
      }

      .btn-small:hover {
        background-color: rgba(80, 0, 0, 0.6);
      }

      @media (max-width: 500px) {
        .container {
          padding: var(--yt-space-md);
        }

        .section-compact {
          padding: var(--yt-space-md);
        }

        .progress-hero-percent {
          font-size: 18px;
        }

        .meta-row {
          align-items: flex-start;
          flex-direction: column;
          gap: 2px;
        }

        .meta-value {
          text-align: left;
        }
      }
    `;
  }

  function setupHealthCheck() {
    setInterval(() => {
      if (!isPlaylistPage()) {
        return;
      }

      const widgetHost = document.getElementById(CONFIG.WIDGET_HOST_ID);

      // Only reinject if genuinely missing OR detached from live DOM tree
      if (!widgetHost || !widgetHost.isConnected) {
        console.warn('PlanYT: Widget missing or detached, reinjecting');
        STATE.initialized = false;
        initialize();
      }
    }, 2000);
  }

  if (isPlaylistPage()) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        initialize();
        setupNavigationListeners();
        setupStorageListener();
        setupHealthCheck();
      });
    } else {
      initialize();
      setupNavigationListeners();
      setupStorageListener();
      setupHealthCheck();
    }
  } else {
    setupNavigationListeners();
    setupStorageListener();
    setupHealthCheck();
  }
})();