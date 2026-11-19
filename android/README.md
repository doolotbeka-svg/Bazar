# AlMart Android app (Google Play)

A Trusted Web Activity: the app opens https://tezbazar.vercel.app full-screen in Chrome,
so every change to the website is in the app immediately, without a new release.

- Package: `kg.almart.app` (cannot be changed after the first upload to Google Play)
- Library: `com.google.androidbrowserhelper` (LauncherActivity)

## Build

Needs Android Studio (its JDK) and the Android SDK.

```powershell
$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
cd android
.\gradlew.bat bundleRelease assembleRelease
```

- `app/build/outputs/bundle/release/app-release.aab`: upload this to Google Play
- `app/build/outputs/apk/release/app-release.apk`: install directly on a phone for testing

For every new upload, raise `versionCode` (and `versionName`) in `app/build.gradle.kts`.

## Signing (upload key)

`almart-upload.jks` and `keystore.properties` sit in this folder and are **not** in git.
Keep a backup of both (password manager or a private drive). If they are lost, the upload
key can be reset through Google Play support, but it takes days.

## Full-screen mode (Digital Asset Links)

The site serves `/.well-known/assetlinks.json` from the Vercel env var `ANDROID_CERT_SHA256`
(comma separated SHA-256 fingerprints). It must contain:

1. the upload key: `63:FD:69:1E:D4:25:56:42:95:3A:C3:78:D2:8F:C0:35:49:4C:C5:88:C1:BD:9F:59:F3:74:5D:F6:26:EA:01:CA`
2. the **Google Play app-signing key**, from Play Console → Test and release → App integrity

Without the right fingerprint the app still works but shows a browser address bar.
