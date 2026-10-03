#!/usr/bin/env node
/**
 * Installs the Coup release APK on every phone connected by USB.
 * Run with: npm run install:device
 *
 * It finds adb (the Android tool that talks to phones) on its own. When adb or a
 * phone is missing it explains, in plain steps, what to do instead.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const PACKAGE_NAME = 'com.coup';
const PROJECT_ROOT = path.resolve(__dirname, '..');

/** Places adb is usually found, most specific first. */
function adbCandidates(env, platform, homeDir) {
  const exe = platform === 'win32' ? 'adb.exe' : 'adb';
  const sdkRoots = [env.ANDROID_HOME, env.ANDROID_SDK_ROOT];
  if (platform === 'win32') {
    sdkRoots.push(
      env.LOCALAPPDATA && path.join(env.LOCALAPPDATA, 'Android', 'Sdk'),
      path.join(homeDir, 'AppData', 'Local', 'Android', 'Sdk'),
      'C:\\Android\\Sdk',
      'C:\\Android\\android-sdk',
    );
  } else if (platform === 'darwin') {
    sdkRoots.push(path.join(homeDir, 'Library', 'Android', 'sdk'));
  } else {
    sdkRoots.push(path.join(homeDir, 'Android', 'Sdk'));
  }
  const candidates = sdkRoots
    .filter(Boolean)
    .map(root => path.join(root, 'platform-tools', exe));
  return [...new Set(candidates)];
}

/** Path of adb on PATH, or null. */
function adbOnPath(platform) {
  const finder = platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(finder, ['adb'], { encoding: 'utf8' });
  if (result.status !== 0 || !result.stdout) {
    return null;
  }
  return result.stdout.split(/\r?\n/)[0].trim() || null;
}

function findAdb(env, platform, homeDir, exists, onPath) {
  const found = adbCandidates(env, platform, homeDir).find(exists);
  return found || onPath(platform) || null;
}

/** The APK to install: the fresh build output, or the copy in dist/. */
function findApk(root, exists) {
  const candidates = [
    path.join(
      root,
      'android',
      'app',
      'build',
      'outputs',
      'apk',
      'release',
      'app-release.apk',
    ),
    path.join(root, 'dist', 'coup.apk'),
  ];
  return candidates.find(exists) || null;
}

/** Turns `adb devices` output into [{ serial, state }]. */
function parseDevices(output) {
  return output
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(
      line => line && !line.startsWith('*') && !line.startsWith('List of'),
    )
    .map(line => line.split(/\s+/))
    .filter(parts => parts.length >= 2)
    .map(([serial, state]) => ({ serial, state }));
}

/** Plain-language reason for a failed `adb install`, with the fix. */
function explainInstallFailure(output) {
  if (output.includes('INSTALL_FAILED_UPDATE_INCOMPATIBLE')) {
    return [
      'The phone already has a Coup app that was signed with a different key,',
      'so Android refuses to replace it.',
      'Fix: uninstall Coup on the phone (this resets its saved name and stats),',
      'then run this command again.',
    ].join('\n');
  }
  if (output.includes('INSTALL_FAILED_VERSION_DOWNGRADE')) {
    return 'The phone has a newer version of Coup than this APK. Uninstall Coup on the phone, then run this again.';
  }
  if (output.includes('INSTALL_FAILED_INSUFFICIENT_STORAGE')) {
    return 'The phone does not have enough free space. Free up about 150 MB and run this again.';
  }
  if (output.includes('INSTALL_FAILED_USER_RESTRICTED')) {
    return [
      'The phone blocked the install.',
      'Fix: on the phone open Settings > Developer options and turn on "Install via USB"',
      '(Xiaomi/Redmi/POCO also need "USB debugging (Security settings)"), then run this again.',
      'If a prompt appeared on the phone, tap Install / Allow.',
    ].join('\n');
  }
  return `adb reported:\n${output.trim()}`;
}

