import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GITHUB_API = "https://api.github.com";

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
    try {
      const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2.45.0");
      const userClient = createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, token, ...params } = await req.json();

    if (!token) {
      return new Response(
        JSON.stringify({ error: "GitHub token required. Add it in Settings." }),
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
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
