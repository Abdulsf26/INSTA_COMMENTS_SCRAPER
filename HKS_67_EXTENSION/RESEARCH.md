# HKS_67 v5 research notes

The supplied jakubkrehel UI skills were workspace-installed and inspected; see `docs/UI-SKILLS.md`. The existing native-browser stack was kept rather than adding React/shadcn or copying UIverse components. Control hierarchy, disclosure and table readability informed the refresh; no claim is made that those libraries are installed.

The optional provider implementation uses the OpenAI Responses endpoint, `store:false`, explicit consent, fixed origin and transient key handling. No paid account call was made; availability is checked only at request time for the user's own account.

CSV cannot implement spreadsheet formatting. Excel was verified as an actual OOXML package using independent CRC checks and openpyxl, including native chart and embedded-image relationships. One historical returned CDN GIF remained retrievable on 2026-10-30; that does not establish blanket URL availability.

## Historical collection/media research (retained; not a new authenticated scrape)

# Research / engineering decisions

## Evidence priority

1. Actual raw comment shapes from the user's earlier authorized 624-row collection.
2. Actual live response flags and cursor behavior observed during that run.
3. Real Chrome MV3 integration tests with controlled network fixtures.
4. Maintained open-source client implementations and Chrome API documentation.
5. Third-party scraper documentation as a schema lead, not proof that every field is retrievable.

## Media findings

The actual dataset contains `giphy_media_info` with provider IDs/title/is_sticker and `images.fixed_height.{url,mp4,webp,width,height,..._size}`. Those distinct URLs are preserved as renditions. Other records contain only `media_comment_info.placeholder_text: "Photo unavailable"`. Reconstructing a photo URL from a comment ID would be fabrication, so these remain explicit unavailable assets. A direct URL being returned is not proof it is still downloadable later.

Third-party schema descriptions corroborate that GIF links can be returned while photo/video comments may expose only placeholders:

- https://apify.com/crawlerbros/instagram-comment-scraper
- https://apify.com/calm_builder/instagram-comments-scraper

These commercial pages are not dependencies or services used by this extension, and their performance/completeness claims are not adopted here. No API key or Giphy lookup is required for the returned variants.

## Pagination findings

The live root response supplied `has_more_comments: false`, `has_more_headload_comments: true` and `next_min_id`. The latter direction still had comments. Reply responses also distinguish head and tail flags. Head/tail booleans are combined and returned cursors are validated rather than stopping at the first false boolean. Ended cursors plus mismatched counts remain partial, not complete.

Useful open-source reference:

- https://github.com/subzeroid/instagrapi/blob/master/instagrapi/mixins/comment.py
- https://subzeroid.github.io/instagrapi/usage-guide/comment.html

Internal endpoint support varies. This code does not use fabricated LSD tokens, hardcoded unverified GraphQL doc IDs, or a top-level comment query reused as a reply query.

## Chrome architecture

- Content scripts own collection in the source tab; a popup or full-width extension page controls them.
- A service worker owns only the single-writer lease and tab-close cleanup, not the long-running collector or Blob download creation.
- Session-storage leases survive service-worker suspension; serialized claims prevent simultaneous overwrites. Heartbeats and expiry bound stale locks.
- Popup summaries avoid serializing all raw objects every polling tick; full snapshots are requested for review/export.
- Blob URLs and download links are created in the extension page, not the MV3 worker.
- Real fixture tests verify Chrome storage, runtime messages, same-tab refresh, pause/resume and downloads.

References:

- https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts
- https://developer.chrome.com/docs/extensions/develop/concepts/network-requests
- https://developer.chrome.com/docs/extensions/reference/api/storage
- https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle
- https://playwright.dev/docs/chrome-extensions
- https://github.com/lexmount/moli/tree/main/skills

## Safe rendering / exports

CSV cannot carry animated media or column-width formatting. It stores readable display labels plus URLs and normalized media JSON. A separate Media CSV avoids conflating rendition rows with comment counts. HTML is the visual representation: escaped JSON, textContent rendering, safe URL schemes, explicit per-asset loading and no automatic external resources. Spreadsheet-like values are escaped in CSV; original strings remain in JSON.

No output renderer evaluates user comment text, inserts it as HTML or automatically follows URLs found in arbitrary comment text. Unknown fields remain in raw mode instead of being silently invented into a fixed schema.
