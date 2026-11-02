/**
 * ============================================================================
 * 624 SITEWORKS - AUTOMATED LEAD & SPEC-SITE PIPELINE (Google Apps Script)
 * ============================================================================
 * Location: Appleton, WI (Fox Valley & Northeast Wisconsin)
 * Owner: Jason Woodrow - 624 Siteworks (https://624siteworks.com)
 *
 * SUPPORTED GOOGLE MAPS SCRAPERS (Gate 1):
 *   Option A (Recommended Free / No Credit Card): Serper.dev (https://serper.dev)
 *            -> 2,500 free searches on sign-up, no credit card required!
 *   Option B: Outscraper (https://outscraper.com)
 *
 * PIPELINE GATES:
 *   Gate 1: promptAndScrapeLeads()          -> Status: "1. Scraped"
 *   (Human Review: Change Col R to "Approve Research")
 *   Gate 2: enrichApprovedLeadsWithAI()     -> Status: "2. Prompt Ready" (Col Q auto-builds prompt)
 *   (Human Build: Paste Col Q into Antigravity IDE, run 624deploy, paste .pages.dev URL in Col T, set Col R to "Ready to Email")
 *   Gate 4: createDraftsForApprovedBuilds() -> Status: "5. Draft Created" (HTML Gmail draft + inline screenshot)
 * ============================================================================
 */

const CONFIG = {
  SHEET_NAME: 'Prospect Pipeline',
  DEFAULT_SERVICE_AREA: 'Fox Valley & Northeast Wisconsin (Appleton, Neenah, Menasha, Kaukauna, Greenville)',
  MIN_REVIEWS: 5,
  DEFAULT_SCRAPE_LIMIT: 20,
  GEMINI_MODEL: 'gemini-2.5-flash',
  SENDER_NAME: 'Jason Woodrow',
  AGENCY_NAME: '624 Siteworks',
  AGENCY_URL: 'https://624siteworks.com',
  CLAIM_BASE_URL: 'https://624siteworks.com/claim.html',
  AGENCY_PHONE: '(920) 555-0624',
  screenshotBaseUrl: 'https://image.thum.io/get/width/1200/crop/800/noanimate/'
};

/**
 * Column Index Map (1-based for Apps Script getRange)
 * Preserves 624 Siteworks Client Intake Responses (A-Q) + Pipeline Control (R-U)
 */
const COL = {
  TIMESTAMP: 1,        // Col A
  BUSINESS_NAME: 2,    // Col B
  SERVICE_AREA: 3,     // Col C
  PHONE: 4,            // Col D
  VIBE: 5,             // Col E
  SERVICE_1_NAME: 6,   // Col F
  SERVICE_1_DESC: 7,   // Col G
  SERVICE_2_NAME: 8,   // Col H
  SERVICE_2_DESC: 9,   // Col I
  SERVICE_3_NAME: 10,  // Col J
  SERVICE_3_DESC: 11,  // Col K
  LOGO_URL: 12,        // Col L
  DOMAIN_STATUS: 13,   // Col M
  EMAIL: 14,           // Col N
  HOURS: 15,           // Col O
  TRUST_FACTOR: 16,    // Col P
  AI_PROMPT: 17,       // Col Q (Formula-driven)
  LEAD_STATUS: 18,     // Col R
  RATING_REVIEWS: 19,  // Col S
  PREVIEW_URL: 20,     // Col T
  NOTES: 21            // Col U
};

const STATUS = {
  SCRAPED: '1. Scraped',
  APPROVE_RESEARCH: 'Approve Research',
  PROMPT_READY: '2. Prompt Ready',
  READY_TO_EMAIL: 'Ready to Email',
  DRAFT_CREATED: '5. Draft Created'
};

/**
 * Adds the custom "624 Lead Engine" menu on spreadsheet open.
 * Uses Unicode escapes so Windows/browser copy-paste never garbles icons.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('\uD83D\uDE80 624 Lead Engine')
    .addItem('1. Gate 1: Scrape Local Leads (Serper / Outscraper)', 'promptAndScrapeLeads')
    .addItem('2. Gate 2: Enrich Approved Leads (Gemini AI)', 'enrichApprovedLeadsWithAI')
    .addItem('4. Gate 4: Create Gmail Drafts for Previews', 'createDraftsForApprovedBuilds')
    .addSeparator()
    .addItem('Initialize / Repair "Prospect Pipeline" Tab', 'initializeProspectPipelineSheet')
    .addItem('Configure API Keys (Serper & Gemini)', 'configureApiKeysPrompt')
    .addToUi();
}

/**
 * Prompts the user to save their Serper.dev and Gemini API keys
 * in ScriptProperties so keys never have to be hardcoded.
 */
