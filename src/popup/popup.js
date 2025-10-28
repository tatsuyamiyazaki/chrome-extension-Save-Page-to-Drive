import { getSettings } from "../lib/settings.js";

const $ = sel => document.querySelector(sel);

function i18n(id, fallback) {
  return chrome.i18n.getMessage(id) || fallback;
}

async function init() {
  $("#saveBtn").textContent = i18n("save_to_drive", "Save to Drive");
  $("#opt").textContent = i18n("open_options", "Options");
  const s = await getSettings();
  $("#folder").textContent = s.folderId ? `Folder: ${s.folderId}` : i18n("no_folder_set", "Folder not set");
  $("#saveBtn").addEventListener("click", async () => {
    $("#status").textContent = i18n("saving", "Saving...");
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.runtime.sendMessage({ type: "SAVE_PAGE_REQUEST", tabId: tab?.id });
    $("#status").textContent = i18n("requested", "Requested");
  });
}

init();

