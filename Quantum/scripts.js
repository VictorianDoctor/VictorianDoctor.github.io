const songsFolder = 'Songs/';
const adsFolder = 'Ads/';
const playsFolder = 'Plays/';
const hostFolder = 'VoiceLines/';
const introFile = 'intro.mp3';

const songs = Array.from({ length: 261 }, (_, i) => `song${i + 1}.mp3`);
const ads = Array.from({ length: 28 }, (_, i) => `ad${i + 1}.mp3`);
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

let filterData = { ads: {}, plays: {} };
fetch('filter.json')
  .then(res => res.json())
  .then(data => filterData = data);

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

audioElement.addEventListener('play', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
});

function getRandomItem(array) {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

function playVoiceLine(song, beforeSong = true, callback = playNext) {
  const immersiveMode = document.getElementById('immersiveMode');
  const falloutMode = document.getElementById('falloutMode');
  if (immersiveMode && immersiveMode.checked) {
    setTimeout(callback, 100);
    return;
  }
  // Fallout Mode: Only play voice lines for Fallout songs
  if (falloutMode && falloutMode.checked) {
    const info = songTitles[song];
    if (!(info && info.genre && info.genre.toLowerCase() === 'fallout')) {
      setTimeout(callback, 100);
      return;
    }
  }
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
    audioElement.play().catch(() => {});
  } else {
    setTimeout(callback, 100);
  }
}

function isImmersiveMode() {
  const immersive = document.getElementById('immersiveMode');
  return immersive && immersive.checked;
}

function isFalloutMode() {
  const fallout = document.getElementById('falloutMode');
  return fallout && fallout.checked;
}

// Example filter for Fallout Mode (songs, ads, plays)
function getFilteredList(list, type) {
  const falloutMode = document.getElementById('falloutMode');
  if (falloutMode && falloutMode.checked) {
    if (type === 'song') {
      // Only Fallout genre songs
      return list.filter(item => {
        const info = songTitles[item];
        return info && info.genre && info.genre.toLowerCase() === 'fallout';
      });
    }
    // Fallout mode does NOT filter ads or plays anymore
  }
  return list;
}

// Example usage in your playback logic:
function playNext() {
  if (!radioOn) return;
  let nextSource;
  if (currentSongCount < 2) {
    let unplayedSongs = getFilteredList(songs.filter(song => !playedSongs.includes(song)), 'song');
    if (unplayedSongs.length === 0) {
      playedSongs = [];
      unplayedSongs = getFilteredList([...songs], 'song');
    }
    nextSource = getRandomItem(unplayedSongs);
    lastSongPlayed = nextSource;
    playedSongs.push(nextSource);
    currentSongCount++;
    const displayTitle = songTitles[nextSource] ? songTitles[nextSource].title : nextSource;
    updateNowPlaying(`Now Playing: ${displayTitle}`);
    audioElement.src = songsFolder + nextSource;
    audioElement.onended = () => playVoiceLine(nextSource, false);
    voiceDistortion.disconnect();
    voiceGain.disconnect();
    bandpass.connect(distortion);
    distortion.connect(musicGain);
    musicGain.connect(audioContext.destination);
    playVoiceLine(nextSource, true, () => {
      audioElement.play().catch(() => {});
    });
  } else {
    if (Math.random() < 0.2) {
      let playList = getFilteredList(plays, 'play');
      nextSource = getRandomItem(playList);
      updateNowPlaying(`Radio Play: ${nextSource}`);
      audioElement.src = playsFolder + nextSource;
    } else {
      let adList = getFilteredList(ads, 'ad');
      nextSource = getRandomItem(adList);
      updateNowPlaying(`Ad: ${nextSource}`);
      audioElement.src = adsFolder + nextSource;
    }
    currentSongCount = 0;
    audioElement.onended = playNext;
    voiceDistortion.disconnect();
    voiceGain.disconnect();
    bandpass.connect(distortion);
    distortion.connect(musicGain);
    musicGain.connect(audioContext.destination);
    audioElement.play().catch(() => {});
  }
}

// Example usage for Immersive Mode:
function playIntroduction() {
  const immersiveMode = document.getElementById('immersiveMode');
  if (!radioOn) return;
  if (immersiveMode && immersiveMode.checked) {
    playNext();
    return;
  }
  updateNowPlaying('Welcome to Quantum Radio');
  audioElement.src = introFile;
  audioElement.onended = playNext;
  bandpass.disconnect();
  distortion.disconnect();
  musicGain.disconnect();
  voiceDistortion.disconnect();
  voiceGain.disconnect();
  voiceDistortion.connect(voiceGain);
  voiceGain.connect(audioContext.destination);
  audioElement.play().catch(() => {});
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
    playIntroduction();
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