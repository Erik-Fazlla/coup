#!/usr/bin/env node
/**
 * Generates the game's sound effects as small WAV files, from nothing but maths.
 * Run with: npm run sounds
 *
 * Nothing is downloaded and nothing is random: the noise comes from a seeded
 * generator, so running this again writes byte-identical files.
 * The files go to android/app/src/main/res/raw, where Android packages them
 * into the app; the native module CoupSoundModule.kt plays them by name.
 */
const { Buffer } = require('buffer');
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;
/** No sound may be longer than this, in seconds. */
const MAX_SECONDS = 0.6;
/** Loudest sample of every file, as a fraction of full scale (about -4 dB). */
const PEAK = 0.63;
/** Android resource names are prefixed so they cannot clash with anything else in res/raw. */
const FILE_PREFIX = 'sfx_';
const OUTPUT_DIR = path.resolve(
  __dirname,
  '..',
  'android',
  'app',
  'src',
  'main',
  'res',
  'raw',
);

/**
 * A small seeded random generator (Park-Miller): the same seed always gives the
 * same noise. Returns numbers from 0 up to, but not including, 1.
 */
function seededRandom(seed) {
  const MODULUS = 2147483647;
  const step = value => (value * 48271) % MODULUS;
  let state = (Math.abs(Math.floor(seed)) % (MODULUS - 1)) + 1;
  // Small seeds start with small numbers; a few steps spread them out.
  for (let i = 0; i < 8; i++) {
    state = step(state);
  }
  return () => {
    state = step(state);
    return (state - 1) / (MODULUS - 1);
  };
}

function silence(seconds) {
  return new Float64Array(Math.round(seconds * SAMPLE_RATE));
}

function sine(phase) {
  return Math.sin(2 * Math.PI * phase);
}

function triangle(phase) {
  const p = phase - Math.floor(phase);
  return p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
}

/** Fast linear rise, then an exponential fall: the shape of a struck or plucked note. */
function attackDecay(t, attack, decay) {
  const rise = attack > 0 && t < attack ? t / attack : 1;
  return rise * Math.exp(-Math.max(0, t - attack) / decay);
}

/**
 * Adds one note to `buffer`.
 * `freq` and `endFreq` are in Hz (the pitch glides when they differ), `at` and
 * `attack` in seconds, `decay` is the time for the note to fall to about a third.
 */
function addTone(buffer, options) {
  const {
    freq,
    endFreq = freq,
    at = 0,
    gain = 1,
    attack = 0.005,
    decay = 0.1,
    wave = sine,
  } = options;
  const start = Math.round(at * SAMPLE_RATE);
  const length = buffer.length - start;
  let phase = 0;
  for (let i = 0; i < length; i++) {
    const t = i / SAMPLE_RATE;
    const glide = length > 1 ? i / (length - 1) : 0;
    phase += (freq + (endFreq - freq) * glide) / SAMPLE_RATE;
    buffer[start + i] += gain * attackDecay(t, attack, decay) * wave(phase);
  }
}

/**
 * Adds a burst of noise to `buffer`, dulled by a simple low-pass filter.
 * `cutoff` is in Hz: lower is a softer, darker hiss.
 */
function addNoise(buffer, options) {
  const {
    at = 0,
    seconds,
    gain = 1,
    attack = 0.005,
    decay = 0.05,
    cutoff = 4000,
    seed = 1,
  } = options;
  const random = seededRandom(seed);
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.min(
    buffer.length - start,
    Math.round(seconds * SAMPLE_RATE),
  );
  const smoothing = 1 - Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE);
  let filtered = 0;
  for (let i = 0; i < length; i++) {
    filtered += smoothing * (random() * 2 - 1 - filtered);
    buffer[start + i] +=
      gain * attackDecay(i / SAMPLE_RATE, attack, decay) * filtered;
  }
}

/** Fades the last few milliseconds to zero so the sound never ends on a click. */
function fadeOut(buffer, seconds = 0.012) {
  const length = Math.min(buffer.length, Math.round(seconds * SAMPLE_RATE));
  for (let i = 0; i < length; i++) {
    buffer[buffer.length - 1 - i] *= i / length;
  }
  return buffer;
}

/** Scales the sound so its loudest sample sits at PEAK. Silence stays silence. */
function normalise(buffer) {
  let loudest = 0;
  for (let i = 0; i < buffer.length; i++) {
    loudest = Math.max(loudest, Math.abs(buffer[i]));
  }
  if (loudest === 0) {
    return buffer;
  }
  const scale = PEAK / loudest;
  for (let i = 0; i < buffer.length; i++) {
    buffer[i] *= scale;
  }
  return buffer;
}

/** A bell-like note: the fundamental plus a quieter octave that dies sooner. */
function addBell(buffer, freq, at, decay, gain = 1) {
  addTone(buffer, { freq, at, decay, gain });
  addTone(buffer, {
    freq: freq * 2,
    at,
    decay: decay * 0.5,
    gain: gain * 0.22,
  });
}

/**
 * Every sound in the game. The keys are the names the app plays them by
 * (SoundName in src/ui/sound.ts and the table in CoupSoundModule.kt).
 */
