// ── Audio file loader ─────────────────────────────────────────
// Exposes `audioFile` object for future playback/loop/pitch steps.
const audioFile = {
  ctx:        null,   // AudioContext (created on first load)
  buffer:     null,   // decoded AudioBuffer
  source:     null,   // current BufferSourceNode (set on play)
  gainNode:   null,   // master gain (set on load)
  fileName:   null,   // original filename string
  duration:   0,      // seconds
};

document.getElementById('audioFileInput').addEventListener('change', async function (e) {
  const file = e.target.files[0];
  if (!file) return;

  document.getElementById('uploadFilename').textContent = 'Loading…';

  // Create (or reuse) a dedicated AudioContext for file playback
  if (!audioFile.ctx) {
    audioFile.ctx = new (window.AudioContext || window.webkitAudioContext)();
    audioFile.gainNode = audioFile.ctx.createGain();
    audioFile.gainNode.connect(audioFile.ctx.destination);
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const decoded     = await audioFile.ctx.decodeAudioData(arrayBuffer);

    audioFile.buffer   = decoded;
    audioFile.duration = decoded.duration;
    audioFile.fileName = file.name;

    document.getElementById('uploadFilename').textContent =
      file.name + '  ·  ' + formatDuration(decoded.duration);

  } catch (err) {
    document.getElementById('uploadFilename').textContent = 'Error decoding file';
    console.error('Audio decode error:', err);
  }

  // Reset input so the same file can be re-loaded if needed
  e.target.value = '';
});

// ── Playback controls ─────────────────────────────────────────
// Uses audioFile.buffer / .ctx / .gainNode set by the upload step.
// Tracks position manually (BufferSourceNode doesn't support pause).

const playback = {
  isPlaying:   false,
  startedAt:   0,     // audioFile.ctx.currentTime when play was called
  pausedAt:    0,     // audioFile.duration-relative offset when paused
  timerId:     null,  // setInterval id for clock display
};

// Called by the upload step after a file is decoded — enables the button.
const _origFileInput = document.getElementById('audioFileInput');
_origFileInput.addEventListener('change', function () {
  // Wait one tick so the upload handler decodes first
  setTimeout(() => {
    const btn = document.getElementById('playPauseBtn');
    if (audioFile.buffer) {
      btn.disabled = false;
      playback.pausedAt = 0;
      updatePlaybackTime(0);
    }
  }, 300);
});

function togglePlayback() {
  if (!audioFile.buffer) return;
  playback.isPlaying ? pauseAudioFile() : playAudioFile();
}

function playAudioFile() {
  if (!audioFile.buffer || playback.isPlaying) return;

  // Resume suspended context (browser autoplay policy)
  if (audioFile.ctx.state === 'suspended') audioFile.ctx.resume();

  const source = audioFile.ctx.createBufferSource();
  source.buffer = audioFile.buffer;
  source.connect(audioFile.gainNode);

  source.start(0, playback.pausedAt);
  playback.startedAt = audioFile.ctx.currentTime - playback.pausedAt;
  playback.isPlaying = true;
  audioFile.source   = source;   // expose for future steps (A/B loop, etc.)

  source.onended = () => {
    // Only treat as natural end if we didn't pause manually
    if (playback.isPlaying) stopAudioFile();
  };

  document.getElementById('playPauseBtn').textContent = '⏸ Pause';
  startClock();
}

function pauseAudioFile() {
  if (!playback.isPlaying) return;
  playback.pausedAt = audioFile.ctx.currentTime - playback.startedAt;
  audioFile.source.onended = null;  // prevent stopAudioFile firing
  audioFile.source.stop();
  playback.isPlaying = false;
  document.getElementById('playPauseBtn').textContent = '▶ Play';
  stopClock();
}

function stopAudioFile() {
  playback.isPlaying = false;
  playback.pausedAt  = 0;
  if (audioFile.source) { audioFile.source.onended = null; audioFile.source.stop(); }
  document.getElementById('playPauseBtn').textContent = '▶ Play';
  stopClock();
  updatePlaybackTime(0);
}

// Clock display
function startClock() {
  stopClock();
  playback.timerId = setInterval(() => {
    if (!playback.isPlaying) return;
    const elapsed = audioFile.ctx.currentTime - playback.startedAt;
    updatePlaybackTime(Math.min(elapsed, audioFile.duration));
  }, 250);
}

function stopClock() {
  clearInterval(playback.timerId);
  playback.timerId = null;
}

function updatePlaybackTime(elapsed) {
  document.getElementById('playbackTime').textContent =
    formatDuration(elapsed) + ' / ' + formatDuration(audioFile.duration);
}

