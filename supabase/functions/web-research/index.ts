/**
 * TIVO Web Research edge function
 * -------------------------------
 * A safe, provider-agnostic web research endpoint the TIVO AI can call
 * whenever it needs fresh information. Priority order:
 *
 *   1. Firecrawl (if FIRECRAWL_API_KEY secret exists) — search + scrape
 *   2. Tavily (if TAVILY_API_KEY exists)
 *   3. DuckDuckGo instant answer HTML fallback (no key required)
 *
 * The result is normalized to `{ query, results: [{title,url,snippet,content?}] }`
 * so the AI always gets a consistent shape regardless of which backend served
 * the request.
 */

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

/** Reject non-public URLs to prevent SSRF against internal/metadata endpoints. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  if (h === '::1' || h === '0.0.0.0') return true;
  if (h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    if (a >= 224) return true;
  }
  return false;
}

function validatePublicUrl(raw: string): URL | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname || isPrivateHost(u.hostname)) return null;
  return u;
}

interface ResearchResult {
  title: string;
  url: string;
  snippet: string;
  content?: string;
}

async function tryFirecrawl(query: string, limit: number): Promise<ResearchResult[] | null> {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.firecrawl.dev/v2/search', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const web = data?.data?.web ?? data?.web ?? data?.data ?? [];
    return (Array.isArray(web) ? web : []).slice(0, limit).map((r: any) => ({
      title: r.title ?? r.url ?? '',
      url: r.url ?? '',
      snippet: r.description ?? r.snippet ?? '',
      content: r.markdown ?? undefined,
    }));
  } catch (e) {
    console.warn('[web-research] firecrawl failed:', e);
    return null;
  }
}

async function tryTavily(query: string, limit: number): Promise<ResearchResult[] | null> {
  const key = Deno.env.get('TAVILY_API_KEY');
  if (!key) return null;
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: limit, include_answer: true }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.results ?? []).slice(0, limit).map((r: any) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    }));
  } catch (e) {
    console.warn('[web-research] tavily failed:', e);
    return null;
  }
}

async function duckDuckGo(query: string, limit: number): Promise<ResearchResult[]> {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url);
    const data = await res.json();
    const items: ResearchResult[] = [];
    if (data.AbstractText) {
      items.push({ title: data.Heading ?? query, url: data.AbstractURL ?? '', snippet: data.AbstractText });
    }
    for (const t of (data.RelatedTopics ?? []).slice(0, limit)) {
      if (t.Text && t.FirstURL) items.push({ title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
    }
    return items.slice(0, limit);
  } catch (e) {
    console.warn('[web-research] ddg failed:', e);
    return [];
  }
}

async function scrapeUrl(url: string): Promise<{ url: string; content: string; title?: string } | null> {
  const key = Deno.env.get('FIRECRAWL_API_KEY');
  if (key) {
    try {
      const res = await fetch('https://api.firecrawl.dev/v2/scrape', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true }),
      });
      if (res.ok) {
        const d = await res.json();
        return { url, content: d.markdown ?? d.data?.markdown ?? '', title: d.metadata?.title ?? d.data?.metadata?.title };
      }
    } catch (e) { console.warn('[web-research] firecrawl scrape failed', e); }
  }
  // Bare fetch fallback (HTML — the AI can still parse it)
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'TIVO-Research/1.0' } });
    const html = await res.text();
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return { url, content: text.slice(0, 12000) };
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const { query, url, mode = 'search', limit = 5 } = body as { query?: string; url?: string; mode?: 'search' | 'scrape'; limit?: number };

    if (mode === 'scrape' && url) {
      const result = await scrapeUrl(url);
      return new Response(JSON.stringify({ ok: true, mode: 'scrape', result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!query || typeof query !== 'string' || query.length > 500) {
      return new Response(JSON.stringify({ error: 'query required (<=500 chars)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const boundedLimit = Math.min(Math.max(1, limit), 10);
    const results = (await tryFirecrawl(query, boundedLimit))
      ?? (await tryTavily(query, boundedLimit))
      ?? (await duckDuckGo(query, boundedLimit));

    const source = Deno.env.get('FIRECRAWL_API_KEY') ? 'firecrawl'
      : Deno.env.get('TAVILY_API_KEY') ? 'tavily' : 'duckduckgo';

    return new Response(JSON.stringify({ ok: true, mode: 'search', source, query, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('[web-research] error', e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
