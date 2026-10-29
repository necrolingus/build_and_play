# 🎮 Build & Play — Retro 2D Game Engine & Level Creator

A retro 2D platformer game engine and community level builder inspired by classic SNES and GameBoy games. All sprites, tiles, scenery, hazards, and character animations are rendered procedurally on HTML5 Canvas across 7 retro color palettes.

---

## ✨ Core Components

### 1. 🛠️ Open Level Builder (`/creator.html`)
Anyone can design and submit a custom 2D platformer level without needing an account:
- **7 Retro Color Palettes**: *NES Overworld, GameBoy Pocket, SNES Sunset, Cyber Neon, Autumn Forest, Ice Cavern,* and *Volcanic Ash*.
- **Parameterized World Generation**:
  - **Level Length**: `2` to `12` screens (`20 × 12` tiles per screen).
  - **Terrain & Platforming**: Stepped ground hill elevation (`0–4` tiles), platform density, pit frequency, and vertical jump reach.
  - **Starting Player Lives**: Configurable from `1` to `5` lives.
  - **Lucky-Dip Mystery Blocks (`?`)**: Configurable count and weighted gift probabilities for **Coins**, **Extra Lives (+1-UP)**, and **5-Second 2× Giant Invincibility**.
  - **Hazards & Bad Guys**: Crankable density (`0–100%`) spawning patrolling retro beetles and 3 spike varieties (`3-Prong Short`, `1-Prong Medium`, `2-Prong High with Gap`) surrounded by a radiating danger aura.
  - **Scenery**: Multi-tile clouds, bushes, stone totems, grass tufts, and 4 vibrant flower types.
- **Automatic Reachability Verifier**: Guarantees every generated platform and Lucky Block is 100% reachable before submission.
- **Unique Status Tracking Link**: Submitting a level returns a unique `/status.html?token=<uuid>` link so creators can check whether their level is `PENDING`, `APPROVED`, or `DECLINED` (with the admin's feedback).

### 2. 🕹️ 2D Gameplay Engine & Level Browser (`/`, `/play.html`)
- **Welcome Arcade Landing Page (`/`)**: Displays a static showcase level and quick entry into either **Select Level & Play** or **Build Your Own Level**.
- **Filterable Playable Level Browser (`/play.html`)**: Search and filter all admin-approved community levels by name, creator username, color palette, screen length, creator country, and popularity (`Plays` / `Wins`).
- **Playable 2D Platformer Engine**:
  - **Animated Pixel-Art Hero**: Custom multi-color character with a cap, cyan visor goggles, flowing scarf, overalls, and animated arms/legs for walking and jumping.
  - **Omnidirectional Lucky Blocks**: Bump `?` blocks from underneath, from the left/right side, or bounce on top to pop out Coins, Extra Lives, or 5-Second 2× Giant Invincibility (which doubles character size, grants hazard immunity, and knocks out patrolling enemies on contact).
  - **Live HUD & Completion Summary**: Tracks remaining lives, gifts collected by type (`Coins`, `+1-UP`, `2× Invincibility`, and `Opened / Total Gifts`), and final score on both the live HUD and the Level Complete / Game Over screen.

### 3. 🛡️ Admin Moderation Interface (`/admin.html`)
- **Protected Moderation Queue**: Secured via a static `ADMIN_API_KEY` in `.env` (`crypto.timingSafeEqual`).
- **Live Canvas Preview & Wording Sanitization**: Admins can preview the full map of any submitted level, edit the level name, description, or creator username to remove NSFW content, and **Approve** or **Decline with a Reason**.
- **Built-In Anti-Spam & Security**:
  - **Proxy-Aware IP Detection**: Supports Cloudflare (`CF-Connecting-IP`), reverse proxies (`X-Forwarded-For`, `X-Real-IP`), or direct connections.
  - **Brute-Force & Submission Rate Limits**: Blocks IPs after `> 3` failed admin logins in 5 minutes and rate-limits level submissions using `IP + Client Token` so users behind corporate NATs aren't unfairly blocked.
  - **Cloudflare Turnstile + Self-Hosted Fallback**: Automatically enables Cloudflare Turnstile on the configured production domain and falls back to IP/Token rate limiting + client-side SHA-256 **Proof-of-Work (PoW)** when running on `localhost` or self-hosted without Cloudflare.
  - **PostgreSQL Audit Logging**: All submissions, moderations, and security events are logged to PostgreSQL (`app_logs`) via Winston and viewable inside the Admin Console.

---

## 🚀 Quick Start

### 1. Prerequisites
- **Node.js** `v20+` (or `v24`)
- **PostgreSQL** `v14+`

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and adjust your settings:
```bash
cp .env.example .env
```

Key `.env` variables:
- `PORT=3000`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` (the app automatically creates `DB_NAME` on startup if it doesn't exist)
- `ADMIN_API_KEY` — Password used to log into `/admin.html`
- `SITE_KEY`, `SECRET_KEY`, `TURNSTILE_DOMAIN` — Optional Cloudflare Turnstile credentials (`TURNSTILE_MODE=AUTO` skips Turnstile on `localhost` or when keys are omitted)

### 3. Install & Run
```bash
npm install
npm start
```
Then open `http://localhost:3000` in your browser.

---

## 🐳 Docker

A production [Dockerfile](Dockerfile) (`node:24-slim`) is included and exposes port `3000`. Pass your `.env` variables at runtime via `--env-file .env` or your container orchestrator.

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
