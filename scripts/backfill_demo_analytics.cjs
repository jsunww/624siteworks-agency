/**
 * One-time / idempotent backfill script to copy the updated telemetry-enabled
 * preview-banner.js (GA4 + 1st-party Firestore view tracking) into existing
 * .pages.dev demo site builds in F:\624 SITEWORKS\Client Sites and redeploy them
 * to Cloudflare Pages.
 *
 * Usage:
 *   node scripts/backfill_demo_analytics.cjs          # copy & deploy active demo_sites
 *   node scripts/backfill_demo_analytics.cjs --dry    # preview targets without deploying
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const BANNER_SRC = path.join(ROOT, 'assets', 'preview-banner.js');
const CLIENT_SITES_DIR = 'F:\\624 SITEWORKS\\Client Sites';

function loadEnv() {
  if (!fs.existsSync(ENV_PATH)) return;
  for (const line of fs.readFileSync(ENV_PATH, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const eq = t.indexOf('=');
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (k && !process.env[k]) process.env[k] = v;
  }
}

async function deployProject(siteDir, projectName) {
  const isWin = process.platform === 'win32';
  const cmd = isWin ? 'cmd.exe' : 'npx';
  const args = isWin
    ? ['/c', 'npx', 'wrangler', 'pages', 'deploy', siteDir, `--project-name=${projectName}`, '--branch=main', '--commit-dirty=true']
    : ['wrangler', 'pages', 'deploy', siteDir, `--project-name=${projectName}`, '--branch=main', '--commit-dirty=true'];

  await execFileAsync(cmd, args, {
    cwd: ROOT,
    env: {
      ...process.env,
      CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN
    },
    maxBuffer: 1024 * 1024 * 8
  });
}

async function main() {
  loadEnv();
  const isDry = process.argv.includes('--dry');

  if (!fs.existsSync(BANNER_SRC)) {
    throw new Error('Missing preview-banner.js at ' + BANNER_SRC);
  }

  const res = await fetch('https://firestore.googleapis.com/v1/projects/admin-hub-cc0a2/databases/(default)/documents/demo_sites?pageSize=200');
  const data = await res.json();
  const docs = data.documents || [];
  const localDirs = new Set(fs.readdirSync(CLIENT_SITES_DIR));

  const targets = [];
  for (const doc of docs) {
    const id = doc.name.split('/').pop();
    const cf = doc.fields?.cfProjectName?.stringValue || id;
    const url = doc.fields?.url?.stringValue || '';
    if (!url.includes('.pages.dev')) continue;
    const dirName = localDirs.has(id) ? id : (localDirs.has(cf) ? cf : '');
    if (!dirName) continue;
    const siteDir = path.join(CLIENT_SITES_DIR, dirName);
    const destBanner = path.join(siteDir, 'assets', 'preview-banner.js');
    if (fs.existsSync(destBanner)) {
      targets.push({ id, cf, siteDir, destBanner });
    }
  }

  console.log(`Found ${targets.length} active .pages.dev demo site(s) to update.`);
  if (isDry) {
    targets.forEach(t => console.log(`  [DRY] ${t.cf} -> ${t.siteDir}`));
    return;
  }

  let succeeded = 0;
  let failed = 0;

  // Run in batches of 3 to stay fast and avoid Wrangler API rate limits
  const concurrency = 3;
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    await Promise.all(batch.map(async t => {
      try {
        fs.copyFileSync(BANNER_SRC, t.destBanner);
        await deployProject(t.siteDir, t.cf);
        succeeded++;
        console.log(`  [OK ${succeeded}/${targets.length}] ${t.cf}.pages.dev`);
      } catch (err) {
        failed++;
        console.warn(`  [FAIL] ${t.cf}: ${err.message}`);
      }
    }));
  }

  console.log(`Backfill complete: ${succeeded} updated cleanly, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch(err => {
  console.error('Backfill failed:', err.message);
  process.exit(1);
});

