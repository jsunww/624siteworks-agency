/**
 * Intelligent Prospect Website & Brand Scraper Agent
 * Extracts authentic brand colors, logos, work images, and service offerings from prospect websites.
 * Crawls homepage and key subpages (about, services, contact, portfolio, etc.)
 */

const fs = require('fs');
const path = require('path');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function resolveUrl(relative, base) {
  try {
    return new URL(relative, base).href;
  } catch (e) {
    return null;
  }
}

function isNeutralHex(hex) {
  const clean = hex.toLowerCase().replace('#', '');
  let r, g, b;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16);
    g = parseInt(clean[1] + clean[1], 16);
    b = parseInt(clean[2] + clean[2], 16);
  } else if (clean.length === 6) {
    r = parseInt(clean.substring(0, 2), 16);
    g = parseInt(clean.substring(2, 4), 16);
    b = parseInt(clean.substring(4, 6), 16);
  } else {
    return true;
  }

  // Pure white or black
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  if (brightness > 240 || brightness < 20) return true;

  // Near-grayscale / neutral check (difference between highest and lowest channel is minimal)
  if (Math.max(r, g, b) - Math.min(r, g, b) < 22) return true;

  // Saturation check
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const saturation = max === 0 ? 0 : (max - min) / max;
  return saturation < 0.20; // Gray / Slate
}

