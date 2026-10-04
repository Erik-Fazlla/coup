# iOS build

The iPhone version is built by GitHub Actions, on Apple hardware in the cloud. No Mac is needed to build it. A Mac makes the one-time certificate step a little easier, but that step can also be done on Windows.

Workflow: `.github/workflows/build-ios.yml`. It produces `coup-ios.ipa` and attaches it to the GitHub Release, next to `coup.apk`.

## Status

**The iOS app has never been built or run.** The project was developed and tested on Android, on Windows, where an iOS build is not possible. Expect the first CI run to need fixes. Known gaps:

| Gap | Effect on iPhone |
| --- | --- |
| No app icon (`ios/Coup/Images.xcassets/AppIcon.appiconset` is empty) | Blank icon. An App Store / TestFlight upload is rejected without one. |
| Sound effects are an Android-only native module (`CoupSoundModule.kt`) | The app is silent. Everything else works without it. |
| Keep-screen-on is Android-only (`MainActivity.kt`) | The screen dims and locks on its normal timer. |
| Bundle identifier in the project is the React Native placeholder | None: the workflow takes the real one from the provisioning profile. |
| Layout was never seen on an iPhone | Unknown. The layout code is shared with Android. |

## What you need

1. **Apple Developer Program membership: USD 99 per year.** <https://developer.apple.com/programs/enroll/>. Enrolment needs an Apple ID with two-factor authentication and usually takes a day or two to be approved. Without it an `.ipa` cannot be signed and no iPhone will install it. There is no free route for an app shared with friends.
2. **The three GitHub secrets below.**

## How friends install it: choose one

An iPhone does not install an `.ipa` the way Android installs an `.apk`. There are two routes, and the provisioning profile you create decides which one the build is for.

