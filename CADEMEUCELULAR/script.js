/**
 * CadêMeuCelular? - Interactive Landing Page Engine
 * Features: Web Audio API sound synthesis, radar animation controls,
 * interactive GPS simulation, bento tests, and interactive scenario simulator.
 */

// Web Audio API Context for Alarm & Sonar Effects
let audioCtx = null;
let alarmOscillator = null;
let alarmGain = null;
let alarmInterval = null;
let isAlarmPlaying = false;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

// Play Piercing Lost-Phone Alarm Siren
function startAlarmSiren() {
  initAudio();
  if (isAlarmPlaying) {
    stopAlarmSiren();
    return;
  }

  isAlarmPlaying = true;
  updateAlarmUI(true);

  // Vibration API if supported on mobile
  if (navigator.vibrate) {
    navigator.vibrate([400, 200, 400, 200, 600]);
  }

  const now = audioCtx.currentTime;
  alarmOscillator = audioCtx.createOscillator();
  alarmGain = audioCtx.createGain();

  alarmOscillator.type = 'sawtooth';
  alarmOscillator.frequency.setValueAtTime(850, now);

  // Modulate frequency to create European / Phone Finder piercing siren
  let highTone = false;
  alarmInterval = setInterval(() => {
    if (!isAlarmPlaying || !audioCtx) return;
    const curTime = audioCtx.currentTime;
    const targetFreq = highTone ? 880 : 1320;
    alarmOscillator.frequency.exponentialRampToValueAtTime(targetFreq, curTime + 0.08);
    highTone = !highTone;
  }, 220);

  alarmGain.gain.setValueAtTime(0.01, now);
  alarmGain.gain.linearRampToValueAtTime(0.35, now + 0.1);

  alarmOscillator.connect(alarmGain);
  alarmGain.connect(audioCtx.destination);
  alarmOscillator.start();

  showToast('🚨 ALARME DISPARADO EM VOLUME MÁXIMO (110dB)!');

  // Auto shutoff after 12 seconds for ear safety
  setTimeout(() => {
    if (isAlarmPlaying) {
      stopAlarmSiren();
    }
  }, 12000);
}

function stopAlarmSiren() {
  if (!isAlarmPlaying) return;
  isAlarmPlaying = false;

  if (alarmInterval) {
    clearInterval(alarmInterval);
    alarmInterval = null;
  }

  if (alarmOscillator && alarmGain && audioCtx) {
    const now = audioCtx.currentTime;
    alarmGain.gain.linearRampToValueAtTime(0.001, now + 0.1);
    setTimeout(() => {
      try {
        alarmOscillator.stop();
        alarmOscillator.disconnect();
      } catch (e) {}
    }, 120);
  }

  updateAlarmUI(false);
  showToast('🔇 Alarme interrompido.');
}

// Play Sonar Ping Effect
function playSonarPing() {
  initAudio();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(1200, now);
  osc.frequency.exponentialRampToValueAtTime(450, now + 0.35);

  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.start(now);
  osc.stop(now + 0.45);
}

// Play Clap / Whistle Audio simulation
function playClapDetection() {
  initAudio();
  const now = audioCtx.currentTime;
  // White noise burst simulating clap
  const bufferSize = audioCtx.sampleRate * 0.1;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
  }
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = 1000;
  noise.connect(filter);
  filter.connect(audioCtx.destination);
  noise.start(now);

  setTimeout(() => {
    // Second clap
    const noise2 = audioCtx.createBufferSource();
    noise2.buffer = buffer;
    noise2.connect(filter);
    noise2.start();
    showToast('👏 2x Palmas detectadas! Celular respondendo...');
    setTimeout(playSonarPing, 300);
  }, 220);
}

// UI State Updates for Alarm
function updateAlarmUI(active) {
  const ctaBtn = document.getElementById('phone-cta-alarm');
  const navAlarmBtn = document.getElementById('nav-alarm-btn');
  const alarmOverlays = document.querySelectorAll('.alarm-strobe-effect');
  const soundWaveBadge = document.getElementById('sound-wave-indicator');

  if (active) {
    if (ctaBtn) {
      ctaBtn.innerHTML = `
        <span class="flex items-center justify-center gap-2">
          <span class="w-3 h-3 rounded-full bg-red-600 animate-ping"></span>
          PARAR ALARME
        </span>
      `;
      ctaBtn.classList.remove('btn-amber');
      ctaBtn.classList.add('bg-red-500', 'text-white', 'hover:bg-red-600');
    }
    if (navAlarmBtn) {
      navAlarmBtn.innerText = 'PARAR ALARME';
      navAlarmBtn.classList.add('bg-red-500', 'text-white');
    }
    alarmOverlays.forEach(el => el.classList.remove('hidden'));
    if (soundWaveBadge) soundWaveBadge.classList.remove('hidden');
  } else {
    if (ctaBtn) {
      ctaBtn.innerHTML = `
        <span class="flex items-center justify-center gap-2">
          <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/></svg>
          TOCAR ALARME
        </span>
      `;
      ctaBtn.classList.add('btn-amber');
      ctaBtn.classList.remove('bg-red-500', 'text-white', 'hover:bg-red-600');
    }
    if (navAlarmBtn) {
      navAlarmBtn.innerText = 'Tocar Alarme';
      navAlarmBtn.classList.remove('bg-red-500', 'text-white');
    }
    alarmOverlays.forEach(el => el.classList.add('hidden'));
    if (soundWaveBadge) soundWaveBadge.classList.add('hidden');
  }
}

