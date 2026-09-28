// Pull / push a Power Automate cloud flow (non-solution) via the Flow Management API.
//
//   node scripts/flow.mjs envs                 list environments you can access
//   node scripts/flow.mjs list                 list flows in ENV_ID
//   node scripts/flow.mjs pull [flowId]        download flow to flows/<flowId>/
//   node scripts/flow.mjs push [flowId]        upload flows/<flowId>/ back (stop -> patch -> start)
//   node scripts/flow.mjs runs [flowId]        show last 10 runs + errors of failed actions
//
// Config comes from .env (ENV_ID, FLOW_ID, optional TENANT_ID).
// Secrets: definition.json in the repo holds placeholders like {{COMPARE_FN_KEY}};
// push fills them from .env, pull turns the real values back into placeholders.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { getToken } from './auth.mjs';

try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // no .env — rely on real environment variables
}

const API = 'https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple';
const VERSION = 'api-version=2016-11-01';
const { ENV_ID } = process.env;

async function api(method, path, body) {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${sep}${VERSION}`, {
    method,
    headers: { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}\n${text}`);
  return text ? JSON.parse(text) : null;
}

function requireEnv() {
  if (!ENV_ID) throw new Error('ENV_ID is not set (see .env.example). Run "envs" to find it.');
}

const flowDir = (id) => new URL(`../flows/${id}/`, import.meta.url);
const writeJson = (url, data) => writeFile(url, JSON.stringify(data, null, 2) + '\n');
const readJson = async (url) => JSON.parse(await readFile(url, 'utf8'));

const SECRETS = ['COMPARE_FN_KEY'];

function fillSecrets(definition) {
  let json = JSON.stringify(definition);
  for (const name of SECRETS) {
    if (!json.includes(`{{${name}}}`)) continue;
    if (!process.env[name]) throw new Error(`${name} is not set in .env (needed by definition.json)`);
    json = json.replaceAll(`{{${name}}}`, process.env[name]);
  }
  return JSON.parse(json);
}

function maskSecrets(definition) {
  let json = JSON.stringify(definition);
  for (const name of SECRETS) {
    if (process.env[name]) json = json.replaceAll(process.env[name], `{{${name}}}`);
  }
  return JSON.parse(json);
}

const commands = {
  async envs() {
    const { value } = await api('GET', '/environments');
    for (const e of value) console.log(`${e.name}\t${e.properties.displayName}`);
  },

  async list() {
    requireEnv();
    const { value } = await api('GET', `/environments/${ENV_ID}/flows`);
    for (const f of value) console.log(`${f.name}\t${f.properties.state}\t${f.properties.displayName}`);
  },

  async pull(id) {
    requireEnv();
    const flow = await api('GET', `/environments/${ENV_ID}/flows/${id}`);
    const { displayName, state, definition, connectionReferences } = flow.properties;
    const dir = flowDir(id);
    await mkdir(dir, { recursive: true });
    await writeJson(new URL('definition.json', dir), maskSecrets(definition));
    await writeJson(new URL('connectionReferences.json', dir), connectionReferences ?? {});
    await writeJson(new URL('meta.json', dir), { id, envId: ENV_ID, displayName, state });
    console.log(`Pulled "${displayName}" (${state}) -> flows/${id}/`);
  },

  async runs(id) {
    requireEnv();
    const base = `/environments/${ENV_ID}/flows/${id}/runs`;
    const { value } = await api('GET', `${base}?$top=10`);
    for (const run of value) {
      const { startTime, status, error } = run.properties;
      console.log(`${startTime}\t${status}\t${run.name}`);
      if (status !== 'Failed') continue;
      const actions = await api('GET', `${base}/${run.name}/actions`);
      for (const a of actions.value.filter((x) => x.properties.status === 'Failed')) {
        let message = a.properties.error?.message;
        const outputsLink = a.properties.outputsLink?.uri;
        if (!message && outputsLink) {
          const outputs = await (await fetch(outputsLink)).json();
          message = `${outputs.statusCode} ${outputs.body?.message ?? JSON.stringify(outputs.body)}`;
        }
        console.log(`  ${a.name}: ${message?.split(/\r?\n/)[0] ?? error?.message}`);
      }
    }
  },

  async push(id) {
    requireEnv();
    const dir = flowDir(id);
    const definition = fillSecrets(await readJson(new URL('definition.json', dir)));
    const connectionReferences = await readJson(new URL('connectionReferences.json', dir));
    const { displayName } = await readJson(new URL('meta.json', dir));

    const base = `/environments/${ENV_ID}/flows/${id}`;
    const { state } = (await api('GET', base)).properties;
    if (state === 'Started') await api('POST', `${base}/stop`);

    await api('PATCH', base, { properties: { displayName, definition, connectionReferences } });

    if (state === 'Started') await api('POST', `${base}/start`);
    console.log(`Pushed "${displayName}" (state: ${state})`);
  },
};

const [cmd, arg] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Usage: node scripts/flow.mjs <envs|list|pull|push|runs> [flowId]');
  process.exit(1);
}
const id = arg || process.env.FLOW_ID;
if ((cmd === 'pull' || cmd === 'push' || cmd === 'runs') && !id) throw new Error('Pass a flowId or set FLOW_ID in .env');

commands[cmd](id).catch((err) => {
  console.error(err.message);
  process.exit(1);
});