| | Ad hoc | TestFlight |
| --- | --- | --- |
| Profile type | **Ad Hoc** | **App Store Connect** |
| Who can install | Only iPhones whose UDID you registered, up to 100 per year | Anyone you invite by email, up to 10,000 |
| Adding a friend later | Register their UDID, regenerate the profile, update the secret, rebuild | Add their email in App Store Connect |
| Install | Not a plain tap on a file: a Mac with Apple Configurator or Xcode, or an over-the-air install service such as Diawi | Friend installs the TestFlight app and taps the invite |
| Apple review | None | A short beta review before outside testers get it |
| Needs an app icon | No | Yes |
| What the workflow does | Builds the `.ipa`, attaches it to the release | Builds the `.ipa`, attaches it to the release. **Uploading it to TestFlight is a manual step** (Apple's Transporter app, Mac only) and is not automated here. |

The `.ipa` on the GitHub Release is only directly useful with the ad hoc route. For a group with several iPhones, TestFlight is less work per friend once it is set up, but it needs the app icon and the upload step added first.

## One-time setup

All of this is done by you, signed in to your Apple account. Nothing here is stored in the repository.

### 1. Register the app identifier

<https://developer.apple.com/account/resources/identifiers/list> → **+** → **App IDs** → **App**.

- Description: `Coup`
- Bundle ID: **Explicit**, for example `com.erikfazlla.coup`. It must be unique across all of Apple, and changing it later makes it a different app.
- No capabilities need to be ticked.

### 2. Create the distribution certificate

You need a certificate **and its private key** in one `.p12` file.

**On a Mac:**

1. Keychain Access → menu **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**. Enter your email and choose **Saved to disk**.
2. <https://developer.apple.com/account/resources/certificates/list> → **+** → **Apple Distribution** → upload the request file → download the `.cer`.
3. Double-click the `.cer` to add it to Keychain Access.
4. In Keychain Access, under **My Certificates**, right-click the certificate → **Export** → format `.p12`. Choose a password. This is `IOS_CERTIFICATE_PASSWORD`.

**On Windows (OpenSSL comes with Git for Windows; run these in Git Bash, in a folder outside the repository):**

```bash
openssl genrsa -out ios-distribution.key 2048
```

```bash
openssl req -new -key ios-distribution.key -out ios-distribution.csr -subj "/emailAddress=you@example.com/CN=Your Name/C=GR"
```

Upload `ios-distribution.csr` at the certificates page (**+** → **Apple Distribution**), download `distribution.cer`, then:

```bash
openssl x509 -inform DER -in distribution.cer -out distribution.pem
```

```bash
openssl pkcs12 -export -legacy -inkey ios-distribution.key -in distribution.pem -out ios-distribution.p12
```

The last command asks for an export password: that is `IOS_CERTIFICATE_PASSWORD`. (`-legacy` is there because macOS cannot read OpenSSL 3's default encryption. If your OpenSSL is older than 3.0 and rejects the flag, leave it out.)

Keep `ios-distribution.key` and the `.p12` somewhere safe and private, together with the Android keystore backup. An account can hold only a few distribution certificates, and a lost key means making a new one.

### 3. Register the iPhones (ad hoc route only)

<https://developer.apple.com/account/resources/devices/list> → **+**. Each iPhone needs its **UDID**: connect the phone to a computer and read it in Finder (Mac) or the Apple Devices app / iTunes (Windows), clicking the line under the phone's name until it shows the UDID.

### 4. Create the provisioning profile

<https://developer.apple.com/account/resources/profiles/list> → **+**.

- **Ad Hoc** or **App Store Connect** (see the table above).
- App ID: the one from step 1. **Not a wildcard.**
- Certificate: the one from step 2.
- Devices (ad hoc): select all of them.
- Name: anything, for example `Coup Ad Hoc`.

Download the `.mobileprovision` file.

### 5. Add the secrets to GitHub

Turn both files into one line of text each (Git Bash on Windows):

```bash
base64 -w 0 ios-distribution.p12 > certificate.txt
```

```bash
base64 -w 0 Coup_Ad_Hoc.mobileprovision > profile.txt
```

(On a Mac: `base64 -i ios-distribution.p12 -o certificate.txt`, and the same for the profile.)

In the repository on GitHub: **Settings → Secrets and variables → Actions → New repository secret**. Add three:

| Secret | Value |
| --- | --- |
| `IOS_CERTIFICATE_P12_BASE64` | The whole contents of `certificate.txt` |
| `IOS_CERTIFICATE_PASSWORD` | The `.p12` export password from step 2 |
| `IOS_PROVISIONING_PROFILE_BASE64` | The whole contents of `profile.txt` |

Then delete `certificate.txt` and `profile.txt`. A secret cannot be read back from GitHub, only replaced, and GitHub hides it in build logs.

The team ID, the bundle identifier, the profile name and whether the build is ad hoc or App Store are all read from the profile during the build, so there is nothing else to configure.

## When it builds

| Trigger | Built from | `.ipa` goes to |
| --- | --- | --- |
| Push to `main` (not for changes only in docs, `android/` or `sync/`) | `main` | The **newest** release, replacing its `coup-ios.ipa` |
| A release is published | That release's tag | That release |
| **Actions → Build iOS → Run workflow** | The chosen branch | The tag you type, or the newest release |

Every run also keeps the `.ipa` as a run artifact for 14 days (**Actions → the run → Artifacts**).

About the first row: after a push to `main`, the newest release holds an iPhone build of current `main` next to an Android APK from when the release was made. For a matched pair, publish a new release.

Until the three secrets exist the workflow does nothing: it finishes in a few seconds on a Linux runner with a notice, and no macOS minutes are used.

## Cost of the builds

The repository is private, so macOS runners use the account's included Actions minutes at **10 times** the normal rate. A free GitHub account includes 2,000 minutes a month, which is about 200 minutes of macOS time. A React Native iOS build takes roughly 20 to 35 minutes, so that is about 6 to 10 builds a month. After that, builds stop until the next month unless a spending limit above zero is set under **Settings → Billing**.

If that is too few, remove the `push:` block from the workflow so it builds only for a release or on request.

## When a build fails

Open the run under **Actions**. The **Archive** step prints the compiler and signing errors; the full log is in the `xcodebuild-log` artifact.

| Message | Cause |
| --- | --- |
| `No signing identity in the certificate` | The `.p12` holds the certificate without its private key. Export it again as in step 2. |
| `The provisioning profile must be for one explicit App ID` | The profile was created for a wildcard App ID. Create one for the explicit App ID. |
| `Provisioning profile "…" doesn't include signing certificate` | The profile was created with a different certificate than the one in the `.p12`. |
| `MAC verification failed` or a wrong-password error during import | Wrong `IOS_CERTIFICATE_PASSWORD`, or the `.p12` was made without `-legacy`. |
| Profile or certificate expired | Both last one year. Repeat steps 2, 4 and 5. |
