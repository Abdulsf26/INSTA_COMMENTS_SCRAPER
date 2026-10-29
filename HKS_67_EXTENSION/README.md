# HKS_67 — v5.0

A local-first desktop Chrome/Edge extension for collecting Instagram comments and replies returned to your signed-in session. Free collection, CSV/JSON/Excel exports and statistical HTML reports do **not** require an API key, account upgrade, server or build step. Optional AI submission is separate and consent-based.

## Install

1. Clone or download this repository (no ZIP and no build step are required).
2. Open `chrome://extensions` (or `edge://extensions`), enable **Developer mode**, choose **Load unpacked**, and select the `HKS_67_EXTENSION` folder containing `manifest.json`.
3. Sign in normally at **www.instagram.com**, open a post, and reload its tab after installing.
4. Open HKS_67. Keep **Deep pagination**, **Reply threads**, a **root limit of 0**, and a delay of **2500 ms or higher**. Start collection.
5. Keep the original post tab open. The extension popup can close while collection continues. Use **Open workspace** for a larger dashboard.
6. Inspect the coverage warning and log. Pause/resume as needed. **Export before replacing a collection.**

**Upgrading:** export JSON from the old version first. Reloading an extension in the same installation directory preserves its storage identity; installing from a different path may create a new identity. Use **Comments → Import JSON** to review an old archive locally. Import does not replace the live checkpoint and cannot resume that archive's old collection. Internal `threadvault` message/storage identifiers intentionally remain for compatibility; the displayed product is HKS_67.

Desktop Chromium-based browsers only; standard mobile Chrome cannot load this extension. The manifest minimum is Chrome 111, not a claim that every release/device has been tested. Managed devices may block unpacked extensions or optional host permissions.

## What is included

- Compact landscape popup, wider workspace, colorful geometric logo, keyboard-accessible Export dropdown, readable density, explicit loading/error/coverage states.
- Independent root/reply pagination, headload flags, deduplication, checkpoints, pause/resume, source-refresh recovery and a one-writer lease.
- Usernames/profile links, parent IDs, timestamps, likes, returned media variants, flags and optional raw objects.
- Comments table with search/type/sort, 30-row pages, full-text disclosure for long bodies, media fallback and labelled unavailable/expired links.
- Local HTML analysis: top three comments **by returned likes**, top three commenters **by collected root + reply rows**, collected reply-thread ranking, content mix, likes distribution, UTC-hour activity, media availability and full comment evidence.
- Genuine `.xlsx` workbook: **Overview / Comments / Media / Coverage**, two native charts, filterable Excel tables, alternating rows, wrapped text, frozen headers, text IDs and short visible hyperlinks.
- Optional bounded thumbnail embedding and explicit, reviewed ChatGPT/API workflows.

## Export menu

| Format | Purpose |
|---|---|
| CSV | Uppercase headers; separate `USERNAME` / `PROFILE URL`; one physical line per comment; stable media references instead of giant signed media URLs. Body whitespace is compacted. |
| Excel `.xlsx` | Readable formatted tables/charts; original multiline body inside each cell. Long URLs are stored behind `OPEN PROFILE`, `OPEN COMMENT` or `OPEN LINK`. |
| JSON | Full normalized records and raw returned objects when collected. Best lossless archive. |
| Media CSV | One row per rendition, including unavailable assets, dimensions, format, status and complete returned URL. |
| HTML report | Offline statistical analysis, labelled rankings, charts and expandable full evidence table. Print / Save PDF is available in a normal browser. |
| Media archive HTML | Searchable visual archive with explicit per-asset media loading. No automatic remote images. |
| Detailed CSV | All normalized columns with uppercase headings and original multiline text. |

CSV is plain text: it **cannot** save colors, row heights, widths, images or clickable labels that conceal different URL values. Use Excel for presentation. CSV bytes preserve long IDs, but Excel may auto-round them when opening CSV; import ID columns **as text**, or use the workbook, which stores IDs as text. Formula-like CSV text is apostrophe-protected; workbook text is never a formula.

**Export matching rows only** uses current search/type/sort against the full snapshot, not just the visible page. Uncheck to export all saved rows. Each export is a snapshot at click time; exports made while collection grows can differ. Media references use `COMMENT_ID:M1` etc. for stable comment-scoped matching. Workbook sheets are always built from the same snapshot.

## Media: available does not mean recoverable

Inline previews contact the source CDN only when the Comments section and Media previews are enabled. Failed variants fall back; known failures are cached until explicit retry. Images can load lazily as rows enter the viewport. GIFs can animate; videos have controls and do not autoplay. Missing photo URLs remain clearly labelled, never reconstructed.

For Excel, enable **Excel thumbnails · opt-in / max 20** in Comments, then choose Excel. The browser requests optional CDN permissions. Downloads omit cookies, permit only known HTTPS CDN domains, limit each response to 2 MB and each row to an 8-second fetch budget, and try at most 20 eligible comment rows / one thumbnail per row. GIFs become static first frames. Video is not embedded. Large, blocked, expired or unsupported assets stay linked; the Coverage sheet records results. Sequential fetching can take up to approximately 160 seconds in the worst case; use the workspace and keep it open. Declining permissions still produces the linked workbook.

