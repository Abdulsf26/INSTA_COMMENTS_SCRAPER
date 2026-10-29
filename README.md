<div align="center">

# 🟦 HKS_67

**Collect Instagram comments. Export clean data. Understand the conversation.**

![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat-square&logo=javascript&logoColor=black)
![HTML](https://img.shields.io/badge/HTML-E34F26?style=flat-square&logo=html5&logoColor=white)
![CSS](https://img.shields.io/badge/CSS-1572B6?style=flat-square&logo=css&logoColor=white)
![Chrome MV3](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=flat-square&logo=googlechrome&logoColor=white)
![Local First](https://img.shields.io/badge/Privacy-Local_First-16A085?style=flat-square)
![Free Core](https://img.shields.io/badge/Core-Free-8E44AD?style=flat-square)

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
| 🟡 **Source included** | Readable, inspectable code with no runtime package dependencies. |

> **AI is optional:** API use may cost money. ChatGPT handoff requires your review and manual submission.

## 🟪 Quick start

1. Extract the extension ZIP.
2. Open `chrome://extensions` → **Developer mode** → **Load unpacked**.
3. Select `HKS_67`, reload your Instagram post, and start collection.
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
| `tests/` | Collector, media, export, browser and accessibility checks. |
| `ARCHITECTURE.md` | Module ownership and safe maintenance. |
| `SCHEMA.md` | Record fields and export formats. |
| `VALIDATION.md` | Test results, coverage and known limits. |
| `RESEARCH.md` / `CHANGELOG.md` | Research notes and release changes. |
| `docs/` / `tools/` | Review points, documentation and validation builders. |

## 🟥 Know the limits

- **Partial stays partial:** historical sample = **624 / 639 reported comments**.
- Missing photo URLs cannot be recreated; available URLs can expire.
- Desktop Chrome/Edge only; storage is approximately **10 MB by default**.
- Use authorized access, respect privacy and follow platform terms.

## ✅ Checked

**85 grouped checks passed** + accessibility/layout audits + real 624-row export validation.

## 🤝 Thank you

Built with care by **Abdul Rahuman M · Shiv Nadar University**.

Thanks to the open developer community, [Jakub Krehel’s UI skills](https://github.com/jakubkrehel/skills), and the Noto font contributors.

<sub>Source is included for inspection and modification; consult applicable licenses before redistribution. Badge images load on GitHub or with internet access.</sub>
