const stage = document.querySelector('#cameraStage');
const video = document.querySelector('#cameraVideo');
const canvas = document.querySelector('#captureCanvas');
const startButton = document.querySelector('#startButton');
const captureButton = document.querySelector('#captureButton');
const flipButton = document.querySelector('#flipCamera');
const hint = document.querySelector('#cameraHint');
const status = document.querySelector('#cameraStatus');
const accessoryLayer = document.querySelector('#accessoryLayer');
const gallery = document.querySelector('#gallery');
const uploadInput = document.querySelector('#uploadInput');
let stream = null;
let facingMode = 'user';
let currentFilter = 'clean';
let galleryItems = [];
let gestureBlur = false;

function setHint(message) { hint.textContent = message; }
function stopCamera() { if (stream) stream.getTracks().forEach((track) => track.stop()); stream = null; }

function setGestureBlur(isActive) {
  gestureBlur = isActive;
  stage.classList.toggle('gesture-blur', isActive);
  if (isActive) setHint('Gesture terdeteksi. Foto akan langsung dibuat blur.');
}

function landmarkDistance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, first.z - second.z);
}

function fingerIsExtended(landmarks, tip, pip) {
  const wrist = landmarks[0];
  return landmarkDistance(landmarks[tip], wrist) > landmarkDistance(landmarks[pip], wrist) * 1.12;
}

function isBlurGesture(landmarks) {
  const extendedFingers = {
    index: fingerIsExtended(landmarks, 8, 6),
    middle: fingerIsExtended(landmarks, 12, 10),
    ring: fingerIsExtended(landmarks, 16, 14),
    pinky: fingerIsExtended(landmarks, 20, 18),
    thumb: fingerIsExtended(landmarks, 4, 3),
  };
  const raisedFingerCount = Object.values(extendedFingers).filter(Boolean).length;
  return raisedFingerCount === 2 && extendedFingers.index && extendedFingers.ring;
}

function setupHandDetection() {
  if (!window.Hands || !video) return;
  const hands = new window.Hands({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
  hands.setOptions({ maxNumHands: 1, modelComplexity: 1, minDetectionConfidence: .7, minTrackingConfidence: .7 });
  hands.onResults((results) => setGestureBlur(Boolean(results.multiHandLandmarks?.[0] && isBlurGesture(results.multiHandLandmarks[0]))));
  let isProcessing = false;
  const detect = async () => {
    if (video.readyState >= 2 && stream && !isProcessing) {
      isProcessing = true;
      try { await hands.send({ image: video }); } catch (error) { /* Keep detection alive if a frame fails. */ }
      isProcessing = false;
    }
    requestAnimationFrame(detect);
  };
  detect();
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setHint('Browser ini belum mendukung akses kamera. Mode demo tetap siap dipakai.');
    return;
  }
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode }, audio: false });
    video.srcObject = stream;
    stage.classList.add('live');
    stage.classList.remove('captured');
    status.textContent = 'LIVE PREVIEW';
    startButton.textContent = '●';
    setHint('Kamera aktif. Pilih mood dan aksesori, lalu tekan tombol tengah.');
  } catch (error) {
    setHint('Izin kamera belum tersedia. Kamu tetap bisa mencoba mode demo.');
    status.textContent = 'DEMO PREVIEW';
  }
}

function applyFilter(filter) {
  currentFilter = filter;
  stage.classList.remove('filter-clean', 'filter-film', 'filter-rose', 'filter-noir');
  stage.classList.add(`filter-${filter}`);
  document.querySelectorAll('.filter-chip').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
}

function capturePhoto(source = video) {
  const width = source.videoWidth || 800;
  const height = source.videoHeight || 1000;
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (source === video && video.readyState >= 2) {
    context.save();
    context.translate(width, 0);
    context.scale(-1, 1);
    if (gestureBlur) context.filter = 'blur(18px)';
    context.drawImage(source, 0, 0, width, height);
    context.restore();
  } else {
    context.fillStyle = '#8a6d5d'; context.fillRect(0, 0, width, height); context.font = `${width / 5}px Georgia`; context.fillStyle = '#c7eb69'; context.fillText('V', width * .43, height * .55);
  }
  const dataUrl = canvas.toDataURL('image/jpeg', .9);
  addToGallery(dataUrl);
  stage.classList.add('captured');
  setTimeout(() => { if (stream) stage.classList.add('live'); }, 850);
  setHint('Shot tersimpan. Klik thumbnail untuk mengunduh hasilnya.');
}

function addToGallery(dataUrl) {
  galleryItems.unshift(dataUrl);
  galleryItems = galleryItems.slice(0, 5);
  gallery.innerHTML = galleryItems.map((item, index) => `<div class="gallery-item"><img src="${item}" alt="Hasil foto ${index + 1}" /><a href="${item}" download="vista-shot-${index + 1}.jpg" title="Unduh foto">↓</a></div>`).join('');
}

startButton.addEventListener('click', startCamera);
captureButton.addEventListener('click', () => capturePhoto());
flipButton.addEventListener('click', () => { facingMode = facingMode === 'user' ? 'environment' : 'user'; startCamera(); });
document.querySelector('#uploadButton').addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', () => {
  const [file] = uploadInput.files;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (event) => { const image = new Image(); image.onload = () => capturePhoto(image); image.src = event.target.result; };
  reader.readAsDataURL(file);
});
document.querySelectorAll('.filter-chip').forEach((button) => button.addEventListener('click', () => applyFilter(button.dataset.filter)));
document.querySelectorAll('.accessory').forEach((button, index) => button.addEventListener('click', () => {
  document.querySelectorAll('.accessory').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  accessoryLayer.className = 'accessory-layer';
  if (button.dataset.accessory !== 'none') accessoryLayer.classList.add(button.dataset.accessory);
  document.querySelector('#accessoryCount').textContent = `${String(index + 1).padStart(2, '0')} / 04`;
}));
document.querySelector('#clearGallery').addEventListener('click', () => { galleryItems = []; gallery.innerHTML = '<p class="empty-gallery">Your shots will land here.</p>'; });
applyFilter('clean');
startCamera();
setupHandDetection();
