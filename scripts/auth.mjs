// Device-code login for the Power Automate (Flow) API, with a local refresh-token cache.
import { readFile, writeFile } from 'node:fs/promises';

// Public client ID of Azure CLI — allowed to request tokens for service.flow.microsoft.com
const CLIENT_ID = '04b07795-8ddb-461a-bbee-02f9e1bf7b46';
const SCOPE = 'https://service.flow.microsoft.com//.default offline_access';
const CACHE_FILE = new URL('../.token-cache.json', import.meta.url);

const tenant = process.env.TENANT_ID || 'organizations';
const authority = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;

async function post(url, params) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  return { ok: res.ok, body: await res.json() };
}

async function saveCache(tokens) {
  const cache = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: Date.now() + (tokens.expires_in - 60) * 1000,
  };
  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2));
  return cache.access_token;
}

async function deviceCodeLogin() {
  const { ok, body } = await post(`${authority}/devicecode`, { client_id: CLIENT_ID, scope: SCOPE });
  if (!ok) throw new Error(`Device code request failed: ${JSON.stringify(body)}`);
  console.log(`\n${body.message}\n`);

  while (true) {
    await new Promise((r) => setTimeout(r, body.interval * 1000));
    const res = await post(`${authority}/token`, {
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      client_id: CLIENT_ID,
      device_code: body.device_code,
    });
    if (res.ok) return saveCache(res.body);
    if (res.body.error !== 'authorization_pending' && res.body.error !== 'slow_down') {
      throw new Error(`Login failed: ${res.body.error_description || res.body.error}`);
    }
  }
}

export async function getToken() {
  let cache;
  try {
    cache = JSON.parse(await readFile(CACHE_FILE, 'utf8'));
  } catch {
    return deviceCodeLogin();
  }
  if (cache.expires_at > Date.now()) return cache.access_token;

  const res = await post(`${authority}/token`, {
    grant_type: 'refresh_token',
    client_id: CLIENT_ID,
    refresh_token: cache.refresh_token,
    scope: SCOPE,
  });
  return res.ok ? saveCache(res.body) : deviceCodeLogin();
}
