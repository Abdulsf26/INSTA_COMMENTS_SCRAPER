"use strict";
const $ = (id) => document.getElementById(id);
let tab,
  job = null,
  full = null,
  connected = false,
  imported = false,
  busy = false,
  page = 0,
  timer,
  settingsLoaded = false;
const PAGE = 30;
let activePanel = "collect",
  renderKey = "";
const failedMedia = new Set();
function notice(s) {
  $("notice").textContent = s;
}
async function send(cmd, extra = {}) {
  if (!tab?.id || !tab.url?.startsWith("https://www.instagram.com/"))
    throw Error("Open an Instagram post and reload it after installing.");
  const r = await chrome.tabs.sendMessage(tab.id, {
    app: "threadvault",
    cmd,
    ...extra,
  });
  if (r?.error) throw Error(r.error);
  return r;
}
function filter(rows) {
  const q = $("search").value.trim().toLowerCase(),
    type = $("type").value;
  let out = rows.filter(
    (r) =>
      (type === "all" || r.content_type === type) &&
      (!q ||
        (
          (r.display_text ?? r.text ?? "") +
          " " +
          (r.author?.username ?? "") +
          " " +
          (r.attachments ?? [])
            .map(
              (a) =>
                (a.title ?? "") +
                " " +
                (a.placeholder ?? "") +
                " " +
                a.kind +
                " " +
                (a.asset_id ?? ""),
            )
            .join(" ")
        )
          .toLowerCase()
          .includes(q)),
  );
  if ($("sort").value === "recent")
    out.sort(
      (a, b) => (b.created_at ?? -Infinity) - (a.created_at ?? -Infinity),
    );
  if ($("sort").value === "likes")
    out.sort((a, b) => (b.like_count ?? -1) - (a.like_count ?? -1));
  return out;
}
function element(tag, text, cls) {
  const e = document.createElement(tag);
  if (text !== undefined) e.textContent = text;
  if (cls) e.className = cls;
  return e;
}
function preview(asset) {
  const box = element("div", undefined, "preview-box");
  const candidates = (asset.variants ?? [])
    .filter(
      (v) =>
        TV.safeURL(v.url) &&
        ["gif", "webp", "jpg", "jpeg", "png", "mp4", "webm"].includes(v.format),
    )
    .sort(
      (a, b) =>
        (["mp4", "webm"].includes(a.format) ? 1 : 0) -
        (["mp4", "webm"].includes(b.format) ? 1 : 0),
    )
    .slice(0, 8);
  if (!candidates.length) box.classList.add("unavailable");
  const caption = element("div", asset.title || asset.kind, "preview-caption");
  const holder = element("div");
  box.append(holder, caption);
  const link = TV.safeURL(asset.primary_url);
  let sourceLink;
  if (link) {
    sourceLink = element("a", "Open media ↗");
    sourceLink.href = link;
    sourceLink.target = "_blank";
    sourceLink.rel = "noopener noreferrer";
    box.append(sourceLink);
  }
  function tryNext() {
    holder.replaceChildren();
    const v = candidates.find((x) => !failedMedia.has(x.url));
    if (!v) {
      holder.append(
        element(
          "div",
          candidates.length
            ? "Preview blocked or expired. Rerun collection for fresh links."
            : asset.placeholder ||
                (link
                  ? "Open the link to view this asset."
                  : "No media URL was returned."),
          "preview-failed",
        ),
      );
      if (candidates.length) {
        const retry = element("button", "Retry preview");
        retry.onclick = () => {
          candidates.forEach((x) => failedMedia.delete(x.url));
          tryNext();
        };
        holder.append(retry);
      }
      return;
    }
    if (sourceLink) sourceLink.href = TV.safeURL(v.url);
    const video = ["mp4", "webm"].includes(v.format);
    const media = element(video ? "video" : "img");
    media.referrerPolicy = "no-referrer";
    if (video) {
      media.controls = true;
      media.preload = "metadata";
      media.playsInline = true;
    } else {
      media.loading = "lazy";
      media.alt = asset.title || asset.kind;
      media.width = 118;
      media.height = 80;
    }
    media.onerror = () => {
      failedMedia.add(v.url);
      tryNext();
    };
    media.src = TV.safeURL(v.url);
    holder.append(media);
  }
  tryNext();
  return box;
}
function renderRows(force = false) {
  if (activePanel !== "review") return;
  const rows = filter(full?.rows ?? job?.recent ?? []);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  page = Math.min(page, pages - 1);
  const visible = rows.slice(page * PAGE, (page + 1) * PAGE);
  $("review-scope").textContent = full
    ? `${full.rows.length} rows in snapshot. ${job?.status === "running" ? "Load a fresh snapshot for later pages." : ""}`
    : "Showing 30 recent rows. Load a full snapshot for all collected rows.";
  const key = JSON.stringify([
    page,
    rows.length,
    !!full,
    $("previews").checked,
    visible.map((r) => [
      r.comment_id,
      r.display_text,
      r.like_count,
      r.primary_media_url,
      (r.attachments ?? []).map((a) => a.status),
    ]),
  ]);
  if (!force && key === renderKey) return;
  renderKey = key;
  $("rows").replaceChildren();
  for (const r of visible) {
    const tr = element("tr"),
      author = element("td"),
      comment = element("td"),
      likes = element("td", String(r.like_count ?? "—"));
    author.append(
      element("b", r.author?.username ?? "Unknown"),
      element(
        "span",
        r.created_at_iso?.replace("T", " ").slice(0, 19) ?? "No date",
        "row-meta",
      ),
      element(
        "span",
        r.parent_comment_id
          ? "↳ Reply"
          : r.depth === null
            ? "Unclassified"
            : "Root",
        "row-meta",
      ),
    );
    const body = r.text || r.display_text || "[Empty]";
    if (body.length > 260) {
      const detail = element("details", undefined, "comment-detail"),
        summary = element(
          "summary",
          body.slice(0, 180) + "… Read full comment",
        );
      summary.dir = "auto";
      const text = element("div", body, "comment-text");
      text.dir = "auto";
      detail.append(summary, text);
      comment.append(detail);
    } else {
      const text = element("div", body, "comment-text");
      text.dir = "auto";
      comment.append(text);
    }
    comment.append(element("span", r.content_type ?? "unknown", "chip"));
    for (const a of r.attachments ?? []) {
      comment.append(
        element(
          "span",
          a.primary_url ? a.kind + " · link" : a.kind + " · unavailable",
          "chip" + (!a.primary_url ? " missing" : ""),
        ),
      );
    }
    if ($("previews").checked && (r.attachments?.length ?? 0)) {
      const strip = element("div", undefined, "media-strip");
      for (const a of r.attachments.slice(0, 2)) strip.append(preview(a));
      if (r.attachments.length > 2)
        strip.append(
          element(
            "span",
            "+" + (r.attachments.length - 2) + " more assets in export",
            "row-meta",
          ),
        );
      comment.append(strip);
    } else {
      const url = TV.safeURL(r.primary_media_url);
      if (url) {
        const a = element("a", "Open media ↗", "row-meta");
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        comment.append(a);
      }
    }
    tr.append(author, comment, likes);
    $("rows").append(tr);
  }
  if (!rows.length) {
    const tr = element("tr"),
      td = element("td", "No matching rows.");
    td.colSpan = 3;
    tr.append(td);
    $("rows").append(tr);
  }
  $("row-count").textContent =
    `${rows.length ? page * PAGE + 1 : 0}–${Math.min((page + 1) * PAGE, rows.length)} / ${rows.length} ${full ? "snapshot" : "recent"} rows`;
  $("previous").disabled = page === 0;
  $("next").disabled = page >= pages - 1;
}
function paint() {
  const stats = job?.stats ?? TV.stats([]);
  $("total").textContent = stats.total.toLocaleString();
  $("threads").textContent = `${stats.top} / ${stats.replies}`;
  $("media").textContent = stats.media_comments;
  $("assets").textContent = `${stats.assets} / ${stats.media_urls}`;
  $("status").textContent = (
    imported
      ? "IMPORTED / " + (job?.source_status ?? "unknown")
      : (job?.status ?? "ready")
  ).toUpperCase();
  $("connection").textContent = imported
    ? "Imported JSON · review only"
    : connected
      ? "Connected to source tab"
      : "Source tab unavailable · saved snapshot";
  $("dot").className = "dot" + (connected && !imported ? " online" : "");
  $("post").textContent = job?.meta?.code
    ? "Post / " + job.meta.code
    : "Open an Instagram post";
  $("phase").textContent =
    job?.phase ??
    (job
      ? "Saved collection"
      : "Comments, replies, GIFs and returned media metadata.");
  const reported =
    Number(job?.reported_count ?? job?.coverage?.reported_count) || 0;
  $("progress").style.width =
    (reported ? Math.min(100, (stats.total / reported) * 100) : 0) + "%";
  $("coverage").textContent =
    `${stats.total} unique · reported ${reported || "unknown"} · ${job?.pending_threads ?? 0} pending threads`;
  $("checkpoint").textContent = job?.updated_at
    ? "Saved " +
      new Date(job.updated_at).toLocaleTimeString() +
      (job.checkpoint_bytes
        ? " · " + (job.checkpoint_bytes / 1048576).toFixed(1) + " MB"
        : "")
    : "No checkpoint";
  const error =
    job?.last_error ?? (job?.error ? TV.errorInfo(job.error) : null);
  $("error-box").hidden = !error;
  if (error) {
    $("error-title").textContent = error.code;
    $("error-message").textContent = error.message;
    $("error-hint").textContent = error.hint;
  }
  const warnings = [];
  if (job?.checkpoint_bytes > 8 * 1048576)
    warnings.push(
      "Checkpoint is nearing the default storage quota. Export now; consider compact mode for the next collection.",
    );
  if (job?.status === "partial" || job?.source_status === "partial")
    warnings.push(
      "Partial coverage: " +
        stats.total +
        " unique rows; Instagram reports " +
        (reported || "unknown") +
        ".",
    );
  if (job?.coverage?.thread_count_gaps)
    warnings.push(
      job.coverage.thread_count_gaps + " reply thread(s) have count gaps.",
    );
  if (stats.unavailable)
    warnings.push(stats.unavailable + " media asset(s) have no returned URL.");
  if (!connected && !imported)
    warnings.push(
      "Live control is disconnected. Open the source post and reload after installing. Saved data can still be exported.",
    );
  $("warning-box").hidden = !warnings.length;
  $("warning-box").textContent = warnings.join(" ");
  const running =
    (job?.runtime_running || ["running", "reloading"].includes(job?.status)) &&
    !imported;
  $("start").disabled = running || busy;
  $("pause").disabled = !running || busy || !connected;
  $("resume").disabled = running || busy || !connected || !job || imported;
  $("load-all").disabled = busy || !job;
  $("export-toggle").disabled = busy || !stats.total;
  $("ask-chatgpt").disabled = busy || !stats.total;
  for (const id of [
    "csv",
    "xlsx",
    "media-csv",
    "json",
    "html",
    "archive",
    "detailed-csv",
  ])
    $(id).disabled = busy || !stats.total;
  $("requests").textContent = (job?.metrics?.requests ?? 0) + " requests";
  $("retries").textContent = (job?.metrics?.retries ?? 0) + " retries";
  $("duplicates").textContent =
    (job?.metrics?.duplicates ?? 0) + " duplicate IDs";
  $("pages").textContent = (job?.pages ?? 0) + " pages/scans";
  $("log").textContent = job?.log?.join("\n") || "Waiting for a collection.";
  $("gaps").textContent = JSON.stringify(
    job?.coverage ?? { note: "Final coverage checks run after traversal." },
    null,
    2,
  );
  renderRows();
  if (job?.options && !settingsLoaded) {
    $("mode").value = job.options.mode ?? "api";
    $("limit").value = job.options.limit ?? 0;
    $("delay").value = job.options.delay ?? 2500;
    for (const [id, key] of [
      ["include", "replies"],
      ["raw", "raw"],
      ["autoResume", "autoResume"],
      ["reloadOnce", "reloadOnce"],
    ])
      $(id).checked =
        job.options[key] !== undefined ? !!job.options[key] : id === "raw";
    settingsLoaded = true;
  }
}
async function refresh() {
  if (imported || busy) return;
  try {
    const r = await send("summary");
    job = r.job;
    if (job) job.runtime_running = r.running;
    connected = true;
  } catch {
    connected = false;
    if (!job) {
      const saved = await chrome.storage.local.get("threadvault_checkpoint");
      if (saved.threadvault_checkpoint) {
        full = saved.threadvault_checkpoint;
        full.rows = full.rows.map((r) => TV.enrich(r, full.meta));
        job = TV.summarize(full);
        if (job.status === "running") job.status = "paused";
      }
    }
  }
  paint();
}
async function getFull(force = false) {
  if (imported || (full && !force)) return full;
  try {
    const r = await send("results");
    full = r.job;
    connected = true;
  } catch {
    connected = false;
    if (full && full.meta.code === job?.meta?.code) {
      notice("Source unavailable: using the last loaded snapshot.");
      return full;
    }
    const d = await chrome.storage.local.get("threadvault_checkpoint");
    const saved = d.threadvault_checkpoint;
    if (saved && job?.meta?.code && saved.meta.code !== job.meta.code)
      throw Error(
        "Saved checkpoint belongs to another post; it cannot replace this collection.",
      );
    full = saved;
  }
  if (!full) throw Error("No saved rows to export.");
  full.rows = full.rows.map((r) => TV.enrich(r, full.meta));
  return full;
}
for (const cmd of ["start", "pause", "resume"])
  $(cmd).onclick = async () => {
    try {
      if (
        cmd === "start" &&
        (job?.stats?.total ?? 0) > 0 &&
        !confirm("Replace the saved collection? Export it first if needed.")
      )
        return;
      imported = false;
      full = null;
      await send(cmd, {
        options: {
          mode: $("mode").value,
          autoResume: $("autoResume").checked,
          reloadOnce: $("reloadOnce").checked,
          replies: $("include").checked,
          raw: $("raw").checked,
          delay: $("delay").value,
          limit: $("limit").value,
        },
      });
      notice(
        cmd === "pause"
          ? "Pause requested; finishing the checkpoint."
          : "Collection command accepted.",
      );
      await refresh();
    } catch (e) {
      notice(e.message);
    }
  };
