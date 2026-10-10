# Step 2 — Controlled TDEF (on this project)

## Goal
Requests that have already been approved can actually run, but only through one small, locked-down runtime. A server check happens before anything runs. Blocked or unapproved requests can never reach a runtime. "Accepted" still does not mean "done": this step produces a run result with observations. Deciding whether the goal was met (verification) comes in Step 4.

## How the updated blueprint maps onto this project
The updated document was written about a different code layout (`src/core/world`, `sendToBrain`, a Resources page). This project uses its own equivalents, which stay the source of truth:

| Blueprint name | In this project (kept, reused) |
|---|---|
| World Foundation (`src/core/world`) | `src/services/world/` (contracts, control, world): Step 1, done |
| resources / affordances / interaction_requests | `world_resources`, `world_affordances`, `interaction_requests` |
| Action Gate / kill switch | `evaluateControl` + existing `get_kill_switch_state` |
| executionFabric (0 providers) | New: TDEF registry + one runtime (this step) |
| audit_events | Existing `permission_audit` / `admin_audit_log` |

Out of scope for now: renaming to the blueprint's table names, the placeholder screens, and building a Resources page. These belong to Steps 8 and 9 of the roadmap.

## What gets built
1. **A server-side gate (new backend function `tdef-execute`)**
   - Takes only an interaction request ID and loads that request as the signed-in user, so it can only see that user's own requests.
   - Checks everything again on the server and does not trust the browser's earlier decision:
     - the request is `accepted`;
     - the kill switch is off;
     - the affordance still exists and matches the request;
     - a risky or irreversible affordance still has its approval.
   - If any check fails, the request is refused and nothing runs.
2. **Runtime registry (TDEF)**
   - A table of providers.
   - Each provider declares:
     - which actions it supports;
     - its limits (timeout, network = none, files = none);
     - an availability check.
   - If no provider fits, the result is `runtime_unavailable`, never a fake success.
3. **First runtime: `observe-describe`**
   - A pure, in-process runtime with no network, no file access and no way to reach the computer it runs on.
   - Its only job is the read-only `describe` affordance that already exists from Step 1: it returns the stored resource description as an observation.
   - It is intentionally harmless. The goal is to prove the gate → runtime → observation pipeline end to end before riskier runtimes are added.
4. **Run lifecycle record (new table `interaction_executions`)**
   - States: `started`, `running`, `completed`, `failed`, `timed_out`, `cancelled`, `unknown`.
   - Each run stores:
     - its observations, with provenance and timestamps;
     - which runtime handled it;
     - how long it took;
     - any error.
   - Rows are visible only to their owner and can only be written by the server.
   - There is one run per request (idempotent). A repeat call returns the existing run instead of running again.
   - If an earlier result is unclear (`unknown`), it is checked again before any retry.
5. **Client wiring**
   - `executeInteraction(requestId)` in `src/services/world/tdef.ts` calls the server function and returns the lifecycle result exactly as reported.
   - No UI changes in this step.

## Acceptance (from blueprint section 17)
- Only requests the server has authorized reach a runtime; blocked or pending requests never do.
- The registry reports real availability; an empty registry fails closed.
- The first runtime has no network, file or host access.
- Timeout, cancellation and unknown results are separate states.
- Duplicate calls never run twice.
- The result is structured: lifecycle plus observations. Nothing is marked "goal complete".
- All existing tests (38) still pass.

## Technical details
- Migration (additive only):
  - `interaction_executions`: id, user_id, request_id (unique), runtime_id, status, observations jsonb, error, started_at, finished_at.
  - Grants: authenticated SELECT; service_role ALL.
  - RLS: owner can read; no client writes.
- Edge function `supabase/functions/tdef-execute/index.ts`:
  - Verifies the JWT and reads the request through the user's own client.
  - Writes the run through the service role.
  - Uses the existing kill-switch RPC.
  - Re-checks approval with the same fingerprint function from `control.ts` (copied into the function as a shared pure helper).
  - Enforces a hard timeout with AbortController.
- `src/services/world/tdef.ts`: `RuntimeProvider` contract, registry, and the `executeInteraction` client.
- Tests in `src/test/tdef.test.ts`:
  - a blocked request is never dispatched;
  - an empty registry returns `runtime_unavailable`;
  - a timeout becomes `timed_out`;
  - a duplicate request returns the existing run;
  - the runtime source has no fetch or filesystem access.
- Record the TDEF rule in AGENTS.md (replacing the "never executed until TDEF" wording).
- Function deploy: I will deploy `tdef-execute` so it can be tested. Nothing else is deployed or published, and no secrets change.

After this step I'll stop and report. Step 3 (Observation, Evidence and State) starts only with your approval.
