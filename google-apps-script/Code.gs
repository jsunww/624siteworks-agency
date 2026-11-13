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
 *   Gate 1: scrapeAndAuditLeadsCore(query) -> Audits sites, ranks worst first, sets "1. Scraped"
 *   (Human Review: Change Col R to "Approve Research")
 *   Gate 2: enrichApprovedLeadsCore()     -> Status: "2. Prompt Ready" (Col Q auto-builds prompt)
 *   (Human Build: Paste Col Q into Antigravity IDE, run 624deploy, paste .pages.dev URL in Col T, set Col R to "Ready to Email")
 *   Gate 4: createDraftsCore()             -> Status: "5. Draft Created" (HTML Gmail draft + inline screenshot)
 *
 * WEB APP API ENDPOINTS (Supports 624 LLC Hub at https://624llc.com/624siteworks/):
 *   doGet(e) & doPost(e) with ?action=getPipeline | runGate1 | runGate2 | runGate4 | updateLead | initialize | saveKeys
 * ============================================================================
 */

const CONFIG = {
  SHEET_NAME: 'Prospect Pipeline',
  DEFAULT_SERVICE_AREA: 'Fox Valley & Northeast Wisconsin (Appleton, Neenah, Menasha, Kaukauna, Greenville)',
  MIN_REVIEWS: 0,
  MIN_QUALIFYING_SCORE: 70,
  DEFAULT_SCRAPE_LIMIT: 40,
  GEMINI_MODEL: 'gemini-3.8-flash',
  SENDER_NAME: 'Jason Woodrow',
  SENDER_EMAIL: 'hello@624siteworks.com',
  AGENCY_NAME: '624 Siteworks',
  AGENCY_URL: 'https://624siteworks.com',
  CLAIM_BASE_URL: 'https://624siteworks.com/claim.html',
  AGENCY_PHONE: '(920) 234-5633',
  screenshotBaseUrl: 'https://image.thum.io/get/width/1200/crop/800/noanimate/'
};

/**
 * Column Index Map (1-based for Apps Script getRange)
 * Preserves 624 Siteworks Client Intake Responses (A-Q) + Pipeline Control (R-V)
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
  NOTES: 21,           // Col U
  SITE_ISSUES: 22      // Col V (Diagnostic report + Opportunity Score)
};

const TOTAL_COLS = 22;

const STATUS = {
  SCRAPED: '1. Scraped',
  APPROVE_RESEARCH: 'Approve Research',
  PROMPT_READY: '2. Prompt Ready',
  READY_TO_EMAIL: 'Ready to Email',
  DRAFT_CREATED: '5. Draft Created',
  DISMISSED: 'Dismissed'
};

/* ============================================================================
 * WEB APP HTTP HANDLERS (doGet / doPost) FOR 624 LLC ADMIN HUB
 * ============================================================================ */

function doGet(e) {
  return handleLeadEngineApiRequest_(e && e.parameter ? e.parameter : {});
}

function doPost(e) {
  let params = Object.assign({}, (e && e.parameter) ? e.parameter : {});
  if (e && e.postData && e.postData.contents) {
    try {
      const bodyJson = JSON.parse(e.postData.contents);
      Object.assign(params, bodyJson);
    } catch (err) {
      // Keep URL query parameters if JSON parsing fails
    }
  }
  return handleLeadEngineApiRequest_(params);
}

function handleLeadEngineApiRequest_(params) {
  const action = params.action || 'getPipeline';
  let res = { success: false, error: 'Unknown action' };

  try {
    if (action === 'getPipeline') {
      res = getPipelineLeadsCore();
    } else if (action === 'runGate1') {
      const query = params.query || '';
      if (!query) throw new Error('Search query is required for Gate 1 (e.g. "Concrete contractor, Appleton, WI")');
      res = scrapeAndAuditLeadsCore(query);
    } else if (action === 'runGate2') {
      res = enrichApprovedLeadsCore();
    } else if (action === 'runGate4') {
      res = createDraftsCore();
    } else if (action === 'updateLead') {
      const rowNum = Number(params.rowNumber);
      if (!rowNum || rowNum < 2) throw new Error('Valid rowNumber is required');
      res = updateLeadStatusCore(rowNum, params);
    } else if (action === 'initialize') {
      initializeProspectPipelineSheet();
      res = { success: true, message: 'Prospect Pipeline sheet initialized successfully' };
    } else if (action === 'researchSocials') {
      const bizName = params.bizName || '';
      const city = params.city || '';
      const domain = params.domain || '';
      res = researchBusinessSocialsAndWeb_(bizName, city, domain);
    } else if (action === 'purgeUsableWebsites') {
      res = purgeUsableWebsitesCore();
    } else if (action === 'saveKeys') {
      const props = PropertiesService.getScriptProperties();
      if (params.serperKey) props.setProperty('SERPER_API_KEY', params.serperKey.trim());
      if (params.geminiKey) props.setProperty('GEMINI_API_KEY', params.geminiKey.trim());
      res = { success: true, message: 'API keys saved successfully' };
    } else if (action === 'ping') {
      res = { success: true, status: 'online', timestamp: new Date().toISOString() };
    }
  } catch (err) {
    res = { success: false, error: err.message || String(err) };
  }

  return ContentService.createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Reads all rows from the "Prospect Pipeline" sheet and returns clean JSON.
 */
function getPipelineLeadsCore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = initializeProspectPipelineSheet();
  }

  const lastRow = sheet.getLastRow();
  const props = PropertiesService.getScriptProperties();
  const configInfo = {
    hasSerperKey: Boolean(props.getProperty('SERPER_API_KEY') || props.getProperty('OUTSCRAPER_API_KEY')),
    hasGeminiKey: Boolean(props.getProperty('GEMINI_API_KEY')),
    sheetName: CONFIG.SHEET_NAME,
    spreadsheetUrl: ss.getUrl()
  };

  if (lastRow < 2) {
    return {
      success: true,
      spreadsheetUrl: ss.getUrl(),
      sheetName: CONFIG.SHEET_NAME,
      leads: [],
      stats: { total: 0, scraped: 0, approveResearch: 0, promptReady: 0, readyToEmail: 0, draftCreated: 0, dismissed: 0, skipped: 0 },
      config: configInfo
    };
  }

  // Clear Q2:Q so ARRAYFORMULA in Q1 expands cleanly
  sheet.getRange(2, COL.AI_PROMPT, lastRow - 1, 1).clearContent();
  SpreadsheetApp.flush();

  const values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const leads = [];
  const stats = { total: 0, scraped: 0, approveResearch: 0, promptReady: 0, readyToEmail: 0, draftCreated: 0, dismissed: 0, skipped: 0 };

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    if (!bizName) continue;

    const rowNum = i + 2;
    const status = String(row[COL.LEAD_STATUS - 1] || STATUS.SCRAPED).trim();
    const siteIssues = String(row[COL.SITE_ISSUES - 1] || '').trim();

    let badnessScore = 50;
    const scoreMatch = siteIssues.match(/(\d+)\/100/);
    if (scoreMatch) {
      badnessScore = parseInt(scoreMatch[1], 10);
    }

    stats.total++;
    if (status === STATUS.SCRAPED) stats.scraped++;
    else if (status === STATUS.APPROVE_RESEARCH) stats.approveResearch++;
    else if (status === STATUS.PROMPT_READY) stats.promptReady++;
    else if (status === STATUS.READY_TO_EMAIL) stats.readyToEmail++;
    else if (status === STATUS.DRAFT_CREATED) stats.draftCreated++;
    else if (status === STATUS.DISMISSED || status.includes('Skip') || status.includes('Disqualif')) {
      stats.dismissed++;
      stats.skipped++;
    } else stats.skipped++;

    leads.push({
      rowNumber: rowNum,
      timestamp: row[COL.TIMESTAMP - 1] ? String(row[COL.TIMESTAMP - 1]) : '',
      businessName: bizName,
      serviceArea: String(row[COL.SERVICE_AREA - 1] || ''),
      phone: String(row[COL.PHONE - 1] || ''),
      vibe: String(row[COL.VIBE - 1] || ''),
      services: [
        { name: String(row[COL.SERVICE_1_NAME - 1] || ''), desc: String(row[COL.SERVICE_1_DESC - 1] || '') },
        { name: String(row[COL.SERVICE_2_NAME - 1] || ''), desc: String(row[COL.SERVICE_2_DESC - 1] || '') },
        { name: String(row[COL.SERVICE_3_NAME - 1] || ''), desc: String(row[COL.SERVICE_3_DESC - 1] || '') }
      ],
      logoUrl: String(row[COL.LOGO_URL - 1] || ''),
      domainStatus: String(row[COL.DOMAIN_STATUS - 1] || ''),
      email: String(row[COL.EMAIL - 1] || ''),
      hours: String(row[COL.HOURS - 1] || ''),
      trustFactor: String(row[COL.TRUST_FACTOR - 1] || ''),
      aiPrompt: String(row[COL.AI_PROMPT - 1] || ''),
      leadStatus: status,
      ratingReviews: String(row[COL.RATING_REVIEWS - 1] || ''),
      previewUrl: String(row[COL.PREVIEW_URL - 1] || ''),
      notes: String(row[COL.NOTES - 1] || ''),
      siteIssues: siteIssues,
      badnessScore: badnessScore
    });
  }

  return {
    success: true,
    spreadsheetUrl: ss.getUrl(),
    sheetName: CONFIG.SHEET_NAME,
    leads: leads,
    stats: stats,
    config: configInfo
  };
}