function cleanHex(hex) {
  let h = hex.toLowerCase();
  if (h.length === 4) {
    h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  }
  return h;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        ...(options.headers || {})
      }
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function scrapeProspectWebsite(targetUrl, options = {}) {
  let urlStr = (targetUrl || '').trim();
  if (!urlStr) return null;
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }

  console.log(`[Scraper Agent] Initiating scrape for: ${urlStr}`);
  let html = '';
  let finalUrl = urlStr;

  try {
    const resp = await fetchWithTimeout(urlStr);
    finalUrl = resp.url || urlStr;
    html = await resp.text();
  } catch (err) {
    console.warn(`[Scraper Agent] Initial fetch failed (${err.message}). Trying HTTP fallback...`);
    try {
      const httpUrl = urlStr.replace('https://', 'http://');
      const resp = await fetchWithTimeout(httpUrl);
      finalUrl = resp.url || httpUrl;
      html = await resp.text();
    } catch (err2) {
      console.error(`[Scraper Agent] Failed to fetch prospect website: ${err2.message}`);
      return null;
    }
  }

  if (!html || html.length < 150) {
    console.warn(`[Scraper Agent] Retrieved HTML is too short.`);
    return null;
  }

  const result = {
    url: finalUrl,
    title: '',
    metaDescription: '',
    phone: null,
    email: null,
    address: null,
    city: null,
    yearEstablished: null,
    colors: {
      primary: null,
      secondary: null,
      accent: null,
      extractedPalette: []
    },
    logo: null,
    headerBanner: null,
    images: [],
    services: [],
    tagline: '',
    aboutSnippets: [],
    certifications: []
  };

  // 1. Title & Meta
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    result.title = titleMatch[1].replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
  }

  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  if (metaDescMatch) {
    result.metaDescription = metaDescMatch[1].trim();
  }

  // 2. Extract Linked Pages (from <a href="..."> and <area href="...">)
  const internalLinks = new Map();
  const linkRegex = /<(?:a|area)[^>]+href=["']([^"']+)["'][^>]*>/gi;
  let lm;
  while ((lm = linkRegex.exec(html)) !== null) {
    const rawHref = lm[1];
    if (rawHref.startsWith('mailto:') || rawHref.startsWith('tel:') || rawHref.startsWith('javascript:')) continue;
    const resolved = resolveUrl(rawHref, finalUrl);
    if (!resolved) continue;

    try {
      const parsed = new URL(resolved);
      const baseParsed = new URL(finalUrl);
      if (parsed.hostname === baseParsed.hostname) {
        const pathLower = parsed.pathname.toLowerCase();
        let linkCategory = null;
        if (/about|history|overview|who-we-are/i.test(pathLower)) linkCategory = 'about';
        else if (/contact|location|quote|reach-us/i.test(pathLower)) linkCategory = 'contact';
        else if (/service|capability|fabricat|install|work|waterjet|industrial|commercial|plumb|hvac|weld|fence|fencing|heating|cooling|furnace|air-cond|post-hole/i.test(pathLower)) linkCategory = 'service';
        else if (/gallery|project|photo/i.test(pathLower)) linkCategory = 'gallery';

        if (linkCategory && !internalLinks.has(resolved)) {
          internalLinks.set(resolved, linkCategory);
        }
      }
    } catch (e) {}
  }

  // Crawl up to 4 key internal subpages
  const subpageContents = [];
  const crawledUrls = Array.from(internalLinks.keys()).slice(0, 4);
  for (const subUrl of crawledUrls) {
    try {
      const sResp = await fetchWithTimeout(subUrl, {}, 4000);
      if (sResp.ok) {
        const sHtml = await sResp.text();
        subpageContents.push({ url: subUrl, category: internalLinks.get(subUrl), html: sHtml });
      }
    } catch (e) {
      console.warn(`[Scraper Agent] Failed to fetch subpage ${subUrl}: ${e.message}`);
    }
  }

  // Combine all crawled HTML for thorough extraction
  const allHtmlSources = [html, ...subpageContents.map(s => s.html)].join('\n');

  // 3. Contact & Location Information Extraction
  // 3a. Phone: prefer punctuated US phone numbers e.g. (920) 395-1000 or 920-734-1666
  const punctuatedPhones = allHtmlSources.match(/(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s][0-9]{3}[-.\s][0-9]{4}/g);
  if (punctuatedPhones && punctuatedPhones.length > 0) {
    const cleanPhones = punctuatedPhones
      .map(p => p.trim())
      .filter(p => !p.startsWith('000') && !p.startsWith('123') && !p.includes('555-01') && !p.includes('800-') && !p.includes('888-'));
    if (cleanPhones.length) {
      result.phone = cleanPhones[0];
    }
  } else {
    const rawPhones = allHtmlSources.match(/\b(?:\+?1)?([2-9]\d{2}[2-9]\d{6})\b/g);
    if (rawPhones && rawPhones.length > 0) {
      result.phone = rawPhones[0];
    }
  }

  // 3b. Email
  const emailMatches = allHtmlSources.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatches) {
    const cleanEmails = emailMatches.filter(e => {
      const el = e.toLowerCase();
      return !el.includes('sentry') && !el.includes('wix') && !el.includes('wordpress') && !el.includes('example.com') && !el.includes('domain.com') && !el.includes('.png') && !el.includes('.jpg');
    });
    if (cleanEmails.length) {
      result.email = cleanEmails[0];
    }
  }

  // 3c. Address & City
  const addressMatch = allHtmlSources.match(/(\d+\s+[\w\s.,#]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Highway|Hwy|Way|Court|Ct|County Road KK)[\w\s.,#]*,\s*[A-Z]{2}\s+\d{5})/i);
  if (addressMatch) {
    result.address = addressMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  }

  // 3d. Year Established
  const estMatch = allHtmlSources.match(/(?:formed|established|founded|in existence|serving [a-z\s]+)\s+(?:in|since)\s+(19\d\d|20\d\d)/i);
  if (estMatch) {
    result.yearEstablished = estMatch[1];
  }

  // 4. Color Extraction (Theme Meta, CSS Links, Stylesheets, SVG)
  const hexFreq = {};

  // 4a. Theme-color meta tag
  const themeMatch = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  if (themeMatch && themeMatch[1].startsWith('#')) {
    const tc = cleanHex(themeMatch[1]);
    hexFreq[tc] = (hexFreq[tc] || 0) + 30;
  }

  // 4b. Collect all CSS stylesheets
  const cssLinks = [];
  const cssRegex = /<link[^>]+href=["']([^"']+\.css(?:\?[^"']*)?)["'][^>]*>/gi;
  let cm;
  while ((cm = cssRegex.exec(html)) !== null) {
    const fullHref = resolveUrl(cm[1], finalUrl);
    if (fullHref && !fullHref.includes('font') && !fullHref.includes('google') && !cssLinks.includes(fullHref)) {
      cssLinks.push(fullHref);
    }
  }

  let combinedCss = '';
  for (const cssUrl of cssLinks.slice(0, 4)) {
    try {
      const cResp = await fetchWithTimeout(cssUrl, {}, 3000);
      if (cResp.ok) {
        const text = await cResp.text();
        combinedCss += ' ' + text;
      }
    } catch (e) {}
  }

  // Extract inline <style>
  const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm;
  while ((sm = styleRegex.exec(html)) !== null) {
    combinedCss += ' ' + sm[1];
  }

  // Scan hex codes
  const allStyleText = combinedCss + ' ' + html;
  const hexMatches = allStyleText.match(/#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g) || [];
  for (const rawHex of hexMatches) {
    const h = cleanHex(rawHex);
    if (!isNeutralHex(h)) {
      hexFreq[h] = (hexFreq[h] || 0) + 1;
    }
  }

  // Also check explicit Headline, accent, and brand styles in CSS
  const headlineColorMatch = combinedCss.match(/\.Headline\s*\{[^}]*color\s*:\s*(#[0-9a-fA-F]{3,6})/i);
  if (headlineColorMatch) {
    const hc = cleanHex(headlineColorMatch[1]);
    hexFreq[hc] = (hexFreq[hc] || 0) + 25;
  }

  const sortedColors = Object.entries(hexFreq)
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);

  result.colors.extractedPalette = sortedColors.slice(0, 10);
  if (sortedColors.length > 0) result.colors.primary = sortedColors[0];
  if (sortedColors.length > 1) result.colors.secondary = sortedColors[1];
  if (sortedColors.length > 2) result.colors.accent = sortedColors[2];

  // 5. Logo & Header Banner Extraction
  const logoCandidates = [];
  const rawImgRegex = /<img([^>]+)>/gi;
  let rim;
  while ((rim = rawImgRegex.exec(html)) !== null) {
    const attrs = rim[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (!srcMatch) continue;

    const fullSrc = resolveUrl(srcMatch[1], finalUrl);
    if (!fullSrc) continue;
    const alt = altMatch ? altMatch[1] : '';

    if (/Header\.png/i.test(fullSrc)) {
      result.headerBanner = fullSrc;
    }

    if (/logo|brand|header-logo|site-logo|pipingservice\.com\/images\/Header/i.test(attrs) || /logo|brand/i.test(alt)) {
      logoCandidates.push({ url: fullSrc, score: 10 });
    }
  }

  // If favicon/apple-touch-icon
  const iconRegex = /<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]+href=["']([^"']+)["']/gi;
  let icm;
  while ((icm = iconRegex.exec(html)) !== null) {
    const fullHref = resolveUrl(icm[1], finalUrl);
    if (fullHref && !fullHref.endsWith('.ico') && !fullHref.endsWith('.gif')) {
      logoCandidates.push({ url: fullHref, score: 5 });
    }
  }

  if (logoCandidates.length > 0) {
    logoCandidates.sort((a, b) => b.score - a.score);
    result.logo = logoCandidates[0].url;
  } else if (result.headerBanner) {
    result.logo = result.headerBanner;
  }

  // 6. Authentic Image Extraction & Classification
  const seenImgs = new Set();
  const allImgsRegex = /<img([^>]+)>/gi;
  let aim;
  while ((aim = allImgsRegex.exec(allHtmlSources)) !== null) {
    const attrs = aim[1];
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (!srcMatch) continue;

    const fullSrc = resolveUrl(srcMatch[1], finalUrl);
    if (!fullSrc) continue;
    const alt = altMatch ? altMatch[1].trim() : '';

    const lower = fullSrc.toLowerCase();
    if (
      lower.startsWith('data:') ||
      lower.endsWith('.gif') ||
      lower.includes('pixel') ||
      lower.includes('facebook') ||
      lower.includes('twitter') ||
      lower.includes('instagram') ||
      lower.includes('linkedin') ||
      lower.includes('yelp') ||
      lower.includes('contenttop') ||
      lower.includes('contentbottom') ||
      lower.includes('navbottom') ||
      lower.includes('topstrip') ||
      lower.includes('bkgrnd') ||
      seenImgs.has(fullSrc)
    ) {
      continue;
    }

    seenImgs.add(fullSrc);

    // Certifications
    if (lower.includes('nsf') || lower.includes('iso') || lower.includes('aws') || lower.includes('asme')) {
      result.certifications.push({ url: fullSrc, name: alt || 'Certified' });
      continue;
    }

    let context = 'Work Photo';
    if (lower.includes('fabricat')) context = 'Fabrication';
    else if (lower.includes('install')) context = 'Installation';
    else if (lower.includes('waterjet')) context = 'Waterjet Cutting';
    else if (lower.includes('about')) context = 'About PSI';
    else if (lower.includes('photo')) context = 'Shop & Jobsite';

    result.images.push({
      url: fullSrc,
      alt: alt || context,
      context: context
    });
  }

  // 7. Extract Real Services from Headings, Strong, and Links
  const realServices = [];

  // Check strong tags and h2/h3 tags
  const serviceRegex = /<(?:strong|h[23])>([A-Za-z0-9\s,&/'-]+)<\/(?:strong|h[23])>/gi;
  let smm;
  const potentialServices = new Set();
  while ((smm = serviceRegex.exec(allHtmlSources)) !== null) {
    const text = smm[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    if (text.length >= 4 && text.length <= 50) {
      if (/piping|fabricat|welding|install|waterjet|boiler|power|hvac|plumb|machining|chiller|refrigerat|fence|fencing|post\s*hole|gate|wood\s*fence|vinyl|chain\s*link|heating|cooling|furnace|air\s*condition|heat\s*pump|duct/i.test(text)) {
        potentialServices.add(text);
      }
    }
  }

  // Also check navigation image maps and area alts
  const areaRegex = /<area[^>]+alt=["']([^"']+)["'][^>]*>/gi;
  let am;
  while ((am = areaRegex.exec(html)) !== null) {
    const alt = am[1].trim();
    if (/fabrication|installation|water\s*jet|mechanical/i.test(alt)) {
      let formatted = alt.charAt(0).toUpperCase() + alt.slice(1);
      if (formatted.toLowerCase() === 'water jet') formatted = 'Precision Waterjet Cutting';
      if (formatted.toLowerCase() === 'fabrication') formatted = 'Piping Fabrication & ASME Welding';
      if (formatted.toLowerCase() === 'installation') formatted = 'Industrial Process Piping Installation';
      potentialServices.add(formatted);
    }
  }

  for (const s of potentialServices) {
    const slug = s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    realServices.push({ name: s, slug: slug });
  }

  result.services = realServices.slice(0, 6);

  // 8. Extract About Snippets
  const textBlocks = allHtmlSources.split(/<br\s*\/?>|<\/p>|<\/div>/i);
  for (const block of textBlocks) {
    const clean = block.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    if (clean.length > 60 && clean.length < 350) {
      if (/piping|service|fabricat|contractor|wisconsin|kaukauna|welding|nsf|certified|since 19|fence|fencing|post\s*hole|heating|cooling|furnace|air\s*conditioning|family\s*owned/i.test(clean)) {
        if (!result.aboutSnippets.includes(clean)) {
          result.aboutSnippets.push(clean);
        }
      }
    }
  }

  console.log(`[Scraper Agent] Extraction complete for ${result.url}:`);
  console.log(`  - Business Title: "${result.title}"`);
  console.log(`  - Phone: ${result.phone}`);
  console.log(`  - Address: ${result.address}`);
  console.log(`  - Colors: Primary ${result.colors.primary}, Palette: ${result.colors.extractedPalette.join(', ')}`);
  console.log(`  - Logo: ${result.logo}`);
  console.log(`  - Real Services (${result.services.length}): ${result.services.map(s => s.name).join(' | ')}`);
  console.log(`  - Authentic Photos: ${result.images.length}`);
  console.log(`  - Certifications: ${result.certifications.length}`);

  return result;
}

module.exports = {
  scrapeProspectWebsite,
  isNeutralHex,
  cleanHex
};

if (require.main === module) {
  const target = process.argv[2] || 'https://www.pipingservice.com';
  scrapeProspectWebsite(target).then(res => {
    console.log('\n=== FINAL SCRAPED OUTPUT ===');
    console.log(JSON.stringify(res, null, 2));
  }).catch(err => {
    console.error('Fatal scrape error:', err);
  });
}
