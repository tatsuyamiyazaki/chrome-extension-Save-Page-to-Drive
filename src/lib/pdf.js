function a4Size(landscape) {
  const w = 8.27, h = 11.69;
  return landscape ? { w: h, h: w } : { w, h };
}

function margins(kind) {
  if (kind === "none") return { t: 0, b: 0, l: 0, r: 0 };
  if (kind === "narrow") return { t: 0.2, b: 0.2, l: 0.2, r: 0.2 };
  return { t: 0.4, b: 0.4, l: 0.4, r: 0.4 };
}

export async function printTabToPDF(tabId, options) {
  const landscape = !!options?.landscape;
  const printBackground = options?.printBackground !== false;
  const paper = (options?.paper || "A4").toUpperCase();
  const m = margins(options?.margin || "default");
  const size = paper === "A4" ? a4Size(landscape) : a4Size(landscape);
  const target = { tabId };
  await new Promise((resolve, reject) => {
    chrome.debugger.attach(target, "1.3", () => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve();
    });
  });
  try {
    await sendCommand(target, "Page.enable", {});
    const res = await sendCommand(target, "Page.printToPDF", {
      landscape,
      printBackground,
      displayHeaderFooter: false,
      paperWidth: size.w,
      paperHeight: size.h,
      marginTop: m.t,
      marginBottom: m.b,
      marginLeft: m.l,
      marginRight: m.r
    });
    const base64 = res.data;
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  } finally {
    try {
      await new Promise(r => chrome.debugger.detach(target, () => r()));
    } catch {}
  }
}

function sendCommand(target, method, params) {
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand(target, method, params, result => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else resolve(result || {});
    });
  });
}

