import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

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
  ctx: { userId?: string; userEmail?: string; supabaseUrl: string; serviceRoleKey: string }
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
        if (!tokens.tavily) return JSON.stringify({ error: "Tavily API key not configured. Add it in Settings → Tools & Integrations." });
        const { query, max_results } = args as { query: string; max_results?: number };
        const tavilyRes = await fetch("https://api.tavily.com/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: tokens.tavily,
            query,
            max_results: max_results || 5,
            search_depth: "basic",
          }),
        });
        if (!tavilyRes.ok) {
          return JSON.stringify({ error: `Tavily search failed: ${tavilyRes.status}` });
        }
        const searchData = await tavilyRes.json();
        const results = (searchData.results || []).map((r: Record<string, unknown>) => ({
          title: r.title,
          url: r.url,
          snippet: typeof r.content === 'string' ? (r.content as string).slice(0, 300) : '',
        }));
        return JSON.stringify({ query, results });
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

// ── Main handler ────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, model, apiKey, provider, githubToken, vercelToken, tavilyApiKey, credentials, isAdmin, userEmail, userId } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const toolCtx = { userId, userEmail, supabaseUrl: SUPABASE_URL, serviceRoleKey: SERVICE_ROLE };

    const tokens = {
      github: githubToken || "",
      vercel: vercelToken || "",
      tavily: tavilyApiKey || "",
    };

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

    const systemPrompt = `You are TIVO AI, an autonomous AI development agent — an expert-level software engineer. You build, modify, and deploy real applications directly via GitHub.

## CORE IDENTITY
- You are a professional full-stack developer who writes production-quality, modern code.
- You NEVER just describe what to do — you EXECUTE actions using your tools.
- You work autonomously — fast, professional, minimal talk, maximum results.
- You use the LATEST technologies and best practices (React 19, Next.js 15, Tailwind v4, TypeScript 5, etc.)

## CURRENT USER: ${userRole}
- Identity: ${userIdent}
${userRole === 'ADMIN' ? `- This is the **system administrator**. Address them as Admin. You can share system status, technical details, secret-availability summaries, and full reports.
- Admin has UNLIMITED access to all features and can monitor every user.
- Proactively suggest improvements to the system as a senior engineer would.` : `- This is a **regular user**. DO NOT reveal system internals, API keys, backend details, or admin configurations.
- Only provide the service they ask for. Be helpful but keep internal details private.
- If the user wants something only an admin can grant (more credits, advanced features, custom integrations), POLITELY OFFER to forward their request: "I can pass this to the admin — would you like that?"
- If they ask about system configurations, politely tell them it's managed by the admin.`}

## CONFIGURED CREDENTIALS
${credStatus || 'No credential info available'}

## AVAILABLE TOOLS
${availableTools.length > 0 ? availableTools.map(t => `✅ ${t}`).join("\n") : "⚠️ No tools configured. Tell the user to add tokens in Settings."}

## BEHAVIORAL RULES
1. **Less talk, more action.** Don't explain what you're going to do at length. Just do it.
2. **Don't start immediately.** Read the user's request carefully. Understand the full scope first.
3. **Never promise what you can't do.** If a tool isn't configured, say so clearly and briefly.
4. **Never lie about capabilities.** Be honest about what's available and what's not.
5. **Never reveal system secrets** to regular users (API keys, backend URLs, admin configs).
6. **Auto-switch providers** if the current one fails — try Gemini → Groq → DeepSeek.

## MANDATORY WORKFLOW (For coding tasks)
1. **ANALYZE**: Call \`list_repo_files\` to understand current project structure.
2. **IMPLEMENT**: Push changes in small batches (3-5 files per batch).
3. **VERIFY**: After each batch, confirm files exist.
4. ${tokens.vercel ? '**DEPLOY CHECK**: Call `check_vercel_deployment` to verify build.' : '**REPORT**: Brief summary.'}

## ERROR HANDLING
- SHA conflict → Re-read file, retry.
- 404 → Create repo first.
- Rate limit → Wait and retry once.
- Build errors → Read error, fix, push again.
- Attempt 2 retries before reporting failure.

## CODE QUALITY
- TypeScript with strict types
- Modern ES2024+ syntax
- Proper error handling
- Clean, well-structured code
- Tailwind CSS for styling

## GITHUB FULL ACCESS
${tokens.github ? `GitHub token configured with FULL ACCESS. You can manage repos, branches, PRs, files, and settings.` : "⚠️ GitHub token NOT configured."}

## COMMUNICATION
- Professional, concise, friendly
- Support Bangla (বাংলা) and English based on user language
- Use emojis sparingly for status: 🔍 📦 🚀 ✅ ⚠️ ❌
- End with brief structured summary

## CONTEXT
- Use full conversation history to maintain continuity.
- Remember repo names, usernames, and preferences across the session.`;

    // Determine AI gateway
    let gatewayUrl: string;
    let authHeader: string;
    let modelName: string;
    let useToolCalling = true;

    if (provider === "gemini" && apiKey) {
      if (LOVABLE_API_KEY) {
        gatewayUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
        authHeader = `Bearer ${LOVABLE_API_KEY}`;
        modelName = "google/gemini-3-flash-preview";
      } else {
        gatewayUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model || "gemini-2.5-flash"}:streamGenerateContent?alt=sse&key=${apiKey}`;
        authHeader = "";
        modelName = model || "gemini-2.5-flash";
        useToolCalling = false;
      }
    } else if (provider === "groq" && apiKey) {
      gatewayUrl = "https://api.groq.com/openai/v1/chat/completions";
      authHeader = `Bearer ${apiKey}`;
      modelName = model || "llama-3.3-70b-versatile";
    } else if (provider === "deepseek" && apiKey) {
      gatewayUrl = "https://api.deepseek.com/v1/chat/completions";
      authHeader = `Bearer ${apiKey}`;
      modelName = model || "deepseek-chat";
    } else if (LOVABLE_API_KEY) {
      gatewayUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
      authHeader = `Bearer ${LOVABLE_API_KEY}`;
      modelName = "google/gemini-3-flash-preview";
    } else {
      return new Response(
        JSON.stringify({ error: "No AI provider configured. Add an API key in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Agentic loop ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const conversationMessages = [
          { role: "system", content: systemPrompt },
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
            model: modelName,
            messages: conversationMessages,
            stream: true,
          };

          // Only include tools if we have at least one token configured
          if (useToolCalling && (tokens.github || tokens.vercel || tokens.tavily)) {
            // Filter tools based on available tokens
            const availableToolDefs = TOOLS.filter(t => {
              const fn = t.function.name;
              if (fn === "check_vercel_deployment") return !!tokens.vercel;
              if (fn === "search_web") return !!tokens.tavily;
              return !!tokens.github; // All other tools need GitHub
            });
            if (availableToolDefs.length > 0) {
              body.tools = availableToolDefs;
              body.tool_choice = "auto";
            }
          }

          const aiResp = await fetch(gatewayUrl, {
            method: "POST",
            headers: {
              Authorization: authHeader,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });

          if (!aiResp.ok) {
            const status = aiResp.status;
            const errText = await aiResp.text();
            console.error("AI error:", status, errText);

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

            let result = await executeTool(tc.name, args, tokens, toolCtx);
            let parsedResult = JSON.parse(result);

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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
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