/**
 * Updates status, previewUrl, email, or notes for a specific row in "Prospect Pipeline".
 */
function updateLeadStatusCore(rowNumber, updates) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found');

  const statusVal = updates.status || updates.leadStatus;
  if (statusVal) {
    sheet.getRange(rowNumber, COL.LEAD_STATUS).setValue(statusVal);
  }
  if (updates.previewUrl !== undefined && updates.previewUrl !== null) {
    sheet.getRange(rowNumber, COL.PREVIEW_URL).setValue(updates.previewUrl);
  }
  if (updates.email !== undefined && updates.email !== null) {
    sheet.getRange(rowNumber, COL.EMAIL).setValue(updates.email);
  }
  if (updates.notes !== undefined && updates.notes !== null) {
    sheet.getRange(rowNumber, COL.NOTES).setValue(updates.notes);
  }

  SpreadsheetApp.flush();
  return { success: true, rowNumber: rowNumber };
}

/* ============================================================================
 * GOOGLE SHEETS UI MENU INITIALIZATION
 * ============================================================================ */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('\uD83D\uDE80 624 Lead Engine')
    .addItem('1. Gate 1: Scrape & Audit Local Leads (Ranked Worst First)', 'promptAndScrapeLeads')
    .addItem('2. Gate 2: Enrich Approved Leads (Gemini AI)', 'enrichApprovedLeadsWithAI')
    .addItem('4. Gate 4: Create Gmail Drafts for Previews', 'createDraftsForApprovedBuilds')
    .addSeparator()
    .addItem('Initialize / Repair "Prospect Pipeline" Tab', 'initializeProspectPipelineSheet')
    .addItem('Configure API Keys (Serper & Gemini)', 'configureApiKeysPrompt')
    .addToUi();
}

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
 * Ensures the "Prospect Pipeline" sheet exists with headers A-V, status dropdowns,
 * and the Column Q ARRAYFORMULA.
 */
function initializeProspectPipelineSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
  }
  sheet.activate();

  const headers = [
    'Timestamp',                                  // A (1)
    'Business Name',                              // B (2)
    'Target Service Area (Cities/Counties)',      // C (3)
    'Primary Phone Number',                       // D (4)
    'Brand Colors & Desired "Vibe"',              // E (5)
    'Service 1 Name',                             // F (6)
    'Service 1 Description',                      // G (7)
    'Service 2 Name',                             // H (8)
    'Service 2 Description',                      // I (9)
    'Service 3 Name',                             // J (10)
    'Service 3 Description',                      // K (11)
    'Logo & Brand Images',                        // L (12)
    'Domain Status',                              // M (13)
    'Business Email Address',                     // N (14)
    'Operating Hours',                            // O (15)
    'Primary Trust Factor',                       // P (16)
    'Generated AI Prompt',                        // Q (17)
    'Lead Status',                                // R (18)
    'Google Rating & Reviews',                    // S (19)
    'Spec Preview URL',                           // T (20)
    'Email Sent / Notes',                         // U (21)
    'Website & SEO Issues (Why They Need You)'    // V (22)
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(COL.SITE_ISSUES, 420);

  // Set Column Q Header ArrayFormula so rows 2+ automatically generate the Antigravity prompt immediately
  const promptArrayFormula =
    '=ARRAYFORMULA(IF(ROW(A:A)=1, "Generated AI Prompt", IF(B:B="", "", ' +
    '"Build a high-converting, blazing-fast 4-page static Tailwind CSS website (index.html, services.html, about.html, contact.html) plus llms.txt, sitemap.xml, and robots.txt for " & B:B & ". " & CHAR(10) & CHAR(10) & ' +
    '"BUSINESS PROFILE:" & CHAR(10) & ' +
    '"- Business Name: " & B:B & CHAR(10) & ' +
    '"- Target Service Area: " & C:C & CHAR(10) & ' +
    '"- Phone Number: " & D:D & CHAR(10) & ' +
    '"- Email Address: " & IF(N:N="", "info@" & LOWER(REGEXREPLACE(B:B, "[^a-zA-Z0-9]", "")) & ".com", N:N) & CHAR(10) & ' +
    '"- Operating Hours: " & O:O & CHAR(10) & ' +
    '"- Existing Domain / Reference: " & M:M & CHAR(10) & ' +
    '"- Current Web/SEO Weaknesses to Fix: " & V:V & CHAR(10) & ' +
    '"- Logo URL: " & L:L & CHAR(10) & ' +
    '"- Brand Colors & Vibe: " & IF(E:E="", "Auto-select a bold, trustworthy contractor color palette and modern industrial vibe tailored to their trade", E:E) & CHAR(10) & ' +
    '"- Primary Trust Badge / Subheadline: " & IF(P:P="", S:S & " - Trusted Local Fox Valley Contractor", P:P & " (" & S:S & ")") & CHAR(10) & CHAR(10) & ' +
    '"CORE SERVICES TO FEATURE:" & CHAR(10) & ' +
    'IF(F:F="", "Auto-generate their top 3 highest-margin core services based on their trade (" & S:S & ") with persuasive Fox Valley / Appleton local SEO copy.", ' +
    '"1. " & F:F & ": " & G:G & CHAR(10) & "2. " & H:H & ": " & I:I & CHAR(10) & "3. " & J:J & ": " & K:K) & CHAR(10) & CHAR(10) & ' +
    '"MANDATORY TECHNICAL, SEO, ACCESSIBILITY & AI/VOICE SEARCH REQUIREMENTS:" & CHAR(10) & ' +
    '"1. Mobile-First Conversion Design & Form Routing: Pure static HTML5 + Tailwind CSS via CDN, sticky header with click-to-call phone button (" & D:D & "), and accessible lead-capture forms. Copy functions/api/contact.js from F:\\\\624 SITEWORKS\\\\My Sites\\\\624siteworks.com\\\\functions\\\\api\\\\contact.js into the project\'s functions/api/contact.js folder and wire all forms to POST JSON via fetch(\'/api/contact\') so submissions deliver via Zoho Mail API to \'hello@624siteworks.com\' during the spec preview phase (with a comment to swap DEFAULT_RECIPIENT to \'" & IF(N:N="", "info@" & LOWER(REGEXREPLACE(B:B, "[^a-zA-Z0-9]", "")) & ".com", N:N) & "\' when the client claims the site)." & CHAR(10) & ' +
    '"2. Full Technical & Local SEO: Unique keyword-rich <title> and <meta name=""description""> on all 4 pages, canonical tags, Open Graph (og:*), Twitter Cards, local geo meta tags (geo.region=""US-WI"", geo.placename), sitemap.xml, robots.txt, and rich JSON-LD @graph (LocalBusiness/HomeAndConstructionBusiness, OfferCatalog/Service, BreadcrumbList)." & CHAR(10) & ' +
    '"3. WCAG 2.1 AA Accessibility Compliance: Include a Skip-to-Main-Content link, semantic HTML5 landmarks (<header>, <nav>, <main>, <footer>), explicit <label for> and aria-required on all form fields, aria-expanded/aria-controls on mobile menu buttons, visible keyboard focus rings, descriptive image alt text, and >= 4.5:1 color contrast ratios." & CHAR(10) & ' +
    '"4. AI Search (GEO/AEO) & Voice Search Optimization: Include a direct-answer summary paragraph (#ai-summary), a natural-language conversational FAQ section (#voice-faq) with matching FAQPage and SpeakableSpecification JSON-LD schema, and generate an llms.txt structured Markdown fact sheet in the root directory for AI search engines (ChatGPT, Perplexity, Google AI Overviews, Siri/Alexa)." & CHAR(10) & ' +
    '"5. 624 Siteworks Preview Banner: Copy preview-banner.js into assets/preview-banner.js and include right before </body> on every page: <script src=""assets/preview-banner.js"" data-business=""" & B:B & """ defer></script>")))';

  if (sheet.getMaxRows() >= 2) {
    sheet.getRange(2, COL.AI_PROMPT, sheet.getMaxRows() - 1, 1).clearContent();
  }
  sheet.getRange('Q1').setFormula(promptArrayFormula);

  return sheet;
}

/* ============================================================================
 * GATE 1: SCRAPE, AUDIT & RANK LOCAL LEADS BY WORST WEB / SEO PRESENCE
 * ============================================================================ */