// Radar Simulation Loop
let radarActive = true;
let simulatedDistance = 3.4;
let distanceDirection = -0.15;

function setupRadarSimulation() {
  const distEl = document.getElementById('radar-distance-val');
  const radarStatusEl = document.getElementById('radar-status-text');
  const toggleRadarBtn = document.getElementById('toggle-radar-btn');

  setInterval(() => {
    if (!radarActive) return;
    
    // Slight fluctuations
    simulatedDistance += distanceDirection;
    if (simulatedDistance <= 0.8) {
      distanceDirection = 0.2;
      playSonarPing();
    } else if (simulatedDistance >= 5.5) {
      distanceDirection = -0.2;
    }

    if (distEl) {
      distEl.innerText = simulatedDistance.toFixed(1) + 'm';
    }

    if (radarStatusEl) {
      if (simulatedDistance < 1.5) {
        radarStatusEl.innerText = 'MUITO PRÓXIMO! (No mesmo cômodo)';
        radarStatusEl.classList.add('text-amber-400');
      } else {
        radarStatusEl.innerText = 'Sinal Bluetooth Mesh Estável';
        radarStatusEl.classList.remove('text-amber-400');
      }
    }
  }, 1200);

  if (toggleRadarBtn) {
    toggleRadarBtn.addEventListener('click', () => {
      radarActive = !radarActive;
      const rings = document.querySelectorAll('.sonar-ring, .radar-scanner-beam');
      rings.forEach(r => {
        r.style.display = radarActive ? 'block' : 'none';
      });
      toggleRadarBtn.innerText = radarActive ? 'Pausar Radar' : 'Retomar Radar';
      showToast(radarActive ? 'Radar de varredura ativado' : 'Radar pausado');
    });
  }
}

