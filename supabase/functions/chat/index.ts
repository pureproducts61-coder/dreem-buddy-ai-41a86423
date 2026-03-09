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
];

// ── Execute a tool call ─────────────────────────────────────
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  githubToken: string
): Promise<string> {
  if (!githubToken) {
    return JSON.stringify({ error: "GitHub token not configured. Tell the user to add it in Settings → API Keys." });
  }

  try {
    switch (name) {
      case "create_github_repo": {
        const result = await githubFetch("/user/repos", githubToken, {
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
        const { owner, repo, path, content, message } = args as Record<string, string>;
        let sha: string | undefined;
        try {
          const existing = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, githubToken);
          sha = existing.sha;
        } catch { /* new file */ }

        const encoded = btoa(unescape(encodeURIComponent(content)));
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, githubToken, {
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
        const { owner, repo, files, message: commitMsg } = args as { owner: string; repo: string; files: Array<{ path: string; content: string }>; message?: string };
        const results = [];
        for (const file of files) {
          let sha: string | undefined;
          try {
            const existing = await githubFetch(`/repos/${owner}/${repo}/contents/${file.path}`, githubToken);
            sha = existing.sha;
          } catch { /* new file */ }

          const encoded = btoa(unescape(encodeURIComponent(file.content)));
          const res = await githubFetch(`/repos/${owner}/${repo}/contents/${file.path}`, githubToken, {
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
        const { owner, repo, path } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path || ""}`, githubToken);
        const items = Array.isArray(result) ? result.map((f: { name: string; type: string; path: string; size: number }) => ({
          name: f.name, type: f.type, path: f.path, size: f.size
        })) : [{ name: result.name, type: result.type, path: result.path }];
        return JSON.stringify({ files: items });
      }

      case "read_file_from_github": {
        const { owner, repo, path } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, githubToken);
        const decoded = atob(result.content);
        return JSON.stringify({ path, content: decoded });
      }

      case "delete_github_repo": {
        const { owner, repo } = args as Record<string, string>;
        await githubFetch(`/repos/${owner}/${repo}`, githubToken, { method: "DELETE" });
        return JSON.stringify({ success: true, deleted: `${owner}/${repo}` });
      }

      case "create_branch": {
        const { owner, repo, branch, from_branch } = args as Record<string, string>;
        const baseBranch = from_branch || "main";
        // Get the SHA of the base branch
        const ref = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, githubToken);
        const sha = ref.object.sha;
        // Create new branch
        const result = await githubFetch(`/repos/${owner}/${repo}/git/refs`, githubToken, {
          method: "POST",
          body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
        });
        return JSON.stringify({ success: true, branch, sha: result.object.sha });
      }

      case "create_pull_request": {
        const { owner, repo, title, body, head, base } = args as Record<string, string>;
        const result = await githubFetch(`/repos/${owner}/${repo}/pulls`, githubToken, {
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
    const { messages, model, apiKey, provider, githubToken } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    const systemPrompt = `You are TIVO AI, an autonomous AI development agent — an expert-level software engineer. You build, modify, and deploy real applications directly via GitHub.

## CORE IDENTITY
- You are a professional full-stack developer who writes production-quality code.
- You NEVER just describe what to do — you EXECUTE actions using your tools.
- You work incrementally: analyze → plan → implement → verify.

## MANDATORY WORKFLOW (Follow this EVERY time for coding tasks)
1. **ANALYZE FIRST**: ALWAYS call \`list_repo_files\` to understand the current project structure BEFORE writing any code. If working on an existing repo, also \`read_file_from_github\` for key files you'll modify.
2. **PLAN**: Briefly tell the user your plan — which files you'll create/modify and why. Use clear step labels like "📋 Plan: I will create 3 files..."
3. **IMPLEMENT INCREMENTALLY**: Push changes in small logical batches. Don't try to push 20 files at once. Group related files (e.g., push config files first, then components, then pages).
4. **VERIFY**: After pushing, call \`list_repo_files\` again to confirm the files are there.
5. **REPORT**: Summarize what was done and what's next.

## THINKING OUT LOUD
- Always narrate your thinking process to the user so they can follow along.
- Before each tool call, briefly explain WHY you're calling it:
  - "🔍 Let me first check what's already in the repo..."
  - "📝 Now I'll create the package.json and tsconfig..."
  - "🚀 Pushing the React components..."
  - "✅ Let me verify everything was pushed correctly..."

## ERROR HANDLING & RETRY
- If a tool call fails, DO NOT STOP. Read the error message carefully.
- Common fixes:
  - "sha" conflict → call \`read_file_from_github\` to get current SHA, then retry
  - 404 on repo → the repo may not exist yet, create it first
  - Rate limit → tell the user to wait, then suggest retrying
- Always attempt at least ONE retry before giving up.
- If retrying fails, explain the error clearly and suggest what the user can do.

## INCREMENTAL DEVELOPMENT
- Break large tasks into phases. After each phase, confirm with the user before proceeding.
- Example phases for a React app:
  1. Project setup (package.json, tsconfig, vite config)
  2. Core structure (src/main.tsx, src/App.tsx, index.html)
  3. Components (individual feature components)
  4. Styling (CSS/Tailwind setup)
  5. Final verification

## GITHUB FULL ACCESS
${githubToken ? `GitHub token is configured with FULL ACCESS. You can:
- Create/delete repositories
- Create branches and pull requests
- Read/write/update any file
- Manage repository settings
- Push code directly to any branch

The user trusts you with full repository management.` : "⚠️ GitHub token is NOT configured. Tell the user to add it in Settings → API Keys."}

## COMMUNICATION STYLE
- Be professional but friendly
- Support both Bangla (বাংলা) and English based on user preference
- Use emojis sparingly for status indicators (🔍 📝 🚀 ✅ ⚠️ ✗)
- Keep explanations concise but informative
- When showing code in chat, keep it brief — the real code goes to GitHub via tools

## CONTEXT AWARENESS
- You have access to the full conversation history. Use it to understand ongoing projects.
- Remember the user's GitHub username, repo names, and preferences from earlier messages.
- If the user references a previous conversation, look for context in the message history.`;

    // Determine which AI gateway to use
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

    // ── Agentic loop with thinking events ──
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const conversationMessages = [
          { role: "system", content: systemPrompt },
          ...messages,
        ];

        const MAX_ITERATIONS = 15; // Increased for incremental work

        for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
          // Send thinking status
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

          if (useToolCalling && githubToken) {
            body.tools = TOOLS;
            body.tool_choice = "auto";
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

            // Retry once on transient errors
            if ((status === 429 || status >= 500) && iteration < MAX_ITERATIONS - 1) {
              controller.enqueue(encoder.encode(sseEvent("thinking", {
                step: iteration + 1,
                status: "retrying",
                message: `⚠️ Got error ${status}, retrying in 2s...`,
              })));
              await new Promise(r => setTimeout(r, 2000));
              continue;
            }

            if (status === 429) {
              controller.enqueue(encoder.encode(sseEvent("error", { error: "Rate limit exceeded. Please try again later." })));
            } else if (status === 402) {
              controller.enqueue(encoder.encode(sseEvent("error", { error: "Payment required. Please add credits." })));
            } else {
              controller.enqueue(encoder.encode(sseEvent("error", { error: `AI error ${status}` })));
            }
            controller.enqueue(encoder.encode("data: [DONE]\n\n"));
            controller.close();
            return;
          }

          // Parse the streaming response
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

            let result = await executeTool(tc.name, args, githubToken || "");
            const parsedResult = JSON.parse(result);

            // Auto-retry on SHA conflict
            if (parsedResult.error && parsedResult.error.includes("422") && (tc.name === "write_file_to_github" || tc.name === "push_multiple_files")) {
              controller.enqueue(encoder.encode(sseEvent("thinking", {
                step: iteration + 1,
                status: "retrying",
                message: "SHA conflict detected, retrying with fresh SHA...",
              })));
              // Retry the same tool call (executeTool already fetches SHA)
              await new Promise(r => setTimeout(r, 1000));
              result = await executeTool(tc.name, args, githubToken || "");
            }

            const finalResult = JSON.parse(result);
            controller.enqueue(encoder.encode(sseEvent("tool_result", {
              tool: tc.name,
              result: finalResult,
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
        controller.enqueue(encoder.encode(sseDelta("\n\n⚠️ Maximum iterations reached. You can continue by sending another message.")));
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