## Ask ChatGPT / optional API

**Ask ChatGPT** first opens a review dialog. It includes every selected comment body, IDs/parents, dates, likes and media descriptions, but excludes raw objects, profile URLs and signed media URLs. You can edit the instructions and omit usernames. **Omitting names is not anonymization**: bodies, mentions and context may identify people.

- **Copy & open ChatGPT:** copies the complete prompt and opens `chatgpt.com`. Paste, review and send manually. No automatic site injection or submission. Account/context limits still apply. If clipboard/new-tab access is blocked, download the complete prompt `.txt` instead.
- **Optional OpenAI API:** enter your own key/model ID, inspect the exact prompt, give explicit data/cost consent, and click Generate. Optional host permission is requested for `api.openai.com` only. The key stays in memory in this window and is cleared on close / request start; it is never written to local storage, checkpoints, diagnostics or exports. Requests omit cookies and set `store:false`; provider retention/billing policies still apply.
- The API path uses `/v1/responses`, defaults to `gpt-4.1-mini` (change to a compatible model your account can access), caps payloads at 500 KB and output at 4,000 tokens, and times out at 90 seconds. Cancellation is best effort and may not prevent provider charges. No automatic paid retry.
- The downloaded AI HTML includes deterministic local charts plus **separately labelled, untrusted AI interpretation** and full evidence. Refusals, output truncation, permission denial, authentication/rate/size errors are surfaced rather than reported as success.

No real paid key was used in release validation. Provider requests/output/error handling were tested with mocks; actual account permissions, model availability, billing and ChatGPT paste/context limits are not certified.

## Coverage and operational limits

- Exhausted cursors are **not proof of completeness**. Reported counts can include inaccessible/deleted/hidden/spam records or change during collection; not every gap can be explained.
- The historical real sample has **624 of 639 reported rows**, not 639 scraped rows: 511 roots + 113 replies; 499 text, 45 GIF and 80 withheld-photo placeholders; 125 assets / 135 URL variants. All 80 missing photo URLs remain missing.
- The new real sample workbook embeds **one actual returned CDN GIF as a still**, fetched on 2026-10-30. The full embedding pipeline also has a separate synthetic GIF integration test. Neither establishes that every URL or photo works.
- `chrome.storage.local` has a roughly 10 MB default quota; warning begins at 8 MB. Saving errors stop collection. Export early, disable raw objects for future compact runs, and do not assume unlimited datasets.
- Import is bounded to 20 MB / 30,000 rows. Excel limits each cell to 32,767 UTF-16 units; oversized cells are truncated and counted in Coverage. JSON remains the lossless fallback.
- Instagram login, endpoint/schema/UI changes, rate limits, network loss, source-tab navigation, sleeping laptops and browser policies can interrupt work. Login/block/rate-limit errors stop rather than attempting bypass. Resume cannot defeat platform restrictions.
- Do not share exports casually: comments, profiles, raw objects and signed URLs may contain personal or short-lived access-bearing data. Use only on content you are authorized to access and follow platform terms/privacy obligations.

## Maintenance and verification

Runtime dependencies: **none**. Native browser JS/CSS/HTML, no CDN library or framework. An offline Noto Sans Tamil fallback (SIL OFL, license in `fonts/OFL.txt`) is bundled for Tamil glyphs and embedded into analysis HTML; no font network request is needed. Development dependencies are only for tests/formatting.

```sh
# The checks below ran in the author's build workspace. Their test files are not
# included in this repository, so these commands cannot be reproduced from here:
npm install
npm test                    # 13 state + 13 media/core + 10 Excel + 14 analysis/AI checks
npx playwright install chromium
npm run test:chrome         # 25 real-extension synthetic integration checks
npm run test:ui             # axe + 320/640/780/1280 CSS viewport checks
MOLI_BIN=/path/to/moli npm run test:browser  # 10 DOM fixture checks
```

`package.json` lists those scripts and the dev-only tooling (Playwright, axe, Prettier) that was used; nothing at runtime imports them. See `VALIDATION.md` for tested boundaries; `SCHEMA.md` for v5 export changes; `ARCHITECTURE.md` for module ownership; `docs/UI-SKILLS.md` for the supplied skill installation/use. The separate arguments PDF is a 24-point structured review using two simulated perspectives, not two independent reviewers. Its editable source and optional ReportLab builder are included under `docs/` and `tools/`.

## License

This extension's own code and documents are released under the **MIT license** — see `../LICENSE` (© 2026 Abdul Rahuman M). The bundled `fonts/tamil-font.js` asset stays under the **SIL Open Font License 1.1** (full text in `fonts/OFL.txt`, source notes in `fonts/README.md`) and is not relicensed by the MIT grant. Nothing here licenses Instagram's service, marks or data.

