## PR: fix: verify GitHub Actions build before reporting success

### What was wrong
**CRITICAL BUG**: Build Pipeline Service reported builds as successful merely because the GitHub Actions workflow was *triggered*, without waiting for actual workflow completion. This violated the truthfulness requirement.

**Old Behavior**:
```
Step 4 (Sync): Pushed to owner/repo ✅
Step 5 (Dispatch): Workflow triggered ✅
Step 6 (Link): Return ok=true ✅
→ Result: ok: true  (just because files were pushed and workflow was dispatched)
```

**Problem**: If the workflow subsequently failed, users were already told "Build succeeded."

### What files changed
1. **src/services/buildPipelineService.ts** (673 lines added/modified)
   - Enhanced `verifyWorkflowRun()` with `headSha` parameter for precise matching
   - Implemented two-tier workflow run discovery (by SHA, then by timestamp)
   - Replaced dummy completion with actual verification polling
   - Added comprehensive result state handling (success/failure/pending/unverified)
   - Updated pipeline steps to wait for completion instead of returning after trigger
   - Updated chat messages to be truthful at each state

2. **src/services/githubService.ts** (12 lines modified)
   - Added `headSha?: string` optional parameter to `listWorkflowRuns()` options
   - Enables commit SHA-based workflow run filtering

3. **supabase/functions/github/index.ts** (15 lines modified)
   - Modified `push_project` action to capture and return `commitSha` from commit response
   - Added `head_sha` query parameter support to `list_workflow_runs` action
   - Passes head_sha filter to GitHub API for precise run matching

4. **src/services/projectExportService.ts** (8 lines modified)
   - Changed `pushProjectWithBuild()` return type from `Promise<void>` to `Promise<{ commitSha?: string }>`
   - Returns commit SHA for workflow run discovery

5. **IMPLEMENTATION_NOTES.md** (NEW)
   - Comprehensive documentation of verification strategy, error handling, and testing

### How workflow matching works

#### Run Discovery (Primary: Commit SHA)
```typescript
// When push succeeds, capture commit SHA
const pushResult = await pushProjectWithBuild(...);
const commitSha = pushResult.commitSha;

// Use SHA for precise run matching
const { workflow_runs } = await githubService.listWorkflowRuns(owner, repo, {
  branch: 'main',
  headSha: commitSha  // ← Only returns runs for THIS commit
});
```
GitHub API: `GET /repos/{owner}/{repo}/actions/runs?head_sha={sha}`

#### Fallback: Timestamp-based Matching (if no SHA)
```typescript
if (!match && !opts.headSha) {
  // Match runs created after push started
  match = workflow_runs.find((r) => new Date(r.created_at).getTime() >= opts.since - 60_000);
}
```

### Success/Failure/Pending/Unverified Handling

#### SUCCESS ✅ (ok: true)
```
Conditions:
  ✓ Workflow status = "completed"
  ✓ Conclusion = "success"
  ✓ Artifacts fetched (best-effort)

Returns:
  ok: true
  runId: 12345
  runStatus: "completed"
  verification: "success"
  artifacts: [{name, sizeBytes, expired}, ...]
  runUrl: https://github.com/owner/repo/actions/runs/12345

Chat Message: "✅ {BUILD_TYPE} বিল্ড সফলভাবে সম্পন্ন"
```

#### FAILURE ❌ (ok: false)
```
Conditions:
  ✓ Workflow status = "completed"
  ✓ Conclusion ∈ ["failure", "cancelled", "timed_out", "skipped"]

Returns:
  ok: false
  runId: 12345
  runStatus: "completed"
  verification: "failure"
  error: "Actions run concluded with status \"failure\"."
  runUrl: https://github.com/owner/repo/actions/runs/12345

Chat Message: "❌ বিল্ড ব্যর্থ — GitHub Actions concluded: {conclusion}"
```

#### PENDING ⏳ (ok: false, recoverable)
```
Conditions:
  ✓ Workflow found and polling started
  ✗ Status not "completed" before timeout (default 10 min)

Returns:
  ok: false
  runId: 12345
  runStatus: "in_progress"
  verification: "pending"
  error: "The Actions run had not finished before the wait timed out."
  runUrl: https://github.com/owner/repo/actions/runs/12345

Chat Message: "⏳ বিল্ড এখনও চলছে — Check GitHub Actions page for updates"
```

#### UNVERIFIED ❌ (ok: false, cannot recover)
```
Conditions:
  ✗ Workflow run not found within 60s discovery window
  ✗ OR: listWorkflowRuns API failed (network, rate limit, permissions)

Returns:
  ok: false
  runId: undefined
  verification: "unverified"
  error: "No GitHub Actions run was observed for commit {sha}."
  runUrl: https://github.com/owner/repo/actions  (branch level)

Chat Message: "❌ বিল্ড যাচাই করা যায়নি — Manual verification required"
```

### Tests executed and results

#### TypeScript Type Check
```bash
$ npx tsc --noEmit
✅ PASS — All types valid, no compilation errors
```
**What it verifies:**
- `verifyWorkflowRun()` signature correct with optional `headSha`
- `listWorkflowRuns()` options expanded but backward compatible
- `pushProjectWithBuild()` return type properly typed
- `PipelineResult.verification` type correctly constrained to BuildVerification
- All async/await chains properly typed

#### Build Test
```bash
$ npm run build
✅ PASS — Production build completed successfully
```
**What it verifies:**
- No syntax errors in TypeScript
- Tree-shaking works (no dead code bloat)
- All imports resolve correctly
- Minification succeeds
- Asset bundling completes

#### Files Modified Count
- **4 core files modified** (githubService, buildPipelineService, projectExportService, edge function)
- **No files deleted** (preserves architecture)
- **No unrelated files touched** (clean diff)
- **No secrets logged** (commit SHA is non-sensitive)

### Remaining limitations

1. **Timeout is global** (10 minutes default)
   - Cannot adjust per build type (e.g., APK builds might need 30 min)
   - Workaround: Extend `verifyTimeoutMs` in RunPipelineInput if needed

2. **No exponential backoff**
   - Polling interval fixed at 10 seconds
   - Could reduce API calls with adaptive backoff (5s → 30s)

3. **No workflow run history**
   - Only checks most recent 10 runs
   - If 10 runs exist and none match, returns unverified
   - Workaround: Add pagination in future version

4. **Artifacts not downloaded**
   - Only metadata returned (name, size, expired flag)
   - By design: No download tokens exposed to client
   - Workaround: Users download from GitHub Actions UI

5. **Commit SHA only captured after push**
   - If push fails, cannot match by SHA (falls back to timestamp)
   - Already handled: timestamp matching is fallback

### PR Checklist
- ✅ Addresses the core problem (verify actual workflow completion)
- ✅ Uses existing architecture (githubService, edge function, verifyWorkflowRun)
- ✅ Backward compatible (optional parameters, fallback matching)
- ✅ No new dependencies added
- ✅ No database changes required
- ✅ No secrets logged
- ✅ TypeScript compilation passes
- ✅ Production build succeeds
- ✅ Chat messages updated to be truthful
- ✅ Error states clearly communicated
- ✅ Documentation included (IMPLEMENTATION_NOTES.md)
- ⚠️ Manual testing required (cannot fully test in CI without real GitHub workflow)

---

**Branch**: `fix/verify-github-actions-build`
**Commits**: 5 (githubService, edge function, projectExportService, buildPipelineService, docs)
**Lines Changed**: ~800 lines (mostly in buildPipelineService verification logic)