function configureApiKeysPrompt() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();

  const serperResp = ui.prompt(
    'Step 1 of 2: Serper.dev API Key (FREE - No Credit Card)',
    'Sign up at https://serper.dev for 2,500 free Google Maps searches.\nPaste your Serper API Key here (leave blank to keep existing):',
    ui.ButtonSet.OK_CANCEL
  );
  if (serperResp.getSelectedButton() === ui.Button.OK && serperResp.getResponseText().trim()) {
    props.setProperty('SERPER_API_KEY', serperResp.getResponseText().trim());
    props.deleteProperty('OUTSCRAPER_API_KEY');
  }

  const geminiResp = ui.prompt(
    'Step 2 of 2: Google Gemini API Key (FREE at aistudio.google.com)',
    'Enter your Google Gemini API Key (leave blank to keep existing):',
    ui.ButtonSet.OK_CANCEL
  );
  if (geminiResp.getSelectedButton() === ui.Button.OK && geminiResp.getResponseText().trim()) {
    props.setProperty('GEMINI_API_KEY', geminiResp.getResponseText().trim());
  }

  ui.alert('API Keys saved! You can now run Gate 1.');
}

/**
 * Ensures the "Prospect Pipeline" sheet exists with headers A-U, status dropdowns,
 * and the Column Q ARRAYFORMULA.
 */
function initializeProspectPipelineSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }

  const headers = [
    'Timestamp',                                  // A
    'Business Name',                              // B
    'Target Service Area (Cities/Counties)',      // C
    'Primary Phone Number',                       // D
    'Brand Colors & Desired "Vibe"',              // E
    'Service 1 Name',                             // F
    'Service 1 Description',                      // G
    'Service 2 Name',                             // H
    'Service 2 Description',                      // I
    'Service 3 Name',                             // J
    'Service 3 Description',                      // K
    'Logo & Brand Images',                        // L
    'Domain Status',                              // M
    'Business Email Address',                     // N
    'Operating Hours',                            // O
    'Primary Trust Factor',                       // P
    'Generated AI Prompt',                        // Q
    'Lead Status',                                // R
    'Google Rating & Reviews',                    // S
    'Spec Preview URL',                           // T
    'Email Sent / Notes'                          // U
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);

  // Set Column Q Header ArrayFormula so rows 2+ automatically generate the Antigravity prompt
  const promptArrayFormula =
    '=ARRAYFORMULA(IF(ROW(A:A)=1, "Generated AI Prompt", IF(B:B="", "", ' +
    '"Build a high-converting, blazing-fast 4-page static Tailwind CSS website (index.html, services.html, about.html, contact.html) for " & B:B & ". " & CHAR(10) & CHAR(10) & ' +
    '"BUSINESS PROFILE:" & CHAR(10) & ' +
    '"- Business Name: " & B:B & CHAR(10) & ' +
    '"- Target Service Area: " & C:C & CHAR(10) & ' +
    '"- Phone Number: " & D:D & CHAR(10) & ' +
    '"- Email Address: " & N:N & CHAR(10) & ' +
    '"- Operating Hours: " & O:O & CHAR(10) & ' +
    '"- Existing Domain / Reference: " & M:M & CHAR(10) & ' +
    '"- Logo URL: " & L:L & CHAR(10) & ' +
    '"- Brand Colors & Vibe: " & E:E & CHAR(10) & ' +
    '"- Primary Trust Badge / Subheadline: " & P:P & " (" & S:S & ")" & CHAR(10) & CHAR(10) & ' +
    '"CORE SERVICES TO FEATURE:" & CHAR(10) & ' +
    '"1. " & F:F & ": " & G:G & CHAR(10) & ' +
    '"2. " & H:H & ": " & I:I & CHAR(10) & ' +
    '"3. " & J:J & ": " & K:K & CHAR(10) & CHAR(10) & ' +
    '"TECHNICAL REQUIREMENTS:" & CHAR(10) & ' +
    '"- Pure static HTML5 + Tailwind CSS via CDN, mobile-first sticky header with click-to-call phone button (" & D:D & "), local SEO schema markup, and clear lead-capture forms." & CHAR(10) & ' +
    '"- Include the 624 Siteworks floating concept banner right before </body> on every page: <script src=""https://624siteworks.com/assets/preview-banner.js"" data-business=""" & B:B & """ defer></script>")))';

  sheet.getRange('Q1').setFormula(promptArrayFormula);

  // Add data validation dropdown on Column R (Lead Status) for rows 2..500
  const statusRule = SpreadsheetApp.newDataValidation()
    .requireValueInList([
      STATUS.SCRAPED,
      STATUS.APPROVE_RESEARCH,
      STATUS.PROMPT_READY,
      STATUS.READY_TO_EMAIL,
      STATUS.DRAFT_CREATED,
      'Skip / Disqualified'
    ], true)
    .setAllowInvalid(true)
    .build();
  sheet.getRange(2, COL.LEAD_STATUS, 500, 1).setDataValidation(statusRule);

  return sheet;
}

