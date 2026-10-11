/**
 * api.js
 * Handles backend API communication for playlist data
 * Backend proxies YouTube Data API v3 requests (no API key needed)
 */

// Backend API endpoints (production only)
// Replace the production URL with your deployed backend domain
const BACKEND_API_URLS = [
  'https://plan-up-jade.vercel.app/api/playlist-info'
];

/**
 * Extracts playlist ID from YouTube URL
 * Supports formats:
 *   - https://www.youtube.com/playlist?list=PLxxx
 *   - https://youtube.com/playlist?list=PLxxx
 *   - youtube.com/playlist?list=PLxxx
 * Returns null if invalid
 */
function extractPlaylistId(url) {
  if (!url) return null;
  
  // Match playlist ID from various URL formats
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Fetches complete playlist data from backend
 * No API key required - handled by backend
 * Returns: { title, videoCount, videos: [{ id, title, durationMinutes }] }
 */
async function fetchPlaylistData(playlistId) {
  const endpoints = BACKEND_API_URLS.map(base => `${base}?playlistId=${encodeURIComponent(playlistId)}`);
  let lastError = null;

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000); // 8s timeout per endpoint

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        let errorData = null;
        try {
          errorData = await response.json();
        } catch (_) {
          // Ignore JSON parse errors; treat as text or generic failure
        }
        throw new Error((errorData && errorData.error) || `Failed to fetch playlist data (${response.status})`);
      }

      const data = await response.json();

      return {
        title: data.title,
        videoCount: data.videoCount,
        videos: data.videos
      };
    } catch (error) {
      console.warn('Endpoint failed:', url, error.message);
      lastError = error;
      // Try next endpoint
    }
  }

  console.error('All endpoints failed:', lastError?.message || lastError);
  throw new Error('Could not reach backend. Ensure your server is running or update the backend URL.');
}