function promptAndScrapeLeads() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const serperKey = props.getProperty('SERPER_API_KEY');
  const outscraperKey = props.getProperty('OUTSCRAPER_API_KEY');

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
    'Gate 1: Scrape & Audit Local Leads via ' + providerLabel,
    'Enter Google Maps search query (e.g., "Concrete contractor, Appleton, WI"):',
    ui.ButtonSet.OK_CANCEL
  );
  if (promptResp.getSelectedButton() !== ui.Button.OK) return;

  const query = promptResp.getResponseText().trim();
  if (!query) {
    ui.alert('Please provide a non-empty search query.');
    return;
  }

  try {
    const res = scrapeAndAuditLeadsCore(query);
    ui.alert(
      'Gate 1 Complete (' + res.provider + ')',
      'Added & audited ' + res.insertedCount + ' leads in "' + CONFIG.SHEET_NAME + '".\n' +
      'Ranked from WORST web/SEO presence (#1 at top) to best!\n' +
      'Check Column V ("Website & SEO Issues") to see exactly what is wrong with each site.\n' +
      'Website crawler also extracted ' + res.crawledEmailCount + ' email(s).',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Scraper Error:\n' + err.message);
  }
}

/**
 * Core Gate 1 implementation: Callable both from spreadsheet UI and from Web App API.
 */
function scrapeAndAuditLeadsCore(query) {
  const props = PropertiesService.getScriptProperties();
  let serperKey = props.getProperty('SERPER_API_KEY');
  const outscraperKey = props.getProperty('OUTSCRAPER_API_KEY');

  if (!serperKey && outscraperKey && /^[a-f0-9]{32,64}$/i.test(outscraperKey.trim())) {
    serperKey = outscraperKey.trim();
    props.setProperty('SERPER_API_KEY', serperKey);
    props.deleteProperty('OUTSCRAPER_API_KEY');
  }

  if (!serperKey && !outscraperKey) {
    throw new Error('Missing Scraper API Key. Configure SERPER_API_KEY in ScriptProperties.');
  }

  const providerLabel = serperKey ? 'Serper.dev (Free Tier)' : 'Outscraper';
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME) || initializeProspectPipelineSheet();

  if (String(sheet.getRange(1, COL.SITE_ISSUES).getValue()).trim() === '') {
    initializeProspectPipelineSheet();
  }

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
  if (serperKey) {
    normalizedPlaces = fetchLeadsFromSerper_(serperKey, query);
  } else {
    normalizedPlaces = fetchLeadsFromOutscraper_(outscraperKey, query);
  }

  if (!normalizedPlaces.length) {
    return { success: true, insertedCount: 0, crawledEmailCount: 0, leads: [], message: 'No businesses returned for query.' };
  }

  const scoredCandidates = [];
  let crawledEmailCount = 0;
  let skippedUsableCount = 0;

  // Prioritize auditing businesses with no site, Facebook/social URLs, plain HTTP, or free subdomains first
  normalizedPlaces.sort((a, b) => {
    const scorePriority = (item) => {
      const s = (item.site || '').toLowerCase();
      if (!s) return 100;
      if (/(facebook\.com|fb\.com|instagram\.com|yelp\.com|nextdoor\.com|angi\.com|homeadvisor\.com|bbb\.org|linktr\.ee|business\.site)/i.test(s)) return 95;
      if (/(wixsite\.com|godaddysites\.com|weebly\.com|wordpress\.com|blogspot\.com|angelfire\.com|tripod\.com)/i.test(s)) return 85;
      if (s.startsWith('http://')) return 75;
      return 10;
    };
    return scorePriority(b) - scorePriority(a);
  });

  const startTimeMs = new Date().getTime();

  for (let i = 0; i < normalizedPlaces.length; i++) {
    // Guard against Google Apps Script 6-minute execution limit (stop auditing after 240s)
    if (new Date().getTime() - startTimeMs > 240000) break;

    const item = normalizedPlaces[i];
    const bizName = (item.name || '').trim();
    const reviewsCount = Number(item.reviews || 0);

    if (!bizName) continue;
    // Skip national franchises or chains without local phone numbers if needed
    if (!item.phone && !item.site && !item.facebook) continue;
    if (existingNames.has(bizName.toLowerCase())) continue;

    existingNames.add(bizName.toLowerCase());

    const siteUrl = (item.site || '').trim();
    let fbUrl = (item.facebook || '').trim();
    let email = (item.email || '').trim();
    const logoUrl = (item.logo || '').trim();

    const audit = auditWebsiteAndSeoPresence_({
      bizName: bizName,
      siteUrl: siteUrl,
      fbUrl: fbUrl,
      reviewsCount: reviewsCount,
      rating: item.rating,
      workingHours: item.working_hours,
      query: query
    });

    // STRICT FILTER: Only insert prospects that are Facebook-only, No Website, Broken/Parked, or Really Bad (score >= 70)
    if (!audit.isQualifiedProspect || audit.badnessScore < (CONFIG.MIN_QUALIFYING_SCORE || 70)) {
      skippedUsableCount++;
      continue;
    }

    if (!email && audit.email) {
      email = audit.email;
      crawledEmailCount++;
    }
    if (!fbUrl && audit.facebook) {
      fbUrl = audit.facebook;
    }

    const domainStatus = audit.verifiedUrl || siteUrl || fbUrl || 'No Website Listed';
    const hoursStr = formatWorkingHours_(item.working_hours);
    const ratingVal = item.rating ? Number(item.rating).toFixed(1) : '5.0';
    const tradeType = item.type || query.split(',')[0].trim();
    const ratingBadge = ratingVal + ' \u2605 (' + reviewsCount + ' reviews) - ' + tradeType;

    const row = new Array(TOTAL_COLS).fill('');
    row[COL.TIMESTAMP - 1] = new Date();
    row[COL.BUSINESS_NAME - 1] = bizName;
    row[COL.SERVICE_AREA - 1] = CONFIG.DEFAULT_SERVICE_AREA;
    row[COL.PHONE - 1] = item.phone || '';
    row[COL.LOGO_URL - 1] = logoUrl;
    row[COL.DOMAIN_STATUS - 1] = domainStatus;
    row[COL.EMAIL - 1] = email || 'No email found';
    row[COL.HOURS - 1] = hoursStr;
    row[COL.LEAD_STATUS - 1] = STATUS.SCRAPED;
    row[COL.RATING_REVIEWS - 1] = ratingBadge;
    row[COL.SITE_ISSUES - 1] = audit.reportText;

    scoredCandidates.push({
      badnessScore: audit.badnessScore,
      row: row
    });
  }

  if (!scoredCandidates.length) {
    return {
      success: true,
      insertedCount: 0,
      skippedUsableCount: skippedUsableCount,
      crawledEmailCount: 0,
      leads: [],
      message: 'Audited ' + normalizedPlaces.length + ' businesses (' + skippedUsableCount + ' skipped because they already have usable websites).'
    };
  }

  scoredCandidates.sort((a, b) => b.badnessScore - a.badnessScore);
  const rowsToInsert = scoredCandidates.map(c => c.row);

  const startRow = lastPopulatedRow + 1;
  const leftCols = rowsToInsert.map(r => r.slice(0, 16));    // Cols A-P (1..16)
  const rightCols = rowsToInsert.map(r => r.slice(17, 22));  // Cols R-V (18..22)

  sheet.getRange(startRow, 1, rowsToInsert.length, 16).setValues(leftCols);
  sheet.getRange(startRow, 18, rowsToInsert.length, 5).setValues(rightCols);

  if (sheet.getMaxRows() >= 2) {
    sheet.getRange(2, COL.AI_PROMPT, sheet.getMaxRows() - 1, 1).clearContent();
  }

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
  sheet.getRange(startRow, COL.LEAD_STATUS, rowsToInsert.length, 1).setDataValidation(statusRule);

  const issueColors = scoredCandidates.map(c => {
    if (c.badnessScore >= 75) return ['#fee2e2'];
    if (c.badnessScore >= 45) return ['#fef3c7'];
    return ['#f1f5f9'];
  });
  sheet.getRange(startRow, COL.SITE_ISSUES, rowsToInsert.length, 1).setBackgrounds(issueColors);
  SpreadsheetApp.flush();

  return {
    success: true,
    provider: providerLabel,
    insertedCount: rowsToInsert.length,
    skippedUsableCount: skippedUsableCount,
    crawledEmailCount: crawledEmailCount,
    leads: scoredCandidates.map((c, idx) => ({
      rowNumber: startRow + idx,
      businessName: c.row[COL.BUSINESS_NAME - 1],
      phone: c.row[COL.PHONE - 1],
      email: c.row[COL.EMAIL - 1],
      domainStatus: c.row[COL.DOMAIN_STATUS - 1],
      ratingReviews: c.row[COL.RATING_REVIEWS - 1],
      siteIssues: c.row[COL.SITE_ISSUES - 1],
      badnessScore: c.badnessScore,
      leadStatus: c.row[COL.LEAD_STATUS - 1]
    }))
  };
}

/**
 * Audits a business's website and search engine presence.
 * STRICT QUALIFICATION GATE:
 * Only qualifies businesses that:
 *   1. Have NO website listed on Google Maps
 *   2. Are Facebook-only / Social-only / Directory-only
 *   3. Have a BROKEN, DEAD, PARKED, EXPIRED, or UNDER-CONSTRUCTION website
 *   4. Have a REALLY BAD website (HTTP-only with broken SSL, amateur free subdomain,
 *      not mobile-friendly / missing viewport, or severely outdated / empty skeleton page)
 * Businesses with working, mobile-friendly HTTPS websites are marked isQualifiedProspect: false and skipped.
 */