/* ============================================================================
 * GATE 1: SCRAPE LOCAL LEADS (SUPPORTS SERPER.DEV FREE TIER OR OUTSCRAPER)
 * ============================================================================ */

function promptAndScrapeLeads() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  let serperKey = props.getProperty('SERPER_API_KEY');
  const outscraperKey = props.getProperty('OUTSCRAPER_API_KEY');

  // If the user previously pasted a Serper key into the old Outscraper prompt, auto-migrate it
  if (!serperKey && outscraperKey && /^[a-f0-9]{32,64}$/i.test(outscraperKey.trim())) {
    serperKey = outscraperKey.trim();
    props.setProperty('SERPER_API_KEY', serperKey);
    props.deleteProperty('OUTSCRAPER_API_KEY');
  }

  if (!serperKey && !outscraperKey) {
    ui.alert(
      'Missing Scraper API Key',
      'Please run "624 Lead Engine -> Configure API Keys" first.\n\nTip: Get a free API key with 2,500 searches (no credit card required) at https://serper.dev',
      ui.ButtonSet.OK
    );
    return;
  }

  const providerLabel = serperKey ? 'Serper.dev (Free Tier)' : 'Outscraper';
  const promptResp = ui.prompt(
    'Gate 1: Scrape Local Service Leads via ' + providerLabel,
    'Enter Google Maps search query (e.g., "Concrete contractor, Appleton, WI"):',
    ui.ButtonSet.OK_CANCEL
  );
  if (promptResp.getSelectedButton() !== ui.Button.OK) return;

  const query = promptResp.getResponseText().trim();
  if (!query) {
    ui.alert('Please provide a non-empty search query.');
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME) || initializeProspectPipelineSheet();
  sheet.activate();

  // Find true last populated row in Column B (Business Name) & collect existing names
  const colBValues = sheet.getRange(1, COL.BUSINESS_NAME, Math.max(sheet.getLastRow(), 1), 1).getValues();
  const existingNames = new Set();
  let lastPopulatedRow = 1;
  for (let r = 1; r < colBValues.length; r++) {
    const cellVal = String(colBValues[r][0] || '').trim();
    if (cellVal) {
      existingNames.add(cellVal.toLowerCase());
      lastPopulatedRow = r + 1;
    }
  }

  let normalizedPlaces = [];
  try {
    if (serperKey) {
      normalizedPlaces = fetchLeadsFromSerper_(serperKey, query);
    } else {
      normalizedPlaces = fetchLeadsFromOutscraper_(outscraperKey, query);
    }
  } catch (err) {
    ui.alert('Scraper Error:\n' + err.message);
    return;
  }

  if (!normalizedPlaces.length) {
    ui.alert('No businesses returned for query: "' + query + '".');
    return;
  }

  const rowsToInsert = [];
  let crawledEmailCount = 0;

  for (let i = 0; i < normalizedPlaces.length; i++) {
    const item = normalizedPlaces[i];
    const bizName = (item.name || '').trim();
    const reviewsCount = Number(item.reviews || 0);

    // Filter: minimum 5 reviews & non-duplicate
    if (!bizName || reviewsCount < CONFIG.MIN_REVIEWS) continue;
    if (existingNames.has(bizName.toLowerCase())) continue;

    existingNames.add(bizName.toLowerCase());

    const siteUrl = (item.site || '').trim();
    let fbUrl = (item.facebook || '').trim();
    let email = (item.email || '').trim();
    let logoUrl = (item.logo || '').trim();

    // Crawl website for email (and fallback Facebook if using Serper)
    if (!email && siteUrl && !siteUrl.includes('facebook.com')) {
      const crawled = crawlWebsiteForContactInfo_(siteUrl);
      if (crawled.email) {
        email = crawled.email;
        crawledEmailCount++;
      }
      if (!fbUrl && crawled.facebook) {
        fbUrl = crawled.facebook;
      }
    }

    const domainStatus = siteUrl || fbUrl || 'No Website Listed';
    const hoursStr = formatWorkingHours_(item.working_hours);
    const ratingVal = item.rating ? Number(item.rating).toFixed(1) : '5.0';
    const tradeType = item.type || query.split(',')[0].trim();
    const ratingBadge = ratingVal + ' \u2605 (' + reviewsCount + ' reviews) - ' + tradeType;

    // Build 21-column row (leaving Col Q blank so ARRAYFORMULA in Q1 populates it)
    const row = new Array(21).fill('');
    row[COL.TIMESTAMP - 1] = new Date();
    row[COL.BUSINESS_NAME - 1] = bizName;
    row[COL.SERVICE_AREA - 1] = CONFIG.DEFAULT_SERVICE_AREA;
    row[COL.PHONE - 1] = item.phone || '';
    row[COL.LOGO_URL - 1] = logoUrl;
    row[COL.DOMAIN_STATUS - 1] = domainStatus;
    row[COL.EMAIL - 1] = email;
    row[COL.HOURS - 1] = hoursStr;
    row[COL.LEAD_STATUS - 1] = STATUS.SCRAPED;
    row[COL.RATING_REVIEWS - 1] = ratingBadge;

    rowsToInsert.push(row);
  }

  if (!rowsToInsert.length) {
    ui.alert('No new leads matched the filter (reviews >= ' + CONFIG.MIN_REVIEWS + ').');
    return;
  }

  const startRow = lastPopulatedRow + 1;
  const leftCols = rowsToInsert.map(r => r.slice(0, 16));   // Cols A-P (1..16)
  const rightCols = rowsToInsert.map(r => r.slice(17, 21)); // Cols R-U (18..21), leaving Col Q untouched for ARRAYFORMULA
  sheet.getRange(startRow, 1, rowsToInsert.length, 16).setValues(leftCols);
  sheet.getRange(startRow, 18, rowsToInsert.length, 4).setValues(rightCols);
  sheet.activate();
  sheet.getRange(startRow, COL.BUSINESS_NAME).activate();

  ui.alert(
    'Gate 1 Complete (' + providerLabel + ')',
    'Added ' + rowsToInsert.length + ' qualified leads to "' + CONFIG.SHEET_NAME + '".\n' +
    'Website crawler extracted ' + crawledEmailCount + ' email(s) directly from business websites.\n\n' +
    'Next Step: Review new rows and change Column R (Lead Status) to "' + STATUS.APPROVE_RESEARCH + '" for the leads you want Gemini AI to enrich.',
    ui.ButtonSet.OK
  );
}

