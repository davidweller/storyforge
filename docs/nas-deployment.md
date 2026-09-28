# Running StoryForge on the Synology NAS

**Audience:** whoever operates this deployment — in practice, David, months from now, when
something has broken and the context is gone.

Target hardware: DS220+ (Intel Celeron J4025, x86_64, 6 GB RAM), DSM 7, Container Manager.

---

## Why this works at all

StoryForge was written as a desktop app, but it isn't really one. `electron/main.js` forks
the standalone Next.js server on `127.0.0.1:3000` and opens a `BrowserWindow` pointed at it.
There are no IPC channels — `electron/preload.js` exposes `{ platform, isElectron }` and
nothing in `src/` reads it. Every data call already goes over HTTP to `/api/db`, and
`better-sqlite3` is already built against the plain Node ABI rather than Electron's.

So the container is not a port. It runs the same server Electron was already running, without
the window.

---

## Read this before opening any port

**StoryForge has no authentication.** Not weak authentication — none.

- `src/hooks/useAuth.ts` returns `isAuthenticated: true` unconditionally.
- `AuthProvider` and `ProtectedRoute` are passthrough components.
- `src/middleware.ts` does in-memory per-IP rate limiting and nothing else. It never reads a
  cookie, header or token. It keys off `x-forwarded-for`, which a client can spoof.
- There is no `users` table and no ownership column on `projects`. `getUserProjects(_userId)`
  discards its argument; rows hardcode `userId: 'local'`.
- `ALLOWED_EMAILS` in `env.example` sits under a heading reading "Authentication Allowlist"
  and is referenced by zero lines of code.

Anyone who can reach the port can delete every project (`POST /api/db` with
`action: "deleteProjectData"`), read and overwrite the API keys (`/api/settings`), and spend
Anthropic and OpenAI credit at 120 requests a minute (`/api/generate`).

This is why `docker-compose.yml` binds to `127.0.0.1:3000` and access goes through Tailscale.
Do not change that to `3000:3000` casually — it would expose the app to every device on the
LAN, guest phones and IoT kit included.

---

## First deployment

### 0. Prerequisites

- Container Manager installed on the NAS (Package Center).
- Docker installed on the build machine. **Not currently installed on the Ubuntu box** —
  `sudo apt install docker.io docker-compose-v2` and add yourself to the `docker` group.
- The build machine must be x86_64. It is; so is the DS220+.

### 1. Housekeeping before the first build

**Done on 2026-09-21:** the live Google service-account key that sat at the repo root
(`novelgenerator-4dae2-firebase-adminsdk-*.json`) has been moved to
`/mnt/files/code/.credentials-quarantine/`, outside every git repo. StoryForge migrated off
Firebase to local SQLite — `firebase-admin` is a devDependency, and there are zero
references to Firebase in `src/` or `electron/`.

**Still outstanding:** revoke the key itself in the Google Cloud console (IAM & Admin →
Service Accounts → the `firebase-adminsdk` account → Keys → delete key id `4a7f544533`).
Until that is done the key is live, merely relocated. `.dockerignore` and `.gitignore` both
still exclude the filename as defence in depth.

### 2. Build the image

```bash
cd /mnt/files/code/novel
docker build -t storyforge:1.0 .
docker save storyforge:1.0 | gzip > /tmp/storyforge-1.0.tar.gz   # expect ~200–300 MB
```

**Never build on the NAS.** `next build` on a J4025 with 6 GB will crawl or be OOM-killed.

Sanity check before shipping — run it locally against a *copy* of the database:

```bash
mkdir -p /tmp/sf-test && cp .data/storyforge.db /tmp/sf-test/
docker run --rm -p 127.0.0.1:3000:3000 \
  -v /tmp/sf-test:/data --env-file storyforge.env storyforge:1.0
curl -f http://localhost:3000/api/health/db
```

A 503 from `/api/health/db` means the native modules didn't land — see Troubleshooting.

### 3. Set up the NAS side

Over SSH, or via File Station:

```bash
mkdir -p /volume1/docker/storyforge/data/backup
```

Copy `docker-compose.yml` into `/volume1/docker/storyforge/`, then create
`/volume1/docker/storyforge/storyforge.env` from `env.docker.example` and `chmod 600` it.

Load the image: Container Manager → Image → Add → Add From File → the `.tar.gz`.

### 4. Migrate the data

Stop the desktop app first, then take one clean checkpointed file rather than copying the
three `.db*` files separately:

```bash
cd /mnt/files/code/novel
sqlite3 .data/storyforge.db "PRAGMA wal_checkpoint(TRUNCATE);"
sqlite3 .data/storyforge.db "VACUUM INTO '/tmp/storyforge-cutover.db';"
```

