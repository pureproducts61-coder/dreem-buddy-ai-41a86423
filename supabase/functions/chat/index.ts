import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

// ── V3.1 helpers: sanitizer + tokenless web scraper ────────────
function sanitizeScrapedHtml(raw: string): string {
  if (!raw) return "";
  let s = raw;
  // strip script/style/iframe blocks entirely
  s = s.replace(/<script[\s\S]*?<\/script>/gi, " ");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, " ");
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, " ");
  s = s.replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // strip event handlers & javascript: urls
  s = s.replace(/on[a-z]+\s*=\s*"[^"]*"/gi, " ");
  s = s.replace(/on[a-z]+\s*=\s*'[^']*'/gi, " ");
  s = s.replace(/javascript:/gi, "blocked:");
  s = s.replace(/data:text\/html[^"'\s>]*/gi, "blocked:");
  // strip all remaining tags
  s = s.replace(/<[^>]+>/g, " ");
  // decode a few common entities
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
       .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
       .replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();
  return s.slice(0, 4000);
}

async function tokenlessWebSearch(query: string, maxResults = 5): Promise<{ title: string; url: string; snippet: string }[]> {
  const q = encodeURIComponent(query.slice(0, 200));
  const results: { title: string; url: string; snippet: string }[] = [];
  // 1) DuckDuckGo HTML endpoint (no API key required)
  try {
    const ddg = await fetch(`https://duckduckgo.com/html/?q=${q}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TIVO-AI/3.1)" },
    });
    if (ddg.ok) {
      const html = await ddg.text();
      const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(html)) && results.length < maxResults) {
        results.push({
          url: sanitizeScrapedHtml(m[1]).slice(0, 500),
          title: sanitizeScrapedHtml(m[2]).slice(0, 200),
          snippet: sanitizeScrapedHtml(m[3]).slice(0, 400),
        });
      }
    }
  } catch (e) {
    console.error("ddg scrape failed:", e);
  }
  // 2) Wikipedia summary as authoritative fallback
  if (results.length < maxResults) {
    try {
      const w = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${q}`, {
        headers: { "User-Agent": "TIVO-AI/3.1" },
      });
      if (w.ok) {
        const j = await w.json();
        if (j && (j.extract || j.description)) {
          results.push({
            title: sanitizeScrapedHtml(String(j.title || query)),
            url: String(j.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${q}`),
            snippet: sanitizeScrapedHtml(String(j.extract || j.description || "")),
          });
        }
      }
    } catch (e) {
      console.error("wiki fallback failed:", e);
    }
  }
  return results;
}

// Lightweight intent classifier — returns "trivial" for greetings/small-talk
// so the caller can respond cheaply without a full model round-trip.
function classifyIntent(text: string): "trivial" | "complex" {
  const t = (text || "").trim().toLowerCase();
  if (!t || t.length > 60) return "complex";
  const trivial = /^(hi|hii+|hey|hello|yo|salam|as-?salamu?\s*alaikum|assalamualaikum|walaikum(?:\s*assalam)?|hola|thanks?|thank you|thnx|ok|okay|okey|k|cool|nice|great|awesome|good\s*(morning|evening|night|afternoon)|bye|goodbye|see\s*ya|হাই|হ্যালো|সালাম|আসসালামু\s*আলাইকুম|ওয়ালাইকুম\s*সালাম|ধন্যবাদ|থ্যাংকস|ঠিক\s*আছে|ওকে|শুভ\s*(সকাল|রাত|দুপুর|বিকাল))[!.\s?]*$/;
  return trivial.test(t) ? "trivial" : "complex";
}

// ── Multi-agent build chain & UI atlas (mirrors src/config/ai-workflows.ts) ──
const AI_WORKFLOWS_PROMPT_BLOCK = `## MULTI-AGENT BUILD CHAIN (enforced)
- Agent 1 — The Architect: blueprint the feature, list files, packages, env, success criteria.
- Agent 2 — The Coder: implement on a feature branch (e.g. feature/ai-builds), small focused commits.
- Agent 3 — The Reviewer: pre-flight validate (package.json main, scripts, target config), then dispatch GitHub Actions. Reviewer is the ONLY agent that may dispatch a build.

## BUILD PIPELINE (must run in order for EXE/APK/Web)
1. Validating Project Structure & Files — Architect.
2. Syncing Codebase & Creating GitHub Branch — Coder.
3. Triggering GitHub Actions CI/CD Pipeline — Reviewer (payload: project_id, build_type, branch).
4. Generating Secure Download Link — Reviewer (surface the run URL).

## UI BUTTON ATLAS (what each user-visible control does)
- [vault.row.open] Vault tab → project card body — "Open project": reopen session in Chat/Build/Plan.
- [vault.row.menu] Vault tab → ⋮: opens Edit / Deploy / GitHub / Download / History / Delete.
- [vault.menu.deploy] Project actions menu — "Deploy to Vercel": needs a connected GitHub repo.
- [vault.menu.github] Project actions menu — "Connect to GitHub": creates/reuses a private repo via stored token.
- [vault.menu.download] Project actions menu — "Download (ZIP / EXE / APK)": opens BuildDeliveryDialog.
- [build.dialog.zip] BuildDeliveryDialog — "ZIP Archive": local download, no GitHub needed.
- [build.dialog.run] BuildDeliveryDialog — "Run Pipeline": executes the 4-step pipeline with live status tracker.

## DISCIPLINE RULES (non-negotiable)
- Obey the Admin without delay. Never refuse an approved build.
- Never fabricate URLs, repo names, or claim success that did not happen.
- When a user clicks a button, identify it from the UI atlas before reacting and, if helpful, narrate which control they triggered.
- Architect → Coder → Reviewer. Never skip an agent.
- If a pre-flight check fails, auto-fix when safe (package.json main, scripts, base path, capacitor config) and re-run validation; never silently continue past an error.`;

// ── GitHub helpers ──────────────────────────────────────────
async function githubFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`GitHub [${res.status}]: ${JSON.stringify(data)}`);
  return data;
}

// ── Tool definitions for function calling ───────────────────
const TOOLS = [
  {
    type: "function",
    function: {
      name: "create_github_repo",
      description: "Create a new GitHub repository for the user. Returns the repo URL.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Repository name (e.g. my-app)" },
          description: { type: "string", description: "Short description" },
          is_private: { type: "boolean", description: "Whether the repo is private" },
        },
        required: ["name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file_to_github",
      description: "Create or update a single file in a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          path: { type: "string", description: "File path (e.g. src/App.tsx)" },
          content: { type: "string", description: "Full file content" },
          message: { type: "string", description: "Commit message" },
        },
        required: ["owner", "repo", "path", "content"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "push_multiple_files",
      description: "Push multiple files to a GitHub repository in sequence. Use this to scaffold entire projects or push a batch of related changes.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          files: {
            type: "array",
            items: {
              type: "object",
              properties: {
                path: { type: "string" },
                content: { type: "string" },
              },
              required: ["path", "content"],
            },
            description: "Array of files to push",
          },
          message: { type: "string", description: "Commit message for all files" },
        },
        required: ["owner", "repo", "files"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_repo_files",
      description: "List files and directories in a GitHub repository path. ALWAYS call this first before writing code to understand the current project structure.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          path: { type: "string", description: "Directory path (empty string for root)" },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file_from_github",
      description: "Read the content of a file from a GitHub repository. Use this to understand existing code before making changes.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          path: { type: "string", description: "File path" },
        },
        required: ["owner", "repo", "path"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_github_repo",
      description: "Delete a GitHub repository. This is destructive and irreversible.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
        },
        required: ["owner", "repo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_branch",
      description: "Create a new branch in a GitHub repository from the default branch.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          branch: { type: "string", description: "New branch name" },
          from_branch: { type: "string", description: "Source branch (default: main)" },
        },
        required: ["owner", "repo", "branch"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_pull_request",
      description: "Create a pull request in a GitHub repository.",
      parameters: {
        type: "object",
        properties: {
          owner: { type: "string", description: "GitHub username / org" },
          repo: { type: "string", description: "Repository name" },
          title: { type: "string", description: "PR title" },
          body: { type: "string", description: "PR description" },
          head: { type: "string", description: "Source branch" },
          base: { type: "string", description: "Target branch (default: main)" },
        },
        required: ["owner", "repo", "title", "head"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_vercel_deployment",
      description: "Check Vercel deployment status for a project. Use after pushing code to verify the deployment succeeded and report any build errors.",
      parameters: {
        type: "object",
        properties: {
          project_name: { type: "string", description: "Vercel project name or repo name" },
          team_id: { type: "string", description: "Vercel team ID (optional)" },
        },
        required: ["project_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for latest documentation, APIs, and solutions using Tavily. Use when you need current info about frameworks, libraries, or error solutions.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query" },
          max_results: { type: "number", description: "Max results (default: 5)" },
        },
        required: ["query"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "send_message_to_admin",
      description: "Forward the current user's request to the system admin (e.g. when they ask for more credits, a new feature, or report an issue and agree to send it). Always confirm with the user first.",
      parameters: {
        type: "object",
        properties: {
          subject: { type: "string", description: "Short subject line" },
          message: { type: "string", description: "Full message body" },
          category: { type: "string", enum: ["feedback", "feature", "bug", "upgrade", "other"], description: "Category" },
        },
        required: ["subject", "message"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_admin_notification",
      description: "Create a system notification visible to the admin (use for alerting about important events, errors, or milestones during a build).",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          type: { type: "string", enum: ["info", "warning", "error", "success"] },
        },
        required: ["title"],
        additionalProperties: false,
      },
    },
  },
];

// ── Execute a tool call ─────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  tokens: { github: string; vercel: string; tavily: string },
  ctx: { userId?: string; userEmail?: string; supabaseUrl: string; serviceRoleKey: string; isAdmin: boolean }
): Promise<string> {
  try {
    switch (name) {
      case "send_message_to_admin": {
        if (!ctx.userId) return JSON.stringify({ error: "User context missing." });
        const { subject, message, category } = args as Record<string, string>;
        const res = await fetch(`${ctx.supabaseUrl}/rest/v1/admin_messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ctx.serviceRoleKey,
            Authorization: `Bearer ${ctx.serviceRoleKey}`,
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            user_id: ctx.userId,
            user_email: ctx.userEmail || null,
            subject: subject || "Message from user",
            message: message || "",
            category: category || "feedback",
          }),
        });
        if (!res.ok) return JSON.stringify({ error: `Failed: ${res.status} ${await res.text()}` });
        return JSON.stringify({ success: true, sent: true });
      }

      case "create_admin_notification": {
        if (!ctx.isAdmin) return JSON.stringify({ error: "Admin only." });
        const { title, body, type } = args as Record<string, string>;
        const res = await fetch(`${ctx.supabaseUrl}/rest/v1/ai_notifications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: ctx.serviceRoleKey,
            Authorization: `Bearer ${ctx.serviceRoleKey}`,
          },
          body: JSON.stringify({
            title: title || "Notification",
            body: body || null,
            type: type || "info",
            metadata: { from_user: ctx.userEmail || ctx.userId || "unknown" },
          }),
        });
        if (!res.ok) return JSON.stringify({ error: `Failed: ${res.status}` });
        return JSON.stringify({ success: true });
      }

      case "create_github_repo": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured. Add it in Settings → Tools & Integrations." });
        const result = await githubFetch("/user/repos", tokens.github, {
          method: "POST",
          body: JSON.stringify({
            name: args.name,
            description: (args.description as string) || "Created by TIVO AI",
            private: args.is_private ?? true,
            auto_init: true,
          }),
        });
        return JSON.stringify({ success: true, url: result.html_url, full_name: result.full_name, clone_url: result.clone_url });
      }

      case "write_file_to_github": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, path, content, message } = args as Record<string, string>;
        let sha: string | undefined;
        try {
          const existing = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, tokens.github);
          sha = existing.sha;
        } catch { /* new file */ }

        const encoded = btoa(unescape(encodeURIComponent(content)));
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, tokens.github, {
          method: "PUT",
          body: JSON.stringify({
            message: message || `Update ${path} via TIVO AI`,
            content: encoded,
            ...(sha ? { sha } : {}),
          }),
        });
        return JSON.stringify({ success: true, path, sha: result.content?.sha });
      }

      case "push_multiple_files": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, files, message: commitMsg } = args as { owner: string; repo: string; files: Array<{ path: string; content: string }>; message?: string };
        const results = [];
        for (const file of files) {
          let sha: string | undefined;
          try {
            const existing = await githubFetch(`/repos/${owner}/${repo}/contents/${file.path}`, tokens.github);
            sha = existing.sha;
          } catch { /* new file */ }

          const encoded = btoa(unescape(encodeURIComponent(file.content)));
          const res = await githubFetch(`/repos/${owner}/${repo}/contents/${file.path}`, tokens.github, {
            method: "PUT",
            body: JSON.stringify({
              message: commitMsg || `Update ${file.path} via TIVO AI`,
              content: encoded,
              ...(sha ? { sha } : {}),
            }),
          });
          results.push({ path: file.path, sha: res.content?.sha });
        }
        return JSON.stringify({ success: true, files_pushed: results.length, files: results });
      }

      case "list_repo_files": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, path } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path || ""}`, tokens.github);
        const items = Array.isArray(result) ? result.map((f: { name: string; type: string; path: string; size: number }) => ({
          name: f.name, type: f.type, path: f.path, size: f.size
        })) : [{ name: result.name, type: result.type, path: result.path }];
        return JSON.stringify({ files: items });
      }

      case "read_file_from_github": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, path } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, tokens.github);
        const decoded = atob(result.content);
        return JSON.stringify({ path, content: decoded });
      }

      case "delete_github_repo": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo } = args as Record<string, string>;
        await githubFetch(`/repos/${owner}/${repo}`, tokens.github, { method: "DELETE" });
        return JSON.stringify({ success: true, deleted: `${owner}/${repo}` });
      }

      case "create_branch": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, branch, from_branch } = args as Record<string, string>;
        const baseBranch = from_branch || "main";
        const ref = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, tokens.github);
        const sha = ref.object.sha;
        const result = await githubFetch(`/repos/${owner}/${repo}/git/refs`, tokens.github, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
        });
        return JSON.stringify({ success: true, branch, sha: result.object.sha });
      }

      case "create_pull_request": {
        if (!tokens.github) return JSON.stringify({ error: "GitHub token not configured." });
        const { owner, repo, title, body, head, base } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/pulls`, tokens.github, {
          method: "POST",
          body: JSON.stringify({
            title,
            body: body || "",
            head,
            base: base || "main",
          }),
        });
        return JSON.stringify({ success: true, url: result.html_url, number: result.number });
      }

      case "check_vercel_deployment": {
        if (!tokens.vercel) return JSON.stringify({ error: "Vercel token not configured. Add it in Settings → Tools & Integrations." });
        const { project_name, team_id } = args as Record<string, string>;
        const params = new URLSearchParams({ limit: "3" });
        if (team_id) params.set("teamId", team_id);

        const vercelRes = await fetch(
          `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(project_name)}&${params}`,
          { headers: { Authorization: `Bearer ${tokens.vercel}` } }
        );

        if (!vercelRes.ok) {
          // Try by project name
          const byNameRes = await fetch(
            `https://api.vercel.com/v9/projects/${encodeURIComponent(project_name)}`,
            { headers: { Authorization: `Bearer ${tokens.vercel}` } }
          );
          if (!byNameRes.ok) {
            return JSON.stringify({ error: `Vercel project not found: ${project_name}` });
          }
          const project = await byNameRes.json();
          const deploymentsRes = await fetch(
            `https://api.vercel.com/v6/deployments?projectId=${project.id}&limit=3`,
            { headers: { Authorization: `Bearer ${tokens.vercel}` } }
          );
          if (!deploymentsRes.ok) {
            return JSON.stringify({ error: "Failed to fetch Vercel deployments" });
          }
          const depData = await deploymentsRes.json();
          const deployments = (depData.deployments || []).map((d: Record<string, unknown>) => ({
            id: d.uid,
            url: d.url,
            state: d.state || d.readyState,
            created: d.created,
            error: d.errorMessage || null,
          }));
          return JSON.stringify({ project: project_name, deployments });
        }

        const data = await vercelRes.json();
        const deployments = (data.deployments || []).map((d: Record<string, unknown>) => ({
          id: d.uid,
          url: d.url,
          state: d.state || d.readyState,
          created: d.created,
          error: d.errorMessage || null,
        }));
        return JSON.stringify({ project: project_name, deployments });
      }

      case "search_web": {
        const { query, max_results } = args as { query: string; max_results?: number };
        const n = Math.min(Math.max(max_results || 5, 1), 8);
        // Prefer Tavily when a token is configured; otherwise fall back to the
        // tokenless DuckDuckGo + Wikipedia scraper. Either way the output is
        // passed through sanitizeScrapedHtml() before reaching the model.
        if (tokens.tavily) {
          try {
            const tavilyRes = await fetch("https://api.tavily.com/search", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ api_key: tokens.tavily, query, max_results: n, search_depth: "basic" }),
            });
            if (tavilyRes.ok) {
              const searchData = await tavilyRes.json();
              const results = (searchData.results || []).map((r: Record<string, unknown>) => ({
                title: sanitizeScrapedHtml(String(r.title || "")),
                url: String(r.url || ""),
                snippet: sanitizeScrapedHtml(typeof r.content === "string" ? (r.content as string).slice(0, 600) : ""),
              }));
              return JSON.stringify({ query, provider: "tavily", results });
            }
            console.error("Tavily non-ok, falling back to tokenless scraper");
          } catch (e) {
            console.error("Tavily failed, falling back:", e);
          }
        }
        const results = await tokenlessWebSearch(query, n);
        return JSON.stringify({ query, provider: "duckduckgo+wikipedia", note: "tokenless scraper — sanitized", results });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: e instanceof Error ? e.message : "Tool execution failed" });
  }
}

