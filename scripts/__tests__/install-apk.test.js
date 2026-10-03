const path = require('path');
const {
  adbCandidates,
  explainInstallFailure,
  findAdb,
  findApk,
  parseDevices,
} = require('../install-apk');

describe('adbCandidates', () => {
  it('checks the SDK environment variables first, then the usual Windows locations', () => {
    const candidates = adbCandidates(
      {
        ANDROID_HOME: 'D:\\SDKs\\Android',
        LOCALAPPDATA: 'C:\\Users\\me\\AppData\\Local',
      },
      'win32',
      'C:\\Users\\me',
    );
    expect(candidates[0]).toBe(
      path.join('D:\\SDKs\\Android', 'platform-tools', 'adb.exe'),
    );
    expect(candidates).toContain(
      path.join(
        'C:\\Users\\me\\AppData\\Local',
        'Android',
        'Sdk',
        'platform-tools',
        'adb.exe',
      ),
    );
  });

  it('uses adb without .exe and the home-folder SDK on macOS and Linux', () => {
    expect(adbCandidates({}, 'darwin', '/Users/me')).toContain(
      path.join(
        '/Users/me',
        'Library',
        'Android',
        'sdk',
        'platform-tools',
        'adb',
      ),
    );
    expect(adbCandidates({}, 'linux', '/home/me')).toContain(
      path.join('/home/me', 'Android', 'Sdk', 'platform-tools', 'adb'),
    );
  });

  it('has no duplicates and skips unset variables', () => {
    const candidates = adbCandidates(
      { ANDROID_HOME: 'D:\\sdk', ANDROID_SDK_ROOT: 'D:\\sdk' },
      'win32',
      'C:\\Users\\me',
    );
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(
      candidates.every(candidate => !candidate.includes('undefined')),
    ).toBe(true);
  });
});

describe('findAdb', () => {
  const env = { ANDROID_HOME: 'D:\\sdk' };
  const inSdk = path.join('D:\\sdk', 'platform-tools', 'adb.exe');

  it('returns the first candidate that exists', () => {
    const exists = candidate => candidate === inSdk;
    expect(findAdb(env, 'win32', 'C:\\Users\\me', exists, () => null)).toBe(
      inSdk,
    );
  });

  it('falls back to adb on PATH', () => {
    expect(
      findAdb(
        env,
        'win32',
        'C:\\Users\\me',
        () => false,
        () => 'C:\\tools\\adb.exe',
      ),
    ).toBe('C:\\tools\\adb.exe');
  });

  it('returns null when adb is nowhere', () => {
    expect(
      findAdb(
        env,
        'win32',
        'C:\\Users\\me',
        () => false,
        () => null,
      ),
    ).toBeNull();
  });
});

describe('findApk', () => {
  const root = path.join('D:', 'Projects', 'Coup');
  const built = path.join(
    root,
    'android',
    'app',
    'build',
    'outputs',
    'apk',
    'release',
    'app-release.apk',
  );
  const copied = path.join(root, 'dist', 'coup.apk');

  it('prefers the fresh build output', () => {
    expect(findApk(root, () => true)).toBe(built);
  });

  it('falls back to dist/coup.apk', () => {
    expect(findApk(root, candidate => candidate === copied)).toBe(copied);
  });

  it('returns null when no APK has been built', () => {
    expect(findApk(root, () => false)).toBeNull();
  });
});

describe('parseDevices', () => {
  it('reads serials and states from adb devices output', () => {
    const output = [
      'List of devices attached',
      'R58M123ABC\tdevice',
      'emulator-5554\toffline',
      '0123456789\tunauthorized',
      '',
    ].join('\r\n');
    expect(parseDevices(output)).toEqual([
      { serial: 'R58M123ABC', state: 'device' },
      { serial: 'emulator-5554', state: 'offline' },
      { serial: '0123456789', state: 'unauthorized' },
    ]);
  });

  it('ignores the header, daemon chatter and blank lines', () => {
    const output = [
      '* daemon not running; starting now at tcp:5037',
      '* daemon started successfully',
      'List of devices attached',
      '',
    ].join('\n');
    expect(parseDevices(output)).toEqual([]);
  });
});

describe('explainInstallFailure', () => {
  it('explains a signature mismatch and how to fix it', () => {
    const text = explainInstallFailure(
      'adb: failed to install app-release.apk: Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.coup signatures do not match newer version]',
    );
    expect(text).toMatch(/different key/i);
    expect(text).toMatch(/uninstall/i);
  });

  it('explains a version downgrade', () => {
    expect(
      explainInstallFailure('Failure [INSTALL_FAILED_VERSION_DOWNGRADE]'),
    ).toMatch(/newer version/i);
  });

  it('explains a full phone', () => {
    expect(
      explainInstallFailure('Failure [INSTALL_FAILED_INSUFFICIENT_STORAGE]'),
    ).toMatch(/space/i);
  });

  it('explains an install blocked on the phone', () => {
    expect(
      explainInstallFailure(
        'Failure [INSTALL_FAILED_USER_RESTRICTED: Install canceled by user]',
      ),
    ).toMatch(/Install via USB/i);
  });

  it('shows the raw message for anything else', () => {
    expect(explainInstallFailure('Failure [SOMETHING_ODD]')).toContain(
      'SOMETHING_ODD',
    );
  });
});
