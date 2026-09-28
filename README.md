# StoryForge

Guided, human-in-the-loop novel writing workflow (desktop app).

## Features

- **Pipeline, not chat**: move through a linear set of locked workflow stages
- **Human control**: outputs require explicit approval before they become canon
- **Canon lock + versioning**: every approved change is saved as a new version
- **Model specialization**: OpenAI for research/planning/editorial packaging; Anthropic for long-form drafting + revision
- **Local-first**: projects are stored in a local SQLite database; no cloud database or auth system
- **Review tooling**: revision workspace with chapter diffs and acceptance criteria
- **Export Ready**: download your manuscript as `.docx` or `.txt`

## Tech Stack

- **App Type**: Electron desktop app (Windows installer via `electron-builder`)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State**: Zustand
- **Editor**: TipTap (ProseMirror-based)
- **Database**: SQLite via `better-sqlite3`
- **LLMs**: OpenAI API, Anthropic API
- **Export**: `docx` + text export

## Getting Started

### Prerequisites

- Node.js 18+
- npm (or yarn)
- OpenAI API key
- Anthropic API key

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd storyforge
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the desktop app:
   ```bash
   npm run electron:dev
   ```

4. In the app, open **Settings** and paste your OpenAI/Anthropic API keys.
   - Keys are saved locally in `settings.json` and only used for direct LLM API calls.

### Data Storage (Local SQLite)

StoryForge writes all project data to `storyforge.db` in a local data directory.

- Development: `./.data/storyforge.db`
- Packaged Electron: your Electron app data directory (Settings UI shows the exact location)

You can override the data directory with `STORYFORGE_DATA_DIR`.

### Environment Variables (Optional)

You generally set API keys via the **Settings** screen. Optional environment variables:

```bash
STORYFORGE_DATA_DIR=path/to/your/data
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

If you start without `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, use the app **Settings** screen to save keys (the running server updates its env in best-effort mode).

### Building (Windows)

```bash
npm run electron:build:win
```

## Running headless (Docker / NAS)

Electron is only a window. It forks the standalone Next.js server on `127.0.0.1:3000`
and points a `BrowserWindow` at it — there are no IPC channels, and all data access
already goes over HTTP to `/api/db`. So the same server runs perfectly well in a
container with no Electron at all, reachable from a browser on any device.

```bash
cp env.docker.example storyforge.env   # then chmod 600 and fill in the API keys
docker build -t storyforge:1.0 .
docker compose up -d
```

Set `STORYFORGE_DATA_DIR` to a volume on a **real local filesystem** — SQLite runs in
WAL mode and will not survive an SMB or NFS mount.

> **StoryForge has no authentication of any kind.** `useAuth` returns
> `isAuthenticated: true` unconditionally, `middleware.ts` does rate limiting only, and
> there is no users table. Anyone who can reach the port can delete every project and
> spend your API credit. `docker-compose.yml` therefore binds to `127.0.0.1` and expects
> a Tailscale (or equivalent) layer in front. Do not expose the port directly.

Full runbook, including the Synology setup, data cutover and the nightly consistent
backup: [docs/nas-deployment.md](docs/nas-deployment.md).

## Workflow Stages

Planning & drafting follow this linear pipeline:

0. **Getting Started** (`setup`)
1. **Market Analysis** (`genre-research`)
2. **Reader Targeting** (`niche`)
3. **Choose Your Ending** (`ending`)
4. **Cast of Characters** (`characters`)
5. **Plot Blueprint** (`structure`)
6. **Title** (`title`)
7. **Chapter Outlines** (`chapter-outlines`)
8. **Write Chapters** (`chapters`)
9. **Manuscript Assembly** (`compilation`)
10. **Export Draft** (`export-draft`)
11. **Editorial Analysis** (`editorial`)
12. **Apply Revisions** (`revision`)
13. **Export Final** (`export-final`)

Marketing tools (available from the project dashboard after the pipeline):
- **Blurb for back of book** (`blurb`)
- **Amazon Description** (`amazon-description`)

For developers: what each generation stage passes to the LLM (system prompt, user prompt, and `data` keys) is documented in [docs/ai-stages-and-prompts.md](docs/ai-stages-and-prompts.md).

## Project Structure
```
electron/                 # Electron main/preload code
.data/                    # Dev data dir (SQLite: storyforge.db, plus settings.json)
src/                      # Next.js (App Router) app code
src/lib/db/               # SQLite database layer
src/lib/llm/              # OpenAI + Anthropic integration
scripts/                  # Utility scripts (e.g. migration helpers)
public/                   # Static assets
```

## License

MIT
