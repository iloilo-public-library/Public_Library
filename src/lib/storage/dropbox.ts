import { logger } from "@/lib/logger";

const DROPBOX_TOKEN_URL = "https://api.dropboxapi.com/oauth2/token";
const DROPBOX_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload";
const DROPBOX_DOWNLOAD_URL = "https://content.dropboxapi.com/2/files/download";
const DROPBOX_DELETE_URL = "https://api.dropboxapi.com/2/files/delete_v2";
const DROPBOX_TEMP_LINK_URL = "https://api.dropboxapi.com/2/files/get_temporary_link";

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export function isDropboxConfigured(): boolean {
  return Boolean(
    process.env.DROPBOX_APP_KEY?.trim() &&
      process.env.DROPBOX_APP_SECRET?.trim() &&
      process.env.DROPBOX_REFRESH_TOKEN?.trim()
  );
}

async function getDropboxAccessToken(): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.token;
  }

  const appKey = process.env.DROPBOX_APP_KEY?.trim();
  const appSecret = process.env.DROPBOX_APP_SECRET?.trim();
  const refreshToken = process.env.DROPBOX_REFRESH_TOKEN?.trim();

  if (!appKey || !appSecret || !refreshToken) {
    throw new Error(
      "Dropbox credentials are missing (DROPBOX_APP_KEY, DROPBOX_APP_SECRET, DROPBOX_REFRESH_TOKEN)."
    );
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: appKey,
    client_secret: appSecret,
  });

  const resp = await fetch(DROPBOX_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Dropbox token refresh failed", {
      status: resp.status,
      body: errText.slice(0, 300),
    });
    throw new Error("Dropbox authorization failed (refresh token expired or revoked).");
  }

  const json = (await resp.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) {
    throw new Error("Dropbox token response did not include an access_token.");
  }

  const ttlMs = Math.max(300, (json.expires_in ?? 14_400) - 120) * 1000;
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + ttlMs,
  };

  return cachedAccessToken.token;
}

export async function uploadToDropbox(dropboxPath: string, data: Uint8Array): Promise<void> {
  const token = await getDropboxAccessToken();
  const resp = await fetch(DROPBOX_UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/octet-stream",
      "Dropbox-API-Arg": JSON.stringify({
        path: dropboxPath,
        mode: "add",
        autorename: false,
        mute: true,
      }),
    },
    body: Buffer.from(data),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Dropbox upload failed", {
      path: dropboxPath,
      status: resp.status,
      body: errText.slice(0, 300),
    });
    if (errText.includes("missing_scope")) {
      throw new Error("Dropbox app is missing the files.content.write scope.");
    }
    throw new Error(`Dropbox upload failed (${resp.status}).`);
  }
}

export async function downloadFromDropbox(dropboxPath: string): Promise<Uint8Array | null> {
  const token = await getDropboxAccessToken();
  const resp = await fetch(DROPBOX_DOWNLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
    },
  });

  if (resp.status === 409) {
    // Dropbox returns 409 path/not_found when file does not exist
    return null;
  }

  if (!resp.ok) {
    const errText = await resp.text().catch(() => "");
    logger.error("Dropbox download failed", {
      path: dropboxPath,
      status: resp.status,
      body: errText.slice(0, 300),
    });
    return null;
  }

  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

export async function getDropboxTemporaryLink(dropboxPath: string): Promise<string | null> {
  const token = await getDropboxAccessToken();
  const resp = await fetch(DROPBOX_TEMP_LINK_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: dropboxPath }),
  });

  if (!resp.ok) return null;
  const json = (await resp.json()) as { link?: string };
  return json.link ?? null;
}

export async function deleteFromDropbox(dropboxPath: string): Promise<boolean> {
  try {
    const token = await getDropboxAccessToken();
    const resp = await fetch(DROPBOX_DELETE_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });
    if (resp.ok || resp.status === 409) return true;
    logger.warn("Dropbox delete returned non-OK status", { status: resp.status });
    return false;
  } catch (err) {
    logger.warn("Dropbox delete failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}
