import { getSettings, saveSettings } from "../lib/settings.js";

const $ = s => document.querySelector(s);
const set = (el, v) => (el instanceof HTMLInputElement && (el.type === "checkbox" ? el.checked = !!v : el.value = v), v);
const get = el => (el instanceof HTMLInputElement ? (el.type === "checkbox" ? !!el.checked : el.value) : undefined);

function i18n(id, fallback) { return chrome.i18n.getMessage(id) || fallback; }

async function init() {
  $("#title").textContent = i18n("options_title", "Options");
  $("#save").textContent = i18n("save", "Save");
  const s = await getSettings();
  set($("#folderId"), s.folderId);
  set($("#fileNamePattern"), s.fileNamePattern);
  $("#landscape").checked = !!s.pdfOptions.landscape;
  $("#printBackground").checked = s.pdfOptions.printBackground !== false;
  $("#paper").value = s.pdfOptions.paper || "A4";
  $("#margin").value = s.pdfOptions.margin || "default";

  $("#save").addEventListener("click", async () => {
    const next = {
      folderId: get($("#folderId")),
      fileNamePattern: get($("#fileNamePattern")),
      pdfOptions: {
        landscape: $("#landscape").checked,
        printBackground: $("#printBackground").checked,
        paper: $("#paper").value,
        margin: $("#margin").value
      }
    };
    await saveSettings(next);
    $("#status").textContent = i18n("saved", "Saved");
  });
}

init();

