import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', '..', rel), 'utf8');

describe('admin-bootstrap hardening', () => {
  const src = read('supabase/functions/admin-bootstrap/index.ts');
  it('is disabled unless ADMIN_BOOTSTRAP_ENABLED=true', () => {
    expect(src).toMatch(/ADMIN_BOOTSTRAP_ENABLED/);
    expect(src).toMatch(/bootstrap_disabled/);
  });
  it('never resets an existing account password', () => {
    expect(src).not.toMatch(/updateUserById/);
    expect(src).toMatch(/already_bootstrapped/);
  });
  it('does not bootstrap allowlisted emails', () => {
    expect(src).not.toMatch(/admin_email_allowlist/);
  });
});

describe('admin-check source of truth', () => {
  const src = read('supabase/functions/admin-check/index.ts');
  it('requires a verified email', () => {
    expect(src).toMatch(/email_confirmed_at/);
  });
  it('demotes a stale persisted admin role', () => {
    expect(src).toMatch(/!isAdminEmail && existing\.role === "admin"[\s\S]*role: "user"/);
    expect(src).not.toMatch(/\(existing\?\.role \|\| "user"\);/);
  });
});

describe('github function authorization', () => {
  const src = read('supabase/functions/github/index.ts');
  const client = read('src/services/githubService.ts');
  it('delete_repo is admin-only with server-checked confirmation', () => {
    expect(src).toMatch(/DESTRUCTIVE_ACTIONS = new Set\(\["delete_repo"\]\)/);
    expect(src).toMatch(/if \(!isAdmin\)[\s\S]*forbidden/);
    expect(src).toMatch(/confirmation_required/);
  });
  it('validates actions and path params', () => {
    expect(src).toMatch(/ALLOWED_ACTIONS/);
    expect(src).toMatch(/validateParams/);
  });
  it('resolves the user GitHub token server-side; client does not read it', () => {
    expect(src).toMatch(/from\("user_secrets"\)[\s\S]*githubToken/);
    expect(client).not.toMatch(/getUserSecretValue/);
  });
});

describe('AuthContext admin cache is UI-only and fails closed', () => {
  const src = read('src/contexts/AuthContext.tsx');
  it('never initialises isAdmin from cache or persists it', () => {
    expect(src).toMatch(/useState\(false\)/);
    expect(src).not.toMatch(/cached\.isAdmin/);
    expect(src).not.toMatch(/JSON\.stringify\(\{ user, isAdmin \}\)/);
  });
  it('does not keep admin when offline', () => {
    expect(src).not.toMatch(/keep the cached role/);
  });
});

describe('github follow-up hardening', () => {
  const src = read('supabase/functions/github/index.ts');
  const client = read('src/services/githubService.ts');
  it('destructive auth uses verified email + ADMIN_EMAIL/allowlist, not profile role', () => {
    expect(src).not.toMatch(/prof\?\.role === "admin"/);
    expect(src).toMatch(/email_confirmed_at/);
    expect(src).toMatch(/ADMIN_EMAIL/);
    expect(src).toMatch(/from\("admin_email_allowlist"\)/);
    expect(src).toMatch(/catch \{ isAdmin = false; \}/);
  });
  it('no shared token fallback; client never reads or sends a token', () => {
    expect(client).not.toMatch(/getSecretValue/);
    expect(client).not.toMatch(/systemSettingsService/);
    expect(client).not.toMatch(/\btoken\b\s*[,}]/);
    expect(src).not.toMatch(/system_settings/);
  });
});
