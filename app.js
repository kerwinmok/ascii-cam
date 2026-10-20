const video = document.querySelector('#camera-video');
const canvas = document.querySelector('#sample-canvas');
const context = canvas.getContext('2d', { willReadFrequently: true });
const output = document.querySelector('#ascii-output');
const outputFrame = document.querySelector('#output-frame');
const toggleButton = document.querySelector('#camera-toggle');
const status = document.querySelector('#camera-status');
const statusLabel = document.querySelector('#status-label');
const outputSize = document.querySelector('#output-size');
const errorMessage = document.querySelector('#error-message');
const menuToggle = document.querySelector('#camera-menu-toggle');
const cameraMenu = document.querySelector('#camera-menu');
const cameraSelect = document.querySelector('#camera-select');
const characterRamp = '@%#*+=-:. ';

let cameraStream;
let animationFrame;

function setCameraState(isLive) {
  status.classList.toggle('is-live', isLive);
  statusLabel.textContent = isLive ? 'camera live' : 'camera off';
  toggleButton.querySelector('span:last-child').textContent = isLive ? 'stop camera' : 'start camera';
  toggleButton.querySelector('.button-icon').textContent = isLive ? '■' : '▶';
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = false;
  output.hidden = true;
}

function renderFrame() {
  if (!cameraStream || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

  const columns = Math.max(24, Math.min(150, Math.floor(outputFrame.clientWidth / 4.8)));
  const rows = Math.max(12, Math.floor(outputFrame.clientHeight / 8));
  canvas.width = columns;
  canvas.height = rows;
  context.drawImage(video, 0, 0, columns, rows);

  const pixels = context.getImageData(0, 0, columns, rows).data;
  let text = '';

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
  outputSize.textContent = `${columns} × ${rows}`;
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
    await refreshCameras();
    renderFrame();
  } catch (error) {
    const message = error.name === 'NotAllowedError'
      ? 'Camera access was blocked. Allow camera access in your browser and try again.'
      : 'No camera was found. Connect a camera and try again.';
    showError(message);
    stopCamera();
  }
}

async function refreshCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
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
}

function stopCamera() {
  cancelAnimationFrame(animationFrame);
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  video.srcObject = null;
  setCameraState(false);
  outputSize.textContent = '-- × --';
  output.textContent = 'turn on camera to begin';
}

toggleButton.addEventListener('click', () => {
  if (cameraStream) stopCamera();
  else startCamera();
});

menuToggle.addEventListener('click', async () => {
  const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
  menuToggle.setAttribute('aria-expanded', String(!isOpen));
  cameraMenu.hidden = isOpen;
  if (!isOpen) await refreshCameras();
});

cameraSelect.addEventListener('change', () => {
  if (cameraStream) {
    stopCamera();
    startCamera();
  }
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