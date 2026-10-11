/**
 * plans.js
 * Manages multiple playlist plans and their persistence
 * Stores plans in chrome.storage.local with structure:
 * {
 *   plans: [...],
 *   activePlanId: "id"
 * }
 */

const PLANS_STORAGE_KEY = 'playlistPlans';

/**
 * Generate a unique ID for a plan
 */
function generatePlanId() {
  return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Derive progress from planData (single source of truth)
 * @param {Array} planData
 * @returns {{percent:number,completedDays:number,totalDays:number,currentDay:number,lastWatchedIndex:number}}
 */
function deriveProgressFromPlanData(planData) {
  if (!Array.isArray(planData) || planData.length === 0) {
    return {
      percent: 0,
      completedDays: 0,
      totalDays: 0,
      currentDay: 1,
      lastWatchedIndex: 0
    };
  }

  let completedVideos = 0;
  let completedDays = 0;
  let totalVideos = 0;
  const totalDays = planData.length;

  planData.forEach(dayData => {
    const dayVideos = Array.isArray(dayData.videos) ? dayData.videos : [];
    totalVideos += dayVideos.length;
    if (dayData.completed) {
      completedDays += 1;
      completedVideos += dayVideos.length;
    } else {
      let dayCompletedCount = 0;
      dayVideos.forEach(video => {
        if (video.completed) {
          dayCompletedCount += 1;
        }
      });
      completedVideos += dayCompletedCount;
    }
  });

  const currentDay = calculateCurrentDayFromPlanData(planData, completedVideos);
  const percent = totalVideos > 0 ? Math.round((completedVideos / totalVideos) * 100) : 0;

  return {
    percent,
    completedDays,
    totalDays,
    currentDay,
    lastWatchedIndex: completedVideos
  };
}

/**
 * Initialize or get plans data from storage
 */
async function getPlansData() {
  try {
    const data = await getFromStorage(PLANS_STORAGE_KEY);
    return data || { plans: [], activePlanId: null };
  } catch (error) {
    console.error('Error loading plans:', error);
    return { plans: [], activePlanId: null };
  }
}

/**
 * Save plans data to storage
 */
async function savePlansData(data) {
  try {
    await saveToStorage(PLANS_STORAGE_KEY, data);
  } catch (error) {
    console.error('Error saving plans:', error);
    throw error;
  }
}

/**
 * Create a new plan from current playlist data
 */
async function createPlan(playlistData, dailyWatchTime, plan, playbackSpeed = 1.0, mode = 'custom') {
  const plansData = await getPlansData();
  
  // Calculate total days needed
  const totalDays = plan.length;
  
  const newPlan = {
    id: generatePlanId(),
    title: playlistData.title,
    playlistUrl: playlistData.url || '',
    totalVideos: playlistData.videoCount,
    dailyMinutes: mode === 'video-by-video' ? null : dailyWatchTime,
    playbackSpeed: mode === 'video-by-video' ? null : playbackSpeed,
    mode: mode,
    isOneShot: !!(playlistData.isOneShot || (playlistData.url && playlistData.url.includes('watch?v=') && !playlistData.url.includes('list='))),
    videosPerDay: mode === 'video-by-video' ? 1 : (plan[0]?.videos?.length || 0),
    createdAt: Date.now(),
    totalDays: totalDays,
    progress: deriveProgressFromPlanData(plan),
    // Store the plan data for display
    planData: plan
  };
  
  plansData.plans.push(newPlan);
  
  // Set as active plan for deterministic creation flow
  plansData.activePlanId = newPlan.id;
  
  await savePlansData(plansData);
  return newPlan;
}

/**
 * Get active plan
 */
async function getActivePlan() {
  const plansData = await getPlansData();
  if (!plansData.activePlanId) return null;
  
  return plansData.plans.find(p => p.id === plansData.activePlanId) || null;
}

/**
 * Set active plan by ID
 */
async function setActivePlan(planId) {
  const plansData = await getPlansData();
  if (plansData.plans.some(p => p.id === planId)) {
    plansData.activePlanId = planId;
    await savePlansData(plansData);
    return true;
  }
  return false;
}

/**
 * Get all plans
 */
async function getAllPlans() {
  const plansData = await getPlansData();
  return plansData.plans;
}

/**
 * Delete a plan by ID
 * Ensures activePlanId is reset if the deleted plan was active
 * Returns updated activePlanId after deletion
 */
async function deletePlan(planId) {
  // Step 1: Fetch current state from storage
  const plansData = await getPlansData();
  const planIndex = plansData.plans.findIndex(p => p.id === planId);

  // Step 2: Validate plan exists
  if (planIndex === -1) {
    return { deleted: false, activePlanId: plansData.activePlanId };
  }

  // Step 3: Remove plan from array
  plansData.plans.splice(planIndex, 1);

  // Step 4: Reset activePlanId if it pointed to deleted plan
  if (plansData.activePlanId === planId) {
    plansData.activePlanId = plansData.plans.length > 0 ? plansData.plans[0].id : null;
  }

  // Step 5: Persist updated state to chrome.storage.local
  await savePlansData(plansData);

  return { deleted: true, activePlanId: plansData.activePlanId };
}

/**
 * Validate and fix plans state on load
 * Ensures activePlanId points to an existing plan
 * If activePlanId references a deleted plan, resets it to null
 */
async function validateAndFixPlansState() {
  try {
    const plansData = await getPlansData();
    
    // Check if activePlanId exists in plans array
    const planExists = plansData.activePlanId && 
                       plansData.plans.some(p => p.id === plansData.activePlanId);
    
    // If activePlanId doesn't exist in plans, reset it
    if (plansData.activePlanId && !planExists) {
      console.warn(`Stale activePlanId detected: ${plansData.activePlanId}. Resetting to null.`);
      plansData.activePlanId = null;
      await savePlansData(plansData);
    }
    
    return plansData;
  } catch (error) {
    console.error('Error validating plans state:', error);
    return { plans: [], activePlanId: null };
  }
}

/**
 * Update plan progress
 */
async function updatePlanProgress(planId, progressData) {
  const plansData = await getPlansData();
  const plan = plansData.plans.find(p => p.id === planId);
  
  if (plan) {
    if (progressData) {
      console.warn('Deprecated: updatePlanProgress ignores stored progress and derives from planData.');
    }
    plan.progress = deriveProgressFromPlanData(plan.planData);
    await savePlansData(plansData);
    return true;
  }
  return false;
}

/**
 * Calculate progress percentage
 */
function calculateProgressPercentage(plan) {
  if (!plan || plan.totalVideos === 0) return 0;
  const derived = deriveProgressFromPlanData(plan.planData);
  return derived.percent;
}

/**
 * Calculate current day based on progress
 */
function calculateCurrentDay(plan) {
  if (!plan || !plan.planData) return 1;
  const derived = deriveProgressFromPlanData(plan.planData);
  return derived.currentDay;
}

/**
 * Calculate current day purely from planData and completed count
 * @param {Array} planData
 * @param {number} completedVideos
 * @returns {number}
 */
function calculateCurrentDayFromPlanData(planData, completedVideos) {
  if (!Array.isArray(planData) || planData.length === 0) return 1;

  let watchedVideos = 0;
  for (let dayIndex = 0; dayIndex < planData.length; dayIndex++) {
    const dayVideos = Array.isArray(planData[dayIndex].videos) ? planData[dayIndex].videos.length : 0;
    if (watchedVideos + dayVideos <= completedVideos) {
      watchedVideos += dayVideos;
    } else {
      return dayIndex + 1;
    }
  }
  return planData.length;
}

/**
 * Update stored plan data (including progress derived from completion)
 */
async function updatePlanData(planId, planData) {
  const plansData = await getPlansData();
  const plan = plansData.plans.find(p => p.id === planId);

  if (!plan) return false;

  plan.planData = planData;
  plan.progress = deriveProgressFromPlanData(planData);

  await savePlansData(plansData);
  return true;
}

/**
 * Toggle completed state for a single video inside a day card
 */
async function toggleVideoCompleted(planId, dayIndex, videoIndex, value) {
  const plansData = await getPlansData();
  const plan = plansData.plans.find(p => p.id === planId);
  if (!plan || !plan.planData || !plan.planData[dayIndex]) return false;

  const dayData = plan.planData[dayIndex];
  if (!dayData.videos || !dayData.videos[videoIndex]) return false;

  dayData.videos[videoIndex].completed = value;

  // Check if all videos in this day are completed
  const allCompleted = dayData.videos.every(video => video.completed === true);
  dayData.completed = allCompleted;

  plan.progress = deriveProgressFromPlanData(plan.planData);
  await savePlansData(plansData);

  // Sync to legacy storage key 'planData' as well if this is the active plan
  if (plansData.activePlanId === planId) {
    await saveToStorage('planData', {
      playlistData: {
        id: plan.playlistUrl || '',
        url: plan.playlistUrl || '',
        title: plan.title,
        videoCount: plan.totalVideos,
        totalDuration: plan.planData.reduce((sum, day) => sum + (day.totalTime || 0), 0),
        videos: []
      },
      plan: plan.planData,
      dailyWatchTime: plan.dailyMinutes
    });
  }

  return true;
}

/**
 * Toggle completed state for an entire day card
 */
async function toggleDayCompleted(planId, dayIndex, value) {
  const plansData = await getPlansData();
  const plan = plansData.plans.find(p => p.id === planId);
  if (!plan || !plan.planData || !plan.planData[dayIndex]) return false;

  const dayData = plan.planData[dayIndex];
  dayData.completed = value;

  if (Array.isArray(dayData.videos)) {
    dayData.videos.forEach(video => {
      video.completed = value;
    });
  }

  plan.progress = deriveProgressFromPlanData(plan.planData);
  await savePlansData(plansData);

  // Sync to legacy storage key 'planData' as well if this is the active plan
  if (plansData.activePlanId === planId) {
    await saveToStorage('planData', {
      playlistData: {
        id: plan.playlistUrl || '',
        url: plan.playlistUrl || '',
        title: plan.title,
        videoCount: plan.totalVideos,
        totalDuration: plan.planData.reduce((sum, day) => sum + (day.totalTime || 0), 0),
        videos: []
      },
      plan: plan.planData,
      dailyWatchTime: plan.dailyMinutes
    });
  }

  return true;
}
