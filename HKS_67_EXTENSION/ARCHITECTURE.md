# Module ownership

No production build step and no runtime package dependencies. Readable source is shipped.

| File | Responsibility |
|---|---|
| `collector.js` | Authenticated source pagination, scheduling, pause/resume, checkpoints, errors and final coverage. |
| `background.js` | Single-writer tab lease. |
| `observer.js` | Narrow MAIN-world response observation, never sends data to a third-party server. |
| `browser.js` | Visible-page scanning and safe load/reply expansion. |
| `core.js` | Normalization, safe URLs, raw-schema compatibility, statistics, legacy detailed exports and media archive. |
| `popup.js` | Collection/review state, pagination, filters, import, export orchestration and preview fallback. |
| `analysis.js` | Pure local metrics, stable compact export tables, CSV escaping and offline analytical HTML. |
| `xlsx.js` | CRC/ZIP and OOXML worksheets, typed cells, limits, short hyperlinks and styles. |
| `workbook-extras.js` | Native charts, structured tables and optional PNG drawing parts. |
| `thumbnails.js` | Opt-in URL allowlist, bounded CDN fetch/decode/PNG conversion. |
| `ai.js` | Pure prompt construction and fixed-origin optional provider request. No storage access. |
| `ai-ui.js` | Review dialog, manual clipboard/file handoff, host permission, consent and transient key lifecycle. |

## Update safely

Keep the collector protocol/storage IDs until a deliberate migration is implemented. Do not rename `threadvault_checkpoint` as a cosmetic rebrand: that would strand saved work. Raise manifest/package/core versions together. Avoid changing proven cursor semantics for a UI-only change.

When Instagram changes a schema, add a raw-shape fixture to core/media tests before changing normalization. Preserve unknown values and source data rather than making up URLs/counts. When changing spreadsheet parts, run independent ZIP/CRC tests and openpyxl parsing, not just a filename-extension assertion.

All comment/provider output reaches the UI as text nodes or escaped HTML. Do not turn model output into executable HTML. Never add API keys to job options, global persisted state, exports or logs. Permission requests occur in explicit clicks; no automatic paid retries.

The CSS has a base layout and a labelled HKS_67 refresh layer; keep narrow/workspace and reduced-motion overrides explicit. Native controls/dialogs avoid framework bundles and brittle UI dependencies.
