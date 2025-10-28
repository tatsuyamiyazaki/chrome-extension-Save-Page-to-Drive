export async function uploadPdf(token, folderId, pdfBytes, filename) {
  const boundary = "----savepagetodrive-" + Math.random().toString(36).slice(2);
  const meta = { name: filename, mimeType: "application/pdf" };
  if (folderId) meta.parents = [folderId];
  const preamble = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`;
  const mid = `--${boundary}\r\nContent-Type: application/pdf\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = new Blob([
    preamble,
    mid,
    new Blob([pdfBytes], { type: "application/pdf" }),
    closing
  ], { type: `multipart/related; boundary=${boundary}` });

  const url = "https://www.googleapis.com/upload/drive/v3/files" +
    "?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,parents";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive upload failed: ${res.status} ${text}`);
  }
  return res.json();
}
