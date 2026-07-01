// ── Shared utilities ──────────────────────────────────────────

// Note name table used by pitch detection and piano keyboard
const NOTE_NAMES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

// Format seconds as M:SS
function formatDuration(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return m + ':' + s;
}