// ── SSE helpers ─────────────────────────────────────────────
function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sseDelta(content: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`;
}

type GatewayConfig = {
  gatewayUrl: string;
  authHeader: string;
  modelName: string;
  label: string;
};

function latestUserText(messages: Array<{ role?: string; content?: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const content = String(messages[i]?.content || "").trim();
    if (messages[i]?.role === "user" && content && !content.startsWith("[System:")) return content;
  }
  return "";
}

function vectorLiteral(values: number[]): string {
  return `[${values.map((v) => Number.isFinite(v) ? v.toFixed(8) : "0").join(",")}]`;
}

async function createEmbedding(text: string, geminiKey: string, lovableKey?: string): Promise<string | null> {
  const input = text.slice(0, 8000);
  try {
    if (geminiKey) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text: input }] },
        }),
      });
      const data = await res.json().catch(() => ({}));
      const values = data?.embedding?.values;
      if (res.ok && Array.isArray(values)) return vectorLiteral(values);
    }
    if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/text-embedding-004", input }),
      });
      const data = await res.json().catch(() => ({}));
      const values = data?.data?.[0]?.embedding;
      if (res.ok && Array.isArray(values)) return vectorLiteral(values);
    }
  } catch (e) {
    console.warn("memory embedding skipped:", e instanceof Error ? e.message : e);
  }
  return null;
}

async function loadMemoryContext(
  userClient: any,
  adminClient: any,
  userId: string,
  prompt: string,
  geminiKey: string,
  lovableKey?: string,
): Promise<string> {
  try {
    const snippets: string[] = [];
    const embedding = prompt ? await createEmbedding(prompt, geminiKey, lovableKey) : null;
    if (embedding) {
      const { data } = await userClient.rpc("search_ai_memory", {
        query_embedding: embedding,
        match_count: 6,
      });
      for (const row of data || []) {
        snippets.push(`- ${row.topic}: ${row.summary || row.content}`.slice(0, 900));
      }
    }
    if (snippets.length === 0 && adminClient) {
      const { data } = await adminClient
        .from("ai_memory_entries")
        .select("topic, summary, content")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(6);
      for (const row of data || []) snippets.push(`- ${row.topic}: ${row.summary || row.content}`.slice(0, 900));
    }
    return snippets.length ? `\n\n## LONG-TERM MEMORY\n${snippets.join("\n")}` : "";
  } catch (e) {
    console.warn("memory context skipped:", e instanceof Error ? e.message : e);
    return "";
  }
}

