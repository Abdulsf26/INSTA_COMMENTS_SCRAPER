/* Popup-only consent flow. The collector never sees API credentials. */
"use strict";
let aiSnapshot = null,
  aiRows = [],
  aiController = null,
  aiReturnFocus = null,
  aiPermissionPending = false;
const aiDialog = $("ai-dialog");
function aiPrompt() {
  return HKSAI.prepare(
    aiSnapshot,
    aiRows,
    $("ai-instruction").value,
    $("ai-names").checked,
  );
}
function updateAIPreview() {
  if (!aiSnapshot) return;
  const prompt = aiPrompt();
  $("ai-preview").value = prompt;
  $("ai-size").textContent =
    `Review exact prompt / ${aiRows.length} complete bodies / ${(new TextEncoder().encode(prompt).length / 1024).toFixed(1)} KB`;
}
$("ask-chatgpt").onclick = async () => {
  try {
    aiSnapshot = await getFull(!imported);
    aiRows = $("filtered-export").checked
      ? filter(aiSnapshot.rows)
      : aiSnapshot.rows;
    aiReturnFocus = document.activeElement;
    $("ai-instruction").value = HKSAI.DEFAULT;
    $("ai-notice").textContent = "";
    $("api-key").value = "";
    $("api-consent").checked = false;
    updateAIPreview();
    aiDialog.showModal();
  } catch (e) {
    notice("Could not prepare handoff: " + e.message);
  }
};
$("ai-instruction").oninput = updateAIPreview;
$("ai-names").onchange = updateAIPreview;
function clearAPIKey() {
  aiController?.abort();
  $("api-key").value = "";
  $("api-consent").checked = false;
}
$("ai-close").onclick = () => {
  clearAPIKey();
  aiDialog.close();
};
aiDialog.addEventListener("cancel", clearAPIKey);
window.addEventListener("pagehide", clearAPIKey);
aiDialog.addEventListener("close", () => {
  aiController?.abort();
  $("api-key").value = "";
  $("api-consent").checked = false;
  aiSnapshot = null;
  aiRows = [];
  $("ai-preview").value = "";
  aiReturnFocus?.focus();
});
$("ai-prompt").onclick = () => {
  saveFile(
    aiPrompt(),
    `HKS_67-${aiSnapshot.meta.code}-ChatGPT-prompt.txt`,
    "text/plain;charset=utf-8",
  );
  $("ai-notice").textContent =
    "Complete prompt downloaded. Upload or paste it into ChatGPT, review and send manually.";
};
$("ai-copy").onclick = async () => {
  try {
    await navigator.clipboard.writeText(aiPrompt());
    await chrome.tabs.create({ url: "https://chatgpt.com/" });
    $("ai-notice").textContent =
      "Copied. Paste into ChatGPT, review and send. Nothing was submitted automatically.";
  } catch {
    $("ai-notice").textContent =
      "Clipboard or new-tab access was blocked. Download the complete prompt and paste/upload it manually instead.";
  }
};
$("ai-cancel").onclick = () => aiController?.abort();
$("ai-generate").onclick = async () => {
  if (aiController || aiPermissionPending) return;
  if (!$("api-consent").checked) {
    $("ai-notice").textContent =
      "Review the exact prompt and give explicit consent before sending.";
    return;
  }
  let key = $("api-key").value.trim();
  if (!key) {
    $("ai-notice").textContent =
      "Enter an API key, or use the free local report / manual handoff.";
    return;
  }
  const model = $("api-model").value.trim(),
    prompt = aiPrompt(),
    snapshot = aiSnapshot,
    rows = aiRows;
  aiPermissionPending = true;
  let granted = false;
  try {
    granted = await chrome.permissions.request({
      origins: ["https://api.openai.com/*"],
    });
  } catch {
  } finally {
    aiPermissionPending = false;
  }
  if (!aiDialog.open) {
    key = "";
    return;
  }
  if (!granted) {
    key = "";
    $("ai-notice").textContent =
      "API host permission declined. No comments were sent.";
    return;
  }
  aiController = new AbortController();
  const timeout = setTimeout(() => aiController?.abort(), 90000);
  $("ai-generate").disabled = true;
  $("ai-cancel").disabled = false;
  $("api-key").value = "";
  $("api-consent").checked = false;
  $("ai-notice").textContent =
    "Sending reviewed dataset to OpenAI. Waiting for a response…";
  const requestController = aiController;
  try {
    const result = await HKSAI.generate({
      key,
      model,
      prompt,
      signal: requestController.signal,
    });
    if (requestController.signal.aborted)
      throw new DOMException("Request cancelled", "AbortError");
    saveFile(
      HKSAnalysis.report(snapshot, rows, result),
      `HKS_67-${snapshot.meta.code}-AI-analysis.html`,
      "text/html;charset=utf-8",
    );
    $("ai-notice").textContent =
      "AI report downloaded with local charts and full evidence. Verify interpretations; provider output may be incomplete or inaccurate.";
  } catch (e) {
    $("ai-notice").textContent =
      e.name === "AbortError"
        ? "Request cancelled or timed out after 90 seconds. Provider billing may still occur. No automatic retry."
        : "AI request failed: " + e.message;
  } finally {
    key = "";
    clearTimeout(timeout);
    aiController = null;
    $("ai-generate").disabled = false;
    $("ai-cancel").disabled = true;
  }
};
