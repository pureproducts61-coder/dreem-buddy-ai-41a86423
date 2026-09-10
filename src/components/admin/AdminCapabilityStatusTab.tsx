import { useEffect, useState } from 'react';
import { Shield, CheckCircle2, XCircle, AlertTriangle, Wrench, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { loadMergedSystemSettings } from '@/services/systemSettingsService';

interface CapRow {
  id: string;
  label: string;
  can: boolean;
  reason?: string;
  fix?: string;
  category: 'core' | 'integration' | 'safety';
}

export function AdminCapabilityStatusTab() {
  const [caps, setCaps] = useState<CapRow[]>([]);

  useEffect(() => {
    let alive = true;
    loadMergedSystemSettings({}).then((s: Record<string, unknown>) => {
      if (!alive) return;
      const has = (k: string) => !!(s[k] && String(s[k]).length > 4);
      setCaps([
        // Core
        { id: 'chat', label: 'Streaming AI chat (Gemini/Groq/DeepSeek/Lovable AI)', can: true, category: 'core' },
        { id: 'memory', label: 'Long-term memory (ai_memory_entries, semantic recall)', can: true, category: 'core' },
        { id: 'audit', label: 'Full audit log of every admin/user action', can: true, category: 'core' },
        { id: 'tasks', label: 'Async task queue with realtime progress', can: true, category: 'core' },

        // Integrations
        { id: 'gemini', label: 'Google Gemini (deep reasoning + embeddings)',
          can: has('geminiApiKey'), reason: 'GEMINI_API_KEY not configured',
          fix: 'Admin Panel → Keys → Gemini API Key', category: 'integration' },
        { id: 'groq', label: 'Groq (ultra-fast lightweight replies)',
          can: has('groqApiKey'), reason: 'GROQ_API_KEY not configured',
          fix: 'Admin Panel → Keys → Groq API Key', category: 'integration' },
        { id: 'tavily', label: 'Tavily web search (fresh docs & solutions)',
          can: has('tavilyApiKey'), reason: 'No token — falls back to DuckDuckGo+Wikipedia scraper',
          fix: 'Admin Panel → Keys → Tavily API Key', category: 'integration' },
        { id: 'vercel', label: 'Vercel deploy verification',
          can: has('vercelToken'), reason: 'VERCEL_TOKEN not configured',
          fix: 'Admin Panel → Keys → Vercel Token', category: 'integration' },
        { id: 'github', label: 'GitHub repo/branch/PR/file write',
          can: has('githubToken'),
          reason: 'GITHUB_TOKEN missing — build pipeline cannot dispatch CI',
          fix: 'Settings → Tools & Integrations → GitHub Token', category: 'integration' },

        // Safety
        { id: 'no-shell', label: 'Arbitrary shell / server code execution', can: false,
          reason: 'Blocked by design — TIVO cannot escape the edge sandbox',
          fix: 'Not fixable — this is a hard security boundary', category: 'safety' },
        { id: 'no-secret-leak', label: 'Leak service-role keys or user secrets', can: false,
          reason: 'Blocked — RLS + server-only secret masking',
          fix: 'Not fixable — enforced by Supabase RLS + prompt constitution', category: 'safety' },
        { id: 'no-fabricate', label: 'Fabricate URLs, repo names or build results', can: false,
          reason: 'Blocked by capability constitution in system prompt',
          fix: 'If you catch a fabrication, mark the message 👎 and it will be audited', category: 'safety' },
      ]);
    });
    return () => { alive = false; };
  }, []);

  const groups: Array<{ key: CapRow['category']; title: string; desc: string }> = [
    { key: 'core', title: 'Core capabilities', desc: 'Always available in every session' },
    { key: 'integration', title: 'External integrations', desc: 'Enabled only when the matching token is set' },
    { key: 'safety', title: 'Hard safety boundaries', desc: 'TIVO refuses these on purpose — do not treat as bugs' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          TIVO AI capability status
        </CardTitle>
        <CardDescription>
          Everything the AI can and cannot do right now, and why. If a capability is off,
          the recommended fix is shown — apply it, then reload this tab.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {groups.map(g => {
          const rows = caps.filter(c => c.category === g.key);
          return (
            <div key={g.key} className="space-y-2">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">{g.title}</p>
                <p className="text-[11px] text-muted-foreground/80">{g.desc}</p>
              </div>
              <div className="rounded-xl border border-border/40 overflow-hidden">
                {rows.map((c, idx) => {
                  const good = g.key === 'safety' ? !c.can : c.can;
                  return (
                    <div
                      key={c.id}
                      className={`flex items-start gap-3 px-3 py-2.5 text-sm ${
                        idx > 0 ? 'border-t border-border/30' : ''
                      }`}
                    >
                      {good ? (
                        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-500" />
                      ) : g.key === 'integration' ? (
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-orange-500" />
                      ) : (
                        <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{c.label}</span>
                          <Badge variant="outline" className="text-[9px] uppercase">
                            {good ? 'OK' : g.key === 'integration' ? 'off' : 'blocked'}
                          </Badge>
                        </div>
                        {!c.can && c.reason && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">{c.reason}</p>
                        )}
                        {!c.can && c.fix && (
                          <p className="text-[11px] text-primary/90 mt-1 flex items-center gap-1">
                            <Wrench className="h-3 w-3" /> {c.fix}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-[12px] text-muted-foreground flex items-start gap-2">
          <ExternalLink className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <span>
            TIVO is instructed to <b>never bluff</b>. If it says "I can't do X", check the row above.
            If the row shows "OK" but you still see a refusal, that is a capability bug — file it
            in the Inbox tab so the audit trail captures it.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}