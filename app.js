const video = document.querySelector('#camera-video');
const canvas = document.querySelector('#sample-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const output = document.querySelector('#ascii-output');
const colorCanvas = document.querySelector('#ascii-canvas');
const colorContext = colorCanvas.getContext('2d');
const outputFrame = document.querySelector('#output-frame');
const fpsValue = document.querySelector('#fps-value');
const asciiResolution = document.querySelector('#ascii-resolution');
const asciiCells = document.querySelector('#ascii-cells');
const cameraResolution = document.querySelector('#camera-resolution');
const toggleButton = document.querySelector('#camera-toggle');
const controlsToggle = document.querySelector('#controls-toggle');
const controlsOverlay = document.querySelector('#controls-overlay');
const controlsClose = document.querySelector('#controls-close');
const status = document.querySelector('#camera-status');
const statusLabel = document.querySelector('#status-label');
const errorMessage = document.querySelector('#error-message');
const cameraSelect = document.querySelector('#camera-select');
const characterSelect = document.querySelector('#character-select');
const resolutionSelect = document.querySelector('#resolution-select');
const customCharactersInput = document.querySelector('#custom-characters');
const applyCharactersButton = document.querySelector('#apply-characters');
const characterError = document.querySelector('#character-error');
const monoModeButton = document.querySelector('#mono-mode');
const colorModeButton = document.querySelector('#color-mode');
const characterSets = [
  { name: 'detailed', ramp: '@%#W$9876543210?!+=-:;,.ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz ' },
  { name: 'balanced', ramp: '@%#*+=-:. ' },
  { name: 'simple', ramp: '@#*:. ' },
  { name: 'letters only', ramp: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz' },
];

let cameraStream;
let animationFrame;
let colorMode = false;
let characterRamp = Array.from(characterSets[1].ramp);
let lastFrameTime = 0;
let fpsWindowStart = 0;
let fpsFrameCount = 0;
const characterCellAspect = 4.8 / 8;

characterSets.forEach(({ name, ramp }) => {
  const option = document.createElement('option');
  option.value = ramp;
  option.textContent = name;
  characterSelect.append(option);
});
characterSelect.value = characterRamp.join('');

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

function updateResolutionOptions() {
  if (!video.videoWidth || !video.videoHeight) return;

  const cameraAspect = video.videoWidth / video.videoHeight;
  const maxRows = Math.min(120, Math.floor(outputFrame.clientHeight / 8));
  const maxColumns = Math.max(12, Math.min(
    300,
    Math.floor(outputFrame.clientWidth / 4.8),
    Math.floor(video.videoWidth / 2),
    Math.floor((maxRows * cameraAspect) / characterCellAspect),
  ));
  const previousColumns = Number(resolutionSelect.value);
  const tiers = [
    { name: 'low', scale: 0.25 },
    { name: 'medium', scale: 0.5 },
    { name: 'high', scale: 0.75 },
    { name: 'max detail', scale: 1 },
  ];
  const options = tiers.map(({ name, scale }) => {
    const columns = Math.max(12, Math.floor(maxColumns * scale));
    const rows = Math.max(6, Math.floor((columns * characterCellAspect) / cameraAspect));
    return { name, columns, rows };
  }).filter((option, index, all) => all.findIndex((candidate) => candidate.columns === option.columns) === index);

  resolutionSelect.replaceChildren(...options.map(({ name, columns, rows }) => {
    const option = document.createElement('option');
    option.value = String(columns);
    option.textContent = `${name} · ${columns} × ${rows}`;
    return option;
  }));
  resolutionSelect.disabled = false;

  if (previousColumns) {
    const nearest = options.reduce((best, option) => Math.abs(option.columns - previousColumns) < Math.abs(best.columns - previousColumns) ? option : best);
    resolutionSelect.value = String(nearest.columns);
  } else {
    resolutionSelect.selectedIndex = Math.min(2, options.length - 1);
  }
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

  const columns = Number(resolutionSelect.value);
  if (!columns) return;
  const cameraAspect = video.videoWidth / video.videoHeight;
  const rows = Math.max(6, Math.floor((columns * characterCellAspect) / cameraAspect));
  canvas.width = columns;
  canvas.height = rows;
  context.drawImage(video, 0, 0, columns, rows);

  asciiResolution.textContent = `${columns} × ${rows}`;
  asciiCells.textContent = `${(columns * rows).toLocaleString()} cells`;
  cameraResolution.textContent = `${video.videoWidth} × ${video.videoHeight}`;
  fpsFrameCount += 1;
  if (!fpsWindowStart) fpsWindowStart = timestamp;
  if (timestamp - fpsWindowStart >= 1000) {
    fpsValue.textContent = String(Math.round((fpsFrameCount * 1000) / (timestamp - fpsWindowStart)));
    fpsFrameCount = 0;
    fpsWindowStart = timestamp;
  }

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
    updateResolutionOptions();
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
  resolutionSelect.replaceChildren(new Option('start camera to see resolutions', ''));
  resolutionSelect.disabled = true;
  fpsValue.textContent = '--';
  asciiResolution.textContent = '-- × --';
  asciiCells.textContent = '-- cells';
  cameraResolution.textContent = '-- × --';
  fpsFrameCount = 0;
  fpsWindowStart = 0;
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
  characterRamp = Array.from(characterSelect.value);
});

applyCharactersButton.addEventListener('click', () => {
  const input = customCharactersInput.value.trim();
  let characters;

  try {
    characters = JSON.parse(input);
  } catch {
    characters = input;
  }

  if (Array.isArray(characters)) {
    if (characters.some((character) => typeof character !== 'string' || Array.from(character).length !== 1)) {
      characterError.textContent = 'use a list of single characters';
      characterError.hidden = false;
      return;
    }
    characters = characters.join('');
  }

  if (typeof characters !== 'string' || Array.from(characters).length < 2) {
    characterError.textContent = 'enter at least two characters';
    characterError.hidden = false;
    return;
  }

  characterRamp = Array.from(characters);
  let customOption = Array.from(characterSelect.options).find((option) => option.dataset.custom === 'true');
  if (!customOption) {
    customOption = document.createElement('option');
    customOption.dataset.custom = 'true';
    characterSelect.append(customOption);
  }
  customOption.value = characters;
  customOption.textContent = 'custom';
  characterSelect.value = characters;
  characterError.hidden = true;
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', refreshCameras);
}

window.addEventListener('resize', () => {
  if (cameraStream) {
    updateResolutionOptions();
    cancelAnimationFrame(animationFrame);
    renderFrame();
  }
});

window.addEventListener('pagehide', stopCamera);