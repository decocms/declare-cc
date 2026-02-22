---
milestone: M-27-inline-file-viewer-with-markdown-rendering
action: A-58
type: execute
wave: 2
depends_on:
  - A-57
files_modified:
  - src/server/public/app.js
  - src/server/public/index.html
autonomous: true
declarations:
  - D-08
user_setup: []

must_haves:
  truths:
    - "Clicking a file path in the action detail panel opens a modal overlay showing file content"
    - "Markdown files (.md) are rendered as formatted HTML with headings, lists, code blocks, bold, italic, links"
    - "Non-markdown files are shown as syntax-highlighted or monospace preformatted text"
    - "The modal can be closed with Escape key or clicking the backdrop or an X button"
    - "File paths in the exec-plan 'Files' badges are clickable"
  artifacts:
    - path: "src/server/public/app.js"
      provides: "File viewer modal logic, markdown-to-HTML converter, file path click handlers"
      contains: "renderMarkdown"
    - path: "src/server/public/index.html"
      provides: "Modal overlay DOM structure and CSS styles"
      contains: "file-viewer-modal"
  key_links:
    - from: "file badge click in exec-plan detail"
      to: "openFileViewer()"
      via: "click event on .file-link elements"
      pattern: "file-link.*click|openFileViewer"
    - from: "openFileViewer()"
      to: "/api/files?path="
      via: "fetch call"
      pattern: "fetch.*api/files"
    - from: "renderMarkdown()"
      to: "file-viewer-modal content area"
      via: "innerHTML assignment"
      pattern: "renderMarkdown|innerHTML"
---

<objective>
Build an inline file viewer that opens as a modal overlay when clicking file paths in the action detail panel. Markdown files get full CommonMark rendering; other files display as preformatted text.

Purpose: Users can inspect produced artifacts without leaving the dashboard -- key to D-08 (Live Execution Visibility).
Output: Working modal file viewer integrated into the existing dashboard.
</objective>

<execution_context>
@/Users/guilherme/.claude/get-shit-done/agents/declare-executor.md
@/Users/guilherme/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/MILESTONES.md
@.planning/STATE.md
@.planning/milestones/M-27-inline-file-viewer-with-markdown-rendering/A-57-SUMMARY.md
@src/server/public/app.js
@src/server/public/index.html
@src/server/index.js
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add modal DOM structure and CSS to index.html</name>
  <files>src/server/public/index.html</files>
  <action>
Add the file viewer modal markup and styles to index.html.

**CSS (add to the existing style block, near the overlay styles):**

```css
/* ── File Viewer Modal ── */
#file-viewer-modal {
  display: none;
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  justify-content: center;
  align-items: center;
  padding: 40px;
}
#file-viewer-modal.open {
  display: flex;
}
.file-viewer-container {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  width: 100%;
  max-width: 820px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
}
.file-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface2);
  flex-shrink: 0;
}
.file-viewer-path {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  color: var(--text-bright);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.file-viewer-close {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  border-radius: 6px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
  margin-left: 12px;
}
.file-viewer-close:hover {
  color: var(--text-bright);
  border-color: var(--text-dim);
}
.file-viewer-body {
  overflow-y: auto;
  padding: 20px 24px;
  flex: 1;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text);
}
/* Markdown rendered content */
.file-viewer-body.markdown h1 { font-size: 1.6em; font-weight: 700; color: var(--text-bright); margin: 0 0 0.6em; padding-bottom: 0.3em; border-bottom: 1px solid var(--border); }
.file-viewer-body.markdown h2 { font-size: 1.3em; font-weight: 700; color: var(--text-bright); margin: 1.2em 0 0.4em; padding-bottom: 0.25em; border-bottom: 1px solid var(--border); }
.file-viewer-body.markdown h3 { font-size: 1.1em; font-weight: 700; color: var(--text-bright); margin: 1em 0 0.3em; }
.file-viewer-body.markdown h4, .file-viewer-body.markdown h5, .file-viewer-body.markdown h6 { font-size: 1em; font-weight: 700; color: var(--text-bright); margin: 0.8em 0 0.2em; }
.file-viewer-body.markdown p { margin: 0 0 0.8em; }
.file-viewer-body.markdown ul, .file-viewer-body.markdown ol { margin: 0 0 0.8em; padding-left: 1.5em; }
.file-viewer-body.markdown li { margin-bottom: 0.3em; }
.file-viewer-body.markdown li > ul, .file-viewer-body.markdown li > ol { margin-top: 0.3em; margin-bottom: 0; }
.file-viewer-body.markdown code { font-family: 'SF Mono', 'Fira Code', monospace; background: var(--surface2); border: 1px solid var(--border); border-radius: 3px; padding: 1px 5px; font-size: 0.9em; color: var(--act-color); }
.file-viewer-body.markdown pre { background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; overflow-x: auto; margin: 0 0 1em; }
.file-viewer-body.markdown pre code { background: none; border: none; padding: 0; color: var(--text); font-size: 12px; line-height: 1.5; }
.file-viewer-body.markdown blockquote { border-left: 3px solid var(--border); padding: 0.2em 0 0.2em 1em; margin: 0 0 0.8em; color: var(--text-dim); }
.file-viewer-body.markdown a { color: var(--decl-color); text-decoration: none; }
.file-viewer-body.markdown a:hover { text-decoration: underline; }
.file-viewer-body.markdown hr { border: none; border-top: 1px solid var(--border); margin: 1.2em 0; }
.file-viewer-body.markdown table { border-collapse: collapse; margin: 0 0 1em; width: 100%; }
.file-viewer-body.markdown th, .file-viewer-body.markdown td { border: 1px solid var(--border); padding: 6px 10px; text-align: left; font-size: 12px; }
.file-viewer-body.markdown th { background: var(--surface2); font-weight: 700; color: var(--text-bright); }
.file-viewer-body.markdown img { max-width: 100%; }
.file-viewer-body.markdown strong { color: var(--text-bright); font-weight: 700; }
/* Preformatted (non-markdown) */
.file-viewer-body.preformatted {
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--text);
}
/* Clickable file links in exec-plan detail */
.file-link {
  cursor: pointer;
  transition: border-color 0.15s;
}
.file-link:hover {
  border-color: var(--act-color) !important;
  text-decoration: underline;
}
```