// ── Scrub bar ─────────────────────────────────────────────────
const scrubSlider = document.getElementById('scrubSlider');
let isScrubbing = false;

// User starts dragging
scrubSlider.addEventListener('mousedown',  () => { isScrubbing = true; });
scrubSlider.addEventListener('touchstart', () => { isScrubbing = true; }, { passive: true });

// User releases — seek to new position
scrubSlider.addEventListener('mouseup',  commitScrub);
scrubSlider.addEventListener('touchend', commitScrub);

function commitScrub() {
  if (!audioFile.buffer) return;
  const wasPlaying = playback.isPlaying;
  if (wasPlaying) pauseAudioFile();
  playback.pausedAt = (scrubSlider.value / 100) * audioFile.duration;
  isScrubbing = false;
  if (wasPlaying) playAudioFile();
  updatePlaybackTime(playback.pausedAt);
}

// Patch the clock so it also drives the scrub slider
const _origStartClock = startClock;
startClock = function () {
  _origStartClock();
  // Piggyback on the existing 250ms interval via a parallel one
  playback.scrubTimerId = setInterval(() => {
    if (!playback.isPlaying || isScrubbing) return;
    const elapsed = audioFile.ctx.currentTime - playback.startedAt;
    scrubSlider.value = Math.min((elapsed / audioFile.duration) * 100, 100);
  }, 250);
};

const _origStopClock = stopClock;
stopClock = function () {
  _origStopClock();
  clearInterval(playback.scrubTimerId);
};

// Enable slider and reset when a new file loads
const _scrubFileInput = document.getElementById('audioFileInput');
_scrubFileInput.addEventListener('change', () => {
  setTimeout(() => {
    if (audioFile.buffer) {
      scrubSlider.disabled = false;
      scrubSlider.value = 0;
    }
  }, 350); // slightly after the upload handler's own 300ms timeout
});

// Reset slider when playback reaches natural end
const _origStopAudioFile = stopAudioFile;
stopAudioFile = function () {
  _origStopAudioFile();
  scrubSlider.value = 0;
};

// ── A/B loop marker state ─────────────────────────────────────
const loop = {
  A: null,   // seconds | null
  B: null,   // seconds | null
};

function setLoopPoint(point) {
  if (!audioFile.buffer) return;

  // Current playback position in seconds
  const now = playback.isPlaying
    ? audioFile.ctx.currentTime - playback.startedAt
    : playback.pausedAt;

  if (point === 'A') {
    // If B is already set, don't allow A to be placed after it
    if (loop.B !== null && now >= loop.B) return;
    loop.A = now;
    document.getElementById('setABtn').classList.add('set');

  } else {
    // If A is already set, don't allow B to be placed before it
    if (loop.A !== null && now <= loop.A) return;
    loop.B = now;
    document.getElementById('setBBtn').classList.add('set');
  }

  updateAbDisplay();
}

function clearLoopPoints() {
  loop.A = null;
  loop.B = null;
  document.getElementById('setABtn').classList.remove('set');
  document.getElementById('setBBtn').classList.remove('set');
  updateAbDisplay();
}

function updateAbDisplay() {
  const aText = loop.A !== null ? formatDuration(loop.A) : '—';
  const bText = loop.B !== null ? formatDuration(loop.B) : '—';
  const spans = document.getElementById('abDisplay').querySelectorAll('span');
  spans[0].textContent = aText;
  spans[1].textContent = bText;
}

// Enable A/B buttons when a file is loaded (piggyback on upload event)
document.getElementById('audioFileInput').addEventListener('change', () => {
  setTimeout(() => {
    if (audioFile.buffer) {
      document.getElementById('setABtn').disabled = false;
      document.getElementById('setBBtn').disabled = false;
      clearLoopPoints(); // reset markers on new file
    }
  }, 360); // just after scrub bar's 350ms timeout
});

// ── A/B loop engine ───────────────────────────────────────────
// Simple enable flag. Set to true to activate looping.
// Future UI toggle only needs to flip this boolean.
let abLoopEnabled = true;

setInterval(() => {
  if (!abLoopEnabled)        return;
  if (!playback.isPlaying)   return;
  if (loop.A === null || loop.B === null) return;

  const now = audioFile.ctx.currentTime - playback.startedAt;

  if (now >= loop.B) {
    // Seek back to A without stopping the source —
    // pause/resume via existing functions to keep state consistent.
    pauseAudioFile();
    playback.pausedAt = loop.A;
    playAudioFile();
  }
}, 100); // 100ms is tight enough for a clean loop, won't affect pitch detection
