# Build Factory Verification Fix — Implementation Notes

## Problem Statement
The Build Pipeline Service was reporting builds as successful merely because the GitHub workflow was triggered, without waiting for actual workflow completion. This violated the truthfulness requirement: TIVO must only report success when a workflow has actually completed with conclusion=success.

## Solution Overview
Implemented a comprehensive workflow verification system that:
1. Captures the commit SHA from the push operation
2. Waits for and verifies actual GitHub Actions workflow completion
3. Only reports success when status=completed AND conclusion=success
4. Returns accurate verification states (pending/unverified/failure/success)

## Files Modified

### 1. src/services/githubService.ts
**Changes:**
- Added `headSha?: string` optional parameter to `listWorkflowRuns()` options
- Allows precise workflow run matching by commit SHA instead of relying on timestamps

**Rationale:**
Commit SHA filtering is more reliable than timestamp-based matching, reducing false positives when multiple runs exist.

### 2. supabase/functions/github/index.ts
**Changes:**
- Modified `push_project` action to return `commitSha` from the last commit
- Added `headSha` query parameter support to `list_workflow_runs` action
- Passes `head_sha` filter to GitHub API when provided

**Rationale:**
The edge function is the boundary between the browser client and GitHub API. All GitHub API calls must go through here. By capturing and returning the commit SHA, we enable precise workflow run matching.

### 3. src/services/projectExportService.ts
**Changes:**
- Modified `pushProjectWithBuild()` return type from `Promise<void>` to `Promise<{ commitSha?: string }>`
- Returns commit SHA from the push operation result

**Rationale:**
The commit SHA is essential for accurate workflow run discovery. By returning it here, the pipeline can use it immediately for verification.

### 4. src/services/buildPipelineService.ts
**Changes - Verification Logic:**
- Updated `verifyWorkflowRun()` to accept optional `headSha` parameter
- Implements two-tier matching:
  - Primary: Match by commit SHA (if available)
  - Fallback: Match by creation timestamp (if no SHA)
- Follows workflow run from discovery to completion
- Returns state machine: unverified → pending/in_progress → completed
- Only returns success when conclusion=success

**Changes - Pipeline Flow:**
- Step 4 (Sync): Records `buildStartTime` and captures `commitSha` from push
- Step 5 (Dispatch): Updated messaging to indicate waiting for completion
- Step 6 (Link): NOW calls `verifyWorkflowRun()` with proper parameters
- Final Result Determination:
  - `verification === 'success'`: Returns `ok: true` with artifacts
  - `verification === 'pending'`: Returns `ok: false` with timeout explanation
  - `verification === 'failure'`: Returns `ok: false` with conclusion reason
  - `verification === 'unverified'`: Returns `ok: false` with discovery error

**Chat Messages Updated:**
- Before: "Build pipeline successfully triggered" (misleading)
- After: "GitHub Actions build is running... Waiting for workflow to complete"
- During: Progress updates showing run status
- After completion: Accurate success/failure/pending messages

## Verification Strategy

### Run Discovery (0-60 seconds)
1. If `headSha` provided: Query `/repos/{owner}/{repo}/actions/runs?head_sha={sha}`
   - Returns only runs for this specific commit
2. If no `headSha`: Query by branch and check `created_at >= since - 60s`
   - Matches runs created after push started

### Run Monitoring (0-600 seconds default)
1. Poll `/repos/{owner}/{repo}/actions/runs/{runId}` every 10 seconds
2. Read `status` field:
   - `queued` or `in_progress`: Continue polling
   - `completed`: Check conclusion
3. Check `conclusion` field:
   - `success`: Fetch artifacts, return success
   - `failure`, `cancelled`, `skipped`, `timed_out`: Return failure
   - `null`: Still completing, continue polling

### Artifact Collection
- Called only after `conclusion === success`
- Best-effort: If fetch fails, still return success (artifacts may be deleted)
- Returns: name, size_in_bytes, expired flag

## Error Handling

### Unverified State
- Run not found within 60s discovery window
- Run list API failed
- Caused by: network issues, GitHub API rate limit, incorrect permissions
- Message: "No GitHub Actions run was observed for commit {sha}"
- Resolution: User can check GitHub Actions page manually

