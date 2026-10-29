# HKS_67 v5.0.0 — release validation

Date: **2026-10-30**, user-local date. Environment: Linux sandbox, headless Chromium **156.0.8078.4**, Playwright **1.64.1**; existing Moli **1.1.19** for DOM fixtures. No authenticated Instagram session or real paid model key was used for the new release tests.

## Completed checks

**85 grouped automated checks passed** (some groups contain several assertions):

| Suite | Groups | Evidence |
|---|---:|---|
| Collector state | 13 | `tests/test.cjs`, `tests/unit-results.txt` |
| Media/core | 13 | `tests/media-test.cjs`, same unit log |
| Excel | 10 | `tests/xlsx-test.cjs`, same unit log |
| Local analysis / API boundary | 14 | `tests/hks-test.cjs`, same unit log |
| Packaged Chrome extension | 25 | `tests/chrome-e2e.cjs`, `tests/chrome-results.txt` |
| Moli visible-page DOM | 10 | `tests/browser-test.cjs`, `tests/browser-results.json` |

Additional completed audits, **not counted as extra members of the 85**:

- Offline bundled Tamil fallback successfully decoded through the browser Font Loading API; font license ships with the asset.
- Automated axe WCAG A/AA checks reported zero violations in setup, comment review and the AI consent dialog.
- No document-level horizontal overflow at **320, 640, 780, 1280 CSS px**; the evidence table may scroll inside its own bounded region.
- Genuine 624-row HTML: three ranked comments, explicit PARTIAL / 624 versus 639, **624 expanded evidence rows**, zero automatic HTTP requests, zero page errors, zero axe A/AA violations. Log: `tests/real-624-report-results.txt`.
- Independent openpyxl parsing of the real workbook: **Overview / Comments / Media / Coverage**, **2 native charts**, **1 embedded actual CDN GIF still**, **624 comment rows + header**, **215 media rows + header**, text ID cells and profile hyperlinks. The synthetic embedded-image workbook independently parsed too.
- PDF: **10 pages**, selectable text, all **24 numbered review points**, current grouped-test count and explicit limits.
- Production JS syntax checks passed. Native runtime has no package/CDN dependency. Source was formatted with Prettier; formatting tools are not bundled into the runtime.

## Covered behaviors

- Single-writer lease, root/reply headload pagination, duplicate protection, same-tab reload recovery, pause/reload/manual resume, count mismatch and fail-closed schema behavior.
- HTTP 429 stops after one request; no automatic rate-limit or paid-model retry. Typed errors and diagnostics; import cannot overwrite the saved checkpoint.
- Single collapsed Export dropdown, full-snapshot filtered exports, real OOXML download, safe JSON, media CSV, explicit media-archive loading and script-termination escaping.
- Preview variant fallback after 403, no endless retry loop, preview off switch, compact popup/Escape behavior.
- Correct rankings, case-insensitive commenter grouping, valid-count/UTC-date handling, explicit filtered versus saved coverage, formula-protected CSV and stable media references.
- Complete AI-prompt preview/download, username omission, explicit consent guard, no key in storage, immediate key clearing on Escape.
- Consented API UI produces downloadable escaped AI HTML using **mocked provider and permission boundaries**. Request body excludes the key, uses `store:false`, sends to the fixed endpoint, and provider echo of the fixture key is redacted. This is not a live paid-account test.
- API error/empty-output/incomplete-output/oversize/model-validation behavior via deterministic mocks.
- Actual GIF fixture fetch/decode/canvas conversion/PNG embedding; allowlisted HTTPS origins reject credentials/deceptive domains/arbitrary local hosts.

## Real sample provenance and limits

The sample is the **historical collected dataset**, re-exported through v5. It is not a new live scrape:

- **624 unique rows / 639 reported**, still partial; 511 roots + 113 replies; 0 known orphan replies.
- 499 text, 45 GIF, **80 photo placeholders with no returned photo URL**.
- 125 assets / 135 returned rendition URLs / 215 media-table rows.
- One returned CDN GIF was successfully fetched and converted to a still for the new sample workbook. Its success does not prove all other URLs work. No missing photo was reconstructed.
- Reported-count difference is 15; this is not a proven list of exactly 15 recoverable comments or an explanation of the source's counting rules.

## Review corrections made

1. Reduced oversized unavailable-media cards.
2. Added explicit long-comment disclosure instead of unreachable clipping.
3. Preserved/displayed original partial status after import.
4. Fixed selected-tab hover contrast found by axe.
5. Cleared transient API key on native Escape/cancel, close and pagehide.
6. Prevented a cancelled AI request from downloading a late result.
7. Replaced giant visible spreadsheet URLs with short hyperlink labels.
8. Used stable comment-scoped media references rather than export-order-only numbering.
9. Kept model output escaped and separately labelled.

## Not verified / not promised

- Fresh authenticated live collection after the redesign; complete coverage of the historical post.
- Windows/macOS hardware, every laptop, enterprise policy, every historic Chrome/Edge release, sleep/network transitions on every OS.
- Real screen-reader testing, exhaustive RTL/localization, OS-level 200% browser zoom on every browser. CSS viewport tests do not certify those.
- Desktop Microsoft Excel / LibreOffice visual rendering; OOXML structures/charts/images were parsed independently, not manually certified in every spreadsheet application.
- Every media URL, codec, expiry condition or photo source. GIFs are stills in Excel, not animation.
- Real paid API access, billing, model availability, cancellation refund behavior, provider retention, or ChatGPT clipboard/paste/upload/context/account limits. Manual handoff never auto-submits the website.
- Unlimited storage/datasets. Default local quota is approximately 10 MB, warning at 8 MB; oversized Excel cells are explicitly truncated with JSON as lossless fallback.

**Release assessment:** no blocking issue observed in the covered fixtures and local real-data exports. Suitable for controlled desktop use with visible partial-coverage warnings and the stated external-service/device limits—not a universal compatibility or completeness guarantee.
