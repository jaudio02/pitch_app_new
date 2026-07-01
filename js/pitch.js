// ── Pitch detection ───────────────────────────────────────────

// Convert frequency to nearest note name, octave, and cents deviation
function freqToNote(freq) {
  if (freq <= 0) return null;
  const semitones = 12 * Math.log2(freq / 440) + 57; // A4=440Hz → semitone 57 from C0
  const midi = Math.round(semitones);
  const cents = Math.round((semitones - midi) * 100);
  const octave = Math.floor(midi / 12);
  const name = NOTE_NAMES[midi % 12];
  return { name, octave, cents };
}

// ── YIN pitch detection ────────────────────────────────────────
function yin(buf, sampleRate) {
  const TAU_MIN = Math.floor(sampleRate / 1200); // ~1200 Hz max
  const TAU_MAX = Math.floor(sampleRate / 50);   // ~50 Hz min
  const threshold = 0.12;
  const N = buf.length;

  // Step 1 & 2: difference function
  const diff = new Float32Array(TAU_MAX);
  for (let tau = 1; tau < TAU_MAX; tau++) {
    let s = 0;
    for (let i = 0; i < TAU_MAX; i++) {
      const d = buf[i] - buf[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }

  // Step 3: cumulative mean normalised difference
  const cmnd = new Float32Array(TAU_MAX);
  cmnd[0] = 1;
  let runSum = 0;
  for (let tau = 1; tau < TAU_MAX; tau++) {
    runSum += diff[tau];
    cmnd[tau] = diff[tau] * tau / runSum;
  }

  // Step 4: absolute threshold
  let tau = TAU_MIN;
  while (tau < TAU_MAX) {
    if (cmnd[tau] < threshold) {
      while (tau + 1 < TAU_MAX && cmnd[tau + 1] < cmnd[tau]) tau++;
      break;
    }
    tau++;
  }

  if (tau === TAU_MAX || cmnd[tau] >= threshold) return { freq: -1, clarity: 0 };

  // Step 5: parabolic interpolation
  const x0 = tau > 1 ? tau - 1 : tau;
  const x2 = tau + 1 < TAU_MAX ? tau + 1 : tau;
  let betterTau;
  if (x0 === tau) {
    betterTau = cmnd[tau] <= cmnd[x2] ? tau : x2;
  } else if (x2 === tau) {
    betterTau = cmnd[tau] <= cmnd[x0] ? tau : x0;
  } else {
    const s0 = cmnd[x0], s1 = cmnd[tau], s2 = cmnd[x2];
    betterTau = tau + (s2 - s0) / (2 * (2 * s1 - s2 - s0));
  }

  return { freq: sampleRate / betterTau, clarity: 1 - cmnd[tau] };
}

// ── RMS volume ────────────────────────────────────────────────
function rms(buf) {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}
