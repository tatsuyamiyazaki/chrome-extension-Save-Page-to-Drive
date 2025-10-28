import { getSettings } from "../lib/settings.js";
import { ensureAuthToken } from "../lib/auth.js";
import { uploadPdf } from "../lib/drive.js";
import { printTabToPDF } from "../lib/pdf.js";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "save-pdf", title: chrome.i18n.getMessage("save_to_drive") || "Save to Drive", contexts: ["page"] });
});

chrome.action.onClicked.addListener(async tab => {
  if (tab && tab.id != null) saveForTab(tab.id);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "save-pdf" && tab && tab.id != null) saveForTab(tab.id);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "SAVE_PAGE_REQUEST") {
    if (msg.tabId != null) saveForTab(msg.tabId);
    else currentActiveTabId().then(id => saveForTab(id));
    sendResponse({ ok: true });
    return true;
  }
});

async function currentActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function readTab(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return tab;
}

function sanitizeFileName(name) {
  return name.replace(/[\\/:*?"<>|]/g, "_");
}

function formatDate(dt, fmt) {
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  const map = {
    YYYY: dt.getFullYear(),
    MM: pad(dt.getMonth() + 1),
    DD: pad(dt.getDate()),
    HH: pad(dt.getHours()),
    mm: pad(dt.getMinutes()),
    ss: pad(dt.getSeconds())
  };
  return fmt.replace(/YYYY|MM|DD|HH|mm|ss/g, k => map[k]);
}

function formatFileName(pattern, tab) {
  let out = pattern || "{title}_{datetime:YYYYMMDD-HHmmss}.pdf";
  const title = tab?.title || "page";
  out = out.replace(/{title}/g, sanitizeFileName(title));
  out = out.replace(/{urlHost}/g, (() => {
    try { return new URL(tab?.url || "").host || ""; } catch { return ""; }
  })());
  out = out.replace(/
    {datetime:([^}]+)}
  /gx, (_, fmt) => formatDate(new Date(), fmt));
  if (!out.toLowerCase().endsWith(".pdf")) out += ".pdf";
  return out;
}

async function notifyProgress(title, message) {
  const id = `save-drive-${Date.now()}`;
  await chrome.notifications.create(id, { type: "basic", iconUrl: "assets/icons/128.png", title, message });
  return id;
}

async function updateNotification(id, title, message) {
  await chrome.notifications.update(id, { title, message });
}

async function saveForTab(tabId) {
  const settings = await getSettings();
  const tab = await readTab(tabId);
  const notifyId = await notifyProgress(chrome.i18n.getMessage("saving") || "Saving...", tab?.title || "");
  try {
    const pdfBytes = await printTabToPDF(tabId, {
      landscape: settings.pdfOptions.landscape,
      printBackground: settings.pdfOptions.printBackground,
      paper: settings.pdfOptions.paper,
      margin: settings.pdfOptions.margin
    });
    const token = await ensureAuthToken(true);
    const filename = formatFileName(settings.fileNamePattern, tab);
    const result = await uploadPdf(token, settings.folderId, pdfBytes, filename);
    const title = chrome.i18n.getMessage("saved") || "Saved";
    const link = result?.webViewLink || "";
    const msg = link ? `${filename}\n${link}` : filename;
    await updateNotification(notifyId, title, msg);
  } catch (e) {
    const title = chrome.i18n.getMessage("error") || "Error";
    const msg = String(e && e.message || e);
    await updateNotification(notifyId, title, msg);
  }
}

