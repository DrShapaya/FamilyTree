# FamilyTree

FamilyTree is a local-first family tree editor built with plain HTML, CSS, and JavaScript. It runs in the browser and stores the user's tree data locally, so the repository contains only the app source code, not personal family data.

## Features

- Visual family tree canvas with draggable cards and relationship lines.
- Person cards with names, dates, places, notes, photos, colors, and pinning.
- Search by name, place, notes, dates, and age text.
- Undo/redo history and keyboard shortcuts:
  - `Ctrl+C` / `Cmd+C` copy selected cards.
  - `Ctrl+V` / `Cmd+V` paste copied cards.
  - `Ctrl+X` / `Cmd+X` cut selected cards.
  - `Ctrl+Z` / `Cmd+Z` undo.
  - `Ctrl+Y` / `Cmd+Y` redo.
  - `Ctrl+A` / `Cmd+A` select visible cards.
- JSON import/export for full app backups.
- GEDCOM import/export for genealogy app compatibility.
- PNG export and print mode.
- IndexedDB autosave with local backup snapshots.

## Run Locally

Open `index.html` directly in a browser, or serve the folder locally:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Then open:

```text
http://127.0.0.1:8765/index.html
```

## Run With Sync Server

Install dependencies once:

```powershell
npm install
```

Start the server:

```powershell
npm start
```

Open the app on the computer:

```text
http://127.0.0.1:8765
```

To use the same tree from a phone on the same Wi-Fi/LAN, keep the server running and open the computer's LAN address on the phone, for example:

```text
http://192.168.1.10:8765
```

For access from a different network, use Cloudflare Tunnel as described below. In the app, click `Локально`, enter a tree name and password, and use the same pair on the other device.

Without the server, the app still works fully offline using the browser's IndexedDB storage.

Sync is local-first, operation-based, and WebSocket-assisted. The browser sends concrete changes such as card upserts, card moves, link changes, guide changes, and settings patches; the server applies them and broadcasts them to other connected devices in real time. If two devices add or move different cards at the same time, the server merges those changes instead of replacing the whole tree with the last saved copy. If two devices edit the same card field at the same time, the later synced edit wins for that field.

## Public Access With Cloudflare Tunnel

Cloudflare Tunnel lets you open the local FamilyTree server from anywhere through an HTTPS address without router port forwarding.

Install `cloudflared` from the official Cloudflare downloads page:

```text
https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

Start the local sync server:

```powershell
npm start
```

In another terminal, create a temporary public tunnel:

```powershell
npm run tunnel
```

Cloudflare will print an `https://...trycloudflare.com` address. Open that address on the phone and in the app click `Локально`, then enter the same tree name and password on each device.

On Windows, you can also double-click:

```text
Start FamilyTree Cloudflare Tunnel.cmd
```

That helper starts the FamilyTree server and then starts the tunnel.

Important: in this mode the app is available from anywhere only while this computer is on, the FamilyTree server is running, and `cloudflared` is running.

For a permanent custom domain, create a named Cloudflare Tunnel in your Cloudflare account and use `cloudflare-tunnel.example.yml` as a starting point. Point the tunnel service to:

```text
http://127.0.0.1:8765
```

For this project, the prepared permanent address is:

```text
https://drshapaya.ru
https://tree.drshapaya.ru
```

After adding `drshapaya.ru` to Cloudflare and changing the domain nameservers at the registrar, run:

```powershell
.\scripts\setup-cloudflare-named-tunnel.ps1
```

Then start the permanent tunnel with:

```powershell
.\scripts\start-cloudflare-named-tunnel.ps1
```

The permanent tunnel uses local port `8785`, so it does not conflict with temporary local servers on `8765`.

No Windows service or autorun is required. Start the tunnel manually when you need public access by double-clicking:

```text
Start FamilyTree Permanent Tunnel.cmd
```

The root domain `drshapaya.ru` serves a public project page. The private tree app stays on `tree.drshapaya.ru`.

## Privacy

Personal tree data is stored in the browser using IndexedDB. It is not stored in this Git repository.

The `.gitignore` excludes exported files such as `family-tree-*.json`, `family-tree-*.ged`, and `family-tree-*.png` to reduce the chance of accidentally committing private family data.

When sync is enabled, server-side tree data is stored under `server-data/`, which is also ignored by Git.

## Project Files

- `index.html` - app markup and SVG icon sprite.
- `styles.css` - layout, themes, print styles, and responsive UI.
- `app.js` - app state, interactions, storage, import/export, and rendering.
- `tree-layout.js` - automatic tree layout helper.