const MANUAL_STEPS = (apkPath, adbMissing) =>
  [
    '',
    adbMissing
      ? 'ADB not found on this computer. No problem: install the app by copying the file instead.'
      : 'You can also install the app by copying the file instead:',
    '',
    `  The file:  ${apkPath}`,
    '',
    '  1. Get the file onto the phone, whichever is easiest:',
    '       - Plug the phone in by USB, choose "File transfer" on the phone,',
    "         and drag the file into the phone's Download folder; or",
    '       - upload it to Google Drive and open Drive on the phone; or',
    '       - send it to yourself on Telegram ("Saved Messages").',
    '  2. On the phone, tap the file (in Files > Downloads, Drive or Telegram).',
    '  3. Android asks to allow installs from that app: tap Settings,',
    '     switch on "Allow from this source", go back, tap Install.',
    '  4. If Play Protect warns about an unknown developer, choose "Install anyway".',
    '',
    adbMissing
      ? '  (To use the one-command install later, install Android Studio or the\n   "SDK Platform-Tools" from developer.android.com and run this again.)'
      : '',
  ].join('\n');

const USB_DEBUGGING_STEPS = [
  '',
  'No phone detected. To let this computer install the app:',
  '',
  '  1. On the phone: Settings > About phone > tap "Build number" 7 times',
  '     (Samsung: Settings > About phone > Software information > Build number).',
  '  2. Settings > System > Developer options > turn on "USB debugging".',
  '  3. Plug the phone into this computer with a USB cable that carries data',
  '     (some cables only charge).',
  '  4. The phone shows "Allow USB debugging?" - tap Allow.',
  '  5. Run this command again:  npm run install:device',
].join('\n');

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  return {
    ok: result.status === 0,
    output: `${result.stdout || ''}${result.stderr || ''}`,
  };
}

function main() {
  const log = message => process.stdout.write(`${message}\n`);

  const apk = findApk(PROJECT_ROOT, fs.existsSync);
  if (!apk) {
    log('No APK found. Build it first:');
    log('  npm run build:android     (see "Build the APK" in README.md)');
    return 1;
  }
  const sizeMb = (fs.statSync(apk).size / 1024 / 1024).toFixed(1);
  log(`APK: ${apk} (${sizeMb} MB)`);

  const adb = findAdb(
    process.env,
    process.platform,
    os.homedir(),
    fs.existsSync,
    adbOnPath,
  );
  if (!adb) {
    log(MANUAL_STEPS(apk, true));
    return 1;
  }
  log(`ADB: ${adb}`);

  const listed = run(adb, ['devices']);
  if (!listed.ok) {
    log(`Could not run adb:\n${listed.output.trim()}`);
    log(MANUAL_STEPS(apk, false));
    return 1;
  }

  const devices = parseDevices(listed.output);
  const ready = devices.filter(device => device.state === 'device');
  const waiting = devices.filter(device => device.state === 'unauthorized');

  waiting.forEach(device => {
    log('');
    log(
      `Phone ${device.serial} is connected but has not allowed this computer yet.`,
    );
    log('Unlock the phone and tap Allow on the "Allow USB debugging?" prompt,');
    log(
      'then run this command again. (No prompt? Unplug and plug the cable back in.)',
    );
  });

  if (ready.length === 0) {
    if (waiting.length === 0) {
      log(USB_DEBUGGING_STEPS);
    }
    log(MANUAL_STEPS(apk, false));
    return 1;
  }

  let failures = 0;
  ready.forEach(device => {
    log('');
    log(`Installing on ${device.serial} ... (can take a minute)`);
    const installed = run(adb, ['-s', device.serial, 'install', '-r', apk]);
    if (installed.ok && installed.output.includes('Success')) {
      log(`APK installed on ${device.serial}!`);
      run(adb, [
        '-s',
        device.serial,
        'shell',
        'monkey',
        '-p',
        PACKAGE_NAME,
        '-c',
        'android.intent.category.LAUNCHER',
        '1',
      ]);
      log('Coup should now be open on the phone.');
    } else {
      failures += 1;
      log(`Install failed on ${device.serial}.`);
      log(explainInstallFailure(installed.output));
    }
  });

  if (failures > 0) {
    log(MANUAL_STEPS(apk, false));
    return 1;
  }
  return 0;
}

if (require.main === module) {
  process.exitCode = main();
}

module.exports = {
  adbCandidates,
  explainInstallFailure,
  findAdb,
  findApk,
  parseDevices,
};
