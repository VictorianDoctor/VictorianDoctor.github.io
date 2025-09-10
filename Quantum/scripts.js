const songsFolder = 'Songs/';
const adsFolder = 'Ads/';
const playsFolder = 'Plays/';
const hostFolder = 'VoiceLines/';
const introFile = 'intro.mp3';

const songs = Array.from({ length: 261 }, (_, i) => `song${i + 1}.mp3`);
const ads = Array.from({ length: 146 }, (_, i) => `ad${i + 1}.mp3`);
const plays = Array.from({ length: 41 }, (_, i) => `play${i + 1}.mp3`);

const preVoiceLines = {
  'song216.mp3': ['pre_host1.mp3'],
};

const postVoiceLines = {
  'song105.mp3': ['host1.mp3'],
};

let radioOn = false;
let currentSongCount = 0;
let lastSongPlayed = '';
let playedSongs = [];
let songTitles = {};

fetch('song_titles.json')
  .then(res => res.json())
  .then(data => songTitles = data);

const audioElement = document.getElementById('audio-player');
const volumeSlider = document.getElementById('volumeSlider');
const nowPlayingDisplay = document.getElementById('now-playing');

const AudioContextClass = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContextClass();

const sourceNode = audioContext.createMediaElementSource(audioElement);
const bandpass = audioContext.createBiquadFilter();
bandpass.type = 'bandpass';
bandpass.frequency.value = 1000;
bandpass.Q.value = 1;

const distortion = audioContext.createWaveShaper();
distortion.curve = makeDistortionCurve(100);
distortion.oversample = '4x';

const musicGain = audioContext.createGain();
musicGain.gain.value = parseFloat(volumeSlider.value);

const staticGain = audioContext.createGain();
staticGain.gain.value = 0.0035;

const staticNoise = createWhiteNoise(audioContext);
staticNoise.connect(staticGain);
staticGain.connect(audioContext.destination);
staticNoise.start();

const voiceDistortion = audioContext.createWaveShaper();
voiceDistortion.curve = makeDistortionCurve(25);
voiceDistortion.oversample = 'none';

const voiceGain = audioContext.createGain();
voiceGain.gain.value = parseFloat(volumeSlider.value);

const splitter = audioContext.createGain();
sourceNode.connect(splitter);

splitter.connect(bandpass);
bandpass.connect(distortion);
distortion.connect(musicGain);
musicGain.connect(audioContext.destination);

splitter.connect(voiceDistortion);
voiceDistortion.connect(voiceGain);
voiceGain.connect(audioContext.destination);

volumeSlider.addEventListener('input', () => {
  const volume = parseFloat(volumeSlider.value);
  musicGain.gain.value = volume;
  voiceGain.gain.value = volume;
});

audioElement.addEventListener('ended', () => {
  if (isHost) playNext();
});

window.addEventListener('click', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
});

