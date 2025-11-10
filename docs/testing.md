# Testing Strategy

This document outlines recommended testing practices for the voice agent platform. Coverage spans backend APIs, agent orchestration logic, and the React workflow builder. Adjust as runtime features are implemented.

## Backend Testing

### Unit Tests
- **Service layer** (`backend/services`): Test workflow creation, validation, and Supabase interactions (mock Supabase client).
- **Repositories**: When replacing the in-memory store, provide integration tests against Supabase test schema or use local Postgres container.
- **Agent orchestration utilities** (future): Validate context merging, path selection, and tool invocation logic.

Use `pytest` with `pytest-asyncio` for async paths. Sample command:

```bash
pytest backend/tests
```

### Integration Tests
- Spin up FastAPI app with `TestClient` to verify `/api/workflows` endpoints.
- Mock LiveKit SDK interactions until runtime implementation exists.
- Include schema validation for configuration payloads (Pydantic models).

### Test Data
- Add fixtures representing orchestrator + specialist workflows (mirroring `platformdesc.md` patterns).
- Include edge cases: missing required variables, circular paths, invalid tool bindings.

## Frontend Testing

### Component Tests
- Use `@testing-library/react` to ensure components (e.g., `WorkflowSidebar`, `WorkflowCanvas`) render expected UI states.
- Validate user interactions: selecting agents, viewing instructions, toggling tabs.

### E2E Tests
- Once APIs are available, run Playwright or Cypress tests spinning up the backend + frontend to ensure workflows render and can be manipulated on the canvas.

### Visual Regression (Optional)
- Capture snapshots of the workflow canvas layout to guard against regression in node rendering.

## Analytics Validation

After implementing analytics capture:
- Ensure every session event triggers a stored record (e.g., path selections, tool execution, agent handoffs).
- Provide aggregated result tests verifying SQL views or API endpoints compute metrics correctly.

## CI Recommendations

- Lint: `ruff` for Python, `eslint` + TypeScript strict mode for frontend.
- Run backend and frontend tests separately.
- For Docker builds, run `docker compose build` in CI to verify container health.

## Manual Testing Checklist

- [ ] Create workflow via API; confirm retrieval and listing.
- [ ] Adjust agent instructions and verify persistence.
- [ ] Simulate chat session (once implemented) ensuring path gating respects required variables.
- [ ] Test voice flow locally with LiveKit web room when runtime integration exists.
- [ ] Review analytics dashboards for data consistency.