function auditWebsiteAndSeoPresence_(info) {
  let score = 0;
  const issues = [];
  let foundEmail = '';
  let foundFacebook = '';

  const rawSite = (info.siteUrl || '').trim();
  const isSocialOrDirectoryOnly = /(facebook\.com|fb\.com|instagram\.com|yelp\.com|nextdoor\.com|angi\.com|homeadvisor\.com|bbb\.org|linktr\.ee|business\.site|yellowpages\.com|manta\.com|thumbtack\.com)/i.test(rawSite) || (!rawSite && info.fbUrl);

  // 1. NO WEBSITE AT ALL
  if (!rawSite && !info.fbUrl) {
    score = 96;
    issues.push('NO WEBSITE: Zero website listed on Google Maps (relying only on word-of-mouth)');
    return finalizeAuditReport_(score, issues, foundEmail, foundFacebook, 'No Website Listed', true);
  }

  // 2. FACEBOOK-ONLY OR SOCIAL/DIRECTORY LINK AS WEBSITE
  if (isSocialOrDirectoryOnly) {
    score = 92;
    const socialUrl = rawSite || info.fbUrl;
    if (/facebook\.com|fb\.com/i.test(socialUrl)) {
      issues.push('FACEBOOK-ONLY: Using a Facebook page instead of a real website');
    } else if (/business\.site/i.test(socialUrl)) {
      issues.push('DEAD GOOGLE BUSINESS SITE: Using shut-down Google .business.site link');
    } else {
      issues.push('NO REAL WEBSITE: Linking to a directory/social profile (' + socialUrl.slice(0, 45) + ') instead of a website');
    }
    return finalizeAuditReport_(score, issues, foundEmail, socialUrl, socialUrl, true);
  }

  // Check if URL is an amateur free builder subdomain
  const isFreeSubdomain = /(wixsite\.com|godaddysites\.com|weebly\.com|wordpress\.com|blogspot\.com|mysite\.com|angelfire\.com|tripod\.com|squarespace\.com|webnode\.com|jimdofree\.com|yolasite\.com|bravesites\.com)/i.test(rawSite);

  let cleanDomain = rawSite.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  };

  let baseUrl = 'https://' + cleanDomain;
  let hasWorkingHttps = false;
  let homeHtml = '';
  let homeStatus = 0;
  let isStrictHttpOnly = false;

  // Helper to test HTTPS on given host path
  const tryFetchUrl = (urlToTry, validateCert) => {
    return UrlFetchApp.fetch(urlToTry, {
      method: 'get',
      headers: fetchHeaders,
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: validateCert
    });
  };

  // 3A. Test HTTPS (try exact domain first, then www. if bare domain fails SSL)
  try {
    const httpsResp = tryFetchUrl('https://' + cleanDomain, true);
    const status = httpsResp.getResponseCode();
    const content = httpsResp.getContentText() || '';
    if (status >= 200 && status < 400 && content.length > 200) {
      hasWorkingHttps = true;
      homeStatus = status;
      homeHtml = content;
      baseUrl = 'https://' + cleanDomain;
    } else {
      homeStatus = status;
      homeHtml = content;
    }
  } catch (sslErr1) {
    // If bare domain failed SSL handshake, try www. prefix over HTTPS before declaring SSL broken
    if (!cleanDomain.toLowerCase().startsWith('www.')) {
      try {
        const wwwResp = tryFetchUrl('https://www.' + cleanDomain, true);
        const status2 = wwwResp.getResponseCode();
        const content2 = wwwResp.getContentText() || '';
        if (status2 >= 200 && status2 < 400 && content2.length > 200) {
          hasWorkingHttps = true;
          homeStatus = status2;
          homeHtml = content2;
          baseUrl = 'https://www.' + cleanDomain;
        }
      } catch (sslErr2) {
        hasWorkingHttps = false;
      }
    }
  }

  // 3B. If HTTPS failed completely, fallback to HTTP
  if (!hasWorkingHttps && homeStatus === 0) {
    try {
      const httpResp = tryFetchUrl('http://' + cleanDomain, false);
      homeStatus = httpResp.getResponseCode();
      homeHtml = httpResp.getContentText() || '';
      baseUrl = 'http://' + cleanDomain;
      isStrictHttpOnly = true;
    } catch (httpErr) {
      score = 94;
      issues.push('BROKEN WEBSITE: Website link on Google Maps is dead, expired, or unreachable');
      return finalizeAuditReport_(score, issues, foundEmail, foundFacebook, rawSite, true);
    }
  }

  // Extract contact email / Facebook from HTML if any HTML was returned
  const ignoredExtensions = /\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|eot|mp4|pdf)$/i;
  const ignoredDomains = /(sentry\.io|wixpress\.com|example\.com|domain\.com|email\.com|yoursite\.com|wordpress\.org|w3\.org|schema\.org|googleapis\.com)/i;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g;
  const mailtoRegex = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi;
  const fbRegex = /https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i;

  if (homeHtml) {
    const extractedHome = extractContactFromHtml_(homeHtml, ignoredExtensions, ignoredDomains, emailRegex, mailtoRegex, fbRegex);
    foundEmail = extractedHome.email;
    foundFacebook = extractedHome.facebook;
  }

  // Guard: If HTTP 403/503 is just a Cloudflare bot challenge on a live HTTPS site, treat as a working site (skip!)
  const isCloudflareChallenge = (homeStatus === 403 || homeStatus === 503) && hasWorkingHttps && /cloudflare|cf-browser-verification|Just a moment\.\.\.|Attention Required!/i.test(homeHtml);
  if (isCloudflareChallenge) {
    return finalizeAuditReport_(10, ['USABLE WEBSITE (Cloudflare Protected) - Skip'], foundEmail, foundFacebook, baseUrl, false);
  }

  // 4. BROKEN HTTP STATUS OR EMPTY SITE
  if (homeStatus >= 400 || !homeHtml || homeHtml.length < 300) {
    score = 90;
    issues.push('BROKEN / EMPTY WEBSITE: Website returned HTTP ' + (homeStatus || 'Error') + ' or blank page');
    return finalizeAuditReport_(score, issues, foundEmail, foundFacebook, baseUrl, true);
  }

  // 5. PARKED / EXPIRED / UNDER CONSTRUCTION / SUSPENDED DOMAIN DETECTION
  const visibleText = homeHtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const titleAndH1Text = ((homeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '') + ' ' +
    ((homeHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');

  const hardParkedRegex = /(domain is parked|parked free|courtesy of godaddy|sedoparking|hugedomains|afternic|this domain may be for sale|buy this domain|website expired|this site is currently unavailable|account suspended|cgi-sys\/suspendedpage|default web site page|future home of something quite cool|deployment not found|this wix site is not yet published)/i;
  const placeholderRegex = /(website coming soon|^coming soon$|under construction|site not found)/i;
  const isParkedOrPlaceholder = hardParkedRegex.test(homeHtml) || hardParkedRegex.test(visibleText) ||
    placeholderRegex.test(titleAndH1Text) || (visibleText.length < 1500 && placeholderRegex.test(visibleText));

  if (isParkedOrPlaceholder) {
    score = 90;
    issues.push('PARKED / EXPIRED / UNDER CONSTRUCTION: Domain shows a parked, expired, or "Coming Soon" placeholder page');
    return finalizeAuditReport_(score, issues, foundEmail, foundFacebook, baseUrl, true);
  }

  // 6. EVALUATE GENUINELY BAD / UNUSABLE WEBSITE CRITERIA
  let hasMajorDefect = false;

  // Defect A: Insecure HTTP-Only (No working SSL certificate)
  if (isStrictHttpOnly || !hasWorkingHttps) {
    score += 78;
    hasMajorDefect = true;
    issues.push('NOT SECURE (HTTP-ONLY): Missing SSL certificate (browsers show "Not Secure" warning to customers)');
  }

  // Defect B: Amateur Free Subdomain (.wixsite.com, .weebly.com, .godaddysites.com, etc.)
  if (isFreeSubdomain) {
    score += 78;
    hasMajorDefect = true;
    issues.push('FREE SUBDOMAIN: Using an amateur free builder subdomain (' + cleanDomain + ') instead of a custom domain');
  }

  // Defect C: Not Mobile-Friendly (Missing viewport meta tag)
  const hasViewport = /<meta[^>]+name=["']?viewport["']?/i.test(homeHtml);
  if (!hasViewport) {
    score += 78;
    hasMajorDefect = true;
    issues.push('NOT MOBILE-FRIENDLY: Missing mobile viewport tag (renders as broken desktop layout on phones)');
  }

  // Defect D: Severely Outdated 1990s/2000s HTML or Empty Skeleton Page (< 300 chars of real text)
  const hasObsoleteMarkup = /(<frameset|<frame\s|<marquee|ShockwaveFlash|Microsoft FrontPage|Adobe GoLive|Claris Home Page)/i.test(homeHtml);
  const isSkeletonPage = visibleText.length < 300;
  const hasAncientCopyrightOnly = /(?:copyright|\u00A9|&copy;)\s*(?:199\d|200\d|201[0-7])\b/i.test(homeHtml) && !/202[0-6]/.test(homeHtml);

  if (hasObsoleteMarkup) {
    score += 78;
    hasMajorDefect = true;
    issues.push('ANCIENT HTML: Built with obsolete 1990s/2000s web markup (framesets/Flash/FrontPage)');
  } else if (isSkeletonPage) {
    score += 75;
    hasMajorDefect = true;
    issues.push('EMPTY / SKELETON SITE: Homepage has almost zero text content (' + visibleText.length + ' chars)');
  } else if (hasAncientCopyrightOnly && !/href=["']tel:/i.test(homeHtml)) {
    score += 75;
    hasMajorDefect = true;
    issues.push('ABANDONED / OUTDATED SITE: Outdated pre-2018 copyright & no mobile click-to-call');
  }

  // If the website has NO major defects, it is a USABLE WEBSITE -> Disqualify & Skip!
  if (!hasMajorDefect) {
    return finalizeAuditReport_(15, ['USABLE WEBSITE: Has working HTTPS, custom domain, mobile viewport, and active content (Skip)'], foundEmail, foundFacebook, baseUrl, false);
  }

  // Add secondary context notes ONLY for already-qualified bad sites (to enrich the pitch)
  if (!/href=["']tel:/i.test(homeHtml)) {
    score += 6;
    issues.push('NO CLICK-TO-CALL: Phone number is not tappable on mobile');
  }
  if (!/<h1[\s>]/i.test(homeHtml)) {
    score += 5;
    issues.push('MISSING H1 HEADING: Weak search engine structure');
  }

  // Crawl /contact or /about to find email for qualified prospects only
  if (!foundEmail) {
    const subpaths = ['/contact', '/contact-us', '/about'];
    for (let i = 0; i < subpaths.length; i++) {
      try {
        const subResp = tryFetchUrl(baseUrl + subpaths[i], false);
        if (subResp.getResponseCode() === 200) {
          const subExtracted = extractContactFromHtml_(
            subResp.getContentText() || '',
            ignoredExtensions,
            ignoredDomains,
            emailRegex,
            mailtoRegex,
            fbRegex
          );
          if (subExtracted.email) {
            foundEmail = subExtracted.email;
            break;
          }
          if (!foundFacebook && subExtracted.facebook) {
            foundFacebook = subExtracted.facebook;
          }
        }
      } catch (e) {}
    }
  }

  return finalizeAuditReport_(score, issues, foundEmail, foundFacebook, baseUrl, true);
}

function finalizeAuditReport_(rawScore, issues, email, facebook, verifiedUrl, isQualifiedProspect) {
  const cappedScore = isQualifiedProspect ? Math.max(70, Math.min(100, rawScore)) : Math.min(30, rawScore);
  let tierLabel = 'USABLE SITE - SKIP';
  if (isQualifiedProspect) {
    tierLabel = cappedScore >= 85 ? 'HOT PROSPECT' : 'QUALIFIED BAD SITE';
  }

  const summary = issues.length
    ? issues.join(' | ')
    : 'Usable website (Skip)';

  return {
    isQualifiedProspect: Boolean(isQualifiedProspect),
    badnessScore: cappedScore,
    reportText: '[' + tierLabel + ' - ' + cappedScore + '/100] ' + summary,
    email: email,
    facebook: facebook,
    verifiedUrl: verifiedUrl || ''
  };
}

/**
 * Purges / deletes unbuilt rows from "Prospect Pipeline" that already have usable websites,
 * and marks any previously drafted usable-website rows as "Skip / Disqualified".
 */
function purgeUsableWebsitesCore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) return { success: true, removedCount: 0, message: 'Sheet not found' };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { success: true, removedCount: 0, message: 'No rows to purge' };

  const values = sheet.getRange(2, 1, lastRow - 1, TOTAL_COLS).getValues();
  const rowsToDelete = [];
  let markedSkipCount = 0;

  // Real qualifying defect keywords
  const qualifyingDefectRegex = /(NO WEBSITE|FACEBOOK-ONLY|NO REAL WEBSITE|DEAD GOOGLE BUSINESS SITE|BROKEN|EMPTY|PARKED|EXPIRED|UNDER CONSTRUCTION|NOT SECURE|HTTP-ONLY|FREE SUBDOMAIN|NOT MOBILE-FRIENDLY|ANCIENT HTML|SKELETON SITE|ABANDONED)/i;

  for (let i = values.length - 1; i >= 0; i--) {
    const rowNum = i + 2;
    const row = values[i];
    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    const domainStatus = String(row[COL.DOMAIN_STATUS - 1] || '').trim();
    const siteIssues = String(row[COL.SITE_ISSUES - 1] || '').trim();
    const previewUrl = String(row[COL.PREVIEW_URL - 1] || '').trim();

    const scoreMatch = siteIssues.match(/(\d+)\/100/);
    const rowScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;

    const isNoSiteOrFb = !domainStatus || /no website|facebook\.com|fb\.com|instagram\.com|yelp\.com|business\.site/i.test(domainStatus);
    let isQualified = isNoSiteOrFb;

    if (!isNoSiteOrFb && !previewUrl) {
      // Live re-audit custom domains on unbuilt rows so legacy http:// rows that actually redirect to working https:// sites are purged
      const reAudit = auditWebsiteAndSeoPresence_({
        bizName: bizName,
        siteUrl: domainStatus,
        fbUrl: '',
        reviewsCount: 10
      });
      isQualified = reAudit.isQualifiedProspect && reAudit.badnessScore >= 70;
    } else if (!isNoSiteOrFb && previewUrl) {
      isQualified = rowScore >= 70 && qualifyingDefectRegex.test(siteIssues) && !/WORDPRESS SITE|TEMPLATE BUILDER: Built on Squarespace|BLOATED BUILDER: Built on Wix/i.test(siteIssues);
    }

    if (!isQualified) {
      if (!previewUrl) {
        rowsToDelete.push(rowNum);
      } else {
        sheet.getRange(rowNum, COL.LEAD_STATUS).setValue('Skip / Disqualified');
        markedSkipCount++;
      }
    }
  }

  for (let j = 0; j < rowsToDelete.length; j++) {
    sheet.deleteRow(rowsToDelete[j]);
  }

  SpreadsheetApp.flush();
  return {
    success: true,
    deletedRowCount: rowsToDelete.length,
    markedSkipCount: markedSkipCount
  };
}

function extractContactFromHtml_(html, ignoredExtensions, ignoredDomains, emailRegex, mailtoRegex, fbRegex) {
  const out = { email: '', facebook: '' };
  if (!html) return out;

  const fbMatch = html.match(fbRegex);
  if (fbMatch && !fbMatch[0].includes('facebook.com/sharer') && !fbMatch[0].includes('facebook.com/tr')) {
    out.facebook = fbMatch[0];
  }

  let mailtoMatch;
  mailtoRegex.lastIndex = 0;
  while ((mailtoMatch = mailtoRegex.exec(html)) !== null) {
    const candidate = mailtoMatch[1].trim().toLowerCase();
    if (isValidBusinessEmail_(candidate, ignoredExtensions, ignoredDomains)) {
      out.email = candidate;
      return out;
    }
  }

  const matches = html.match(emailRegex) || [];
  for (let j = 0; j < matches.length; j++) {
    const candidate = matches[j].trim().toLowerCase();
    if (isValidBusinessEmail_(candidate, ignoredExtensions, ignoredDomains)) {
      out.email = candidate;
      return out;
    }
  }

  return out;
}

function fetchLeadsFromSerper_(apiKey, query) {
  const allPlaces = [];
  const seenTitles = new Set();

  // Fetch up to 3 pages (up to 60 local businesses) from Google Maps via Serper
  // because Page 1 is dominated by companies with good websites, while Pages 2-3
  // have the highest concentration of Facebook-only, No-Website, and Broken-Site contractors!
  for (let pageNum = 1; pageNum <= 3; pageNum++) {
    try {
      const resp = UrlFetchApp.fetch('https://google.serper.dev/maps', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-API-KEY': apiKey },
        payload: JSON.stringify({ q: query, gl: 'us', hl: 'en', page: pageNum }),
        muteHttpExceptions: true
      });

      const code = resp.getResponseCode();
      const text = resp.getContentText();
      if (code < 200 || code >= 300) {
        if (pageNum === 1) {
          throw new Error('Serper.dev HTTP ' + code + ': ' + text.slice(0, 300));
        }
        break;
      }

      const data = JSON.parse(text);
      const places = Array.isArray(data.places) ? data.places : [];
      if (!places.length) break;

      for (let i = 0; i < places.length; i++) {
        const p = places[i];
        const titleKey = String(p.title || '').trim().toLowerCase();
        if (!titleKey || seenTitles.has(titleKey)) continue;
        seenTitles.add(titleKey);

        allPlaces.push({
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
        });
      }
    } catch (err) {
      if (pageNum === 1) throw err;
      break;
    }
  }

  return allPlaces;
}

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
 * GATE 2: ENRICH APPROVED LEADS WITH GEMINI AI
 * ============================================================================ */

function enrichApprovedLeadsWithAI() {
  const ui = SpreadsheetApp.getUi();
  try {
    const res = enrichApprovedLeadsCore();
    let summary = 'Gate 2 Complete: Enriched ' + res.enrichedCount + ' lead(s) to "' + STATUS.PROMPT_READY + '".\n' +
      'Column Q now contains the ready-to-paste Antigravity IDE (Gemini 4 Argon) prompt!';
    if (res.errors && res.errors.length) {
      summary += '\n\nErrors (' + res.errors.length + '):\n' + res.errors.join('\n');
    }
    ui.alert(summary);
  } catch (err) {
    ui.alert('Gate 2 Error:\n' + err.message);
  }
}

/**
 * Core Gate 2 implementation: Callable both from spreadsheet UI and from Web App API.
 */
function enrichApprovedLeadsCore() {
  const geminiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY') || '';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, enrichedCount: 0, message: 'No rows in sheet' };
  }

  if (sheet.getMaxRows() >= 2) {
    sheet.getRange(2, COL.AI_PROMPT, sheet.getMaxRows() - 1, 1).clearContent();
  }

  const colB = sheet.getRange(2, COL.BUSINESS_NAME, Math.max(sheet.getLastRow() - 1, 1), 1).getValues();
  let actualNumRows = 0;
  for (let r = 0; r < colB.length; r++) {
    if (String(colB[r][0] || '').trim() !== '') {
      actualNumRows = r + 1;
    }
  }
  if (actualNumRows === 0) {
    return { success: true, enrichedCount: 0, message: 'No populated rows found' };
  }

  const values = sheet.getRange(2, 1, actualNumRows, TOTAL_COLS).getValues();
  let enrichedCount = 0;
  const errors = [];
  const enrichedBizNames = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 2;
    const status = String(row[COL.LEAD_STATUS - 1] || '').trim();

    if (status !== STATUS.APPROVE_RESEARCH) continue;

    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    if (!bizName) continue;

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

      sheet.getRange(rowNumber, COL.VIBE).setValue(aiData.vibe || '');
      sheet.getRange(rowNumber, COL.SERVICE_1_NAME).setValue(aiData.service1Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_1_DESC).setValue(aiData.service1Desc || '');
      sheet.getRange(rowNumber, COL.SERVICE_2_NAME).setValue(aiData.service2Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_2_DESC).setValue(aiData.service2Desc || '');
      sheet.getRange(rowNumber, COL.SERVICE_3_NAME).setValue(aiData.service3Name || '');
      sheet.getRange(rowNumber, COL.SERVICE_3_DESC).setValue(aiData.service3Desc || '');

      if (!existingEmail || existingEmail === 'No email found') {
        sheet.getRange(rowNumber, COL.EMAIL).setValue('No email found');
      }

      sheet.getRange(rowNumber, COL.TRUST_FACTOR).setValue(aiData.trustFactor || '');
      sheet.getRange(rowNumber, COL.LEAD_STATUS).setValue(STATUS.PROMPT_READY);

      enrichedCount++;
      enrichedBizNames.push(bizName);
      SpreadsheetApp.flush();
    } catch (err) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): ' + err.message);
    }
  }

  return {
    success: true,
    enrichedCount: enrichedCount,
    enrichedBizNames: enrichedBizNames,
    errors: errors
  };
}