Copy that to `/volume1/docker/storyforge/data/storyforge.db`. On the NAS:

```bash
chown 1000:1000 /volume1/docker/storyforge/data/storyforge.db
```

(1000 is the `node` user inside the image.)

Keep the old `.data/` on the Ubuntu machine untouched for a fortnight as a rollback.

### 5. Start it

Container Manager → Project → Create → point at `/volume1/docker/storyforge/`. Then check all
nine projects list, with six at `export-final`.

### 6. Tailscale

Package Center → Tailscale → sign in. Then over SSH:

```bash
sudo tailscale serve --bg 3000
```

That gives `https://<nas>.<tailnet>.ts.net` with a real certificate and no browser warning.
Install Tailscale on the laptop, phone and tablet. No router ports are opened and nothing is
exposed to the internet.

### 7. Nightly consistent backup

Hyper Backup snapshotting a live SQLite file can tear — WAL means the `.db` on its own is not
a complete picture. DSM → Control Panel → Task Scheduler → Scheduled Task → User-defined
script, nightly, as root:

```bash
docker exec storyforge sh -c \
  'sqlite3 /data/storyforge.db ".backup /data/backup/storyforge-$(date +%F).db"' \
&& find /volume1/docker/storyforge/data/backup -name '*.db' -mtime +14 -delete
```

Point Hyper Backup at `/volume1/docker/storyforge/data/backup/`. Those files are always
consistent; the live `storyforge.db` is not.

**Expect growth.** Cover images are stored as base64 *inside* SQLite — `documents` is already
67 MB of the 79 MB total — and chapter versions are never pruned.

---

## Routine operations

### Deploy a new version

```bash
docker build -t storyforge:1.1 .
docker save storyforge:1.1 | gzip > /tmp/storyforge-1.1.tar.gz
```

Load on the NAS, bump the `image:` tag in `docker-compose.yml`, rebuild the project in
Container Manager. The volume is untouched, so data survives. Keep the previous image loaded
until the new one is verified — rolling back is then just changing the tag back.

### Restore from backup

```bash
docker stop storyforge
cp /volume1/docker/storyforge/data/backup/storyforge-YYYY-MM-DD.db \
   /volume1/docker/storyforge/data/storyforge.db
rm -f /volume1/docker/storyforge/data/storyforge.db-wal \
      /volume1/docker/storyforge/data/storyforge.db-shm
chown 1000:1000 /volume1/docker/storyforge/data/storyforge.db
docker start storyforge
```

Deleting the stale `-wal` and `-shm` alongside is the step people forget.

### Logs

```bash
docker logs -f storyforge
```

All application logging is `console.log` to stdout. Capped at 3 × 10 MB by the compose file.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `/api/health/db` returns 503 | Next's file tracing dropped a `.node` binary | The Dockerfile copies `better-sqlite3`, `sharp` and `@img` explicitly for this reason. If it still fails, exec in and check `node -e "require('better-sqlite3')"` |
| Container starts, port unreachable | `HOSTNAME` not `0.0.0.0` | The standalone server binds narrowly by default; `electron/main.js` pins `127.0.0.1` |
| API keys work, then stop after a restart | Keys were saved in the Settings UI | Settings writes `<dataDir>/settings.json`, but only `electron/main.js` re-reads it at boot. Put keys in `storyforge.env` |
| Generation dies around 60 s | A reverse proxy in the path | `/api/generate` declares `maxDuration = 800` (~13 min) and `ANTHROPIC_TIMEOUT_MS` defaults to an hour. DSM's nginx defaults to 60 s. Tailscale serve doesn't have this problem — a DSM reverse proxy does |
| `database is locked` / corruption | Data volume on an SMB/NFS share | SQLite WAL requires a real local filesystem. Use `/volume1/...` |
| Cover full-wrap export killed | `mem_limit: 3g` reached | `fullWrapComposite.ts` does print-resolution RGBA compositing — the heaviest operation in the app. Raise the cap, or run that one job on the desktop |
| Rate limited at 120/min unexpectedly | `API_RATE_LIMIT_MAX` | In-memory, resets on restart. Raise it in `storyforge.env` |

---

## Known limits

- **No locking, no realtime sync.** Two browser tabs open on the same chapter will clobber
  each other. The app's single-user assumption survived the move to a network; the discipline
  is now yours.
- **Two cores.** Run one generation at a time. Don't start full-auto on two projects at once.
- **The desktop Electron build still exists** in `electron/` and still works, but after
  cutover it points at a different, stale database. Treat the NAS as the only live copy.
