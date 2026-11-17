/**
 * Syncs the canonical bespoke site builder, web scraper, stock assets, and overrides
 * from 624siteworks.com into 624LLC/functions/site_builder so Firebase Cloud Functions
 * execute the exact same build pipeline as autonomous_lead_engine.js.
 */

const fs = require('node:fs');
const path = require('node:path');

const SITEWORKS_ROOT = path.resolve(__dirname, '..');
const FUNCTIONS_BUILDER_ROOT = path.resolve(SITEWORKS_ROOT, '..', '624LLC', 'functions', 'site_builder');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return 0;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    let count = 0;
    for (const entry of fs.readdirSync(src)) {
      count += copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return count;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return 1;
}

if (fs.existsSync(FUNCTIONS_BUILDER_ROOT)) {
  fs.rmSync(FUNCTIONS_BUILDER_ROOT, { recursive: true, force: true });
}

let copied = 0;
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'scripts', 'lib', 'bespoke_site_builder.cjs'), path.join(FUNCTIONS_BUILDER_ROOT, 'bespoke_site_builder.cjs'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'scripts', 'prospect_web_scraper.cjs'), path.join(FUNCTIONS_BUILDER_ROOT, 'prospect_web_scraper.cjs'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'assets', 'preview-banner.js'), path.join(FUNCTIONS_BUILDER_ROOT, 'assets', 'preview-banner.js'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'assets', 'style.min.css'), path.join(FUNCTIONS_BUILDER_ROOT, 'assets', 'style.min.css'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'functions', 'api', 'contact.js'), path.join(FUNCTIONS_BUILDER_ROOT, 'functions', 'api', 'contact.js'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'assets', 'stock'), path.join(FUNCTIONS_BUILDER_ROOT, 'assets', 'stock'));
copied += copyRecursive(path.join(SITEWORKS_ROOT, 'assets', 'client-overrides'), path.join(FUNCTIONS_BUILDER_ROOT, 'assets', 'client-overrides'));

console.log(`Synced ${copied} shared site-builder file(s) to: ${FUNCTIONS_BUILDER_ROOT}`);

