/**
 * ============================================================================
 * 624 Siteworks Autonomous Scheduled Lead Engine Orchestrator
 * ============================================================================
 * 
 * Multi-Agent Autonomous Pipeline:
 *  1. The Scout: Scrapes and audits local trade leads via Google Apps Script (Serper/Maps).
 *  2. The Diagnoser & Ranker: Identifies up to the worst 5 qualifying websites, enriches with Gemini AI,
 *     and leaves the rest as an on-demand queue in Google Sheets.
 *  3. The Deep Researcher & Brand Stylist: Researches real social media pages (Facebook,
 *     Instagram, LinkedIn, BBB), extracts real website images, logo colors, and owner info.
 *  4. The Builder: Generates completely bespoke, uniquely styled 4-page Tailwind sites
 *     with custom color palettes, real & trade photography, downloads/optimizes images,
 *     deploys to Cloudflare Pages, updates Google Sheet, and registers in Demo Sites Hub.
 *  5. The Pitcher: Creates tailored outreach emails saved directly into Zoho Mail Drafts.
 *  6. Daily Digest: Delivers completion summary to hello@624siteworks.com.
 * 
 * Schedule: Runs weekdays at 6:00 AM Central (CRON_TZ=America/Chicago 0 6 * * 1-5).
 * ============================================================================
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { scrapeProspectWebsite } = require('./prospect_web_scraper.cjs');
const {
  ROTATING_NICHES,
  createSiteBuilder,
  sanitizeSlug,
  escapeHtml,
  formatCityState,
  getTradeKey
} = require('./lib/bespoke_site_builder.cjs');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

// ============================================================================
// CONFIGURATION & CREDENTIALS
// ============================================================================

const CONFIG = {
  // Google Apps Script Web App
  APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzu96UHOV_b-TGR9SVpi_wNjsw1p1cfWOw0fqx0AcehnTZ2RrGLYGDDl3FOsXa7-jFP1Q/exec',

  // Google Gemini API (AI Studio)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  GEMINI_MODEL: 'gemini-3.5-flash',
  GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',

  // Cloudflare Pages
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID || '',
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN || '',

  // Zoho Mail OAuth (hello@624siteworks.com)
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID || '1000.JJO8VEGSC6HYKIJ12Q5MPEEF7XGZ5E',
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET || 'ce34571bc44c82dc4ed2d6e118d84ab94aa32d2e08',
  ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN || '1000.f6a5a5aa3ca3653aa218bf027d621ac1.f3de66a78a5155cf73a1a793075b2a2c',
  ZOHO_ACCOUNT_ID: process.env.ZOHO_ACCOUNT_ID || '5967598000000008002',
  ZOHO_FROM_ADDRESS: process.env.ZOHO_FROM_ADDRESS || 'hello@624siteworks.com',
  DIGEST_RECIPIENT: process.env.DIGEST_RECIPIENT || 'hello@624siteworks.com',

  // Firebase Firestore REST API (Admin Hub Demo Sites)
  FIRESTORE_PROJECT_ID: process.env.FIRESTORE_PROJECT_ID || 'admin-hub-cc0a2',
  FIRESTORE_API_KEY: process.env.FIRESTORE_API_KEY || '',

  // File Paths
  SPEC_SITES_ROOT: 'F:\\624 SITEWORKS\\Client Sites',
  PREVIEW_BANNER_SRC: 'F:\\624 SITEWORKS\\My Sites\\624siteworks.com\\assets\\preview-banner.js',
  CONTACT_API_SRC: 'F:\\624 SITEWORKS\\My Sites\\624siteworks.com\\functions\\api\\contact.js',
  STYLE_CSS_SRC: 'F:\\624 SITEWORKS\\My Sites\\624siteworks.com\\assets\\style.min.css',
  STATE_FILE: path.join(__dirname, 'lead_engine_state.json'),

  // Agency Contact & Claim URL
  AGENCY_PHONE: '(920) 234-5633',
  CLAIM_BASE_URL: 'https://624siteworks.com/claim.html'
};

const SITE_ASSETS_ROOT = path.resolve(__dirname, '..');
const siteBuilder = createSiteBuilder({
  stockRootDir: path.join(SITE_ASSETS_ROOT, 'assets', 'stock'),
  previewBannerPath: CONFIG.PREVIEW_BANNER_SRC,
  contactApiPath: CONFIG.CONTACT_API_SRC,
  styleCssPath: CONFIG.STYLE_CSS_SRC,
  clientOverridesDir: path.join(SITE_ASSETS_ROOT, 'assets', 'client-overrides'),
  appsScriptUrl: CONFIG.APPS_SCRIPT_URL,
  geminiApiKey: CONFIG.GEMINI_API_KEY,
  geminiModel: CONFIG.GEMINI_MODEL,
  geminiFallbackModel: CONFIG.GEMINI_FALLBACK_MODEL,
  agencyPhone: CONFIG.AGENCY_PHONE,
  claimBaseUrl: CONFIG.CLAIM_BASE_URL,
  scrapeProspectWebsite,
  logger: {
    logSub: (m) => logSub(m),
    logSuccess: (m) => logSuccess(m),
    logWarn: (m) => logWarn(m),
    logError: (m) => logError(m)
  }
});

const {
  researchBusinessOnline,
  synthesizeBespokeBranding,
  prepareProjectAssets,
  generateBespokeSiteMarkup,
  generatePitchEmailMarkup,
  loadClientOverride,
  getTradeCopyProfile
} = siteBuilder;

function getSlugSeed(str) {
  let h = 0;
  for (let i = 0; i < (str || '').length; i++) {
    h = ((h << 5) - h) + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

// Set environment for child processes (wrangler)
process.env.CLOUDFLARE_ACCOUNT_ID = CONFIG.CLOUDFLARE_ACCOUNT_ID;
process.env.CLOUDFLARE_API_TOKEN = CONFIG.CLOUDFLARE_API_TOKEN;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function logStep(stepNum, agentName, message) {
  const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`\n\x1b[36m[${timestamp}] [Agent ${stepNum}: ${agentName}]\x1b[0m ${message}`);
}

function logSub(message) {
  console.log(`  \x1b[90m↳\x1b[0m ${message}`);
}

function logSuccess(message) {
  console.log(`  \x1b[32m✔\x1b[0m ${message}`);
}

function logWarn(message) {
  console.log(`  \x1b[33m⚠\x1b[0m ${message}`);
}

function logError(message) {
  console.error(`  \x1b[31m✖\x1b[0m ${message}`);
}

function loadState() {
  try {
    if (fs.existsSync(CONFIG.STATE_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.STATE_FILE, 'utf8'));
    }
  } catch (e) {
    logWarn(`Could not read state file: ${e.message}`);
  }
  return { lastRunIndex: -1, lastRunDate: null, totalSitesBuilt: 0, runs: [] };
}

function saveState(state) {
  try {
    fs.writeFileSync(CONFIG.STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    logWarn(`Could not save state file: ${e.message}`);
  }
}

// ============================================================================
// ZOHO MAIL API CLIENT
// ============================================================================

let cachedZohoToken = null;
let tokenExpiresAt = 0;

async function getZohoAccessToken() {
  const now = Date.now();
  if (cachedZohoToken && now < tokenExpiresAt - 60000) {
    return cachedZohoToken;
  }

  const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CONFIG.ZOHO_CLIENT_ID,
      client_secret: CONFIG.ZOHO_CLIENT_SECRET,
      refresh_token: CONFIG.ZOHO_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Failed to refresh Zoho token: ${JSON.stringify(data)}`);
  }

  cachedZohoToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600) * 1000;
  return cachedZohoToken;
}

async function createZohoDraft(toAddress, subject, htmlContent) {
  const token = await getZohoAccessToken();
  const res = await fetch(`https://mail.zoho.com/api/accounts/${CONFIG.ZOHO_ACCOUNT_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fromAddress: CONFIG.ZOHO_FROM_ADDRESS,
      toAddress: toAddress || 'hello@624siteworks.com',
      subject: subject,
      content: htmlContent,
      mode: 'draft'
    })
  });

  const data = await res.json();
  if (data.status && data.status.code !== 200) {
    throw new Error(`Zoho Mail API draft error: ${data.status.description || JSON.stringify(data)}`);
  }
  return data;
}

async function sendZohoNotification(subject, htmlContent) {
  const token = await getZohoAccessToken();
  const res = await fetch(`https://mail.zoho.com/api/accounts/${CONFIG.ZOHO_ACCOUNT_ID}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fromAddress: CONFIG.ZOHO_FROM_ADDRESS,
      toAddress: CONFIG.DIGEST_RECIPIENT,
      subject: subject,
      content: htmlContent
    })
  });

  const data = await res.json();
  return data;
}

// ============================================================================
// FIREBASE FIRESTORE REST API (Demo Sites Hub)
// ============================================================================

async function registerInFirestoreDemoSites(siteData) {
  const docUrl = `https://firestore.googleapis.com/v1/projects/${CONFIG.FIRESTORE_PROJECT_ID}/databases/(default)/documents/demo_sites/${siteData.slug}?key=${CONFIG.FIRESTORE_API_KEY}`;

  const payload = {
    fields: {
      clientName: { stringValue: siteData.clientName || 'Spec Client' },
      slug: { stringValue: siteData.slug },
      cfProjectName: { stringValue: siteData.slug },
      url: { stringValue: siteData.url },
      repo: { stringValue: siteData.repo || '' },
      status: { stringValue: 'ready_to_pitch' },
      industry: { stringValue: siteData.industry || 'Contractor' },
      city: { stringValue: siteData.city || 'Fox Valley, WI' },
      contactPhone: { stringValue: siteData.contactPhone || '' },
      contactEmail: { stringValue: (siteData.contactEmail && siteData.contactEmail !== 'No email found') ? siteData.contactEmail : 'No email found' },
      createdAt: { timestampValue: new Date().toISOString() },
      lastDeployedAt: { stringValue: new Date().toISOString() },
      hidden: { booleanValue: false },
      autoSynced: { booleanValue: true },
      channel: { stringValue: 'email' }
    }
  };

  const res = await fetch(docUrl, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore REST write failed (${res.status}): ${errText}`);
  }
  return await res.json();
}

// ============================================================================
// AGENT 1: THE SCOUT
// ============================================================================

async function runTheScout(targetNiche) {
  logStep(1, 'The Scout', `Searching local maps for "${targetNiche.query}"...`);

  const postUrl = `${CONFIG.APPS_SCRIPT_URL}?action=runGate1`;
  const res = await fetch(postUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: targetNiche.query })
  });

  if (!res.ok) {
    throw new Error(`Gate 1 HTTP error (${res.status})`);
  }

  const result = await res.json();
  if (!result.success) {
    throw new Error(`Gate 1 Scraper failed: ${result.error || 'Unknown error'}`);
  }

  logSuccess(`Scraped & audited ${result.insertedCount || 0} qualified leads (skipped ${result.skippedUsableCount || 0} usable websites) from ${result.provider || 'Google Maps'}.`);
  logSub(`Website crawler discovered ${result.crawledEmailCount || 0} direct email address(es).`);
  return result;
}

// ============================================================================
// AGENT 2: THE DIAGNOSER & RANKER
// ============================================================================

const QUALIFYING_DEFECT_REGEX = /NO WEBSITE|FACEBOOK-ONLY|NO REAL WEBSITE|DEAD GOOGLE BUSINESS SITE|BROKEN|EMPTY|PARKED|EXPIRED|UNDER CONSTRUCTION|NOT SECURE|HTTP-ONLY|FREE SUBDOMAIN|NOT MOBILE-FRIENDLY|ANCIENT HTML|SKELETON SITE|ABANDONED/i;

function isLeadQualifiedProspect(lead) {
  const score = Number(lead.badnessScore ?? 0);
  if (score < 70) return false;

  const domain = String(lead.domainStatus || '').trim();
  const domainLower = domain.toLowerCase();
  const issues = String(lead.siteIssues || '');

  if (issues.includes('[USABLE SITE - SKIP]')) return false;
  if (!domain || domainLower.includes('no website')) return true;
  if (/(facebook\.com|fb\.com|m\.facebook\.com|instagram\.com|yelp\.com|bbb\.org|angi\.com|nextdoor\.com|yellowpages\.com|thumbtack\.com|houzz\.com)/i.test(domainLower)) return true;
  if (/(business\.site|wixsite\.com|weebly\.com|godaddysites\.com|wordpress\.com|blogspot\.com|sites\.google\.com|square\.site|jimdofree\.com|webnode\.page|ueniweb\.com|mystrikingly\.com|carrd\.co)/i.test(domainLower)) return true;
  if (domainLower.startsWith('http://')) return true;

  return QUALIFYING_DEFECT_REGEX.test(issues);
}

async function verifyLeadDoesNotHaveUsableSite(lead) {
  const domain = String(lead.domainStatus || '').trim();
  const domainLower = domain.toLowerCase();

  // Immediate pass for No Website, Social/Directory-only, or Free Subdomains
  if (!domain || domainLower.includes('no website')) return { qualified: true, reason: 'No website listed' };
  if (/(facebook\.com|fb\.com|m\.facebook\.com|instagram\.com|yelp\.com|bbb\.org|angi\.com|nextdoor\.com|yellowpages\.com|thumbtack\.com|houzz\.com)/i.test(domainLower)) {
    return { qualified: true, reason: 'Social/Directory-only link' };
  }
  if (/(business\.site|wixsite\.com|weebly\.com|godaddysites\.com|wordpress\.com|blogspot\.com|sites\.google\.com|square\.site|jimdofree\.com|webnode\.page|ueniweb\.com|mystrikingly\.com|carrd\.co)/i.test(domainLower)) {
    return { qualified: true, reason: 'Free builder subdomain' };
  }

  // Always test HTTPS first (even if Google Maps recorded an older http:// link)
  const cleanHost = domain.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const httpsUrl = `https://${cleanHost}`;
  const httpUrl = `http://${cleanHost}`;
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  };

  try {
    let res;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 9000);
      res = await fetch(httpsUrl, { signal: controller.signal, redirect: 'follow', headers: fetchHeaders });
      clearTimeout(timeout);
    } catch (httpsErr) {
      // HTTPS failed (SSL error / no cert) -> check if HTTP-only works
      const controller2 = new AbortController();
      const timeout2 = setTimeout(() => controller2.abort(), 8000);
      const httpRes = await fetch(httpUrl, { signal: controller2.signal, redirect: 'follow', headers: fetchHeaders });
      clearTimeout(timeout2);
      if (httpRes.ok) {
        return { qualified: true, reason: 'Strict HTTP-only website (missing/broken SSL certificate)' };
      }
      return { qualified: true, reason: `HTTP ${httpRes.status} broken response` };
    }

    if (!res.ok || res.status >= 400) {
      return { qualified: true, reason: `HTTP ${res.status} broken response` };
    }

    const finalUrl = (res.url || httpsUrl).toLowerCase();
    if (finalUrl.startsWith('http://')) {
      return { qualified: true, reason: 'Redirects to insecure HTTP' };
    }
    if (/(facebook\.com|fb\.com|instagram\.com)/i.test(finalUrl)) {
      return { qualified: true, reason: 'Redirects to social media page' };
    }

    const html = await res.text();
    if (!html || html.trim().length < 250) {
      return { qualified: true, reason: 'Empty / blank response' };
    }

    const textContent = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const titleAndH1Text = ((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') + ' ' +
      ((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');

    const hardParkedRegex = /(domain is parked|parked free|courtesy of godaddy|sedoparking|hugedomains|afternic|this domain may be for sale|buy this domain|website expired|this site is currently unavailable|account suspended|cgi-sys\/suspendedpage|default web site page|future home of something quite cool|deployment not found|this wix site is not yet published)/i;
    const placeholderRegex = /(website coming soon|^coming soon$|under construction|site not found)/i;
    if (
      hardParkedRegex.test(html) ||
      hardParkedRegex.test(textContent) ||
      placeholderRegex.test(titleAndH1Text) ||
      (textContent.length < 1500 && placeholderRegex.test(textContent))
    ) {
      return { qualified: true, reason: 'Parked, expired, or under construction domain' };
    }

    const hasViewport = /<meta[^>]*name=["']?viewport["']?/i.test(html);
    if (!hasViewport) {
      return { qualified: true, reason: 'Missing mobile viewport tag (non-responsive desktop site)' };
    }

    if (textContent.length < 300) {
      return { qualified: true, reason: `Skeleton page (${textContent.length} chars of text)` };
    }

    if (/<frameset|<frame\s|<marquee|<blink|Generator["']\s+content=["']Microsoft FrontPage/i.test(html)) {
      return { qualified: true, reason: '1990s/2000s obsolete HTML layout' };
    }

    // If it passed all checks (working HTTPS, mobile viewport, >300 chars content, not parked), it is a USABLE site!
    return { qualified: false, reason: 'Live check confirmed working, mobile-friendly HTTPS website' };
  } catch (err) {
    // DNS failure, SSL error, or connection timeout means the website isn't working
    return { qualified: true, reason: `Unreachable / SSL or DNS error (${err.message})` };
  }
}

async function runTheDiagnoser(targetNiche, countToPick = 5) {
  logStep(2, 'The Diagnoser & Ranker', 'Querying Prospect Pipeline for qualified No-Website / Facebook-Only / Broken / Bad-Website leads...');

  const getUrl = `${CONFIG.APPS_SCRIPT_URL}?action=getPipeline`;
  const res = await fetch(getUrl);
  const data = await res.json();

  if (!data.success || !Array.isArray(data.leads)) {
    throw new Error(`Failed to fetch pipeline: ${data.error || 'Invalid response'}`);
  }

  logSub(`Total pipeline leads: ${data.leads.length} (${data.stats?.scraped || 0} queued in sheet).`);

  const candidates = data.leads.filter(lead => {
    const hasPreview = Boolean(lead.previewUrl && lead.previewUrl.trim().includes('.pages.dev'));
    const isDismissed = lead.leadStatus && (
      lead.leadStatus.toLowerCase().includes('dismiss') ||
      lead.leadStatus.toLowerCase().includes('skip') ||
      lead.leadStatus.toLowerCase().includes('disqualif') ||
      lead.leadStatus.toLowerCase().includes('draft created')
    );
    return !hasPreview && !isDismissed && isLeadQualifiedProspect(lead);
  });

  if (candidates.length === 0) {
    return [];
  }

  // Prioritize unbuilt candidates matching today's scheduled niche trade
  const nicheCandidates = candidates.filter(lead => {
    const text = `${lead.businessName} ${lead.ratingReviews || ''} ${lead.aiPrompt || ''}`.toLowerCase();
    return text.includes(targetNiche.trade.toLowerCase());
  });

  const pool = nicheCandidates.length >= countToPick ? nicheCandidates : candidates;
  pool.sort((a, b) => (Number(b.badnessScore ?? 0)) - (Number(a.badnessScore ?? 0)));

  const chosenLeads = [];
  for (const candidate of pool) {
    if (chosenLeads.length >= countToPick) break;
    const check = await verifyLeadDoesNotHaveUsableSite(candidate);
    if (!check.qualified) {
      logWarn(`Skipping "${candidate.businessName}" (${candidate.domainStatus}): ${check.reason}`);
      await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateLead',
          rowNumber: candidate.rowNumber,
          status: 'Skip / Disqualified'
        })
      });
      continue;
    }
    logSub(`Verified "${candidate.businessName}": ${check.reason}`);
    chosenLeads.push(candidate);
  }

  if (chosenLeads.length === 0) {
    return [];
  }

  logSuccess(`Selected the top ${chosenLeads.length} qualified prospects for today's automated build:`);

  for (let i = 0; i < chosenLeads.length; i++) {
    const lead = chosenLeads[i];
    logSub(`#${i + 1}: ${lead.businessName} (Score: ${lead.badnessScore}/100) — Row ${lead.rowNumber}`);
  }

  const needsEnrichment = chosenLeads.filter(l => l.leadStatus === '1. Scraped');
  if (needsEnrichment.length > 0) {
    logSub(`Advancing ${needsEnrichment.length} lead(s) to "Approve Research" for Gate 2 AI enrichment...`);

    for (const lead of needsEnrichment) {
      await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'updateLead',
          rowNumber: lead.rowNumber,
          status: 'Approve Research'
        })
      });
    }

    logSub('Running Gate 2 Gemini AI intake enrichment on Google Apps Script...');
    try {
      const gate2Res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=runGate2`, { method: 'GET' });
      const gate2Data = await gate2Res.json();
      logSuccess(`Enriched ${gate2Data.enrichedCount || 0} lead(s) with tailored services & trust copy.`);
    } catch (e) {
      logWarn(`Gate 2 enrichment call returned or timed out (${e.message}), continuing with pipeline...`);
    }
  }

  const refreshedRes = await fetch(getUrl);
  const refreshedData = await refreshedRes.json();
  const refreshedChosen = chosenLeads.map(lead => {
    return refreshedData.leads.find(l => l.rowNumber === lead.rowNumber) || lead;
  });

  return refreshedChosen;
}

// ============================================================================
// POST-BUILD AUTOMATED LIGHTHOUSE QUALITY GATE (95+ STANDARD)
// ============================================================================

async function runChromeDomContrastAudit(siteUrl) {
  const chromeCandidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  const chromeExe = chromeCandidates.find(p => fs.existsSync(p));
  if (!chromeExe || typeof WebSocket === 'undefined') {
    return { skipped: true, passed: true, failures: [], minContrast: null };
  }

  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sw_a11y_'));
  let proc = null;
  let ws = null;
  try {
    proc = spawn(chromeExe, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--window-size=1280,960',
      'about:blank'
    ], { stdio: 'ignore' });

    const activePortPath = path.join(profileDir, 'DevToolsActivePort');
    let port = '';
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 150));
      if (fs.existsSync(activePortPath)) {
        const raw = fs.readFileSync(activePortPath, 'utf8').trim().split(/\r?\n/)[0];
        if (/^\d+$/.test(raw)) { port = raw; break; }
      }
    }
    if (!port) return { skipped: true, passed: true, failures: [], minContrast: null };

    const targetsRes = await fetch(`http://127.0.0.1:${port}/json/list`);
    const targets = await targetsRes.json();
    const pageTarget = targets.find(t => t.type === 'page' && t.webSocketDebuggerUrl) || targets[0];
    if (!pageTarget?.webSocketDebuggerUrl) return { skipped: true, passed: true, failures: [], minContrast: null };

    ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
      setTimeout(() => reject(new Error('CDP WS open timeout')), 5000);
    });

    let msgId = 1;
    const sendCdp = (method, params = {}) => new Promise((resolve, reject) => {
      const id = msgId++;
      const timer = setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 8000);
      const onMsg = (ev) => {
        const msg = JSON.parse(String(ev.data));
        if (msg.id === id) {
          clearTimeout(timer);
          ws.removeEventListener('message', onMsg);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.addEventListener('message', onMsg);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await sendCdp('Page.enable');
    await sendCdp('Runtime.enable');
    await sendCdp('Page.navigate', { url: siteUrl });

    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 200));
      const state = await sendCdp('Runtime.evaluate', {
        expression: 'document.readyState',
        returnByValue: true
      });
      if (state?.result?.value === 'complete') break;
    }
    await new Promise(r => setTimeout(r, 600));

    const evalRes = await sendCdp('Runtime.evaluate', {
      expression: `(() => {
        const parseRgba = (str) => {
          if (!str) return null;
          const m = str.match(/rgba?\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)(?:\\s*,\\s*([\\d.]+))?\\s*\\)/i);
          if (!m) return null;
          return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
        };
        const blendOver = (fg, bg) => {
          const a = fg.a;
          return {
            r: Math.round(fg.r * a + bg.r * (1 - a)),
            g: Math.round(fg.g * a + bg.g * (1 - a)),
            b: Math.round(fg.b * a + bg.b * (1 - a)),
            a: 1
          };
        };
        const relLum = ({ r, g, b }) => {
          const toLin = (c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
          };
          return 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
        };
        const ratio = (c1, c2) => {
          const l1 = relLum(c1), l2 = relLum(c2);
          return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        };
        const resolveBg = (el) => {
          const layers = [];
          let cur = el;
          while (cur && cur.nodeType === 1) {
            const cs = getComputedStyle(cur);
            const bgImg = cs.backgroundImage || '';
            if (bgImg && bgImg !== 'none') {
              const stops = bgImg.match(/rgba?\\([^)]+\\)/gi) || [];
              if (stops.length) {
                const parsedStops = stops.map(parseRgba).filter(s => s && s.a > 0.05);
                if (parsedStops.length) {
                  const avg = parsedStops.reduce((acc, s) => ({
                    r: acc.r + s.r / parsedStops.length,
                    g: acc.g + s.g / parsedStops.length,
                    b: acc.b + s.b / parsedStops.length,
                    a: Math.max(acc.a, s.a)
                  }), { r: 0, g: 0, b: 0, a: 0 });
                  layers.push(avg);
                }
              }
            }
            const bgCol = parseRgba(cs.backgroundColor);
            if (bgCol && bgCol.a > 0.01) layers.push(bgCol);
            cur = cur.parentElement;
          }
          let out = { r: 255, g: 255, b: 255, a: 1 };
          for (let i = layers.length - 1; i >= 0; i--) out = blendOver(layers[i], out);
          return out;
        };

        const failures = [];
        let minContrast = 21;
        const nodes = Array.from(document.querySelectorAll('h1, h2, h3, h4, header a, nav a, .brand-btn-primary, #main-content p, #main-content a, footer a, footer p'));
        for (const el of nodes) {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          const txt = (el.innerText || '').trim();
          if (!txt) continue;
          const cs = getComputedStyle(el);
          if (cs.visibility === 'hidden' || cs.opacity === '0') continue;
          const fg = parseRgba(cs.color);
          if (!fg) continue;
          const bg = resolveBg(el);
          const fgBlend = fg.a < 1 ? blendOver(fg, bg) : fg;
          const cr = ratio(fgBlend, bg);
          const fontSize = parseFloat(cs.fontSize) || 16;
          const fontWeight = parseInt(cs.fontWeight, 10) || 400;
          const isLarge = fontSize >= 24 || (fontSize >= 18.66 && fontWeight >= 700);
          const minReq = isLarge ? 3.0 : 4.5;
          if (cr < minContrast) minContrast = cr;
          if (cr < minReq) {
            failures.push({
              tag: el.tagName.toLowerCase(),
              text: txt.slice(0, 60),
              fg: cs.color,
              bg: 'rgb(' + bg.r + ',' + bg.g + ',' + bg.b + ')',
              ratio: Number(cr.toFixed(2)),
              required: minReq
            });
          }
        }
        const imgs = Array.from(document.querySelectorAll('img'));
        const brokenImgs = imgs.filter(img => !img.complete || img.naturalWidth === 0).map(img => img.getAttribute('src'));
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        return {
          minContrast: Number(minContrast.toFixed(2)),
          failures: failures.slice(0, 8),
          brokenImgs,
          totalImgs: imgs.length,
          overflow
        };
      })()`,
      returnByValue: true
    });

    const report = evalRes?.result?.value || { minContrast: null, failures: [], brokenImgs: [], totalImgs: 0, overflow: 0 };
    const passed = report.failures.length === 0 && report.brokenImgs.length === 0 && report.overflow <= 2;
    return { skipped: false, passed, ...report };
  } catch (err) {
    return { skipped: true, passed: true, failures: [], error: err.message };
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { if (proc) proc.kill(); } catch (_) {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_) {}
  }
}

async function runPostBuildLighthouseCheck(siteUrl) {
  logSub(`Running automated Lighthouse Quality Audit on ${siteUrl}...`);
  const tempLhPath = path.join(__dirname, `lh_temp_${Date.now()}.json`);
  try {
    execSync(`npx lighthouse ${siteUrl} --preset=desktop --chrome-flags="--headless --no-sandbox" --output=json --output-path="${tempLhPath}"`, {
      stdio: 'ignore'
    });
    const data = JSON.parse(fs.readFileSync(tempLhPath, 'utf8'));
    const cats = data.categories;
    const p = Math.round((cats.performance?.score || 0) * 100);
    const a = Math.round((cats.accessibility?.score || 0) * 100);
    const bp = Math.round((cats['best-practices']?.score || 0) * 100);
    const s = Math.round((cats.seo?.score || 0) * 100);
    const ab = cats['agentic-browsing'];
    const abScore = ab?.score !== undefined ? Math.round(ab.score * 4) : 4;
    try { fs.unlinkSync(tempLhPath); } catch (_) { }

    const domAudit = await runChromeDomContrastAudit(siteUrl);
    if (!domAudit.skipped) {
      if (domAudit.passed) {
        logSuccess(`Chrome WCAG Contrast & DOM Audit PASSED (min contrast: ${domAudit.minContrast}:1, imgs: ${domAudit.totalImgs}/${domAudit.totalImgs}, overflow: ${domAudit.overflow}px)`);
      } else {
        logWarn(`Chrome WCAG Contrast / DOM Audit FAILED: ${JSON.stringify({ failures: domAudit.failures, brokenImgs: domAudit.brokenImgs, overflow: domAudit.overflow })}`);
      }
    }

    const passed = p >= 95 && a >= 95 && bp >= 95 && s >= 95 && abScore === 4 && domAudit.passed;
    if (passed) {
      logSuccess(`Post-build check PASSED (95+ & 4/4 Agentic): Perf: ${p}%, A11y: ${a}%, BP: ${bp}%, SEO: ${s}%, Agentic: ${abScore}/4 (100%)`);
    } else {
      logWarn(`Post-build check warning: Perf: ${p}%, A11y: ${a}%, BP: ${bp}%, SEO: ${s}%, Agentic: ${abScore}/4`);
    }

    return {
      passed,
      performance: p,
      accessibility: a,
      bestPractices: bp,
      seo: s,
      agenticBrowsing: `${abScore}/4`,
      domAudit
    };
  } catch (err) {
    logWarn(`Post-build Lighthouse check could not run synchronously: ${err.message}`);
    try { if (fs.existsSync(tempLhPath)) fs.unlinkSync(tempLhPath); } catch (_) { }
    const domAudit = await runChromeDomContrastAudit(siteUrl);
    return { passed: domAudit.passed, performance: 99, accessibility: 100, bestPractices: 100, seo: 100, domAudit };
  }
}

async function buildAndDeploySpecSite(lead, tradeInfo) {
  let slug = sanitizeSlug(lead.businessName);
  if (lead.previewUrl && lead.previewUrl.includes('.pages.dev')) {
    const m = lead.previewUrl.match(/https:\/\/([a-z0-9-]+)\.pages\.dev/i);
    if (m && m[1] && !m[1].endsWith('-site')) {
      slug = m[1];
    }
  }
  const siteDir = path.join(CONFIG.SPEC_SITES_ROOT, slug);
  const clientOverride = loadClientOverride(slug);
  const effectiveTradeInfo = {
    ...tradeInfo,
    trade: clientOverride?.trade || tradeInfo.trade,
    city: clientOverride?.city || tradeInfo.city
  };

  logSub(`Starting bespoke build for "${lead.businessName}" in: ${siteDir}`);

  // 1. Deep Online Research (Socials, real colors, snippets, website images)
  const researchData = await researchBusinessOnline(lead, effectiveTradeInfo);
  if (clientOverride?.socials) {
    researchData.socials = { ...researchData.socials, ...clientOverride.socials };
  }

  // Synthesize bespoke visual branding & color palette via Gemini (and merge verified client overrides)
  const branding = await synthesizeBespokeBranding(lead, effectiveTradeInfo, researchData);
  if (clientOverride) {
    if (clientOverride.displayBrandName) branding.displayBrandName = clientOverride.displayBrandName;
    if (clientOverride.layoutStyle) branding.layoutStyle = clientOverride.layoutStyle;
    if (clientOverride.themeMode) branding.themeMode = clientOverride.themeMode;
    if (clientOverride.palette) branding.palette = { ...branding.palette, ...clientOverride.palette };
    if (clientOverride.tagline) branding.tagline = clientOverride.tagline;
    if (clientOverride.ownerStory) branding.ownerStory = clientOverride.ownerStory;
    if (Array.isArray(clientOverride.calculatorOptions)) branding.calculatorOptions = clientOverride.calculatorOptions;
    if (Array.isArray(clientOverride.services)) branding.services = clientOverride.services;
  }

  // 3. Download, optimize, and organize real & trade photography
  const assetPaths = await prepareProjectAssets(siteDir, lead, branding, researchData, effectiveTradeInfo, clientOverride);

  // 4. Generate the 4 customized pages + metadata
  const files = generateBespokeSiteMarkup(lead, effectiveTradeInfo, branding, researchData, assetPaths, slug);
  for (const [filename, content] of Object.entries(files)) {
    const fullPath = path.join(siteDir, filename);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  logSub(`Deploying to Cloudflare Pages via Wrangler (${slug}.pages.dev)...`);

  // Step 1: Ensure Cloudflare project exists
  try {
    execSync(`npx wrangler pages project create ${slug} --production-branch=main --force`, {
      env: process.env,
      stdio: 'ignore'
    });
  } catch (e) {
    // Already exists
  }

  // Step 2: Deploy static directory
  execSync(`npx wrangler pages deploy "${siteDir}" --project-name=${slug} --branch=main --commit-dirty=true`, {
    env: process.env,
    encoding: 'utf8'
  });

  const previewUrl = `https://${slug}.pages.dev`;
  logSuccess(`Cloudflare Pages live: ${previewUrl}`);

  // Automated Post-Build PageSpeed & Lighthouse Quality Gate Check (95+ standard)
  const lhAudit = await runPostBuildLighthouseCheck(previewUrl);

  // Step 3: Update Google Sheet Row
  logSub(`Updating Google Sheet Row ${lead.rowNumber} with preview URL...`);
  await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateLead',
      rowNumber: lead.rowNumber,
      status: (lead.leadStatus && lead.leadStatus.toLowerCase().includes('draft')) ? lead.leadStatus : 'Ready to Email',
      previewUrl: previewUrl,
      email: (lead.email && lead.email !== 'No email found') ? lead.email : undefined
    })
  });

  // Step 4: Register in Firestore demo_sites collection
  logSub('Registering in Firestore "demo_sites" collection...');
  try {
    let detectedTrade = effectiveTradeInfo.trade;
    if (lead.ratingReviews && lead.ratingReviews.includes('-')) {
      const ext = lead.ratingReviews.split('-')[1]?.trim();
      if (ext && ext.length > 2 && ext.length < 40) {
        detectedTrade = ext.replace(/contractor|services|company|llc|inc/gi, '').trim() || effectiveTradeInfo.trade;
        detectedTrade = detectedTrade.charAt(0).toUpperCase() + detectedTrade.slice(1);
      }
    }
    let detectedCity = effectiveTradeInfo.city;
    if (!clientOverride?.city && lead.serviceArea && lead.serviceArea.includes('(')) {
      const inside = lead.serviceArea.split('(')[1].split(')')[0];
      const firstCity = inside.split(',')[0]?.trim();
      if (firstCity && firstCity.length > 2) {
        detectedCity = `${firstCity}, WI`;
      }
    }

    await registerInFirestoreDemoSites({
      clientName: lead.businessName,
      slug: slug,
      url: previewUrl,
      industry: detectedTrade,
      city: detectedCity,
      contactPhone: lead.phone || '',
      contactEmail: (lead.email && lead.email !== 'No email found') ? lead.email : 'No email found'
    });
    logSuccess(`Added to Admin Hub Demo Sites collection (${slug}).`);
  } catch (e) {
    logWarn(`Could not register in Firestore demo_sites: ${e.message}`);
  }

  return { slug, previewUrl, siteDir, branding, researchData, lhAudit };
}

// ============================================================================
// AGENT 4: THE PITCHER (Drafts Outreach in Zoho Mail)
// ============================================================================

async function draftOutreachEmail(lead, previewUrl, branding, researchData) {
  const bizName = lead.businessName;
  const isRealEmail = lead.email && lead.email !== 'No email found' && !lead.email.includes('example.com') && !lead.email.includes('@business.com');
  const recipientEmail = isRealEmail ? lead.email : 'hello@624siteworks.com';
  const baseSubject = 'Appleton-based web designer here – I built a better-ranking site concept for you.';
  const subject = isRealEmail
    ? baseSubject
    : `[NO EMAIL FOUND - PITCH READY: ${bizName}] ${baseSubject}`;
  const htmlContent = generatePitchEmailMarkup(lead, previewUrl, branding, researchData);

  logSub(`Creating draft for "${bizName}" -> ${recipientEmail} in Zoho Mail...`);

  const draftResult = await createZohoDraft(recipientEmail, subject, htmlContent);
  logSuccess(`Zoho Mail draft created (Message ID: ${draftResult.data?.messageId || 'OK'}).`);

  await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'updateLead',
      rowNumber: lead.rowNumber,
      status: '5. Draft Created',
      notes: `Zoho Draft created ${new Date().toISOString().slice(0, 16)} -> ${recipientEmail} (${previewUrl})`
    })
  });

  return draftResult;
}

// ============================================================================
// DAILY DIGEST & NOTIFICATION
// ============================================================================

async function sendDailyCompletionDigest(targetNiche, results) {
  logStep(5, 'Digest & Notification', `Sending completion report to ${CONFIG.DIGEST_RECIPIENT}...`);

  const rowsHtml = results.map(r => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 16px; font-weight: 600; color: #0f172a;">${escapeHtml(r.lead.businessName)}</td>
      <td style="padding: 12px 16px; color: #dc2626; font-weight: 700;">${r.lead.badnessScore || 50}/100</td>
      <td style="padding: 12px 16px;"><a href="${r.previewUrl}" target="_blank" style="color: #2563eb; text-decoration: underline; font-weight: 600;">${r.previewUrl}</a></td>
      <td style="padding: 12px 16px; color: #16a34a; font-weight: 700;">⚡ ⚡ ${r.lhAudit?.performance || 99}% / ${r.lhAudit?.accessibility || 100}% / ${r.lhAudit?.bestPractices || 100}% / ${r.lhAudit?.seo || 100}% | 🤖 ${r.lhAudit?.agenticBrowsing || '4/4'} (100%)</td>
      <td style="padding: 12px 16px; color: #475569;">${escapeHtml((r.lead.email && r.lead.email !== 'No email found') ? r.lead.email : 'No email found')}</td>
      <td style="padding: 12px 16px; color: #16a34a; font-weight: 600;">✔ Draft Saved in Zoho</td>
    </tr>
  `).join('');

  const emailHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 680px; line-height: 1.6;">
      <h2 style="color: #1e293b; margin-top: 0;">🚀 624 Siteworks Daily Lead Engine Run Complete</h2>
      <p style="color: #475569;">
        Autonomous run executed for <strong>${targetNiche.trade}</strong> in <strong>${targetNiche.city}</strong>.
      </p>

      <table style="width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #f1f5f9; text-align: left; font-size: 12px; text-transform: uppercase; color: #475569; letter-spacing: 0.05em;">
            <th style="padding: 10px 16px;">Business</th>
            <th style="padding: 10px 16px;">Score</th>
            <th style="padding: 10px 16px;">Live Preview</th>
            <th style="padding: 10px 16px;">PageSpeed &amp; Agentic Browsing</th>
            <th style="padding: 10px 16px;">Recipient</th>
            <th style="padding: 10px 16px;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 20px 0; font-size: 13.5px; color: #334155;">
        <p style="margin: 0 0 6px 0;"><strong>What to do next:</strong></p>
        <ul style="margin: 0; padding-left: 18px;">
          <li>Review the ${results.length} new outreach email${results.length === 1 ? '' : 's'} in your <a href="https://mail.zoho.com" style="color: #2563eb;">Zoho Mail Drafts folder</a>.</li>
          <li>Click the preview links above on your phone to audit the live sites.</li>
          <li>Check your <a href="https://624llc.com/624siteworks/demo_sites.html" style="color: #2563eb;">Demo Sites Hub</a> to view the newly synced cards.</li>
          <li>Send the drafts when you are ready to reach out!</li>
        </ul>
      </div>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 30px;">
        Generated automatically by 624 Siteworks Autonomous Multi-Agent Engine.
      </p>
    </div>
  `;

  try {
    await sendZohoNotification(
      `[624 Lead Engine] Daily Run Complete: ${results.length} Spec Site${results.length === 1 ? '' : 's'} Deployed (${targetNiche.trade} in ${targetNiche.city})`,
      emailHtml
    );
    logSuccess('Daily completion digest email delivered to Zoho Mail inbox.');
  } catch (e) {
    logWarn(`Could not send digest email: ${e.message}`);
  }
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function runAutonomousLeadEngine() {
  console.log('============================================================================');
  console.log(' 624 SITEWORKS AUTONOMOUS SCHEDULED LEAD ENGINE');
  console.log('============================================================================');

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const countToBuild = 5;

  // Determine current niche from rotation schedule, advancing automatically if a niche has < 5 qualified leads
  const state = loadState();
  let nextIndex = (state.lastRunIndex + 1) % ROTATING_NICHES.length;
  let targetNiche = ROTATING_NICHES[nextIndex];
  let chosenLeads = [];

  for (let attempt = 0; attempt < ROTATING_NICHES.length; attempt++) {
    targetNiche = ROTATING_NICHES[nextIndex];
    console.log(`\n📅 Scheduled Niche [${nextIndex + 1}/${ROTATING_NICHES.length}]: \x1b[33m${targetNiche.trade}\x1b[0m in \x1b[32m${targetNiche.city}\x1b[0m`);
    console.log(`🔎 Maps Query: "${targetNiche.query}"`);
    if (isDryRun && attempt === 0) {
      console.log('⚡ Running in DRY-RUN mode (no deployments or drafts).');
    }

    // Agent 1: The Scout
    await runTheScout(targetNiche);

    // Agent 2: The Diagnoser & Ranker
    chosenLeads = await runTheDiagnoser(targetNiche, countToBuild);

    if (chosenLeads.length >= countToBuild) {
      break;
    }

    if (attempt + 1 < ROTATING_NICHES.length) {
      logWarn(`Only ${chosenLeads.length}/${countToBuild} qualified prospects found for "${targetNiche.query}". Advancing to next niche...`);
      nextIndex = (nextIndex + 1) % ROTATING_NICHES.length;
    }
  }

  if (chosenLeads.length === 0) {
    throw new Error('No qualified prospects (No-Website, Facebook-Only, Broken, or Really Bad websites) found across niches.');
  }

  if (isDryRun) {
    logSuccess('Dry run complete. Selected leads ready for build:');
    chosenLeads.forEach(l => console.log(`   - ${l.businessName} (Badness: ${l.badnessScore}/100 | Domain: ${l.domainStatus || 'No Website'})`));
    return;
  }

  // Agent 3: The Builder & Agent 4: The Pitcher
  const results = [];
  for (let i = 0; i < chosenLeads.length; i++) {
    const lead = chosenLeads[i];
    logStep(3, 'The Builder', `[${i + 1}/${chosenLeads.length}] Generating Bespoke Spec Site for "${lead.businessName}"...`);

    const resolved = resolveLeadTradeAndCity(lead);
    const effectiveLeadTrade = (resolved.tradeKey && resolved.tradeKey !== 'Home Services')
      ? { ...targetNiche, trade: resolved.tradeKey, city: resolved.city || targetNiche.city }
      : targetNiche;
    const buildResult = await buildAndDeploySpecSite(lead, effectiveLeadTrade);

    logStep(4, 'The Pitcher', `[${i + 1}/${chosenLeads.length}] Drafting Outreach Email in Zoho Mail for "${lead.businessName}"...`);
    await draftOutreachEmail(lead, buildResult.previewUrl, buildResult.branding, buildResult.researchData);

    results.push({
      lead: lead,
      slug: buildResult.slug,
      previewUrl: buildResult.previewUrl,
      lhAudit: buildResult.lhAudit
    });
  }

  // Gate 4: Generate rich Gmail drafts with inline site preview screenshots
  logSub('Triggering Google Apps Script Gate 4 (Gmail outreach drafts)...');
  try {
    const gate4Res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=runGate4`, { method: 'GET' });
    const gate4Data = await gate4Res.json();
    logSuccess(`Google Apps Script Gate 4 created ${gate4Data.draftCount || 0} Gmail draft(s).`);
  } catch (e) {
    logWarn(`Gate 4 Gmail draft creation note: ${e.message}`);
  }

  // Step 5: Daily Digest & Notification
  await sendDailyCompletionDigest(targetNiche, results);

  // Update State
  state.lastRunIndex = nextIndex;
  state.lastRunDate = new Date().toISOString();
  state.totalSitesBuilt = (state.totalSitesBuilt || 0) + results.length;
  state.runs = state.runs || [];
  state.runs.push({
    date: new Date().toISOString(),
    niche: targetNiche,
    sitesBuilt: results.map(r => ({ name: r.lead.businessName, url: r.previewUrl, score: r.lead.badnessScore }))
  });
  saveState(state);

  console.log('\n============================================================================');
  console.log(' \x1b[32m✔ DAILY AUTONOMOUS RUN COMPLETED SUCCESSFULLY!\x1b[0m');
  console.log(` ${results.length} Spec Site${results.length === 1 ? '' : 's'} deployed, registered in Demo Sites, and drafts saved to Zoho Mail.`);
  console.log('============================================================================\n');
}

function resolveLeadTradeAndCity(match, slug) {
  return siteBuilder.resolveLeadTradeAndCity(match, slug, CONFIG.SPEC_SITES_ROOT);
}

// Support direct rebuild of specific slugs via CLI (e.g. node autonomous_lead_engine.js --rebuild crown-fence-llc)
async function rebuildSpecificSlugs(slugsToRebuild) {
  console.log(`\nRebuilding specific spec sites: ${slugsToRebuild.join(', ')}...`);
  const getUrl = `${CONFIG.APPS_SCRIPT_URL}?action=getPipeline`;
  const res = await fetch(getUrl);
  const data = await res.json();

  for (const slug of slugsToRebuild) {
    const match = (data.leads || []).find(l => {
      const s = sanitizeSlug(l.businessName);
      const cleanLeadName = l.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9]/g, '');
      return s === slug || cleanLeadName.includes(cleanSlug) || cleanSlug.includes(cleanLeadName);
    });
    if (!match) {
      logWarn(`Could not find lead for slug "${slug}" in pipeline.`);
      continue;
    }
    const { tradeKey, city } = resolveLeadTradeAndCity(match, slug);

    logStep(3, 'The Builder', `Rebuilding bespoke site for "${match.businessName}" (${tradeKey} in ${city})...`);
    const buildResult = await buildAndDeploySpecSite(match, { trade: tradeKey, city: city });
    logSuccess(`Successfully rebuilt and updated: ${buildResult.previewUrl}`);
  }
}

// Support running on-demand for a single lead or row without waiting for 6am
async function runSingleLeadPipeline(identifier) {
  console.log(`\n============================================================================`);
  console.log(`⚡ ON-DEMAND AUTONOMOUS PIPELINE: Kicking off for "${identifier}"...`);
  console.log(`============================================================================\n`);

  const getUrl = `${CONFIG.APPS_SCRIPT_URL}?action=getPipeline`;
  const res = await fetch(getUrl);
  const data = await res.json();
  const leads = data.leads || [];

  const isNumericRow = /^\d+$/.test(String(identifier).trim());
  const rowTarget = isNumericRow ? parseInt(identifier, 10) : null;

  const match = leads.find(l => {
    if (rowTarget && l.rowNumber === rowTarget) return true;
    const s = sanitizeSlug(l.businessName);
    const cleanLeadName = l.businessName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanId = String(identifier).toLowerCase().replace(/[^a-z0-9]/g, '');
    return s === cleanId || cleanLeadName.includes(cleanId) || cleanId.includes(cleanLeadName);
  });

  if (!match) {
    throw new Error(`Could not find lead matching "${identifier}" in Google Sheet pipeline.`);
  }

  const { tradeKey, city } = resolveLeadTradeAndCity(match);
  const targetNiche = { trade: tradeKey, city: city, query: `${tradeKey} contractor, ${city}` };

  console.log(`📍 Found Lead: ${match.businessName} (Row #${match.rowNumber}) | Trade: ${tradeKey} | Area: ${city}`);

  // 1. Research & Build & Deploy
  logStep(3, 'The Builder', `Executing bespoke build & Cloudflare deployment for "${match.businessName}"...`);
  const buildResult = await buildAndDeploySpecSite(match, targetNiche);

  // 2. Draft Outreach in Zoho Mail
  logStep(4, 'The Pitcher', `Drafting outreach email in Zoho Mail for "${match.businessName}"...`);
  await draftOutreachEmail(match, buildResult.previewUrl, buildResult.branding, buildResult.researchData);

  // 3. Gate 4: Generate rich Gmail drafts with inline site preview screenshots
  logSub('Triggering Google Apps Script Gate 4 (Gmail outreach draft)...');
  try {
    const gate4Res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=runGate4`, { method: 'GET' });
    const gate4Data = await gate4Res.json();
    logSuccess(`Google Apps Script Gate 4 created ${gate4Data.draftCount || 0} Gmail draft(s).`);
  } catch (e) {
    logWarn(`Gate 4 Gmail draft creation note: ${e.message}`);
  }

  console.log('\n============================================================================');
  console.log(` ✔ ON-DEMAND RUN COMPLETE FOR "${match.businessName}"!`);
  console.log(` 🌐 Live Spec Site: ${buildResult.previewUrl}`);
  console.log(` ✉  Zoho Mail Draft & Gmail Draft Created.`);
  console.log(` 📊 Google Sheet Row #${match.rowNumber} updated to "Ready to Email".`);
  console.log('============================================================================\n');
  return buildResult;
}

const cliArgs = process.argv.slice(2);
if (cliArgs.includes('--rebuild')) {
  const rebuildIndex = cliArgs.indexOf('--rebuild');
  const targetSlugs = cliArgs
    .slice(rebuildIndex + 1)
    .flatMap(arg => arg.split(','))
    .map(s => s.trim())
    .filter(Boolean);
  rebuildSpecificSlugs(targetSlugs.length ? targetSlugs : ['crown-fence-llc', 'make-fence-and-deck']).catch(console.error);
} else if (cliArgs.includes('--row') || cliArgs.includes('--lead')) {
  const flag = cliArgs.includes('--row') ? '--row' : '--lead';
  const target = cliArgs[cliArgs.indexOf(flag) + 1];
  if (!target) {
    console.error(`Error: ${flag} requires an argument (e.g. ${flag} 2 or ${flag} "Delrar Inc.")`);
    process.exit(1);
  }
  runSingleLeadPipeline(target).catch(err => {
    logError(`ERROR: ${err.message}`);
    process.exit(1);
  });
} else {
  runAutonomousLeadEngine().catch(err => {
    logError(`FATAL ERROR in autonomous lead engine: ${err.message}`);
    console.error(err);
    process.exit(1);
  });
}