$("load-all").onclick = async () => {
  busy = true;
  paint();
  try {
    await getFull(!imported);
    page = 0;
    notice("Full snapshot loaded.");
  } catch (e) {
    notice(e.message);
  } finally {
    busy = false;
    paint();
  }
};
function saveFile(content, name, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function download(kind) {
  // Request optional CDN access directly in the user gesture, before async work.
  let embed = false;
  if (kind === "xlsx" && $("embed-xlsx").checked) {
    try {
      embed = await chrome.permissions.request({
        origins: HKSThumbnails.ORIGINS,
      });
    } catch {}
  }
  busy = true;
  paint();
  try {
    const snapshot = await getFull(!imported),
      rows = $("filtered-export").checked
        ? filter(snapshot.rows)
        : snapshot.rows;
    const base = `HKS_67-${snapshot.meta.code}-${Date.now()}${$("filtered-export").checked ? "-filtered" : ""}`;
    let extra = "";
    if (kind === "xlsx") {
      const options = embed
        ? await HKSThumbnails.collect(rows, notice)
        : {
            mediaNote: $("embed-xlsx").checked
              ? "CDN permission declined. Linked media retained; no binaries fetched."
              : "Embedding not requested.",
          };
      const file = TVXLSX.workbook(snapshot, rows, options);
      saveFile(
        file.bytes,
        base + ".xlsx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      extra = ` ${file.truncated_cells} oversized cells truncated; ${file.cleaned_cells} XML-control cells cleaned. ${options.mediaNote}`;
    }
    if (kind === "csv")
      saveFile(
        HKSAnalysis.csv(HKSAnalysis.tables(rows).comments, true),
        base + ".csv",
        "text/csv;charset=utf-8",
      );
    if (kind === "detailed-csv") {
      const t = TV.commentTable(rows);
      t.columns = t.columns.map((x) => x.toUpperCase().replace(/_/g, " "));
      saveFile(
        HKSAnalysis.csv(t),
        base + "-detailed.csv",
        "text/csv;charset=utf-8",
      );
    }
    if (kind === "media-csv")
      saveFile(
        HKSAnalysis.csv(HKSAnalysis.tables(rows).media),
        base + "-media.csv",
        "text/csv;charset=utf-8",
      );
    if (kind === "html")
      saveFile(
        HKSAnalysis.report(snapshot, rows),
        base + "-analysis.html",
        "text/html;charset=utf-8",
      );
    if (kind === "archive")
      saveFile(
        TV.report(snapshot, rows)
          .replace(/ThreadVault/g, "HKS_67")
          .replace("<style>", "<style>" + HKSFontCSS)
          .replace(/Arial,sans-serif/g, 'Arial,"HKS Tamil",sans-serif'),
        base + "-media-archive.html",
        "text/html;charset=utf-8",
      );
    if (kind === "json") {
      const { owner, ...clean } = snapshot;
      saveFile(
        JSON.stringify(
          {
            ...clean,
            version: 5,
            rows,
            export_scope: $("filtered-export").checked ? "filtered" : "all",
            coverage_note:
              "Returned records only. Missing media URLs and count gaps are not bypassed.",
          },
          null,
          2,
        ),
        base + ".json",
        "application/json",
      );
    }
    notice(`Export prepared: ${rows.length} rows.${extra}`);
  } catch (e) {
    notice("Export failed: " + e.message);
  } finally {
    busy = false;
    paint();
  }
}
for (const kind of [
  "csv",
  "xlsx",
  "media-csv",
  "json",
  "html",
  "archive",
  "detailed-csv",
])
  $(kind).onclick = () => {
    setExportMenu(false);
    download(kind);
  };
$("diagnostics").onclick = () => {
  const d = {
    version: TV.VERSION,
    meta: job?.meta,
    status: job?.status,
    phase: job?.phase,
    coverage: job?.coverage,
    metrics: job?.metrics,
    last_request: job?.last_request,
    last_error: job?.last_error,
    errors: job?.errors,
    log: job?.log,
    source_connected: connected,
  };
  saveFile(
    JSON.stringify(d, null, 2),
    "HKS_67-diagnostics.json",
    "application/json",
  );
  notice("Diagnostics exported without comment bodies or credentials.");
};
$("import").onchange = async (e) => {
  try {
    const f = e.target.files[0];
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) throw Error("Import limit is 20 MB.");
    const d = JSON.parse(await f.text()),
      rows = d.rows ?? d.comments;
    if (!Array.isArray(rows) || rows.length > 30000)
      throw Error("Expected rows/comments array (maximum 30,000).");
    const meta = d.meta;
    if (!meta || !/^[\w-]+$/.test(meta.code ?? meta.shortcode ?? ""))
      throw Error("Missing valid post metadata.");
    meta.code ??= meta.shortcode;
    meta.mediaId ??= TV.mediaId(meta.code);
    meta.url =
      TV.safeURL(meta.url ?? meta.post_url) ??
      `https://www.instagram.com/p/${meta.code}/`;
    const clean = rows
      .map((c) => {
        if (!c || typeof c !== "object") return null;
        const r = TV.enrich(c, meta);
        if (!r.comment_id || !Array.isArray(r.attachments)) return null;
        r.attachments = r.attachments.slice(0, 50).map((a) => ({
          ...a,
          variants: (Array.isArray(a.variants) ? a.variants : [])
            .slice(0, 200)
            .filter((v) => TV.safeURL(v.url))
            .map((v) => ({ ...v, url: TV.safeURL(v.url) })),
          primary_url: TV.safeURL(a.primary_url),
        }));
        r.primary_media_url = TV.safeURL(r.primary_media_url);
        return r;
      })
      .filter(Boolean);
    full = {
      ...d,
      source_status: d.source_status ?? d.status ?? "unknown",
      meta,
      rows: clean,
      status: "imported",
      phase: "Imported archive · collection controls disabled",
      log: [
        "Imported locally for review. Collection controls do not resume this file.",
      ],
    };
    job = TV.summarize(full);
    imported = true;
    page = 0;
    notice(
      "Imported " +
        clean.length +
        " rows. Original checkpoint was not changed.",
    );
    paint();
  } catch (err) {
    notice("Import failed: " + err.message);
  } finally {
    e.target.value = "";
  }
};
for (const id of ["search", "type", "sort"])
  $(id).oninput = () => {
    page = 0;
    renderRows();
  };
$("previous").onclick = () => {
  page--;
  renderRows();
};
$("next").onclick = () => {
  page++;
  renderRows();
};
for (const b of document.querySelectorAll(".tab"))
  b.onclick = () => {
    activePanel = b.dataset.panel;
    for (const p of ["collect", "review", "activity"])
      $(p).hidden = p !== b.dataset.panel;
    document.querySelectorAll(".tab").forEach((x) => {
      x.classList.toggle("active", x === b);
      x.setAttribute("aria-pressed", String(x === b));
    });
    renderRows(true);
  };
$("previews").onchange = () => renderRows(true);
function setExportMenu(open) {
  if (!open && $("export-menu").contains(document.activeElement))
    $("export-toggle").focus();
  $("export-menu").hidden = !open;
  $("export-toggle").setAttribute("aria-expanded", String(open));
}
$("export-toggle").onclick = () => {
  const open = $("export-menu").hidden;
  setExportMenu(open);
  if (open) $("export-menu").querySelector("button:not(:disabled)")?.focus();
};
$("export-menu").addEventListener("keydown", (e) => {
  const buttons = [
    ...$("export-menu").querySelectorAll("button:not(:disabled)"),
  ];
  const n = buttons.indexOf(document.activeElement);
  if (["ArrowDown", "ArrowUp", "Home", "End", "Escape"].includes(e.key)) {
    e.preventDefault();
    if (e.key === "Escape") {
      setExportMenu(false);
      $("export-toggle").focus();
    } else
      buttons[
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? buttons.length - 1
            : (n + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
              buttons.length
      ]?.focus();
  }
});
document.addEventListener("click", (e) => {
  if (!e.target.closest(".export-control")) setExportMenu(false);
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") setExportMenu(false);
});
$("expand").onclick = () =>
  chrome.tabs.create({
    url:
      chrome.runtime.getURL("popup.html") +
      "?workspace=1&tab=" +
      encodeURIComponent(tab?.id ?? ""),
  });
(async () => {
  const params = new URLSearchParams(location.search);
  if (params.has("workspace")) {
    document.body.classList.add("workspace");
    $("expand").hidden = true;
  }
  const id = Number(params.get("tab"));
  if (id > 0) {
    try {
      tab = await chrome.tabs.get(id);
    } catch {}
  }
  if (!tab)
    [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await refresh();
  timer = setInterval(refresh, document.hidden ? 4000 : 1200);
})();
window.addEventListener("pagehide", () => clearInterval(timer));
