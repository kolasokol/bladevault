<div align="center">

  <img src="https://img.shields.io/badge/BladeVault-0A0A0A?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIj48cGF0aCBkPSJNMTQuNSAxNy41IDMgNmgxOGwtNC41IDExLjV6Ii8+PHBhdGggZD0iTTEyIDE4djMiLz48L3N2Zz4=&logoColor=white" alt="BladeVault" />

  <h1>BladeVault</h1>
  <p>
    <strong>A sharp, local-first knife collection manager.</strong>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white&style=flat-square" alt="Next.js 16" />
    <img src="https://img.shields.io/badge/React_19-61DAFB?logo=react&logoColor=black&style=flat-square" alt="React 19" />
    <img src="https://img.shields.io/badge/TypeScript_6-3178C6?logo=typescript&logoColor=white&style=flat-square" alt="TypeScript 6" />
    <img src="https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?logo=tailwindcss&logoColor=white&style=flat-square" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/SQLite-003B57?logo=sqlite&logoColor=white&style=flat-square" alt="SQLite" />
    <img src="https://img.shields.io/badge/Cloudflare-F38020?logo=cloudflare&logoColor=white&style=flat-square" alt="Cloudflare" />
  </p>

  <p>
    <img src="https://img.shields.io/badge/App_Router-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="App Router" />
    <img src="https://img.shields.io/badge/Playwright-2EAD33?style=flat-square&logo=playwright&logoColor=white" alt="Playwright" />
    <img src="https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker" />
    <img src="https://img.shields.io/badge/Dark_Mode-0A0A0A?style=flat-square&logo=weather-night&logoColor=white" alt="Dark Mode" />
  </p>

</div>

---

## ✨ Features

- **Dashboard** — Get a quick overview of your recently added knives.
- **Collection Library** — Browse your complete inventory with brand filters and sorting controls.
- **Knife Detail Page** — View specifications, descriptions, and a full image gallery with lightbox navigation.
- **Inline Editing** — Update any knife's details directly from the detail page.
- **Comparison Tool** — Select up to 3 knives and compare specs side-by-side.
- **Smart URL Scraping** — Paste a product URL and BladeVault auto-fetches title, brand, images, steel, and specs.
  - Includes special handling for **Shopify** stores via their `.json` product endpoint.
  - Uses **Playwright** for JavaScript-rendered pages.
- **Manual Entry** — Add knives by hand with a clean, structured form.
- **Image Management** — Downloaded images are stored locally; cloud backup can sync them to the BladeVault backend when you want an off-device copy.
- **Dark & Light Mode** — Toggle themes instantly from the sidebar.
- **Local-First Storage** — SQLite database + local image folder. Your data stays on your machine by default.
- **Optional Cloud Backup** — Sign in to your BladeVault cloud account and sync a backup copy through the staging backend.

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

- **Docker** — the quickest way to run BladeVault with persistent local storage.
- **Source** — best if you want to develop, customize, or run the app locally with Node.js.

---

## 🐳 Install in Docker

### Run the published image

The published image already defaults to:

- auth: `https://auth.tkweb.site`
- backup: `https://backup.tkweb.site`

So the simplest deploy is just one command.

For macOS / Linux Docker:

```bash
docker run -d \
  --name bladevault \
  --restart unless-stopped \
  -p 5500:3000 \
  -v "$HOME/BladeVault/data:/app/data" \
  ghcr.io/kolasokol/bladevault:latest
```

or Podman:

```bash
mkdir -p "$HOME/BladeVault/data"

podman run -d \
  --name bladevault \
  --restart unless-stopped \
  -p 5500:3000 \
  -v "$HOME/BladeVault/data:/app/data" \
  ghcr.io/kolasokol/bladevault:latest
```

This creates a persistent `BladeVault/data` folder in your home directory for the SQLite database and downloaded images.

For Windows (PowerShell) Docker:

```powershell
docker run -d `
  --name bladevault `
  --restart unless-stopped `
  -p 5500:3000 `
  -v "${env:USERPROFILE}\BladeVault\data:/app/data" `
  ghcr.io/kolasokol/bladevault:latest

```

or Podman:

```powershell
$path = "$env:USERPROFILE\BladeVault\data"
New-Item -ItemType Directory -Force $path | Out-Null

podman run -d `
  --name bladevault `
  -p 5500:3000 `
  -v "${path}:/app/data" `
  ghcr.io/kolasokol/bladevault:latest

```

Open [http://localhost:5500](http://localhost:5500) after the container starts.

### Build your own Docker image

```bash
git clone https://github.com/kolasokol/bladevault.git
cd bladevault

# Build the image
docker build --no-cache -t bladevault .

