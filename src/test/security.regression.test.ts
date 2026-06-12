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
    const sensitive = ['system_controls', 'emergency_contacts', 'admin_audit_log', 'admin_email_allowlist', 'system_settings', 'admin_weekly_reports'];
    for (const table of sensitive) {
      const rawPolicies = [...allSql.matchAll(new RegExp(`create\\s+policy\\s+"([^"]+)"[^;]+on\\s+public\\.${table}[^;]+;`, 'gi'))];
      const droppedNames = new Set(
        [...allSql.matchAll(new RegExp(`drop\\s+policy\\s+(?:if\\s+exists\\s+)?"([^"]+)"\\s+on\\s+public\\.${table}`, 'gi'))]
          .map((m) => m[1].toLowerCase()),
      );
      // Keep only the LAST definition of each policy name (later migrations override earlier ones)
      // and drop anything explicitly dropped later.
      const latest = new Map<string, string>();
      for (const m of rawPolicies) latest.set(m[1].toLowerCase(), m[0].toLowerCase());
      for (const name of droppedNames) latest.delete(name);
      for (const pol of latest.values()) {
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
      'log_system_recovery_event',
      'log_system_settings_change',
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

describe('Audit logging integration (migration audit)', () => {
  const migDir = resolve(ROOT, 'supabase/migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const allSql = files.map((f) => readFileSync(resolve(migDir, f), 'utf8')).join('\n\n');
  const lower = allSql.toLowerCase();

  it('approval gate writes to admin_audit_log on every state change', () => {
    expect(lower).toMatch(/create\s+or\s+replace\s+function\s+public\.log_approval_change/);
    // Trigger must be attached to automation_approvals
    expect(lower).toMatch(/create\s+trigger[\s\S]*?on\s+public\.automation_approvals[\s\S]*?execute\s+function\s+public\.log_approval_change/);
  });

  it('emergency contact creation, status change, and admin view are all audited', () => {
    expect(lower).toMatch(/create\s+or\s+replace\s+function\s+public\.log_emergency_contact_change/);
    expect(lower).toMatch(/create\s+or\s+replace\s+function\s+public\.log_emergency_contact_view/);
    expect(lower).toMatch(/emergency_contact\.viewed/);
    expect(lower).toMatch(/emergency_contact\.created/);
  });

  it('kill-switch toggles are recorded with before/after snapshots', () => {
    expect(lower).toMatch(/kill_switch\.toggle/);
    expect(lower).toMatch(/to_jsonb\(old\)[\s\S]*?to_jsonb\(new\)/);
  });

  it('admin → user direct notifications go through the audited RPC', () => {
    expect(lower).toMatch(/create\s+or\s+replace\s+function\s+public\.admin_send_user_notification/);
    expect(lower).toMatch(/admin\.notify_user/);
    // RPC must check admin role before inserting
    expect(lower).toMatch(/admin_send_user_notification[\s\S]*?get_my_role\(\)\s*<>\s*'admin'/);
  });

  it('auth event logger is authenticated-only and rejects oversized events', () => {
    expect(lower).toMatch(/create\s+or\s+replace\s+function\s+public\.log_auth_event/);
    expect(lower).toMatch(/authenticated_only/);
    expect(lower).toMatch(/invalid_event/);
  });
});

describe('RLS coverage for user-owned tables', () => {
  const migDir = resolve(ROOT, 'supabase/migrations');
  const files = readdirSync(migDir).filter((f) => f.endsWith('.sql'));
  const allSql = files.map((f) => readFileSync(resolve(migDir, f), 'utf8')).join('\n\n').toLowerCase();

  it('user_secrets restricts every CRUD action to the owner', () => {
    // SELECT, INSERT, UPDATE, DELETE policies must all scope to auth.uid()
    for (const verb of ['select', 'insert', 'update', 'delete']) {
      const pattern = new RegExp(
        `create\\s+policy\\s+"[^"]+"\\s+on\\s+public\\.user_secrets\\s+for\\s+${verb}[\\s\\S]*?(using|with\\s+check)[\\s\\S]*?user_id\\s*=\\s*auth\\.uid\\(\\)`,
        'i',
      );
      expect(pattern.test(allSql), `user_secrets missing owner-only ${verb.toUpperCase()} policy`).toBe(true);
    }
  });

  it('admin_messages insert is restricted to messages owned by the sender', () => {
    expect(allSql).toMatch(
      /create\s+policy\s+"[^"]+"\s+on\s+public\.admin_messages\s+for\s+insert[\s\S]*?with\s+check[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i,
    );
  });

  it('credit_usage is readable only by the owner', () => {
    expect(allSql).toMatch(
      /create\s+policy\s+"[^"]+"\s+on\s+public\.credit_usage\s+for\s+select[\s\S]*?using[\s\S]*?user_id\s*=\s*auth\.uid\(\)/i,
    );
  });

  it('admin-only RPCs guard with get_my_role() = admin before any mutation', () => {
    const guarded = [
      'admin_send_user_notification',
      'admin_list_user_activity',
      'admin_update_user_access',
      'admin_block_user',
      'admin_unblock_user',
      'admin_list_messages',
      'admin_list_user_projects',
      'log_emergency_contact_view',
    ];
    for (const fn of guarded) {
      const re = new RegExp(`create\\s+or\\s+replace\\s+function\\s+public\\.${fn}[\\s\\S]*?get_my_role\\(\\)\\s*<>\\s*'admin'`, 'i');
      expect(re.test(allSql), `${fn} missing admin guard`).toBe(true);
    }
  });
});