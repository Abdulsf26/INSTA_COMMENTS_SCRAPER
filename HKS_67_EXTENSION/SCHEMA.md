# HKS_67 v5 export schema

## Presentation exports

The clean comment table has these uppercase columns:

`COMMENT ID`, `USERNAME`, `PROFILE URL`, `TYPE`, `COMMENT`, `LIKES`, `REPLIES REPORTED`, `DATE UTC`, `PARENT ID`, `MEDIA STATUS`, `MEDIA REF`, `COMMENT URL`.

Media references are stable comment-scoped keys `COMMENT_ID:M1`, `COMMENT_ID:M2`, etc. The Media table has `MEDIA REF`, `COMMENT ID`, `USERNAME`, `TYPE`, `TITLE`, `STATUS`, `AVAILABILITY NOTE`, `FORMAT`, `WIDTH`, `HEIGHT`, `URL`. A missing rendition produces an explicit metadata-only row, not a fake URL.

Clean CSV flattens body whitespace; Detailed CSV preserves multiline bodies and all original normalized columns (uppercase display headings). JSON preserves original types/objects. Do not infer workbook URL targets from the short visible labels: complete targets are in hyperlink relationships. IDs are text in the workbook.

Overview charts are native Excel chart objects with literal snapshot series: content-type counts and the top three commenters by collected row count. Charts describe the export snapshot; they are not formulas that recalculate against edits to the Comments sheet. Two structured Excel tables cover Comments and Media. Optional thumbnail drawings are one PNG still per selected row, maximum 20; GIF animation is not embedded.

Rankings: available nonnegative numeric like counts only; ties use comment-ID string order. Commenters combine case-insensitive usernames and count root + reply rows; ties use username order. Missing usernames are excluded from commenter rankings, not reconstructed from other fields. Thread rankings count exported parent links, not reported child totals. Date histograms use valid ISO timestamps converted to UTC.

Import retains `source_status` while displaying imported/review-only mode. Coverage still refers to the saved collection, not automatically to a filtered subset. Optional API prompts contain full selected text plus compact metadata, not the raw archive or signed media URLs.

## Original normalized collector schema (retained for compatibility)

# ThreadVault 3 data dictionary

## Comment record

`comment_id` is the primary key. `parent_comment_id` joins a reply to a root comment. Null parent and depth 0 means root for direct-API rows; null depth in DOM data means classification was not established. Do not infer a root from every null parent.

| Field | Meaning |
|---|---|
| `text` | Original returned text, including empty strings for media-only comments. |
| `display_text` | Readable text or an attachment label such as `[GIF: Seeman GIF]` or `[IMAGE: Photo unavailable]`. |
| `content_type` | `text`, `gif`, `sticker`, `image`, `video`, `shared_post`, `album`, `mixed`, `unknown_media`, or `empty`. Based on returned shape; not visual recognition. |
| `media_status` | `none`, `url_available`, `unavailable`, `metadata_only`, or `mixed_availability`. |
| `attachments` | Array of normalized media assets, each with zero or more variants. |
| `primary_media_url` | Convenient first available attachment URL. Not a verified/downloaded binary. |
| `created_at` / `created_at_iso` | Normalized Unix seconds / UTC ISO time. Invalid/unknown values are null with warnings; raw value remains in raw mode. |
| `like_count`, `child_comment_count` | Returned counts; missing is null, not invented zero. Counts can change. |
| `author` | Available ID, handle, full name, verification/private flags, profile/avatar URL. No additional profile crawling is performed. |
| `is_edited`, `is_pinned`, `viewer_has_liked`, `is_hidden` | Available response flags; absent values are null. Not guesses. |
| `mentions`, `hashtags` | Parsed username and Unicode hashtag lists from text. These are extraction helpers, not a comprehensive linguistic parser. |
| `text_length` | Unicode code-point count, not a grapheme-cluster count. |
| `source` / `relationship_confidence` | Direct API, observed response, DOM, or imported provenance and thread confidence. |
| `warnings` | Such as `media_url_not_returned`, `invalid_timestamp`, `invalid_text_type`, `unsafe_numeric_id`. |
| `first_seen_at` / `last_seen_at` | Collector observation times for newly collected v3 rows. Legacy migrations do not invent historical observation times. These are in JSON. |
| `raw` | Original returned comment object, retained by default. Unknown future fields remain here. Absent in compact mode. |
| `post_url`, `permalink`, `media_id`, `shortcode` | Post identity and a best-effort `/c/{id}/` link. Instagram may not scroll/focus it in every UI. |

## Attachment

`kind`, `provider`, `asset_id`, `title`, `alt_text`, `placeholder`, `source_field`, `is_sticker`, `status`, `primary_url`, and `variants`.

An attachment with only an ID remains `metadata_only`; no Giphy lookup or reconstructed CDN URL is invented. A placeholder is `unavailable`. A returned URL is `url_available`, even if it later expires. A generic photo placeholder alongside actual GIF data is retained as a fallback annotation, not automatically treated as a second photograph.

Variant fields:

- `url`: returned HTTP(S) URL. Unsafe schemes or URL credentials are rejected.
- `format`: extension/key-derived format, such as GIF, MP4, WebP, JPEG. Null when unknown; no download/MIME sniffing is performed.
- `role`: `preview` or `media`, inferred from field paths.
- `width`, `height`, `size_bytes`: supplied metadata where available, otherwise null. These are not independently measured.
- `source_path`: exact path in the returned media object, e.g. `giphy_media_info.images.fixed_height.mp4`.

Bounded discovery searches only recognized or attachment/media-named object roots, skips author/child-comment objects, and limits depth, array width and visited nodes. Extremely large/deep future objects may only be retained in raw JSON. This is deliberate resource protection, not a claim to support every possible future schema.

## CSV layout

**Comments CSV:** one record per comment. `display_text` and `content_type` are the first fields to use when reviewing media-only comments. `media_urls` contains newline-separated variants; `media_json` contains the full normalized attachment array. Author columns are flattened with `author_` names.

**Media CSV:** join on `comment_id`. One row per variant, or one row with blank URL for each unavailable/ID-only asset. Multiple rows with the same comment/asset ID are renditions, not duplicate comments. Includes provider, asset ID/title, kind, status, placeholder, URL, format, role, width/height/size and source path.

CSV is UTF-8 with BOM and proper quoting. It has no column widths, embedded photos, animation, or workbook formatting. Use Excel's import-as-Text for long IDs. Formula-like strings are prefixed with an apostrophe for spreadsheet safety. JSON retains original strings without this CSV-specific defense.

## Coverage and progress

A final direct-mode coverage object includes:

- Unique rows, root/reply counts and latest reported overall count.
- `thread_count_gaps` and `reply_gaps`: parent ID, expected replies and collected replies.
- `all_returned_cursors_exhausted`: termination of the currently supported cursor paths; not a proof of all visible/hidden entries.

The job holds metrics, errors, log, pages, phase, last request, next-request hint, checkpoint byte size, options, cursor state and timestamps. Lightweight summaries omit raw/full rows and cursor-thread tables and include recent rows plus aggregate statistics. A checkpoint is not the same as an importable/resumable JSON review archive.

## Import / HTML report

JSON review imports accept an array named `rows` or `comments`, valid post metadata, up to 30,000 rows and 20 MB. They are local review-only views. The HTML report embeds escaped JSON and renders untrusted fields with textContent. It shows the first 100 matching rows, supports further batches/search and loads linked media only after a specific button click. It is not an offline media-byte backup.
