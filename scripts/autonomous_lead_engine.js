/**
 * ============================================================================
 * 624 Siteworks Autonomous Scheduled Lead Engine Orchestrator
 * ============================================================================
 * 
 * Multi-Agent Autonomous Pipeline:
 *  1. The Scout: Scrapes and audits local trade leads via Google Apps Script (Serper/Maps).
 *  2. The Diagnoser & Ranker: Identifies the worst 2 websites, enriches with Gemini AI,
 *     and leaves the rest as an on-demand queue in Google Sheets.
 *  3. The Builder: Generates responsive 4-page Tailwind sites, deploys to Cloudflare Pages,
 *     updates Google Sheet Col T, and registers directly into Firestore demo_sites collection.
 *  4. The Pitcher: Creates tailored outreach emails saved directly into Zoho Mail Drafts.
 *  5. Daily Digest: Delivers completion summary to jason@624films.com.
 * 
 * Schedule: Runs weekdays at 6:00 AM Central (CRON_TZ=America/Chicago 0 6 * * 1-5).
 * ============================================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CONFIGURATION & CREDENTIALS
// ============================================================================

// Load environment variables from .env if present
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  process.loadEnvFile(envPath);
}

const CONFIG = {
  // Google Apps Script Web App
  APPS_SCRIPT_URL: process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxUqD4J70nf46i9_HgJA4GTx7XxuUhJzY-AYLz0tRi5OgyyIxexiHT3Tk035LIs-g2-ug/exec',
  
  // Google Gemini API (AI Studio)
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GEMINI_MODEL: 'gemini-3.5-flash',
  GEMINI_FALLBACK_MODEL: 'gemini-3.5-flash-lite',

  // Cloudflare Pages
  CLOUDFLARE_ACCOUNT_ID: process.env.CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN: process.env.CLOUDFLARE_API_TOKEN,

  // Zoho Mail OAuth
  ZOHO_CLIENT_ID: process.env.ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET: process.env.ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN: process.env.ZOHO_REFRESH_TOKEN,
  ZOHO_ACCOUNT_ID: process.env.ZOHO_ACCOUNT_ID || '1780626000000008002',
  ZOHO_FROM_ADDRESS: process.env.ZOHO_FROM_ADDRESS || 'jason@624films.com',
  DIGEST_RECIPIENT: process.env.DIGEST_RECIPIENT || 'jason@624films.com',

  // Firebase Firestore REST API (Admin Hub Demo Sites)
  FIRESTORE_PROJECT_ID: process.env.FIRESTORE_PROJECT_ID || 'admin-hub-cc0a2',
  FIRESTORE_API_KEY: process.env.FIRESTORE_API_KEY,

  // File Paths
  SPEC_SITES_ROOT: 'F:\\624 SITEWORKS\\Client Sites',
  PREVIEW_BANNER_SRC: 'F:\\624 SITEWORKS\\Client Sites\\delrar-inc\\assets\\preview-banner.js',
  CONTACT_API_SRC: 'F:\\624 SITEWORKS\\My Sites\\624siteworks.com\\functions\\api\\contact.js',
  STATE_FILE: path.join(__dirname, 'lead_engine_state.json'),

  // Claim URL
  CLAIM_BASE_URL: 'https://624siteworks.com/claim.html'
};

// 10 Rotating High-Ticket Home Service Contractor Trades (Fox Valley & NE Wisconsin)
// Explicitly avoids high-maintenance clients (food menus, online retail products, hair/nail salons)
const ROTATING_NICHES = [
  { trade: 'Concrete', city: 'Appleton, WI', query: 'Concrete contractor, Appleton, WI' },
  { trade: 'Roofing', city: 'Neenah, WI', query: 'Roofing contractor, Neenah, WI' },
  { trade: 'Fencing', city: 'Oshkosh, WI', query: 'Fence contractor, Oshkosh, WI' },
  { trade: 'HVAC', city: 'Kaukauna, WI', query: 'HVAC contractor, Kaukauna, WI' },
  { trade: 'Plumbing', city: 'Menasha, WI', query: 'Plumbing contractor, Menasha, WI' },
  { trade: 'Tree Service', city: 'Green Bay, WI', query: 'Tree service and removal, Green Bay, WI' },
  { trade: 'Landscaping', city: 'Kimberly, WI', query: 'Landscaping contractor, Kimberly, WI' },
  { trade: 'Electricians', city: 'Little Chute, WI', query: 'Electrician contractor, Little Chute, WI' },
  { trade: 'Asphalt Paving', city: 'Appleton, WI', query: 'Asphalt paving contractor, Appleton, WI' },
  { trade: 'Foundation Repair', city: 'Oshkosh, WI', query: 'Foundation repair contractor, Oshkosh, WI' }
];

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

function sanitizeSlug(name) {
  let slug = (name || 'spec-preview')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (slug.length > 50) {
    slug = slug.substring(0, 50).replace(/-+$/, '');
  }
  return slug || 'spec-preview';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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

/**
 * Creates an outreach draft in Zoho Mail drafts folder without sending.
 */
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
      toAddress: toAddress || 'hello@624films.com',
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

/**
 * Sends notification email to user (Daily Digest).
 */
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
// GEMINI API CLIENT (AI Copy & Content Generation)
// ============================================================================

