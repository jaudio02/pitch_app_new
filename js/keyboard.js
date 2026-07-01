// ── Piano keyboard — octave-switching, data-driven ────────────
(function buildPiano() {

  // One octave of note definitions — octave number is injected at render time
  const NOTE_TEMPLATE = [
    { note: 'C',  type: 'white' },
    { note: 'C#', type: 'black', offset: 1 },
    { note: 'D',  type: 'white' },
    { note: 'D#', type: 'black', offset: 2 },
    { note: 'E',  type: 'white' },
    { note: 'F',  type: 'white' },
    { note: 'F#', type: 'black', offset: 4 },
    { note: 'G',  type: 'white' },
    { note: 'G#', type: 'black', offset: 5 },
    { note: 'A',  type: 'white' },
    { note: 'A#', type: 'black', offset: 6 },
    { note: 'B',  type: 'white' },
    { note: 'C',  type: 'white', octaveOffset: 1 }, // top C belongs to next octave
  ];

  const WHITE_COUNT = NOTE_TEMPLATE.filter(k => k.type === 'white').length; // 8
  const container   = document.getElementById('pianoKeys');

  // Midi helpers (kept for renderPianoNote freq calculation)
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }
  function noteToMidi(note, octave) {
    return NOTE_NAMES.indexOf(note) + (octave + 1) * 12;
  }

  // ── Octave state ─────────────────────────────────────────────
  let currentOctave = 3; // default: C3–C4

  // ── Render keys for a given base octave ──────────────────────
  function renderKeys(baseOctave) {
    container.innerHTML = ''; // clear existing keys

    NOTE_TEMPLATE.forEach(k => {
      const octave = baseOctave + (k.octaveOffset || 0);
      const btn    = document.createElement('button');
      btn.className      = 'key ' + k.type;
      btn.dataset.note   = k.note;
      btn.dataset.octave = octave;

      if (k.type === 'black') {
        const pct    = 100 / WHITE_COUNT;
        btn.style.left = (k.offset * pct - pct * 0.35) + '%';
      }

      const label = document.createElement('span');
      label.className  = 'key-label';
      label.textContent = k.note + octave;
      btn.appendChild(label);

      btn.addEventListener('mousedown', () => pianoPlay(k.note, octave, btn));
      btn.addEventListener('touchstart', e => {
        e.preventDefault();
        pianoPlay(k.note, octave, btn);
      }, { passive: false });

      container.appendChild(btn);
    });
  }

  // ── Octave switcher buttons ───────────────────────────────────
  document.querySelectorAll('.oct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const octave = parseInt(btn.dataset.octave, 10);
      if (octave === currentOctave) return;
      currentOctave = octave;

      // Update active state
      document.querySelectorAll('.oct-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      renderKeys(currentOctave);
    });
  });

  // ── Initial render ────────────────────────────────────────────
  renderKeys(currentOctave);

  // ── Tone.js Sampler — unchanged ───────────────────────────────
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

  // Fallback oscillator if samples fail
  function oscFallback(freq) {
    const ctx = Tone.getContext().rawContext;
    const now = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(now); osc.stop(now + 1.4);
  }

  // ── Audio unlock (mobile + desktop) ──────────────────────────
  let unlocked = false;
  async function ensureAudioUnlocked() {
    if (unlocked) return;
    await Tone.start();
    unlocked = true;
  }
  document.addEventListener('mousedown',  ensureAudioUnlocked);
  document.addEventListener('touchstart', ensureAudioUnlocked, { passive: true });

  // ── pianoPlay ─────────────────────────────────────────────────
  function pianoPlay(note, octave, btn) {
    const freq     = midiToFreq(noteToMidi(note, octave));
    const toneName = note + octave; // e.g. "C#3"

    if (samplerReady && sampler.loaded) {
      sampler.triggerAttackRelease(toneName, '2n');
    } else {
      oscFallback(freq);
    }

    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 300);

    renderPianoNote(note, octave, freq);
  }

})();