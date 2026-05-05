// Preview Bridge — extracts renderable code from AI responses and sends to PreviewTab

/**
 * Extract HTML from AI response code blocks and dispatch to preview.
 * Supports: full HTML documents, React/JSX (wrapped in a scaffold), CSS.
 */
export function extractAndPreviewCode(content: string): boolean {
  // Find code blocks
  const codeBlockRegex = /```(?:html|htm)\n([\s\S]*?)```/gi;
  const jsxBlockRegex = /```(?:tsx?|jsx?|react)\n([\s\S]*?)```/gi;
  const cssBlockRegex = /```(?:css)\n([\s\S]*?)```/gi;
  const mdBlockRegex = /```(?:md|markdown|report)\n([\s\S]*?)```/gi;
  const svgBlockRegex = /```(?:svg)\n([\s\S]*?)```/gi;

  let html = '';

  // Try HTML blocks first
  const htmlMatches = [...content.matchAll(codeBlockRegex)];
  if (htmlMatches.length > 0) {
    html = htmlMatches.map(m => m[1]).join('\n');
    // If it's a full document, use as-is
    if (html.includes('<html') || html.includes('<!DOCTYPE')) {
      dispatchPreview(html);
      return true;
    }
  }

  // Try JSX/React blocks — wrap in a minimal scaffold
  const jsxMatches = [...content.matchAll(jsxBlockRegex)];
  if (jsxMatches.length > 0) {
    const jsxCode = jsxMatches.map(m => m[1]).join('\n');
    html = wrapReactInHtml(jsxCode);
    dispatchPreview(html);
    return true;
  }

  // If we have HTML fragments, wrap them
  if (htmlMatches.length > 0) {
    html = wrapInHtml(htmlMatches.map(m => m[1]).join('\n'), getCssFromContent(content));
    dispatchPreview(html);
    return true;
  }

  // Markdown / business-report rendering — surface AI reports straight to the Preview tab
  const mdMatches = [...content.matchAll(mdBlockRegex)];
  if (mdMatches.length > 0) {
    const md = mdMatches.map(m => m[1]).join('\n\n');
    html = wrapMarkdownInHtml(md);
    dispatchPreview(html);
    return true;
  }

  // SVG charts / diagrams
  const svgMatches = [...content.matchAll(svgBlockRegex)];
  if (svgMatches.length > 0) {
    html = wrapInHtml(svgMatches.map(m => `<div style="padding:1rem">${m[1]}</div>`).join(''));
    dispatchPreview(html);
    return true;
  }

  return false;
}

/**
 * Render arbitrary text as a formatted Task Output report inside the Preview tab.
 * Used for plan/automation results that have no code but need to be surfaced live.
 */
export function previewTaskOutput(title: string, body: string): void {
  const md = `# ${title}\n\n${body}`;
  dispatchPreview(wrapMarkdownInHtml(md));
}

function wrapMarkdownInHtml(md: string): string {
  const escaped = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIVO Task Output</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"><\/script>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; padding: 1.5rem; max-width: 820px; margin: 0 auto; line-height: 1.6; }
    h1,h2,h3 { font-weight: 700; margin-top: 1.2em; }
    h1 { font-size: 1.6rem; border-bottom: 1px solid #e5e7eb; padding-bottom: .4rem; }
    h2 { font-size: 1.25rem; }
    pre { background: #0f172a; color: #e2e8f0; padding: .75rem; border-radius: .5rem; overflow-x: auto; font-size: .8rem; }
    code { background: #f1f5f9; padding: .1em .3em; border-radius: .25em; font-size: .85em; }
    pre code { background: transparent; padding: 0; }
    table { border-collapse: collapse; width: 100%; margin: .75rem 0; }
    th, td { border: 1px solid #e5e7eb; padding: .4rem .6rem; text-align: left; font-size: .85rem; }
    blockquote { border-left: 3px solid #cbd5e1; padding-left: .75rem; color: #475569; }
  </style>
</head>
<body>
  <article id="content"></article>
  <script>
    const src = ${JSON.stringify(escaped)};
    document.getElementById('content').innerHTML = marked.parse(src.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>'));
  <\/script>
</body>
</html>`;
}

function getCssFromContent(content: string): string {
  const cssRegex = /```css\n([\s\S]*?)```/gi;
  const matches = [...content.matchAll(cssRegex)];
  return matches.map(m => m[1]).join('\n');
}

function wrapInHtml(body: string, css: string = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIVO Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <style>${css}</style>
  <script>
    // Forward console to parent
    const _origLog = console.log;
    const _origError = console.error;
    const _origWarn = console.warn;
    function _send(level, args) {
      try {
        window.parent.postMessage({ type: 'tivo-console', level, message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      } catch {}
    }
    console.log = function() { _send('log', arguments); _origLog.apply(console, arguments); };
    console.error = function() { _send('error', arguments); _origError.apply(console, arguments); };
    console.warn = function() { _send('warn', arguments); _origWarn.apply(console, arguments); };
    window.onerror = function(msg, src, line) { _send('error', [msg + ' (line ' + line + ')']); };
  <\/script>
</head>
<body>
${body}
</body>
</html>`;
}

function wrapReactInHtml(jsxCode: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TIVO Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script>
    const _origLog = console.log;
    const _origError = console.error;
    const _origWarn = console.warn;
    function _send(level, args) {
      try {
        window.parent.postMessage({ type: 'tivo-console', level, message: Array.from(args).map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
      } catch {}
    }
    console.log = function() { _send('log', arguments); _origLog.apply(console, arguments); };
    console.error = function() { _send('error', arguments); _origError.apply(console, arguments); };
    console.warn = function() { _send('warn', arguments); _origWarn.apply(console, arguments); };
    window.onerror = function(msg, src, line) { _send('error', [msg + ' (line ' + line + ')']); };
  <\/script>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel">
    ${jsxCode}

    // Try to find and render the default export or App component
    try {
      const components = [typeof App !== 'undefined' && App, typeof Default !== 'undefined' && Default].filter(Boolean);
      if (components.length > 0) {
        const Root = components[0];
        ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Root));
      }
    } catch (e) {
      console.error('Render error:', e.message);
      document.getElementById('root').innerHTML = '<pre style="color:red;padding:1rem">' + e.message + '</pre>';
    }
  <\/script>
</body>
</html>`;
}

function dispatchPreview(html: string) {
  window.dispatchEvent(new CustomEvent('tivo-preview-update', { detail: { html } }));
  // Also signal tab switch
  window.dispatchEvent(new CustomEvent('tivo-switch-tab', { detail: { tab: 'preview' } }));
}