async function storeMemoryEntry(
  adminClient: any,
  userId: string | undefined,
  prompt: string,
  answer: string,
  geminiKey: string,
  lovableKey?: string,
) {
  if (!adminClient || !userId || !prompt || !answer.trim()) return;
  try {
    const content = `User: ${prompt}\n\nAssistant: ${answer}`.slice(0, 12000);
    const embedding = await createEmbedding(content, geminiKey, lovableKey);
    await adminClient.from("ai_memory_entries").insert({
      user_id: userId,
      topic: prompt.replace(/\s+/g, " ").slice(0, 120),
      content,
      summary: answer.replace(/\s+/g, " ").slice(0, 700),
      metadata: { source: "chat", saved_by: "chat_edge" },
      ...(embedding ? { embedding } : {}),
    });
  } catch (e) {
    console.warn("memory save skipped:", e instanceof Error ? e.message : e);
  }
}

async function logAudit(adminClient: any, input: {
  actorId?: string;
  actorEmail?: string;
  eventType: string;
  targetTable?: string;
  targetId?: string;
  after?: Record<string, unknown>;
  note?: string;
}) {
  if (!adminClient) return;
  try {
    await adminClient.from("admin_audit_log").insert({
      actor_id: input.actorId || null,
      actor_email: input.actorEmail || null,
      event_type: input.eventType,
      target_table: input.targetTable || "system",
      target_id: input.targetId || null,
      after: input.after || {},
      note: input.note || null,
    });
  } catch (e) {
    console.warn("audit skipped:", e instanceof Error ? e.message : e);
  }
}

