# 2D platform game engine
I have an idea for a game engine where anyone can go to a website and generate a level. That level then gets added to a playbale list of levels that anyone can play. The site will have no authentication and will be truly open. When users submit a level it must go into a queue for admin approval so there must be an admin interface (with login, can just be a static API key in an env variable). Level creators must be able to submit a short level name and description, and select their country.
Once a level creator submits a level, they must get a unique link. This is where they can check back if their level got approved or declined with a decline reason.
The admin must be able to change the level name and description in the event NSFW wording is used, or outright decline with a reason.


## The engine
It must work like old school TV games (SNES, Gameboy, etc) where textures are pre-created.
A level then consists of a grid of tiles and each texture is a multiple of these tiles, e.g. 1x1, 2x4, etc
Textures can either be "platform" textures where the character jumps onto, runs on, etc
Textures can also be "non-interacting" like the grass, flowers, clouds, etc used to make the game look good and give it character
Textures can also be "interacting" and must be a certain color/texture to make it stand out so the player knows. Interacting textures must be "bumpable". The engine must ensure an interacting texture does not get placed in such a way that it is never interactable. Bumping means jumping against it either from the side or bottom, or bouncing on top of it.
Interacting textures must be a lucky dip, either a coin, or an extra live, or invincibility for 5 seconds where the character doubles in size for that 5 seconds.

Everything must be parameterized so the level creator can select, for example, how many screens the game should be, how many interacting textures, what the ratio of "gifts" from the interacting textures must be, etc.

Platforms that the playable character can jump on must be placed in such a way that they can always be reached, either directly, or via other platforms.

Textures, level backgrounds, etc must be "color palettable". Level creators must be able to choose between 7 color pallets. 

## Backend
NodeJS + Postgres + ORM + Express + Winston for loggin into Postgres + Helmet for security
If the DB or its tables dont exist upon server startup they must be created.

## Frontend
Ideally plain HTML + JS + CSS

## Other
Code must be modularized as much as possible to avoid massive singular monolithic files.
As much as possible must be parameterized and all parameters must have lower boundries and upper boundries controlled by the backend and input must be validated by the backend.
Level creators must use sliders where possible for numerical parameters.
Create the required gitignore
Create an env.example file and populate with dummy values which can be committed.
You may read the .env file, it already exists

# Database
The database must be created according to the env file

## AI Brain
I will be developing across 2 devices. So ideally the AI brain must be in the repo so once device can pick up where the other left off (if possible).

---

# Clarified Decisions & Implementation Roadmap

## Phase 1: Level Creator (Completed & Verified)
- **Status**: Implemented and verified against PostgreSQL (`192.168.1.109` / `game_engine`).
- **Generation Workflow**: Procedural level generation driven by parameter sliders + a seed/Regenerate button, with an interactive live HTML5 Canvas preview (scrollable across screens).
- **Tile & Screen Grid Specs**:
  - Base tile size: `16x16` pixels (rendered scaled up on canvas for crisp pixel-art look).
  - Screen dimensions: `20` tiles wide × `15` tiles high per screen (`320x240` native retro resolution per screen).
  - Multi-tile textures: Ground blocks (`1x2`, `2x2`, and variable-height stepped ground hills up to 6 tiles tall), floating platforms (`2x1`, `3x1`, `4x1`), bumpable lucky-dip blocks (`1x1` with distinct animated/high-contrast border), 3 spike types (`1x1`: 3-prong short, 1-prong medium, and 2-prong high with a gap in-between), enemies (`1x1` patrol spawns), and non-interacting background props (`2x1` bushes, `1x1` grass tufts, 4 distinct `1x1` vibrant flower types—Rose, Tulip, Sun-Daisy, and Twin Bellflower—`1x2` pillars/totems, and `3x2` clouds).
- **Color Palettes (7 Retro Palettes)**:
  - Procedural pixel-art matrices dynamically colored via 7 selectable palettes (e.g., *NES Classic*, *GameBoy Greens*, *SNES Sunset*, *Cyber Neon*, *Autumn Dusk*, *Ice Cavern*, *Volcanic Ash*), including 4 vibrant accent flower colors per palette and a distinct high-contrast highlight color for interactive/bumpable blocks.
