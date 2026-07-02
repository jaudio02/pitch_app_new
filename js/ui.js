// ── UI rendering ──────────────────────────────────────────────
// Handles updates to the pitch card, cents needle, volume bar,
// waveform canvas, and status indicator.

// Called each animation frame by the mic loop in main.js
function renderPitchFrame({ timeDomain, freq, clarity, vol, sampleRate, canvas, ctx: canvasCtx }) {
  const SILENCE_THRESHOLD = 0.01;
  const CLARITY_THRESHOLD = 0.85;

  const noteName    = document.getElementById('noteName');
  const freqValue   = document.getElementById('freqValue');
  const centsNeedle = document.getElementById('centsNeedle');
  const centsValue  = document.getElementById('centsValue');
  const pitchCard   = document.getElementById('pitchCard');

 

  const isSilent = vol < SILENCE_THRESHOLD || clarity < CLARITY_THRESHOLD || freq < 0;

  if (isSilent) {
    noteName.className = 'note-name silent';
    noteName.innerHTML = '—<span class="note-octave" id="noteOctave"></span>';
    freqValue.textContent = '—';
    centsNeedle.className = 'cents-needle silent';
    centsNeedle.style.left = '50%';
    centsValue.textContent = '— ¢';
    pitchCard.classList.remove('active');
  } else {
    const note = freqToNote(freq);
    noteName.className = 'note-name';
    noteName.innerHTML = `${note.name}<span class="note-octave">${note.octave}</span>`;
    freqValue.textContent = freq.toFixed(1);
    pitchCard.classList.add('active');

    const pct = 50 + (note.cents / 100) * 50;
    const inTune = Math.abs(note.cents) <= 5;
    centsNeedle.style.left = pct + '%';
    centsNeedle.className = 'cents-needle' + (inTune ? ' in-tune' : '');
    centsValue.textContent = (note.cents >= 0 ? '+' : '') + note.cents + ' ¢';
  }

  // Waveform
  const W = canvas.width, H = canvas.height;
  canvasCtx.clearRect(0, 0, W, H);
  canvasCtx.beginPath();
  canvasCtx.strokeStyle = isSilent ? '#d8d8d0' : '#2563eb';
  canvasCtx.lineWidth = devicePixelRatio * 1.5;
  const step = W / timeDomain.length;
  for (let i = 0; i < timeDomain.length; i++) {
    const x = i * step;
    const y = (1 - (timeDomain[i] * 0.7 + 1) / 2) * H;
    i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
  }
  canvasCtx.stroke();
}

// Update the pitch card and freq display from a piano key press
function renderPianoNote(note, octave, freq) {
  const noteName  = document.getElementById('noteName');
  const freqValue = document.getElementById('freqValue');
  noteName.className = 'note-name';
  noteName.innerHTML = `${note}<span class="note-octave">${octave}</span>`;
  freqValue.textContent = freq.toFixed(1);
  document.getElementById('pitchCard').classList.add('active');
}