function getRandomItem(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

function playVoiceLine(song, beforeSong = true, callback = playNext) {
  const lines = beforeSong ? preVoiceLines[song] || [] : postVoiceLines[song] || [];
  if (lines.length > 0) {
    const nextLine = getRandomItem(lines);
    updateNowPlaying(`Host: ${nextLine}`);
    audioElement.src = hostFolder + nextLine;
    audioElement.onended = callback;
    bandpass.disconnect();
    distortion.disconnect();
    musicGain.disconnect();
    voiceDistortion.disconnect();
    voiceGain.disconnect();
    voiceDistortion.connect(voiceGain);
    voiceGain.connect(audioContext.destination);
    audioElement.play();
  } else {
    setTimeout(callback, 100);
  }
}

function playNext() {
  if (!radioOn) return;

  let nextSource;
  if (currentSongCount < 2) {
    let unplayedSongs = songs.filter(song => !playedSongs.includes(song));
    if (unplayedSongs.length === 0) {
      playedSongs = [];
      unplayedSongs = [...songs];
    }
    nextSource = getRandomItem(unplayedSongs);
    lastSongPlayed = nextSource;
    playedSongs.push(nextSource);
    currentSongCount++;
    const displayTitle = songTitles[nextSource] || nextSource;
    updateNowPlaying(`Now Playing: ${displayTitle}`);
    audioElement.src = songsFolder + nextSource;
    audioElement.onended = () => playVoiceLine(nextSource, false);
    voiceDistortion.disconnect();
    voiceGain.disconnect();
    bandpass.connect(distortion);
    distortion.connect(musicGain);
    musicGain.connect(audioContext.destination);
    playVoiceLine(nextSource, true, () => {
      audioElement.play();
      if (isHost) sendSyncUpdate(nextSource, 0);
    });
  } else {
    if (Math.random() < 0.2) {
      nextSource = getRandomItem(plays);
      updateNowPlaying(`Radio Play: ${nextSource}`);
      audioElement.src = playsFolder + nextSource;
    } else {
      nextSource = getRandomItem(ads);
      updateNowPlaying(`Ad: ${nextSource}`);
      audioElement.src = adsFolder + nextSource;
    }
    currentSongCount = 0;
    audioElement.onended = () => { if (isHost) playNext(); };
    voiceDistortion.disconnect();
    voiceGain.disconnect();
    bandpass.connect(distortion);
    distortion.connect(musicGain);
    musicGain.connect(audioContext.destination);
    audioElement.play();
    if (isHost) sendSyncUpdate(nextSource, 0);
  }
}

function playIntroduction() {
  if (!radioOn) return;
  updateNowPlaying('Welcome to Quantum Radio');
  audioElement.src = introFile;
  audioElement.onended = () => { if (isHost) playNext(); };
  bandpass.disconnect();
  distortion.disconnect();
  musicGain.disconnect();
  voiceDistortion.disconnect();
  voiceGain.disconnect();
  voiceDistortion.connect(voiceGain);
  voiceGain.connect(audioContext.destination);
  audioElement.play();
  if (isHost) sendSyncUpdate(introFile, 0);
}

function updateNowPlaying(text) {
  const nowPlayingDisplay = document.getElementById('now-playing');
  if (nowPlayingDisplay) {
    nowPlayingDisplay.textContent = text;
  }
}

function makeDistortionCurve(amount) {
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1;
    curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

function createWhiteNoise(context) {
  const bufferSize = 2 * context.sampleRate;
  const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  const whiteNoise = context.createBufferSource();
  whiteNoise.buffer = noiseBuffer;
  whiteNoise.loop = true;
  return whiteNoise;
}

let initialized = false;

function initializeRadio() {
  if (!initialized) {
    initialized = true;
    if (syncEnabled) {
      if (isHost) playIntroduction();
    } else {
      playIntroduction();
    }
  }
}

function powerOn() {
  if (radioOn) return;
  radioOn = true;
  audioContext.resume().then(() => {
    staticGain.gain.value = 0.0035;
    initializeRadio();
    const powerLed = document.getElementById('power-led');
    if (powerLed) {
      powerLed.style.background = 'limegreen';
      powerLed.style.boxShadow = '0 0 8px limegreen';
    }
    const powerButton = document.getElementById('powerButton');
    if (powerButton) {
      powerButton.textContent = '⏻';
      powerButton.style.background = '#8a3687';
      powerButton.style.color = '#33ffff';
      powerButton.title = 'Power';
    }
  });
}

function powerOff() {
  updateNowPlaying('');
  radioOn = false;
  staticGain.gain.value = 0;
  const powerLed = document.getElementById('power-led');
  if (powerLed) {
    powerLed.style.background = 'red';
    powerLed.style.boxShadow = '0 0 8px red';
  }
  const powerButton = document.getElementById('powerButton');
  if (powerButton) {
    powerButton.textContent = '⏻';
    powerButton.style.background = '#8a3687';
    powerButton.style.color = '#33ffff';
    powerButton.title = 'Power';
  }
}

function toggleRadio() {
  if (radioOn) {
    powerOff();
    radioOn = false;
  } else {
    powerOn();
    radioOn = true;
  }
}

let syncEnabled = false;
let syncCode = '';
let ws;
let isHost = false;

function connectToSyncSession(code) {
  syncCode = code;
  ws = new WebSocket('wss://24.208.219.63:4959');

  ws.onopen = () => {
    ws.send(JSON.stringify({ action: 'join', code: syncCode }));
    syncEnabled = true;
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.action === 'sync' && !isHost) {
      syncPlayback(data);
    }
  };

  ws.onclose = () => {
    syncEnabled = false;
  };
}

function sendSyncUpdate(song, time) {
  if (isHost && syncEnabled && ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 'sync',
      code: syncCode,
      song,
      time
    }));
  }
}

const syncCodeInput = document.getElementById('syncCodeInput');
const syncConnectBtn = document.getElementById('syncConnectBtn');

const generateCodeBtn = document.createElement('button');
generateCodeBtn.textContent = 'Generate Code';
generateCodeBtn.style.padding = '0.5rem 1rem';
generateCodeBtn.style.marginLeft = '0.5rem';
syncCodeInput.parentNode.insertBefore(generateCodeBtn, syncConnectBtn);

function generateSyncCode() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

generateCodeBtn.addEventListener('click', () => {
  const code = generateSyncCode();
  syncCodeInput.value = code;
  isHost = true;
  updateNowPlaying(`Share this code: ${code}`);
  const powerButton = document.getElementById('powerButton');
  if (powerButton) powerButton.style.display = '';
});

syncConnectBtn.addEventListener('click', () => {
  const code = syncCodeInput.value.trim();
  if (code) {
    connectToSyncSession(code);
    updateNowPlaying(`Syncing with code: ${code}`);
    const powerLed = document.getElementById('power-led');
    if (powerLed) {
      powerLed.style.background = 'yellow';
      powerLed.style.boxShadow = '0 0 8px yellow';
    }
    const powerButton = document.getElementById('powerButton');
    if (!isHost && powerButton) {
      powerButton.style.display = 'none';
    } else if (isHost && powerButton) {
      powerButton.textContent = '▶';
      powerButton.style.background = '#ffe066';
      powerButton.style.color = '#4c0c54';
      powerButton.title = 'Start Synced Playback';
      powerButton.style.display = '';
    }
  }
});

function syncPlayback(data) {
  if (!radioOn) powerOn();
  audioElement.src = songsFolder + data.song;
  audioElement.currentTime = data.time;
  audioElement.play();
  updateNowPlaying(`Now Playing: ${songTitles[data.song] || data.song} (Synced)`);
}

setInterval(() => {
  if (isHost && syncEnabled && !audioElement.paused) {
    sendSyncUpdate(lastSongPlayed, audioElement.currentTime);
  }
}, 5000);