- **Backend-Controlled Parameter Boundaries (`GET /api/config/parameters`)**:
  - `screens`: `2` to `12` screens (default `4`)
  - `paletteIndex`: `0` to `6` (7 palettes — selected via the top palette cards; duplicate Visuals slider hidden)
  - `platformDensity`: `15%` to `90%` (controls floating platform coverage)
  - `gapFrequency`: `0%` to `45%` (pits in the ground floor; bounded by max jump width so level is always completable)
  - `groundElevation`: `0` to `4` tiles (controls stepped hills/terraces in the ground floor; smoothed so adjacent steps never exceed 2 tiles and pit edges remain jumpable)
  - `verticality`: `1` to `10` (how high platforms climb)
  - `interactingCount`: `1` to `40` (bumpable lucky-dip blocks, guaranteed reachable from below/side/top and unobstructed)
  - `giftWeightCoin`, `giftWeightExtraLife`, `giftWeightInvincibility`: `0` to `100` each (normalized into ratios; at least one > 0)
  - `hazardDensity`: `0%` to `60%` (spikes & patrolling enemies placed safely away from spawn/goal and never making jumps impossible)
  - `decorDensity`: `0%` to `100%` (non-interacting clouds, grass, flowers, bushes)
  - Metadata fields: `name` (3–40 chars, required), `description` (3–200 chars, required), `username` (optional, max 30 chars, defaults to `'Anonymous'`), `country` (optional ISO country list, defaults to `'Unspecified'`), `seed` (integer for deterministic reproducibility + stored generated grid JSON).
- **Reachability & Placement Guarantees**:
  - Every platform is validated against player jump kinematics (`maxJumpHeight = 3.5 tiles`, `maxJumpDistance = 4.5 tiles`) starting from the spawn platform to the end-of-level flagpole/goal.
  - Every interacting (bumpable) block is verified to have at least one adjacent free tile (bottom, left, right, or top) within reach of a valid platform, and lucky blocks never stack vertically on top of each other (always keeping a 2-tile vertical head-bump clearance underneath).
- **Database & Logging Architecture**:
  - On startup, connect to PostgreSQL using `pg` to `postgres` default DB and issue `CREATE DATABASE <POSTGRES_GAME_ENGINE_DB>` if it does not exist, then initialize **Sequelize** and `sequelize.sync({ alter: true })`.
  - **Tables**: `levels` (UUID/slug token for unique status link, name, description, country, status `PENDING`/`APPROVED`/`DECLINED`, decline_reason, parameters JSONB, level_data JSONB, timestamps) and `logs` (Winston custom Sequelize transport logging all API events and errors to Postgres).
- **Repo-Resident AI Brain**:
  - Track architecture, progress, and session handoffs in `.ai-brain/` inside the repository so any device pulling the repo has full context.

## Phase 2: Admin Interface (Completed & Verified)
- **Status**: Implemented and verified end-to-end.
- **Authentication**: Static `ADMIN_API_KEY` stored in `.env`, verified via timing-safe comparison in `src/middleware/adminAuth.js` (`X-Admin-Api-Key` header).
- **Proxy-Aware Client IP Resolution & Parameterized Rate Limiting (`src/middleware/rateLimiter.js`)**:
  - **IP Extraction (`getClientIp`)**: Works behind Cloudflare (`CF-Connecting-IP` / `True-Client-IP`), Reverse Proxies (`X-Forwarded-For` leftmost IP / `X-Real-IP`), both, or direct connections (`req.ip` / `req.socket.remoteAddress`), with Express `trust proxy` enabled.
  - **Admin Brute-Force Protection**: Configurable via `.env` (`ADMIN_AUTH_MAX_FAILURES=3`, `ADMIN_AUTH_WINDOW_SECONDS=300`, `ADMIN_AUTH_BLOCK_SECONDS=900`). Blocks an IP with `429 Too Many Requests` when more than 3 failed admin password attempts occur within 5 minutes.
  - **Level Submission Anti-Spam Rate Limiting**: Configurable via `.env` (`LEVEL_SUBMIT_MAX_REQUESTS=1`, `LEVEL_SUBMIT_WINDOW_SECONDS=5` for testing / `300` for 5m in prod, and `LEVEL_SUBMIT_RATE_STRATEGY=IP_AND_CLIENT_TOKEN` or `IP`).
  - **Cloudflare Turnstile + Self-Hosted / Localhost Fallback (`src/services/securityService.js`)**:
    - Uses `SITE_KEY`, `SECRET_KEY`, `TURNSTILE_DOMAIN=buildandplay.leighonline.net`, and `TURNSTILE_MODE=AUTO` in `.env`.
    - When accessed on `buildandplay.leighonline.net`, the Turnstile widget automatically renders and the backend verifies tokens against `challenges.cloudflare.com/turnstile/v0/siteverify`.
    - When running locally (`localhost`, `127.0.0.1`, LAN IP) or self-hosted without Cloudflare keys, Turnstile is automatically skipped and the app relies on the IP/Token rate limiter + Proof-of-Work.
  - **Client-Side Proof-of-Work (`POW_ENABLED=true`, `POW_DIFFICULTY=3`)**:
    - Issues a signed, single-use SHA-256 Hashcash challenge (`GET /api/config/pow-challenge`) solved via Web Crypto API before level submission.
