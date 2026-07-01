// ── Audio setup (microphone) ──────────────────────────────────
let animId = null;

async function startAudio() {
  const btn = document.getElementById('startBtn');
  btn.disabled = true;
  btn.textContent = 'Requesting access…';

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  } catch (e) {
    btn.disabled = false;
    btn.textContent = '▶   Try again';
    document.getElementById('statusText').textContent = 'Microphone denied — check browser permissions';
    return;
  }

  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const bufLen = analyser.fftSize;
  const timeDomain = new Float32Array(bufLen);

  // Canvas
  const canvas = document.getElementById('waveCanvas');
  canvas.width = canvas.offsetWidth * devicePixelRatio;
  canvas.height = canvas.offsetHeight * devicePixelRatio;
  const cc = canvas.getContext('2d');

  // Status indicator
  document.getElementById('statusDot').className = 'dot live';
  document.getElementById('statusText').textContent = 'Listening';

  function loop() {
    animId = requestAnimationFrame(loop);
    analyser.getFloatTimeDomainData(timeDomain);

    const vol  = rms(timeDomain);
    const { freq, clarity } = yin(timeDomain, ctx.sampleRate);

    renderPitchFrame({
      timeDomain,
      freq,
      clarity,
      vol,
      sampleRate: ctx.sampleRate,
      canvas,
      ctx: cc,
    });
  }

  loop();
}
