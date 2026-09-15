/**
 * Build Pipeline Service
 *
 * Orchestrates the 6-step build flow defined in src/config/ai-workflows.ts.
 * Emits live status events so the BuildDeliveryDialog can render a real-time
 * tracker (🟢 done, ⏳ active, ⚪ pending, ❌ error).
 *
 * No fake success: NEVER reports ok:true just because the workflow was triggered.
 * A build is only successful when the GitHub Actions run has completed with conclusion=success.
 */

import { BUILD_PIPELINE_STEPS, type BuildPipelineStepId } from '@/config/ai-workflows';
import { githubService } from './githubService';
import { pushProjectWithBuild, downloadProjectAsZip, type BuildTarget } from './projectExportService';
import { supabase } from '@/integrations/supabase/client';
import { createBuildReport, updateBuildReport } from './buildReportsService';

export type StepStatus = 'pending' | 'active' | 'done' | 'error';

export interface PipelineStepState {
  id: BuildPipelineStepId;
  label: string;
  status: StepStatus;
  detail?: string;
  startedAt?: number;
  endedAt?: number;
}

/** Truthful build lifecycle state — never "success" without a completed Actions run. */
export type BuildVerification = 'unverified' | 'pending' | 'success' | 'failure';

export interface PipelineResult {
  ok: boolean;
  steps: PipelineStepState[];
  runUrl?: string;
  repoUrl?: string;
  error?: string;
  /** Real GitHub Actions run id, when one was found. */
  runId?: number;
  /** queued | in_progress | completed, straight from the Actions API. */
  runStatus?: string;
  /** Verified outcome of the run. `pending`/`unverified` means we do NOT claim success. */
  verification?: BuildVerification;
  /** Artifact metadata reported by the Actions API (no download tokens). */
  artifacts?: Array<{ name: string; sizeBytes: number; expired: boolean }>;
}

export interface RunPipelineInput {
  projectName: string;
  files: Array<{ path: string; content: string }>;
  buildTarget: BuildTarget;
  projectId: string;
  onUpdate: (steps: PipelineStepState[]) => void;
  /** Live monitoring hook — fired for every step change and final artifact link. */
  onChat?: (event: {
    kind: 'step' | 'complete' | 'error';
    title: string;
    detail?: string;
    url?: string;
  }) => void;
  /** How long to wait for the Actions run to complete before returning `pending`. */
  verifyTimeoutMs?: number;
}

/**
 * Finds the real Actions run for a push and follows it to completion.
 * Returns `pending` when the run is still going and `unverified` when no run
 * could be observed — never a fabricated success.
 * 
 * Prefers matching by commit SHA for accuracy.
 */
