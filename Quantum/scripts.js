const songsFolder = 'Songs/';
const adsFolder = 'Ads/';
const hostFolder = 'VoiceLines/';
const introFile = 'intro.mp3';

const songs = Array.from({ length: 261 }, (_, i) => `song${i + 1}.mp3`);
const ads = Array.from({ length: 125 }, (_, i) => `ad${i + 1}.mp3`);

const songVoiceLines = {
  'song1.mp3': ['host_line1.mp3', 'host_line2.mp3'],
  'song2.mp3': ['host_line3.mp3'],
  'song3.mp3': ['host_line4.mp3', 'host_line5.mp3'],
};

let currentSongCount = 0;
let lastSongPlayed = '';
let playedSongs = [];

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
staticGain.gain.value = 0.0035; // 0.35% volume

const staticNoise = createWhiteNoise(audioContext);
staticNoise.connect(staticGain);
staticGain.connect(audioContext.destination);
staticNoise.start(); // Start static once

const voiceDistortion = audioContext.createWaveShaper();
voiceDistortion.curve = makeDistortionCurve(50);
voiceDistortion.oversample = '4x';

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
musicGain.connect(audioContext.destination);

volumeSlider.addEventListener('input', () => {
  musicGain.gain.value = parseFloat(volumeSlider.value);
});

audioElement.addEventListener('ended', playNext);
window.addEventListener('click', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
});

function getRandomItem(array) {
  if (array.length === 0) {
    playedSongs = [];
    return getRandomItem(songs);
  }
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

function playHostLine(song) {
  const lines = songVoiceLines[song] || [];
  if (lines.length > 0) {
    const nextLine = getRandomItem(lines);
    updateNowPlaying(`Host: ${nextLine}`);
    audioElement.src = hostFolder + nextLine;
audioElement.onended = playNext;
distortion.disconnect();
musicGain.disconnect();
voiceDistortion.connect(voiceGain);
voiceGain.connect(audioContext.destination);
audioElement.play();
  } else {
    playNext();
  }
}

function playNext() {
  let nextSource;
  if (currentSongCount < 2) {
    nextSource = getRandomItem(songs.filter(song => !playedSongs.includes(song)));
    lastSongPlayed = nextSource;
    playedSongs.push(nextSource);
    currentSongCount++;
    updateNowPlaying(`Now Playing: ${nextSource}`);
    audioElement.src = songsFolder + nextSource;
audioElement.onended = () => playHostLine(nextSource);
voiceDistortion.disconnect();
voiceGain.disconnect();
bandpass.connect(distortion);
distortion.connect(musicGain);
musicGain.connect(audioContext.destination);
  } else {
    nextSource = getRandomItem(ads);
    currentSongCount = 0;
    updateNowPlaying(`Ad: ${nextSource}`);
    audioElement.src = adsFolder + nextSource;
audioElement.onended = playNext;
voiceDistortion.disconnect();
voiceGain.disconnect();
bandpass.connect(distortion);
distortion.connect(musicGain);
musicGain.connect(audioContext.destination);
  }
  audioElement.play();
}

function playIntroduction() {
  updateNowPlaying('Welcome to Quantum Radio');
  audioElement.src = introFile;
audioElement.onended = playNext;
distortion.disconnect();
musicGain.disconnect();
voiceDistortion.connect(voiceGain);
voiceGain.connect(audioContext.destination);
audioElement.play();
}

function updateNowPlaying(text) {
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
  audioContext.resume().then(() => {
    staticGain.gain.value = 0.0035; // unmute static
    initializeRadio();
  });
}

function powerOff() {
  audioElement.pause();
  staticGain.gain.value = 0; // mute static
  updateNowPlaying('');
}
