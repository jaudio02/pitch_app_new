// ── Audio setup (microphone) ──────────────────────────────────
let animId        = null;
let audioCtx       = null;
let analyserNode   = null;
let micSourceNode  = null;
let micStream      = null;
let knownDeviceIds = [];

const MIC_PREF_KEY = 'pitchapp_selected_mic_id';

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

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyserNode = audioCtx.createAnalyser();
  analyserNode.fftSize = 2048;

  connectMicStream(stream);

  // Status indicator
  document.getElementById('statusDot').className = 'dot live';
  document.getElementById('statusText').textContent = 'Listening';

  startPitchLoop();

  // Device labels are only populated once permission has been granted
  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter(d => d.kind === 'audioinput');
  knownDeviceIds = mics.map(d => d.deviceId);

  const storedId = localStorage.getItem(MIC_PREF_KEY);
  const storedStillAvailable = storedId && mics.some(m => m.deviceId === storedId);

  if (mics.length > 1 && !storedStillAvailable) {
    // First-time (or no valid saved preference) — let the user choose
    showMicModal(mics);
  } else if (storedStillAvailable) {
    const activeId = micStream.getAudioTracks()[0].getSettings().deviceId;
    if (storedId !== activeId) switchMicrophone(storedId);
  }

  if (!navigator.mediaDevices._pitchAppDeviceChangeBound) {
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    navigator.mediaDevices._pitchAppDeviceChangeBound = true;
  }
}

// ── Pitch analysis loop — reads from analyserNode, independent of
// which physical mic stream is currently feeding it ──────────────
function startPitchLoop() {
  if (animId !== null) return; // already running

  function loop() {
    animId = requestAnimationFrame(loop);

    const bufLen = analyserNode.fftSize;
    const timeDomain = new Float32Array(bufLen);
    analyserNode.getFloatTimeDomainData(timeDomain);

    const vol  = rms(timeDomain);
    const { freq, clarity } = yin(timeDomain, audioCtx.sampleRate);

    renderPitchFrame({
      timeDomain,
      freq,
      clarity,
      vol,
      sampleRate: audioCtx.sampleRate,
    });
  }

  loop();
}

// ── Swap the live input stream without touching the analysis loop ─
function connectMicStream(stream) {
  if (micSourceNode) micSourceNode.disconnect();
  if (micStream) micStream.getTracks().forEach(t => t.stop());

  micStream = stream;
  micSourceNode = audioCtx.createMediaStreamSource(stream);
  micSourceNode.connect(analyserNode);
}

async function switchMicrophone(deviceId) {
  try {
    const newStream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: { exact: deviceId } },
      video: false,
    });
    connectMicStream(newStream);
    localStorage.setItem(MIC_PREF_KEY, deviceId);
  } catch (e) {
    console.error('Could not switch microphone:', e);
  }
}

// ── Microphone selection modal ────────────────────────────────
function showMicModal(mics) {
  const overlay = document.getElementById('micModalOverlay');
  const list = document.getElementById('micList');
  list.innerHTML = '';

  const currentId = micStream ? micStream.getAudioTracks()[0].getSettings().deviceId : null;

  mics.forEach((mic, i) => {
    const optBtn = document.createElement('button');
    optBtn.className = 'mic-option' + (mic.deviceId === currentId ? ' selected' : '');
    optBtn.textContent = mic.label || `Microphone ${i + 1}`;
    optBtn.addEventListener('click', () => {
      switchMicrophone(mic.deviceId);
      overlay.hidden = true;
    });
    list.appendChild(optBtn);
  });

  overlay.hidden = false;
}

document.getElementById('micModalCloseBtn').addEventListener('click', () => {
  document.getElementById('micModalOverlay').hidden = true;
});

// ── Detect newly connected devices (e.g. Bluetooth headset) ────
async function handleDeviceChange() {
  if (!audioCtx) return; // only relevant once a mic session has started

  const devices = await navigator.mediaDevices.enumerateDevices();
  const mics = devices.filter(d => d.kind === 'audioinput');
  const currentIds = mics.map(d => d.deviceId);

  const hasNewDevice = currentIds.some(id => !knownDeviceIds.includes(id));
  const storedId = localStorage.getItem(MIC_PREF_KEY);
  const storedStillAvailable = storedId && mics.some(m => m.deviceId === storedId);

  knownDeviceIds = currentIds;

  if (hasNewDevice && mics.length > 1) {
    showMicModal(mics);
  } else if (storedId && !storedStillAvailable) {
    // Previously selected mic disappeared — fall back gracefully
    if (mics.length > 1) {
      showMicModal(mics);
    } else if (mics.length === 1) {
      switchMicrophone(mics[0].deviceId);
    }
  }
}