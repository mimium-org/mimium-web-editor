export function encodeBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeBase64Url(text: string): string | null {
  try {
    const decodedText = (() => {
      try {
        return decodeURIComponent(text);
      } catch {
        return text;
      }
    })();
    const normalized = decodedText.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function getSourceFromHash(): string | null {
  const hash = window.location.hash.slice(1);
  if (!hash) {
    return null;
  }

  // Accept both "#src=..." and plain "#..." forms.
  const params = new URLSearchParams(hash);
  const payload = params.get("src") ?? (hash.startsWith("src=") ? hash.slice(4) : hash);
  return decodeBase64Url(payload);
}
