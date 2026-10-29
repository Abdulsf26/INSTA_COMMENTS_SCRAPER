/* ISOLATED world UI adapter. No access-control bypass; clicks only allowlisted load controls. */
(() => {
  "use strict";
  const visible = (e) =>
    !!e?.getClientRects().length && getComputedStyle(e).visibility !== "hidden";
  function root() {
    const hasComments = (e) => !!e.querySelector('a[href*="/c/"]');
    const dialogs = [...document.querySelectorAll('[role="dialog"]')].filter(
      (e) => visible(e) && hasComments(e),
    );
    if (dialogs.length) return dialogs.at(-1);
    return (
      [...document.querySelectorAll('article,main,[role="main"]')].find(
        (e) => visible(e) && hasComments(e),
      ) ?? null
    );
  }
  function hash(s) {
    let h = 2166136261;
    for (const c of s) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function scan(meta) {
    const r = root();
    if (!r) return [];
    const out = [];
    for (const time of r.querySelectorAll("time[datetime]")) {
      let row = null,
        fallback = null;
      let e = time.parentElement;
      for (let i = 0; i < 15 && e && e !== r; i++, e = e.parentElement) {
        if (e.querySelectorAll("time").length > 1) break;
        const author = e.querySelector("a[href]");
        const content = [...e.querySelectorAll('[dir="auto"]')].some(
          (x) =>
            !x.querySelector("time") &&
            !x.closest("a") &&
            !x.closest('button,[role="button"]') &&
            x.textContent.trim(),
        );
        const attachment = [...e.querySelectorAll("img,video")].some(
          (x) =>
            x.tagName === "VIDEO" ||
            (!/profile picture|avatar/i.test(x.alt ?? "") &&
              !/t51\.[^/]*-19/.test(x.currentSrc || x.src)),
        );
        if (author && (content || attachment)) {
          fallback ??= e;
          if (
            [...e.querySelectorAll('button,[role="button"]')].some((x) =>
              /^Reply$/i.test(x.textContent.trim()),
            )
          ) {
            row = e;
            break;
          }
        }
      }
      row ??= fallback;
      if (!row || !visible(row)) continue;
      const timeLink = time.closest("a");
      const href = timeLink?.getAttribute("href") ?? "";
      const id =
        href.match(/\/c\/(\d+)/)?.[1] ??
        href.match(/[?&](?:comment_id|c)=(\d+)/)?.[1];
      // A post timestamp/caption is not a comment; require a stable ID or a list-item row.
      if (!id && !time.closest("li")) continue;
      const author = [...row.querySelectorAll("a[href]")].find(
        (a) =>
          /^\/[A-Za-z0-9._]+\/$/.test(a.getAttribute("href") ?? "") &&
          !["/explore/", "/accounts/", "/direct/", "/reels/"].includes(
            a.getAttribute("href"),
          ),
      );
      if (!author) continue;
      const username = author.getAttribute("href").split("/")[1];
      const candidates = [...row.querySelectorAll('[dir="auto"]')].filter(
        (e) =>
          !e.contains(author) &&
          !author.contains(e) &&
          !e.querySelector("time") &&
          !e.closest("button") &&
          !e.closest('[role="button"]') &&
          !e.querySelector('[dir="auto"]') &&
          (!e.closest("li") || e.closest("li") === row),
      );
      const text = candidates
        .map((e) => e.textContent.trim())
        .filter(
          (t) =>
            t &&
            t !== username &&
            !/^(?:Reply|See translation|\d+ likes?)$/i.test(t),
        )
        .join("\n");
      const pictures = [...row.querySelectorAll("img")]
        .filter(
          (x) =>
            !/profile picture|avatar/i.test(x.alt ?? "") &&
            !/t51\.[^/]*-19/.test(x.currentSrc || x.src),
        )
        .map((x) => ({
          url: x.currentSrc || x.src,
          width: x.naturalWidth || null,
          height: x.naturalHeight || null,
          alt: x.alt || null,
        }))
        .filter((x) => x.url);
      const videos = [...row.querySelectorAll("video")]
        .map((x) => ({
          url: x.currentSrc || x.src,
          width: x.videoWidth || null,
          height: x.videoHeight || null,
        }))
        .filter((x) => x.url);
      if (!text && !pictures.length && !videos.length) continue;
      const stamp = Date.parse(time.getAttribute("datetime"));
      let parent = null;
      const outer = row.parentElement?.closest("li");
      if (outer && r.contains(outer)) {
        const a = outer.querySelector("time")?.closest("a");
        parent = a?.getAttribute("href")?.match(/\/c\/(\d+)/)?.[1] ?? null;
      }
      const likes = [...row.querySelectorAll('button,[role="button"]')]
        .map((e) => e.textContent.trim())
        .find((s) => /^[\d,]+ likes?$/i.test(s));
      const pk =
        id ??
        "dom-" +
          hash(username + "\0" + text + "\0" + time.getAttribute("datetime"));
      const gif = pictures.find((x) => /\.gif(?:\?|$)/i.test(x.url));
      const mediaFields = {};
      if (gif)
        mediaFields.giphy_media_info = {
          images: {
            dom: { url: gif.url, width: gif.width, height: gif.height },
          },
          title: gif.alt,
        };
      const photos = pictures.filter((x) => x !== gif);
      if (photos.length) mediaFields.image_versions2 = { candidates: photos };
      if (videos.length) mediaFields.video_versions = videos;
      out.push({
        node: {
          pk,
          text,
          ...mediaFields,
          created_at: Number.isFinite(stamp) ? stamp / 1000 : null,
          user: { username },
          comment_like_count: likes ? Number(likes.replace(/\D/g, "")) : null,
        },
        parent,
        dom: true,
        unknownParent: !parent,
        evidence: {
          identity: id ? "instagram_comment_id" : "synthetic_dom_fingerprint",
          timestamp: time.getAttribute("datetime"),
        },
      });
    }
    return out;
  }
  function controlName(e) {
    return [
      e.textContent?.trim(),
      e.getAttribute("aria-label"),
      ...Array.from(e.querySelectorAll("[aria-label],title")).map(
        (n) => n.getAttribute("aria-label") || n.textContent,
      ),
    ]
      .filter(Boolean)
      .map((s) => s.trim().replace(/\s+/g, " "));
  }
  function control(replies, accept = () => true) {
    const r = root();
    if (!r) return null;
    return [...r.querySelectorAll('button,[role="button"]')].find((e) => {
      if (
        !visible(e) ||
        e.disabled ||
        e.getAttribute("aria-disabled") === "true" ||
        !accept(e)
      )
        return false;
      return controlName(e).some(
        (text) =>
          /^(?:load|view|see|show) (?:more|previous|all) comments(?:\s*[.(\d)].*)?$/i.test(
            text,
          ) ||
          (replies &&
            /^(?:(?:view|see|load|show) (?:all |more |previous )?(?:\d+ )?repl(?:y|ies)(?:\s*\(\d+\))?|(?:view|show) (?:all )?\d+ (?:more )?replies)$/i.test(
              text,
            )),
      );
    });
  }
  function scroll() {
    const r = root();
    if (!r) return false;
    const times = r.querySelectorAll("time");
    let e = times.length ? times[times.length - 1].parentElement : r;
    while (e && e !== document.body) {
      if (
        e.scrollHeight > e.clientHeight + 40 &&
        /(auto|scroll)/.test(getComputedStyle(e).overflowY)
      ) {
        const old = e.scrollTop;
        e.scrollBy({
          top: Math.max(250, e.clientHeight * 0.8),
          behavior: "instant",
        });
        return e.scrollTop !== old;
      }
      e = e.parentElement;
    }
    if (
      ["ARTICLE", "MAIN"].includes(r.tagName) ||
      r.getAttribute("role") === "main"
    ) {
      const old = window.scrollY;
      window.scrollBy(0, Math.max(300, innerHeight * 0.7));
      return old !== window.scrollY;
    }
    return false;
  }
  function blocked() {
    return (
      !!document.querySelector(
        'form[action*="login"],input[name="verificationCode"],input[name="security_code"]',
      ) ||
      /\/(?:challenge|accounts\/login|accounts\/suspended)\//.test(
        location.pathname,
      )
    );
  }
  globalThis.TVBrowser = { scan, control, controlName, scroll, blocked, root };
})();
