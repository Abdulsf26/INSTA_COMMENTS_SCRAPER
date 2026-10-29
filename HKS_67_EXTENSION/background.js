"use strict";
// Single-writer lease stored across service-worker suspension. Never stores session cookies.
const KEY = "threadvault_active_lease",
  TTL = 90000;
let queue = Promise.resolve();
chrome.runtime.onMessage.addListener((m, sender, reply) => {
  if (m?.app !== "threadvault-lock") return;
  if (
    !sender.tab?.id ||
    !sender.url?.startsWith("https://www.instagram.com/")
  ) {
    reply({ ok: false, error: "Invalid collection tab." });
    return;
  }
  queue = queue
    .catch(() => {})
    .then(async () => {
      const data = await chrome.storage.session.get(KEY),
        lease = data[KEY],
        now = Date.now(),
        tabId = sender.tab.id;
      if (m.cmd === "release") {
        if (lease?.tabId === tabId) await chrome.storage.session.remove(KEY);
        return { ok: true };
      }
      if (!["claim", "heartbeat"].includes(m.cmd))
        return { ok: false, error: "Invalid lease command." };
      if (lease && lease.tabId !== tabId && lease.expires > now)
        return {
          ok: false,
          error:
            "Another tab is collecting. Pause that tab before starting here.",
        };
      if (m.cmd === "heartbeat" && lease?.tabId !== tabId)
        return {
          ok: false,
          error:
            "Collection lease expired. Pause and resume to claim it again.",
        };
      await chrome.storage.session.set({
        [KEY]: {
          tabId,
          code: String(m.code ?? "").slice(0, 40),
          expires: now + TTL,
        },
      });
      return { ok: true };
    })
    .then(reply, (e) =>
      reply({ ok: false, error: "Lease storage failed: " + e.message }),
    );
  return true;
});
chrome.tabs.onRemoved.addListener((id) => {
  queue = queue
    .catch(() => {})
    .then(async () => {
      const d = await chrome.storage.session.get(KEY);
      if (d[KEY]?.tabId === id) await chrome.storage.session.remove(KEY);
    });
});
