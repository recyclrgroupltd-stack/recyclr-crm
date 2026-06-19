# Recyclr Sales Tablet App

This is the first Android tablet app for Recyclr Core sales users.

## What is in this first version

- CRM login screen.
- Sales option page.
- Leads list with search, stats, and follow-up visibility.
- Add lead form.
- Edit lead form.
- Waste requirement capture for General Waste, Dry Mixed Recycling, Glass, and Food.
- Connects to the existing CRM backend APIs.

## Start the CRM for tablet testing

From PowerShell on the PC:

```powershell
cd "C:\Users\Jay\Documents\recyclr-crm - Copy\backend"
$env:DJANGO_ALLOWED_HOSTS="*"
..\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

In another PowerShell tab:

```powershell
cd "C:\Users\Jay\Documents\recyclr-crm - Copy\frontend"
npm run dev
```

Find the PC IPv4 address:

```powershell
ipconfig
```

On the tablet app login screen, use:

```text
http://YOUR-PC-IP:8000
```

Example:

```text
http://192.168.1.50:8000
```

The tablet and PC must be on the same Wi-Fi network.

## Run on a connected Android tablet

Enable developer mode and USB debugging on the Samsung tablet, plug it into the PC, then run:

```powershell
cd "C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app"
flutter devices
flutter run
```

## Install the debug APK manually

The debug APK is here:

```text
C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app\build\app\outputs\flutter-apk\app-debug.apk
```

You can copy that APK onto the tablet and install it, or use:

```powershell
adb install -r "C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app\build\app\outputs\flutter-apk\app-debug.apk"
```

## Build for Google Play internal testing

Release builds are signed with the local upload key in:

```text
C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app\android\app\recyclr-upload-keystore.jks
```

The signing password is stored locally in:

```text
C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app\android\key.properties
```

Do not delete these files and do not upload them to GitHub. They are already ignored by Git.

To build the Play Store app bundle:

```powershell
cd "C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app"
flutter build appbundle --release
```

Upload this file to Google Play Console internal testing:

```text
C:\Users\Jay\Documents\recyclr-crm - Copy\mobile_sales_app\build\app\outputs\bundle\release\app-release.aab
```

When publishing a new tablet update, increase the build number:

```powershell
flutter build appbundle --release --build-name 1.0.1 --build-number 2
```
