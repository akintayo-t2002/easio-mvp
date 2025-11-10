# Voice Agent Platform

A configurable voice agent platform built on LiveKit that enables businesses to create, deploy, and manage intelligent voice workflows with multiple specialized agents.

## 🎯 Project Overview

This platform allows non-technical users to design complex voice agent systems through a visual interface. Instead of rigid IVR trees, users configure intelligent agents that understand context and make decisions based on conversation flow.

### Key Features

- **Visual Workflow Builder**: Drag-and-drop interface for creating agent networks
- **Dynamic Agent Loading**: Workflows stored in Supabase, loaded at runtime
- **Multi-Agent Orchestration**: Seamless transfers between specialized agents
- **Context Preservation**: Conversation history maintained across agent transitions
- **Flexible Configuration**: Agents configured via natural language instructions
- **Real-time Voice**: Powered by LiveKit for low-latency interactions

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  React Frontend │────▶│  FastAPI Backend│────▶│    Supabase DB   │
│  (Workflow UI)  │     │  (REST API)     │     │  (Persistence)   │
└─────────────────┘     └─────────────────┘     └──────────────────┘
                                                          │
                        ┌─────────────────┐              │
                        │  LiveKit Worker │◀─────────────┘
                        │ (Agent Runtime) │
                        └─────────────────┘
                                │
                                ▼
                        ┌─────────────────┐
                        │   LiveKit Cloud │
                        │  (Voice Infra)  │
                        └─────────────────┘
```

## 📁 Project Structure

```
starteragent/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── worker.py              # LiveKit agent worker
│   ├── config.py              # Environment configuration
│   ├── dependencies.py        # FastAPI dependencies
│   ├── routes.py              # API endpoints
│   ├── schemas.py             # Pydantic models for API
│   ├── db/
│   │   ├── models.py          # Database models
│   │   └── __init__.py
│   ├── repositories/
│   │   ├── supabase_repo.py   # Supabase CRUD operations
│   │   └── __init__.py
│   └── runtime/
│       ├── config.py          # Runtime configuration DTOs
│       ├── loader.py          # Workflow loader
│       ├── factory.py         # Dynamic agent factory
│       ├── cache.py           # Workflow caching
│       └── __init__.py
├── frontend/
│   ├── src/
│   │   ├── main.tsx           # Entry point
│   │   ├── pages/             # Page components
│   │   ├── sections/          # Section components
│   │   ├── layouts/           # Layout components
│   │   ├── components/        # Reusable components
│   │   └── styles.css         # Global styles
│   ├── package.json
│   └── vite.config.ts
├── docs/
│   ├── domain_model.md        # Database schema & API design
│   ├── deployment.md          # Deployment guide
│   └── testing.md             # Testing strategy
├── scripts/
│   └── create_token.py        # LiveKit token generation utility
├── reference code/
│   └── multi_agent_ref.py     # LiveKit multi-agent reference
├── pyproject.toml             # Python dependencies
├── docker-compose.yml         # Docker services
├── Dockerfile                 # Backend Docker image
└── .env.local                 # Environment variables (create this)
```

## 🚀 Quick Start

### Prerequisites

1. **Python 3.12+** and **uv** package manager
2. **Node.js 20+** and **npm**
3. **Supabase account** with project created
4. **LiveKit account** (Cloud or self-hosted)
5. API keys for:
   - OpenAI (LLM)
   - AssemblyAI (STT)
   - Cartesia (TTS)

### 1. Set Up Environment

Create `.env.local` in the project root:

```bash
# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_supabase_key

# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxxxx
LIVEKIT_API_SECRET=xxxxxxxxxx

# AI Services
OPENAI_API_KEY=sk-proj-xxxxx
ASSEMBLYAI_API_KEY=xxxxx
CARTESIA_API_KEY=xxxxx
```

Then create `frontend/.env.local` so the React app can reach the API:

```bash
VITE_API_BASE_URL=http://localhost:8000/api
VITE_ORGANIZATION_ID=00000000-0000-0000-0000-000000000000
```

### 2. Set Up Database

Run the SQL schema from `docs/domain_model.md` in your Supabase SQL editor to create all tables.

### 3. Install Dependencies

```bash
# Backend
uv sync

# Frontend
cd frontend
npm install
cd ..
```

### 4. Start Services

**Terminal 1 - Backend API:**
```bash
uv run uvicorn backend.app:create_app --factory --reload
```

**Terminal 2 - LiveKit Worker:**
```bash
uv run python -m backend.worker
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
```

## 📖 Usage

### Creating Your First Workflow

1. **Via API** (Postman/curl):

```bash
# Create workflow
curl -X POST http://localhost:8000/api/workflows \
  -H "Content-Type: application/json" \
  -H "X-Organization-ID: 00000000-0000-0000-0000-000000000000" \
  -d '{"name": "Customer Support", "description": "Multi-agent support workflow"}'

# Get workflow ID from response, then get draft version
curl http://localhost:8000/api/workflows/{workflow_id}/versions/draft

# Create agent
curl -X POST http://localhost:8000/api/workflow-versions/{version_id}/agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Support Agent",
    "instructions": "You help customers with product questions.",
    "llm_config": {"provider": "openai", "model": "gpt-4o-mini"},
    "stt_config": {"provider": "deepgram", "model": "nova-3"},
    "tts_config": {"provider": "cartesia"}
  }'