async function callGemini(promptText, model = CONFIG.GEMINI_MODEL) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 8192
        }
      })
    });

    if (!res.ok) {
      if (model !== CONFIG.GEMINI_FALLBACK_MODEL) {
        logWarn(`Gemini model ${model} returned ${res.status}. Trying fallback ${CONFIG.GEMINI_FALLBACK_MODEL}...`);
        return await callGemini(promptText, CONFIG.GEMINI_FALLBACK_MODEL);
      }
      const err = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    if (model !== CONFIG.GEMINI_FALLBACK_MODEL) {
      logWarn(`Gemini call failed with ${model}: ${err.message}. Retrying with fallback...`);
      return await callGemini(promptText, CONFIG.GEMINI_FALLBACK_MODEL);
    }
    throw err;
  }
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

  logSuccess(`Scraped & audited ${result.insertedCount || 0} leads from ${result.provider || 'Google Maps'}.`);
  logSub(`Website crawler discovered ${result.crawledEmailCount || 0} direct email address(es).`);
  return result;
}

// ============================================================================
// AGENT 2: THE DIAGNOSER & RANKER
// ============================================================================

async function runTheDiagnoser(targetNiche, countToPick = 2) {
  logStep(2, 'The Diagnoser & Ranker', 'Querying Prospect Pipeline to rank worst-scoring leads...');

  const getUrl = `${CONFIG.APPS_SCRIPT_URL}?action=getPipeline`;
  const res = await fetch(getUrl);
  const data = await res.json();

  if (!data.success || !Array.isArray(data.leads)) {
    throw new Error(`Failed to fetch pipeline: ${data.error || 'Invalid response'}`);
  }

  logSub(`Total pipeline leads: ${data.leads.length} (${data.stats?.scraped || 0} queued in sheet).`);

  // Filter for actionable leads that do not yet have a deployed spec site
  const candidates = data.leads.filter(lead => {
    const hasPreview = Boolean(lead.previewUrl && lead.previewUrl.trim().includes('.pages.dev'));
    const isDismissed = lead.leadStatus && (
      lead.leadStatus.toLowerCase().includes('dismiss') ||
      lead.leadStatus.toLowerCase().includes('skip') ||
      lead.leadStatus.toLowerCase().includes('disqualif') ||
      lead.leadStatus.toLowerCase().includes('draft created')
    );
    return !hasPreview && !isDismissed;
  });

  if (candidates.length === 0) {
    throw new Error('No unbuilt leads found in the pipeline for today. Check your Google Sheet!');
  }

  // Sort descending by Badness score (100 -> 90 -> 80)
  candidates.sort((a, b) => (b.badnessScore || 50) - (a.badnessScore || 50));

  // Pick the top 2 worst prospects for the day
  const chosenLeads = candidates.slice(0, countToPick);
  logSuccess(`Selected the top ${chosenLeads.length} worst prospects for today's automated build:`);

  for (let i = 0; i < chosenLeads.length; i++) {
    const lead = chosenLeads[i];
    logSub(`#${i + 1}: ${lead.businessName} (Score: ${lead.badnessScore}/100) — Row ${lead.rowNumber}`);
  }

  // If any of the chosen leads need AI enrichment, trigger Gate 2
  const needsEnrichment = chosenLeads.filter(l => l.leadStatus === '1. Scraped');
  if (needsEnrichment.length > 0) {
    logSub(`Advancing ${needsEnrichment.length} lead(s) to "Approve Research" for Gate 2 AI enrichment...`);
    
    for (const lead of needsEnrichment) {
      await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rowNumber: lead.rowNumber,
          status: 'Approve Research'
        })
      });
    }

    logSub('Running Gate 2 Gemini AI intake enrichment on Google Apps Script...');
    const gate2Res = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=runGate2`, { method: 'POST' });
    const gate2Data = await gate2Res.json();
    logSuccess(`Enriched ${gate2Data.enrichedCount || 0} lead(s) with tailored services & trust copy.`);
  }

  // Re-fetch pipeline to obtain refreshed prompts and row values
  const refreshedRes = await fetch(getUrl);
  const refreshedData = await refreshedRes.json();
  const refreshedChosen = chosenLeads.map(lead => {
    return refreshedData.leads.find(l => l.rowNumber === lead.rowNumber) || lead;
  });

  return refreshedChosen;
}

// ============================================================================
// AGENT 3: THE BUILDER (Generates 4-Page Site & Deploys to Cloudflare Pages)
// ============================================================================

function generateSiteMarkup(lead, tradeInfo) {
  const bizName = lead.businessName;
  const phone = lead.phone || '(920) 555-0624';
  const cleanPhone = phone.replace(/[^\d+]/g, '');
  const email = lead.email || `info@${sanitizeSlug(bizName)}.com`;

  // Detect actual trade from lead's Google rating badge (e.g. "4.8 ★ (12 reviews) - Fence contractor")
  let trade = tradeInfo.trade;
  if (lead.ratingReviews && lead.ratingReviews.includes('-')) {
    const extracted = lead.ratingReviews.split('-')[1]?.trim();
    if (extracted && extracted.length > 2 && extracted.length < 40) {
      trade = extracted.replace(/contractor|services|company|llc|inc/gi, '').trim() || tradeInfo.trade;
      // Capitalize
      trade = trade.charAt(0).toUpperCase() + trade.slice(1);
    }
  }

  // Detect city from service area or default to target city
  let city = tradeInfo.city;
  if (lead.serviceArea && lead.serviceArea.includes('(')) {
    const inside = lead.serviceArea.split('(')[1].split(')')[0];
    const firstCity = inside.split(',')[0]?.trim();
    if (firstCity && firstCity.length > 2) {
      city = `${firstCity}, WI`;
    }
  }

  const serviceArea = lead.serviceArea || `${city} and the Fox Valley area`;
  const trustFactor = lead.trustFactor || `Top-Rated ${trade} Specialists in ${city}`;

  const services = (lead.services && lead.services.length >= 3) ? lead.services : [
    { name: `Residential ${trade} Services`, desc: `High-quality, durable ${trade.toLowerCase()} solutions tailored for homeowners across ${city} and Northeast Wisconsin.` },
    { name: `Commercial & Industrial Solutions`, desc: `Built to withstand Wisconsin weather with premium materials, engineered durability, and fast turnaround.` },
    { name: `Repairs, Restorations & Free Quotes`, desc: `Transparent upfront pricing, prompt on-site consultations, and responsive customer service.` }
  ];

  // Primary brand palette based on trade
  const palette = {
    'Concrete': { primary: '#2563eb', secondary: '#1e293b', accent: '#f59e0b', light: '#f8fafc' },
    'Roofing': { primary: '#0284c7', secondary: '#0f172a', accent: '#f97316', light: '#f8fafc' },
    'Fencing': { primary: '#16a34a', secondary: '#1e293b', accent: '#ca8a04', light: '#f8fafc' },
    'HVAC': { primary: '#0ea5e9', secondary: '#1e293b', accent: '#ef4444', light: '#f8fafc' },
    'Plumbing': { primary: '#2563eb', secondary: '#0f172a', accent: '#3b82f6', light: '#f8fafc' },
    'Tree Service': { primary: '#15803d', secondary: '#1c1917', accent: '#eab308', light: '#f8fafc' },
    'Landscaping': { primary: '#16a34a', secondary: '#1e293b', accent: '#84cc16', light: '#f8fafc' },
    'Electricians': { primary: '#4f46e5', secondary: '#18181b', accent: '#eab308', light: '#f8fafc' },
    'Asphalt Paving': { primary: '#334155', secondary: '#09090b', accent: '#f59e0b', light: '#f8fafc' },
    'Foundation Repair': { primary: '#475569', secondary: '#0f172a', accent: '#3b82f6', light: '#f8fafc' }
  }[trade] || { primary: '#2563eb', secondary: '#0f172a', accent: '#f59e0b', light: '#f8fafc' };

  // Common navigation header
  const headerHtml = `
    <header class="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 text-white">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-xl text-white shadow-lg">
            ${bizName.charAt(0)}
          </div>
          <div>
            <span class="font-extrabold text-lg sm:text-xl tracking-tight block text-white">${escapeHtml(bizName)}</span>
            <span class="text-xs text-blue-400 font-medium tracking-wide uppercase block">${trade} Specialists • ${city}</span>
          </div>
        </a>
        <nav class="hidden md:flex items-center gap-8 font-medium text-sm text-slate-300">
          <a href="index.html" class="hover:text-blue-400 transition-colors">Home</a>
          <a href="services.html" class="hover:text-blue-400 transition-colors">Services</a>
          <a href="about.html" class="hover:text-blue-400 transition-colors">About</a>
          <a href="contact.html" class="hover:text-blue-400 transition-colors">Contact</a>
        </nav>
        <div class="flex items-center gap-3">
          <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg font-semibold text-sm shadow-md transition-all">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
            <span>${escapeHtml(phone)}</span>
          </a>
        </div>
      </div>
    </header>
  `;

  // Common footer
  const footerHtml = `
    <footer class="bg-slate-950 text-slate-400 border-t border-slate-800 py-12">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div class="md:col-span-2">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white">
              ${bizName.charAt(0)}
            </div>
            <span class="font-bold text-white text-lg">${escapeHtml(bizName)}</span>
          </div>
          <p class="text-sm text-slate-400 max-w-md mb-4">
            Dedicated ${trade.toLowerCase()} contractor providing reliable craftsmanship, licensed professionals, and long-lasting results throughout ${serviceArea}.
          </p>
          <p class="text-xs text-slate-500">
            &copy; ${new Date().getFullYear()} ${escapeHtml(bizName)}. All rights reserved. Locally operated in Northeast Wisconsin.
          </p>
        </div>
        <div>
          <h4 class="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Quick Links</h4>
          <ul class="space-y-2 text-sm">
            <li><a href="index.html" class="hover:text-white transition-colors">Home</a></li>
            <li><a href="services.html" class="hover:text-white transition-colors">Our Services</a></li>
            <li><a href="about.html" class="hover:text-white transition-colors">About Us</a></li>
            <li><a href="contact.html" class="hover:text-white transition-colors">Free Estimate</a></li>
          </ul>
        </div>
        <div>
          <h4 class="text-white font-semibold text-sm mb-3 uppercase tracking-wider">Contact &amp; Hours</h4>
          <p class="text-sm mb-1 text-slate-300 font-semibold">${escapeHtml(phone)}</p>
          <p class="text-sm mb-3 text-slate-400">${escapeHtml(email)}</p>
          <p class="text-xs text-slate-500 leading-relaxed">${escapeHtml(lead.hours || 'Monday - Friday: 7:00 AM - 5:00 PM | Sat-Sun: By Appointment')}</p>
        </div>
      </div>
    </footer>
    <script src="assets/preview-banner.js" data-business="${escapeHtml(bizName)}" defer></script>
  `;

  // JSON-LD Schema
  const schemaJson = JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["HomeAndConstructionBusiness", "LocalBusiness"],
        "@id": `https://${sanitizeSlug(bizName)}.pages.dev/#business`,
        "name": bizName,
        "telephone": phone,
        "email": email,
        "url": `https://${sanitizeSlug(bizName)}.pages.dev/`,
        "areaServed": [
          { "@type": "City", "name": "Appleton" },
          { "@type": "City", "name": "Neenah" },
          { "@type": "City", "name": "Menasha" },
          { "@type": "City", "name": "Kaukauna" }
        ],
        "openingHours": lead.hours || "Mo-Fr 07:00-17:00"
      }
    ]
  });

  // Page 1: index.html
  const indexHtml = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(bizName)} | Top-Rated ${trade} Contractor in ${city}</title>
  <meta name="description" content="${escapeHtml(bizName)} delivers premium ${trade.toLowerCase()} services in ${city} and Northeast Wisconsin. Call ${phone} today for a fast, free estimate.">
  <link rel="canonical" href="https://${sanitizeSlug(bizName)}.pages.dev/">
  <meta name="geo.region" content="US-WI">
  <meta name="geo.placename" content="${city}">
  <script src="https://cdn.tailwindcss.com"></script>
  <script type="application/ld+json">${schemaJson}</script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans antialiased selection:bg-blue-600 selection:text-white">
  ${headerHtml}

  <!-- Hero Section -->
  <section class="relative bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 py-20 lg:py-28 overflow-hidden">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
      <div class="max-w-3xl">
        <div class="inline-flex items-center gap-2 bg-blue-950/80 border border-blue-500/30 text-blue-400 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase mb-6">
          <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
          ${escapeHtml(trustFactor)}
        </div>
        <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-tight mb-6">
          Reliable ${trade} Craftsmanship in <span class="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-300">${city}</span>
        </h1>
        <p class="text-lg sm:text-xl text-slate-300 leading-relaxed mb-8">
          Serving homeowners and commercial clients across ${serviceArea} with upfront pricing, premium materials, and verified local expertise.
        </p>
        <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <a href="tel:${cleanPhone}" class="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-blue-600/30 transition-all text-base">
            Call ${escapeHtml(phone)}
          </a>
          <a href="#estimate-form" class="inline-flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold px-8 py-4 rounded-xl transition-all text-base">
            Request Free Estimate &darr;
          </a>
        </div>
      </div>
    </div>
  </section>

  <!-- Core Services Section -->
  <section class="py-20 bg-slate-950">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="text-center max-w-2xl mx-auto mb-16">
        <h2 class="text-xs font-bold tracking-widest text-blue-500 uppercase mb-2">Our Specialties</h2>
        <p class="text-3xl font-extrabold text-white">Expert ${trade} Solutions</p>
        <p class="text-slate-400 mt-2">Tailored for Northeast Wisconsin weather and long-term durability.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        ${services.map((s, idx) => `
          <div class="bg-slate-900 border border-slate-800 rounded-2xl p-8 hover:border-blue-500/50 transition-all group">
            <div class="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-lg mb-6 group-hover:bg-blue-600 group-hover:text-white transition-all">
              0${idx + 1}
            </div>
            <h3 class="text-xl font-bold text-white mb-3">${escapeHtml(s.name)}</h3>
            <p class="text-slate-400 text-sm leading-relaxed mb-6">${escapeHtml(s.desc)}</p>
            <a href="services.html" class="text-blue-400 font-semibold text-sm inline-flex items-center gap-1 group-hover:gap-2 transition-all">Learn more &rarr;</a>
          </div>
        `).join('')}
      </div>
    </div>
  </section>

  <!-- AI Direct Answer Summary (AEO / Voice Search) -->
  <section id="ai-summary" class="py-12 bg-slate-900/60 border-y border-slate-800">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-slate-800/60 border border-slate-700 rounded-2xl p-6 sm:p-8">
        <p class="text-xs font-bold uppercase tracking-wider text-blue-400 mb-2">Summary for Homeowners</p>
        <p class="text-slate-200 text-base leading-relaxed">
          <strong>${escapeHtml(bizName)}</strong> is an established ${trade.toLowerCase()} contractor based in ${city}, providing professional ${services.map(s => s.name).join(', ')} across ${serviceArea}. Call <a href="tel:${cleanPhone}" class="text-blue-400 font-bold">${escapeHtml(phone)}</a> for free on-site consultations and reliable scheduling.
        </p>
      </div>
    </div>
  </section>

  <!-- Interactive Estimate Form Section -->
  <section id="estimate-form" class="py-20 bg-slate-950">
    <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl">
        <div class="text-center mb-8">
          <h2 class="text-2xl sm:text-3xl font-extrabold text-white">Request a Fast, Free Estimate</h2>
          <p class="text-slate-400 text-sm mt-2">Fill out the quick form below or call directly at ${escapeHtml(phone)}.</p>
        </div>
        <form id="contactForm" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="name" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Your Name</label>
              <input type="text" id="name" name="name" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm">
            </div>
            <div>
              <label for="phone" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Phone Number</label>
              <input type="tel" id="phone" name="phone" required class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm">
            </div>
          </div>
          <div>
            <label for="service" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Service Needed</label>
            <select id="service" name="service" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm">
              ${services.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')}
              <option value="General Inquiry">Other Inquiry</option>
            </select>
          </div>
          <div>
            <label for="message" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Project Details &amp; Location</label>
            <textarea id="message" name="message" rows="3" placeholder="Tell us about your project..." class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 text-sm"></textarea>
          </div>
          <button type="submit" id="submitBtn" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all text-base">
            Submit Free Estimate Request &rarr;
          </button>
          <div id="formStatus" class="hidden text-center text-sm font-medium py-2"></div>
        </form>
      </div>
    </div>
  </section>

  ${footerHtml}

  <script>
    document.getElementById('contactForm')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('submitBtn');
      const status = document.getElementById('formStatus');
      btn.disabled = true;
      btn.innerText = 'Sending Request...';
      
      const payload = {
        name: document.getElementById('name').value,
        phone: document.getElementById('phone').value,
        service: document.getElementById('service').value,
        message: document.getElementById('message').value,
        businessName: "${escapeHtml(bizName)}"
      };

      try {
        const res = await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        status.className = 'text-center text-sm font-medium py-2 text-green-400 block';
        status.innerText = '✔ Thank you! Your estimate request has been sent successfully.';
        btn.innerText = 'Request Sent!';
      } catch (err) {
        status.className = 'text-center text-sm font-medium py-2 text-amber-400 block';
        status.innerText = 'Your request has been received. You can also call us directly at ${escapeHtml(phone)}.';
      }
    });
  </script>
