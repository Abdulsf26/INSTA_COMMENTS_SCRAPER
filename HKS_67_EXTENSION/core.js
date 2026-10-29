(function (root) {
  "use strict";
  const VERSION = "5.0.0",
    alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  function mediaId(code) {
    if (!/^[\w-]+$/.test(code)) throw Error("Invalid shortcode");
    return [...code]
      .reduce((n, c) => n * 64n + BigInt(alphabet.indexOf(c)), 0n)
      .toString();
  }
  function safeURL(v) {
    if (typeof v !== "string" || v.length > 16000) return null;
    try {
      const u = new URL(v);
      return ["https:", "http:"].includes(u.protocol) &&
        !u.username &&
        !u.password
        ? u.href
        : null;
    } catch {
      return null;
    }
  }
  function timestamp(v) {
    if (v === null || v === undefined || v === "")
      return { unix: null, iso: null, invalid: false };
    let ms;
    if (typeof v === "string" && !/^\d+(?:\.\d+)?$/.test(v)) ms = Date.parse(v);
    else {
      const n = Number(v);
      ms = n > 1e12 ? n : n * 1000;
    }
    const valid = Number.isFinite(ms) && Math.abs(ms) <= 8640000000000000;
    return {
      unix: valid ? ms / 1000 : null,
      iso: valid ? new Date(ms).toISOString() : null,
      invalid: !valid,
    };
  }
  function media(node) {
    const attachments = [],
      warnings = [];
    const gkey = ["giphy_media_info", "gif_media", "giphy_media"].find(
      (k) => node[k] != null,
    );
    const g = gkey ? node[gkey] : null;
    function asset(value, kind, source) {
      if (value === null || value === undefined) return;
      const obj = typeof value === "object" ? value : { id: String(value) };
      const a = {
        kind,
        provider: source.includes("giph") ? "giphy" : null,
        asset_id: obj.gif_media_id ?? obj.id ?? obj.pk ?? null,
        title: obj.title ?? null,
        alt_text: obj.alt_text ?? null,
        placeholder: obj.placeholder_text ?? null,
        source_field: source,
        is_sticker: obj.is_sticker ?? (kind === "sticker" ? true : null),
        status: "metadata_only",
        primary_url: null,
        variants: [],
      };
      if (a.asset_id != null) a.asset_id = String(a.asset_id);
      const seen = new Set();
      let visits = 0;
      function walk(x, path, depth = 0, dimensions = {}) {
        if (x == null || depth > 10 || ++visits > 3000) return;
        if (typeof x === "string") {
          const url = safeURL(x);
          const key = path.split(".").at(-1);
          if (
            url &&
            (/(?:url|src|mp4|webp|gif|image|video|thumbnail|preview)/i.test(
              key,
            ) ||
              /\.(?:gif|jpe?g|png|webp|mp4|webm)(?:\?|$)/i.test(url)) &&
            !seen.has(url)
          ) {
            seen.add(url);
            const pathname = new URL(url).pathname;
            let format =
              /\.([a-z0-9]{2,5})$/i.exec(pathname)?.[1]?.toLowerCase() ?? null;
            if (!format && /mp4|webp|gif/.test(key)) format = key;
            const role = /thumb|preview|poster/i.test(path)
              ? "preview"
              : "media";
            a.variants.push({
              url,
              format,
              role,
              width: dimensions.width ?? null,
              height: dimensions.height ?? null,
              size_bytes:
                dimensions[`${key}_size`] ??
                (key === "url" ? dimensions.size : null) ??
                null,
              source_path: path,
            });
          }
          return;
        }
        if (Array.isArray(x)) {
          x.slice(0, 100).forEach((v, i) =>
            walk(v, path + "." + i, depth + 1, dimensions),
          );
          return;
        }
        if (typeof x === "object") {
          const dims = { ...dimensions, ...x };
          for (const [k, v] of Object.entries(x)) {
            if (
              [
                "user",
                "owner",
                "caption",
                "preview_child_comments",
                "child_comments",
              ].includes(k)
            )
              continue;
            walk(v, path + "." + k, depth + 1, dims);
          }
        }
      }
      walk(obj, source);
      a.variants.sort((x, y) => {
        const rank = (v) =>
          (v.role === "preview" ? 20 : 0) +
          (v.format === "gif"
            ? 0
            : ["webp", "jpg", "jpeg", "png"].includes(v.format)
              ? 1
              : v.format === "mp4"
                ? 2
                : 3);
        return rank(x) - rank(y);
      });
      a.primary_url = a.variants[0]?.url ?? null;
      a.status = a.variants.length
        ? "url_available"
        : a.placeholder
          ? "unavailable"
          : "metadata_only";
      attachments.push(a);
    }
    if (g) asset(g, g.is_sticker ? "sticker" : "gif", gkey);
    else if (node.gif_media_id)
      asset({ gif_media_id: node.gif_media_id }, "gif", "gif_media_id");
    const m = node.media_comment_info;
    if (m) {
      const hint = String(m.placeholder_text ?? "");
      const kind = /photo|image/i.test(hint)
        ? "image"
        : /video/i.test(hint)
          ? "video"
          : /reel|post|album/i.test(hint)
            ? "shared_post"
            : "unknown_media";
      // A generic photo placeholder can accompany the same GIF; do not invent a second attachment.
      if (!g || Object.keys(m).some((k) => k !== "placeholder_text"))
        asset(m, kind, "media_comment_info");
      else if (attachments[0]) attachments[0].placeholder = hint || null;
    }
    for (const [k, kind] of [
      ["image_versions2", "image"],
      ["video_versions", "video"],
      ["media_share", "shared_post"],
      ["shared_media", "shared_post"],
      ["sticker", "sticker"],
      ["sticker_info", "sticker"],
    ])
      if (node[k]) asset(node[k], kind, k);
    if (node.carousel_media)
      asset(node.carousel_media, "album", "carousel_media");
    for (const k of Object.keys(node)) {
      if (
        /(?:attachment|media|sticker|gif)/i.test(k) &&
        ![
          "media_id",
          "share_enabled",
          "liked_by_media_coauthors",
          "giphy_media_info",
          "gif_media",
          "giphy_media",
          "gif_media_id",
          "media_comment_info",
          "image_versions2",
          "video_versions",
          "media_share",
          "shared_media",
          "sticker",
          "sticker_info",
          "carousel_media",
        ].includes(k) &&
        node[k] &&
        typeof node[k] === "object"
      )
        asset(node[k], "unknown_media", k);
    }
    const types = [...new Set(attachments.map((a) => a.kind))];
    const hasURLs = attachments.some((a) => a.primary_url);
    const missing = attachments.some((a) => !a.primary_url);
    const status = !attachments.length
      ? "none"
      : hasURLs
        ? missing
          ? "mixed_availability"
          : "url_available"
        : attachments.some((a) => a.placeholder)
          ? "unavailable"
          : "metadata_only";
    if (missing) warnings.push("media_url_not_returned");
    return {
      attachments,
      type:
        types.length > 1
          ? "mixed"
          : (types[0] ?? (node.text ? "text" : "empty")),
      status,
      warnings,
    };
  }
  function normalize(n, meta, parent = null) {
    if (!n || typeof n !== "object") return null;
    const rawID = n.pk ?? n.id ?? "";
    const id = String(rawID);
    if (!id) return null;
    const a = n.user ?? n.owner ?? {},
      t = timestamp(n.created_at ?? n.created_at_utc ?? null),
      text = typeof n.text === "string" ? n.text : "";
    const m = media(n);
    const warnings = [...m.warnings];
    if (t.invalid) warnings.push("invalid_timestamp");
    if (n.text != null && typeof n.text !== "string")
      warnings.push("invalid_text_type");
    if (typeof rawID === "number" && !Number.isSafeInteger(rawID))
      warnings.push("unsafe_numeric_id");
    const display =
      text ||
      m.attachments
        .map(
          (a) =>
            `[${a.kind.toUpperCase()}${a.title ? ": " + a.title : ""}${a.primary_url ? "" : a.placeholder ? ": " + a.placeholder : ": URL not returned"}]`,
        )
        .join(" ") ||
      "[Empty comment]";
    return {
      comment_id: id,
      parent_comment_id: parent ? String(parent) : null,
      depth: parent ? 1 : 0,
      media_id: meta.mediaId,
      shortcode: meta.code,
      post_url: meta.url,
      permalink: meta.url + "c/" + encodeURIComponent(id) + "/",
      text,
      display_text: display,
      content_type: m.type,
      media_status: m.status,
      attachments: m.attachments,
      primary_media_url:
        m.attachments.find((a) => a.primary_url)?.primary_url ?? null,
      created_at: t.unix,
      created_at_iso: t.iso,
      like_count:
        n.comment_like_count ?? n.like_count ?? n.edge_liked_by?.count ?? null,
      child_comment_count:
        n.child_comment_count ?? n.edge_threaded_comments?.count ?? null,
      is_edited: n.is_edited ?? null,
      is_pinned: n.is_pinned ?? null,
      viewer_has_liked: n.has_liked_comment ?? n.has_liked ?? null,
      is_hidden: n.hidden ?? n.is_hidden ?? null,
      mentions: [
        ...new Set(
          [...text.matchAll(/(?:^|\s)@([A-Za-z0-9._]{1,30})/g)].map(
            (m) => m[1],
          ),
        ),
      ],
      hashtags: [
        ...new Set(
          [...text.matchAll(/(?:^|\s)#([\p{L}\p{M}\p{N}_]+)/gu)].map(
            (m) => m[1],
          ),
        ),
      ],
      text_length: [...text].length,
      warnings,
      author: {
        id:
          a.pk === undefined && a.id === undefined
            ? null
            : String(a.pk ?? a.id),
        username: a.username ?? null,
        full_name: a.full_name ?? null,
        is_verified: a.is_verified ?? null,
        is_private: a.is_private ?? null,
        profile_pic_url: safeURL(a.profile_pic_url),
        profile_url: a.username
          ? "https://www.instagram.com/" + encodeURIComponent(a.username) + "/"
          : null,
      },
      raw: n,
    };
  }
  function enrich(c, meta) {
    if (c.attachments && c.display_text !== undefined) return c;
    const n = c.raw ?? {
      pk: c.comment_id,
      text: c.text,
      created_at: c.created_at,
      comment_like_count: c.like_count,
      child_comment_count: c.child_comment_count,
      owner: c.author,
    };
    const fresh = normalize(n, meta, c.parent_comment_id);
    return fresh
      ? {
          ...c,
          ...fresh,
          source: c.source ?? "imported",
          relationship_confidence: c.relationship_confidence ?? "unknown",
          ...(c.depth === null ? { depth: null } : {}),
        }
      : c;
  }
  function esc(v) {
    let s =
      v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    if (/^[\s]*[=+@-]/.test(s) || /^[\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function tableCSV(columns, rows) {
    return (
      "\ufeff" +
      [columns, ...rows].map((r) => r.map(esc).join(",")).join("\r\n")
    );
  }
  function commentTable(rows) {
    const cols = [
      "comment_id",
      "parent_comment_id",
      "depth",
      "content_type",
      "display_text",
      "text",
      "created_at_iso",
      "created_at",
      "like_count",
      "child_comment_count",
      "media_status",
      "attachment_count",
      "primary_media_url",
      "media_urls",
      "media_json",
      "author_username",
      "author_full_name",
      "author_id",
      "author_is_verified",
      "author_is_private",
      "author_profile_url",
      "author_profile_pic_url",
      "is_edited",
      "is_pinned",
      "viewer_has_liked",
      "is_hidden",
      "mentions",
      "hashtags",
      "text_length",
      "source",
      "relationship_confidence",
      "warnings",
      "media_id",
      "shortcode",
      "post_url",
      "permalink",
    ];
    return {
      columns: cols,
      values: rows.map((r) => [
        r.comment_id,
        r.parent_comment_id,
        r.depth,
        r.content_type,
        r.display_text ?? r.text,
        r.text,
        r.created_at_iso,
        r.created_at,
        r.like_count,
        r.child_comment_count,
        r.media_status,
        r.attachments?.length ?? 0,
        r.primary_media_url,
        [
          ...new Set(
            (r.attachments ?? []).flatMap((a) => a.variants.map((v) => v.url)),
          ),
        ].join("\n"),
        r.attachments ?? [],
        r.author?.username,
        r.author?.full_name,
        r.author?.id,
        r.author?.is_verified,
        r.author?.is_private,
        r.author?.profile_url,
        r.author?.profile_pic_url,
        r.is_edited,
        r.is_pinned,
        r.viewer_has_liked,
        r.is_hidden,
        (r.mentions ?? []).join(" "),
        (r.hashtags ?? []).join(" "),
        r.text_length,
        r.source,
        r.relationship_confidence,
        (r.warnings ?? []).join("; "),
        r.media_id,
        r.shortcode,
        r.post_url,
        r.permalink,
      ]),
    };
  }
  function csv(rows) {
    const t = commentTable(rows);
    return tableCSV(t.columns, t.values);
  }
  function mediaTable(rows) {
    const cols = [
      "comment_id",
      "parent_comment_id",
      "author_username",
      "kind",
      "provider",
      "asset_id",
      "title",
      "status",
      "placeholder",
      "url",
      "format",
      "role",
      "width",
      "height",
      "size_bytes",
      "source_field",
      "source_path",
    ];
    const out = [];
    for (const c of rows)
      for (const a of c.attachments ?? [])
        for (const v of a.variants.length ? a.variants : [{}])
          out.push([
            c.comment_id,
            c.parent_comment_id,
            c.author?.username,
            a.kind,
            a.provider,
            a.asset_id,
            a.title,
            a.status,
            a.placeholder,
            v.url,
            v.format,
            v.role,
            v.width,
            v.height,
            v.size_bytes,
            a.source_field,
            v.source_path,
          ]);
    return { columns: cols, values: out };
  }
  function mediaCSV(rows) {
    const t = mediaTable(rows);
    return tableCSV(t.columns, t.values);
  }
  function stats(rows) {
    const s = {
      total: rows.length,
      top: 0,
      replies: 0,
      unknown: 0,
      media_comments: 0,
      assets: 0,
      media_urls: 0,
      unavailable: 0,
      types: Object.create(null),
      authors: 0,
    };
    const authors = new Set();
    for (const r of rows) {
      if (r.parent_comment_id) s.replies++;
      else if (r.depth === null) s.unknown++;
      else s.top++;
      if (r.author?.username) authors.add(r.author.username.toLowerCase());
      const type = r.content_type ?? "unknown";
      s.types[type] = (s.types[type] ?? 0) + 1;
      if (r.attachments?.length) s.media_comments++;
      for (const a of r.attachments ?? []) {
        s.assets++;
        s.media_urls += a.variants?.length ?? 0;
        if (!a.primary_url) s.unavailable++;
      }
    }
    s.authors = authors.size;
    return s;
  }
  function summarize(job) {
    if (!job) return null;
    const { rows = [], threads, ...rest } = job;
    return {
      ...rest,
      stats: stats(rows),
      pending_threads: Object.values(threads ?? {}).filter((t) => !t.done)
        .length,
      recent: rows
        .slice(-30)
        .reverse()
        .map(({ raw, ...r }) => r),
    };
  }
  function errorInfo(error) {
    const text = String(error?.message ?? error);
    let code = "COLLECTION_ERROR",
      hint =
        "Export the checkpoint and inspect the activity log before resuming.";
    const status =
      Number(error?.httpStatus ?? (/HTTP (\d+)/.exec(text)?.[1] || 0)) || null;
    if (status === 429) {
      code = "RATE_LIMIT";
      hint = "Stop and wait. Do not repeatedly resume or reduce the delay.";
    } else if (status === 401 || status === 403) {
      code = "AUTH_OR_PERMISSION";
      hint =
        "Open the post normally and verify access. No restriction bypass is attempted.";
    } else if (/storage|quota|checkpoint could not/i.test(text)) {
      code = "STORAGE_FAILURE";
      hint =
        "Export now from this open tab. Disable raw objects for future collections.";
    } else if (/cursor/i.test(text)) {
      code = "PAGINATION_STOP";
      hint =
        "A cursor was missing or repeated. Partial rows are preserved; completion is not claimed.";
    } else if (/schema|non-json/i.test(text)) {
      code = "SCHEMA_CHANGE";
      hint =
        "Instagram returned an unsupported response. Export data and diagnostics.";
    } else if (/post changed|original post/i.test(text)) {
      code = "POST_CHANGED";
      hint = "Return to the original post to resume.";
    } else if (/challenge|verification|login/i.test(text)) {
      code = "VERIFICATION";
      hint =
        "Complete normal sign-in/verification yourself. Automation does not bypass it.";
    } else if (/another tab|lease|lock/i.test(text)) {
      code = "OTHER_TAB_ACTIVE";
      hint = "Pause the collection in the other tab first.";
    } else if (/abort|timeout/i.test(text)) {
      code = "REQUEST_TIMEOUT";
      hint =
        "A request timed out. Check your connection; the last successful page is checkpointed.";
    }
    return {
      code,
      message: text,
      hint,
      http_status: status,
      at: new Date().toISOString(),
    };
  }
  function report(job, rows) {
    const data = {
      version: VERSION,
      meta: job.meta,
      status: job.status,
      coverage: job.coverage ?? null,
      stats: stats(rows),
      rows: rows.map(({ raw, ...r }) => r),
    };
    const json = JSON.stringify(data)
      .replace(/</g, "\\u003c")
      .replace(/\u2028/g, "\\u2028")
      .replace(/\u2029/g, "\\u2029");
    return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ThreadVault export</title><style>body{margin:0;background:#f5f1e8;color:#151515;font:14px/1.5 Arial,Helvetica,sans-serif}header,main{max-width:1150px;margin:auto;padding:24px}header{background:#e7ff63;border-bottom:3px solid #151515;max-width:none}header>div{max-width:1150px;margin:auto}h1{margin:0;font-size:30px;text-transform:uppercase;letter-spacing:-1px}button,input{font:inherit;padding:9px 12px;border:2px solid #151515;border-radius:0}button{cursor:pointer;background:#fff;box-shadow:3px 3px 0 #151515}button:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #151515}nav{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0}.card{background:white;border:2px solid #151515;padding:18px;box-shadow:4px 4px 0 #151515;margin:18px 0}.meta{font:11px/1.6 monospace;color:#555}.text{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#004fbd;overflow-wrap:anywhere}img,video{display:block;max-width:380px;max-height:260px;border:2px solid #151515;margin-top:12px}summary{cursor:pointer;padding:8px 0}.warn{background:#ffe7a9;padding:9px;border-left:4px solid #151515}footer{padding:20px;color:#555}</style><header><div><h1>ThreadVault / conversation archive</h1><p id="subtitle"></p></div></header><main><p id="coverage" class="warn"></p><p>CSV cannot embed GIFs or photographs. This report displays returned text and attachment metadata, with explicit media-load buttons. URLs may expire; unavailable media is never invented. Loading media contacts the original CDN.</p><nav><input id="search" placeholder="Search text or username" aria-label="Search"><button id="more">Show next 100</button><span id="count"></span></nav><div id="rows"></div><footer>No media or scripts are fetched automatically. This report contains personal data; store it securely.</footer></main><script type="application/json" id="data">${json}</script><script>(()=>{const d=JSON.parse(document.getElementById('data').textContent);const $=id=>document.getElementById(id);let limit=100;const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e};const safe=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null}catch{return null}};$('subtitle').textContent=d.meta.url+' · '+d.rows.length+' exported rows · '+d.status;$('coverage').textContent='Instagram reported '+(d.coverage?.reported_count??'unknown')+'; exported '+d.rows.length+'. Exhausted cursors are not proof of all comments.';function draw(){const q=$('search').value.toLowerCase();const rows=d.rows.filter(r=>((r.display_text||r.text)+' '+(r.author?.username||'')+' '+(r.attachments||[]).map(a=>(a.title||'')+' '+(a.placeholder||'')+' '+a.kind+' '+(a.asset_id||'')).join(' ')).toLowerCase().includes(q));$('rows').replaceChildren();$('count').textContent=Math.min(limit,rows.length)+' / '+rows.length;for(const r of rows.slice(0,limit)){const card=el('article',undefined,'card');card.append(el('b',r.author?.username||'Unknown author'),el('div',(r.created_at_iso||'Unknown date')+' · '+(r.like_count??'?')+' likes · '+(r.parent_comment_id?'Reply to '+r.parent_comment_id:'Root / unclassified')+' · '+r.comment_id,'meta'),el('p',r.display_text||r.text||'[Empty]','text'));for(const a of r.attachments||[]){const box=el('div');box.append(el('b',a.kind.toUpperCase()+(a.title?' — '+a.title:'')));if(!a.primary_url)box.append(el('p',a.placeholder||'URL was not returned','warn'));for(const v of a.variants){const url=safe(v.url);if(!url)continue;const detail=el('details');detail.append(el('summary',(v.format||'Link')+' · '+(v.width||'?')+' × '+(v.height||'?')));const link=el('a','Open original URL');link.href=url;link.target='_blank';link.rel='noopener noreferrer';detail.append(link);if(['gif','webp','jpg','jpeg','png','mp4','webm'].includes(v.format)){const b=el('button','Load this media');b.onclick=()=>{const media=el(['mp4','webm'].includes(v.format)?'video':'img');media.referrerPolicy='no-referrer';if(media.tagName==='VIDEO'){media.controls=true;media.preload='none'}else{media.loading='lazy';media.alt=a.title||a.kind}media.onerror=()=>{b.textContent='Media unavailable / expired';media.remove()};media.src=url;box.append(media);b.disabled=true};detail.append(' ',b)}box.append(detail)}card.append(box)}$('rows').append(card)}$('more').disabled=limit>=rows.length}$('search').oninput=()=>{limit=100;draw()};$('more').onclick=()=>{limit+=100;draw()};draw()})();</script></html>`;
  }
  const api = {
    VERSION,
    mediaId,
    safeURL,
    timestamp,
    media,
    normalize,
    enrich,
    commentTable,
    mediaTable,
    csv,
    mediaCSV,
    stats,
    summarize,
    errorInfo,
    report,
  };
  if (typeof module !== "undefined") module.exports = api;
  root.TV = api;
})(globalThis);