function callGeminiForLeadEnrichment_(apiKey, context) {
  if (apiKey) {
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

    const modelsToTry = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    for (let m = 0; m < modelsToTry.length; m++) {
      try {
        const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + modelsToTry[m] + ':generateContent?key=' + encodeURIComponent(apiKey);
        const resp = UrlFetchApp.fetch(url, {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(requestBody),
          muteHttpExceptions: true
        });

        const code = resp.getResponseCode();
        if (code >= 200 && code < 300) {
          const parsed = JSON.parse(resp.getContentText());
          const rawJson = parsed.candidates
            && parsed.candidates[0]
            && parsed.candidates[0].content
            && parsed.candidates[0].content.parts
            && parsed.candidates[0].content.parts[0]
            && parsed.candidates[0].content.parts[0].text;
          if (rawJson) {
            return JSON.parse(rawJson);
          }
        }
      } catch (e) {}
    }
  }

  const tradePart = (context.ratingBadge.split('-')[1] || 'Local Service Contractor').trim();
  const ratingPart = (context.ratingBadge.split('-')[0] || 'Top-Rated').trim();
  return {
    vibe: 'Bold, high-contrast modern contractor palette tailored for ' + tradePart + ' (Gemini 4 Argon in Antigravity IDE will research ' + context.bizName + ' and select exact brand colors)',
    service1Name: 'Primary ' + tradePart + ' Services',
    service1Desc: 'Residential and commercial ' + tradePart.toLowerCase() + ' solutions across Appleton and the Fox Valley. (Gemini 4 Argon will tailor to ' + context.bizName + '\'s exact specialties.)',
    service2Name: 'Custom Installations & Upgrades',
    service2Desc: 'Built to withstand Northeast Wisconsin weather with premium materials and expert local craftsmanship.',
    service3Name: 'Repairs, Maintenance & Free Estimates',
    service3Desc: 'Fast, responsive scheduling and transparent upfront pricing throughout Appleton, Neenah, Menasha, Kaukauna, and Greenville.',
    trustFactor: 'Rated ' + ratingPart + ' on Google by Fox Valley Homeowners & Businesses'
  };
}

