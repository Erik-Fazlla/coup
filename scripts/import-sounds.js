/**
 * Converts the sound effects listed in assets/sounds/manifest.json from their CC0
 * sources (assets/sounds/source/) into the files the app plays:
 * android/app/src/main/res/raw/sfx_<name>.ogg (mono OGG Vorbis, loudness matched).
 *
 *   npm run sounds        (needs ffmpeg on the PATH)
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SOURCE_DIR = path.join(ROOT, 'assets', 'sounds', 'source');
const RAW_DIR = path.join(ROOT, 'android', 'app', 'src', 'main', 'res', 'raw');
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'assets', 'sounds', 'manifest.json'), 'utf8'),
);
const FADE_SECONDS = 0.15;

/** `revealTrue` -> `sfx_reveal_true` (Android resource names are lower case with underscores). */
function resourceName(name) {
  return `sfx_${name.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
}

/** The ffmpeg arguments that turn one source into one app sound. */
function ffmpegArgs(input, output, { seconds }) {
  const filters = ['loudnorm=I=-18:TP=-2:LRA=7'];
  const args = ['-y', '-v', 'error', '-i', input];
  if (seconds) {
    args.push('-t', String(seconds));
    filters.push(
      `afade=t=out:st=${(seconds - FADE_SECONDS).toFixed(2)}:d=${FADE_SECONDS}`,
    );
  }
  args.push(
    '-af',
    filters.join(','),
    '-ar',
    '44100',
    '-ac',
    '1',
    '-c:a',
    'libvorbis',
    '-q:a',
    '4',
    output,
  );
  return args;
}

function main() {
  for (const file of fs.readdirSync(RAW_DIR)) {
    if (file.startsWith('sfx_')) {
      fs.unlinkSync(path.join(RAW_DIR, file));
    }
  }
  for (const [name, entry] of Object.entries(MANIFEST)) {
    const output = path.join(RAW_DIR, `${resourceName(name)}.ogg`);
    execFileSync(
      'ffmpeg',
      ffmpegArgs(path.join(SOURCE_DIR, entry.source), output, entry),
    );
    console.log(`${name} -> ${path.relative(ROOT, output)}`);
  }
}

if (require.main === module) {
  main();
}

module.exports = { MANIFEST, RAW_DIR, resourceName, ffmpegArgs };