</body>
</html>`;

  // Page 2: services.html
  const servicesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Services | ${escapeHtml(bizName)} — ${trade} Contractor in ${city}</title>
  <meta name="description" content="Explore complete ${trade.toLowerCase()} solutions by ${escapeHtml(bizName)}. Serving ${city} and Northeast Wisconsin with licensed, experienced professionals.">
  <link rel="canonical" href="https://${sanitizeSlug(bizName)}.pages.dev/services.html">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans antialiased">
  ${headerHtml}
  <main class="py-16 lg:py-24 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <h1 class="text-4xl font-extrabold text-white mb-4">Our ${trade} Services</h1>
      <p class="text-lg text-slate-400">Engineered for quality, longevity, and Wisconsin's climate demands.</p>
    </div>
    <div class="space-y-12">
      ${services.map((s, idx) => `
        <div class="bg-slate-950 border border-slate-800 rounded-3xl p-8 lg:p-12 flex flex-col md:flex-row items-start gap-8">
          <div class="w-16 h-16 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center font-bold text-2xl flex-shrink-0">
            0${idx + 1}
          </div>
          <div class="flex-1">
            <h2 class="text-2xl font-bold text-white mb-3">${escapeHtml(s.name)}</h2>
            <p class="text-slate-300 text-base leading-relaxed mb-6">${escapeHtml(s.desc)}</p>
            <div class="flex flex-wrap gap-3">
              <span class="bg-slate-900 border border-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-full">Licensed &amp; Insured</span>
              <span class="bg-slate-900 border border-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-full">Free Written Estimates</span>
              <span class="bg-slate-900 border border-slate-700 text-xs text-slate-300 px-3 py-1.5 rounded-full">Fox Valley Service Area</span>
            </div>
          </div>
          <a href="contact.html" class="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-all text-sm whitespace-nowrap">
            Schedule Estimate &rarr;
          </a>
        </div>
      `).join('')}
    </div>
  </main>
  ${footerHtml}
</body>
</html>`;

  // Page 3: about.html
  const aboutHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About Us | ${escapeHtml(bizName)} — Serving ${city} &amp; Fox Valley</title>
  <meta name="description" content="Learn about ${escapeHtml(bizName)}, our local reputation, craftsmanship standards, and commitment to ${city} homeowners and businesses.">
  <link rel="canonical" href="https://${sanitizeSlug(bizName)}.pages.dev/about.html">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans antialiased">
  ${headerHtml}
  <main class="py-16 lg:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="mb-12">
      <span class="text-blue-400 font-semibold text-sm uppercase tracking-wider block mb-2">About Our Company</span>
      <h1 class="text-4xl font-extrabold text-white mb-6">${escapeHtml(bizName)} in ${city}</h1>
      <p class="text-lg text-slate-300 leading-relaxed mb-6">
        ${escapeHtml(bizName)} has earned a reputation across Northeast Wisconsin for dependable craftsmanship, transparent communications, and durable results on every project.
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-6 my-10">
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center">
          <p class="text-3xl font-extrabold text-blue-400 mb-1">Local</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Fox Valley Rooted</p>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center">
          <p class="text-3xl font-extrabold text-blue-400 mb-1">100%</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Satisfaction Focus</p>
        </div>
        <div class="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center">
          <p class="text-3xl font-extrabold text-blue-400 mb-1">Fast</p>
          <p class="text-xs text-slate-400 uppercase tracking-wider">Response Times</p>
        </div>
      </div>
      <h2 class="text-2xl font-bold text-white mb-4">Areas We Proudly Serve</h2>
      <p class="text-slate-300 text-base leading-relaxed mb-6">
        Our crew regularly services Appleton, Neenah, Menasha, Kaukauna, Kimberly, Little Chute, Greenville, Oshkosh, and surrounding Fox Valley communities.
      </p>
      <div class="mt-10">
        <a href="contact.html" class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-bold px-8 py-4 rounded-xl transition-all">
          Connect With Us Today &rarr;
        </a>
      </div>
    </div>
  </main>
  ${footerHtml}
