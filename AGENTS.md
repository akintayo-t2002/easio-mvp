# Voice Agent Platform · AGENTS Guide

## 1. Snapshot
- React workflow builder + FastAPI API + LiveKit worker; workflows, OAuth state, and secrets persist in Supabase.
- Backend services orchestrate OAuth (Gmail, Airtable), integration secrets, and runtime agent transfers.
- Frontend renders XYFlow canvases, OAuth dashboards, and LiveKit test tooling.

## 2. Repo Landmarks
- `backend/app.py` FastAPI factory; `backend/routes.py` REST surface; `backend/config.py` Pydantic settings sourced from `.env.local`.
- `backend/services/*` hold business logic (OAuth, integration secrets, Vault); `backend/repositories/*` wrap Supabase RPCs.
- `backend/runtime/*` builds LiveKit personas (`AgentFactory`, tool registry, cache); `backend/worker.py` boots the LiveKit job.
- `backend/oauth/*` handles state tokens + Gmail providers; `backend/tests/` mirrors services + OAuth behavior.
- `frontend/src/pages` (Workflows, Integrations, Call Logs), `frontend/src/components` (XYFlow nodes, modals, shadcn UI), `frontend/src/hooks` (integration/test sessions), `frontend/src/lib/api.ts` centralizes fetch wrappers.
- `migrations/*.sql` keep Supabase schema in sync; `scripts/create_token.py` issues LiveKit RoomAgentDispatch tokens.
- Extended docs: `README.md`, `FRONTEND.md`, `docs/domain_model.md`, `docs/testing.md`, `VAULT_EXPLANATION.md`.

## 3. Tech + Conventions
- **Backend**: Python 3.12 + `uv`, FastAPI, Supabase client, SQLAlchemy, Alembic-style SQL, LiveKit agent SDK. Favor dependency-injected services, async repos, and dataclass configs.
- **Frontend**: React 18, Vite, TypeScript, XYFlow, shadcn-style primitives. Keep logic inside hooks/components, use Tailwind tokens from `frontend/src/styles.css` instead of raw hex.
- **Secrets**: Root `.env.local` for Supabase, LiveKit, OpenAI, AssemblyAI, Cartesia; `frontend/.env.local` for `VITE_API_BASE_URL` + `VITE_ORGANIZATION_ID`. Never commit secrets.
- **Migrations**: Apply SQL files oldest → newest via Supabase SQL editor or `psql "$SUPABASE_DB_URL" -f migrations/<file>.sql` before running OAuth tests.

## 4. Install + Environment
```bash
uv sync
cd frontend && npm install && cd ..
```
Create `.env.local` (backend) and `frontend/.env.local` (frontend) using `README.md` templates. Supabase project + LiveKit keys must exist before running services.

## 5. Core Commands
- **Backend API**: ``uv run uvicorn backend.app:create_app --factory --reload``
- **LiveKit Worker**: ``uv run python -m backend.worker``
- **Frontend Dev Server**: ``cd frontend && npm run dev``
- **Generate LiveKit token**: ``uv run python scripts/create_token.py --room <room> --workflow-id <uuid>``
- **Run SQL migrations**: ``psql "$SUPABASE_DB_URL" -f migrations/002_create_oauth_state_tokens.sql`` (repeat per file) or paste into Supabase SQL editor.

## 6. Coding Patterns & Gotchas
- FastAPI dependencies live in `backend/dependencies.py`; override them in tests instead of importing services directly.
- Repositories encapsulate Supabase I/O—add new queries there so services stay mockable.
- Runtime agents rely on `backend/runtime/tool_registry.py`; all new tools must register there and expose metadata consumed by the frontend integration forms.
- Frontend canvas uses temp IDs (`temp-<timestamp>`) before persistence; update related edges/paths once the API returns UUIDs.
- OAuth popups post messages back to opener windows—keep backend state TTL (`backend/oauth/state.py`) in sync with `frontend/src/pages/IntegrationsCallbackPage.tsx` expectations.
- Cache busting: if workflows feel stale, clear `backend/runtime/cache.py` entries or restart worker to reload Supabase configs.

## 7. Validation (run before every PR)
```bash
pytest backend/tests
cd frontend && npm run lint
cd frontend && npm run build
```
- Add or update backend tests whenever you touch services, repositories, or runtime logic.
- Mirror new API contracts in `frontend/src/lib/api.ts` types and add component tests when UI flows change.
- Ensure Supabase migrations are applied locally so tests referencing new columns succeed.

## 8. PR Checklist
- Title format: ``[starteragent] <summary>`` (or team-specific prefix if instructed in issue).
- Run ``pytest backend/tests`` + ``cd frontend && npm run lint`` + ``cd frontend && npm run build`` before committing; attach evidence in the PR body.
- Keep diffs scoped to the folders noted in your ticket; update `AGENTS.md` whenever commands, env vars, or workflows change.

Maintain this file under ~150 lines and treat it like code: update it in the same PR when build/test workflows evolve.