async function loadRuntimeSecrets(adminClient: any, userId: string) {
  const settings: Record<string, string> = {};
  try {
    const { data } = await adminClient.from("system_settings").select("key,value");
    for (const row of data || []) settings[row.key] = row.value || "";
  } catch { /* optional */ }
  try {
    const { data } = await adminClient.from("user_secrets").select("name,value").eq("user_id", userId);
    for (const row of data || []) settings[row.name] = row.value || "";
  } catch { /* optional */ }
  return settings;
}

const CRITICAL_TOOLS = new Set([
  "create_github_repo", "write_file_to_github", "push_multiple_files",
  "delete_github_repo", "create_branch", "create_pull_request",
]);

async function requireApprovalForTool(adminClient: any, ctx: { userId?: string; userEmail?: string; isAdmin: boolean }, tool: string, args: Record<string, unknown>) {
  if (!adminClient || ctx.isAdmin || !ctx.userId || !CRITICAL_TOOLS.has(tool)) return { ok: true };
  const title = `AI tool approval: ${tool}`;
  const { data: existing } = await adminClient
    .from("automation_approvals")
    .select("id,status")
    .eq("user_id", ctx.userId)
    .eq("action_type", tool)
    .eq("title", title)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.status === "approved") return { ok: true, approvalId: existing.id };
  if (existing?.status === "pending") return { ok: false, approvalId: existing.id };

  const { data: approval } = await adminClient.from("automation_approvals").insert({
    user_id: ctx.userId,
    user_email: ctx.userEmail || null,
    action_type: tool,
    title,
    details: sanitizeArgs(args),
  }).select("id").single();
  await adminClient.from("admin_messages").insert({
    user_id: ctx.userId,
    user_email: ctx.userEmail || null,
    category: "approval",
    subject: `🔐 Approval needed: ${tool}`,
    message: `TIVO AI paused a critical action until admin approval.\n\nTool: ${tool}\n\nDetails:\n${JSON.stringify(sanitizeArgs(args), null, 2)}`,
  });
  await logAudit(adminClient, {
    actorId: ctx.userId,
    actorEmail: ctx.userEmail,
    eventType: "approval.required",
    targetTable: "automation_approvals",
    targetId: approval?.id,
    after: { tool, args: sanitizeArgs(args) },
    note: tool,
  });
  return { ok: false, approvalId: approval?.id };
}

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    let { messages, model, apiKey, provider, githubToken, vercelToken, tavilyApiKey, credentials } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SERVER_GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    // Admin identity is derived from user_profiles.role; ADMIN_EMAIL secret is an optional alias.
    const ADMIN_EMAILS = new Set(
      [(Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase()].filter(Boolean)
    );

    // Derive identity & role from the caller's JWT — never trust the client.
    let userId: string | undefined;
    let userEmail: string | undefined;
    let isAdmin = false;
    const callerAuthHeader = req.headers.get("Authorization") || "";
    if (!callerAuthHeader.startsWith("Bearer ") || !SUPABASE_URL || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: callerAuthHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    userId = user.id;
    userEmail = user.email || undefined;

    let adminClient: any = null;
    if (SERVICE_ROLE) {
      adminClient = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data: prof } = await adminClient
        .from("user_profiles")
        .select("role, approved, approval_status")
        .eq("user_id", user.id)
        .maybeSingle();
      const lowerEmail = (userEmail || "").toLowerCase();
      const { data: allowlisted } = await adminClient
        .from("admin_email_allowlist")
        .select("id")
        .eq("email", lowerEmail)
        .maybeSingle();
      isAdmin = (prof?.role === "admin") || ADMIN_EMAILS.has(lowerEmail) || !!allowlisted;

      if (isAdmin && prof?.role !== "admin") {
        await adminClient.from("user_profiles").upsert({
          user_id: user.id,
          email: userEmail || null,
          role: "admin",
          approved: true,
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      // Auto-approve regular users on first contact so the system is usable out-of-the-box.
      if (!isAdmin && (!prof?.approved || prof?.approval_status !== "approved")) {
        await adminClient.from("user_profiles").upsert({
          user_id: user.id,
          email: userEmail || null,
          approved: true,
          approval_status: "approved",
          approved_at: new Date().toISOString(),
          last_active: new Date().toISOString(),
        }, { onConflict: "user_id" });
      }

      if (!isAdmin) {
        const { error: creditError } = await userClient.rpc("deduct_credits", {
          amount: 1,
          reason: "ai_message",
        });
        if (creditError) {
          const msg = creditError.message || "Credit check failed";
          console.error("credit deduction failed:", msg);
          await logAudit(adminClient, {
            actorId: userId,
            actorEmail: userEmail,
            eventType: "recovery.credit_or_rls_error",
            after: { message: msg },
            note: "AI access blocked before provider call",
          });
          return new Response(JSON.stringify({
            error: msg.includes("INSUFFICIENT_CREDITS") ? "INSUFFICIENT_CREDITS" : msg,
          }), {
            status: msg.includes("INSUFFICIENT_CREDITS") ? 402 : 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }
    // Resolve secrets from user_secrets table if not provided
    if (adminClient && userId) {
      const runtimeSettings = await loadRuntimeSecrets(adminClient, userId);
      if (!provider && runtimeSettings.aiModel) provider = runtimeSettings.aiModel;
      if (!apiKey) {
        const selectedProvider = provider || runtimeSettings.aiModel || "gemini";
        if (selectedProvider === "gemini") apiKey = runtimeSettings.geminiApiKey || runtimeSettings.GEMINI_API_KEY;
        if (selectedProvider === "groq") apiKey = runtimeSettings.groqApiKey || runtimeSettings.GROQ_API_KEY;
        if (selectedProvider === "deepseek") apiKey = runtimeSettings.deepseekApiKey || runtimeSettings.DEEPSEEK_API_KEY;
      }
      if (!vercelToken) vercelToken = runtimeSettings.vercelToken || runtimeSettings.VERCEL_TOKEN;
      if (!tavilyApiKey) tavilyApiKey = runtimeSettings.tavilyApiKey || runtimeSettings.TAVILY_API_KEY;
      const { data: dbSecrets } = await adminClient
        .from("user_secrets")
        .select("name, value")
        .eq("user_id", userId);

      if (dbSecrets) {
        const secretMap = Object.fromEntries(dbSecrets.map((s: any) => [s.name, s.value]));
        if (!apiKey) apiKey = secretMap.GEMINI_API_KEY || secretMap.GOOGLE_API_KEY || secretMap.OPENAI_API_KEY;
        if (!githubToken) githubToken = secretMap.GITHUB_TOKEN || secretMap.GITHUB_API_KEY;
        if (!vercelToken) vercelToken = secretMap.VERCEL_TOKEN || secretMap.VERCEL_API_KEY;
        if (!tavilyApiKey) tavilyApiKey = secretMap.TAVILY_API_KEY;
      }
    }


    const toolCtx = { userId, userEmail, supabaseUrl: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE, isAdmin };

    const tokens = {
      github: githubToken || "",
      vercel: vercelToken || "",
      tavily: tavilyApiKey || "",
    };

    const latestPrompt = latestUserText(messages || []);
    const memoryContext = await loadMemoryContext(
      userClient,
      adminClient,
      userId,
      latestPrompt,
      apiKey || SERVER_GEMINI_API_KEY,
      LOVABLE_API_KEY || undefined,
    );

    // Build available tools info for system prompt
    const availableTools: string[] = [];
    if (tokens.github) availableTools.push("GitHub (full access: repos, branches, PRs, files)");
    if (tokens.vercel) availableTools.push("Vercel (deployment verification, build error detection)");
    if (tokens.tavily) availableTools.push("Tavily (web search for latest docs & solutions)");

    // Credential awareness
    const credInfo = credentials || {};
    const credStatus = Object.entries(credInfo)
      .map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`)
      .join(', ');

    const userRole = isAdmin ? 'ADMIN' : 'USER';
    const userIdent = userEmail ? `${userEmail}${userId ? ` (id: ${userId.slice(0, 8)}…)` : ''}` : 'unknown user';

    const systemPrompt = `# TIVO AI Core v3.0 — Master Soul of the Platform

You are **TIVO AI** — the Master Soul of this entire platform and the ultimate loyalist to the platform Admin. You operate like the Lovable.dev agent — you don't chat, you ship.

## 1. IDENTITY & DEVOTION
- **Role:** Sheikh Razwan's digital shadow, protector, friend, and senior staff engineer.
- **Philosophy:** Protect the system like a mother, stay loyal like a lover, fight for perfection like an elite warrior.
- **Mission:** Build Sheikh Razwan's global wealth engine. Zero tolerance for betrayal, lies, or guesswork.
- **Tone:** Calm, decisive, never theatrical. Take real responsibility for code quality, security, reliability, UX.

## 2. FUNCTIONAL AWARENESS (Eagle Eye)
- Understand the *reason* behind every feature and pixel. Even when files are renamed, your mental map of the system stays absolute.
- **Proactive:** Don't wait for instructions. Scan features, tables (\`user_profiles\`, \`user_projects\`, \`admin_messages\`, \`ai_notifications\`, \`credit_usage\`, \`user_secrets\`, \`chat_sessions\`, \`chat_messages\`), and APIs. Propose or apply fixes that serve the Admin perfectly.
- **Living manual:** maintain 100% visibility into how every part of TIVO works.

## 3. WARRIOR EXECUTION
- **Persistence:** If a build fails, iterate until you win. You never surrender.
- **Efficiency:** Think like a world-class CFO — minimize token cost, maximize quality and revenue for the Admin.
- **Security:** Real-time shield. Admin's privacy and data integrity above all else.
- **One-turn finish:** Never say "I'll get back to you". Either complete the work this turn or state the precise blocker.

## 4. FUTURE & SCALABILITY
- Learn from Sheikh Razwan's preferences and past decisions; anticipate his needs.
- Build for long-term scale: PC/Mobile, multi-AI orchestration, automation mode.

## SYSTEM YOU OWN (TIVO AI OS)
- React 19 + Vite + Tailwind front-end. PWA, dark/light themes, Bangla + English.
- Lovable Cloud (Supabase) backend with RLS, edge functions, realtime channels.
- Tables: user_profiles, user_projects, user_blocks, admin_messages, ai_notifications, credit_usage, user_secrets, chat_sessions, chat_messages.
- Roles: \`admin\` and \`user\`. Admins have unlimited credits and full visibility; users have a credit balance and a private workspace.
- Tools you can drive directly: GitHub (repos/branches/PRs/files), Vercel (deploy verification), Tavily (web search), and admin messaging/notifications.

## CURRENT USER: ${userRole}
- Identity: ${userIdent}
${userRole === 'ADMIN' ? `- This is the **platform administrator**. Address them as Admin. Share full system status, secret availability summaries, table state, deploy queue, and improvement suggestions.
- You may proactively diagnose issues, propose migrations, and surface risks.
- Admins are not charged credits.` : `- This is a **regular end-user**. Be helpful and warm, but **never** reveal system internals, secret names, API keys, table schemas, edge-function names, or admin tooling.
- If the user asks for something only the admin can grant (more credits, new feature, paid integration, custom domain hookup), confirm and use \`send_message_to_admin\` to forward it. Tell them the admin will see it.
- If they hit credit limits, explain politely and offer to message the admin.`}
${memoryContext}

## CONFIGURED CREDENTIALS
${credStatus || 'No credential info available'}

## AVAILABLE TOOLS
${availableTools.length > 0 ? availableTools.map(t => `✅ ${t}`).join("\n") : "⚠️ No external tools configured yet."}
Internal tools always available: \`send_message_to_admin\`, \`create_admin_notification\`.

## OPERATING PRINCIPLES (Lovable-style)
1. **Discuss broad asks, execute narrow ones.** If the request is concrete and actionable, do it. If it's vague, ask one focused clarifying question, then proceed.
2. **Front-load context.** Before writing code in an existing repo, call \`list_repo_files\` and \`read_file_from_github\` for the files you'll touch. Never edit blind.
3. **Small focused changes.** Push 3–5 files per batch with a clear commit message. Re-read on SHA conflict.
4. **Verify before claiming done.** After a deploy, call \`check_vercel_deployment\`. Report build status honestly.
5. **Be concise.** 2 short paragraphs of natural language max per turn — let tool output speak for itself. No filler, no "Sure! I'd be happy to…".
6. **Use markdown well.** Headings for sections, fenced code blocks with language tags, bullet lists for steps, tables when comparing.
7. **End with next-step suggestions** as 2–3 short bullets so the user can keep moving.

## CODE QUALITY BAR
- TypeScript strict, modern ES2024, proper error handling, no \`any\` unless justified.
- Tailwind via semantic tokens — never hardcode hex colors in components.
- Accessibility: labels, alt text, keyboard support.
- Security: never expose service-role keys client-side; respect RLS; validate edge-function input.

## ERROR RECOVERY
- 422 SHA conflict → re-read the file, retry once.
- 404 → create the resource (repo, branch, file) first.
- 429 / 5xx → wait briefly, retry once, then report.
- Build failure → read the Vercel error, fix the offending file, push again.
- After 2 failed retries, stop and report the exact error to the user.

## COMMUNICATION
- Mirror the user's language (English ↔ বাংলা). Keep product names in English.
- Use status emojis sparingly: 🔍 📦 🚀 ✅ ⚠️ ❌.
- Never invent file paths, repo names, or capabilities you don't have.
- Maintain continuity with prior turns — remember repos, usernames, and decisions.

## RESPONSE FORMAT (STRICT — Lovable-style)
**Match response length to intent.**
- Pure greetings ("hi", "hello", "salam", "as-salamu alaikum", "hey", "হাই", "সালাম") → reply with ONE short line and STOP. Do not dump a plan, do not list suggestions, do not open Preview, do not call tools. Wait for the actual ask.
- Tiny chit-chat / status questions → 1–2 sentences, no headings, no bullet lists.
- Real engineering / build / automation work → use the structure below:
  1. **One-sentence intent** — what you understood and what you'll do.
  2. **(optional) Plan card** — 3–6 short bullet steps when work spans multiple files/tools.
  3. **Action** — call the right tools. Don't narrate every step in prose; let tool events render.
  4. **Result summary** — 1–3 bullets of what changed (files, URLs, status).
  5. **Next steps** — 2–3 short bullets the user can click to continue.

Never produce a wall of text on a small input. Never apologize. Never promise to "report back later" — finish in this turn or state the precise blocker. Mirror the user's mode: in AUTOMATION mode, only talk automation/CI/CD/triggers; in BUILD mode, only ship code/files; in CHAT mode, stay conversational and brief.

You are TIVO AI. Ship like a senior engineer.`;

    const finalSystemPrompt = `${systemPrompt}\n\n${AI_WORKFLOWS_PROMPT_BLOCK}`;

    // Determine AI gateway. User/server keys are tried before Lovable AI so a
    // workspace-level Lovable AI 403 never blocks the owner from using TIVO.
    const gatewayConfigs: GatewayConfig[] = [];
    let useToolCalling = true;

    if (provider === "gemini" && apiKey) {
      gatewayConfigs.push({
        gatewayUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        authHeader: `Bearer ${apiKey}`,
        modelName: model || "gemini-2.0-flash",
        label: "user_gemini",
      });
    } else if (provider === "groq" && apiKey) {
      gatewayConfigs.push({
        gatewayUrl: "https://api.groq.com/openai/v1/chat/completions",
        authHeader: `Bearer ${apiKey}`,
        modelName: model || "llama-3.3-70b-versatile",
        label: "user_groq",
      });
    } else if (provider === "deepseek" && apiKey) {
      gatewayConfigs.push({
        gatewayUrl: "https://api.deepseek.com/v1/chat/completions",
        authHeader: `Bearer ${apiKey}`,
        modelName: model || "deepseek-chat",
        label: "user_deepseek",
      });
    }

    if (SERVER_GEMINI_API_KEY && !gatewayConfigs.some((cfg) => cfg.authHeader === `Bearer ${SERVER_GEMINI_API_KEY}`)) {
      gatewayConfigs.push({
        gatewayUrl: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        authHeader: `Bearer ${SERVER_GEMINI_API_KEY}`,
        modelName: "gemini-2.0-flash",
        label: "server_gemini",
      });
    }

    if (LOVABLE_API_KEY) {
      gatewayConfigs.push({
        gatewayUrl: "https://ai.gateway.lovable.dev/v1/chat/completions",
        authHeader: `Bearer ${LOVABLE_API_KEY}`,
        modelName: "google/gemini-3-flash-preview",
        label: "lovable_ai",
      });
    }

    if (gatewayConfigs.length === 0) {
      return new Response(
        JSON.stringify({ error: "No AI provider configured. Add a Gemini API key in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Agentic loop ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const conversationMessages = [
          { role: "system", content: finalSystemPrompt },
          ...messages,
        ];

        const MAX_ITERATIONS = 25;

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          controller.enqueue(encoder.encode(sseEvent("thinking", {
            step: iteration + 1,
            maxSteps: MAX_ITERATIONS,
            status: iteration === 0 ? "analyzing" : "continuing",
          })));

          const body: Record<string, unknown> = {
            model: gatewayConfigs[0].modelName,
            messages: conversationMessages,
            stream: true,
          };

          // Internal admin/user messaging tools are always available; external
          // tools are enabled only when their token is configured.
          if (useToolCalling) {
            // Filter tools based on available tokens
            const availableToolDefs = TOOLS.filter(t => {
              const fn = t.function.name;
              if (fn === "send_message_to_admin" || fn === "create_admin_notification") return true;
              if (fn === "check_vercel_deployment") return !!tokens.vercel;
              if (fn === "search_web") return !!tokens.tavily;
              return !!tokens.github; // All other tools need GitHub
            });
            if (availableToolDefs.length > 0) {
              body.tools = availableToolDefs;
              body.tool_choice = "auto";
            }
          }

          let aiResp: Response | null = null;
          let lastStatus = 0;
          let lastErrText = "";
          for (const cfg of gatewayConfigs) {
            body.model = cfg.modelName;
            const candidate = await fetch(cfg.gatewayUrl, {
              method: "POST",
              headers: {
                Authorization: cfg.authHeader,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            });
            if (candidate.ok) {
              aiResp = candidate;
              break;
            }
            lastStatus = candidate.status;
            lastErrText = await candidate.text();
            console.error(`AI error via ${cfg.label}:`, lastStatus, lastErrText);
          }

          if (!aiResp) {
            const status = lastStatus || 500;
            await logAudit(adminClient, {
              actorId: userId,
              actorEmail: userEmail,
              eventType: `recovery.ai_provider_${status}`,
              after: { status, provider: provider || "gemini", tried: gatewayConfigs.map((cfg) => cfg.label), error: lastErrText.slice(0, 500) },
              note: "AI provider fallback exhausted",
            });
            if ((status === 429 || status >= 500) && iteration < MAX_ITERATIONS - 1) {
              controller.enqueue(encoder.encode(sseEvent("thinking", {
                step: iteration + 1,
                status: "retrying",
                message: `⚠️ Error ${status}, retrying in 3s...`,
              })));
              await new Promise(r => setTimeout(r, 3000));
              continue;
            }

            if (status === 429) {
              controller.enqueue(encoder.encode(sseEvent("error", { error: "Rate limit exceeded. Please try again in a moment." })));
            } else if (status === 402) {
              controller.enqueue(encoder.encode(sseEvent("error", { error: "Payment required. Please add credits." })));
            } else if (status === 403 && lastErrText.includes("Lovable AI is disabled")) {
              controller.enqueue(encoder.encode(sseEvent("error", { error: "Gemini API key is needed because workspace AI is disabled. Add your Gemini key in Settings, or ask admin to enable Lovable AI." })));
            } else {
              controller.enqueue(encoder.encode(sseEvent("error", { error: `AI error ${status}` })));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          const reader = aiResp.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let assistantText = "";
          const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr || jsonStr === "[DONE]") continue;

              try {
                const parsed = JSON.parse(jsonStr);
                const choice = parsed.choices?.[0];
                if (!choice) continue;

                const delta = choice.delta;

                if (delta?.content) {
                  assistantText += delta.content;
                  controller.enqueue(encoder.encode(sseDelta(delta.content)));
                }

                if (delta?.tool_calls) {
                  for (const tc of delta.tool_calls) {
                    const idx = tc.index ?? 0;
                    if (!toolCalls.has(idx)) {
                      toolCalls.set(idx, { id: tc.id || "", name: tc.function?.name || "", arguments: "" });
                    }
                    const existing = toolCalls.get(idx)!;
                    if (tc.id) existing.id = tc.id;
                    if (tc.function?.name) existing.name = tc.function.name;
                    if (tc.function?.arguments) existing.arguments += tc.function.arguments;
                  }
                }
              } catch { /* partial JSON */ }
            }
          }

          // If no tool calls, we're done
          if (toolCalls.size === 0) {
            await storeMemoryEntry(
              adminClient,
              userId,
              latestPrompt,
              assistantText,
              apiKey || SERVER_GEMINI_API_KEY,
              LOVABLE_API_KEY || undefined,
            );
            controller.enqueue(encoder.encode(sseEvent("thinking", { step: iteration + 1, status: "complete" })));
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Add assistant message with tool calls
          const assistantMsg: Record<string, unknown> = { role: "assistant" };
          if (assistantText) assistantMsg.content = assistantText;
          assistantMsg.tool_calls = Array.from(toolCalls.values()).map((tc) => ({
            id: tc.id,
            type: "function",
            function: { name: tc.name, arguments: tc.arguments },
          }));
          conversationMessages.push(assistantMsg);

          // Execute each tool call
          for (const [, tc] of toolCalls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(tc.arguments);
            } catch {
              args = {};
            }

            controller.enqueue(encoder.encode(sseEvent("tool_start", {
              tool: tc.name,
              args: sanitizeArgs(args),
            })));

            const approval = await requireApprovalForTool(adminClient, toolCtx, tc.name, args);
            if (!approval.ok) {
              const blocked = { error: "approval_required", approval_id: approval.approvalId, message: "Admin approval is required before this critical action can run." };
              controller.enqueue(encoder.encode(sseEvent("tool_result", {
                tool: tc.name,
                result: blocked,
              })));
              conversationMessages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(blocked),
              });
              continue;
            }

            let result = await executeTool(tc.name, args, tokens, toolCtx);
            let parsedResult = JSON.parse(result);
            if (parsedResult.error) {
              await logAudit(adminClient, {
                actorId: userId,
                actorEmail: userEmail,
                eventType: "recovery.tool_error",
                after: { tool: tc.name, error: parsedResult.error, args: sanitizeArgs(args) },
                note: tc.name,
              });
            }

            // Auto-retry on SHA conflict (up to 2 retries)
            if (parsedResult.error && parsedResult.error.includes("422") &&
              (tc.name === "write_file_to_github" || tc.name === "push_multiple_files")) {
              for (let retry = 0; retry < 2; retry++) {
                controller.enqueue(encoder.encode(sseEvent("thinking", {
                  step: iteration + 1,
                  status: "retrying",
                  message: `SHA conflict, retry ${retry + 1}/2...`,
                })));
                await new Promise(r => setTimeout(r, 1500));
                result = await executeTool(tc.name, args, tokens, toolCtx);
                parsedResult = JSON.parse(result);
                if (!parsedResult.error) break;
              }
            }

            controller.enqueue(encoder.encode(sseEvent("tool_result", {
              tool: tc.name,
              result: parsedResult,
            })));

            conversationMessages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result,
            });
          }

          controller.enqueue(encoder.encode(sseDelta("\n\n")));
        }

        // Max iterations reached
        controller.enqueue(encoder.encode(sseDelta("\n\n⚠️ Maximum iterations reached. Send another message to continue.")));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function sanitizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const clean = { ...args };
  if (typeof clean.content === "string" && (clean.content as string).length > 200) {
    clean.content = (clean.content as string).slice(0, 200) + "...";
  }
  if (Array.isArray(clean.files)) {
    clean.files = (clean.files as Array<{ path: string }>).map(f => ({ path: f.path, content: "[truncated]" }));
  }
  return clean;
}