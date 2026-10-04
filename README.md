# Coup

Multiplayer Coup card game for Android (an iPhone build is set up but untested, see [docs/ios-build.md](docs/ios-build.md)). React Native + Firebase Realtime Database. 2–10 players, each on their own phone, joined by a 5-character code.

## Requirements

- Node 22.11 or newer
- JDK 17 for the Android build (it does not run on newer Java defaults such as Java 26; see "Build the APK")
- Android SDK with `ANDROID_HOME` set
- A Firebase project (the free Spark plan is enough)

## Install

```bash
npm install
```

## Firebase setup

1. In the [Firebase console](https://console.firebase.google.com), create a project. Analytics is not needed.
2. **Build → Realtime Database → Create database.** Choose a region and start in locked mode.
3. **Realtime Database → Rules:** replace the contents with `database.rules.json` from this repo and publish.
4. **Project settings → Your apps → Web app (`</>`)**: register an app, then copy the values of `firebaseConfig` into `src/firebase/config.ts`. `databaseURL` must be present.
5. Rebuild the app. Until the config is filled in, the app shows "Firebase is not configured".

### About security

The app has no login. The rules allow anyone who has the Firebase config to read and write `/games`, `/codes` and `/profiles`, and nothing else. Hidden cards are hidden by the app, not by the database. This is fine for playing with friends; do not store anything sensitive in this Firebase project and do not reuse it for another app.

## Tests

```bash
npm test
```

Rules engine, profile store and id generation.

```bash
npm run test:sync
```

Runs three simulated players against the local Firebase emulator (needs Java on `PATH`; any recent version works for the emulator).

On Windows the emulator's `java.exe` can stay alive after the run and keep port 9000 busy, which makes the next run fail with "port taken". Stop the leftover process, then run again:

```powershell
Get-CimInstance Win32_Process -Filter "Name='java.exe'" | Where-Object CommandLine -match 'firebase-database-emulator' | ForEach-Object { Stop-Process -Id $_.ProcessId }
```

```bash
npm run typecheck
```

## Build the APK

Point the build at JDK 17 for the current PowerShell session only (adjust the path to your JDK 17; this does not change the system default Java):

```powershell
$env:JAVA_HOME = "$env:USERPROFILE\.jdk\jdk-17.0.16"; $env:Path = "$env:JAVA_HOME\bin;$env:Path"
```

Build:

```powershell
npm run build:android
```

(Windows shortcut for `cd android; .\gradlew.bat assembleRelease`. It needs the JDK 17 session above. On macOS or Linux run `cd android && ./gradlew assembleRelease` instead.)

The APK is at `android/app/build/outputs/apk/release/app-release.apk`. The first build downloads Gradle and the Android dependencies and needs an internet connection.

### Signing

Release builds are signed with `android/app/coup-release.keystore` using the credentials in `android/keystore.properties`:

```
storeFile=coup-release.keystore
storePassword=...
keyAlias=coup
keyPassword=...
```

Both files are git-ignored. Keep a backup: an APK signed with a different key cannot be installed over an existing install. Without these files the build falls back to the debug key.

To create a new keystore:

```powershell
& "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -storetype PKCS12 -keystore android\app\coup-release.keystore -alias coup -keyalg RSA -keysize 2048 -validity 10000
```

## Install on phones

### Your own phone, for testing: one command

```bash
npm run install:device
```

This finds the Android tools on the computer, installs the latest built APK on every phone connected by USB, and opens the app. If something is missing (no phone detected, phone not yet allowed, tools not installed) it prints the exact steps to fix it.

The phone needs USB debugging switched on once:

1. **Settings → About phone →** tap **Build number** 7 times (Samsung: About phone → Software information → Build number).
2. **Settings → System → Developer options →** turn on **USB debugging**.
3. Plug the phone in with a cable that carries data. The phone asks "Allow USB debugging?" → **Allow**.

### Friends: install from the file

No computer or cable needed. Send them the file `android/app/build/outputs/apk/release/app-release.apk` (about 56 MB; rename it `coup.apk` if you like).

1. **Send the file.** Google Drive link or Telegram work well. WhatsApp and email often block `.apk` files.
2. **On the phone, tap the file** (in Drive, Telegram, or Files → Downloads).
3. Android says it cannot install apps from this source. Tap **Settings**, switch on **Allow from this source**, go back, tap **Install**.
4. If Play Protect warns about an unknown developer, choose **Install anyway** (the app is not on the Play Store, so this warning is expected).
5. Open **Coup**, enter a name, then **Join** with the code the host shares.

Updating later: send the new file and repeat steps 2–4. The app keeps its name and stats as long as the APK was built with the same signing key (see "Signing").

Android 7.0 or newer is required.

### iPhones

An iPhone build is produced by GitHub Actions (`.github/workflows/build-ios.yml`) once an Apple Developer account (USD 99 per year) and three signing secrets are in place. It has never been built or run yet. Setup, install routes, cost and known gaps: [docs/ios-build.md](docs/ios-build.md).

## Run in development

Start Metro in one terminal:

```bash
npm start
```

Build and launch the debug app in another (JDK 17 session, device or emulator connected):

```bash
npm run android
```

## How to play

1. Everyone enters a name on first launch.
2. One player taps **Create Game** and shares the code.
3. Others enter the code and tap **Join**. The host taps **Start Game** (2–10 players).
4. On your turn, choose an action. After a claim, every other player taps **Pass**, **Challenge** or **Block**; the game continues once everyone has answered.

Full base-game rules are implemented: Income, Foreign Aid, Coup, Duke (Tax, blocks Foreign Aid), Assassin, Captain (Steal, blocks Steal), Ambassador (Exchange, blocks Steal), Contessa (blocks Assassination), challenges on actions and blocks, forced Coup at 10 coins.

The deck has 3 of each character (15 cards) for 2–6 players and 4 of each (20 cards) for 7–10. With 10 players all 20 cards are dealt, so the deck starts empty: an Exchange then has nothing to draw until a card comes back to the deck.

## Sounds

The sound effects (your turn, a prompt to respond, coins, a lost card, a challenge, win, lose) are not downloaded: `npm run sounds` makes them from code (`scripts/generate-sounds.js`) and writes them as small WAV files to `android/app/src/main/res/raw/`, which are committed; running it again gives identical files. They follow the phone's media volume and stay quiet when the phone is on silent or vibrate. To turn them off in the app: **Home → Settings → Sound**.

## Known limits

- No turn timer: if a player stops responding, the game waits for them. Reopening the app returns them to the game.
- A player who taps **Quit** during a game stays in it as a silent player; the others will be waiting for their responses. They can rejoin with the same code.
- A player who holds the claimed card always shows it when challenged (the official rules let them choose to lose a card instead).
- Tested on Android only. The iPhone build is unverified and has no sound, no app icon and no keep-screen-on (see [docs/ios-build.md](docs/ios-build.md)).
- A 7–10 player table has only been checked by the automated tests, not on phones.

## Project layout

```
src/engine      Rules as pure functions (no React Native, no Firebase)
src/firebase    Config and game service (transactions on /games/{gameId})
src/profile     Local profile and stats
src/context     React contexts
src/screens     Setup, Welcome, Home, Lobby, Game, Game Over
src/components  Cards, seats, action and response controls
sync            Emulator-based multiplayer test
docs            Design spec, implementation plans, iOS build setup
.github         iOS build workflow
```