/* ============================================================================
 * GATE 4: CREATE HTML GMAIL DRAFTS WITH EMBEDDED SCREENSHOTS OF .PAGES.DEV
 * ============================================================================ */

function createDraftsForApprovedBuilds() {
  const ui = SpreadsheetApp.getUi();
  try {
    const res = createDraftsCore();
    let msg = 'Gate 4 Complete: Created ' + res.draftCount + ' HTML Gmail draft(s) with embedded preview screenshots.';
    if (res.errors && res.errors.length) {
      msg += '\n\nSkipped / Errors (' + res.errors.length + '):\n' + res.errors.join('\n');
    }
    ui.alert(msg);
  } catch (err) {
    ui.alert('Gate 4 Error:\n' + err.message);
  }
}

/**
 * Core Gate 4 implementation: Callable both from spreadsheet UI and from Web App API.
 */
function createDraftsCore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) {
    return { success: true, draftCount: 0, message: 'No rows in sheet' };
  }

  if (sheet.getMaxRows() >= 2) {
    sheet.getRange(2, COL.AI_PROMPT, sheet.getMaxRows() - 1, 1).clearContent();
  }

  const numRows = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, numRows, TOTAL_COLS).getValues();

  let draftCount = 0;
  const errors = [];
  const draftedLeads = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNumber = i + 2;
    const status = String(row[COL.LEAD_STATUS - 1] || '').trim();
    const previewUrl = String(row[COL.PREVIEW_URL - 1] || '').trim();

    if (status !== STATUS.READY_TO_EMAIL) continue;
    if (!previewUrl || (!previewUrl.includes('.pages.dev') && !previewUrl.includes('.workers.dev'))) {
      errors.push('Row ' + rowNumber + ': Missing valid .pages.dev or .workers.dev URL in Column T.');
      continue;
    }

    const bizName = String(row[COL.BUSINESS_NAME - 1] || '').trim();
    const recipientEmail = String(row[COL.EMAIL - 1] || '').trim();
    if (!recipientEmail) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): Missing recipient email in Column N.');
      continue;
    }

    const domainStatus = String(row[COL.DOMAIN_STATUS - 1] || '').trim();
    const siteIssues = String(row[COL.SITE_ISSUES - 1] || '').trim();
    const improvements = formatFriendlyWebsiteImprovements_(siteIssues, domainStatus);

    try {
      const screenshotBlob = captureSiteScreenshotBlob_(previewUrl, bizName);
      const qrBlob = captureQrCodeBlob_(previewUrl, bizName);
      const claimUrl = CONFIG.CLAIM_BASE_URL + '?business=' + encodeURIComponent(bizName) + '&preview=' + encodeURIComponent(previewUrl);

      const subject = 'Appleton-based web designer here – I built a better-ranking site concept for you.';

      let plainImprovements = '';
      if (improvements.length > 0) {
        plainImprovements = 'Simply swapping in this new site helps your business right away:\n' +
          improvements.map(function(item) {
            return '• ' + item.title + ': ' + item.desc;
          }).join('\n') + '\n\n';
      }

      const plainBody =
        'Hi ' + bizName + ' team,\n\n' +
        'I\'m Jason Woodrow, and I run a small local studio right here in Appleton (624 Siteworks)—not an out-of-state marketing agency.\n\n' +
        'While looking at Fox Valley contractors, I noticed ' + bizName + ' has a strong reputation, but your current web setup is leaving local leads on the table. So I went ahead and built a live working preview of a new site for you:\n' +
        previewUrl + '\n\n' +
        plainImprovements +
        'Zero obligation—I already built the draft. If you want to put it on your domain, my flat options are at ' + claimUrl + ', or just call/text my cell at ' + CONFIG.AGENCY_PHONE + '.\n\n' +
        'Best,\nJason Woodrow\n624 Siteworks · Appleton, WI · ' + CONFIG.AGENCY_PHONE + '\n' + CONFIG.AGENCY_URL;

      const htmlBody = buildHtmlPitchEmail_({
        bizName: bizName,
        previewUrl: previewUrl,
        claimUrl: claimUrl,
        improvements: improvements,
        hasInlineScreenshot: Boolean(screenshotBlob),
        hasInlineQr: Boolean(qrBlob)
      });

      const draftOptions = {
        htmlBody: htmlBody,
        name: (CONFIG.SENDER_NAME || 'Jason Woodrow') + ' | 624 Siteworks',
        inlineImages: {}
      };
      if (screenshotBlob) {
        draftOptions.inlineImages.sitePreview = screenshotBlob;
      }
      if (qrBlob) {
        draftOptions.inlineImages.qrPreview = qrBlob;
      }

      // Route sender from hello@624siteworks.com instead of 624films
      try {
        const aliases = GmailApp.getAliases();
        const siteworksAlias = aliases.find(function(a) {
          return a.toLowerCase().indexOf('624siteworks.com') !== -1;
        });
        if (siteworksAlias) {
          draftOptions.from = siteworksAlias;
        } else if (CONFIG.SENDER_EMAIL && aliases.indexOf(CONFIG.SENDER_EMAIL) !== -1) {
          draftOptions.from = CONFIG.SENDER_EMAIL;
        }
      } catch (aliasErr) {
        // Fallback to active session user if aliases are restricted
      }

      GmailApp.createDraft(recipientEmail, subject, plainBody, draftOptions);

      const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
      sheet.getRange(rowNumber, COL.LEAD_STATUS).setValue(STATUS.DRAFT_CREATED);
      sheet.getRange(rowNumber, COL.NOTES).setValue('Draft created ' + timestamp + ' -> ' + recipientEmail + ' (' + previewUrl + ')');

      draftCount++;
      draftedLeads.push({ businessName: bizName, email: recipientEmail, previewUrl: previewUrl });
      SpreadsheetApp.flush();
    } catch (err) {
      errors.push('Row ' + rowNumber + ' (' + bizName + '): ' + err.message);
    }
  }

  return {
    success: true,
    draftCount: draftCount,
    draftedLeads: draftedLeads,
    errors: errors
  };
}

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