// Toast Notifications System
function showToast(message) {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.className = 'fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm pointer-events-none';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'glass-panel px-4 py-3 rounded-xl border border-amber-500/40 text-sm font-medium text-white shadow-2xl flex items-center gap-3 transform translate-y-4 opacity-0 transition-all duration-300 pointer-events-auto bg-[#121212]/90';
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-[#EE9C00] animate-pulse"></span>
    <span>${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Trigger animation
  setTimeout(() => {
    toast.classList.remove('translate-y-4', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('translate-y-4', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3800);
}

// Interactive Lost Phone Simulator Scenarios
const scenarios = {
  sofa: {
    title: 'Embaixo do Sofá da Sala',
    distanceStart: 8.5,
    steps: ['Rastreador detectando sinal BLE...', 'Sinal forte na Sala de Estar (~2.1m)', 'Abafado por almofadas!'],
    tip: 'O alarme ultrassônico perfura o estofado a 110dB.'
  },
  uber: {
    title: 'Esquecido no Uber / Táxi',
    distanceStart: 2400,
    steps: ['Sinal GPS recebido há 3 minutos', 'Veículo em trânsito pela Av. Rebouças', 'Modo Bloqueio Ativado com telefone do motorista'],
    tip: 'A rota ao vivo em tempo real permite interceptar com precisão.'
  },
  mochila: {
    title: 'Dentro da Mochila ou Casaco',
    distanceStart: 1.2,
    steps: ['Modo Silencioso Furado', 'Sensor acústico detectou palmas', 'Localizado imediatamente!'],
    tip: 'Basta bater duas palmas para ele apitar.'
  },
  parque: {
    title: 'Caiu na Grama do Parque',
    distanceStart: 85,
    steps: ['Rede Mesh Bluetooth de outros usuários acionada', 'Coordenadas criptografadas enviadas', 'Alerta de baixa bateria (4%) com último ping'],
    tip: 'Mesmo sem 4G, os celulares vizinhos transmitem a posição anônima.'
  }
};

function runSimulator(scenarioKey) {
  const scen = scenarios[scenarioKey];
  if (!scen) return;

  const simResult = document.getElementById('sim-result-box');
  const simSteps = document.getElementById('sim-steps-list');
  const simTitle = document.getElementById('sim-active-title');
  const simBadge = document.getElementById('sim-tip-badge');

  if (simResult && simSteps && simTitle) {
    simResult.classList.remove('hidden');
    simTitle.innerText = `Cenário: ${scen.title}`;
    simBadge.innerText = scen.tip;
    simSteps.innerHTML = '';

    scen.steps.forEach((step, index) => {
      setTimeout(() => {
        const li = document.createElement('li');
        li.className = 'flex items-center gap-3 text-sm text-gray-200 animate-fadeIn';
        li.innerHTML = `
          <span class="w-5 h-5 rounded-full bg-[#EE9C00]/20 border border-[#EE9C00] text-[#EE9C00] text-xs flex items-center justify-center font-bold">✓</span>
          <span>${step}</span>
        `;
        simSteps.appendChild(li);
        playSonarPing();
      }, index * 800);
    });

    setTimeout(() => {
      showToast(`🎯 Celular localizado com sucesso em: ${scen.title}!`);
    }, scen.steps.length * 800 + 400);
  }
}

// Modal Lockscreen Preview
function openLockScreenModal() {
  const modal = document.getElementById('lockscreen-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeLockScreenModal() {
  const modal = document.getElementById('lockscreen-modal');
  if (modal) modal.classList.add('hidden');
}

// App Screens Cascade Tab Switcher
function selectCascadeScreen(screenIdx) {
  const screenContents = [
    {
      title: 'Radar Sonar 360°',
      desc: 'Varredura direcional de alta precisão baseada em ondas sonoras e Ultra Wideband (UWB).',
      img: 'radar'
    },
    {
      title: 'Mapa GPS & Rota em Tempo Real',
      desc: 'Rastreamento contínuo com precisão de até 50cm e histórico dos últimos 30 dias.',
      img: 'gps'
    },
    {
      title: 'Disparo de Alarme Emergencial',
      desc: 'Ignora modo silencioso, volume zero e fones de ouvido conectados.',
      img: 'alarm'
    },
    {
      title: 'Bloqueio Remoto & Foto do Intruso',
      desc: 'Tira foto silenciosa com a câmera frontal se alguém errar a senha 2 vezes.',
      img: 'security'
    },
    {
      title: 'Ping de Bateria Crítica',
      desc: 'Envia o último ponto antes da bateria atingir 0% e desliga em modo beacon.',
      img: 'battery'
    }
  ];

  const data = screenContents[screenIdx] || screenContents[0];
  const titleEl = document.getElementById('cascade-display-title');
  const descEl = document.getElementById('cascade-display-desc');
  
  if (titleEl) titleEl.innerText = data.title;
  if (descEl) descEl.innerText = data.desc;

  // Update tabs active state
  document.querySelectorAll('.cascade-tab-btn').forEach((btn, idx) => {
    if (idx === screenIdx) {
      btn.classList.add('border-[#EE9C00]', 'text-[#EE9C00]', 'bg-amber-500/10');
      btn.classList.remove('border-white/10', 'text-gray-400');
    } else {
      btn.classList.remove('border-[#EE9C00]', 'text-[#EE9C00]', 'bg-amber-500/10');
      btn.classList.add('border-white/10', 'text-gray-400');
    }
  });

  playSonarPing();
}

// FAQ Accordion
function toggleFaq(btn) {
  const answer = btn.nextElementSibling;
  const icon = btn.querySelector('.faq-icon');
  const isOpen = !answer.classList.contains('hidden');

  document.querySelectorAll('.faq-answer').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.faq-icon').forEach(el => el.style.transform = 'rotate(0deg)');

  if (!isOpen) {
    answer.classList.remove('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  }
}

// Mobile Menu Toggle
function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  if (menu) menu.classList.toggle('hidden');
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
  setupRadarSimulation();

  // Button Listeners
  const mainAlarmBtn = document.getElementById('phone-cta-alarm');
  if (mainAlarmBtn) {
    mainAlarmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startAlarmSiren();
    });
  }

  const navAlarmBtn = document.getElementById('nav-alarm-btn');
  if (navAlarmBtn) {
    navAlarmBtn.addEventListener('click', (e) => {
      e.preventDefault();
      startAlarmSiren();
    });
  }

  // Keyboard shortcut: Spacebar or 'A' triggers alarm test
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'a' || e.key === 'A') {
      startAlarmSiren();
    }
  });
});
