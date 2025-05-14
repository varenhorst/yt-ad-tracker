// Constants
const DB_NAME = 'videoDataDB';
const DB_VERSION = 1;
const OBJECT_STORE_NAME = 'videoData';
const BACKEND_URL = 'http://127.0.0.1:5000/get-transcripts';

// Global variables
let db;
let currentVideoId = null;
let animationFrameId = null;

// IndexedDB Utilities
async function initDatabase() {
  if (db) return;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve();
    };
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OBJECT_STORE_NAME)) {
        db.createObjectStore(OBJECT_STORE_NAME, { keyPath: 'videoId' });
      }
    };
  });
}

async function storeVideoData(videoId, data) {
  await initDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.put({ videoId, data });

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function getVideoData(videoId) {
  await initDatabase();
  
  return new Promise((resolve) => {
    const transaction = db.transaction(OBJECT_STORE_NAME, 'readonly');
    const store = transaction.objectStore(OBJECT_STORE_NAME);
    const request = store.get(videoId);

    request.onsuccess = () => resolve(request.result?.data || null);
    request.onerror = () => resolve(null);
  });
}

// Data Fetching
async function fetchTranscriptData(videoId) {
  try {
    const response = await fetch(`${BACKEND_URL}/${videoId}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("Error fetching transcript data:", error);
    throw error;
  }
}

// DOM Manipulation
function removeMarkers() {
  const progressBar = document.querySelector('.ytp-progress-bar');
  if (!progressBar) return;

  const existingMarkers = progressBar.querySelectorAll('.data-marker, .tooltip');
  existingMarkers.forEach(marker => marker.remove());
}

function createMarkerElement(startPosition, width, description) {
  const marker = document.createElement('div');
  marker.className = 'data-marker';
  marker.style.left = `${startPosition}%`;
  marker.style.width = `${width}%`;

  const tooltip = document.createElement('div');
  tooltip.className = 'tooltip';
  tooltip.textContent = description || 'No Description';
  tooltip.style.display = 'none';

  tooltip.style.position = 'absolute';
  tooltip.style.left = '0';
  tooltip.style.top = '30px';
  tooltip.style.background = 'black';
  tooltip.style.width = 'max-content';
  tooltip.style.padding = '10px';

  marker.appendChild(tooltip);

  marker.addEventListener('mouseenter', () => {
    tooltip.style.display = 'block';
  });

  marker.addEventListener('mouseleave', () => {
    tooltip.style.display = 'none';
  });

  return marker;
}

function placeDataOnProgressBar(data) {
  const progressBar = document.querySelector('.ytp-progress-bar');
  const videoPlayer = document.querySelector('video');
  
  if (!progressBar || !videoPlayer) {
    console.warn("Progress bar or video player not found.");
    return;
  }

  const duration = videoPlayer.duration;
  if (!duration || isNaN(duration)) {
    console.warn("Video duration not available yet.");
    return;
  }

  if (!Array.isArray(data)) return;

  data.forEach(item => {
    const startTime = parseFloat(item.start_time);
    const endTime = parseFloat(item.end_time);

    if (isNaN(startTime) || isNaN(endTime) || startTime < 0 || endTime > duration || startTime >= endTime) {
      console.warn("Invalid data point:", item);
      return;
    }

    const startPosition = (startTime / duration) * 100;
    const width = (endTime / duration) * 100 - startPosition;
    const marker = createMarkerElement(startPosition, width, item.description);
    progressBar.appendChild(marker);
  });
}

// Video Playback Control
function handleVideoPlayback(videoId, data) {
  const videoPlayer = document.querySelector('video');
  if (!videoPlayer) return;

  // Clean up previous animation frame if exists
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Parse and validate all time segments
  const timeSegments = data.map(item => ({
    start: parseFloat(item.start_time),
    end: parseFloat(item.end_time),
    isValid: !isNaN(parseFloat(item.start_time)) && !isNaN(parseFloat(item.end_time))
  })).filter(segment => segment.isValid && segment.start < segment.end);

  removeMarkers();
  placeDataOnProgressBar(data);

  function checkTime() {
    if (!videoPlayer) return;
    
    const currentTime = videoPlayer.currentTime;
    let shouldSkip = false;
    let skipToTime = currentTime;

    // Check all segments to see if current time falls within any of them
    for (const segment of timeSegments) {
      if (currentTime >= segment.start && currentTime < segment.end) {
        shouldSkip = true;
        skipToTime = Math.max(skipToTime, segment.end); // Skip to the end of the segment
      }
    }

    if (shouldSkip && skipToTime !== currentTime) {
      videoPlayer.currentTime = skipToTime;
    }

    animationFrameId = requestAnimationFrame(checkTime);
  }

  const startPlaybackHandler = () => {
    checkTime();
    videoPlayer.removeEventListener('loadedmetadata', startPlaybackHandler);
  };

  videoPlayer.addEventListener('loadedmetadata', startPlaybackHandler);
  if (videoPlayer.readyState > 0) startPlaybackHandler();
}

// Main Flow
async function fetchDataAndDisplay(videoId) {
  if (currentVideoId === videoId) return;
  currentVideoId = videoId;

  try {
    let data = await getVideoData(videoId);
    
    if (!data) {
      data = await fetchTranscriptData(videoId);
      await storeVideoData(videoId, data);
    }

    handleVideoPlayback(videoId, data);
  } catch (error) {
    console.error("Error during data retrieval/storage:", error);
  }
}

// Video Detection
function getCurrentVideoId() {
  return new URLSearchParams(window.location.search).get('v');
}

function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        const videoElement = document.querySelector('video');
        if (videoElement?.readyState > 0) {
          const videoId = getCurrentVideoId();
          if (videoId) {
            fetchDataAndDisplay(videoId);
            observer.disconnect();
          }
          break;
        }
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  return observer;
}

// Initialize
function init() {
  setupObserver();
  window.addEventListener('yt-page-data-updated', setupObserver);
}

init();