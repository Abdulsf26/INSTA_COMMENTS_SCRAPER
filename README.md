<div align="center">

# 🟦 HKS_67

**Collect Instagram comments. Export clean data. Understand the conversation.**

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?style=flat-square&logo=css&logoColor=white)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Local First](https://img.shields.io/badge/Privacy-Local_First-16A085?style=flat-square)
![Free Core](https://img.shields.io/badge/Core-Free-8E44AD?style=flat-square)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

**Abdul Rahuman M · Shiv Nadar University**

</div>

---

## 🟨 What it does

💬 Comments & replies · 🖼️ Available media · 📊 Charts & rankings · 📁 CSV / Excel / JSON / HTML

## 🟦 Simple architecture

```text
Instagram post → Collector → Clean & deduplicate → Local checkpoint
                                                        ↓
                                    CSV · Excel · JSON · HTML
                                                        ↓
                                       Optional reviewed AI
```

## 🟧 Problems → solutions

| Problem | Our solution |
| :--- | :--- |
| Replies hidden behind more pages | Traverse root and reply cursors separately. |
| Duplicate comments | Match and merge by comment ID. |
| Refresh interrupts collection | Save checkpoints and resume cursors. |
| Messy exports and long URLs | Clean CSV, styled Excel and short hyperlink labels. |
| Missing or expired media | Try returned variants; label unavailable assets honestly. |

## 🟩 Why HKS_67?

| Tag | What it means |
| :--- | :--- |
| 🟢 **No extra login** | No HKS_67 account; Instagram still needs your normal signed-in session. |
| 🟣 **No credits** | Local collection, analysis and exports need no paid credits. |
| 🔵 **No imposed comment cap** | No paid tier limit; platform, storage and device limits still apply. |
| 🟠 **No spying** | No telemetry or developer backend; AI sharing is optional and explicit. |
| 🟡 **Source included** | MIT-licensed, readable, inspectable code with no runtime package dependencies. |

> **AI is optional:** API use may cost money. ChatGPT handoff requires your review and manual submission.

## 🟪 Quick start

1. Clone or download this repository — there is no build step and no runtime `npm install`.
2. Open `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Select the `HKS_67_EXTENSION` folder (the one containing `manifest.json`), reload your Instagram post tab, and start collection.
4. Check coverage → export your data.

## 📂 File guide

| File | Contains |
| :--- | :--- |
| `manifest.json` | Extension settings and permissions. |
| `popup.html` / `popup.css` / `popup.js` | Interface, controls and export actions. |
| `collector.js` | Pagination, reply collection and checkpoints. |
| `observer.js` / `browser.js` | Response observation and visible-page collection. |
| `background.js` | Single-writer coordination between tabs. |
| `core.js` | Normalization, safe URLs and shared data helpers. |
| `analysis.js` | Local statistics, rankings, CSV and HTML reports. |
| `xlsx.js` / `workbook-extras.js` | Excel sheets, tables, charts and image drawings. |
| `thumbnails.js` | Optional bounded media downloads. |
| `ai.js` / `ai-ui.js` | Reviewed prompts, consent and optional API requests. |
| `fonts/` / `icons/` | Offline Tamil fallback, license and colorful branding. |
| `package.json` | Dev-only metadata; no runtime dependencies (see **Checked** below for the test scripts). |
| `ARCHITECTURE.md` | Module ownership and safe maintenance. |
| `SCHEMA.md` | Record fields and export formats. |
| `VALIDATION.md` | Test results, coverage and known limits. |
| `RESEARCH.md` / `CHANGELOG.md` | Research notes and release changes. |
| `docs/` / `tools/` | Review points, documentation and validation builders. |
| `USER_REVIEWS_SOLUTIONS.pdf` | 24-point structured release review (two simulated perspectives). |
| `LICENSE` | MIT terms for this repository's own code and documents. |

## 🟥 Know the limits

- **Partial stays partial:** historical sample = **624 / 639 reported comments**.
- Missing photo URLs cannot be recreated; available URLs can expire.
- Desktop Chrome/Edge only; storage is approximately **10 MB by default**.
- Use authorized access, respect privacy and follow platform terms.

## ✅ Checked

**85 grouped checks passed** in the author's build workspace — 13 collector state, 13 media/core, 10 Excel, 14 analysis/AI boundary, 25 Chrome integration and 10 DOM checks — plus accessibility/layout audits and a real 624-row export validation.

The test files themselves are **not part of this repository**, so those `package.json` scripts cannot be run here; the results are documented in `VALIDATION.md` and in `USER_REVIEWS_SOLUTIONS.pdf`. Treat them as reported evidence, not a reproducible claim.

## ⚖️ License

| Part | Terms |
| :--- | :--- |
| This repository's own code and docs | **MIT** — see `LICENSE`, © 2026 Abdul Rahuman M. |
| `HKS_67_EXTENSION/fonts/` | **SIL Open Font License 1.1** for the bundled Noto Sans Tamil (unmodified); full text in `fonts/OFL.txt`. MIT does not relicense the font. |
| Supplied UI guidance | **MIT**, [Jakub Krehel's skills](https://github.com/jakubkrehel/skills), inspected snapshot `592aedc`. |
| Instagram itself | **Not licensed by this project.** No affiliation, access or rights are granted; platform terms and other people's privacy still apply to anything you collect. |

If you redistribute, keep `LICENSE`, `fonts/OFL.txt` and `fonts/README.md` alongside the font asset.

## 🤝 Thank you

Built with care by **Abdul Rahuman M · Shiv Nadar University**.

Thanks to the open developer community, [Jakub Krehel’s UI skills](https://github.com/jakubkrehel/skills), and the Noto font contributors.

<sub>Source is released under the MIT license (font under SIL OFL 1.1) so you can inspect, modify and reuse it with attribution retained. Badge images load on GitHub or with internet access.</sub>
