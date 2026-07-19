<div align="center">

  <img src="./public/logo.svg" alt="BladeVault logo" width="120" />

  <h1>BladeVault</h1>
  <p>
    <strong>A sharp, local-first knife collection manager.</strong>
  </p>

  <p>
    Track your collection, compare knives side by side, export comparison tables, and keep full control of your data with local SQLite storage and optional cloud backup.
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js_16.2-000000?logo=nextdotjs&logoColor=white&style=flat-square" alt="Next.js 16.2" />
    <img src="https://img.shields.io/badge/React_19.2-61DAFB?logo=react&logoColor=black&style=flat-square" alt="React 19.2" />
    <img src="https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript 6" />
    <img src="https://img.shields.io/badge/Tailwind_CSS_4.3-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square" alt="Tailwind CSS 4.3" />
    <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white&style=flat-square" alt="SQLite" />
    <img src="https://img.shields.io/badge/Electron_43-47848F?logo=electron&logoColor=white&style=flat-square" alt="Electron 43" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/App_Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="App Router" />
    <img src="https://img.shields.io/badge/Playwright_1.61-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright 1.61" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white&style=flat-square" alt="Cloudflare" />
    <img src="https://img.shields.io/badge/Dark_Mode-0A0A0A?style=flat-square&logo=weather-night&logoColor=white" alt="Dark Mode" />
  </p>

</div>

---

## Quick Start

Choose the fastest path for how you want to use BladeVault:

- **Docker**: `docker compose up -d --build`
- **Source**: `npm install` then `npx playwright install chromium` and `npm run dev`
- **Dev Container**: open the repository in VS Code and run **Dev Containers: Reopen in Container**, then run `npm run dev`
- **Desktop shell**: `npm run desktop:dev`

If you only want to try the app, Docker is the quickest setup. If you want to develop or customize it, run from source.

---

## Demo Video

<div align="center">

  <a href="https://youtu.be/yurbpv0JY80">
    <img src="https://img.youtube.com/vi/yurbpv0JY80/maxresdefault.jpg" alt="BladeVault demo video" width="80%" />
  </a>

  <p>
    <a href="https://video.bladevault.pro/overview.mp4">Direct video link</a> · <a href="https://youtu.be/yurbpv0JY80">YouTube mirror</a>
  </p>

</div>

---

## ✨ Features

- **Dashboard insights** — See recently added knives alongside collection size, maker distribution, and the past year’s acquisition activity.
- **Searchable collection library** — Search names, materials, and specifications, then narrow the results with shareable, multi-select URL filters for built-in and custom fields.
- **Pins and shortcuts** — Pin important knives, optionally keep them first throughout the app, and access pinned items and brand groups from the sidebar.
- **Knife records** — Create, edit, and delete detailed records with identity, construction, dimensions, pricing, provenance, notes, and source links.
- **Flexible custom fields** — Define reusable text, number, date, or boolean fields in Settings; they appear on add/edit forms, details, collection filters, and comparison tables.
- **Image gallery** — Add image files or URLs, choose which scraped images to keep, and browse each record’s locally stored gallery in a lightbox.
- **Smart URL import** — Paste a product URL to import available title, brand, images, description, and specifications. Shopify product JSON and JavaScript-rendered pages are supported; an interactive browser fallback helps when a retailer presents bot protection.
- **Manual entry** — Add a knife from scratch with the same structured form and image controls.
- **Side-by-side comparison** — Build a comparison lineup from any number of knives, focus on differences only, and include your custom fields.
- **Comparison export and printing** — Generate a landscape PDF or a clean print view of the current comparison table.
- **Appearance and updates** — Choose light or dark mode, with desktop update checks and download controls in Settings.
- **Local-first storage** — Your SQLite database and downloaded images stay on your machine by default, and the local data folder can be changed from Settings when the runtime permits it.
- **Optional cloud backup** — Sign in with Google to back up or restore the full vault, including images. Automatic backups can run hourly and after collection changes.

---

## 📸 Screenshots

<div align="center">

  <img src="assets/screenshots/dashboard.png" alt="Dashboard" width="80%" />
  <p><sub>Dashboard — recently added knives at a glance</sub></p>

  <br />

  <img src="assets/screenshots/detail.png" alt="Knife Detail" width="80%" />
  <p><sub>Knife Detail — specs, description, and image gallery</sub></p>

  <br />

  <img src="assets/screenshots/compare.png" alt="Compare" width="80%" />
  <p><sub>Compare — side-by-side specification comparison</sub></p>

  <br />

  <img src="assets/screenshots/add.png" alt="Add Knife" width="80%" />
  <p><sub>Quick Add — scrape a product URL or enter details manually</sub></p>

</div>

---

## 📥 Install BladeVault

Choose the setup that fits you:

- **Desktop App** — package BladeVault as a native macOS or Windows app with Electron.
- **Docker** — the quickest way to run BladeVault with persistent local storage.
- **Source** — best if you want to develop, customize, or run the app locally with Node.js.

---

## 🐳 Run in Container

### Docker / Podman

If you want a clear, user-owned folder on your machine, use `docker run` or
`podman run` and mount `~/BladeVault/data` directly.

For macOS / Linux Docker:

