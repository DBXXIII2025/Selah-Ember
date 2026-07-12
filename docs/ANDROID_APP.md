# Selah Ember Android App

Selah Ember's Android app should be a Trusted Web Activity (TWA), not a WebView wrapper. The Android shell loads the live Selah Ember web origin, so normal Vercel website deployments update the app UI/content/features without a new Google Play release.

## Current Web PWA Readiness

Already present:

- Next.js App Router metadata in `app/layout.tsx`.
- Public logo asset at `public/images/selah-ember-logo.png`.
- Public `robots.ts` and `sitemap.ts`.
- Auth callback route at `/auth/callback`.
- Standard browser file inputs for uploads, which are compatible with Chrome Custom Tabs/TWA file chooser behavior.
- Mobile responsive navigation in `components/ui/app-navigation.tsx`.
- Route-level loading, not-found, and error states.

Added for Android/TWA readiness:

- `app/manifest.ts` with installable PWA metadata.
- 192px and 512px app icons, including maskable variants, under `public/icons/`.
- `public/sw.js` with conservative static/offline caching.
- `public/offline.html` as the offline fallback page.
- `public/.well-known/assetlinks.json` with placeholders for Android package verification.

Still required from the release owner:

- Production origin: `https://selahember.com`.
- Final Android package name.
- Play App Signing SHA-256 certificate fingerprint.
- Store listing assets, screenshots, privacy policy URL, content rating, and data safety answers.

## Service Worker Strategy

The service worker is intentionally conservative:

- It precaches only the offline page, manifest, logo, and PWA icons.
- It cache-first handles same-origin static assets such as `/_next/static/`, `/icons/`, and `/images/`.
- It does not intercept cross-origin Supabase requests.
- It does not cache authenticated/private paths such as `/messages`, `/notifications`, `/platform`, `/profile`, `/signin`, `/signup`, or `/auth`.
- It does not cache signed URLs, message content, private user data, uploads, or Supabase responses.
- Navigation requests use the network first and fall back to `/offline.html` only when offline.

Website deployments update automatically because the app loads the live web origin. Next.js static assets are content-hashed; new deployments produce new asset URLs. The service worker uses a versioned cache name and deletes older cache versions on activation. HTML/navigation remains network-first to avoid long-lived stale app shells.

## Digital Asset Links

File:

```text
public/.well-known/assetlinks.json
```

Replace the placeholders before release:

```json
{
  "package_name": "REPLACE_WITH_ANDROID_PACKAGE_NAME",
  "sha256_cert_fingerprints": [
    "REPLACE_WITH_PLAY_APP_SIGNING_SHA256_FINGERPRINT"
  ]
}
```

Use the Play App Signing certificate fingerprint from Play Console, not only a local upload/debug key.

Verification URL:

```text
https://selahember.com/.well-known/assetlinks.json
```

Test with:

```powershell
curl https://selahember.com/.well-known/assetlinks.json
```

After installing the app on a device:

```powershell
adb shell pm get-app-links REPLACE_WITH_ANDROID_PACKAGE_NAME
adb shell am start -a android.intent.action.VIEW -d https://selahember.com/community
```

## Android Wrapper Project

Preferred project path:

```text
K:\projects\SelahEmberAndroid
```

The wrapper must use Bubblewrap or Android Browser Helper/TWA. It must not use a raw WebView.

Required configuration:

- App name: `Selah Ember`
- Start URL: production Selah Ember origin
- Package name: pending release owner confirmation
- Version code: `1`
- Version name: `1.0.0`
- Target SDK: API 35 or higher, matching current Google Play requirements for new apps and updates as of August 31, 2025.
- No unnecessary Android permissions.
- Full-screen verified TWA behavior through Digital Asset Links.
- Offline fallback URL: `/offline.html`

## Local Build Commands

Once Bubblewrap is installed and the package/signing values are supplied:

```powershell
cd K:\projects\SelahEmberAndroid
bubblewrap update
bubblewrap build
```

The release artifact should be an Android App Bundle:

```text
K:\projects\SelahEmberAndroid\app-release-bundle.aab
```

For local device testing, build/install a debug APK only if needed:

```powershell
bubblewrap install
```

Do not commit keystores, signing passwords, Play credentials, Supabase service role keys, or production secrets.

## Behavior Verification Checklist

Verify on Android Chrome/TWA:

- Sign-up and email callback.
- Sign-in and sign-out.
- App resume after backgrounding.
- Back button navigation.
- Deep links such as `/community`, `/groups`, `/prayer`, `/events`, and `/messages`.
- Community feed posting.
- Groups and group discussions.
- Prayer requests.
- Events and RSVP flow.
- Messages.
- File chooser for images/videos.
- Camera/photo picker where supported by device/browser.
- External links open outside the verified TWA when appropriate.
- Mobile navigation focus and dismissal behavior.
- Offline fallback page when disconnected.

## When Play Store Releases Are Still Required

Website changes do not require a Play release because the TWA loads the live origin. A new Play release is still required for:

- Android target API updates.
- Android permissions changes.
- Package metadata changes.
- App icon, adaptive icon, or splash changes.
- Native capability changes.
- Android wrapper dependency/security updates.
- Signing or package identity changes.

Sources:

- Google Play target API level requirements: https://support.google.com/googleplay/android-developer/answer/11926878
- Android target SDK guidance: https://developer.android.com/google/play/requirements/target-sdk
