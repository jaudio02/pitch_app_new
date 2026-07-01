// ── Piano keyboard C4–C5 ──────────────────────────────────────
(function buildPiano() {
  // Notes in order: white keys get rendered in flex, black keys positioned absolutely
  const keys = [
    { note: 'C',  octave: 4, type: 'white' },
    { note: 'C#', octave: 4, type: 'black', offset: 1 },
    { note: 'D',  octave: 4, type: 'white' },
    { note: 'D#', octave: 4, type: 'black', offset: 2 },
    { note: 'E',  octave: 4, type: 'white' },
    { note: 'F',  octave: 4, type: 'white' },
    { note: 'F#', octave: 4, type: 'black', offset: 4 },
    { note: 'G',  octave: 4, type: 'white' },
    { note: 'G#', octave: 4, type: 'black', offset: 5 },
    { note: 'A',  octave: 4, type: 'white' },
    { note: 'A#', octave: 4, type: 'black', offset: 6 },
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

  let pianoCtx = null;

  function pianoPlay(note, octave, btn) {
    // Reuse existing AudioContext if available, or create a standalone one
    if (!pianoCtx) pianoCtx = new (window.AudioContext || window.webkitAudioContext)();

    const freq = midiToFreq(noteToMidi(note, octave));
    const now  = pianoCtx.currentTime;

    // Simple sine + triangle blend for a soft piano-ish tone
    const osc1 = pianoCtx.createOscillator();
    const osc2 = pianoCtx.createOscillator();
    const gain = pianoCtx.createGain();

    osc1.type = 'triangle';
    osc2.type = 'sine';
    osc1.frequency.value = freq;
    osc2.frequency.value = freq;

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.4);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(pianoCtx.destination);

    osc1.start(now); osc1.stop(now + 1.4);
    osc2.start(now); osc2.stop(now + 1.4);

    // Visual feedback
    btn.classList.add('playing');
    setTimeout(() => btn.classList.remove('playing'), 300);

    // Feed the detected note display so the existing UI reacts
    renderPianoNote(note, octave, freq);
  }
})();
