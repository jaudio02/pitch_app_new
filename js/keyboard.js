// ── Piano keyboard C4–C5 ──────────────────────────────────────
(function buildPiano() {
  // Notes in order: white keys get rendered in flex, black keys positioned absolutely
 const keys = [
  { note: 'C',  octave: 3, type: 'white' },
  { note: 'C#', octave: 3, type: 'black', offset: 1 },
  { note: 'D',  octave: 3, type: 'white' },
  { note: 'D#', octave: 3, type: 'black', offset: 2 },
  { note: 'E',  octave: 3, type: 'white' },
  { note: 'F',  octave: 3, type: 'white' },
  { note: 'F#', octave: 3, type: 'black', offset: 4 },
  { note: 'G',  octave: 3, type: 'white' },
  { note: 'G#', octave: 3, type: 'black', offset: 5 },
  { note: 'A',  octave: 3, type: 'white' },
  { note: 'A#', octave: 3, type: 'black', offset: 6 },
  { note: 'B',  octave: 3, type: 'white' },
  { note: 'C',  octave: 4, type: 'white' },
  { note: 'C#', octave: 4, type: 'black', offset: 8 },
  { note: 'D',  octave: 4, type: 'white' },
  { note: 'D#', octave: 4, type: 'black', offset: 9 },
  { note: 'E',  octave: 4, type: 'white' },
  { note: 'F',  octave: 4, type: 'white' },
  { note: 'F#', octave: 4, type: 'black', offset: 11 },
  { note: 'G',  octave: 4, type: 'white' },
  { note: 'G#', octave: 4, type: 'black', offset: 12 },
  { note: 'A',  octave: 4, type: 'white' },
  { note: 'A#', octave: 4, type: 'black', offset: 13 },
  { note: 'B',  octave: 4, type: 'white' },
  { note: 'C',  octave: 5, type: 'white' },
];

  // Midi note → frequency
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function noteToMidi(note, octave) {
    return NOTE_NAMES.indexOf(note) + (octave + 1) * 12;
  }

  const container = document.getElementById('pianoKeys');
  const WHITE_COUNT = keys.filter(k => k.type === 'white').length; // 8

  keys.forEach(k => {
    const btn = document.createElement('button');
    btn.className = 'key ' + k.type;
    btn.dataset.note   = k.note;
    btn.dataset.octave = k.octave;

    if (k.type === 'black') {
      // Position black key between the correct white keys.
      // Each white key occupies (100 / WHITE_COUNT)% width.
      const pct = 100 / WHITE_COUNT;
      btn.style.left = (k.offset * pct - pct * 0.35) + '%';
    }

    const label = document.createElement('span');
    label.className = 'key-label';
    label.textContent = k.note + k.octave;
    btn.appendChild(label);

    btn.addEventListener('mousedown', () => pianoPlay(k.note, k.octave, btn));
    btn.addEventListener('touchstart', e => { e.preventDefault(); pianoPlay(k.note, k.octave, btn); }, { passive: false });

    container.appendChild(btn);
  });

  // ── Tone.js Sampler audio engine ────────────────────────────
  const sampler = new Tone.Sampler({
urls: {
  'A0': 'A0v8.flac',
  'C1': 'C1v8.flac', 'D#1': 'D#1v8.flac', 'F#1': 'F#1v8.flac', 'A1': 'A1v8.flac',
  'C2': 'C2v8.flac', 'D#2': 'D#2v8.flac', 'F#2': 'F#2v8.flac', 'A2': 'A2v8.flac',
  'C3': 'C3v8.flac', 'D#3': 'D#3v8.flac', 'F#3': 'F#3v8.flac', 'A3': 'A3v8.flac',
  'C4': 'C4v8.flac', 'D#4': 'D#4v8.flac', 'F#4': 'F#4v8.flac', 'A4': 'A4v8.flac',
  'C5': 'C5v8.flac', 'D#5': 'D#5v8.flac', 'F#5': 'F#5v8.flac', 'A5': 'A5v8.flac',
  'C6': 'C6v8.flac', 'D#6': 'D#6v8.flac', 'F#6': 'F#6v8.flac', 'A6': 'A6v8.flac',
  'C7': 'C7v8.flac', 'D#7': 'D#7v8.flac', 'F#7': 'F#7v8.flac', 'A7': 'A7v8.flac',
  'C8': 'C8v8.flac',
},
    baseUrl: 'samples/piano/',
    release: 1,
    onerror: () => { samplerReady = false; },
  }).toDestination();

  let samplerReady = true;

  // ── Audio unlock (mobile + desktop) ─────────────────────────
  let unlocked = false;
  async function ensureAudioUnlocked() {
    if (unlocked) return;
    await Tone.start();
    unlocked = true;
  }
  document.addEventListener('mousedown',  ensureAudioUnlocked);
  document.addEventListener('touchstart', ensureAudioUnlocked, { passive: true });

  // ── pianoPlay ────────────────────────────────────────────────
  function pianoPlay(note, octave, btn) {
    const freq = midiToFreq(noteToMidi(note, octave));

    if (samplerReady && sampler.loaded) {
      sampler.triggerAttackRelease(note + octave, '2n');
    } else {
      // Fallback: original oscillator beep
      const ctx = Tone.getContext().rawContext;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 1.4);
    }

    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 300);
    renderPianoNote(note, octave, freq);
  }
})();