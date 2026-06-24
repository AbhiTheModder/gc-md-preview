# Google Chat Markdown Preview

A cross-browser (Chrome + Firefox, MV3) extension that adds inline preview
support for `.md` / `.markdown` attachments in Google Chat. Google ships
preview for its own formats (Docs, Sheets, Slides) but not for markdown, so
this fills the gap.

Click the eye icon next to any markdown attachment chip and the file opens in
an overlay dialog with rendered markdown, syntax-highlighted code, a raw
view, and copy/download buttons. No download, no external site.

## Features

- Inline preview modal with rendered markdown (GFM tables, blockquotes)
- Syntax highlighting via highlight.js with auto-language detection
- Raw view with line numbers, toggleable
- XSS-safe: output sanitized with DOMPurify
- Copy to clipboard and download buttons
- Theme-aware: auto-detects Chat's dark/light mode from `body[data-theme]`,
  falling back to OS preference
- Settings page with enabled toggle, theme, default view, max file size,
  file-extension list, and syntax-highlighting toggle
- Toolbar popup for quick toggles (enabled, theme, default view) without
  opening the full settings page
- Live updates: changing a setting applies to open tabs instantly
- Resilient detection using multiple signals (filename + drive type-URL +
  download anchor) so it survives Google's randomized class names

## Build

Requirements: Node 18+ and [`aube`](https://npmjs.com/package/aube) (or npm).

```bash
aube install
aube run build        # → dist/chrome, dist/firefox
```

Watch mode for development:

```bash
aube run dev
```

## Load in the browser

**Chrome / Edge / Brave (Chromium):**

1. Visit `chrome://extensions`
2. Enable Developer mode (top-right)
3. "Load unpacked" → select `dist/chrome/`

**Firefox:**

```bash
aube run firefox      # launches a temporary profile with the extension
```

Or manually: `about:debugging` → "This Firefox" → "Load Temporary Add-on"
→ select `dist/firefox/manifest.json`.

## Usage

1. Open Google Chat (`chat.google.com`)
2. Find a message with a `.md` attachment
3. Click the eye icon that appears next to the existing "open in new tab"
   button
4. The file previews inline. Toggle Rendered/Raw, copy, or download.

## Settings

Open via the toolbar icon → "Open full settings…", or
`chrome://extensions` → Details → Extension options.

| Setting         | Default                    | Description                               |
| --------------- | -------------------------- | ----------------------------------------- |
| `enabled`       | `true`                     | Master switch                             |
| `showEyeButton` | `true`                     | Inject eye-icon button on chips           |
| `theme`         | `auto`                     | `auto` \| `light` \| `dark`               |
| `defaultView`   | `rendered`                 | `rendered` \| `raw`                       |
| `autoLanguage`  | `true`                     | highlight.js auto-detect                  |
| `copyButton`    | `true`                     | Show copy button in modal                 |
| `maxBytes`      | `500000`                   | Truncate above this; download instead     |
| `extensions`    | `md, markdown, mdown, mkd` | Extensions to preview                     |
| `debugLogging`  | `false`                    | Print diagnostic logs to the page console |

## How it works

The content script observes `document.body` for changes (Google Chat is an
SPA) and on each batch scans for chips matching all of:

1. `[role="button"]` with `aria-label`/`title` ending in a configured extension
2. A child `<span>` whose `background-image` points to
   `drive-thirdparty.googleusercontent.com/.../type/text/markdown`
3. A child `<a href>` containing `url_type=DOWNLOAD_URL`

A chip must match the filename plus at least one of the other two signals to
reduce false positives. The download URL is fetched through the extension's
background service worker (which has `host_permissions` for
`chat.usercontent.google.com` and so bypasses CORS) with
`credentials: 'include'` so session cookies are sent automatically. The
response is rendered with `marked`, sanitized with `DOMPurify`, and code
blocks highlighted with `highlight.js`. The modal lives in a closed shadow
DOM to isolate its styles from Google's CSS, and uses the native `<dialog>`
element with `showModal()` so it renders in the browser top layer above all
page content.

## Privacy

All processing is local. File contents are fetched directly from Google
Chat's own attachment URLs using your existing session cookies. Nothing is
sent to any third-party server.

## Project structure

```
src/
├── content/
│   ├── index.js     # entry: MutationObserver, init, storage.onChanged
│   ├── detect.js    # multi-signal chip detection
│   ├── fetch.js     # relay to background worker
│   ├── render.js    # marked + DOMPurify + highlight.js
│   ├── modal.js     # <dialog> overlay, top-layer, a11y
│   ├── theme.js     # resolveTheme + system theme watch
│   └── config.js    # defaults + storage load/onChanged
├── background/
│   └── sw.js        # fetch relay (bypasses CORS for attachment host)
├── popup/           # toolbar popup (quick toggles)
└── options/         # full settings page
```

## Scripts

```bash
aube run build       # production build → dist/{chrome,firefox}
aube run dev         # watch mode
aube run lint        # eslint
aube run lint:fix    # eslint --fix
aube run format      # prettier
aube test            # vitest
aube run firefox     # web-ext run on Firefox
aube run clean       # rm -rf dist
```

## License

MIT
