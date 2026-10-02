import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

const ALLOWED_ACTIONS = new Set([
  "get_user", "list_repos", "create_repo", "create_or_update_file", "push_project",
  "get_repo_contents", "dispatch_workflow", "list_workflow_runs", "get_workflow_run",
  "list_run_jobs", "list_run_artifacts", "delete_repo",
]);
const DESTRUCTIVE_ACTIONS = new Set(["delete_repo"]);
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;

/** Rejects path traversal / URL injection in values interpolated into GitHub API paths. */
function validateParams(p: Record<string, unknown>): string | null {
  for (const k of ["owner", "repo", "name"]) {
    if (p[k] !== undefined && (typeof p[k] !== "string" || !NAME_RE.test(p[k] as string))) return k;
  }
  for (const k of ["runId"]) {
    if (p[k] !== undefined && !/^\d{1,20}$/.test(String(p[k]))) return k;
  }
  const badPath = (v: unknown) => typeof v !== "string" || v.length > 500 || v.split("/").includes("..") || /[?#]/.test(v);
  if (p.path !== undefined && p.path !== "" && badPath(p.path)) return "path";
  if (p.workflowId !== undefined && (typeof p.workflowId !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(p.workflowId))) return "workflowId";
  if (Array.isArray(p.files) && p.files.some((f: any) => badPath(f?.path))) return "files";
  return null;
}

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
  if (!res.ok) {
    throw new Error(`GitHub API [${res.status}]: ${JSON.stringify(data)}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Require a valid Supabase session — this function is a privileged GitHub proxy.
    const authHeader = req.headers.get("Authorization") || "";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
    if (!authHeader || !SUPABASE_URL || !ANON_KEY) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    let userId = "";
    let isAdmin = false;
    let { action, token, ...params } = await req.json().catch(() => ({} as any));
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
    try {
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = user.id;
      const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      if (SERVICE_ROLE) {
        const svc = createClient(SUPABASE_URL, SERVICE_ROLE);
        // Authoritative admin check: verified email in ADMIN_EMAIL or admin_email_allowlist.
        // The persisted user_profiles.role is NOT trusted. Any lookup failure fails closed.
        try {
          const email = (user.email || "").trim().toLowerCase();
          const verified = !!(user.email_confirmed_at || (user as any).confirmed_at);
          const adminEmail = (Deno.env.get("ADMIN_EMAIL") || "").trim().toLowerCase();
          if (verified && email) {
            if (adminEmail && email === adminEmail) isAdmin = true;
            else {
              const { data: al, error: alErr } = await svc.from("admin_email_allowlist")
                .select("id").eq("email", email).maybeSingle();
              isAdmin = !alErr && !!al;
            }
          }
        } catch { isAdmin = false; }
        // Resolve the caller's own GitHub token server-side so it need not transit the browser.
        if (!token) {
          const { data: sec } = await svc.from("user_secrets").select("value")
            .eq("user_id", userId).eq("name", "githubToken").maybeSingle();
          token = (sec as any)?.value || "";
          // No shared/admin token fallback: shared-token intent is not established, so
          // users without their own token get no_token.
        }
      }
    } catch {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
      return new Response(JSON.stringify({ error: "unknown_action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const invalid = validateParams(params);
    if (invalid) {
      return new Response(JSON.stringify({ error: "invalid_params", field: invalid }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Destructive actions are admin-only and require an explicit server-checked confirmation.
    if (DESTRUCTIVE_ACTIONS.has(action)) {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (params.confirm !== `${params.owner}/${params.repo}`) {
        return new Response(JSON.stringify({ error: "confirmation_required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (!token) {
      return new Response(
        JSON.stringify({ error: "no_token", message: "GitHub token required. Add it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: unknown;

    switch (action) {
      case "get_user": {
        result = await githubFetch("/user", token);
        break;
      }

      case "list_repos": {
        result = await githubFetch("/user/repos?sort=updated&per_page=30", token);
        break;
      }

      case "create_repo": {
        const { name, description, isPrivate } = params;
        result = await githubFetch("/user/repos", token, {
          method: "POST",
          body: JSON.stringify({
            name,
            description: description || `Created by TIVO AI`,
            private: isPrivate ?? true,
            auto_init: true,
          }),
        });
        break;
      }

      case "create_or_update_file": {
        const { owner, repo, path, content, message, sha } = params;
        const encodedContent = btoa(unescape(encodeURIComponent(content)));
        const body: Record<string, string> = {
          message: message || `Add ${path} via TIVO AI`,
          content: encodedContent,
        };
        if (sha) body.sha = sha;

        result = await githubFetch(`/repos/${owner}/${repo}/contents/${path}`, token, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        break;
      }

      case "push_project": {
        // Push multiple files to a repo
        const { owner, repo, files } = params as {
          owner: string;
          repo: string;
          files: Array<{ path: string; content: string }>;
        };

        const results = [];
        for (const file of files) {
          // Check if file exists (to get sha for update)
          let sha: string | undefined;
          try {
            const existing = await githubFetch(
              `/repos/${owner}/${repo}/contents/${file.path}`,
              token
            );
            sha = existing.sha;
          } catch {
            // File doesn't exist, will create
          }

          const encodedContent = btoa(unescape(encodeURIComponent(file.content)));
          const res = await githubFetch(
            `/repos/${owner}/${repo}/contents/${file.path}`,
            token,
            {
              method: "PUT",
              body: JSON.stringify({
                message: `Update ${file.path} via TIVO AI`,
                content: encodedContent,
                ...(sha ? { sha } : {}),
              }),
            }
          );
          results.push({ path: file.path, sha: res.content?.sha });
        }
        result = { success: true, files: results };
        break;
      }

      case "get_repo_contents": {
        const { owner, repo, path } = params;
        result = await githubFetch(
          `/repos/${owner}/${repo}/contents/${path || ""}`,
          token
        );
        break;
      }

      case "dispatch_workflow": {
        const { owner, repo, workflowId, ref, inputs } = params;
        await githubFetch(
          `/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`,
          token,
          { method: "POST", body: JSON.stringify({ ref: ref || "main", inputs: inputs || {} }) },
        );
        result = { success: true };
        break;
      }

      case "list_workflow_runs": {
        const { owner, repo, branch, perPage } = params;
        const qs = new URLSearchParams({ per_page: String(perPage || 10) });
        if (branch) qs.set("branch", branch);
        result = await githubFetch(`/repos/${owner}/${repo}/actions/runs?${qs}`, token);
        break;
      }

      case "get_workflow_run": {
        const { owner, repo, runId } = params;
        result = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}`, token);
        break;
      }

      case "list_run_jobs": {
        const { owner, repo, runId } = params;
        result = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, token);
        break;
      }

      case "list_run_artifacts": {
        const { owner, repo, runId } = params;
        result = await githubFetch(`/repos/${owner}/${repo}/actions/runs/${runId}/artifacts`, token);
        break;
      }

      case "delete_repo": {
        const { owner, repo } = params;
        await githubFetch(`/repos/${owner}/${repo}`, token, { method: "DELETE" });
        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("GitHub function error:", e);
    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