export async function verifyWorkflowRun(
  owner: string,
  repo: string,
  opts: { 
    since: number; 
    timeoutMs?: number; 
    branch?: string; 
    headSha?: string;
    onProgress?: (run: { id: number; status: string }) => void 
  },
): Promise<{
  verification: BuildVerification;
  run?: { id: number; status: string; conclusion: string | null; html_url: string };
  artifacts?: Array<{ name: string; sizeBytes: number; expired: boolean }>;
  error?: string;
}> {
  const timeoutMs = opts.timeoutMs ?? 300_000;
  const deadline = Date.now() + timeoutMs;
  let runId: number | null = null;
  let last: { id: number; status: string; conclusion: string | null; html_url: string } | undefined;

  try {
    // 1. Discover the run created by this push (up to 60s of the budget).
    // Prefer matching by headSha if available for better accuracy.
    const discoverUntil = Math.min(deadline, Date.now() + 60_000);
    while (Date.now() < discoverUntil && runId === null) {
      const { workflow_runs = [] } = await githubService.listWorkflowRuns(owner, repo, {
        branch: opts.branch ?? 'main',
        perPage: 10,
        headSha: opts.headSha,
      });
      
      // If filtering by headSha, the API returns only matching runs
      let match = workflow_runs[0];
      
      // If no headSha, fall back to timestamp-based matching
      if (!match && !opts.headSha) {
        match = workflow_runs.find((r) => new Date(r.created_at).getTime() >= opts.since - 60_000);
      }
      
      if (match) { 
        runId = match.id; 
        last = { id: match.id, status: match.status, conclusion: match.conclusion, html_url: match.html_url }; 
        break; 
      }
      await new Promise((r) => setTimeout(r, 5_000));
    }
    if (runId === null) {
      return { 
        verification: 'unverified', 
        error: opts.headSha 
          ? `No GitHub Actions run was observed for commit ${opts.headSha}.` 
          : 'No GitHub Actions run was observed for this push.' 
      };
    }

    // 2. Follow it to completion.
    while (Date.now() < deadline) {
      const run = await githubService.getWorkflowRun(owner, repo, runId);
      last = { id: run.id, status: run.status, conclusion: run.conclusion, html_url: run.html_url };
      opts.onProgress?.({ id: run.id, status: run.status });
      
      if (run.status === 'completed') {
        if (run.conclusion !== 'success') {
          return { 
            verification: 'failure', 
            run: last, 
            error: `Actions run concluded with status "${run.conclusion}".` 
          };
        }
        let artifacts: Array<{ name: string; sizeBytes: number; expired: boolean }> = [];
        try {
          const res = await githubService.listRunArtifacts(owner, repo, runId);
          artifacts = (res.artifacts || []).map((a) => ({ name: a.name, sizeBytes: a.size_in_bytes, expired: a.expired }));
        } catch { /* artifact listing is best-effort */ }
        return { verification: 'success', run: last, artifacts };
      }
      await new Promise((r) => setTimeout(r, 10_000));
    }
    return { 
      verification: 'pending', 
      run: last, 
      error: 'The Actions run had not finished before the wait timed out.' 
    };
  } catch (e) {
    return {
      verification: last ? 'pending' : 'unverified',
      run: last,
      error: e instanceof Error ? e.message : 'Could not read the Actions run status.',
    };
  }
}

function makeInitialSteps(): PipelineStepState[] {
  return BUILD_PIPELINE_STEPS.map((s) => ({
    id: s.id,
    label: s.label,
    status: 'pending' as StepStatus,
  }));
}

/* ------------------------------------------------------------------ */
/* Bug & security scan — runs before pushing to GitHub                 */
/* ------------------------------------------------------------------ */

export interface ScanFinding {
  file: string;
  severity: 'high' | 'medium' | 'low';
  message: string;
}

const SECRET_PATTERNS: Array<{ re: RegExp; msg: string; sev: ScanFinding['severity'] }> = [
  { re: /sk-[A-Za-z0-9]{20,}/, msg: 'Hardcoded OpenAI-style secret key', sev: 'high' },
  { re: /AIza[0-9A-Za-z_-]{30,}/, msg: 'Hardcoded Google API key', sev: 'high' },
  { re: /ghp_[A-Za-z0-9]{30,}/, msg: 'Hardcoded GitHub PAT', sev: 'high' },
  { re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/, msg: 'Hardcoded JWT / service key', sev: 'high' },
  { re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, msg: 'Embedded private key', sev: 'high' },
];

const CODE_SMELLS: Array<{ re: RegExp; msg: string; sev: ScanFinding['severity'] }> = [
  { re: /\beval\s*\(/, msg: 'Use of eval() is unsafe', sev: 'medium' },
  { re: /new\s+Function\s*\(/, msg: 'new Function() is unsafe', sev: 'medium' },
  { re: /dangerouslySetInnerHTML/, msg: 'dangerouslySetInnerHTML — verify sanitization', sev: 'low' },
];

export function scanFilesForIssues(files: Array<{ path: string; content: string }>): ScanFinding[] {
  const findings: ScanFinding[] = [];
  for (const f of files) {
    if (/\.(png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|mp3|mp4)$/i.test(f.path)) continue;
    const content = f.content || '';
    // Only flag secrets when the file is not obviously an env template
    if (!/\.env\.example|\.md$|README/i.test(f.path)) {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(content)) findings.push({ file: f.path, severity: p.sev, message: p.msg });
      }
    }
    for (const p of CODE_SMELLS) {
      if (p.re.test(content)) findings.push({ file: f.path, severity: p.sev, message: p.msg });
    }
    // Very rough brace balance for JS/TS/JSON
    if (/\.(ts|tsx|js|jsx|json)$/i.test(f.path)) {
      const open = (content.match(/[{[(]/g) || []).length;
      const close = (content.match(/[}\])]/g) || []).length;
      if (Math.abs(open - close) > 2) {
        findings.push({ file: f.path, severity: 'medium', message: `Bracket balance off (${open} open vs ${close} close)` });
      }
    }
  }
  return findings;
}

