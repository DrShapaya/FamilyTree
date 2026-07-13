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

To use the same tree from a phone, keep the server running and open the computer's LAN address on the phone, for example:

```text
http://192.168.1.10:8765
```

The computer and phone must be on the same Wi-Fi/LAN network. In the app, click `Локально`, enter a tree name and password, and use the same pair on the other device.

Without the server, the app still works fully offline using the browser's IndexedDB storage.

## Privacy

Personal tree data is stored in the browser using IndexedDB. It is not stored in this Git repository.

The `.gitignore` excludes exported files such as `family-tree-*.json`, `family-tree-*.ged`, and `family-tree-*.png` to reduce the chance of accidentally committing private family data.

When sync is enabled, server-side tree data is stored under `server-data/`, which is also ignored by Git.

## Project Files

- `index.html` - app markup and SVG icon sprite.
- `styles.css` - layout, themes, print styles, and responsive UI.
- `app.js` - app state, interactions, storage, import/export, and rendering.
- `tree-layout.js` - automatic tree layout helper.
