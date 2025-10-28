export async function ensureAuthToken(interactive = true) {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, token => {
      if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
      else if (!token) reject(new Error("No token"));
      else resolve(token);
    });
  });
}

