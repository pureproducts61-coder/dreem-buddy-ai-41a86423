# TIVO System Overhaul Plan

আপনার সমস্যাগুলো ৫টি বড় ভাগে সমাধান করব:

## 1. Admin Keys/System Tab — Dynamic Provider & Model Selection

**সমস্যা:** Lovable AI বন্ধ করা যাচ্ছে না; Gemini/Groq/DeepSeek/HF/OpenRouter মডেলসহ সিলেক্ট করা যাচ্ছে না।

**সমাধান:**
- `ai_system_settings` টেবিলে যোগ করব: `provider`, `model`, `enabled`, `priority`, `capabilities` (JSON: ['code','chat','vision','research']), `api_key_secret_name`
- Admin Panel → Keys Tab: প্রতিটি প্রোভাইডারের জন্য enable/disable toggle + API key input + মডেল লিস্ট (fetch or manual)
- Admin Panel → System Tab: প্রতিটি "task type" (code, chat, research, vision, quick, deep-reasoning) এর জন্য preferred provider+model ম্যাপিং
- **Smart Auto-Router** (`src/services/aiRouter.ts`): task type + capability + availability + fallback chain অনুযায়ী নিজেই সঠিক provider/model বাছাই করবে; একটি fail হলে পরেরটায় auto-switch
- Free model preset: Groq (llama-3.3), Gemini flash, OpenRouter free tier, HF inference — এক ক্লিকে enable

## 2. Sync Problem — TIVO AI যেন Lovable-এর কাজ জানে

**সমস্যা:** Lovable যা করে TIVO জানে না, TIVO যা করে Lovable-এ আসে না।

**সমাধান:**
- **Two-way memory bridge** (`src/services/memoryBridge.ts`): প্রতিটি code change এর পর `ai_memory_entries`-এ file path + summary + timestamp + source ('lovable'/'tivo') push
- TIVO-এর system prompt-এ inject: recent memory entries + file tree snapshot + last 10 changes
- GitHub webhook / periodic sync: repo state → memory
- Admin panel-এ "Memory Sync Status" card

## 3. GitHub Push Reliability — সবসময় সব ফাইল push হবে

**সমস্যা:** TIVO বলে push করেছি কিন্তু GitHub-এ যায় না।

**সমাধান:**
- `githubService.ts` কে rewrite: **tree API** ব্যবহার করে batch commit (এক commit-এ সব ফাইল), retry with exponential backoff (3x), post-push verification (SHA check)
- ব্যর্থ হলে chat-এ clear error + retry button
- Push log `build_reports` টেবিলে save
- Rate limit + token permission auto-check before push

## 4. Web Research Capability (Tavily-এর বিকল্প, নিরাপদ)

**সমস্যা:** Tavily/অন্যান্য API কানেক্ট হচ্ছে না; latest info দরকার।

**সমাধান:**
- **Firecrawl connector** (already available in Lovable) কে integrate — search + scrape + extract JSON
- Edge function `web-research`: TIVO যেকোনো URL/query দিয়ে ডাকতে পারবে; result → memory-এ save
- Fallback chain: Firecrawl → DuckDuckGo scrape → Google (via serpapi if key set)
- TIVO-কে instruction: "কোনো কিছু না জানলে web-research tool call করো, শিখে কাজ করো"

## 5. Chat UI Live Progress + Dynamic Suggestions + Animations

**সমস্যা:** Progress ঠিকভাবে দেখায় না; suggestion chips-এ পুরনো chat আসে; animation নেই।

**সমাধান:**
- `StreamingMessage.tsx` upgrade: real-time step announcements ("Reading files...", "Writing component...", "Pushing to GitHub..."), background work চলতে থাকবে, foreground-এ typewriter animation
- `SuggestionChips.tsx`: single-line height (`h-8 truncate`), click → full text ইনপুট বারে; AI নিজে context-aware suggestions generate করবে (edge function `generate-suggestions`)
- **Dynamic scene renderer** (`src/components/tivo/AiScene.tsx`): AI JSON block পাঠাতে পারবে `{type:'animation', style:'code-rain'|'building'|'thinking', text:'...'}` — সেভাবে render হবে
- Completion summary card: "যা যা হয়েছে" checklist

## 6. AI Guidance & Expertise (System Prompt Overhaul)

TIVO-এর edge function `chat`-এ inject করব:
- Full file tree snapshot
- Recent git changes
- Available tools list (github push, web research, build dispatch, memory read/write)
- Platform-specific expert knowledge (Vercel limits, GitHub Actions APK/EXE flow, PWA)
- Rules: "কিছু না জানলে web-research করো বা user-কে জিজ্ঞেস করো, কখনো মিথ্যা success reply দিও না"

---

## Technical Details

**New files:**
- `src/services/aiRouter.ts` — provider/model smart switcher
- `src/services/memoryBridge.ts` — two-way sync
- `src/components/tivo/AiScene.tsx` — dynamic animation renderer
- `supabase/functions/web-research/index.ts` — Firecrawl-backed research
- `supabase/functions/generate-suggestions/index.ts` — context-aware chips
- `src/components/admin/ProviderConfigTab.tsx` — dynamic provider UI

**Migrations:**
- Extend `ai_system_settings` with provider config schema
- New `ai_provider_configs` table (provider, model, enabled, priority, task_types[])

**Edited files:**
- `supabase/functions/chat/index.ts` — router + full context injection
- `src/services/githubService.ts` — tree API + retry + verify
- `src/components/tivo/StreamingMessage.tsx` — live progress
- `src/components/tivo/SuggestionChips.tsx` — single-line + AI-generated
- `src/pages/AdminPanel.tsx` — new Provider tab, updated Keys/System tabs

**Connector needed:** Firecrawl (আমি setup করব — শুধু connect confirm করবেন)

**Estimated scope:** বড় কাজ, ৩-৪টি পর্যায়ে করব যেন প্রতি ধাপে verify করা যায়। শুরুর ধাপ: (1) Provider config + Router, তারপর (2) GitHub reliability + Memory bridge, তারপর (3) Web research + Chat UI upgrade।

---

**অনুমোদন করলে কোন ধাপ থেকে শুরু করব বলুন — অথবা "সব একসাথে" বললে ধাপে ধাপে সব করব।**
