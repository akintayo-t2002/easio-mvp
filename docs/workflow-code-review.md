# Workflow Code Review

## Backend

### Routes & Repository
- **Strengths**
  - CRUD endpoints cover workflows, versions, agents, paths, and tools.
  - Supabase repository centralizes persistence logic.
- **Gaps**
  - Workflow lookup by `workflow_name` is unimplemented in the worker (error path only logs).
  - No validation to ensure an entry agent exists before publishing/testing.
  - Test session endpoint hardcodes `mode="text"`; voice mode toggle missing.
  - Relies solely on `X-Organization-ID` header; no rate limiting or finer-grained auth scopes.
- **Slop / Cleanup Targets**
  - Redundant logging blocks and unused imports in `routes.py`.
  - Repeated JSON parsing/logging that could be consolidated.

### Runtime Layer
- **Factory**
  - Dynamically instantiates agents, but defaults hard-code a Cartesia voice ID and do not guard against invalid credentials, which produces noisy runtime errors.
  - Transfer helpers always speak a generic message; guard conditions/variables not surfaced.
- **Loader**
  - Performs multiple round-trips (agents → tools → paths → variables) instead of batching, which will hurt at scale.
  - No caching or invalidation when agent metadata/positions change.
- **Cache**
  - Global cache never invalidates after updates, so workers can serve stale configs after edits.

### Worker
- **Strengths**
  - Parses metadata from job/room sources and uses a ready-to-listen handshake to avoid intro races.
  - Caches workflow versions to reduce DB churn.
- **Gaps**
  - `ctx.connect()` call isn’t checked for success; connection failures aren’t surfaced.
  - Ready signal timeout only logs warnings; no fallback UX.
  - Missing metrics/telemetry around handshake timing.
  - `workflow_name` lookup path still unimplemented.

## Frontend

### API Layer
- Fetch helpers wrap endpoints but lack `AbortController` support, error normalization, or caching.
- React Query is installed but unused; manual state management everywhere.

### Workflow Builder (`WorkflowApp` et al.)
- **Strengths**
  - Complete CRUD wiring (agents/paths) with test modal entry point.
  - Inline rename, publish, and position persistence implemented.
- **Gaps**
  - Multiple overlapping state sources (`nodes`, `agentPaths`, `selectedAgent`) cause sync risk.
  - Position persistence resubmits full agent payload without conflict detection.
  - Pending edge management leaves temp entries on cancel sometimes.
  - Path modal hardcodes string data type; guard conditions/variables still shallow.
  - Error handling mostly `console.error` plus generic banners.
- **Slop**
  - `toolCount` placeholders remain without supporting UI.
  - Repeated canvas error messages and inline transformations that could be extracted.

### Test Chat
- Typing indicator handshake now prevents intro gap, but `ready_to_listen` only fires once; reconnects won’t re-signal.
- `hasAgentContent` state persists across modal reopen unless reset with `isConnecting`; still fragile.
- Voice mode not exposed; audio renderer runs even in text-only tests.
- No user-facing error if worker fails mid-session.

## Next Steps (High-Level)
1. **Runtime Hardening**
   - Implement cache invalidation, batch loader queries, and add workflow-name lookup or remove the unused path.
2. **Session Reliability**
   - Ensure `ctx.connect()` success, add reconnect handling, and surface Cartesia credential errors early.
3. **Frontend State Management**
   - Introduce React Query (or similar) for workflow data; refactor canvas state into a reducer/store for consistency.
4. **Test Experience**
   - Support text vs voice modes explicitly, reset intro indicator on modal close, and render issues to the user.
5. **Configuration Hygiene**
   - Move default voice IDs and API keys to environment/config and validate them on boot.
6. **UX/Tooling**
   - Provide actionable error feedback, either implement tool management UI or remove stub counters until ready.

_Saved for later cleanup reference; current focus remains on upcoming feature work._