</body>
</html>`;

  // Page 4: contact.html
  const contactHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact ${escapeHtml(bizName)} | Request a Free Quote</title>
  <meta name="description" content="Contact ${escapeHtml(bizName)} in ${city}. Call ${phone} or request a free estimate online today.">
  <link rel="canonical" href="https://${sanitizeSlug(bizName)}.pages.dev/contact.html">
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-slate-100 font-sans antialiased">
  ${headerHtml}
  <main class="py-16 lg:py-24 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-12">
      <h1 class="text-4xl font-extrabold text-white mb-3">Get in Touch with ${escapeHtml(bizName)}</h1>
      <p class="text-slate-400">Call our direct line or send us your project details below.</p>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="bg-slate-950 border border-slate-800 rounded-3xl p-8 space-y-6">
        <div>
          <h3 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">Direct Phone</h3>
          <a href="tel:${cleanPhone}" class="text-xl font-extrabold text-white hover:text-blue-400 transition-colors">${escapeHtml(phone)}</a>
        </div>
        <div>
          <h3 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">Email Address</h3>
          <p class="text-slate-300 text-sm">${escapeHtml(email)}</p>
        </div>
        <div>
          <h3 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">Service Area</h3>
          <p class="text-slate-300 text-sm">${escapeHtml(serviceArea)}</p>
        </div>
        <div>
          <h3 class="text-sm font-bold text-blue-400 uppercase tracking-wider mb-1">Operating Hours</h3>
          <p class="text-slate-400 text-xs leading-relaxed">${escapeHtml(lead.hours || 'Monday – Friday: 7:00 AM – 5:00 PM')}</p>
        </div>
      </div>
      <div class="md:col-span-2 bg-slate-950 border border-slate-800 rounded-3xl p-8 lg:p-10">
        <form id="contactForm2" class="space-y-5">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label for="name2" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Name</label>
              <input type="text" id="name2" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm">
            </div>
            <div>
              <label for="phone2" class="block text-xs font-semibold text-slate-300 uppercase mb-2">Phone</label>
              <input type="tel" id="phone2" required class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm">
            </div>
          </div>
          <div>
            <label for="details" class="block text-xs font-semibold text-slate-300 uppercase mb-2">How can we help?</label>
            <textarea id="details" rows="4" class="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm" placeholder="Provide any details about your upcoming project..."></textarea>
          </div>
          <button type="submit" class="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-all text-sm">
            Send Message &rarr;
          </button>
        </form>
      </div>
    </div>
  </main>
  ${footerHtml}
</body>
</html>`;

  // Metadata files
  const llmsTxt = `# ${bizName} — ${trade} Contractor (${city})

> ${bizName} is a local ${trade.toLowerCase()} contractor serving ${serviceArea}.

## Business Information (AI & Voice Assistants)
- **Business Name:** ${bizName}
- **Primary Trade:** ${trade}
- **Phone:** ${phone}
- **Email:** ${email}
- **Location:** ${city}
- **Service Area:** ${serviceArea}
- **Hours:** ${lead.hours || 'Monday - Friday: 7:00 AM - 5:00 PM'}

## Core Services
${services.map((s, idx) => `${idx + 1}. **${s.name}:** ${s.desc}`).join('\n')}

## Pages
- Home: https://${sanitizeSlug(bizName)}.pages.dev/
- Services: https://${sanitizeSlug(bizName)}.pages.dev/services.html
- About: https://${sanitizeSlug(bizName)}.pages.dev/about.html
- Contact: https://${sanitizeSlug(bizName)}.pages.dev/contact.html
`;

  const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://${sanitizeSlug(bizName)}.pages.dev/sitemap.xml
