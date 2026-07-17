# Play Store Release Runbook

This runbook prepares the Selah Ember Trusted Web Activity for Google Play. Do not publish or roll out from Codex.

## Release Inputs Needed

- Final production URL: `https://selahember.com`.
- Android package name: `com.seraphcore.selahember`.
- Play App Signing SHA-256 certificate fingerprint.
- Upload signing key, stored outside the repository.
- Privacy policy URL.
- App category and contact details.
- Screenshots and graphic assets.

## Digital Asset Links Setup

1. Replace placeholders in `public/.well-known/assetlinks.json`.
2. Deploy the website to Vercel.
3. Confirm the file is publicly available:

```powershell
curl https://selahember.com/.well-known/assetlinks.json
```

4. Install the Android build and verify app links:

```powershell
adb shell pm get-app-links com.seraphcore.selahember
adb shell am start -a android.intent.action.VIEW -d https://selahember.com/community
```

The TWA should open full screen after Digital Asset Links verification. If Chrome shows browser UI, the package name, fingerprint, or origin is not verified.

## Build Requirements

- Current Android Studio.
- Android SDK with API 35 or newer installed.
- Java version compatible with the selected Android Gradle Plugin/Bubblewrap release.
- Node.js/npm for Bubblewrap tooling.
- Bubblewrap CLI or Android Browser Helper project tooling.

Install Bubblewrap if needed:

```powershell
npm install -g @bubblewrap/cli
```

Check tooling:

```powershell
bubblewrap doctor
```

## Build Commands

Web project verification:

```powershell
cd K:\projects\SelahEmber
cmd /c npm run lint
cmd /c npm run build
cmd /c npm run test:a11y
git diff --check
```

Android project build:

```powershell
cd K:\projects\SelahEmberAndroid
bubblewrap update
bubblewrap build
```

Expected Play artifact:

```text
K:\projects\SelahEmberAndroid\app-release-bundle.aab
```

## Internal Testing Track

1. Create or open the Selah Ember app in Play Console.
2. Confirm Play App Signing is enabled.
3. Upload the `.aab` to Internal testing.
4. Add tester emails or Google Groups.
5. Complete all required policy declarations.
6. Roll out to internal testers.
7. Install from the Play Store testing link on a real Android device.
8. Verify Digital Asset Links full-screen TWA behavior and the app checklist in `docs/ANDROID_APP.md`.

## Store Listing Checklist

- App name: `Selah Ember`.
- Short description.
- Full description.
- App icon.
- Feature graphic.
- Phone screenshots.
- Tablet screenshots if targeting tablets.
- Contact email.
- Website URL.
- Privacy policy URL.

## Privacy And Data Safety Checklist

Selah Ember uses Supabase authentication, database, and storage through the live website. Confirm declarations for:

- Account creation and sign-in.
- User-generated content.
- Messages.
- Photos/videos/file uploads.
- Profile information.
- App activity and diagnostics/logging.
- Data deletion/contact process.
- Encryption in transit.
- Whether data is shared with service providers such as Supabase and Vercel.

Do not include Supabase service role keys, signing secrets, or Play credentials in the repository.

## Content Rating Checklist

Complete the Play Console content rating questionnaire for:

- Social/community features.
- User-generated content.
- Moderation/reporting.
- Religious/faith-oriented content.
- Messaging.
- Media uploads.

## Update Strategy

Normal Selah Ember website deployments update automatically inside the Android TWA because the app loads the live web origin. Deploying Next.js changes to Vercel updates the app without a Google Play release, subject to normal browser cache and service worker update timing.

The web service worker is versioned and network-first for navigations, so HTML should not remain stale indefinitely. Static assets are content-hashed by Next.js and cached safely.

Create a new Play Store release only for:

- Android target API changes.
- Android permissions changes.
- Package name or manifest metadata changes.
- App icon, adaptive icon, or splash screen changes.
- Native dependency/security updates.
- Signing/app identity changes.
- New native Android capabilities.

## Release Stop Conditions

Do not release if:

- Digital Asset Links verification fails.
- The app opens as a browser tab instead of a verified TWA.
- Auth callback fails.
- Upload file chooser fails on a real device.
- Private/authenticated content appears while signed out.
- The `.aab` contains signing secrets or service role credentials.
- The Play App Signing fingerprint does not match `assetlinks.json`.
