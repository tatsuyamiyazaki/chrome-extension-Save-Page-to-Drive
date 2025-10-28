function enc(str) {
  return new TextEncoder().encode(str);
}

function concatParts(parts) {
  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p instanceof Uint8Array ? p : new Uint8Array(p), off);
    off += p.byteLength;
  }
  return out;
}

export async function uploadPdf(token, folderId, pdfBytes, filename) {
  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const meta = { name: filename, mimeType: "application/pdf" };
  if (folderId) meta.parents = [folderId];
  const metaPart = enc(
    `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}`
  );
  const fileHeader = enc(
    `${delimiter}Content-Type: application/pdf\r\n\r\n`
  );
  const trailer = enc(closeDelimiter);
  const body = concatParts([enc(""), metaPart, fileHeader, pdfBytes, trailer]);

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`
      },
      body
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Drive upload failed: ${res.status} ${text}`);
  }
  return res.json();
}

