const video = document.querySelector('#camera-video');
const canvas = document.querySelector('#sample-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const output = document.querySelector('#ascii-output');
const colorCanvas = document.querySelector('#ascii-canvas');
const colorContext = colorCanvas.getContext('2d');
const outputFrame = document.querySelector('#output-frame');
const toggleButton = document.querySelector('#camera-toggle');
const controlsToggle = document.querySelector('#controls-toggle');
const controlsOverlay = document.querySelector('#controls-overlay');
const controlsClose = document.querySelector('#controls-close');
const status = document.querySelector('#camera-status');
const statusLabel = document.querySelector('#status-label');
const errorMessage = document.querySelector('#error-message');
const cameraSelect = document.querySelector('#camera-select');
const characterSelect = document.querySelector('#character-select');
const monoModeButton = document.querySelector('#mono-mode');
const colorModeButton = document.querySelector('#color-mode');
const characterSets = [
  { name: 'detailed', ramp: '@%#W$9876543210?!+=-:;,. ' },
  { name: 'balanced', ramp: '@%#*+=-:. ' },
  { name: 'simple', ramp: '@#*:. ' },
];

let cameraStream;
let animationFrame;
let colorMode = false;
let characterRamp = characterSets[1].ramp;
let lastFrameTime = 0;

characterSets.forEach(({ name, ramp }) => {
  const option = document.createElement('option');
  option.value = ramp;
  option.textContent = name;
  characterSelect.append(option);
});
characterSelect.value = characterRamp;

function setControlsOpen(open) {
  controlsOverlay.hidden = !open;
  controlsToggle.setAttribute('aria-expanded', String(open));
  controlsToggle.setAttribute('aria-label', open ? 'Close controls' : 'Open controls');
  if (open) toggleButton.focus();
  else controlsToggle.focus();
}

function setColorMode(enabled) {
  colorMode = enabled;
  monoModeButton.setAttribute('aria-pressed', String(!enabled));
  colorModeButton.setAttribute('aria-pressed', String(enabled));
  output.hidden = Boolean(cameraStream && enabled);
  colorCanvas.hidden = !cameraStream || !enabled;
}

function setCameraState(isLive) {
  status.classList.toggle('is-live', isLive);
  statusLabel.textContent = isLive ? 'camera live' : 'camera off';
  toggleButton.querySelector('span:last-child').textContent = isLive ? 'stop camera' : 'start camera';
  toggleButton.querySelector('.button-icon').textContent = isLive ? '■' : '▶';
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  colorCanvas.hidden = true;
  output.hidden = true;
}

function renderFrame(timestamp = performance.now()) {
  if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;
  if (timestamp - lastFrameTime < 33) {
    animationFrame = requestAnimationFrame(renderFrame);
    return;
  }
  lastFrameTime = timestamp;

  const columns = Math.max(24, Math.min(300, Math.floor(outputFrame.clientWidth / 4.8)));
  const rows = Math.max(12, Math.min(120, Math.floor(outputFrame.clientHeight / 8)));
  canvas.width = columns;
  canvas.height = rows;
  context.drawImage(video, 0, 0, columns, rows);

  const pixels = context.getImageData(0, 0, columns, rows).data;
  let text = '';

  if (colorMode) {
    const characterWidth = 4.8;
    colorCanvas.width = Math.ceil(columns * characterWidth);
    colorCanvas.height = rows * 8;
    colorCanvas.style.width = `${columns * characterWidth}px`;
    colorContext.clearRect(0, 0, colorCanvas.width, colorCanvas.height);
    colorContext.font = "8px 'DM Mono', 'Courier New', monospace";
    colorContext.textBaseline = 'top';

    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const pixel = (y * columns + x) * 4;
        const red = pixels[pixel];
        const green = pixels[pixel + 1];
        const blue = pixels[pixel + 2];
        const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
        const characterIndex = Math.floor((luminance / 255) * (characterRamp.length - 1));
        colorContext.fillStyle = `rgb(${red} ${green} ${blue})`;
        colorContext.fillText(characterRamp[characterIndex], x * characterWidth, y * 8);
      }
    }

  } else {
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < columns; x += 1) {
        const pixel = (y * columns + x) * 4;
        const luminance = pixels[pixel] * 0.299 + pixels[pixel + 1] * 0.587 + pixels[pixel + 2] * 0.114;
        const characterIndex = Math.floor((luminance / 255) * (characterRamp.length - 1));
        text += characterRamp[characterIndex];
      }
      if (y < rows - 1) text += '\n';
    }

    output.textContent = text;
  }

  animationFrame = requestAnimationFrame(renderFrame);
}

async function startCamera() {
  errorMessage.hidden = true;
  output.hidden = false;

  if (!navigator.mediaDevices?.getUserMedia) {
    showError('This browser cannot access a camera. Open the app in a recent browser over localhost or HTTPS.');
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: cameraSelect.value
        ? { deviceId: { exact: cameraSelect.value }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = cameraStream;
    await video.play();
    setCameraState(true);
    setColorMode(colorMode);
    await refreshCameras();
    renderFrame();
    setControlsOpen(false);
  } catch (error) {
    const message = error.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow camera access in your browser and try again.'
      : 'No camera was found. Connect a camera and try again.';
    stopCamera();
    showError(message);
  }
}

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  try {
    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === 'videoinput');
    const selectedId = cameraSelect.value;
    cameraSelect.replaceChildren();

    cameras.forEach((camera, index) => {
      const option = document.createElement('option');
      option.value = camera.deviceId;
      option.textContent = camera.label || `camera ${index + 1}`;
      cameraSelect.append(option);
    });

    if (cameras.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = 'no cameras found';
      cameraSelect.append(option);
    }

    if (cameras.some((camera) => camera.deviceId === selectedId)) cameraSelect.value = selectedId;
  } catch {
    return;
  }
}

function stopCamera() {
  cancelAnimationFrame(animationFrame);
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  video.srcObject = null;
  setCameraState(false);
  output.hidden = false;
  colorCanvas.hidden = true;
  output.textContent = '';
}

toggleButton.addEventListener('click', () => {
  if (cameraStream) stopCamera();
  else startCamera();
});

controlsToggle.addEventListener('click', async () => {
  setControlsOpen(controlsOverlay.hidden);
  if (!controlsOverlay.hidden) await refreshCameras();
});

controlsClose.addEventListener('click', () => setControlsOpen(false));

controlsOverlay.addEventListener('click', (event) => {
  if (event.target === controlsOverlay) setControlsOpen(false);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !event.repeat) {
    event.preventDefault();
    setControlsOpen(controlsOverlay.hidden);
    if (!controlsOverlay.hidden) refreshCameras();
  }
});

cameraSelect.addEventListener('change', () => {
  if (cameraStream) {
    stopCamera();
    startCamera();
  }
});

monoModeButton.addEventListener('click', () => setColorMode(false));
colorModeButton.addEventListener('click', () => setColorMode(true));
characterSelect.addEventListener('change', () => {
  characterRamp = characterSelect.value;
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', refreshCameras);
}

window.addEventListener('resize', () => {
  if (cameraStream) {
    cancelAnimationFrame(animationFrame);
    renderFrame();
  }
});

window.addEventListener('pagehide', stopCamera);