**HTML (add just before the closing </body> tag, after the existing overlay div):**

```html
<!-- File Viewer Modal -->
<div id="file-viewer-modal">
  <div class="file-viewer-container">
    <div class="file-viewer-header">
      <span class="file-viewer-path" id="file-viewer-path"></span>
      <button class="file-viewer-close" id="file-viewer-close">&times;</button>
    </div>
    <div class="file-viewer-body" id="file-viewer-body"></div>
  </div>
</div>
```
  </action>
  <verify>Open http://localhost:3847 and verify page loads without visual regressions. Inspect that #file-viewer-modal exists in DOM (hidden by default).</verify>
  <done>Modal DOM and CSS are in index.html, page renders correctly, modal is hidden by default</done>
</task>

<task type="auto">
  <name>Task 2: Add markdown renderer, file viewer logic, and wire file links in app.js</name>
  <files>src/server/public/app.js</files>
  <action>
Add three things to app.js: a vanilla JS CommonMark renderer, the file viewer open/close logic, and make exec-plan file badges clickable.

**1. Add `renderMarkdown(text)` function** (add in the Utilities section near `truncate` and `escHtml`).

Implement a simple but solid markdown-to-HTML converter in vanilla JS. NO external dependencies. It should handle these CommonMark features in this order:

- Fenced code blocks (``` with optional language tag) -- convert to `<pre><code>`, escape HTML inside
- Inline code (backticks) -- convert to `<code>`, escape HTML inside
- Headings (# through ######) -- convert to `<h1>` through `<h6>`
- Horizontal rules (---, ***, ___) -- convert to `<hr>`
- Blockquotes (> prefix, can be multiline) -- convert to `<blockquote><p>`
- Unordered lists (- or * prefix) -- convert to `<ul><li>`
- Ordered lists (1. prefix) -- convert to `<ol><li>`
- Tables (pipe-delimited with header separator) -- convert to `<table>`
- Bold (**text** or __text__) -- convert to `<strong>`
- Italic (*text* or _text_) -- convert to `<em>`
- Links [text](url) -- convert to `<a href>`
- Images ![alt](url) -- convert to `<img>`
- Paragraphs (blank-line separated text blocks) -- convert to `<p>`

Implementation approach: Process the markdown line by line. First extract and replace fenced code blocks (they should not be processed for inline formatting). Then process block-level elements (headings, hrs, blockquotes, lists, tables, paragraphs). Finally apply inline formatting (bold, italic, code, links, images) to non-code-block content.

The function signature: `function renderMarkdown(text)` returns an HTML string.

**2. Add file viewer open/close functions:**

```js
/**
 * Open the file viewer modal for a given file path.
 * Fetches content from /api/files?path=... and renders it.
 * @param {string} filePath
 */
async function openFileViewer(filePath) {
  const modal = document.getElementById('file-viewer-modal');
  const pathEl = document.getElementById('file-viewer-path');
  const bodyEl = document.getElementById('file-viewer-body');

  pathEl.textContent = filePath;
  bodyEl.textContent = 'Loading...';
  bodyEl.className = 'file-viewer-body';
  modal.classList.add('open');

  try {
    const res = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();

    if (data.error) {
      bodyEl.textContent = `Error: ${data.error}`;
      return;
    }

    const isMarkdown = filePath.endsWith('.md');
    if (isMarkdown) {
      bodyEl.className = 'file-viewer-body markdown';
      bodyEl.innerHTML = renderMarkdown(data.content);
    } else {
      bodyEl.className = 'file-viewer-body preformatted';
      bodyEl.textContent = data.content;
    }
  } catch (err) {
    bodyEl.textContent = `Failed to load file: ${err.message}`;
  }
}

function closeFileViewer() {
  document.getElementById('file-viewer-modal').classList.remove('open');
}
```

**3. Wire close handlers** (add near the bottom where other event listeners are registered):

```js
// File viewer modal close handlers
document.getElementById('file-viewer-close').addEventListener('click', closeFileViewer);
document.getElementById('file-viewer-modal').addEventListener('click', (e) => {
  if (e.target.id === 'file-viewer-modal') closeFileViewer(); // backdrop click
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('file-viewer-modal').classList.contains('open')) {
    closeFileViewer();
  }
});
```

**4. Make exec-plan file badges clickable.** In the `loadExecPlan` function, find the section that renders `ep.filesModified` (around line 1355-1362). Change the file badges from plain `<span>` to clickable elements:

Replace the existing filesModified rendering with:
```js
${ep.filesModified.map(f => `<span class="file-link" style="background:var(--act-bg);border:1px solid var(--act-border);color:var(--act-color);border-radius:4px;padding:2px 7px;font-size:10px;font-family:monospace" data-file-path="${escHtml(f)}">${escHtml(f)}</span>`).join('')}
```

Then, after the container.innerHTML assignment in loadExecPlan (after existing event wiring for exec button), add:
```js
// Wire file link clicks to open file viewer
container.querySelectorAll('.file-link').forEach(link => {
  link.addEventListener('click', () => {
    const fp = link.dataset.filePath;
    if (fp) openFileViewer(fp);
  });
});
```

Also make the "Produces" field text in action detail panels clickable where it contains file paths. In the `showDetail` function, for the action type produces section, look for file-path-like strings (containing `/` and ending in known extensions like .md, .js, .ts, .json, .yaml) and wrap them in clickable spans. This is a nice-to-have -- implement it if straightforward, skip if it adds too much complexity.

After all changes, run `npm run build` to rebuild the bundle.
  </action>
  <verify>
1. Run `npm run build` -- must succeed
2. Open http://localhost:3847 in browser
3. Navigate to any action with an exec-plan that has files_modified (e.g., a DONE action)
4. Click a file badge in the exec-plan detail -- modal should open showing file content
5. For .md files, verify headings, lists, code blocks render as formatted HTML
6. For .js files, verify content shows as monospace preformatted text
7. Press Escape -- modal should close
8. Click backdrop -- modal should close
9. Click X button -- modal should close
  </verify>
  <done>File viewer modal opens when clicking file paths in exec-plan detail. Markdown files render with formatted headings, lists, code blocks, bold, italic, links, and tables. Non-markdown files display as preformatted text. Modal closes via Escape, backdrop click, or X button.</done>
</task>

</tasks>

<verification>
- `npm run build` succeeds
- File viewer modal opens from exec-plan file badges
- Markdown rendering handles: headings, lists, code blocks, bold, italic, links, blockquotes, tables, horizontal rules
- Non-markdown files display as preformatted monospace text
- Modal closes via Escape, backdrop click, or X button
- No regressions to existing dashboard functionality
</verification>

<success_criteria>
Clicking any file path badge in the action exec-plan detail opens a modal showing the file's content. Markdown files are rendered with full formatting. The modal is dismissible via Escape, backdrop click, or close button.
</success_criteria>

<output>
After completion, create `.planning/milestones/M-27-inline-file-viewer-with-markdown-rendering/A-58-SUMMARY.md`
</output>