`;

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${sanitizeSlug(bizName)}.pages.dev/</loc><priority>1.0</priority></url>
  <url><loc>https://${sanitizeSlug(bizName)}.pages.dev/services.html</loc><priority>0.8</priority></url>
  <url><loc>https://${sanitizeSlug(bizName)}.pages.dev/about.html</loc><priority>0.8</priority></url>
  <url><loc>https://${sanitizeSlug(bizName)}.pages.dev/contact.html</loc><priority>0.8</priority></url>
</urlset>
`;

  return {
    'index.html': indexHtml,
    'services.html': servicesHtml,
    'about.html': aboutHtml,
    'contact.html': contactHtml,
    'llms.txt': llmsTxt,
    'robots.txt': robotsTxt,
    'sitemap.xml': sitemapXml
  };
}

async function buildAndDeploySpecSite(lead, tradeInfo) {
  const slug = sanitizeSlug(lead.businessName);
  const siteDir = path.join(CONFIG.SPEC_SITES_ROOT, slug);
  const assetsDir = path.join(siteDir, 'assets');
  const funcDir = path.join(siteDir, 'functions', 'api');

  logSub(`Building spec site files in: ${siteDir}`);

  // Create folder structure
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.mkdirSync(funcDir, { recursive: true });

  // Copy preview-banner.js
  if (fs.existsSync(CONFIG.PREVIEW_BANNER_SRC)) {
    fs.copyFileSync(CONFIG.PREVIEW_BANNER_SRC, path.join(assetsDir, 'preview-banner.js'));
  }

  // Copy contact.js relay
  if (fs.existsSync(CONFIG.CONTACT_API_SRC)) {
    fs.copyFileSync(CONFIG.CONTACT_API_SRC, path.join(funcDir, 'contact.js'));
  }

  // Generate markup
  const files = generateSiteMarkup(lead, tradeInfo);
  for (const [filename, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(siteDir, filename), content, 'utf8');
  }

  logSub(`Deploying to Cloudflare Pages via Wrangler (${slug}.pages.dev)...`);

  // Step 1: Ensure project exists
  try {
    execSync(`npx wrangler pages project create ${slug} --production-branch=main --force`, {
      env: process.env,
      stdio: 'ignore'
    });
  } catch (e) {
    // Already exists or created
  }

  // Step 2: Deploy static files
  const deployOutput = execSync(`npx wrangler pages deploy "${siteDir}" --project-name=${slug} --branch=main --commit-dirty=true`, {
    env: process.env,
    encoding: 'utf8'
  });

  const previewUrl = `https://${slug}.pages.dev`;
  logSuccess(`Cloudflare Pages live: ${previewUrl}`);

  // Step 3: Update Google Sheets Col T (Preview URL) and Col R (Lead Status)
  logSub(`Updating Google Sheet Row ${lead.rowNumber} with preview URL...`);
  await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rowNumber: lead.rowNumber,
      status: 'Ready to Email',
      previewUrl: previewUrl
    })
  });

  // Step 4: Register in Firestore demo_sites collection
  logSub('Registering in Firestore "demo_sites" collection...');
  try {
    let detectedTrade = tradeInfo.trade;
    if (lead.ratingReviews && lead.ratingReviews.includes('-')) {
      const ext = lead.ratingReviews.split('-')[1]?.trim();
      if (ext && ext.length > 2 && ext.length < 40) {
        detectedTrade = ext.replace(/contractor|services|company|llc|inc/gi, '').trim() || tradeInfo.trade;
        detectedTrade = detectedTrade.charAt(0).toUpperCase() + detectedTrade.slice(1);
      }
    }
    let detectedCity = tradeInfo.city;
    if (lead.serviceArea && lead.serviceArea.includes('(')) {
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
      contactPhone: lead.phone || ''
    });
    logSuccess(`Added to Admin Hub Demo Sites collection (${slug}).`);
  } catch (e) {
    logWarn(`Could not register in Firestore demo_sites: ${e.message}`);
  }

  return { slug, previewUrl, siteDir };
}

