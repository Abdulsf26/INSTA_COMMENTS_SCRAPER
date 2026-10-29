# Offline Tamil fallback

`tamil-font.js` is a generated asset containing the unmodified Noto Sans Tamil variable TTF as a base64 CSS font-face. It provides the `HKS Tamil` CSS fallback family, is used only by extension pages, and is embedded into HTML exports. It does not change the Instagram page or require a network font request.

Source: https://github.com/google/fonts/tree/main/ofl/notosanstamil
Fetched file: `NotoSansTamil[wdth,wght].ttf` (340,668 bytes), during the 2026-10-30 local-date release build.
License: SIL Open Font License 1.1; full copyright/license in `OFL.txt`. CSS aliasing does not change the font's internal identity.

The extension has an actual browser font-decode check in `tests/ui-audit.cjs`. Emoji and other scripts still use the user's platform font fallbacks; this is not a promise that every Unicode glyph is available on every OS.