/**
 * Fetches Google Maps results via Serper.dev (https://google.serper.dev/maps)
 * Free tier: 2,500 searches with no credit card required.
 */
function fetchLeadsFromSerper_(apiKey, query) {
  const resp = UrlFetchApp.fetch('https://google.serper.dev/maps', {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-API-KEY': apiKey },
    payload: JSON.stringify({ q: query, gl: 'us', hl: 'en' }),
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Serper.dev HTTP ' + code + ': ' + text.slice(0, 300));
  }

  const data = JSON.parse(text);
  const places = Array.isArray(data.places) ? data.places : [];

  return places.map(p => ({
    name: p.title || '',
    full_address: p.address || '',
    phone: p.phoneNumber || '',
    site: p.website || '',
    rating: p.rating || '',
    reviews: p.ratingCount || 0,
    working_hours: p.openingHours || '',
    type: p.type || (Array.isArray(p.types) ? p.types[0] : ''),
    logo: p.thumbnailUrl || '',
    email: '',
    facebook: (p.website && p.website.includes('facebook.com')) ? p.website : ''
  }));
}

/**
 * Fetches Google Maps results via Outscraper v2 API (optional fallback).
 */
function fetchLeadsFromOutscraper_(apiKey, query) {
  const fields = [
    'name', 'full_address', 'phone', 'site', 'rating',
    'reviews', 'working_hours', 'type', 'logo',
    'email_1', 'email_2', 'facebook'
  ].join(',');

  const endpoint = 'https://api.app.outscraper.com/maps/search-v2'
    + '?query=' + encodeURIComponent(query)
    + '&limit=' + encodeURIComponent(CONFIG.DEFAULT_SCRAPE_LIMIT)
    + '&async=false'
    + '&enrichment=domains_service'
    + '&fields=' + encodeURIComponent(fields);

  const resp = UrlFetchApp.fetch(endpoint, {
    method: 'get',
    headers: { 'X-API-KEY': apiKey },
    muteHttpExceptions: true
  });

  const code = resp.getResponseCode();
  const text = resp.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Outscraper HTTP ' + code + ': ' + text.slice(0, 300));
  }

  const payload = JSON.parse(text);
  const results = (payload && payload.data && Array.isArray(payload.data[0])) ? payload.data[0] : [];

  return results.map(item => ({
    name: item.name || '',
    full_address: item.full_address || '',
    phone: item.phone || '',
    site: item.site || '',
    rating: item.rating || '',
    reviews: item.reviews || 0,
    working_hours: item.working_hours || '',
    type: item.type || '',
    logo: item.logo || '',
    email: item.email_1 || item.email_2 || '',
    facebook: item.facebook || ''
  }));
}