/* Pull related past decisions from ai_memory_entries via pgvector.
   Best-effort: returns [] if the embedding function isn't wired. */
async function fetchMemoryContext(projectName: string): Promise<string[]> {
  try {
    // We don't compute embeddings client-side; instead ask the DB for the most
    // recent memory summaries for this user so the pipeline logs show real context.
    const { data, error } = await supabase
      .from('ai_memory_entries')
      .select('topic,summary')
      .order('created_at', { ascending: false })
      .limit(5);
    if (error || !data) return [];
    return data
      .filter((r) => r.topic || r.summary)
      .map((r) => `${r.topic || 'memory'}: ${(r.summary || '').slice(0, 120)}`);
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/* Pre-flight validation — Architect                                   */
/* ------------------------------------------------------------------ */

export interface ValidationIssue {
  file: string;
  message: string;
  fixable: boolean;
  fix?: () => void;
}

export function validateProject(
  files: Array<{ path: string; content: string }>,
  target: BuildTarget,
  projectName: string,
): { ok: boolean; issues: ValidationIssue[]; fixedFiles: Array<{ path: string; content: string }> } {
  const issues: ValidationIssue[] = [];
  const fixed = files.map((f) => ({ ...f }));

  // Always need at least one file
  if (fixed.length === 0) {
    issues.push({ file: '(none)', message: 'Project has no files to build.', fixable: false });
    return { ok: false, issues, fixedFiles: fixed };
  }

  // package.json checks for EXE / Web
  const pkgIdx = fixed.findIndex((f) => f.path === 'package.json');
  if (target === 'exe' || target === 'web') {
    if (pkgIdx === -1) {
      // Auto-create a minimal package.json
      fixed.push({
        path: 'package.json',
        content: JSON.stringify(
          {
            name: projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            version: '0.1.0',
            private: true,
            main: target === 'exe' ? 'electron/main.cjs' : 'index.html',
            scripts: { build: 'vite build', start: 'vite' },
          },
          null,
          2,
        ),
      });
      issues.push({
        file: 'package.json',
        message: 'Missing package.json — auto-generated a minimal one.',
        fixable: true,
      });
    } else {
      try {
        const pkg = JSON.parse(fixed[pkgIdx].content);
        if (target === 'exe' && !pkg.main) {
          pkg.main = 'electron/main.cjs';
          fixed[pkgIdx].content = JSON.stringify(pkg, null, 2);
          issues.push({
            file: 'package.json',
            message: 'Missing "main" entry for Electron — set to electron/main.cjs.',
            fixable: true,
          });
        }
        if (!pkg.scripts?.build) {
          pkg.scripts = { ...(pkg.scripts || {}), build: 'vite build' };
          fixed[pkgIdx].content = JSON.stringify(pkg, null, 2);
          issues.push({
            file: 'package.json',
            message: 'Missing "build" script — added "vite build".',
            fixable: true,
          });
        }
      } catch {
        issues.push({
          file: 'package.json',
          message: 'package.json is not valid JSON.',
          fixable: false,
        });
        return { ok: false, issues, fixedFiles: fixed };
      }
    }
  }

  // APK needs capacitor config
  if (target === 'apk') {
    const hasCap = fixed.some((f) => f.path === 'capacitor.config.ts' || f.path === 'capacitor.config.json');
    if (!hasCap) {
      fixed.push({
        path: 'capacitor.config.json',
        content: JSON.stringify(
          {
            appId: `app.tivo.${projectName.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
            appName: projectName,
            webDir: 'dist',
          },
          null,
          2,
        ),
      });
      issues.push({
        file: 'capacitor.config.json',
        message: 'Missing Capacitor config — auto-generated.',
        fixable: true,
      });
    }
  }

  return { ok: true, issues, fixedFiles: fixed };
}

/* ------------------------------------------------------------------ */
/* Pipeline runner                                                     */
/* ------------------------------------------------------------------ */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function runBuildPipeline(input: RunPipelineInput): Promise<PipelineResult> {
  const steps = makeInitialSteps();
  const pipelineStartedAt = Date.now();
  const reportId = await createBuildReport({
    projectName: input.projectName,
    projectId: input.projectId,
    buildTarget: String(input.buildTarget),
  });
  let currentFindings: Array<{ file: string; severity: string; message: string }> = [];
  const setStep = (id: BuildPipelineStepId, patch: Partial<PipelineStepState>) => {
    const idx = steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    steps[idx] = { ...steps[idx], ...patch };
    input.onUpdate([...steps]);
    if (reportId) {
      updateBuildReport(reportId, { steps: [...steps] });
    }
    if (patch.status === 'active' || patch.status === 'done' || patch.status === 'error') {
      input.onChat?.({
        kind: 'step',
        title: `${patch.status === 'done' ? '✅' : patch.status === 'error' ? '❌' : '⏳'} ${steps[idx].label}`,
        detail: patch.detail,
      });
    }
  };

  const finalize = (result: PipelineResult) => {
    if (reportId) {
      updateBuildReport(reportId, {
        status: result.ok ? 'succeeded' : 'failed',
        steps: result.steps,
        findings: currentFindings,
        run_url: result.runUrl ?? null,
        repo_url: result.repoUrl ?? null,
        error: result.error ?? null,
        duration_ms: Date.now() - pipelineStartedAt,
      });
    }
    return result;
  };

  // ZIP shortcut — does not need GitHub
  if (input.buildTarget === ('zip' as BuildTarget)) {
    setStep('validate', { status: 'active', startedAt: Date.now() });
    const { ok, issues, fixedFiles } = validateProject(input.files, 'web', input.projectName);
    if (!ok) {
      setStep('validate', { status: 'error', detail: issues.map((i) => i.message).join('; '), endedAt: Date.now() });
      input.onChat?.({ kind: 'error', title: 'ZIP তৈরি ব্যর্থ', detail: issues.map((i) => i.message).join('; ') });
      return { ok: false, steps, error: 'validation_failed' };
    }
    setStep('validate', { status: 'done', detail: issues.length ? `${issues.length} auto-fixes applied` : 'OK', endedAt: Date.now() });
    setStep('context', { status: 'done', detail: 'Skipped for local ZIP' });
    // Still scan — the ZIP will be shipped to users
    setStep('test', { status: 'active', startedAt: Date.now() });
    const zipFindings = scanFilesForIssues(fixedFiles);
    currentFindings = zipFindings;
    const zipHigh = zipFindings.filter((f) => f.severity === 'high');
    if (zipHigh.length > 0) {
      setStep('test', { status: 'error', detail: zipHigh.map((f) => `${f.file}: ${f.message}`).join('; '), endedAt: Date.now() });
      input.onChat?.({ kind: 'error', title: 'Security scan ব্যর্থ — hardcoded secret পাওয়া গেছে', detail: zipHigh[0].message });
      return finalize({ ok: false, steps, error: 'security_scan_failed' });
    }
    setStep('test', { status: 'done', detail: zipFindings.length ? `${zipFindings.length} low/medium notes` : 'Clean', endedAt: Date.now() });
    setStep('sync', { status: 'active', startedAt: Date.now() });
    await downloadProjectAsZip(input.projectName, fixedFiles);
    setStep('sync', { status: 'done', detail: 'ZIP ready', endedAt: Date.now() });
    setStep('dispatch', { status: 'done', detail: 'Skipped (local ZIP)' });
    setStep('link', { status: 'done', detail: 'Download triggered in browser' });
    input.onChat?.({
      kind: 'complete',
      title: '📦 ZIP ডাউনলোড শুরু হয়েছে',
      detail: `${fixedFiles.length} ফাইল প্যাক করা হয়েছে — ব্রাউজারের Downloads দেখুন।`,
    });
    return finalize({ ok: true, steps });
  }

  // 1. Validate
  setStep('validate', { status: 'active', startedAt: Date.now() });
  await wait(150); // let UI paint
  const validation = validateProject(input.files, input.buildTarget, input.projectName);
  if (!validation.ok) {
    setStep('validate', {
      status: 'error',
      detail: validation.issues.map((i) => i.message).join('; ') || 'Validation failed',
      endedAt: Date.now(),
    });
    input.onChat?.({ kind: 'error', title: 'Validation ব্যর্থ', detail: validation.issues.map((i) => i.message).join('; ') });
    return finalize({ ok: false, steps, error: 'validation_failed' });
  }
  setStep('validate', {
    status: 'done',
    detail: validation.issues.length
      ? `OK — ${validation.issues.length} auto-fix(es) applied`
      : 'OK — no issues',
    endedAt: Date.now(),
  });

  // 2. Context — pgvector memory lookup
  setStep('context', { status: 'active', startedAt: Date.now() });
  const memories = await fetchMemoryContext(input.projectName);
  setStep('context', {
    status: 'done',
    detail: memories.length ? `${memories.length} related memories loaded` : 'No prior context found',
    endedAt: Date.now(),
  });

  // 3. Test — bug & security scan
  setStep('test', { status: 'active', startedAt: Date.now() });
  const findings = scanFilesForIssues(validation.fixedFiles);
  currentFindings = findings;
  const high = findings.filter((f) => f.severity === 'high');
  if (high.length > 0) {
    setStep('test', {
      status: 'error',
      detail: high.slice(0, 3).map((f) => `${f.file}: ${f.message}`).join('; '),
      endedAt: Date.now(),
    });
    input.onChat?.({
      kind: 'error',
      title: '❌ Security scan ব্যর্থ — বিল্ড বন্ধ',
      detail: `${high.length}টি high-severity ইস্যু পাওয়া গেছে। প্রথমটি: ${high[0].file} — ${high[0].message}`,
    });
    return finalize({ ok: false, steps, error: 'security_scan_failed' });
  }
  setStep('test', {
    status: 'done',
    detail: findings.length
      ? `Clean of critical issues (${findings.length} low/medium notes)`
      : 'Clean — no issues found',
    endedAt: Date.now(),
  });

  // 4. Sync — push to GitHub feature branch
  // RECORD BUILD START TIME FOR WORKFLOW RUN DISCOVERY
  const buildStartTime = Date.now();
  setStep('sync', { status: 'active', startedAt: buildStartTime });
  if (!(await githubService.hasToken())) {
    setStep('sync', { status: 'error', detail: 'GitHub token not configured in Settings.', endedAt: Date.now() });
    input.onChat?.({ kind: 'error', title: 'GitHub token নেই', detail: 'Settings → Integrations-এ token যোগ করুন।' });
    return finalize({ ok: false, steps, error: 'no_github_token' });
  }
  let owner: string;
  let repoName: string;
  let commitSha: string | undefined;
  try {
    const user = await githubService.getUser();
    owner = user.login;
    repoName = input.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').slice(0, 60) || `tivo-${input.projectId.slice(0, 8)}`;
    try {
      await githubService.createRepo(repoName, `${input.projectName} — TIVO AI build`, true);
    } catch {
      /* repo may already exist */
    }
    const pushResult = await pushProjectWithBuild(owner, repoName, validation.fixedFiles, input.buildTarget, input.projectName);
    commitSha = pushResult.commitSha;
    setStep('sync', {
      status: 'done',
      detail: `Pushed to ${owner}/${repoName} (main)${commitSha ? ` — commit ${commitSha.slice(0, 7)}` : ''}`,
      endedAt: Date.now(),
    });
  } catch (e) {
    setStep('sync', {
      status: 'error',
      detail: e instanceof Error ? e.message : 'Push failed',
      endedAt: Date.now(),
    });
    input.onChat?.({ kind: 'error', title: 'GitHub push ব্যর্থ', detail: e instanceof Error ? e.message : 'Push failed' });
    return finalize({ ok: false, steps, error: 'sync_failed' });
  }

  // 5. Dispatch — push on main already triggers the workflow on:push.
  // But we now WAIT for actual completion instead of just returning "triggered".
  setStep('dispatch', { status: 'active', startedAt: Date.now() });
  await wait(400);
  const runsUrl = `https://github.com/${owner}/${repoName}/actions`;
  
  input.onChat?.({
    kind: 'step',
    title: '⏳ GitHub Actions build is running...',
    detail: `Waiting for workflow to complete. This may take a few minutes.`,
  });
  
  setStep('dispatch', {
    status: 'done',
    detail: `Workflow triggered (build_type=${input.buildTarget}, project_id=${input.projectId.slice(0, 8)}…) — waiting for completion...`,
    endedAt: Date.now(),
  });

  // 6. Link — NOW: Verify the actual workflow run completion
  setStep('link', { status: 'active', startedAt: Date.now() });
  
  const verificationResult = await verifyWorkflowRun(owner, repoName, {
    since: buildStartTime,
    timeoutMs: input.verifyTimeoutMs ?? 600_000, // default 10 min wait
    branch: 'main',
    headSha: commitSha,
    onProgress: (run) => {
      // Report progress updates to UI
      input.onChat?.({
        kind: 'step',
        title: `⏳ Build is ${run.status}...`,
        detail: `Run ID: ${run.id}`,
      });
    },
  });

  const { verification, run, artifacts, error: verifyError } = verificationResult;

  // Determine final result based on actual verification
  if (verification === 'success') {
    setStep('link', {
      status: 'done',
      detail: `✅ Build completed successfully — Run: ${run?.id}`,
      endedAt: Date.now(),
    });
    input.onChat?.({
      kind: 'complete',
      title: `✅ ${String(input.buildTarget).toUpperCase()} বিল্ড সফলভাবে সম্পন্ন`,
      detail: artifacts && artifacts.length > 0
        ? `${artifacts.length} artifact(s) ready for download`
        : 'Build completed with no artifacts',
      url: run?.html_url,
    });
    return finalize({
      ok: true,
      steps,
      runUrl: run?.html_url ?? runsUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      runId: run?.id,
      runStatus: run?.status,
      verification: 'success',
      artifacts,
    });
  }

  if (verification === 'pending') {
    setStep('link', {
      status: 'done',
      detail: `⏳ Build is still running (timed out waiting). Run: ${run?.id}`,
      endedAt: Date.now(),
    });
    input.onChat?.({
      kind: 'complete',
      title: `⏳ বিল্ড এখনও চলছে`,
      detail: verifyError || 'GitHub Actions run has not completed yet. Check the run page for status.',
      url: run?.html_url ?? runsUrl,
    });
    return finalize({
      ok: false,
      steps,
      error: verifyError ?? 'Build verification timed out',
      runUrl: run?.html_url ?? runsUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      runId: run?.id,
      runStatus: run?.status,
      verification: 'pending',
    });
  }

  if (verification === 'failure') {
    setStep('link', {
      status: 'error',
      detail: `❌ Build failed — Run: ${run?.id}. Conclusion: ${run?.conclusion}`,
      endedAt: Date.now(),
    });
    input.onChat?.({
      kind: 'error',
      title: `❌ বিল্ড ব্যর্থ`,
      detail: verifyError || `GitHub Actions run concluded with: ${run?.conclusion}`,
      url: run?.html_url ?? runsUrl,
    });
    return finalize({
      ok: false,
      steps,
      error: verifyError ?? `Build failed with conclusion: ${run?.conclusion}`,
      runUrl: run?.html_url ?? runsUrl,
      repoUrl: `https://github.com/${owner}/${repoName}`,
      runId: run?.id,
      runStatus: run?.status,
      verification: 'failure',
    });
  }

  // verification === 'unverified'
  setStep('link', {
    status: 'error',
    detail: `❌ Could not verify build status — unable to find or access workflow run`,
    endedAt: Date.now(),
  });
  input.onChat?.({
    kind: 'error',
    title: `❌ বিল্ড যাচাই করা যায়নি`,
    detail: verifyError || 'The GitHub Actions run could not be found or accessed.',
    url: runsUrl,
  });
  return finalize({
    ok: false,
    steps,
    error: verifyError ?? 'Build could not be verified',
    runUrl: runsUrl,
    repoUrl: `https://github.com/${owner}/${repoName}`,
    verification: 'unverified',
  });
}
