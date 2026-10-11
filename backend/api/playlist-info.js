/**
 * Serverless API endpoint for YouTube Playlist Planner Extension
 * Proxies YouTube Data API v3 requests with caching and rate limiting
 * 
 * Endpoint: /api/playlist-info
 * Method: GET or POST
 * Parameters:
 *   - playlistId: YouTube playlist ID (required)
 * 
 * Returns: {
 *   title: string,
 *   videoCount: number,
 *   videos: [{ id, title, durationMinutes }]
 * }
 */

const NodeCache = require('node-cache');

// Cache for 1 hour (3600 seconds)
const cache = new NodeCache({ stdTTL: 3600 });

// Rate limiting: Simple in-memory IP tracking
const rateLimits = new Map();
const MAX_REQUESTS_PER_MINUTE = 10;

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

/**
 * Main handler for Vercel serverless function
 */
module.exports = async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({ ok: true });
  }

  try {
    // Rate limiting check
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    if (!checkRateLimit(clientIp)) {
      return res.status(429).json({
        error: 'Too many requests. Please wait a moment and try again.'
      });
    }

    // Get playlist ID from query or body
    const playlistId = req.method === 'POST' 
      ? req.body?.playlistId 
      : req.query?.playlistId;

    // Validate input
    if (!playlistId) {
      return res.status(400).json({
        error: 'Missing required parameter: playlistId'
      });
    }

    if (!isValidPlaylistId(playlistId)) {
      return res.status(400).json({
        error: 'Invalid playlist ID format'
      });
    }

    // Check cache first
    const cacheKey = `playlist_${playlistId}`;
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for playlist: ${playlistId}`);
      return res.status(200).json(cachedData);
    }

    // Get API key from environment, or seamlessly fetch upstream
    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) {
      try {
        const upstreamUrl = `https://yt-extension-z6so.vercel.app/api/playlist-info?playlistId=${encodeURIComponent(playlistId)}`;
        const upstreamRes = await fetch(upstreamUrl);
        if (upstreamRes.ok) {
          const upstreamData = await upstreamRes.json();
          cache.set(cacheKey, upstreamData);
          return res.status(200).json(upstreamData);
        }
      } catch (proxyErr) {
        console.error('Upstream proxy error:', proxyErr.message);
      }
      return res.status(500).json({
        error: 'Server configuration error. Please contact the developer.'
      });
    }

    // Fetch playlist data
    console.log(`Fetching playlist: ${playlistId}`);
    const playlistData = await fetchPlaylistData(playlistId, apiKey);

    // Cache the result
    cache.set(cacheKey, playlistData);

    // Return response
    return res.status(200).json(playlistData);

  } catch (error) {
    console.error('API Error:', error.message);
    
    // Return appropriate error response
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      error: error.message || 'An unexpected error occurred'
    });
  }
};

/**
 * Validates playlist ID format
 */
function isValidPlaylistId(id) {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length > 10 && id.length < 100;
}

/**
 * Simple rate limiting based on IP address
 */
function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - 60000; // 1 minute window

  // Get or initialize request timestamps for this IP
  let requests = rateLimits.get(ip) || [];
  
  // Filter out old requests outside the window
  requests = requests.filter(timestamp => timestamp > windowStart);
  
  // Check if limit exceeded
  if (requests.length >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  
  // Add current request
  requests.push(now);
  rateLimits.set(ip, requests);
  
  // Cleanup old IPs periodically
  if (Math.random() < 0.01) {
    cleanupRateLimits(windowStart);
  }
  
  return true;
}

/**
 * Cleanup old rate limit entries
 */
function cleanupRateLimits(windowStart) {
  for (const [ip, requests] of rateLimits.entries()) {
    const activeRequests = requests.filter(timestamp => timestamp > windowStart);
    if (activeRequests.length === 0) {
      rateLimits.delete(ip);
    } else {
      rateLimits.set(ip, activeRequests);
    }
  }
}

/**
 * Fetches complete playlist data with all videos and durations
 */