/* ============================================================================
 * GATE 2: ENRICH APPROVED LEADS WITH GEMINI AI (gemini-2.5-flash)
 * ============================================================================ */

function enrichApprovedLeadsWithAI() {
  const ui = SpreadsheetApp.getUi();
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!geminiKey) {
    ui.alert('Missing Gemini API Key', 'Please run "624 Lead Engine -> Configure API Keys" first.', ui.ButtonSet.OK);
    return;
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('No rows found in "' + CONFIG.SHEET_NAME + '".');
    return;
  }

  const numRows = sheet.getLastRow() - 1;
  const dataRange = sheet.getRange(2, 1, numRows, 21);
  const values = dataRange.getValues();

  let enrichedCount = 0;
  const errors = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 2;
    const status = String(row[COL.LEAD_STATUS - 1] || '').trim();

    if (status !== STATUS.APPROVE_RESEARCH) continue;

    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    const serviceArea = String(row[COL.SERVICE_AREA - 1] || CONFIG.DEFAULT_SERVICE_AREA).trim();
    const ratingBadge = String(row[COL.RATING_REVIEWS - 1] || '').trim();
    const domainStatus = String(row[COL.DOMAIN_STATUS - 1] || '').trim();
    const existingEmail = String(row[COL.EMAIL - 1] || '').trim();

    try {
      const aiData = callGeminiForLeadEnrichment_(geminiKey, {
        bizName: bizName,
        serviceArea: serviceArea,
        ratingBadge: ratingBadge,
        domainStatus: domainStatus
      });

      // Populate Cols E (vibe), F-K (services 1-3), N (placeholder email if blank), P (trustFactor), R (status)
      sheet.getRange(rowNumber, COL.VIBE).setValue(aiData.vibe || '');
      sheet.getRange(rowNumber, COL.SERVICE_1_NAME).setValue(aiData.service1Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_1_DESC).setValue(aiData.service1Desc || '');
      sheet.getRange(rowNumber, COL.SERVICE_2_NAME).setValue(aiData.service2Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_2_DESC).setValue(aiData.service2Desc || '');
      sheet.getRange(rowNumber, COL.SERVICE_3_NAME).setValue(aiData.service3Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_3_DESC).setValue(aiData.service3Desc || '');

      if (!existingEmail) {
        const fallbackEmail = buildFallbackEmail_(bizName, domainStatus);
        sheet.getRange(rowNumber, COL.EMAIL).setValue(fallbackEmail);
      }

      sheet.getRange(rowNumber, COL.TRUST_FACTOR).setValue(aiData.trustFactor || '');
      sheet.getRange(rowNumber, COL.LEAD_STATUS).setValue(STATUS.PROMPT_READY);

      enrichedCount++;
      SpreadsheetApp.flush();
    } catch (err) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): ' + err.message);
    }
  }

  let summary = 'Gate 2 Complete: Enriched ' + enrichedCount + ' lead(s) to "' + STATUS.PROMPT_READY + '".\n' +
    'Column Q now contains the ready-to-paste Antigravity IDE prompts.';
  if (errors.length) {
    summary += '\n\nErrors (' + errors.length + '):\n' + errors.join('\n');
  }
  ui.alert(summary);
}

