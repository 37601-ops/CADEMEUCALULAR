/**
 * CadêMeuCelular? - Mobile Web Application Engine
 * Complete standalone mobile app with Web Audio API, Leaflet GPS mapping,
 * acoustic microphone listener for claps/whistles, radar sonar, and security.
 */

// Global State
const defaultDevices = [
  { id: 'dev-1', name: 'Meu iPhone 15 Pro', model: 'Apple iPhone', phone: '(11) 98765-4321', battery: 88, status: 'Conectado', type: 'phone', lat: -23.5615, lng: -46.6559, pin: '1234' },
  { id: 'dev-2', name: 'Galaxy S24 (Trabalho)', model: 'Samsung Galaxy', phone: '(11) 97654-3210', battery: 34, status: 'Beacon BLE', type: 'phone', lat: -23.5630, lng: -46.6540, pin: '0000' },
  { id: 'dev-3', name: 'Chave do Carro', model: 'Tag BLE', phone: '', battery: 95, status: 'Mesh Offline', type: 'tag', lat: -23.5600, lng: -46.6580, pin: '' }
];

function loadDevicesFromStorage() {
  try {
    const saved = localStorage.getItem('cademeucelular_devices');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {}
  return defaultDevices;
}

function saveDevicesToStorage() {
  try {
    localStorage.setItem('cademeucelular_devices', JSON.stringify(appState.pairedDevices));
  } catch (e) {}
}

const appState = {
  currentTab: 'radar',
  isAlarmActive: false,
  alarmSoundType: 'siren', // siren, ultrasonic, horn, sonar
  volumeLevel: 1.0,
  radarActive: true,
  radarDistance: 3.2,
  isListening: false,
  listenSensitivity: 70,
  pairedDevices: loadDevicesFromStorage(),
  activeDeviceId: 'dev-1',
  capturedGPS: null,
  lockScreenData: {
    ownerName: 'Mariana Silva',
    emergencyPhone: '(11) 98765-4321',
    reward: 'R$ 200,00',
    message: 'Por favor, devolva na portaria do Edifício Horizonte ou ligue para meu irmão.'
  }
};

// Web Audio API Context
let audioCtx = null;
let activeOscillator = null;
let activeGain = null;
let alarmTimer = null;
let micStream = null;
let micAnalyser = null;
let micAnimFrame = null;
let leafletMap = null;
let userMarker = null;
let deviceMarker = null;
let routeLine = null;

function ensureAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// ==========================================
// 1. TAB NAVIGATION
// ==========================================
function switchTab(tabId) {
  appState.currentTab = tabId;

  // Update tabs styling
  document.querySelectorAll('.app-tab-btn').forEach(btn => {
    if (btn.dataset.tab === tabId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update screen content visibility
  document.querySelectorAll('.app-screen-section').forEach(sec => {
    if (sec.id === `screen-${tabId}`) {
      sec.classList.remove('hidden');
    } else {
      sec.classList.add('hidden');
    }
  });

  // Tab specific lifecycle
  if (tabId === 'map') {
    setTimeout(initOrRefreshMap, 200);
  }
  if (tabId === 'listen') {
    initWaveformCanvas();
  }

  showAppToast(`Tela: ${tabId.toUpperCase()}`);
}

// ==========================================
// 2. ALARM SYNTHESIZER (WEB AUDIO API)
// ==========================================
function toggleAlarm() {
  if (appState.isAlarmActive) {
    stopAlarm();
  } else {
    startAlarm();
  }
}

function startAlarm() {
  ensureAudio();
  appState.isAlarmActive = true;
  updateAlarmUI(true);

  if (navigator.vibrate) {
    navigator.vibrate([500, 250, 500, 250, 800]);
  }

  const now = audioCtx.currentTime;
  activeGain = audioCtx.createGain();
  activeGain.gain.setValueAtTime(0.01, now);
  activeGain.gain.linearRampToValueAtTime(0.4 * appState.volumeLevel, now + 0.1);

  if (appState.alarmSoundType === 'siren') {
    // 2-tone Police / High Piercing Siren
    activeOscillator = audioCtx.createOscillator();
    activeOscillator.type = 'sawtooth';
    activeOscillator.frequency.setValueAtTime(800, now);

    let high = false;
    alarmTimer = setInterval(() => {
      if (!appState.isAlarmActive || !audioCtx) return;
      const t = audioCtx.currentTime;
      activeOscillator.frequency.exponentialRampToValueAtTime(high ? 850 : 1400, t + 0.08);
      high = !high;
    }, 200);

    activeOscillator.connect(activeGain);
    activeGain.connect(audioCtx.destination);
    activeOscillator.start();

  } else if (appState.alarmSoundType === 'ultrasonic') {
    // High-pitched 2600Hz ear-piercing buzz
    activeOscillator = audioCtx.createOscillator();
    activeOscillator.type = 'square';
    activeOscillator.frequency.setValueAtTime(2600, now);

    alarmTimer = setInterval(() => {
      if (!appState.isAlarmActive || !audioCtx) return;
      const t = audioCtx.currentTime;
      activeOscillator.frequency.setValueAtTime(2600, t);
      activeOscillator.frequency.exponentialRampToValueAtTime(3200, t + 0.1);
    }, 250);

    activeOscillator.connect(activeGain);
    activeGain.connect(audioCtx.destination);
    activeOscillator.start();

  } else if (appState.alarmSoundType === 'horn') {
    // Dual frequency dissonance horn
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(554, now);

    osc1.connect(activeGain);
    osc2.connect(activeGain);
    activeGain.connect(audioCtx.destination);
    osc1.start();
    osc2.start();
    activeOscillator = {
      stop: () => { osc1.stop(); osc2.stop(); },
      disconnect: () => { osc1.disconnect(); osc2.disconnect(); }
    };
  } else {
    // Sonar Beep
    playSonarPing();
    alarmTimer = setInterval(playSonarPing, 1000);
  }

  showAppToast('🚨 ALARME DISPARADO EM 110dB!');
}

function stopAlarm() {
  appState.isAlarmActive = false;
  if (alarmTimer) {
    clearInterval(alarmTimer);
    alarmTimer = null;
  }

  if (activeGain && audioCtx) {
    const now = audioCtx.currentTime;
    activeGain.gain.linearRampToValueAtTime(0.001, now + 0.08);
    setTimeout(() => {
      if (activeOscillator) {
        try {
          activeOscillator.stop();
          activeOscillator.disconnect();
        } catch (e) {}
        activeOscillator = null;
      }
    }, 100);
  }

  updateAlarmUI(false);
  showAppToast('🔇 Alarme desativado.');
}

function updateAlarmUI(active) {
  const giantBtn = document.getElementById('giant-alarm-btn');
  const strobe = document.getElementById('app-strobe-overlay');
  const statusText = document.getElementById('alarm-status-label');
  const statusPill = document.getElementById('island-status-dot');

  if (active) {
    if (giantBtn) {
      giantBtn.classList.add('alarm-ringing');
      giantBtn.innerHTML = `
        <span class="text-3xl font-extrabold text-white animate-pulse">PARAR</span>
        <span class="text-[10px] font-mono tracking-widest text-white/80 mt-1">110dB TOCANDO</span>
      `;
    }
    if (strobe) strobe.classList.remove('hidden');
    if (statusText) statusText.innerText = 'DISPARADO (Volume Máximo)';
    if (statusPill) statusPill.style.background = '#EF4444';
  } else {
    if (giantBtn) {
      giantBtn.classList.remove('alarm-ringing');
      giantBtn.innerHTML = `
        <svg class="w-12 h-12 text-black mb-1" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
        </svg>
        <span class="text-sm font-extrabold text-black tracking-wider">TOCAR ALARME</span>
        <span class="text-[9px] font-mono text-black/70">Toque para Disparar</span>
      `;
    }
    if (strobe) strobe.classList.add('hidden');
    if (statusText) statusText.innerText = 'Pronto para Disparo';
    if (statusPill) statusPill.style.background = '#10B981';
  }
}

function setAlarmSound(type) {
  appState.alarmSoundType = type;
  document.querySelectorAll('.sound-option-btn').forEach(btn => {
    if (btn.dataset.sound === type) {
      btn.classList.add('border-[#EE9C00]', 'text-[#EE9C00]', 'bg-amber-500/10');
      btn.classList.remove('border-white/10', 'text-gray-400');
    } else {
      btn.classList.remove('border-[#EE9C00]', 'text-[#EE9C00]', 'bg-amber-500/10');
      btn.classList.add('border-white/10', 'text-gray-400');
    }
  });

  playSonarPing();
  showAppToast(`Som selecionado: ${type.toUpperCase()}`);
}

function playSonarPing() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1400, now);
  osc.frequency.exponentialRampToValueAtTime(500, now + 0.35);

  gain.gain.setValueAtTime(0.3 * appState.volumeLevel, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.42);
}

// ==========================================
// 3. RADAR SONAR ENGINE
// ==========================================
function setupRadarEngine() {
  const distEl = document.getElementById('app-radar-dist');
  const statusEl = document.getElementById('app-radar-status');
  const signalBar = document.getElementById('app-radar-bar');

  setInterval(() => {
    if (!appState.radarActive || appState.currentTab !== 'radar') return;

    // Slight realistic fluctuation
    const delta = (Math.random() - 0.48) * 0.4;
    appState.radarDistance = Math.max(0.4, Math.min(8.5, appState.radarDistance + delta));

    if (distEl) distEl.innerText = appState.radarDistance.toFixed(1) + 'm';

    if (signalBar) {
      const pct = Math.max(10, Math.min(100, (1 - appState.radarDistance / 9) * 100));
      signalBar.style.width = pct + '%';
    }

    if (statusEl) {
      if (appState.radarDistance < 1.2) {
        statusEl.innerText = '🎯 MUITO PERTO! No mesmo raio de alcance';
        statusEl.className = 'text-xs font-bold text-amber-400';
      } else if (appState.radarDistance < 3.0) {
        statusEl.innerText = '📡 Sinal UWB / BLE Forte';
        statusEl.className = 'text-xs font-medium text-teal-400';
      } else {
        statusEl.innerText = '📶 Sinal Bluetooth Detectado';
        statusEl.className = 'text-xs text-gray-400';
      }
    }
  }, 1000);
}

// ==========================================
// 4. INTERACTIVE LEAFLET DARK MAP
// ==========================================
function initOrRefreshMap() {
  const mapContainer = document.getElementById('leaflet-map');
  if (!mapContainer) return;

  const activeDev = appState.pairedDevices.find(d => d.id === appState.activeDeviceId) || appState.pairedDevices[0];
  const devLat = activeDev.lat || -23.5615;
  const devLng = activeDev.lng || -46.6559;

  if (!leafletMap && typeof L !== 'undefined') {
    leafletMap = L.map('leaflet-map', {
      zoomControl: false,
      attributionControl: false
    }).setView([devLat, devLng], 16);

    // Dark Matter CartoDB Tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(leafletMap);

    // Custom Icon for Device
    const deviceIcon = L.divIcon({
      className: 'custom-map-pin',
      html: `
        <div style="position:relative;display:flex;align-items:center;justify-content:center;width:40px;height:40px;">
          <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(238,156,0,0.3);animation:sonar-wave-app 2s infinite;"></div>
          <div style="width:26px;height:26px;border-radius:50%;background:#EE9C00;border:3px solid #FFF;display:flex;align-items:center;justify-content:center;box-shadow:0 0 15px rgba(238,156,0,0.8);">
            <svg style="width:14px;height:14px;color:#000;" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5 2.5 2.5z"/></svg>
          </div>
        </div>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    deviceMarker = L.marker([devLat, devLng], { icon: deviceIcon }).addTo(leafletMap);
    deviceMarker.bindPopup(`<b>${activeDev.name}</b><br>Precisão: 0.8m • Bateria: ${activeDev.battery}%`).openPopup();

    // User Location Dot
    const userLat = devLat - 0.0025;
    const userLng = devLng - 0.0020;
    const userIcon = L.divIcon({
      className: 'user-map-pin',
      html: `<div style="width:16px;height:16px;border-radius:50%;background:#0284C7;border:2px solid #FFF;box-shadow:0 0 10px #0284C7;"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    userMarker = L.marker([userLat, userLng], { icon: userIcon }).addTo(leafletMap);

    // Route Polyline
    routeLine = L.polyline([
      [userLat, userLng],
      [userLat + 0.0010, userLng + 0.0005],
      [devLat, devLng]
    ], {
      color: '#0284C7',
      weight: 4,
      dashArray: '8, 6',
      opacity: 0.85
    }).addTo(leafletMap);

  } else if (leafletMap) {
    leafletMap.invalidateSize();
    leafletMap.setView([devLat, devLng], 16);
  }

  // Update Address label
  const addrEl = document.getElementById('app-map-address');
  if (addrEl) addrEl.innerText = 'Av. Paulista, 1578 - Bela Vista, SP';
}

function centerOnDevice() {
  if (leafletMap && deviceMarker) {
    leafletMap.setView(deviceMarker.getLatLng(), 17, { animate: true });
    playSonarPing();
    showAppToast('Centralizado no aparelho');
  }
}

// ==========================================
// 5. ACOUSTIC CLAP & WHISTLE DETECTOR
// ==========================================
async function toggleMicrophoneListener() {
  if (appState.isListening) {
    stopMicrophoneListener();
  } else {
    await startMicrophoneListener();
  }
}

async function startMicrophoneListener() {
  ensureAudio();
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    const source = audioCtx.createMediaStreamSource(micStream);
    micAnalyser = audioCtx.createAnalyser();
    micAnalyser.fftSize = 512;
    source.connect(micAnalyser);

    appState.isListening = true;
    updateListenUI(true);
    analyzeAcousticStream();
    showAppToast('🎤 Microfone Ativo: Escutando palmas e assobio!');
  } catch (err) {
    console.warn('Microphone permission blocked or not available:', err);
    showAppToast('⚠️ Permissão de microfone negada. Use a simulação abaixo.');
  }
}

function stopMicrophoneListener() {
  appState.isListening = false;
  if (micStream) {
    micStream.getTracks().forEach(track => track.stop());
    micStream = null;
  }
  if (micAnimFrame) {
    cancelAnimationFrame(micAnimFrame);
    micAnimFrame = null;
  }
  updateListenUI(false);
  showAppToast('Microfone pausado.');
}

function updateListenUI(active) {
  const toggleBtn = document.getElementById('listen-toggle-btn');
  const statusLabel = document.getElementById('listen-status-badge');

  if (active) {
    if (toggleBtn) {
      toggleBtn.innerText = 'Pausar Escuta Acústica';
      toggleBtn.classList.add('bg-red-500', 'hover:bg-red-600', 'text-white');
      toggleBtn.classList.remove('btn-amber');
    }
    if (statusLabel) {
      statusLabel.innerText = 'ATIVO • Escutando palmas / assobio';
      statusLabel.className = 'text-xs font-mono font-bold text-green-400 flex items-center gap-1.5';
    }
  } else {
    if (toggleBtn) {
      toggleBtn.innerText = 'Ativar Escuta de Palmas';
      toggleBtn.classList.remove('bg-red-500', 'hover:bg-red-600', 'text-white');
      toggleBtn.classList.add('btn-amber');
    }
    if (statusLabel) {
      statusLabel.innerText = 'PAUSADO';
      statusLabel.className = 'text-xs font-mono font-bold text-gray-500 flex items-center gap-1.5';
    }
  }
}

function analyzeAcousticStream() {
  if (!appState.isListening || !micAnalyser) return;

  const dataArray = new Uint8Array(micAnalyser.frequencyBinCount);
  micAnalyser.getByteFrequencyData(dataArray);

  // Compute Volume / RMS
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    sum += dataArray[i];
  }
  const avg = sum / dataArray.length;
  const threshold = 140 - (appState.listenSensitivity * 0.8);

  // Draw Waveform
  drawWaveform(dataArray);

  // Clap / Whistle Detection condition
  if (avg > threshold) {
    handleClapOrWhistleTrigger(avg);
    return; // brief pause to prevent continuous trigger
  }

  micAnimFrame = requestAnimationFrame(analyzeAcousticStream);
}

function handleClapOrWhistleTrigger(intensity) {
  showAppToast(`👏 SOM DETECTADO! (Intensidade: ${Math.round(intensity)})`);
  startAlarm();
  setTimeout(() => {
    if (appState.isListening) {
      analyzeAcousticStream();
    }
  }, 2500);
}

function simulateClapEvent() {
  handleClapOrWhistleTrigger(165);
}

function initWaveformCanvas() {
  const canvas = document.getElementById('audio-waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0A0F1D';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawWaveform(dataArray) {
  const canvas = document.getElementById('audio-waveform-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  ctx.fillStyle = '#0A0F1D';
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 2;
  ctx.strokeStyle = '#EE9C00';
  ctx.beginPath();

  const sliceWidth = width / dataArray.length;
  let x = 0;

  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 255.0;
    const y = height - (v * height);

    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);

    x += sliceWidth;
  }

  ctx.stroke();
}

// ==========================================
// 6. DEVICE REGISTRATION & MANAGEMENT
// ==========================================
function renderDeviceList() {
  const container = document.getElementById('device-list-container');
  if (!container) return;

  container.innerHTML = '';
  appState.pairedDevices.forEach(dev => {
    const isCurrent = dev.id === appState.activeDeviceId;
    const card = document.createElement('div');
    card.className = `p-3 rounded-xl border transition-all flex items-center justify-between ${
      isCurrent 
        ? 'bg-[#EE9C00]/15 border-[#EE9C00] shadow-md shadow-[#EE9C00]/10' 
        : 'bg-white/5 border-white/10 hover:border-white/20'
    }`;

    let icon = '📱';
    if (dev.type === 'tag') icon = '🔑';
    else if (dev.model && dev.model.toLowerCase().includes('apple')) icon = '🍎';
    else if (dev.model && dev.model.toLowerCase().includes('samsung')) icon = '⚡';

    card.innerHTML = `
      <div class="flex-1 cursor-pointer" onclick="switchActiveDevice('${dev.id}'); closeDeviceModal();">
        <div class="flex items-center gap-2">
          <span class="text-sm">${icon}</span>
          <p class="text-xs font-bold text-white">${dev.name}</p>
          ${isCurrent ? '<span class="text-[9px] bg-[#EE9C00] text-black px-1.5 py-0.2 rounded font-bold">ATIVO</span>' : ''}
        </div>
        <p class="text-[10px] text-gray-400 mt-0.5">
          ${dev.model || 'Smartphone'} • Bat: ${dev.battery}% ${dev.phone ? '• ' + dev.phone : ''}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full ${dev.battery > 20 ? 'bg-green-400' : 'bg-red-500'}"></span>
        ${appState.pairedDevices.length > 1 ? `
          <button onclick="deleteDevice('${dev.id}')" class="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/10 transition-colors" title="Remover Aparelho">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        ` : ''}
      </div>
    `;

    container.appendChild(card);
  });
}

function openDeviceModal() {
  renderDeviceList();
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.add('hidden');
}

function openRegisterDeviceModal() {
  closeDeviceModal();
  const modal = document.getElementById('register-device-modal');
  if (modal) {
    modal.classList.remove('hidden');
    appState.capturedGPS = null;
    const gpsStatus = document.getElementById('reg-gps-status');
    if (gpsStatus) {
      gpsStatus.innerHTML = '<span class="text-gray-400">GPS não capturado ainda.</span>';
    }
  }
}

function closeRegisterDeviceModal() {
  const modal = document.getElementById('register-device-modal');
  if (modal) modal.classList.add('hidden');
}

// Capture current GPS using browser Geolocation API
function captureCurrentGPSForRegistration() {
  const gpsStatus = document.getElementById('reg-gps-status');
  if (gpsStatus) {
    gpsStatus.innerHTML = '<span class="text-[#EE9C00] animate-pulse">Capturando coordenadas do satélite...</span>';
  }

  if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        appState.capturedGPS = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy
        };
        if (gpsStatus) {
          gpsStatus.innerHTML = `
            <span class="text-green-400 font-bold flex items-center gap-1">
              ✓ GPS Capturado: ${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)} (±${Math.round(pos.coords.accuracy)}m)
            </span>
          `;
        }
        playSonarPing();
        showAppToast('📍 Coordenadas reais capturadas com sucesso!');
      },
      (err) => {
        // Fallback default coordinates
        appState.capturedGPS = {
          lat: -23.5615 + (Math.random() - 0.5) * 0.01,
          lng: -46.6559 + (Math.random() - 0.5) * 0.01,
          accuracy: 10
        };
        if (gpsStatus) {
          gpsStatus.innerHTML = `
            <span class="text-amber-400 font-bold">
              ✓ GPS Estimado (São Paulo - SP)
            </span>
          `;
        }
        showAppToast('GPS padrão registrado com sucesso.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  } else {
    appState.capturedGPS = { lat: -23.5615, lng: -46.6559, accuracy: 15 };
    if (gpsStatus) {
      gpsStatus.innerHTML = '<span class="text-gray-300">Coordenadas padrão aplicadas.</span>';
    }
  }
}

// Submit Registration Form
function submitDeviceRegistration(event) {
  if (event) event.preventDefault();

  const nameInput = document.getElementById('reg-device-name');
  const modelInput = document.getElementById('reg-device-model');
  const phoneInput = document.getElementById('reg-device-phone');
  const pinInput = document.getElementById('reg-device-pin');

  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    alert('Por favor, informe um nome para o aparelho (ex: Meu Celular).');
    return;
  }

  const model = modelInput ? modelInput.value : 'Apple iPhone';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const pin = pinInput ? pinInput.value.trim() : '1234';

  const lat = appState.capturedGPS ? appState.capturedGPS.lat : -23.5615 + (Math.random() - 0.5) * 0.005;
  const lng = appState.capturedGPS ? appState.capturedGPS.lng : -46.6559 + (Math.random() - 0.5) * 0.005;

  const newDevice = {
    id: 'dev-' + Date.now(),
    name: name,
    model: model,
    phone: phone,
    battery: Math.floor(Math.random() * 30) + 70, // 70-100%
    status: 'Conectado (GPS Ativo)',
    type: model.includes('Tag') ? 'tag' : 'phone',
    lat: lat,
    lng: lng,
    pin: pin
  };

  appState.pairedDevices.unshift(newDevice);
  saveDevicesToStorage();
  switchActiveDevice(newDevice.id);
  closeRegisterDeviceModal();

  // Reset form
  if (nameInput) nameInput.value = '';
  if (phoneInput) phoneInput.value = '';

  playSonarPing();
  showAppToast(`🎉 Celular "${newDevice.name}" registrado e protegido!`);
}

// Delete device
function deleteDevice(deviceId) {
  if (appState.pairedDevices.length <= 1) {
    alert('Você deve manter pelo menos um aparelho cadastrado.');
    return;
  }

  if (confirm('Tem certeza que deseja remover este aparelho do rastreador?')) {
    appState.pairedDevices = appState.pairedDevices.filter(d => d.id !== deviceId);
    saveDevicesToStorage();
    if (appState.activeDeviceId === deviceId) {
      switchActiveDevice(appState.pairedDevices[0].id);
    }
    renderDeviceList();
    showAppToast('Aparelho removido.');
  }
}

function switchActiveDevice(deviceId) {
  appState.activeDeviceId = deviceId;
  const dev = appState.pairedDevices.find(d => d.id === deviceId);
  if (dev) {
    const headerTitle = document.getElementById('header-device-name');
    const headerBat = document.getElementById('header-battery-val');
    if (headerTitle) headerTitle.innerText = dev.name;
    if (headerBat) headerBat.innerText = dev.battery + '%';
    showAppToast(`Dispositivo ativo: ${dev.name}`);
    if (appState.currentTab === 'map') {
      initOrRefreshMap();
    }
  }
}

// ==========================================
// 7. TOAST NOTIFICATION UTILITY
// ==========================================
function showAppToast(msg) {
  let toast = document.getElementById('app-internal-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-internal-toast';
    toast.className = 'fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-black/90 border border-[#EE9C00]/40 text-xs font-semibold text-white shadow-2xl backdrop-blur-md transition-all duration-300 pointer-events-none opacity-0 translate-y-[-10px] flex items-center gap-2 max-w-[90%] text-center';
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<span class="w-2 h-2 rounded-full bg-[#EE9C00] animate-ping shrink-0"></span><span>${msg}</span>`;
  toast.classList.remove('opacity-0', 'translate-y-[-10px]');

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
  }, 2800);
}

// Toggle Desktop Frame vs Fullscreen
function toggleFullscreenMode() {
  document.body.classList.toggle('fullscreen-mode');
  const btn = document.getElementById('toggle-fs-btn');
  if (btn) {
    const isFs = document.body.classList.contains('fullscreen-mode');
    btn.innerText = isFs ? 'Modo Smartphone' : 'Tela Cheia';
  }
}

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  setupRadarEngine();

  // Initialize active device from storage
  if (appState.pairedDevices.length > 0) {
    switchActiveDevice(appState.pairedDevices[0].id);
  }
  renderDeviceList();

  // Sensitivity Slider Listener
  const sensSlider = document.getElementById('listen-sensitivity-slider');
  if (sensSlider) {
    sensSlider.addEventListener('input', (e) => {
      appState.listenSensitivity = parseInt(e.target.value);
      const valEl = document.getElementById('listen-sens-val');
      if (valEl) valEl.innerText = appState.listenSensitivity + '%';
    });
  }

  // Volume Slider Listener
  const volSlider = document.getElementById('alarm-vol-slider');
  if (volSlider) {
    volSlider.addEventListener('input', (e) => {
      appState.volumeLevel = parseFloat(e.target.value);
      const valEl = document.getElementById('alarm-vol-val');
      if (valEl) valEl.innerText = Math.round(appState.volumeLevel * 100) + '%';
    });
  }

  // Register PWA Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});
