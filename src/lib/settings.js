export const SETTINGS_KEY = "settings:v1";

export const defaultSettings = {
  folderId: "",
  fileNamePattern: "{title}_{datetime:YYYYMMDD-HHmmss}.pdf",
  pdfOptions: {
    landscape: false,
    printBackground: true,
    paper: "A4",
    margin: "default"
  },
  notifications: { enabled: true, copyLinkOnSuccess: false },
  language: "ja",
  preferFallback: false
};

export async function getSettings() {
  const data = await chrome.storage.sync.get(SETTINGS_KEY);
  const stored = data[SETTINGS_KEY] || {};
  return deepMerge(defaultSettings, stored);
}

export async function saveSettings(partial) {
  const current = await getSettings();
  const next = deepMerge(current, partial || {});
  await chrome.storage.sync.set({ [SETTINGS_KEY]: next });
  return next;
}

function isObject(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}

function deepMerge(a, b) {
  const out = Array.isArray(a) ? [...a] : { ...a };
  for (const k of Object.keys(b)) {
    if (isObject(b[k]) && isObject(a[k])) out[k] = deepMerge(a[k], b[k]);
    else out[k] = b[k];
  }
  return out;
}