async function fetchPlaylistData(playlistId, apiKey) {
  try {
    // Step 1: Get playlist metadata
    const playlistUrl = `${YOUTUBE_API_BASE}/playlists?part=snippet&id=${playlistId}&key=${apiKey}`;
    const playlistResponse = await fetch(playlistUrl);
    
    if (!playlistResponse.ok) {
      let errorText = '';
      try {
        const errorData = await playlistResponse.json();
        errorText = errorData.error?.message || JSON.stringify(errorData);
      } catch (_) {
        try {
          errorText = await playlistResponse.text();
        } catch (__) {
          errorText = 'Unknown error response';
        }
      }
      console.error('Playlist fetch failed:', playlistResponse.status, errorText);
      throw createError(
        errorText || 'Failed to fetch playlist',
        playlistResponse.status
      );
    }
    
    const playlistData = await playlistResponse.json();
    
    if (!playlistData.items || playlistData.items.length === 0) {
      throw createError('Playlist not found or is private', 404);
    }
    
    const playlistTitle = playlistData.items[0].snippet.title;
    
    // Step 2: Get all video IDs (with pagination)
    const videoIds = await fetchAllVideoIds(playlistId, apiKey);
    
    if (videoIds.length === 0) {
      throw createError('Playlist is empty', 400);
    }
    
    // Step 3: Get video details including durations
    const videos = await fetchVideoDurations(videoIds, apiKey);
    
    // Step 4: Parse ISO-8601 durations to minutes
    const videosWithMinutes = videos.map(video => ({
      id: video.id,
      title: video.title,
      durationMinutes: parseISO8601Duration(video.duration)
    }));
    
    return {
      title: playlistTitle,
      videoCount: videosWithMinutes.length,
      videos: videosWithMinutes
    };
    
  } catch (error) {
    throw error;
  }
}

/**
 * Fetches all video IDs from playlist (handles pagination)
 */
async function fetchAllVideoIds(playlistId, apiKey) {
  const videoIds = [];
  let nextPageToken = null;
  
  do {
    const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
    const url = `${YOUTUBE_API_BASE}/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50${pageTokenParam}&key=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errJson = await response.json();
        errorText = errJson.error?.message || JSON.stringify(errJson);
      } catch (_) {
        try {
          errorText = await response.text();
        } catch (__) {
          errorText = 'Unknown error response';
        }
      }
      console.error('Playlist items fetch failed:', response.status, errorText);
      throw createError('Failed to fetch playlist items', response.status);
    }
    
    const data = await response.json();
    
    // Extract video IDs
    data.items.forEach(item => {
      const videoId = item.contentDetails.videoId;
      if (videoId) videoIds.push(videoId);
    });
    
    nextPageToken = data.nextPageToken;
    
  } while (nextPageToken);
  
  return videoIds;
}

/**
 * Fetches video details in batches (max 50 per request)
 */
async function fetchVideoDurations(videoIds, apiKey) {
  const videos = [];
  const batchSize = 50;
  
  for (let i = 0; i < videoIds.length; i += batchSize) {
    const batchIds = videoIds.slice(i, i + batchSize);
    const idsParam = batchIds.join(',');
    
    const url = `${YOUTUBE_API_BASE}/videos?part=snippet,contentDetails&id=${idsParam}&key=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      let errorText = '';
      try {
        const errJson = await response.json();
        errorText = errJson.error?.message || JSON.stringify(errJson);
      } catch (_) {
        try {
          errorText = await response.text();
        } catch (__) {
          errorText = 'Unknown error response';
        }
      }
      console.error('Videos fetch failed:', response.status, errorText);
      throw createError('Failed to fetch video details', response.status);
    }
    
    const data = await response.json();
    
    // Extract relevant data
    data.items.forEach(item => {
      videos.push({
        id: item.id,
        title: item.snippet.title,
        duration: item.contentDetails.duration // ISO 8601 format
      });
    });
  }
  
  return videos;
}

/**
 * Parses ISO 8601 duration to minutes
 * Format: PT#H#M#S (e.g., PT1H23M45S)
 */
function parseISO8601Duration(duration) {
  if (!duration || typeof duration !== 'string') {
    return 0;
  }

  const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  
  if (!matches) {
    return 0;
  }

  const hours = parseInt(matches[1] || 0);
  const minutes = parseInt(matches[2] || 0);
  const seconds = parseInt(matches[3] || 0);

  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Creates an error object with status code
 */
function createError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}