### Pending State
- Run found and polling succeeded, but workflow didn't complete within timeout
- Default timeout: 10 minutes (600_000 ms)
- User can wait longer or check GitHub Actions page
- Message: "Build verification timed out"

### Failure State
- Run completed with non-success conclusion
- Reasons: build script failed, tests failed, job cancelled, timeout in workflow
- Message includes: exact conclusion (failure/cancelled/timed_out/skipped)
- User can click run URL to debug

## Type Safety

### PipelineResult Changes
```typescript
export interface PipelineResult {
  ok: boolean;                    // Only true if verification=success
  steps: PipelineStepState[];      // Step-by-step execution record
  runUrl?: string;                 // GitHub Actions run URL
  repoUrl?: string;                // GitHub repo URL
  error?: string;                  // Human-readable error message
  runId?: number;                  // GitHub Actions run ID
  runStatus?: string;              // queued|in_progress|completed
  verification?: BuildVerification; // unverified|pending|success|failure
  artifacts?: Array<{              // When verification=success
    name: string;
    sizeBytes: number;
    expired: boolean;
  }>;
}
```

### BuildVerification Type
```typescript
type BuildVerification = 'unverified' | 'pending' | 'success' | 'failure';
```

## Backward Compatibility

### Breaking Changes
- `pushProjectWithBuild()` now returns `Promise<{ commitSha?: string }>` instead of `Promise<void>`
- All callers must handle the return value (though commitSha is optional)

### Non-Breaking Changes
- `verifyWorkflowRun()` signature expanded but `headSha` is optional
- `listWorkflowRuns()` options expanded but `headSha` is optional
- Existing callers without headSha still work (fallback to timestamp matching)

## Testing

### Manual Testing Checklist
1. [ ] Build succeeds: Workflow completes, ok=true, artifacts returned
2. [ ] Build fails: Workflow fails, ok=false, failure reason shown
3. [ ] Pending timeout: Workflow slow, timeout before completion, ok=false, pending state
4. [ ] No run found: Push succeeded but workflow not triggered, unverified state
5. [ ] Chat messages accurate throughout pipeline
6. [ ] Run URL clickable and points to correct GitHub Actions run

### TypeScript Compilation
- Run: `npx tsc --noEmit`
- All files should pass without errors

### Build Test
- Run: `npm run build`
- Should complete without errors
- May have warnings (acceptable if not related to our changes)

## Deployment Considerations

### Edge Function Changes
- Deployed to Supabase edge function runtime
- No database changes required
- No authentication changes needed
- Backward compatible (new parameters optional)

### Client Changes
- TypeScript recompilation required
- No new dependencies added
- No environment variable changes
- Compatible with existing build infrastructure

## Limitations & Future Work

### Current Limitations
1. Timeout is global (default 10 min) — cannot adjust per build type
2. No exponential backoff for polling (fixed 10s intervals)
3. Artifacts listed but not download tokens (security by design)
4. No workflow run history — only checks most recent runs
5. Commit SHA matching requires successful push (won't work if push fails)

### Future Enhancements
1. Make polling interval adaptive (start fast, slow down)
2. Allow timeout configuration per build target (e.g., APK builds longer)
3. Implement run history search with pagination
4. Add webhook support for real-time completion notifications
5. Cache workflow metadata to reduce API calls
6. Add support for workflow_dispatch runs (currently timestamp-based)

## Security Notes

- No secrets logged: Commit SHA, run ID, URLs are not sensitive
- No credentials exposed: GitHub token stays in edge function
- No artifacts downloaded: Only metadata returned (names, sizes)
- Database not modified: Read-only verification
- User permissions respected: Can only see runs for repos they can access

## References

- GitHub API: List workflow runs - https://docs.github.com/en/rest/actions/workflow-runs#list-workflow-runs
- GitHub API: Get a workflow run - https://docs.github.com/en/rest/actions/workflow-runs#get-a-workflow-run
- GitHub API: List artifacts - https://docs.github.com/en/rest/actions/artifacts#list-artifacts-for-a-workflow-run
