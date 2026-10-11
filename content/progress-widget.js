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
    const isDefaultMessage = message === 'Plan this playlist with PlanUP';
    const displayHeading = isDefaultMessage ? 'Master This Playlist with Daily Goals' : message;

    container.innerHTML = `
      <div class="container">
        <section class="section section-compact">
          <div class="widget-header">
            <div class="brand-tag">
              <span class="brand-dot"></span>
              <span class="brand-name">PlanUP Tracker</span>
            </div>
          </div>

          <div class="widget-body">
            <h2 class="widget-heading">${displayHeading}</h2>
            <p class="widget-subtext">Set your daily watch pace, conquer target dates, and build consistent habits.</p>
          </div>

          <div class="plans-footer">
            <button class="btn btn-primary" id="planyt-empty-cta">
              <span>Create Study Plan</span>
              <svg class="btn-arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
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
          <div class="widget-header">
            <div class="brand-tag">
              <span class="brand-dot completed"></span>
              <span class="brand-name">Plan Finished</span>
            </div>
            <div class="progress-pill completed">100%</div>
          </div>

          <div class="widget-body">
            <h2 class="widget-heading">Playlist Completed!</h2>
            <p class="widget-subtext">Excellent work! You have finished all target sessions in this playlist.</p>
          </div>

          <div class="plans-footer">
            <button class="btn btn-primary" id="planyt-view-cta">
              <span>Review Plan</span>
              <svg class="btn-arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
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
    const todayTime = formatMinutes(todayTarget.totalMinutes);

    // Calculate completed vs total videos accurately
    let completedVideos = progress.completedVideos;
    let totalVideos = progress.totalVideos;

    if (completedVideos === undefined || totalVideos === undefined) {
      completedVideos = 0;
      totalVideos = 0;
      (plan.planData || []).forEach(day => {
        (day.videos || []).forEach(v => {
          totalVideos++;
          if (v.completed) completedVideos++;
        });
      });
    }

    const videosDoneLabel = `${completedVideos} / ${totalVideos}`;

    container.innerHTML = `
      <div class="container">
        <section class="section section-compact">
          <div class="widget-header">
            <div class="brand-tag">
              <span class="brand-dot active"></span>
              <span class="brand-name">Active Plan</span>
            </div>
            <div class="progress-pill">${progress.percent}% Completed</div>
          </div>

          <div class="progress-bar-wrapper">
            <div class="progress-bar-fill" style="width: ${progress.percent}%"></div>
          </div>

          <div class="stats-grid" id="progressSection">
            <div class="stat-card">
              <span class="stat-label">Videos Done</span>
              <span class="stat-value">${videosDoneLabel}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Remaining</span>
              <span class="stat-value">${daysRemaining} day${daysRemaining !== 1 ? 's' : ''}</span>
            </div>
            <div class="stat-card">
              <span class="stat-label">Watch Time</span>
              <span class="stat-value">${todayTime || formatMinutes(minutesRemaining)}</span>
            </div>
          </div>

          <div class="plans-footer">
            <button class="btn btn-primary" id="planyt-open-cta">
              <span>Open Plan Dashboard</span>
              <svg class="btn-arrow" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 8h10M9 4l4 4-4 4"/>
              </svg>
            </button>
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
        --yt-bg-card: rgba(14, 18, 27, 0.92);
        --yt-border-card: rgba(0, 240, 255, 0.22);
        --yt-border-card-hover: rgba(0, 240, 255, 0.45);
        --yt-text-primary: #ffffff;
        --yt-text-secondary: #94a3b8;
        --yt-text-muted: #64748b;
        --yt-accent: #00f0ff;
        --yt-accent-glow: rgba(0, 240, 255, 0.35);
        --yt-success: #00ff85;
        --yt-success-glow: rgba(0, 255, 133, 0.35);
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
        font-family: "Inter", "Roboto", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 14px;
        line-height: 1.4;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        margin-bottom: 14px;
      }

      .container {
        padding: 0;
      }

      .section {
        position: relative;
        padding: 16px 18px;
        background: linear-gradient(160deg, rgba(17, 24, 39, 0.95) 0%, rgba(10, 14, 23, 0.98) 100%);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border: 1px solid var(--yt-border-card);
        border-radius: 14px;
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.45), 0 0 1px rgba(0, 240, 255, 0.2);
        transition: border-color 0.25s ease, box-shadow 0.25s ease;
        overflow: hidden;
      }

      .section:hover {
        border-color: var(--yt-border-card-hover);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 16px rgba(0, 240, 255, 0.15);
      }

      .section::before {
        content: '';
        position: absolute;
        top: 0;
        left: 24px;
        right: 24px;
        height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 240, 255, 0.55), transparent);
        pointer-events: none;
      }

      .section-compact {
        padding: 16px 18px;
      }

      .widget-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-bottom: 12px;
      }

      .brand-tag {
        display: inline-flex;
        align-items: center;
        gap: 7px;
        padding: 3px 9px;
        background: rgba(0, 240, 255, 0.08);
        border: 1px solid rgba(0, 240, 255, 0.22);
        border-radius: 999px;
      }

      .brand-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: var(--yt-accent);
        box-shadow: 0 0 8px var(--yt-accent);
        display: inline-block;
      }

      .brand-dot.completed {
        background: var(--yt-success);
        box-shadow: 0 0 8px var(--yt-success);
      }

      .brand-name {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.6px;
        text-transform: uppercase;
        color: var(--yt-text-secondary);
      }

      .progress-pill {
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.3px;
        color: var(--yt-accent);
        background: rgba(0, 240, 255, 0.12);
        border: 1px solid rgba(0, 240, 255, 0.28);
        padding: 3px 10px;
        border-radius: 999px;
        white-space: nowrap;
      }

      .progress-pill.completed {
        color: var(--yt-success);
        background: rgba(0, 255, 133, 0.12);
        border-color: rgba(0, 255, 133, 0.28);
      }

      .widget-body {
        margin-bottom: 16px;
      }

      .widget-heading {
        font-size: 15px;
        font-weight: 600;
        line-height: 1.35;
        color: #ffffff;
        letter-spacing: -0.2px;
        margin-bottom: 5px;
      }

      .widget-subtext {
        font-size: 12px;
        line-height: 1.45;
        color: var(--yt-text-secondary);
      }

      .progress-bar-wrapper {
        width: 100%;
        height: 6px;
        background: rgba(255, 255, 255, 0.08);
        border-radius: 999px;
        overflow: hidden;
        margin-bottom: 14px;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #00f0ff 0%, #7000ff 100%);
        border-radius: 999px;
        box-shadow: 0 0 10px rgba(0, 240, 255, 0.45);
        transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 16px;
      }

      .stat-card {
        background: rgba(255, 255, 255, 0.035);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 8px;
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 3px;
        transition: background 0.2s ease, border-color 0.2s ease;
      }

      .stat-card:hover {
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.12);
      }

      .stat-label {
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: var(--yt-text-muted);
      }

      .stat-value {
        font-size: 12px;
        font-weight: 600;
        color: #ffffff;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .stat-value.completed {
        color: var(--yt-success);
      }

      .plans-footer {
        margin-top: 0;
      }

      .btn {
        width: 100%;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 10px 18px;
        font-size: 13px;
        font-weight: 600;
        letter-spacing: 0.3px;
        border: none;
        border-radius: 999px;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        text-align: center;
        font-family: inherit;
        text-decoration: none;
        box-sizing: border-box;
      }

      .btn-primary {
        background: linear-gradient(135deg, #00f0ff 0%, #00b4d8 100%);
        color: #070a10;
        box-shadow: 0 4px 16px rgba(0, 240, 255, 0.35);
      }

      .btn-primary:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 22px rgba(0, 240, 255, 0.5);
        background: linear-gradient(135deg, #33f3ff 0%, #00c6ff 100%);
      }

      .btn-primary:active {
        transform: translateY(0);
        box-shadow: 0 2px 10px rgba(0, 240, 255, 0.3);
      }

      .btn-arrow {
        transition: transform 0.2s ease;
      }

      .btn-primary:hover .btn-arrow {
        transform: translateX(3px);
      }

      @media (max-width: 500px) {
        .section {
          padding: 14px;
        }

        .stats-grid {
          grid-template-columns: 1fr;
          gap: 6px;
        }

        .stat-card {
          flex-direction: row;
          justify-content: space-between;
          align-items: center;
          padding: 6px 10px;
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