/**
 * Calls Gemini 2.5 Flash with responseMimeType: "application/json" to generate
 * trade-specific brand vibe, 3 core services with 2-sentence local SEO copy, and a primary trust factor.
 */
function callGeminiForLeadEnrichment_(apiKey, context) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.GEMINI_MODEL + ':generateContent?key=' + encodeURIComponent(apiKey);

  const systemPrompt =
    'You are a senior local-SEO conversion copywriter for 624 Siteworks in Appleton, Wisconsin.\n' +
    'Generate website intake fields for the following local service contractor:\n' +
    '- Business Name: ' + context.bizName + '\n' +
    '- Service Area: ' + context.serviceArea + '\n' +
    '- Google Rating & Trade Info: ' + context.ratingBadge + '\n' +
    '- Current Domain / Web Presence: ' + context.domainStatus + '\n\n' +
    'Return ONLY a JSON object with these exact keys:\n' +
    '{\n' +
    '  "vibe": "Specific brand color palette (hex codes + color names) and aesthetic vibe tailored to their trade",\n' +
    '  "service1Name": "Core Service 1 Title",\n' +
    '  "service1Desc": "Exactly 2 sentences of persuasive, local-SEO rich copy mentioning Fox Valley / Appleton area.",\n' +
    '  "service2Name": "Core Service 2 Title",\n' +
    '  "service2Desc": "Exactly 2 sentences of persuasive, local-SEO rich copy mentioning Northeast Wisconsin.",\n' +
    '  "service3Name": "Core Service 3 Title",\n' +
    '  "service3Desc": "Exactly 2 sentences of persuasive, local-SEO rich copy emphasizing craftsmanship and reliability.",\n' +
    '  "trustFactor": "Punchy trust subheadline highlighting their exact Google star rating, review count, and local reputation"\n' +
    '}';

  const requestBody = {
    contents: [{ parts: [{ text: systemPrompt }] }],
    generationConfig: {
      temperature: 0.4,
      responseMimeType: 'application/json'
    }
  };

  const resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(requestBody),
    muteHttpExceptions: true
  });

  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    throw new Error('Gemini API HTTP ' + resp.getResponseCode() + ': ' + resp.getContentText().slice(0, 250));
  }

  const parsed = JSON.parse(resp.getContentText());
  const rawJson = parsed.candidates
    && parsed.candidates[0]
    && parsed.candidates[0].content
    && parsed.candidates[0].content.parts
    && parsed.candidates[0].content.parts[0]
    && parsed.candidates[0].content.parts[0].text;

  if (!rawJson) {
    throw new Error('Empty JSON response from Gemini.');
  }

  return JSON.parse(rawJson);
}

/* ============================================================================
 * GATE 4: CREATE HTML GMAIL DRAFTS WITH EMBEDDED SCREENSHOTS OF .PAGES.DEV
 * ============================================================================ */

function createDraftsForApprovedBuilds() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    ui.alert('No rows found in "' + CONFIG.SHEET_NAME + '".');
    return;
  }

  const numRows = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, numRows, 21).getValues();

  let draftCount = 0;
  const errors = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 2;
    const status = String(row[COL.LEAD_STATUS - 1] || '').trim();
    const previewUrl = String(row[COL.PREVIEW_URL - 1] || '').trim();

    if (status !== STATUS.READY_TO_EMAIL) continue;
    if (!previewUrl || !previewUrl.includes('.pages.dev')) {
      errors.push('Row ' + rowNumber + ': Missing valid .pages.dev URL in Column T.');
      continue;
    }

    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    const recipientEmail = String(row[COL.EMAIL - 1] || '').trim();
    if (!recipientEmail) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): Missing recipient email in Column N.');
      continue;
    }

    try {
      const screenshotBlob = captureSiteScreenshotBlob_(previewUrl, bizName);
      const claimUrl = CONFIG.CLAIM_BASE_URL + '?business=' + encodeURIComponent(bizName) + '&preview=' + encodeURIComponent(previewUrl);

      const subject = 'I built a custom website concept for ' + bizName + ' (Preview inside)';
      const plainBody =
        'Hi ' + bizName + ' team,\n\n' +
        'I\'m Jason Woodrow with 624 Siteworks right here in Appleton. I noticed your strong local reputation and put together a live, mobile-optimized 4-page website concept tailored specifically for ' + bizName + '.\n\n' +
        'View your live interactive preview here:\n' + previewUrl + '\n\n' +
        'If you like the direction, we can customize any text, photos, or branding and launch it on your domain for a flat one-time build fee:\n' + claimUrl + '\n\n' +
        'Best regards,\nJason Woodrow\n624 Siteworks - Appleton, WI\n' + CONFIG.AGENCY_URL;

      const htmlBody = buildHtmlPitchEmail_({
        bizName: bizName,
        previewUrl: previewUrl,
        claimUrl: claimUrl,
        hasInlineScreenshot: Boolean(screenshotBlob)
      });

      const draftOptions = {
        htmlBody: htmlBody
      };
      if (screenshotBlob) {
        draftOptions.inlineImages = { sitePreview: screenshotBlob };
      }

      GmailApp.createDraft(recipientEmail, subject, plainBody, draftOptions);

      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      sheet.getRange(rowNumber, COL.LEAD_STATUS).setValue(STATUS.DRAFT_CREATED);
      sheet.getRange(rowNumber, COL.NOTES).setValue('Draft created ' + timestamp + ' -> ' + recipientEmail + ' (' + previewUrl + ')');

      draftCount++;
      SpreadsheetApp.flush();
    } catch (err) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): ' + err.message);
    }
  }

  let msg = 'Gate 4 Complete: Created ' + draftCount + ' HTML Gmail draft(s) with embedded preview screenshots.';
  if (errors.length) {
    msg += '\n\nSkipped / Errors (' + errors.length + '):\n' + errors.join('\n');
  }
  ui.alert(msg);
}