const SOUNDS = {
  /** It is your turn: two rising notes (E5 then A5). */
  turn() {
    const buffer = silence(0.46);
    addBell(buffer, 659.25, 0, 0.09);
    addBell(buffer, 880.0, 0.13, 0.11);
    return buffer;
  },

  /** You are asked to respond: one soft, rounded note (C5). */
  prompt() {
    const buffer = silence(0.34);
    addTone(buffer, { freq: 523.25, attack: 0.012, decay: 0.09 });
    addTone(buffer, {
      freq: 523.25,
      attack: 0.012,
      decay: 0.05,
      gain: 0.12,
      wave: triangle,
    });
    return buffer;
  },

  /** Coins changed hands: a short metallic tick made of partials that are not in tune. */
  coin() {
    const buffer = silence(0.2);
    [
      [2093, 0.045, 1],
      [3171, 0.035, 0.7],
      [4527, 0.028, 0.45],
      [6240, 0.018, 0.25],
    ].forEach(([freq, decay, gain]) =>
      addTone(buffer, { freq, decay, gain, attack: 0.001 }),
    );
    addNoise(buffer, {
      seconds: 0.012,
      gain: 0.5,
      attack: 0.0005,
      decay: 0.003,
      cutoff: 9000,
      seed: 11,
    });
    return buffer;
  },

  /** A card is lost: a soft low thud, then the swish of it turning over. */
  card() {
    const buffer = silence(0.32);
    addTone(buffer, {
      freq: 150,
      endFreq: 60,
      attack: 0.003,
      decay: 0.05,
      gain: 1,
    });
    addNoise(buffer, {
      at: 0.03,
      seconds: 0.27,
      gain: 0.9,
      attack: 0.07,
      decay: 0.06,
      cutoff: 2600,
      seed: 23,
    });
    return buffer;
  },

  /** A challenge is settled: a short tense sting (D4 against G#4, a tritone, with a low D under it). */
  challenge() {
    const buffer = silence(0.44);
    addTone(buffer, { freq: 293.66, decay: 0.12, wave: triangle });
    addTone(buffer, { freq: 415.3, decay: 0.12, gain: 0.9, wave: triangle });
    addTone(buffer, { freq: 146.83, decay: 0.09, gain: 0.5 });
    addNoise(buffer, {
      seconds: 0.03,
      gain: 0.35,
      attack: 0.001,
      decay: 0.008,
      cutoff: 5000,
      seed: 37,
    });
    return buffer;
  },

  /** You won: a rising arpeggio (C5 E5 G5 C6). */
  win() {
    const buffer = silence(0.58);
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, index) =>
      addBell(buffer, freq, index * 0.085, index === 3 ? 0.13 : 0.08),
    );
    return buffer;
  },

  /** The game ended and you did not win: two falling notes (G4 then E-flat 4). */
  lose() {
    const buffer = silence(0.58);
    addTone(buffer, { freq: 392.0, decay: 0.1, attack: 0.01, wave: triangle });
    addTone(buffer, {
      freq: 311.13,
      at: 0.2,
      decay: 0.14,
      attack: 0.01,
      wave: triangle,
    });
    return buffer;
  },
};

/** The finished samples of one sound, between -1 and 1. */
function renderSound(name) {
  return normalise(fadeOut(SOUNDS[name]()));
}

/** Packs samples (-1 to 1) into a 16-bit mono PCM WAV file. */
function encodeWav(samples, sampleRate = SAMPLE_RATE) {
  const BYTES_PER_SAMPLE = 2;
  const HEADER_BYTES = 44;
  const dataBytes = samples.length * BYTES_PER_SAMPLE;
  const wav = Buffer.alloc(HEADER_BYTES + dataBytes);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(HEADER_BYTES - 8 + dataBytes, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16); // size of the format block
  wav.writeUInt16LE(1, 20); // 1 = uncompressed PCM
  wav.writeUInt16LE(1, 22); // channels
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * BYTES_PER_SAMPLE, 28); // bytes per second
  wav.writeUInt16LE(BYTES_PER_SAMPLE, 32); // bytes per sample frame
  wav.writeUInt16LE(16, 34); // bits per sample
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    wav.writeInt16LE(Math.round(clamped * 32767), HEADER_BYTES + i * 2);
  }
  return wav;
}

function fileNameFor(name) {
  return `${FILE_PREFIX}${name}.wav`;
}

/** Writes every sound into `directory` and returns the paths written. */
function writeSounds(directory = OUTPUT_DIR) {
  fs.mkdirSync(directory, { recursive: true });
  return Object.keys(SOUNDS).map(name => {
    const file = path.join(directory, fileNameFor(name));
    fs.writeFileSync(file, encodeWav(renderSound(name)));
    return file;
  });
}

if (require.main === module) {
  writeSounds().forEach(file => {
    const bytes = fs.statSync(file).size;
    console.log(`${path.relative(process.cwd(), file)}  ${bytes} bytes`);
  });
}

module.exports = {
  MAX_SECONDS,
  OUTPUT_DIR,
  PEAK,
  SAMPLE_RATE,
  SOUNDS,
  encodeWav,
  fileNameFor,
  renderSound,
  seededRandom,
  writeSounds,
};
