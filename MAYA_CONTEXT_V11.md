# MAYA_CONTEXT_V11 — Session scoping + dead path removal
*Addendum: August 2026 — extends `MAYA_CONTEXT_V10.md`*

This file documents **Maya Phase 2** (`db1de76`). V10 still governs image generation, Assets, and brief safety unless contradicted here.

Technical detail: `CONTEXTV31.md` §5.

---

## What changed

### Per-member Maya sessions (F1)

- `maya_sessions.user_id` stores the **acting profile id** (`profiles.id`), not the workspace owner id.
- Dashboard layout loads sessions with `.eq('user_id', p.id)` where `p` is the signed-in member profile.
- **Verified live:** teammates see only their own session list; no cross-leak to owner sessions.

### Removed dead paths (F5 / F6)

| Removed | Notes |
|---------|-------|
| `MayaShell.tsx` | Orchestration UI had no live callers |
| `runOrchestration()` | Foundation voice regen uses direct generation; orchestration row cost verified post-removal |
| `chat_sessions` table | Empty orphan; dropped from prod after code references removed |

### Server validation (F4)

- `/api/maya/chat` validates `chatSurface` / help-mode flags server-side — client cannot spoof surface context.

### Still live / unchanged

- `hooks/useMayaContext.ts` → `window.__MAYA_CANVAS_CONTEXT__`
- `MayChatPanel` greeting waits for rich canvas context
- Image generation, Assets, brief rules — see V10

### Cleanup deferred

- `/api/maya/campaign` — zero callers after MayaShell removal; route left in place; delete in a future pass if grep stays clean.

---

*Last reviewed: September 21, 2026*