- **Moderation Features (`public/admin.html` & `src/routes/adminRoutes.js`)**:
  - Clean login screen with subheading removed and the entire moderation workspace (`#admin-workspace`) strictly hidden via CSS `[hidden] { display: none !important; }` until authenticated.
  - Filterable queue tabs (`PENDING`, `APPROVED`, `DECLINED`, `ALL`) with live badge counts.
  - Full HTML5 Canvas preview of any submitted level right inside the Admin Console.
  - Editable `name`, `description`, and `username` fields so admins can sanitize NSFW wording before or after approval.
  - One-click **Save & Approve**, **Decline with Reason** (enforces a required 3–250 char decline reason that immediately appears on the creator's unique `/status.html?token=...` page), or **Save Wording Edits Only**.
  - Live viewer for the 50 most recent Winston PostgreSQL audit logs (`app_logs`).

## Phase 3: Gameplay Engine & Landing Homepage (Completed & Verified)
- **Status**: Implemented and verified end-to-end.
- **Welcome Landing Homepage (`public/index.html` & `public/js/home.js`)**:
  - Clean, non-duplicated top navigation bar containing only the **🛡️ Admin** link (`public/index.html`), while the hero banner prominently features the two primary actions: **🎮 Select Level & Play** (`/play.html`) and **🛠️ Build Your Own Level** (`/creator.html`), followed by a static prebuilt showcase level rendered on an HTML5 Canvas.
- **Starting Lives & Cranked-Up Bad Guy Density (`src/config/parameters.js` & `src/services/levelGenerator.js`)**:
  - **Starting Lives (`startingLives`)**: Configurable slider in the Map Builder (`min: 1`, `max: 5`, `default: 3`) determining how many lives the player starts with on that level.
  - **Bad Guy & Spike Density (`hazardDensity`)**: Slider range cranked up to `0–100%` (default `45%`) with higher spawn probability and tighter spacing (`surfaces >= 3 tiles wide`) so high-density levels pack plenty of patrolling enemies and spike traps.
- **Playable Level Browser with Rich Filtering (`public/play.html`, `public/js/play.js`, `GET /api/levels/playable`)**:
  - Lists all `APPROVED` levels with live search (by level name, creator username, or description), Color Palette filter (`0–6`), Level Length filter (`Short 2–4`, `Medium 5–7`, `Long 8–12` screens), Country filter, and Sort order (`Newest Approved`, `Most Played`, `Oldest First`).
  - Displays starting lives, lucky block count, `playsCount`, and `winsCount` per level.
- **2D Platformer Gameplay Engine (`public/js/gameEngine.js` & `public/js/renderer.js`)**:
  - **Animated Multi-Color Pixel-Art Hero (`drawAnimatedHero`)**: Features a red cap with cyan visor goggles, flowing scarf, overalls with gold belt buckle, swinging front/back arms, and striding legs that animate while walking and strike a jump pose in mid-air.
  - **Bumpable Lucky-Dip Mystery Blocks**: Can be bumped from underneath (head-bump), bumped from the left/right side, or bounced on from the top. Awards the pre-rolled gift:
    - **Coin (`+1 COIN`, `+100 Score`)**
    - **Extra Life (`+1 LIVE`, `+500 Score`)**
    - **5-Second Giant Invincibility (`2× character size`, flashing rainbow/gold aura, immunity to spikes & enemies, and instant KO on contact with patrolling enemies)**
  - **Live Gift & Lives HUD + Level Complete Breakdown (`public/play.html` & `public/js/play.js`)**:
    - Live HUD displays **Lives Remaining** (`❤️ LIVES`), **Gifts Collected** (`🪙 Coins`, `❤️ +1UP Extra Lives`, `⭐ 2× Giant Invincibilities`, and `Opened / Total Gifts`), and **Score**.
    - Level Complete / Game Over screen displays a detailed breakdown of **Lives Left (vs. Starting Lives)**, **Total Gifts Opened / Total in Level**, individual counts for **Coins**, **Extra Lives (+1UP)**, and **2× Invincibilities**, plus **Final Score**.
  - **High-Visibility Spikes with Radiating Danger Aura (`drawHazard1x1`)**:
    - All 3 spike varieties (`3-Prong Short`, `1-Prong Medium`, `2-Prong High with Gap`) are drawn larger with high-contrast metallic/white blades, a hazard warning baseplate, and a pulsing multi-ring crimson/amber radiating aura so they stand out clearly against every color palette.