/**
 * Fetches a 1200x800 desktop screenshot PNG blob of the deployed .pages.dev site
 * via image.thum.io.
 */
function captureSiteScreenshotBlob_(previewUrl, bizName) {
  const thumUrl = CONFIG.screenshotBaseUrl + previewUrl;
  const safeSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preview';

  const response = UrlFetchApp.fetch(thumUrl, {
    method: 'get',
    muteHttpExceptions: true,
    followRedirects: true
  });

  if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
    return response.getBlob().setName(safeSlug + '-preview.png');
  }
  return null;
}

/**
 * Generates the HTML email body for GmailApp.createDraft() with clickable inline screenshot.
 */
function buildHtmlPitchEmail_(data) {
  const screenshotMarkup = data.hasInlineScreenshot
    ? '<div style="margin: 24px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);">' +
        '<a href="' + data.previewUrl + '" target="_blank" style="display: block; text-decoration: none;">' +
          '<img src="cid:sitePreview" alt="' + data.bizName + ' Concept Website Preview" style="display: block; width: 100%; max-width: 640px; height: auto; border: 0;" />' +
        '</a>' +
      '</div>'
    : '';

  return (
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 640px; line-height: 1.6; font-size: 16px;">' +
      '<p style="margin-top: 0;">Hi <strong>' + data.bizName + '</strong> team,</p>' +
      '<p>I\'m Jason Woodrow, founder of <strong>624 Siteworks</strong> right here in Appleton. While looking at top-rated local contractors in the Fox Valley, I noticed your strong Google reviews and decided to build a custom, blazing-fast 4-page website concept specifically for <strong>' + data.bizName + '</strong>.</p>' +
      '<p style="margin: 22px 0;">' +
        '<a href="' + data.previewUrl + '" target="_blank" style="background-color: #2563eb; color: #ffffff; padding: 14px 26px; border-radius: 8px; text-decoration: none; font-weight: 700; display: inline-block;">' +
          'View Your Live Interactive Website Preview &rarr;' +
        '</a>' +
      '</p>' +
      screenshotMarkup +
      '<p style="font-size: 14px; color: #475569; margin-top: 8px;">' +
        '<em>Click the image above or visit <a href="' + data.previewUrl + '" style="color: #2563eb;">' + data.previewUrl + '</a> to test it on your phone or computer.</em>' +
      '</p>' +
      '<p>Unlike bloated WordPress templates that load slowly and require constant plugin updates, we hand-craft clean static websites engineered to rank locally in Northeast Wisconsin and turn visitors into phone calls.</p>' +
      '<p><strong>What happens if you like it?</strong><br/>' +
      'There\'s zero obligation. If you\'d like to claim this site, we hop on a quick call to tweak any photos, services, or wording, and connect it to your domain. You can view our flat-rate build options or lock in this design directly here: <a href="' + data.claimUrl + '" style="color: #2563eb; font-weight: 600;">Claim &amp; Customize Your Site</a>.</p>' +
      '<p style="margin-top: 28px; margin-bottom: 4px;">Best regards,</p>' +
      '<p style="margin: 0;">' +
        '<strong>Jason Woodrow</strong><br/>' +
        '624 Siteworks | Appleton, WI<br/>' +
        '<a href="' + CONFIG.AGENCY_URL + '" style="color: #2563eb; text-decoration: none;">624siteworks.com</a>' +
      '</p>' +
    '</div>'
  );
}

