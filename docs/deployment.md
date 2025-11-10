# Deployment & Environment Setup

This guide covers local development setup, environment configuration, and Docker-based workflows for the voice agent platform. Telephony integration is intentionally scoped out per requirements; focus remains on web voice testing and LiveKit room orchestration.

## Prerequisites

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose (optional but recommended)
- LiveKit Cloud project or self-hosted server
- Supabase project (used for persistence)
- API keys for Deepgram (STT) and Cartesia (TTS)

## Environment Variables

Create a `.env.local` at the repository root (mirrors `backend/config.py`).

Required variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project REST endpoint |
| `SUPABASE_KEY` | Supabase service role/API key |
| `LIVEKIT_URL` | LiveKit server URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `ASSEMBLYAI_API_KEY` | STT provider key |
| `CARTESIA_API_KEY` | TTS provider key |

For frontend development, create `frontend/.env.local` and set `VITE_API_BASE_URL` to point to the backend (e.g., `http://localhost:8000/api`) alongside any other `VITE_*` variables (for example, `VITE_ORGANIZATION_ID`).

## Local Development

### Backend

```bash
uv sync  # install python dependencies
uv run uvicorn backend.app:create_app --factory --reload
```

The API will listen on `http://localhost:8000/api`.

### LiveKit Worker

To run the LiveKit agent worker that loads workflows dynamically:

```bash
uv run python -m backend.worker dev
```

The worker runs with `agent_name="starteragent"` and waits for explicit dispatch requests or automatic dispatch from room configurations. When dispatched to a room with `workflow_id` in metadata, the worker loads that workflow and starts the configured agents.

**Testing with Token-Based Dispatch (Recommended):**

The worker supports explicit agent dispatch via access tokens that embed workflow metadata. This is the most reliable testing method when the LiveKit sandbox UI doesn't expose metadata fields.

1. Create a workflow via API (see Usage section in README)
2. Get the workflow ID from the API response or Supabase
3. Generate an access token with the token script:

```bash
uv run python scripts/create_token.py \
  --room "test-room-123" \
  --workflow-id "YOUR-WORKFLOW-UUID" \
  --version-id "OPTIONAL-VERSION-UUID"
```

4. Start the worker:

```bash
uv run python -m backend.worker dev
```

5. Copy the generated token and join the room:
   - Open LiveKit Agents Playground: https://agents-playground.livekit.io/
   - Enter your LiveKit URL and credentials
   - Paste the token when joining
   - Start talking to test the workflow!

The token embeds `RoomConfiguration` with `RoomAgentDispatch` that includes your workflow metadata, so the worker knows exactly which workflow to load.

**Alternative: Automatic Dispatch with Room Metadata**

If your LiveKit UI exposes room metadata configuration, you can use automatic dispatch:

1. Create a workflow and get its ID
2. Start the worker (without agent_name for automatic mode)
3. Open LiveKit Playground
4. Set room metadata: `{"workflow_id": "your-workflow-id-here"}`
5. Join the room

For most testing scenarios, token-based dispatch (Option 1) is simpler and more reliable.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`. Update `src` components to call backend endpoints once the API is ready.

## Docker Workflow

Build and run services from the repo root:

```bash
docker compose up --build
```

Services:

- `backend`: FastAPI application served via uvicorn.
- `frontend`: Vite dev server for the React workflow builder.
- `supabase`: Local Postgres (Supabase image) for persistence experiments.

Environment variables cascade from your shell into the containers. For secure sharing, create a `.env` file and load it with `env $(cat .env) docker compose up`.

## Architecture Overview

The platform consists of three main components:

1. **FastAPI Backend** (`backend/app.py`): REST API for workflow management, powered by Supabase
2. **LiveKit Worker** (`backend/worker.py`): Dynamic agent runtime that loads workflows and handles voice interactions
3. **React Frontend** (`frontend/`): Visual workflow builder and testing interface

### Workflow Execution Flow

```
1. User creates workflow in frontend → API → Supabase
2. User publishes workflow version
3. LiveKit room created with workflow_id in metadata
4. Worker detects room → loads workflow from Supabase
5. Worker instantiates agents dynamically from config
6. Agents handle voice conversation with transfers/tools
7. Session events logged back to Supabase for analytics
```

## Production Deployment Considerations

- Run multiple worker instances for high availability
- Use Redis for distributed workflow caching across workers
- Set up Supabase connection pooling for concurrent API requests
- Monitor worker health and room connection status
- Configure autoscaling based on concurrent room count
