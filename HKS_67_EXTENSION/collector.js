(() => {
  "use strict";
  let job = null,
    running = false,
    stop = false,
    abort = null,
    leaseTimer = null;
  let rowIndex = new Map();
  const key = "threadvault_checkpoint";
  const ownerKey = "threadvault_owner_v2";
  let owner = null;
  try {
    owner = sessionStorage.getItem(ownerKey);
    if (!owner) {
      owner = crypto.randomUUID();
      sessionStorage.setItem(ownerKey, owner);
    }
  } catch {}
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  function context() {
    const m = location.pathname.match(/^\/(p|reel|tv)\/([\w-]+)\//);
    if (!m) throw Error("Open an Instagram post or reel first.");
    return {
      code: m[2],
      mediaId: TV.mediaId(m[2]),
      url: `https://www.instagram.com/${m[1]}/${m[2]}/`,
    };
  }
  function check() {
    if (stop) throw Error("PAUSED");
    if (context().code !== job.meta.code)
      throw Error("Post changed. Return to the original post and resume.");
  }
  function log(s) {
    job.log.push(new Date().toISOString().slice(11, 19) + " " + s);
    job.log = job.log.slice(-70);
  }
  async function save() {
    job.updated_at = new Date().toISOString();
    try {
      await chrome.storage.local.set({ [key]: job });
      if (typeof chrome.storage.local.getBytesInUse === "function")
        job.checkpoint_bytes = await chrome.storage.local.getBytesInUse(key);
    } catch (e) {
      stop = true;
      throw Error(
        "Checkpoint could not be saved (storage may be full). Export collected data. " +
          e.message,
      );
    }
  }
  function migrate() {
    if (!job) return;
    job.metrics ??= {
      requests: 0,
      retries: 0,
      duplicates: 0,
      updated: 0,
      invalid_rows: 0,
    };
    job.errors ??= [];
    job.threads = Object.assign(Object.create(null), job.threads ?? {});
    job.rows = job.rows.map((r) => TV.enrich(r, job.meta));
    rowIndex = new Map(job.rows.map((r, i) => [r.comment_id, i]));
  }
  function put(c) {
    if (!c) {
      job.metrics.invalid_rows++;
      return;
    }
    const old = rowIndex.get(c.comment_id);
    const now = new Date().toISOString();
    c.first_seen_at =
      old === undefined ? now : (job.rows[old].first_seen_at ?? now);
    c.last_seen_at = now;
    if (job.options.raw === false) delete c.raw;
    if (old === undefined) {
      rowIndex.set(c.comment_id, job.rows.length);
      job.rows.push(c);
    } else {
      const prev = job.rows[old];
      job.metrics.duplicates++;
      if (
        prev.text !== c.text ||
        prev.like_count !== c.like_count ||
        prev.content_type !== c.content_type
      )
        job.metrics.updated++;
      job.rows[old] = c;
    }
  }
  async function lock(cmd) {
    if (typeof chrome.runtime.sendMessage !== "function") return;
    const r = await chrome.runtime.sendMessage({
      app: "threadvault-lock",
      cmd,
      code: job?.meta.code,
    });
    if (!r?.ok) throw Error(r?.error || "Collection lease unavailable.");
  }
  async function acquire() {
    await lock("claim");
    if (typeof chrome.runtime.sendMessage !== "function") return;
    leaseTimer = setInterval(
      () =>
        lock("heartbeat").catch((e) => {
          if (job) {
            job.last_error = TV.errorInfo(e);
            job.error = e.message;
          }
          stop = true;
          abort?.abort();
        }),
      20000,
    );
  }
  async function release() {
    if (leaseTimer !== null) clearInterval(leaseTimer);
    leaseTimer = null;
    try {
      await lock("release");
    } catch {}
  }
  function failure(e) {
    job.error = e.message === "PAUSED" ? null : e.message;
    job.last_error = job.error ? TV.errorInfo(e) : null;
    if (job.last_error) {
      job.errors.push(job.last_error);
      job.errors = job.errors.slice(-100);
    }
  }
  function add(n, parent = null) {
    const c = TV.normalize(n, job.meta, parent);
    if (!c) {
      job.metrics.invalid_rows++;
      return;
    }
    c.source = "direct_api";
    c.relationship_confidence = "returned_thread_context";
    put(c);
    if (!parent) {
      for (const p of n.preview_child_comments ??
        n.edge_threaded_comments?.edges?.map((e) => e.node) ??
        [])
        add(p, c.comment_id);
      if (
        job.options.replies &&
        (c.child_comment_count > 0 ||
          n.has_more_tail_child_comments ||
          n.has_more_head_child_comments) &&
        !job.threads[c.comment_id]
      )
        job.threads[c.comment_id] = { cursor: null, done: false, seen: [] };
    }
  }
  async function request(path, params) {
    for (let attempt = 0; ; attempt++) {
      check();
      job.phase = "Waiting between requests";
      job.next_request_at = Date.now() + job.options.delay;
      await sleep(job.options.delay + Math.random() * 500);
      check();
      job.phase = path.includes("inline_child_comments")
        ? "Loading reply page"
        : "Loading comment page";
      job.metrics.requests++;
      abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 30000);
      try {
        const url = new URL("/api/v1/" + path, location.origin);
        for (const [k, v] of Object.entries(params))
          if (v !== null && v !== undefined) url.searchParams.set(k, v);
        const csrf =
          document.cookie
            .split("; ")
            .find((x) => x.startsWith("csrftoken="))
            ?.slice(10) ?? "";
        const r = await fetch(url, {
          credentials: "include",
          headers: {
            "X-IG-App-ID": "936619743392459",
            "X-CSRFToken": decodeURIComponent(csrf),
            "X-Requested-With": "XMLHttpRequest",
          },
          signal: abort.signal,
        });
        job.last_request = {
          kind: path.includes("inline_child_comments") ? "replies" : "comments",
          http_status: r.status,
          at: new Date().toISOString(),
        };
        if ([401, 403, 429].includes(r.status))
          throw Object.assign(
            Error(
              `HTTP ${r.status}: login, permission or rate limit. Collection stopped; do not repeatedly retry.`,
            ),
            { fatal: true },
          );
        if (!r.ok)
          throw Object.assign(
            Error("HTTP " + r.status + " — endpoint unavailable"),
            { fatal: r.status < 500 },
          );
        let d;
        try {
          d = await r.json();
        } catch {
          throw Object.assign(
            Error("Non-JSON response; sign-in wall or changed endpoint."),
            { fatal: true },
          );
        }
        if (
          d.status === "fail" ||
          d.challenge ||
          (d.message && d.status !== "ok")
        )
          throw Object.assign(
            Error(d.message || "Instagram challenge; collection stopped."),
            { fatal: true },
          );
        return d;
      } catch (e) {
        if (stop) throw Error("PAUSED");
        if (e.fatal || attempt >= 2) throw e;
        job.metrics.retries++;
        job.phase = "Retry backoff";
        log("Temporary failure; backing off.");
        await sleep(3000 * 2 ** attempt);
      } finally {
        clearTimeout(timer);
        abort = null;
      }
    }
  }
  async function runAPI() {
    running = true;
    stop = false;
    migrate();
    job.status = "running";
    job.error = null;
    job.last_error = null;
    try {
      await save();
      // Finish pending reply threads first on resume, then continue the top-level cursor.
      while (true) {
        check();
        const entry = Object.entries(job.threads).find(([, t]) => !t.done);
        if (entry) {
          const [id, t] = entry;
          const d = await request(
            `media/${job.meta.mediaId}/comments/${id}/inline_child_comments/`,
            { min_id: t.cursor },
          );
          if (!Array.isArray(d.child_comments))
            throw Error("Reply response schema changed; checkpoint kept.");
          for (const n of d.child_comments) add(n, id);
          job.pages++;
          const next = d.next_min_child_cursor ?? null;
          const replyFlags = [
            d.has_more_tail_child_comments,
            d.has_more_child_comments,
            d.has_more_head_child_comments,
          ].filter((x) => typeof x === "boolean");
          const more = replyFlags.length
            ? replyFlags.some(Boolean)
            : Object.hasOwn(d, "next_min_child_cursor")
              ? Boolean(next)
              : undefined;
          if (more && (!next || t.seen.includes(String(next))))
            throw Error(
              "Missing or repeated reply cursor; cannot claim this thread is complete.",
            );
          // Unknown pagination flags are not treated as proof of completion.
          if (more === undefined)
            throw Error(
              "Unknown reply pagination schema; collected rows preserved.",
            );
          if (more) {
            t.cursor = String(next);
            t.seen.push(t.cursor);
          } else t.done = true;
          log(`Reply page: ${d.child_comments.length} rows`);
          await save();
          continue;
        }
        if (job.topDone) break;
        const d = await request(`media/${job.meta.mediaId}/comments/`, {
          can_support_threading: "true",
          permalink_enabled: "false",
          min_id: job.cursor,
        });
        if (!Array.isArray(d.comments))
          throw Error("Comment response schema changed; checkpoint kept.");
        for (const n of d.comments) {
          if (
            job.options.limit &&
            job.rows.filter((c) => !c.parent_comment_id).length >=
              job.options.limit
          )
            break;
          add(n);
        }
        job.pages++;
        if (job.reported_count_at_start == null && d.comment_count != null)
          job.reported_count_at_start = d.comment_count;
        job.reported_count = d.comment_count ?? job.reported_count;
        const topFlags = [
          d.has_more_comments,
          d.has_more_headload_comments,
        ].filter((x) => typeof x === "boolean");
        const more = topFlags.length ? topFlags.some(Boolean) : undefined;
        const next = d.next_min_id ?? null;
        if (
          job.options.limit &&
          job.rows.filter((c) => !c.parent_comment_id).length >=
            job.options.limit
        ) {
          job.topDone = true;
          job.limited = true;
        } else if (more === false) job.topDone = true;
        else if (more === true && next && !job.seen.includes(String(next))) {
          job.cursor = String(next);
          job.seen.push(job.cursor);
        } else
          throw Error(
            "Missing, repeated or unknown top-level pagination cursor; results are partial.",
          );
        log(`Comment page: ${d.comments.length} rows`);
        await save();
      }
      const replyCounts = new Map();
      for (const r of job.rows)
        if (r.parent_comment_id)
          replyCounts.set(
            r.parent_comment_id,
            (replyCounts.get(r.parent_comment_id) ?? 0) + 1,
          );
      const gapRows = job.rows.filter(
        (c) =>
          !c.parent_comment_id &&
          c.child_comment_count != null &&
          (replyCounts.get(c.comment_id) ?? 0) < c.child_comment_count,
      );
      const gaps = gapRows.length;
      job.coverage = {
        unique_rows: job.rows.length,
        top_level: job.rows.filter((c) => !c.parent_comment_id).length,
        replies: job.rows.filter((c) => !!c.parent_comment_id).length,
        reported_count: job.reported_count ?? null,
        thread_count_gaps: gaps,
        reply_gaps: gapRows.map((c) => ({
          comment_id: c.comment_id,
          expected: c.child_comment_count,
          collected: replyCounts.get(c.comment_id) ?? 0,
        })),
        all_returned_cursors_exhausted:
          job.topDone && Object.values(job.threads).every((t) => t.done),
      };
      const countMismatch =
        job.reported_count != null &&
        Number(job.reported_count) !== job.rows.length;
      job.status =
        job.limited || gaps || !job.options.replies || countMismatch
          ? "partial"
          : "exhausted";
      log(
        job.status === "exhausted"
          ? "Returned cursors exhausted; available counts match. Hidden/deleted comments still cannot be guaranteed."
          : `Partial: ${job.rows.length} unique rows, reported ${job.reported_count ?? "unknown"}, ${gaps} thread count gaps.`,
      );
    } catch (e) {
      job.status = e.message === "PAUSED" ? "paused" : "error";
      failure(e);
      log(job.error || "Paused; checkpoint saved.");
    } finally {
      job.phase = job.status;
      job.autoArmed = false;
      try {
        await save();
      } catch (e) {
        failure(e);
        job.status = "error";
      }
    }
  }

  let observed = [];
  if (typeof window !== "undefined")
    window.addEventListener("message", (ev) => {
      if (
        ev.source !== window ||
        ev.origin !== location.origin ||
        ev.data?.app !== "threadvault-observed-v2" ||
        !running ||
        job?.options.mode !== "browser" ||
        String(ev.data.mediaId) !== job.meta.mediaId
      )
        return;
      if (Array.isArray(ev.data.rows))
        observed.push(...ev.data.rows.slice(0, 1000));
      if (observed.length > 5000) observed = observed.slice(-5000);
    });
  function mergeObserved(item) {
    if (
      !item?.node ||
      (item.node.text != null && typeof item.node.text !== "string") ||
      (item.node.text?.length ?? 0) > 100000
    )
      return;
    const c = TV.normalize(
      item.node,
      job.meta,
      item.parent ? String(item.parent) : null,
    );
    if (!c) return;
    c.source = item.dom ? "visible_dom" : "observed_response";
    c.relationship_confidence = item.dom
      ? "unknown_or_inferred"
      : "returned_thread_context";
    if (item.dom) {
      c.evidence = item.evidence;
      c.depth = item.parent ? 1 : null;
    }
    let i = job.rows.findIndex((x) => x.comment_id === c.comment_id);
    // DOM fingerprints are only merged with API IDs on exact author/text/time agreement.
    if (i < 0)
      i = job.rows.findIndex(
        (x) =>
          (x.source === "visible_dom" || item.dom) &&
          x.author?.username === c.author.username &&
          x.text === c.text &&
          x.created_at === c.created_at,
      );
    if (i < 0) {
      if (!job.options.limit || job.rows.length < job.options.limit) put(c);
    } else if (item.dom && job.rows[i].source === "observed_response") return;
    else {
      if (!rowIndex.has(c.comment_id)) {
        rowIndex.delete(job.rows[i].comment_id);
        rowIndex.set(c.comment_id, i);
      }
      put(c);
    }
  }
  async function runBrowser() {
    running = true;
    stop = false;
    migrate();
    observed = [];
    job.status = "running";
    job.error = null;
    job.autoArmed = !!job.options.autoResume;
    let idle = 0;
    let lastSignature = "";
    let mutations = 0;
    let observer;
    try {
      await save();
      check();
      if (TVBrowser.blocked())
        throw Error("Login or verification wall detected. Automation stopped.");
      observer = new MutationObserver(() => mutations++);
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
      });
      const started = Date.now();
      let clicks = new WeakMap();
      for (
        let step = 0;
        step < 2000 && Date.now() - started < 30 * 60 * 1000;
        step++
      ) {
        check();
        if (TVBrowser.blocked())
          throw Error(
            "Login or verification wall detected. No automatic retry.",
          );
        if (!TVBrowser.root()) {
          idle++;
          if (idle >= 12)
            throw Error(
              "No visible post/comment panel found. Open the comments panel and Resume.",
            );
          await sleep(job.options.delay);
          continue;
        }
        for (const item of observed.splice(0)) mergeObserved(item);
        for (const item of TVBrowser.scan(job.meta)) mergeObserved(item);
        job.pages++;
        job.steps = (job.steps ?? 0) + 1;
        if (job.options.limit && job.rows.length >= job.options.limit) {
          job.status = "partial";
          log("Browser-mode total row limit reached.");
          break;
        }
        const signature = job.rows
          .map((c) => c.comment_id + ":" + c.text.length)
          .sort()
          .join("|");
        const changed = signature !== lastSignature;
        idle = changed ? 0 : idle + 1;
        lastSignature = signature;
        const button = TVBrowser.control(
          job.options.replies,
          (e) => (clicks.get(e) ?? 0) < 3,
        );
        let acted = false;
        if (button) {
          const tries = clicks.get(button) ?? 0;
          if (tries < 3) {
            check();
            button.scrollIntoView({ block: "center", behavior: "instant" });
            button.click();
            clicks.set(button, tries + 1);
            job.clicks = (job.clicks ?? 0) + 1;
            acted = true;
            log("Expanded a reply/comment loading control.");
          }
        }
        if (!acted) acted = TVBrowser.scroll();
        if (changed || step % 5 === 0) {
          log(
            `Scan ${job.steps}: ${job.rows.length} unique rows; ${idle}/12 idle scans.`,
          );
          await save();
        }
        if (idle >= 12) {
          if (
            job.options.reloadOnce &&
            job.options.autoResume &&
            !job.reloadUsed &&
            owner
          ) {
            job.reloadUsed = true;
            job.status = "reloading";
            job.autoArmed = true;
            log("Stalled: saving before one automatic reload.");
            await save();
            location.reload();
            return;
          }
          job.status = "partial";
          log(
            "No new rows after 12 scans. Stopped safely; completeness is unknown.",
          );
          break;
        }
        // Let Instagram render/fetch before another action; MutationObserver does not trigger clicks.
        const before = mutations;
        await sleep(job.options.delay + Math.random() * 500);
        if (mutations > before) await sleep(350);
      }
      if (job.status === "running") {
        job.status = "partial";
        log(
          "30-minute / 2000-step safety budget reached. Resume manually if needed.",
        );
      }
    } catch (e) {
      job.status = e.message === "PAUSED" ? "paused" : "error";
      failure(e);
      log(job.error || "Paused by user.");
    } finally {
      observer?.disconnect();
      if (job.status !== "reloading") job.autoArmed = false;
      try {
        await save();
      } catch (e) {
        job.status = "error";
        job.error = e.message;
      }
    }
  }
  async function run() {
    running = true;
    migrate();
    let held = false;
    try {
      await acquire();
      held = true;
      return await (job.options.mode === "browser" ? runBrowser() : runAPI());
    } catch (e) {
      job.status = "error";
      failure(e);
      if (held)
        try {
          await save();
        } catch {}
    } finally {
      if (held && job?.status !== "reloading") await release();
      running = false;
    }
  }

  chrome.runtime.onMessage.addListener((m, s, reply) => {
    if (m?.app !== "threadvault") return;
    (async () => {
      if (!job) {
        const d = await chrome.storage.local.get(key);
        job = d[key] ?? null;
        if (job?.status === "running") job.status = "paused";
        if (job) migrate();
      }
      if (m.cmd === "status" || m.cmd === "results") return { job, running };
      if (m.cmd === "summary") return { job: TV.summarize(job), running };
      if (m.cmd === "pause") {
        if (job) job.autoArmed = false;
        stop = true;
        abort?.abort();
        if (!running && job?.status === "reloading") {
          job.status = "paused";
          job.phase = "paused";
          log("Reload recovery paused by user.");
          await release();
          await save();
        }
        return { ok: true };
      }
      if (m.cmd === "start") {
        if (running)
          throw Error("A collection is already running in this tab.");
        const meta = context();
        const o = m.options ?? {};
        job = {
          version: 3,
          owner,
          autoArmed: !!o.autoResume,
          meta,
          options: {
            raw: o.raw !== false,
            mode: o.mode === "api" ? "api" : "browser",
            autoResume: !!o.autoResume,
            reloadOnce: !!o.reloadOnce,
            replies: o.replies !== false,
            delay: Math.max(1500, Math.min(30000, Number(o.delay) || 2500)),
            limit: Math.min(
              1000000,
              Math.max(0, Math.floor(Number(o.limit) || 0)),
            ),
          },
          rows: [],
          metrics: {
            requests: 0,
            retries: 0,
            duplicates: 0,
            updated: 0,
            invalid_rows: 0,
          },
          errors: [],
          threads: {},
          cursor: null,
          seen: [],
          topDone: false,
          limited: false,
          pages: 0,
          log: [],
          status: "paused",
          started_at: new Date().toISOString(),
        };
        void run();
        return { ok: true };
      }
      if (m.cmd === "resume") {
        if (job) {
          job.owner = owner;
          job.autoArmed = !!job.options.autoResume;
        }
        if (running) throw Error("Already running.");
        if (!job) throw Error("No checkpoint found.");
        if (context().code !== job.meta.code)
          throw Error("Open the post saved in the checkpoint.");
        void run();
        return { ok: true };
      }
      throw Error("Unknown command");
    })().then(reply, (e) => reply({ error: e.message }));
    return true;
  });

  // Only the same tab may automatically continue after an explicit opt-in refresh.
  if (typeof window !== "undefined") {
    (async () => {
      const d = await chrome.storage.local.get(key);
      const saved = d[key];
      if (
        !saved ||
        !owner ||
        saved.owner !== owner ||
        !saved.autoArmed ||
        !saved.options?.autoResume ||
        !["running", "reloading"].includes(saved.status)
      )
        return;
      try {
        if (context().code !== saved.meta.code) return;
        job = saved;
        log("Restored same-tab checkpoint after reload.");
        await sleep(1500);
        if (!running) void run();
      } catch {}
    })();
  }
})();