function captureQrCodeBlob_(previewUrl, bizName) {
  const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(previewUrl);
  const safeSlug = bizName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'preview';
  try {
    const response = UrlFetchApp.fetch(qrUrl, {
      method: 'get',
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (response.getResponseCode() >= 200 && response.getResponseCode() < 300) {
      return response.getBlob().setName(safeSlug + '-qr.png');
    }
  } catch (e) {}
  return null;
}

function buildHtmlPitchEmail_(data) {
  const screenshotMarkup = data.hasInlineScreenshot
    ? '<div style="margin: 22px 0 16px 0; border-radius: 12px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.08);">' +
        '<a href="' + data.previewUrl + '" target="_blank" style="display: block; text-decoration: none;">' +
          '<img src="cid:sitePreview" alt="' + data.bizName + ' Website Preview" style="display: block; width: 100%; max-width: 640px; height: auto; border: 0;" />' +
        '</a>' +
      '</div>'
    : '';

  const fallbackQrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=' + encodeURIComponent(data.previewUrl);
  const qrImgSrc = data.hasInlineQr ? 'cid:qrPreview' : fallbackQrUrl;

  const qrCardMarkup =
    '<table cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; width: 100%; max-width: 520px;">' +
      '<tr>' +
        '<td style="padding-right: 16px; vertical-align: middle; width: 136px;">' +
          '<a href="' + data.previewUrl + '" target="_blank" style="display: inline-block; background: #ffffff; padding: 6px; border-radius: 10px; border: 1px solid #e2e8f0;">' +
            '<img src="' + qrImgSrc + '" width="124" height="124" alt="Scan QR Code to preview on phone" style="display: block; width: 124px; height: 124px; border: 0;" />' +
          '</a>' +
        '</td>' +
        '<td style="vertical-align: middle;">' +
          '<div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #059669; margin-bottom: 4px;">Scan With Your Phone Camera</div>' +
          '<div style="font-size: 15px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">Test the Mobile View in Your Hand</div>' +
          '<div style="font-size: 13px; color: #475569; line-height: 1.45; margin-bottom: 10px;">Reading this on a computer? Point your phone camera right at this QR code to open <strong>' + data.bizName + '</strong>\'s mobile preview immediately.</div>' +
          '<a href="' + data.previewUrl + '" target="_blank" style="display: inline-block; padding: 8px 14px; background-color: #0f172a; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px;">Or Click to Open Preview &rarr;</a>' +
        '</td>' +
      '</tr>' +
    '</table>';

  let improvementsMarkup = '';
  if (data.improvements && data.improvements.length > 0) {
    const listItems = data.improvements.map(function(item) {
      return '<li style="margin-bottom: 8px;"><strong>' + item.title + ':</strong> ' + item.desc + '</li>';
    }).join('');

    improvementsMarkup =
      '<div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #2563eb; border-radius: 8px; padding: 14px 18px; margin: 18px 0;">' +
        '<p style="margin: 0 0 8px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; color: #334155;">' +
          'How simply swapping in this new site helps ' + data.bizName + ':' +
        '</p>' +
        '<ul style="margin: 0; padding-left: 18px; color: #1e293b; font-size: 14px; line-height: 1.55;">' +
          listItems +
        '</ul>' +
      '</div>';
  }

  return (
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; max-width: 620px; line-height: 1.55; font-size: 15px;">' +
      '<p style="margin-top: 0;">Hi <strong>' + data.bizName + '</strong> team,</p>' +
      '<p>I\'m Jason Woodrow, and I run a small local studio right here in Appleton (<strong>624 Siteworks</strong>)—not an out-of-state marketing agency.</p>' +
      '<p>While looking at Fox Valley contractors, I noticed <strong>' + data.bizName + '</strong> has a strong reputation, but your current web setup is leaving local leads on the table. So I went ahead and built a live working preview of a new site for you:</p>' +
      screenshotMarkup +
      qrCardMarkup +
      improvementsMarkup +
      '<p><strong>Zero obligation:</strong> I already built the draft. If you want to put it on your domain, my flat options are <a href="' + data.claimUrl + '" style="color: #2563eb; font-weight: 700;">right here</a>, or just call/text my cell at <a href="tel:9202345633" style="color: #2563eb; font-weight: 700;">' + CONFIG.AGENCY_PHONE + '</a>.</p>' +
      '<p style="margin-top: 20px; margin-bottom: 0;">' +
        'Best,<br/>' +
        '<strong>Jason Woodrow</strong><br/>' +
        '624 Siteworks · Appleton, WI · <a href="tel:9202345633" style="color: #0f172a; text-decoration: none; font-weight: 600;">' + CONFIG.AGENCY_PHONE + '</a> · <a href="' + CONFIG.AGENCY_URL + '" style="color: #2563eb; text-decoration: none;">624siteworks.com</a>' +
      '</p>' +
    '</div>'
  );
}

/**
 * Translates technical audit findings into positive, constructive improvements
 * tailored to contractors (focuses on leads, calls, speed, and trust).
 */
function formatFriendlyWebsiteImprovements_(siteIssues, domainStatus) {
  const points = [];
  const domain = String(domainStatus || '').trim();
  const issues = String(siteIssues || '').toUpperCase();

  if (!domain || domain.toLowerCase().includes('no website listed') || domain.toLowerCase().includes('facebook.com')) {
    points.push({
      title: 'Dedicated Digital Storefront',
      desc: 'Gives your business a clean, professional 24/7 web presence so homeowners finding your Google reviews can instantly see your services and photos.'
    });
    points.push({
      title: 'One-Tap Mobile Calling',
      desc: 'Prominent, tappable phone buttons and quote forms so mobile customers can call you in one tap.'
    });
    points.push({
      title: 'Local Google SEO',
      desc: 'Built-in local search markup to help your business appear directly in Fox Valley and Northeast Wisconsin contractor searches.'
    });
    return points;
  }

  if (issues.includes('NOT SECURE') || issues.includes('HTTP')) {
    points.push({
      title: 'Full HTTPS Security',
      desc: 'Adds modern SSL encryption so potential clients never see an alarming "Not Secure" warning in Chrome or Safari.'
    });
  }

  if (issues.includes('NOT MOBILE') || issues.includes('VIEWPORT')) {
    points.push({
      title: 'Mobile-First Responsive Layout',
      desc: 'Formats cleanly on every smartphone and tablet so customers never have to pinch or zoom to read your services.'
    });
  }

  if (issues.includes('SLOW') || issues.includes('LOAD')) {
    points.push({
      title: 'Blazing Fast Load Speed',
      desc: 'Engineered on lightweight static code that loads in under 1 second so customers don\'t leave before your page opens.'
    });
  }

  if (issues.includes('CLICK-TO-CALL') || issues.includes('NO CLICK') || issues.includes('TEL:')) {
    points.push({
      title: 'One-Tap Click-to-Call',
      desc: 'Makes your phone number instantly tappable across all mobile screens so homeowners can call your team in one tap.'
    });
  }

  if (issues.includes('SCHEMA') || issues.includes('TITLE') || issues.includes('DESCRIPTION') || issues.includes('H1')) {
    points.push({
      title: 'Local Fox Valley SEO',
      desc: 'Includes pre-configured LocalBusiness schema and geo-tags to help you rank higher in local Google and Maps searches.'
    });
  }

  if (issues.includes('WIX') || issues.includes('WORDPRESS') || issues.includes('BUILDER') || issues.includes('SUBDOMAIN')) {
    points.push({
      title: 'Lightweight, Plugin-Free Build',
      desc: 'Built without slow builder templates or bloated plugins, keeping your site fast, dependable, and maintenance-free.'
    });
  }

  if (points.length < 2) {
    if (!points.some(p => p.title.includes('Speed'))) {
      points.push({
        title: 'Instant Mobile Speed',
        desc: 'Loads in under 1 second on cell phones, giving homeowners an immediate and professional first impression.'
      });
    }
    if (!points.some(p => p.title.includes('Calling'))) {
      points.push({
        title: 'One-Tap Lead Capture',
        desc: 'Sticky phone buttons and accessible estimate forms engineered to convert visitors into phone calls.'
      });
    }
    if (!points.some(p => p.title.includes('SEO'))) {
      points.push({
        title: 'Local Search Optimization',
        desc: 'Structured metadata and geo-tags tailored specifically for homeowners searching across the Fox Valley.'
      });
    }
  }

  return points.slice(0, 3);
}

function isValidBusinessEmail_(email, ignoredExtensions, ignoredDomains) {
  if (!email || email.length > 80) return false;
  if (ignoredExtensions.test(email)) return false;
  if (ignoredDomains.test(email)) return false;
  if (/^\d+x\d+/i.test(email)) return false;
  return true;
}

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

function buildFallbackEmail_(bizName, domainStatus) {
  return 'No email found';
}

/**
 * Researches social profiles, real website images, brand colors, and company facts
 * for deep bespoke spec-site generation.
 */
function researchBusinessSocialsAndWeb_(bizName, city, domain) {
  const props = PropertiesService.getScriptProperties();
  const serperKey = props.getProperty('SERPER_API_KEY') || props.getProperty('OUTSCRAPER_API_KEY');
  
  const result = {
    success: true,
    bizName: bizName,
    socials: { facebook: '', instagram: '', linkedin: '', bbb: '', yelp: '' },
    websiteImages: [],
    imageDetails: [],
    extractedColors: [],
    snippets: []
  };

  if (!bizName) return result;

  // 1. Google Serper Search for Social Profiles & Reviews
  if (serperKey) {
    try {
      const cleanCity = city || 'Fox Valley, WI';
      const searchQuery = '"' + bizName + '" ' + cleanCity;
      const searchResp = UrlFetchApp.fetch('https://google.serper.dev/search', {
        method: 'post',
        contentType: 'application/json',
        headers: { 'X-API-KEY': serperKey },
        payload: JSON.stringify({ q: searchQuery, gl: 'us', hl: 'en', num: 10 }),
        muteHttpExceptions: true
      });

      if (searchResp.getResponseCode() >= 200 && searchResp.getResponseCode() < 300) {
        const data = JSON.parse(searchResp.getContentText());
        const organic = Array.isArray(data.organic) ? data.organic : [];
        for (let i = 0; i < organic.length; i++) {
          const item = organic[i];
          const link = item.link || '';
          const snippet = item.snippet || '';
          if (snippet) result.snippets.push(snippet);

          if (/facebook\.com\/[a-zA-Z0-9._-]+/i.test(link) && !link.includes('sharer') && !result.socials.facebook) {
            result.socials.facebook = link;
          } else if (/instagram\.com\/[a-zA-Z0-9._-]+/i.test(link) && !result.socials.instagram) {
            result.socials.instagram = link;
          } else if (/linkedin\.com\/(?:company|in)\/[a-zA-Z0-9._-]+/i.test(link) && !result.socials.linkedin) {
            result.socials.linkedin = link;
          } else if (/bbb\.org\//i.test(link) && !result.socials.bbb) {
            result.socials.bbb = link;
          } else if (/yelp\.com\/biz\//i.test(link) && !result.socials.yelp) {
            result.socials.yelp = link;
          }
        }

        if (data.knowledgeGraph) {
          result.knowledgeGraph = {
            title: data.knowledgeGraph.title || '',
            type: data.knowledgeGraph.type || '',
            imageUrl: data.knowledgeGraph.imageUrl || '',
            description: data.knowledgeGraph.description || ''
          };
          if (data.knowledgeGraph.imageUrl) {
            result.websiteImages.unshift(data.knowledgeGraph.imageUrl);
          }
        }
      }
    } catch (err) {}

    // 1b. Real Business Google Images Search (Serper Images API)
    try {
      const cleanCity = city || 'Fox Valley, WI';
      const queriesToTry = ['"' + bizName + '" ' + cleanCity];
      if (domain && !domain.includes('facebook.com') && !domain.includes('no website')) {
        const cleanDomain = domain.replace(/^https?:\/\//i, '').split('/')[0];
        if (cleanDomain) {
          queriesToTry.unshift('site:' + cleanDomain);
        }
      }

      for (let qIdx = 0; qIdx < queriesToTry.length; qIdx++) {
        const imgResp = UrlFetchApp.fetch('https://google.serper.dev/images', {
          method: 'post',
          contentType: 'application/json',
          headers: { 'X-API-KEY': serperKey },
          payload: JSON.stringify({ q: queriesToTry[qIdx], gl: 'us', hl: 'en', num: 10 }),
          muteHttpExceptions: true
        });

        if (imgResp.getResponseCode() >= 200 && imgResp.getResponseCode() < 300) {
          const imgData = JSON.parse(imgResp.getContentText());
          const imgs = Array.isArray(imgData.images) ? imgData.images : [];
          for (let j = 0; j < imgs.length; j++) {
            const u = imgs[j].imageUrl;
            if (u && u.startsWith('http') && !result.websiteImages.includes(u)) {
              result.websiteImages.push(u);
              result.imageDetails.push({ url: u, title: imgs[j].title || '', source: imgs[j].source || '' });
            }
          }
        }
        if (result.websiteImages.length >= 8) break;
      }
    } catch (err) {}
  }

  // 2. If domain provided, fetch homepage to extract real images and colors
  if (domain && !domain.toLowerCase().includes('no website') && !domain.toLowerCase().includes('facebook.com')) {
    try {
      const cleanUrl = domain.startsWith('http') ? domain : 'https://' + domain;
      const resp = UrlFetchApp.fetch(cleanUrl, {
        method: 'get',
        muteHttpExceptions: true,
        followRedirects: true,
        validateHttpsCertificates: false
      });

      if (resp.getResponseCode() >= 200 && resp.getResponseCode() < 400) {
        const html = resp.getContentText() || '';
        
        // Extract images
        const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
        let match;
        const seenImgs = new Set();
        while ((match = imgRegex.exec(html)) !== null && seenImgs.size < 12) {
          let src = match[1].trim();
          if (!src || src.startsWith('data:') || src.includes('.svg') || src.includes('icon') || src.includes('pixel')) continue;
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) {
            const domainBase = cleanUrl.replace(/\/+$/, '');
            src = domainBase + src;
          } else if (!src.startsWith('http')) {
            src = cleanUrl.replace(/\/[^\/]*$/, '/') + src;
          }
          if (!seenImgs.has(src)) {
            seenImgs.add(src);
            result.websiteImages.push(src);
          }
        }

        // Extract og:image
        const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
          result.websiteImages.unshift(ogMatch[1].trim());
        }

        // Extract brand colors
        const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
        if (themeMatch && themeMatch[1]) {
          result.extractedColors.push(themeMatch[1].trim());
        }

        const colorMatches = html.match(/#(?:[0-9a-fA-F]{3}){1,2}\b/g) || [];
        const uniqueColors = [...new Set(colorMatches.map(c => c.toLowerCase()))];
        const brandHexes = uniqueColors.filter(c => !['#fff', '#ffffff', '#000', '#000000', '#eee', '#eeeeee', '#ccc', '#cccccc'].includes(c));
        result.extractedColors.push(...brandHexes.slice(0, 8));

        // Extract any social links on homepage
        const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
        if (fbMatch && !result.socials.facebook) result.socials.facebook = fbMatch[0];

        const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._-]+/i);
        if (igMatch && !result.socials.instagram) result.socials.instagram = igMatch[0];
      }
    } catch (err) {}
  }

  return result;
}