# Run with a persistent data volume
docker run -p 5500:3000 -d \
  --name bladevault \
  --restart unless-stopped \
  -v $(pwd)/data:/app/data \
  bladevault
```

The `-v $(pwd)/data:/app/data` mount preserves the SQLite database and downloaded images between runs.

You can also use Docker Compose:

```bash
docker compose up -d --build
```

Docker Compose also works with no extra env if you want the default hosted auth
and backup services.

Only create a `.env` file if you want to override those defaults and point the
container to a different auth or backup server:

```env
NEXT_PUBLIC_BLADEVAULT_AUTH_URL=https://auth.tkweb.site
NEXT_PUBLIC_BLADEVAULT_BACKUP_URL=https://backup.tkweb.site
```

Typical later update:

```bash
git pull
docker compose up -d --build
```

---

## 📦 Run from Source

> **Prerequisite:** Node.js 20+ (tested with Node.js 22)

```bash
# 1. Clone the repository
git clone https://github.com/kolasokol/bladevault.git
cd bladevault

# 2. Install dependencies
npm install

# 3. Install Playwright browsers (needed for scraping)
npx playwright install chromium

# 4. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ℹ️ Other Stuff

### 🚀 Tech Stack

| Layer                | Technology                                                                           |
| -------------------- | ------------------------------------------------------------------------------------ |
| Framework            | [Next.js 16](https://nextjs.org/) with App Router                                    |
| UI                   | [React 19](https://react.dev/), [TypeScript 6](https://www.typescriptlang.org/)      |
| Styling              | [Tailwind CSS 4](https://tailwindcss.com/), [Lucide Icons 1.21](https://lucide.dev/) |
| Local Database       | [better-sqlite3 12](https://github.com/WiseLibs/better-sqlite3)                      |
| Cloud Backup Backend | Cloudflare Worker auth + D1 + Ubuntu backup API                                      |
| Scraping             | [Playwright 1.61](https://playwright.dev/) + [Cheerio 1.2](https://cheerio.js.org/)  |
| Animations           | [Motion 12](https://motion.dev/)                                                     |

### 🛠 Available Scripts

| Command         | Description                        |
| --------------- | ---------------------------------- |
| `npm run dev`   | Start the local development server |
| `npm run build` | Create a production build          |
| `npm run start` | Serve the production build         |
| `npm run lint`  | Run ESLint across the repo         |
| `npm run clean` | Clear Next.js build artifacts      |

### 📁 Project Structure

```
bladevault/
├── app/                  # Next.js App Router routes
│   ├── page.tsx          # Dashboard
│   ├── collection/       # Collection list & detail pages
│   ├── compare/          # Knife comparison page
│   └── api/              # REST API routes (knives, scrape, images, settings)
├── components/           # Reusable React components
│   ├── providers/        # React context providers
│   ├── add-knife-modal.tsx
│   ├── knife-card.tsx
│   ├── knife-detail.tsx
│   ├── gallery.tsx
│   ├── settings-modal.tsx
│   └── sidebar.tsx
├── lib/                  # Utilities, storage backends, and scrapers
│   ├── local-db.ts       # Local SQLite connection
│   ├── settings.ts       # App settings + cloud backup preferences
│   ├── storage/          # Storage abstraction (local-first)
│   ├── scrape.ts
│   ├── scrape-playwright.ts
│   └── data.ts           # Shared types
├── data/                 # SQLite DB + downloaded images (created at runtime)
├── public/               # Static assets
├── Dockerfile
├── next.config.ts
├── package.json
└── tsconfig.json
```

### 💾 Data Storage

#### Local mode (default)

BladeVault stores everything locally:

- **SQLite database:** `data/bladevault.sqlite`
- **Downloaded images:** `data/images/`

No cloud accounts or API keys required. Keep the `data/` folder backed up to preserve your collection.

#### Cloud Backup Beta (optional by invite)

( not sure i will run it perma if you interested in it, DM me)

Open **Settings** from the sidebar and use the **Cloud Backup** tab to:

1. Create a BladeVault cloud account or sign in.
2. Run **Backup Local → Cloud** to upload a copy of your collection.
3. Run **Restore Cloud → Local** if you want to replace the current device vault with the latest cloud backup.

Cloud Backup uses Google sign-in right now. The first Google login creates the backup account automatically.

The app remains local-first. Cloud backup keeps an off-device copy without asking the user for raw Cloudflare credentials inside the app.

---

## 🤝 Contributing

Contributions are welcome. Please keep changes focused and run the verification gates before submitting:

```bash
npm run lint
npm run build
```

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<div align="center">
  <sub>Built with precision for knife enthusiasts.</sub>
</div>
