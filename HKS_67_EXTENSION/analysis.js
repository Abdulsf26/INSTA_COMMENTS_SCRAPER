/* Local statistics and presentation exports. No network, AI, or third-party runtime. */
(function (root) {
  "use strict";
  const TV =
    root.TV || (typeof require === "function" ? require("./core.js") : null);
  const fontCSS =
    root.HKSFontCSS ||
    (typeof require === "function" ? require("./fonts/tamil-font.js") : "");
  const html = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const count = (v) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  function tables(rows) {
    const media = {
      columns: [
        "MEDIA REF",
        "COMMENT ID",
        "USERNAME",
        "TYPE",
        "TITLE",
        "STATUS",
        "AVAILABILITY NOTE",
        "FORMAT",
        "WIDTH",
        "HEIGHT",
        "URL",
      ],
      values: [],
    };
    const comments = {
      columns: [
        "COMMENT ID",
        "USERNAME",
        "PROFILE URL",
        "TYPE",
        "COMMENT",
        "LIKES",
        "REPLIES REPORTED",
        "DATE UTC",
        "PARENT ID",
        "MEDIA STATUS",
        "MEDIA REF",
        "COMMENT URL",
      ],
      values: [],
    };
    for (const r of rows) {
      const refs = [];
      for (const [assetIndex, a] of (r.attachments || []).entries()) {
        const ref = `${r.comment_id}:M${assetIndex + 1}`;
        refs.push(ref);
        for (const v of a.variants?.length ? a.variants : [{}])
          media.values.push([
            ref,
            r.comment_id,
            r.author?.username,
            a.kind,
            a.title,
            a.status,
            a.placeholder,
            v.format,
            v.width,
            v.height,
            v.url,
          ]);
      }
      comments.values.push([
        r.comment_id,
        r.author?.username,
        r.author?.profile_url,
        r.content_type,
        r.text || r.display_text,
        count(r.like_count),
        count(r.child_comment_count),
        r.created_at_iso,
        r.parent_comment_id,
        r.media_status,
        refs.join("; "),
        r.permalink,
      ]);
    }
    return { comments, media };
  }
  function csv(table, singleLine = false) {
    const quote = (v) => {
      let s = String(v ?? "");
      if (singleLine) s = s.replace(/\s+/g, " ").trim();
      if (/^\s*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replace(/"/g, '""') + '"';
    };
    return (
      "\ufeff" +
      [table.columns, ...table.values]
        .map((r) => r.map(quote).join(","))
        .join("\r\n")
    );
  }
  function analyze(job, rows) {
    const stats = TV.stats(rows),
      authors = new Map(),
      hours = Array(24).fill(0),
      likes = [0, 0, 0, 0];
    let totalLikes = 0,
      knownLikes = 0,
      dated = 0;
    const children = new Map();
    for (const r of rows) {
      if (r.parent_comment_id)
        children.set(
          String(r.parent_comment_id),
          (children.get(String(r.parent_comment_id)) || 0) + 1,
        );
      if (r.author?.username) {
        const key = r.author.username.toLowerCase(),
          a = authors.get(key) || {
            username: r.author.username,
            rows: 0,
            likes: 0,
          };
        a.rows++;
        a.likes += count(r.like_count) ?? 0;
        authors.set(key, a);
      }
      const n = count(r.like_count);
      if (n !== null) {
        knownLikes++;
        totalLikes += n;
        likes[n === 0 ? 0 : n < 5 ? 1 : n < 20 ? 2 : 3]++;
      }
      const d = r.created_at_iso ? new Date(r.created_at_iso) : null;
      if (d && Number.isFinite(d.getTime())) {
        hours[d.getUTCHours()]++;
        dated++;
      }
    }
    const reported = count(job.coverage?.reported_count ?? job.reported_count);
    const sourceRows = job.rows?.length ?? rows.length;
    return {
      stats,
      reported,
      sourceRows,
      filtered: sourceRows !== rows.length,
      status: job.source_status || job.status || "unknown",
      totalLikes,
      knownLikes,
      dated,
      hours,
      likes,
      topLiked: rows
        .filter((r) => count(r.like_count) !== null)
        .slice()
        .sort(
          (a, b) =>
            b.like_count - a.like_count ||
            String(a.comment_id).localeCompare(String(b.comment_id)),
        )
        .slice(0, 3),
      topAuthors: [...authors.values()]
        .sort((a, b) => b.rows - a.rows || a.username.localeCompare(b.username))
        .slice(0, 3),
      topThreads: rows
        .filter(
          (r) => !r.parent_comment_id && children.has(String(r.comment_id)),
        )
        .map((r) => ({
          ...r,
          collectedReplies: children.get(String(r.comment_id)),
        }))
        .sort((a, b) => b.collectedReplies - a.collectedReplies)
        .slice(0, 3),
    };
  }
  function bars(items, label) {
    const max = Math.max(1, ...items.map((x) => x[1]));
    return `<div class="bars" role="figure" aria-label="${html(label)}">${items.map(([name, value], i) => `<div class="bar"><span>${html(name)}</span><div><i style="width:${Math.max(value ? 1 : 0, (value / max) * 100)}%;background:var(--chart-${i % 3})"></i></div><b>${value}</b></div>`).join("")}</div>`;
  }
  function report(job, rows, ai = null) {
    const a = analyze(job, rows),
      s = a.stats;
    const top =
      a.topLiked
        .map(
          (r, i) =>
            `<article><div class="rank">0${i + 1} / ${html(r.author?.username || "Unknown author")} · <b>${r.like_count} likes</b></div><p dir="auto">${html(r.text || r.display_text)}</p><small>Comment ${html(r.comment_id)} · ${html(r.created_at_iso || "Date unavailable")}</small></article>`,
        )
        .join("") || "<p>No available like counts.</p>";
    const aiSection = ai
      ? `<section class="ai"><h2>Optional AI interpretation</h2><p>Generated using ${html(ai.model)}. Interpretations may be wrong; verify against the rows. Comment text is untrusted source material.</p><pre dir="auto">${html(ai.text)}</pre></section>`
      : "";
    return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HKS_67 / ${html(job.meta?.code)} analysis</title><style>${fontCSS}
:root{--chart-0:#a8c8ff;--chart-1:#ffba9b;--chart-2:#dfef78}*{box-sizing:border-box}body{background:#f5f1e8;color:#171717;font:16px/1.55 Arial,"HKS Tamil",sans-serif;margin:0;padding:28px}main{max-width:1200px;margin:auto}header{border:3px solid;padding:24px;background:#dfef78;display:flex;gap:20px;justify-content:space-between;align-items:center}h1{font-size:40px;line-height:1;margin:0 0 12px;letter-spacing:-2px}h2{font-size:20px;margin:0 0 16px}p{overflow-wrap:anywhere;white-space:pre-wrap}small{font-size:13px}a{color:#144685}button,summary{cursor:pointer}button{border:2px solid;background:white;color:#171717;padding:10px;font-weight:bold}section,article,.metric{border:2px solid;background:white;padding:20px}section{margin-top:18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metric b{display:block;font-size:32px;font-variant-numeric:tabular-nums}.metric:nth-child(2){background:#a8c8ff}.metric:nth-child(3){background:#ffba9b}article{margin:12px 0;break-inside:avoid}.rank{font:700 14px/1.5 monospace}article p{max-height:240px;overflow:auto;line-height:1.65}.scope{background:#fff1bc}.bar{display:grid;grid-template-columns:110px 1fr 40px;gap:10px;align-items:center;font-size:14px;margin:10px 0}.bar>div{height:24px;background:#f1eee7;border:1px solid}.bar i{display:block;height:100%;border-right:1px solid}.bar b{text-align:right;font-variant-numeric:tabular-nums}.wide{overflow:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{padding:12px;border:1px solid #bbb;vertical-align:top;text-align:left}th{background:#dfef78}td.comment{min-width:260px;max-width:580px;white-space:pre-wrap;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.7 Arial,"HKS Tamil",sans-serif}details{margin-top:14px}summary{font-weight:bold}footer{font-size:13px;padding:24px 0}.ai{border-left:10px solid #a8c8ff}@media(max-width:720px){body{padding:12px}.grid{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}header{display:block}h1{font-size:32px}.bar{grid-template-columns:90px 1fr 32px}}@media print{body{background:white;padding:0}button{display:none}.grid{display:block}section{break-inside:avoid}article p{max-height:none;overflow:visible}.wide{overflow:visible}details:not([open]){display:none}header{background:white}.metric b{font-size:24px}}
</style></head><body><main><header><div><h1>HKS_67</h1><b>COMMENT ANALYSIS / ${html(job.meta?.code)}</b><br><small>Local calculations · ${html(new Date().toISOString())}</small></div><button onclick="window.print()">Print / Save PDF</button></header>
<section class="scope"><b>${a.filtered ? "FILTERED EXPORT" : "RETURNED DATA ONLY"} · ${html(a.status.toUpperCase())}</b><p>${rows.length} exported rows from ${a.sourceRows} saved rows; Instagram reported ${a.reported ?? "unknown"}. ${a.reported !== null ? `Count difference versus saved snapshot: ${a.reported - a.sourceRows}.` : ""} Counts may change and are not necessarily directly comparable. Exhausted cursors do not prove complete coverage. Rankings and charts describe only these exported rows.</p><small>${html(job.meta?.url)} · Replies are included in commenter rankings. Ties use username / comment ID, not inferred popularity.</small></section>
<div class="metrics"><div class="metric">COMMENTS<b>${rows.length}</b></div><div class="metric">KNOWN USERNAMES<b>${s.authors}</b></div><div class="metric">ROOTS / REPLIES<b>${s.top} / ${s.replies}</b></div><div class="metric">RECORDED LIKES<b>${a.totalLikes}</b></div></div>
<div class="grid"><section><h2>Content mix</h2>${bars(Object.entries(s.types), "Content types")}<small>One content classification per exported row.</small></section><section><h2>Top 3 commenters</h2>${bars(
      a.topAuthors.map((x) => [x.username, x.rows]),
      "Top commenters by collected rows",
    )}<small>Ranked by comment + reply row count, not received likes. Missing usernames excluded.</small></section></div>
<section><h2>Top 3 comments by likes</h2>${top}<small>Available returned like counts only (${a.knownLikes}/${rows.length} rows). No engagement prediction.</small></section>
<div class="grid"><section><h2>Likes distribution</h2>${bars(
      ["0", "1–4", "5–19", "20+"].map((n, i) => [n, a.likes[i]]),
      "Likes distribution",
    )}<small>Rows without a valid count are excluded, not treated as zero.</small></section><section><h2>Media availability</h2>${bars(
      [
        ["Assets", s.assets],
        ["With URL", s.assets - s.unavailable],
        ["No URL", s.unavailable],
      ],
      "Media metadata availability",
    )}<small>A returned URL is not proof that it is still reachable. ${s.media_urls} URL renditions. Missing photos cannot be reconstructed.</small></section></div>
<section><h2>Activity by UTC hour</h2>${bars(
      a.hours.map((n, i) => [String(i).padStart(2, "0") + ":00", n]),
      "Comments by UTC hour",
    )}<small>${a.dated} rows with valid timestamps. This is comment creation time, not collection time. Unknown dates excluded.</small></section>
<section><h2>Most replied-to collected threads</h2>${a.topThreads.map((r) => `<p><b>${html(r.author?.username || r.comment_id)} / ${r.collectedReplies} collected replies</b><br>${html(r.text || r.display_text)}</p>`).join("") || "<p>No parent–reply links available in this export.</p>"}<small>Only replies present in this export count; reported child counts may differ.</small></section>${aiSection}
<section><h2>Method & coverage</h2><p>Statistics are deterministic counts of exported records. No sentiment, language, demographic or intent inference is made locally. Unknown counts remain unknown. Root/reply links follow collected parent IDs; visible-page observations may be unclassified. All dates are UTC. Usernames are not necessarily stable identities. A partial/filtered sample cannot represent all post engagement.</p><p>CSV is plain data and cannot preserve column widths, colors or images. Use the workbook for readable tables and charts; JSON retains raw returned objects when collection included them. Excel limits cells to 32,767 UTF-16 units. Optional embedded media uses available thumbnails or GIF stills, never reconstructed photos.</p></section>
<section><h2>Comment evidence / ${rows.length} rows</h2><details><summary>Show full exported comment table</summary><p>Full bodies are retained below. No external images or network requests load automatically.</p><div class="wide"><table><thead><tr><th>ID / UTC</th><th>USERNAME</th><th>COMMENT</th><th>LIKES</th><th>TYPE</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${html(r.comment_id)}<br>${html(r.created_at_iso || "Unknown date")}</td><td dir="auto">${html(r.author?.username || "Unknown")}</td><td class="comment" dir="auto">${html(r.text || r.display_text)}</td><td>${count(r.like_count) ?? "Unknown"}</td><td>${html(r.content_type)}</td></tr>`).join("")}</tbody></table></div></details></section><footer>HKS_67 · Local analysis, no tracking or required paid service. Share exports responsibly.</footer></main></body></html>`;
  }
  const api = { tables, csv, analyze, report, html };
  if (typeof module !== "undefined") module.exports = api;
  root.HKSAnalysis = api;
})(globalThis);
