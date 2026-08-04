/**
 * Human execution voice.
 * Replaces robotic status tokens with natural sentences so progress reads
 * like a person narrating their work.
 */
export type VoiceEvent =
  | 'understood' | 'checking-environment' | 'found' | 'not-found'
  | 'opening' | 'permission-needed' | 'working' | 'step-done'
  | 'verifying' | 'blocked' | 'finished' | 'failed';

const EN: Record<VoiceEvent, string[]> = {
  understood: ['I understand what you want.', 'Got it — here is what I will do.'],
  'checking-environment': ['I am checking your computer now.', 'Let me look at what is available on this device.'],
  found: ['I found it.', 'Found what I was looking for.'],
  'not-found': ['I could not find it on this device.', 'That is not present here.'],
  opening: ['I am opening it now.', 'Launching it for you.'],
  'permission-needed': ['I need your permission before continuing.', 'I have to ask you first — may I continue?'],
  working: ['I am working on it.', 'Doing that now.'],
  'step-done': ['That step is done — moving to the next one.', 'Done. Next step now.'],
  verifying: ['Let me double-check the result.', 'Verifying that everything actually worked.'],
  blocked: ['I am blocked here and cannot continue on my own.', 'Something is stopping me from finishing this.'],
  finished: ['All done.', 'Everything is finished.'],
  failed: ['That did not work.', 'It failed — here is why.'],
};

const BN: Record<VoiceEvent, string[]> = {
  understood: ['আমি বুঝেছি আপনি কী চান।', 'ঠিক আছে, আমি বুঝতে পেরেছি।'],
  'checking-environment': ['আমি এখন আপনার কম্পিউটার দেখছি।', 'ডিভাইসে কী কী আছে দেখে নিচ্ছি।'],
  found: ['পেয়ে গেছি।', 'যেটা খুঁজছিলাম সেটা পেয়েছি।'],
  'not-found': ['এই ডিভাইসে এটা খুঁজে পাইনি।', 'এখানে এটা নেই।'],
  opening: ['আমি এটা খুলছি।', 'চালু করছি।'],
  'permission-needed': ['এগোনোর আগে আপনার অনুমতি দরকার।', 'আগে অনুমতি দিন, তারপর করছি।'],
  working: ['কাজটা করছি।', 'এখন করছি।'],
  'step-done': ['এই ধাপ শেষ, পরেরটায় যাচ্ছি।', 'হয়ে গেছে — পরের ধাপ।'],
  verifying: ['ঠিকমতো হয়েছে কিনা দেখে নিচ্ছি।', 'ফলাফল যাচাই করছি।'],
  blocked: ['এখানে আটকে গেছি, একা এগোতে পারছি না।', 'কিছু একটা আটকাচ্ছে।'],
  finished: ['সব শেষ।', 'কাজ সম্পূর্ণ।'],
  failed: ['এটা কাজ করেনি।', 'ব্যর্থ হয়েছে — কারণটা বলছি।'],
};

export function say(event: VoiceEvent, lang: 'en' | 'bn' = 'bn', detail?: string): string {
  const pool = (lang === 'bn' ? BN : EN)[event];
  const line = pool[Math.floor(Math.random() * pool.length)];
  return detail ? `${line} ${detail}` : line;
}

const ROBOTIC = [
  [/^\s*(Thinking|Planning|Analyzing|Processing)\.{0,3}\s*$/i, 'understood'],
  [/^\s*(Searching|Looking up|Fetching)\.{0,3}\s*$/i, 'checking-environment'],
  [/^\s*(Executing|Running|Working)\.{0,3}\s*$/i, 'working'],
  [/^\s*(Verifying|Checking)\.{0,3}\s*$/i, 'verifying'],
  [/^\s*(Done|Completed|Success)\.{0,3}\s*$/i, 'step-done'],
] as const;

/** Rewrite robotic one-word status lines into human sentences. */
export function humanize(status: string, lang: 'en' | 'bn' = 'bn'): string {
  for (const [pattern, event] of ROBOTIC) {
    if (pattern.test(status)) return say(event as VoiceEvent, lang);
  }
  return status;
}