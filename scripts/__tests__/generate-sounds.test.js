const fs = require('fs');
const path = require('path');
const {
  MAX_SECONDS,
  OUTPUT_DIR,
  SAMPLE_RATE,
  SOUNDS,
  encodeWav,
  fileNameFor,
  renderSound,
  seededRandom,
} = require('../generate-sounds');

const NAMES = Object.keys(SOUNDS);

/** The 16-bit samples of a WAV file made by encodeWav. */
function samplesOf(wav) {
  const values = [];
  for (let offset = 44; offset < wav.length; offset += 2) {
    values.push(wav.readInt16LE(offset));
  }
  return values;
}

describe('encodeWav', () => {
  const wav = encodeWav(Float64Array.from([0, 0.5, -0.5, 1, -1, 2, -2]));

  it('writes a RIFF/WAVE header for 16-bit mono PCM at 44.1 kHz', () => {
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.toString('ascii', 8, 12)).toBe('WAVE');
    expect(wav.toString('ascii', 12, 16)).toBe('fmt ');
    expect(wav.readUInt32LE(16)).toBe(16);
    expect(wav.readUInt16LE(20)).toBe(1); // PCM
    expect(wav.readUInt16LE(22)).toBe(1); // mono
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt32LE(28)).toBe(88200); // bytes per second
    expect(wav.readUInt16LE(32)).toBe(2); // bytes per frame
    expect(wav.readUInt16LE(34)).toBe(16); // bits per sample
    expect(wav.toString('ascii', 36, 40)).toBe('data');
  });

  it('states the data length and the file length correctly', () => {
    expect(wav.readUInt32LE(40)).toBe(7 * 2);
    expect(wav.length).toBe(44 + 7 * 2);
    expect(wav.readUInt32LE(4)).toBe(wav.length - 8);
  });

  it('scales samples to 16 bits and clamps anything out of range', () => {
    expect(samplesOf(wav)).toEqual([
      0, 16384, -16383, 32767, -32767, 32767, -32767,
    ]);
  });

  it('writes a valid empty file for no samples', () => {
    const empty = encodeWav(new Float64Array(0));
    expect(empty.length).toBe(44);
    expect(empty.readUInt32LE(40)).toBe(0);
  });
});

describe('seededRandom', () => {
  it('gives the same numbers for the same seed, between 0 and 1', () => {
    const first = seededRandom(7);
    const second = seededRandom(7);
    const values = Array.from({ length: 200 }, () => first());
    expect(Array.from({ length: 200 }, () => second())).toEqual(values);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    expect(new Set(values).size).toBeGreaterThan(190);
  });
});

describe('the generated sounds', () => {
  it('are the seven the app plays', () => {
    expect(NAMES.sort()).toEqual(
      ['card', 'challenge', 'coin', 'lose', 'prompt', 'turn', 'win'].sort(),
    );
  });

  it.each(NAMES)('%s has an Android-safe file name', name => {
    expect(fileNameFor(name)).toMatch(/^[a-z][a-z0-9_]*\.wav$/);
  });

  it.each(NAMES)('%s is short enough', name => {
    const seconds = renderSound(name).length / SAMPLE_RATE;
    expect(seconds).toBeGreaterThan(0.05);
    expect(seconds).toBeLessThanOrEqual(MAX_SECONDS);
  });

  it.each(NAMES)('%s is audible and never clips', name => {
    const samples = samplesOf(encodeWav(renderSound(name)));
    const peak = Math.max(...samples.map(Math.abs));
    const rms = Math.sqrt(
      samples.reduce((sum, value) => sum + value * value, 0) / samples.length,
    );
    expect(peak).toBeGreaterThan(32767 * 0.3);
    expect(peak).toBeLessThan(32767 * 0.9);
    expect(rms).toBeGreaterThan(32767 * 0.02);
  });

  it.each(NAMES)('%s starts and ends quietly, so it never clicks', name => {
    const samples = samplesOf(encodeWav(renderSound(name)));
    expect(Math.abs(samples[0])).toBeLessThan(2000);
    expect(Math.abs(samples[samples.length - 1])).toBeLessThan(200);
  });

  it('are all different from one another', () => {
    const files = NAMES.map(name =>
      encodeWav(renderSound(name)).toString('base64'),
    );
    expect(new Set(files).size).toBe(NAMES.length);
  });

  it('come out identical every time', () => {
    NAMES.forEach(name => {
      expect(
        encodeWav(renderSound(name)).equals(encodeWav(renderSound(name))),
      ).toBe(true);
    });
  });

  it.each(NAMES)('%s in the app is what the generator makes', name => {
    const committed = fs.readFileSync(path.join(OUTPUT_DIR, fileNameFor(name)));
    expect(committed.equals(encodeWav(renderSound(name)))).toBe(true);
  });
});