# Publish workflow
curl -X POST http://localhost:8000/api/workflow-versions/{version_id}/publish
```

2. **Test with LiveKit (Token-Based Dispatch):**

Generate an access token that embeds the workflow metadata:

```bash
uv run python scripts/create_token.py \
  --room "test-room" \
  --workflow-id "YOUR-WORKFLOW-UUID"
```

Then:
   - Start the worker: `uv run python -m backend.worker dev`
   - Go to https://agents-playground.livekit.io/
   - Enter your LiveKit credentials
   - Paste the generated token to join
   - Start talking!

The token includes `RoomAgentDispatch` configuration that tells the worker which workflow to load.

## 🎨 Frontend Theme Tokens

The React frontend uses Tailwind CSS with a Shadcn-style token setup. Key tokens you can apply via Tailwind utilities:

- `bg-background` / `text-foreground`: default surface and text colors
- `bg-card` / `text-card-foreground`: for cards, modals, and drawers
- `bg-accent` / `text-accent-foreground`: primary brand blue used for hover/focus accents
- `bg-success`, `bg-warning`, `bg-error`: status colors that map to green, amber, and red respectively
- `border-border`, `ring-ring`: standard border and focus ring colors
- `text-text-secondary`, `text-text-tertiary`: muted body and caption text

You can find the full list and underlying CSS variables in `frontend/src/styles.css`. When adding new components, prefer these tokens over raw hex values for consistent theming.

## 🔌 API Endpoints

### Workflows
- `POST /api/workflows` - Create workflow
- `GET /api/workflows` - List workflows
- `GET /api/workflows/{id}` - Get workflow

### Versions
- `POST /api/workflows/{id}/versions` - Create version
- `GET /api/workflow-versions/{id}` - Get version
- `POST /api/workflow-versions/{id}/publish` - Publish version
- `GET /api/workflow-versions/{id}/config` - Get complete config

### Agents
- `POST /api/workflow-versions/{id}/agents` - Create agent
- `GET /api/workflow-versions/{id}/agents` - List agents
- `PUT /api/agents/{id}` - Update agent

### Tools & Paths
- `POST /api/agents/{id}/tools` - Add tool
- `POST /api/agents/{id}/paths` - Create path
- `POST /api/paths/{id}/variables` - Add required variable

See `docs/domain_model.md` for complete API documentation.

## 🧪 Testing

### Backend Tests
```bash
pytest backend/tests
```

### Frontend Tests
```bash
cd frontend
npm test
```

### Manual E2E Test

**Complete Workflow Test:**

1. Start the backend API:
```bash
uv run uvicorn backend.app:create_app --factory --reload
```

2. Create a workflow via API (see Usage section above)

3. Note the workflow_id from the response

4. Generate a LiveKit access token:
```bash
uv run python scripts/create_token.py \
  --room "my-test-room" \
  --workflow-id "YOUR-WORKFLOW-ID-HERE"
```

5. Start the LiveKit worker in a new terminal:
```bash
uv run python -m backend.worker dev
```

6. Join the room using the generated token:
   - Open https://agents-playground.livekit.io/
   - Enter your LiveKit credentials
   - Paste the token
   - Test the voice interaction

The `create_token.py` script generates tokens with embedded `RoomAgentDispatch` configuration, allowing you to test workflows without manually setting room metadata.

## 📚 Documentation

- **[Domain Model](docs/domain_model.md)**: Database schema, entities, API contracts
- **[Deployment Guide](docs/deployment.md)**: Environment setup, Docker workflow, production tips
- **[Testing Strategy](docs/testing.md)**: Unit, integration, and E2E testing approaches
- **[Platform Description](platformdesc.md)**: Product vision and user-facing concepts

## 🛠️ Development

### Adding New Tools

1. Define tool in `backend/runtime/tools.py`:
```python
@dataclass
class CheckOrderTool:
    async def execute(self, order_id: str) -> dict:
        # Implementation
        pass
```

2. Register in tool registry
3. Configure via API when creating agent

### Extending Agent Factory

Modify `backend/runtime/factory.py` to support new STT/LLM/TTS providers or custom agent behaviors.

## 🚢 Deployment

### Docker

```bash
docker compose up --build
```

### Production Checklist

- [ ] Set production Supabase credentials
- [ ] Configure LiveKit production server
- [ ] Set up Redis for distributed caching
- [ ] Enable connection pooling
- [ ] Configure autoscaling for workers
- [ ] Set up monitoring and logging
- [ ] Implement rate limiting
- [ ] Add authentication/authorization

## 🤝 Contributing

This is a starter template. Key extension points:

1. **Tool Library**: Add business-specific tools
2. **Authentication**: Integrate with your auth provider
3. **Analytics**: Expand session event capture
4. **Frontend**: Complete React integration with backend
5. **Testing**: Add comprehensive test suites

## 📝 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

Built with:
- [LiveKit](https://livekit.io/) - Real-time communication
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [Supabase](https://supabase.com/) - Open source Firebase alternative
- [React](https://react.dev/) - UI library
- [AssemblyAI](https://www.assemblyai.com/) - Speech-to-text
- [Cartesia](https://www.cartesia.ai/) - Text-to-speech
- [OpenAI](https://openai.com/) - Language models

## 📧 Support

For issues and questions, please refer to the documentation or create an issue in the repository.

---

**Status**: ✅ MVP Complete - Backend runtime fully implemented, frontend scaffolded and ready for integration
