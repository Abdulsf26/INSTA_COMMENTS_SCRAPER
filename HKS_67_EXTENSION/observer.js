/* MAIN world: passive response observation only. Never sends a request or reads cookies. */
(() => {
  "use strict";
  if (window.__threadVaultObserver) return;
  window.__threadVaultObserver = true;
  const originalFetch = window.fetch;
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  function target(url, body) {
    try {
      const m = location.pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)/);
      if (!m) return null;
      let n = 0n;
      for (const c of m[1])
        n =
          n * 64n +
          BigInt(
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_".indexOf(
              c,
            ),
          );
      const u = new URL(url, location.href);
      if (u.origin !== location.origin) return null;
      const path = u.pathname.match(
        /\/media\/(\d+)\/comments(?:\/(\d+)\/(?:inline_)?child_comments)?\//,
      );
      if (path)
        return path[1] === String(n)
          ? { mediaId: String(n), parent: path[2] ?? null }
          : null;
      if (!u.pathname.includes("graphql")) return null;
      const p =
        typeof body === "string"
          ? new URLSearchParams(body)
          : body instanceof URLSearchParams
            ? body
            : null;
      const raw = p?.get("variables") ?? u.searchParams.get("variables");
      if (!raw) return null;
      const v = JSON.parse(raw);
      return String(v.media_id ?? "") === String(n)
        ? {
            mediaId: String(n),
            parent: v.parent_comment_id ? String(v.parent_comment_id) : null,
          }
        : null;
    } catch {
      return null;
    }
  }
  function publish(text, ctx) {
    if (!ctx || text.length > 4000000) return;
    try {
      const d = JSON.parse(text.replace(/^for\s*\(;;\);\s*/, ""));
      const rows = [];
      let visits = 0;
      function walk(x, parent, depth = 0) {
        if (
          !x ||
          typeof x !== "object" ||
          depth > 18 ||
          ++visits > 25000 ||
          rows.length >= 1000
        )
          return;
        if (Array.isArray(x)) {
          for (const a of x) walk(a, parent, depth + 1);
          return;
        }
        if (
          (typeof x.text === "string" ||
            x.giphy_media_info ||
            x.media_comment_info ||
            x.image_versions2) &&
          (x.pk != null || x.id != null) &&
          (x.user || x.owner)
        ) {
          rows.push({
            node: x,
            parent: x.parent_comment_id ? String(x.parent_comment_id) : parent,
          });
          for (const k of [
            "preview_child_comments",
            "edge_threaded_comments",
            "child_comments",
          ])
            if (x[k]) walk(x[k], String(x.pk ?? x.id), depth + 1);
          return;
        }
        for (const [k, v] of Object.entries(x)) walk(v, parent, depth + 1);
      }
      walk(d, ctx.parent);
      if (rows.length)
        window.postMessage(
          { app: "threadvault-observed-v2", mediaId: ctx.mediaId, rows },
          location.origin,
        );
    } catch {}
  }
  window.fetch = async function (input, init) {
    let ctx;
    try {
      let body = init?.body;
      if (
        body === undefined &&
        input instanceof Request &&
        input.method === "POST"
      )
        body = await input.clone().text();
      ctx = target(typeof input === "string" ? input : input.url, body);
    } catch {}
    const r = await originalFetch.apply(this, arguments);
    if (ctx)
      r.clone()
        .text()
        .then((t) => publish(t, ctx))
        .catch(() => {});
    return r;
  };
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__tvURL = url;
    return originalOpen.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function (body) {
    const ctx = target(this.__tvURL, body);
    if (ctx)
      this.addEventListener(
        "load",
        () => {
          try {
            if (this.responseType === "" || this.responseType === "text")
              publish(this.responseText, ctx);
          } catch {}
        },
        { once: true },
      );
    return originalSend.apply(this, arguments);
  };
})();
