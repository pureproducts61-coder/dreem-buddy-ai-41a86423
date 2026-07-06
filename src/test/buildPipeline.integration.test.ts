import { describe, it, expect, vi } from 'vitest';
import { scanFilesForIssues, validateProject, runBuildPipeline, type PipelineStepState } from '@/services/buildPipelineService';

// Mock the Supabase client so pipeline can run without a live backend
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: null } }) },
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
      update: () => ({ eq: async () => ({ error: null }) }),
      select: () => ({ order: () => ({ limit: async () => ({ data: [], error: null }) }) }),
      delete: () => ({ in: async () => ({ error: null }) }),
    }),
  },
}));
vi.mock('@/services/githubService', () => ({
  githubService: { hasToken: () => false, getUser: async () => ({ login: 'x' }), createRepo: async () => ({}) },
}));
vi.mock('@/services/projectExportService', () => ({
  pushProjectWithBuild: async () => ({}),
  downloadProjectAsZip: async () => ({}),
}));

describe('buildPipelineService', () => {
  it('scanFilesForIssues detects hardcoded secrets', () => {
    const findings = scanFilesForIssues([
      { path: 'src/leak.ts', content: 'const k = "sk-abcdefghijklmnopqrstuvwxyz1234";' },
    ]);
    expect(findings.some((f) => f.severity === 'high')).toBe(true);
  });

  it('validateProject auto-generates package.json for EXE target', () => {
    const r = validateProject([{ path: 'index.html', content: '<html/>' }], 'exe', 'demo');
    expect(r.ok).toBe(true);
    expect(r.fixedFiles.some((f) => f.path === 'package.json')).toBe(true);
  });

  it('runBuildPipeline fails on missing GitHub token for exe target', async () => {
    const updates: PipelineStepState[][] = [];
    const res = await runBuildPipeline({
      projectName: 'demo',
      projectId: 'p1',
      buildTarget: 'exe',
      files: [{ path: 'index.html', content: '<html/>' }],
      onUpdate: (s) => updates.push(s),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('no_github_token');
    // Should have progressed through validate + context + test before sync fails
    const lastSync = updates.at(-1)?.find((s) => s.id === 'sync');
    expect(lastSync?.status).toBe('error');
  });

  it('runBuildPipeline blocks on high-severity security finding', async () => {
    const chats: string[] = [];
    const res = await runBuildPipeline({
      projectName: 'demo',
      projectId: 'p2',
      buildTarget: 'exe',
      files: [{ path: 'app.ts', content: 'const k = "sk-abcdefghijklmnopqrstuvwxyz1234"' }],
      onUpdate: () => {},
      onChat: (e) => chats.push(e.title),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe('security_scan_failed');
    expect(chats.some((t) => t.includes('Security'))).toBe(true);
  });
});
