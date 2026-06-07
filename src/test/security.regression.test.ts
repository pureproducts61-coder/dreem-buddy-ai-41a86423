import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

describe('XSS sanitization & CSP', () => {
  const bridge = read('src/services/previewBridge.ts');
  const preview = read('src/components/tivo/PreviewTab.tsx');

  it('previewBridge wraps markdown output through DOMPurify before innerHTML', () => {
    expect(bridge).toMatch(/DOMPurify/);
    expect(bridge).toMatch(/window\.DOMPurify[\s\S]*sanitize/);
    expect(bridge).toMatch(/cdn\.jsdelivr\.net\/npm\/dompurify/);
  });

  it('every preview wrapper injects a strict Content-Security-Policy meta tag', () => {
    expect(bridge).toMatch(/PREVIEW_CSP_META/);
    const occurrences = bridge.match(/\$\{PREVIEW_CSP_META\}/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3); // markdown + html + react wrappers
    expect(bridge).toMatch(/default-src 'none'/);
    expect(bridge).toMatch(/object-src 'none'/);
    expect(bridge).toMatch(/frame-ancestors 'self'/);
  });

  it('PreviewTab iframe sandbox excludes allow-same-origin', () => {
    const sandboxMatch = preview.match(/sandbox="([^"]+)"/);
    expect(sandboxMatch, 'iframe must declare sandbox').toBeTruthy();
    expect(sandboxMatch![1]).not.toMatch(/allow-same-origin/);
    expect(sandboxMatch![1]).not.toMatch(/allow-top-navigation/);
    expect(preview).toMatch(/referrerPolicy="no-referrer"/);
  });

  it('PreviewTab injects CSP into blob HTML at load time', () => {
    expect(preview).toMatch(/Content-Security-Policy/);
    expect(preview).toMatch(/default-src 'none'/);
  });
});

describe('RLS enforcement (migration audit)', () => {
  const migDir = resolve(ROOT, 'supabase/migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const allSql = files.map((f) => readFileSync(resolve(migDir, f), 'utf8')).join('\n\n');

  it('every public CREATE TABLE has a matching ENABLE ROW LEVEL SECURITY', () => {
    const creates = [...allSql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)/gi)]
      .map((m) => m[1].toLowerCase());
    const rlsEnabled = new Set(
      [...allSql.matchAll(/alter\s+table\s+public\.([a-z_][a-z0-9_]*)\s+enable\s+row\s+level\s+security/gi)]
        .map((m) => m[1].toLowerCase()),
    );
    const missing = creates.filter((t) => !rlsEnabled.has(t));
    expect(missing, `Tables missing RLS: ${missing.join(', ')}`).toEqual([]);
  });

  it('sensitive tables only expose admin-scoped policies', () => {
    const sensitive = ['system_controls', 'emergency_contacts', 'admin_audit_log', 'admin_email_allowlist'];
    for (const table of sensitive) {
      const policies = [...allSql.matchAll(new RegExp(`create\\s+policy[^;]+on\\s+public\\.${table}[^;]+;`, 'gi'))]
        .map((m) => m[0].toLowerCase());
      for (const pol of policies) {
        const hasGuard = /get_my_role\(\)\s*=\s*'admin'/.test(pol)
          || /user_id\s*=\s*auth\.uid\(\)/.test(pol);
        expect(hasGuard, `policy without admin/owner guard on ${table}: ${pol.slice(0, 120)}`).toBe(true);
      }
    }
  });

  it('audit-log triggers exist for kill switch, approvals, admin replies, emergency contacts, profile changes', () => {
    const expected = [
      'log_kill_switch_change',
      'log_approval_change',
      'log_admin_message_reply',
      'log_emergency_contact_change',
      'log_user_profile_sensitive',
    ];
    for (const fn of expected) {
      expect(allSql.toLowerCase()).toContain(fn.toLowerCase());
    }
  });
});

describe('Realtime channel permissions', () => {
  const migDir = resolve(ROOT, 'supabase/migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const allSql = files.map((f) => readFileSync(resolve(migDir, f), 'utf8')).join('\n\n').toLowerCase();

  it('sensitive tables are explicitly dropped from supabase_realtime publication', () => {
    // Either never added, or explicitly dropped in a later migration.
    for (const table of ['emergency_contacts', 'system_controls']) {
      const added = new RegExp(`alter\\s+publication\\s+supabase_realtime\\s+add\\s+table\\s+public\\.${table}\\b`).test(allSql);
      const dropped = new RegExp(`alter\\s+publication\\s+supabase_realtime\\s+drop\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\b`).test(allSql);
      expect(!added || dropped, `${table} must not remain in supabase_realtime publication`).toBe(true);
    }
  });
});