```bash
mkdir -p "$HOME/BladeVault/data"

docker run -d \
  --name bladevault \
  --restart unless-stopped \
  -p 5500:3000 \
  -v "$HOME/BladeVault/data:/app/data" \
  ghcr.io/dedkola/bladevault:latest
```

or Podman:

```bash
mkdir -p "$HOME/BladeVault/data"

podman run -d \
  --name bladevault \
  --restart unless-stopped \
  -p 5500:3000 \
  -v "$HOME/BladeVault/data:/app/data" \
  ghcr.io/dedkola/bladevault:latest
```

This creates a persistent `BladeVault/data` folder in your home directory for the SQLite database and downloaded images.


For Windows (PowerShell) Docker:

```powershell
docker run -d `
  --name bladevault `
  --restart unless-stopped `
  -p 5500:3000 `
  -v "${env:USERPROFILE}\BladeVault\data:/app/data" `
  ghcr.io/dedkola/bladevault:latest

```

or Podman:

```powershell
$path = "$env:USERPROFILE\BladeVault\data"
New-Item -ItemType Directory -Force $path | Out-Null

podman run -d `
  --name bladevault `
  -p 5500:3000 `
  -v "${path}:/app/data" `
  ghcr.io/dedkola/bladevault:latest

```

Open [http://localhost:5500](http://localhost:5500) after the container starts.

## Run DMG on macOS:

If you downloaded the macOS DMG:

Permanent latest-release download:
[BladeVault.dmg](https://github.com/dedkola/bladevault/releases/latest/download/BladeVault.dmg)

1. Open the `.dmg` file.
2. Drag `BladeVault.app` into `Applications`.
3. If macOS blocks the first launch, right-click `BladeVault.app`, choose
   **Open**, and confirm the prompt.
4. If that does not work, run:

```bash
xattr -d com.apple.quarantine "/Applications/BladeVault.app"
open "/Applications/BladeVault.app"
```

If macOS still blocks the first launch, try starting it once from Terminal:

```bash
"/Applications/BladeVault.app/Contents/MacOS/BladeVault"
```

### Update BladeVault on macOS

Unsigned macOS releases use a user-assisted update flow. When BladeVault finds
a new version, choose **Download update** in Settings → About. The new DMG is
downloaded and opened automatically. Quit BladeVault, drag the new app into
Applications, confirm replacement, and use the same first-launch steps above
if macOS blocks the unsigned app.

---

## Run Installer on Windows:

If you downloaded the Windows installer:

Permanent latest-release download:
[BladeVault-Setup.exe](https://github.com/dedkola/bladevault/releases/latest/download/BladeVault-Setup.exe)

1. Open the `.exe` file.
2. Follow the installer prompts.
3. Open BladeVault from the Start menu or desktop shortcut.

If Windows SmartScreen blocks the first launch, click `More info` and then
`Run anyway` if you trust the download source.

### Build your own Docker image

```bash
git clone https://github.com/dedkola/bladevault.git
cd bladevault

# Build the image
docker build --no-cache -t bladevault .

# Run with a persistent folder in your home directory
mkdir -p "$HOME/BladeVault/data"

docker run -p 5500:3000 -d \
  --name bladevault \
  --restart unless-stopped \
  -v "$HOME/BladeVault/data:/app/data" \
  bladevault
```

---

## 📦 Run from Source

> **Prerequisite:** Node.js 20+ (tested with Node.js 22)

```bash
# 1. Clone the repository
git clone https://github.com/dedkola/bladevault.git
cd bladevault

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (needed for scraping)
npx playwright install chromium

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

By default, source mode stores its SQLite database and downloaded images in
`~/BladeVault/data` (or the Windows equivalent under your user profile). Set
`BLADEVAULT_DATA_DIR` if you want a custom location. Older local checkouts with
an existing repo-level `data/bladevault.sqlite` keep using that legacy path
until you move the file.

### Dev Container

The included `.devcontainer` configuration provides Node.js and Playwright's
matching Chromium build.
In VS Code, choose **Dev Containers: Reopen in Container**. Dependencies install
automatically; then run:

```bash
npm run dev
```

The app opens through the forwarded port 3000. Container runtime data is stored
in the checkout's ignored `data/` folder, while `node_modules` stays in a Docker
volume so it is never shared with the host OS.

---

## 💾 Your Data

#### Local mode (default)

BladeVault stores everything locally:

- **SQLite database:** `~/BladeVault/data/bladevault.sqlite`
- **Downloaded images:** `~/BladeVault/data/images/`

No cloud accounts or API keys required. Keep the `~/BladeVault/data` folder
backed up to preserve your collection.

If you already have an older repo-local `data/bladevault.sqlite`, BladeVault
continues to use it until you move that database or set `BLADEVAULT_DATA_DIR`
explicitly.

#### Cloud Backup Beta

Open **Settings** from the sidebar and use the **Cloud Backup** tab to:

1. Create a BladeVault cloud account or sign in.
2. Run **Backup Local → Cloud** to upload a copy of your collection.
3. Run **Restore Cloud → Local** if you want to replace the current device vault with the latest cloud backup.

Cloud Backup uses Google sign-in right now. The first Google login creates the backup account automatically.

The app remains local-first. Cloud backup keeps an off-device copy without asking the user for raw Cloudflare credentials inside the app.

---

## 📄 License

---

<div align="center">
  <sub>Built with precision for knife enthusiasts.</sub>
</div>