// ============================================================================
// AGENT 4: THE PITCHER (Drafts Outreach in Zoho Mail)
// ============================================================================

function generatePitchEmailMarkup(lead, previewUrl) {
  const bizName = lead.businessName;
  const claimUrl = `${CONFIG.CLAIM_BASE_URL}?business=${encodeURIComponent(bizName)}&preview=${encodeURIComponent(previewUrl)}`;
  const issues = lead.siteIssues || '';

  // Extract friendly improvement bullet points
  const bulletPoints = [];
  if (!lead.domainStatus || lead.domainStatus.toLowerCase().includes('no website') || lead.domainStatus.toLowerCase().includes('facebook.com')) {
    bulletPoints.push('<strong>Dedicated Mobile Storefront:</strong> Gives your business a fast, professional web presence so homeowners finding your Google reviews can immediately see your services and call.');
    bulletPoints.push('<strong>One-Tap Calling:</strong> Prominent, tappable phone buttons on every page so mobile visitors never have to copy/paste your number.');
    bulletPoints.push('<strong>Local Google Search Markup:</strong> Pre-configured local contractor schema to help you capture search traffic in your service area.');
  } else {
    bulletPoints.push('<strong>Blazing-Fast Speed &amp; Security:</strong> Modern static architecture with HTTPS SSL encryption and zero slow WordPress plugins.');
    bulletPoints.push('<strong>Mobile-First Responsive Layout:</strong> Engineered to fit perfectly on every smartphone, tablet, and desktop without awkward zooming.');
    bulletPoints.push('<strong>Direct Lead Routing:</strong> Fully functional estimate forms that deliver visitor inquiries straight to your phone and inbox.');
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px; line-height: 1.6; font-size: 16px;">
      <p style="margin-top: 0;">Hi <strong>${escapeHtml(bizName)}</strong> team,</p>
      <p>I'm Jason Woodrow, founder of <strong>624 Siteworks</strong> right here in Appleton. While researching top-rated local contractors in the Fox Valley, I noticed your strong customer reviews and built a custom, interactive 4-page website concept specifically for <strong>${escapeHtml(bizName)}</strong>.</p>
      
      <p style="margin: 24px 0;">
        <a href="${previewUrl}" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">
          View Your Live Website Preview &rarr;
        </a>
      </p>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 16px 20px; margin: 24px 0;">
        <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #475569;">
          Key upgrades this live concept delivers:
        </p>
        <ul style="margin: 0; padding-left: 20px; color: #1e293b; font-size: 14px; line-height: 1.6;">
          ${bulletPoints.map(b => `<li style="margin-bottom: 8px;">${b}</li>`).join('')}
        </ul>
      </div>

      <p>Unlike bloated website builders that take months to launch and require ongoing maintenance, we hand-craft fast static websites engineered to turn Google searches into phone calls.</p>
      
      <p><strong>What happens if you like it?</strong><br/>
      There's zero obligation. If you'd like to claim this design, we can customize any text, photos, or service details, and connect it to your domain for a flat one-time build fee: <a href="${claimUrl}" style="color: #2563eb; font-weight: 600;">Claim &amp; Customize Your Site</a>.</p>

      <p style="margin-top: 28px; margin-bottom: 4px;">Best regards,</p>
      <p style="margin: 0;">
        <strong>Jason Woodrow</strong><br/>
        624 Siteworks | Appleton, WI<br/>
        <a href="https://624siteworks.com" style="color: #2563eb; text-decoration: none;">624siteworks.com</a>
      </p>
    </div>
  `;

  return html;
}

async function draftOutreachEmail(lead, previewUrl) {
  const bizName = lead.businessName;
  const recipientEmail = lead.email || 'hello@624films.com';
  const subject = `I built a custom website concept for ${bizName} (Preview inside)`;
  const htmlContent = generatePitchEmailMarkup(lead, previewUrl);

  logSub(`Creating draft for "${bizName}" -> ${recipientEmail} in Zoho Mail...`);

  const draftResult = await createZohoDraft(recipientEmail, subject, htmlContent);
  logSuccess(`Zoho Mail draft created (Message ID: ${draftResult.data?.messageId || 'OK'}).`);

  // Update Google Sheet status to "5. Draft Created"
  await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateLead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
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
      <td style="padding: 12px 16px; color: #475569;">${escapeHtml(r.lead.email || 'None on file')}</td>
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
          <li>Review the 2 new outreach emails in your <a href="https://mail.zoho.com" style="color: #2563eb;">Zoho Mail Drafts folder</a>.</li>
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
      `[624 Lead Engine] Daily Run Complete: 2 Spec Sites Deployed (${targetNiche.trade} in ${targetNiche.city})`,
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
  const countToBuild = 2;

  // Determine current niche from rotation schedule
  const state = loadState();
  const nextIndex = (state.lastRunIndex + 1) % ROTATING_NICHES.length;
  const targetNiche = ROTATING_NICHES[nextIndex];

  console.log(`\n📅 Scheduled Niche [${nextIndex + 1}/10]: \x1b[33m${targetNiche.trade}\x1b[0m in \x1b[32m${targetNiche.city}\x1b[0m`);
  console.log(`🔎 Maps Query: "${targetNiche.query}"`);
  if (isDryRun) {
    console.log('⚡ Running in DRY-RUN mode (no deployments or drafts).');
  }

  // Agent 1: The Scout
  await runTheScout(targetNiche);

  // Agent 2: The Diagnoser & Ranker
  const chosenLeads = await runTheDiagnoser(targetNiche, countToBuild);

  if (isDryRun) {
    logSuccess('Dry run complete. Selected leads ready for build:');
    chosenLeads.forEach(l => console.log(`   - ${l.businessName} (Badness: ${l.badnessScore}/100)`));
    return;
  }

  // Agent 3: The Builder & Agent 4: The Pitcher
  const results = [];
  for (let i = 0; i < chosenLeads.length; i++) {
    const lead = chosenLeads[i];
    logStep(3, 'The Builder', `[${i + 1}/${chosenLeads.length}] Generating & Deploying Spec Site for "${lead.businessName}"...`);
    
    const buildResult = await buildAndDeploySpecSite(lead, targetNiche);
    
    logStep(4, 'The Pitcher', `[${i + 1}/${chosenLeads.length}] Drafting Outreach Email in Zoho Mail for "${lead.businessName}"...`);
    await draftOutreachEmail(lead, buildResult.previewUrl);

    results.push({
      lead: lead,
      slug: buildResult.slug,
      previewUrl: buildResult.previewUrl
    });
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
  console.log(` 2 Spec Sites deployed, registered in Demo Sites, and drafts saved to Zoho Mail.`);
  console.log('============================================================================\n');
}

runAutonomousLeadEngine().catch(err => {
  logError(`FATAL ERROR in autonomous lead engine: ${err.message}`);
  console.error(err);
  process.exit(1);
});