/* ============================================================================
 * HELPER UTILITIES: WEBSITE EMAIL & FACEBOOK CRAWLER
 * ============================================================================ */

/**
 * Backwards-compatible wrapper that returns only the crawled email string.
 */
function extractEmailFromWebsite_(rawSiteUrl) {
  return crawlWebsiteForContactInfo_(rawSiteUrl).email;
}

/**
 * Crawls /, /contact, /contact-us, and /about on a business's website to extract
 * a valid business email address and Facebook page URL.
 */
function crawlWebsiteForContactInfo_(rawSiteUrl) {
  const result = { email: '', facebook: '' };
  if (!rawSiteUrl) return result;

  let baseUrl = String(rawSiteUrl).trim();
  if (!/^https?:\/\//i.test(baseUrl)) {
    baseUrl = 'https://' + baseUrl;
  }
  baseUrl = baseUrl.replace(/\/+$/, '');

  const paths = ['', '/contact', '/contact-us', '/about'];
  const ignoredExtensions = /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|eot|mp4|pdf)$/i;
  const ignoredDomains = /(sentry\.io|wixpress\.com|example\.com|domain\.com|email\.com|yoursite\.com|wordpress\.org|w3\.org|schema\.org|googleapis\.com)/i;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g;
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi;
  const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i;

  for (let i = 0; i < paths.length; i++) {
    const targetUrl = baseUrl + paths[i];
    try {
      const resp = UrlFetchApp.fetch(targetUrl, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });
      if (resp.getResponseCode() !== 200) continue;

      const html = resp.getContentText();
      if (!html) continue;

      if (!result.facebook) {
        const fbMatch = html.match(fbRegex);
        if (fbMatch && !fbMatch[0].includes('facebook.com/sharer') && !fbMatch[0].includes('facebook.com/tr')) {
          result.facebook = fbMatch[0];
        }
      }

      // 1. Prioritize explicit mailto: links
      let mailtoMatch;
      while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
        const candidate = mailtoMatch[1].trim().toLowerCase();
        if (isValidBusinessEmail_(candidate, ignoredExtensions, ignoredDomains)) {
          result.email = candidate;
          return result;
        }
      }

      // 2. Fallback to general email regex in page source
      const matches = html.match(emailRegex) || [];
      for (let j = 0; j < matches.length; j++) {
        const candidate = matches[j].trim().toLowerCase();
        if (isValidBusinessEmail_(candidate, ignoredExtensions, ignoredDomains)) {
          result.email = candidate;
          return result;
        }
      }
    } catch (e) {
      // Ignore individual page fetch errors and try next path
    }
  }
  return result;
}

function isValidBusinessEmail_(email, ignoredExtensions, ignoredDomains) {
  if (!email || email.length > 80) return false;
  if (ignoredExtensions.test(email)) return false;
  if (ignoredDomains.test(email)) return false;
  if (/^\d+x\d+/i.test(email)) return false;
  return true;
}

/**
 * Formats working_hours object, array, or string into a clean 1-line summary.
 */
function formatWorkingHours_(workingHours) {
  if (!workingHours) return 'Mon-Fri: 7:00 AM - 5:00 PM';
  if (typeof workingHours === 'string') return workingHours;
  if (Array.isArray(workingHours)) return workingHours.join(' | ');
  if (typeof workingHours === 'object') {
    return Object.entries(workingHours)
      .map(([day, hrs]) => day + ': ' + hrs)
      .join(' | ');
  }
  return 'Mon-Fri: 7:00 AM - 5:00 PM';
}

/**
 * Generates a sensible placeholder email if both scraper and website crawler find none.
 */
function buildFallbackEmail_(bizName, domainStatus) {
  if (domainStatus && /^https?:\/\//i.test(domainStatus) && !domainStatus.includes('facebook.com')) {
    try {
      const host = domainStatus.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0];
      if (host && host.includes('.')) {
        return 'info@' + host.toLowerCase();
      }
    } catch (e) {}
  }
  const slug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return 'info@' + (slug || 'business') + '.com';
}
