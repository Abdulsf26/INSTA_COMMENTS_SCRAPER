/* Opt-in, bounded media downloads. Only known returned CDN origins are eligible. */
(function (root) {
  "use strict";
  const ORIGINS = [
    "https://*.cdninstagram.com/*",
    "https://*.fbcdn.net/*",
    "https://*.fbsbx.com/*",
    "https://*.giphy.com/*",
  ];
  function allowed(value) {
    try {
      const u = new URL(value);
      return (
        u.protocol === "https:" &&
        !u.username &&
        !u.password &&
        ["cdninstagram.com", "fbcdn.net", "fbsbx.com", "giphy.com"].some(
          (h) => u.hostname === h || u.hostname.endsWith("." + h),
        )
      );
    } catch {
      return false;
    }
  }
  async function boundedBlob(url, signal) {
    const r = await fetch(url, {
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
    });
    if (!r.ok) throw Error("Unavailable");
    if (!r.headers.get("content-type")?.startsWith("image/"))
      throw Error("Not an image");
    const reader = r.body.getReader(),
      parts = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2 * 1024 * 1024) throw Error("Image exceeds 2 MB");
        parts.push(value);
      }
    } catch (e) {
      await reader.cancel().catch(() => {});
      throw e;
    }
    return new Blob(parts);
  }
  async function collect(rows, onProgress = () => {}) {
    const candidates = rows
      .flatMap((r) => {
        const urls = [
          ...new Set(
            (r.attachments || []).flatMap((a) =>
              (a.variants || [])
                .filter(
                  (v) =>
                    ["jpg", "jpeg", "png", "webp", "gif"].includes(v.format) &&
                    allowed(v.url),
                )
                .map((v) => v.url),
            ),
          ),
        ].slice(0, 3);
        return urls.length ? [{ id: r.comment_id, urls }] : [];
      })
      .slice(0, 20);
    const images = [];
    let failures = 0;
    // Sequential bounded fetch avoids hammering CDNs; each row gets an 8-second budget.
    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i],
        controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), 8000);
      let found = false;
      onProgress(
        `Embedding available thumbnails: ${i + 1}/${candidates.length}. Missing URLs stay missing.`,
      );
      try {
        for (const url of c.urls) {
          let bitmap;
          try {
            const blob = await boundedBlob(url, controller.signal);
            bitmap = await createImageBitmap(blob);
            if (!bitmap.width || !bitmap.height)
              throw Error("Invalid dimensions");
            const scale = Math.min(1, 140 / bitmap.width, 76 / bitmap.height),
              width = Math.max(1, Math.round(bitmap.width * scale)),
              height = Math.max(1, Math.round(bitmap.height * scale));
            const canvas = new OffscreenCanvas(width, height);
            canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
            const png = await canvas.convertToBlob({ type: "image/png" });
            images.push({
              comment_id: c.id,
              bytes: new Uint8Array(await png.arrayBuffer()),
              width,
              height,
            });
            found = true;
            break;
          } catch {
            if (controller.signal.aborted) break;
          } finally {
            bitmap?.close();
          }
        }
      } finally {
        clearTimeout(timeout);
        if (!found) failures++;
      }
    }
    return {
      images,
      mediaNote: `${images.length} embedded; ${failures} unavailable/unsupported/over-limit; ${candidates.length} attempted. Maximum 20 rows, one still per row. Animated GIFs become static first frames. Video is not embedded. Other media remains linked.`,
    };
  }
  const api = { ORIGINS, allowed, collect };
  if (typeof module !== "undefined") module.exports = api;
  root.HKSThumbnails = api;
})(globalThis);
