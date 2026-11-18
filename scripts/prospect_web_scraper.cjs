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

function buildUrlCandidates(urlStr) {
  const candidates = [];
  const add = (u) => {
    if (u && !candidates.includes(u)) candidates.push(u);
  };
  add(urlStr);
  try {
    const parsed = new URL(urlStr);
    const otherProto = parsed.protocol === 'https:' ? 'http:' : 'https:';
    const host = parsed.hostname;
    const altHost = host.startsWith('www.') ? host.slice(4) : `www.${host}`;

    const mkUrl = (proto, h) => `${proto}//${h}${parsed.port ? ':' + parsed.port : ''}${parsed.pathname}${parsed.search}`;
    // Prefer HTTPS first when original was HTTP, then alternate host variants
    if (parsed.protocol === 'http:') {
      add(mkUrl('https:', host));
      add(mkUrl('https:', altHost));
      add(mkUrl('http:', altHost));
    } else {
      add(mkUrl('https:', altHost));
      add(mkUrl('http:', host));
      add(mkUrl('http:', altHost));
    }
  } catch (e) {}
  return candidates;
}

function extractImgSrcFromAttrs(attrs) {
  const matchers = [
    /\bdata-lazy-src=["']([^"']+)["']/i,
    /\bdata-src=["']([^"']+)["']/i,
    /\bdata-original=["']([^"']+)["']/i,
    /\bsrc=["']([^"']+)["']/i
  ];
  for (const re of matchers) {
    const m = attrs.match(re);
    if (m && m[1] && !m[1].trim().startsWith('data:image/svg') && !m[1].trim().startsWith('data:image/gif')) {
      return m[1].trim();
    }
  }
  const srcsetMatch = attrs.match(/\b(?:data-)?srcset=["']([^"']+)["']/i);
  if (srcsetMatch && srcsetMatch[1]) {
    const first = srcsetMatch[1].split(',')[0]?.trim().split(/\s+/)[0];
    if (first && !first.startsWith('data:')) return first;
  }
  return null;
}

function isBadWorkImage(fullSrc, alt, attrs) {
  const lower = (fullSrc || '').toLowerCase();
  const altLower = (alt || '').toLowerCase();
  const combined = `${lower} ${altLower}`;

  if (
    lower.startsWith('data:') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.ico') ||
    /pixel|spacer|divider|1x1|tracking|contenttop|contentbottom|navbottom|topstrip|bkgrnd/i.test(lower) ||
    /security_?photo|captcha|recaptcha|securimage/i.test(combined) ||
    /coupon|rebate|flyer|spring_?20|double_your_power|\boffer\b|promo(?:tion)?|financing_?banner/i.test(combined) ||
    /\bbbb[-_]?logo|\bdealer\b|authorized[-_ ]?dealer|homeadvisor|angies?list|\bangi\b|bbb\.org|accredited|warranty[-_ ]?(?:badge|seal)|award[-_ ]?badge|google[-_ ]?review/i.test(combined) ||
    /facebook\.com|twitter\.com|instagram\.com|linkedin\.com|yelp\.com/i.test(lower)
  ) {
    return true;
  }

  // Skip explicitly small icon/badge thumbnails in HTML attributes
  const wMatch = attrs.match(/\bwidth=["']?(\d+)/i);
  const hMatch = attrs.match(/\bheight=["']?(\d+)/i);
  const w = wMatch ? parseInt(wMatch[1], 10) : 0;
  const h = hMatch ? parseInt(hMatch[1], 10) : 0;
  if ((w > 0 && w < 180) || (h > 0 && h < 110)) {
    return true;
  }

  return false;
}

function decodeHtmlAndObfuscatedEmails(raw) {
  let s = String(raw || '');
  if (!s) return '';
  s = s.replace(/data-cfemail=["']([a-f0-9]{6,})["']/gi, (_, hex) => {
    try {
      const r = parseInt(hex.slice(0, 2), 16);
      let decoded = '';
      for (let i = 2; i < hex.length; i += 2) {
        decoded += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16) ^ r);
      }
      return ` ${decoded} `;
    } catch (_) {
      return ' ';
    }
  });
  return s
    .replace(/&#(?:x40|0*64);|&commat;|%40/gi, '@')
    .replace(/&#(?:x2e|0*46);|&period;|%2e/gi, '.')
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\))\s*([a-zA-Z0-9.-]+)\s*(?:\[\s*dot\s*\]|\(\s*dot\s*\))\s*([a-zA-Z]{2,12})/gi, '$1@$2.$3')
    .replace(/([a-zA-Z0-9._%+-]+)\s*(?:\[\s*at\s*\]|\(\s*at\s*\))\s*([a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi, '$1@$2');
}

function isValidBusinessEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e || e.length < 6 || e.length > 80) return false;
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,12}$/i.test(e)) return false;
  if (/\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff|woff2|ttf|eot|pdf|map|xml|json|xxx|local|internal|invalid|test)$/i.test(e)) return false;
  if (/(sentry\.io|wixpress\.com|wix\.com|squarespace\.com|godaddy\.com|weebly\.com|wordpress\.com|wordpress\.org|automattic\.com|cloudflare\.com|example\.com|test\.com|domain\.com|email\.com|yoursite\.com|yourdomain\.com|companyname\.com|website\.com|mysite\.com|placeholder\.com|624siteworks\.com|bbb\.org|angi\.com|angieslist\.com|homeadvisor\.com|thumbtack\.com|yelp\.com|mapquest\.com|yellowpages\.com|manta\.com|buildzoom\.com|bizapedia\.com|zoominfo\.com|dnb\.com|nextdoor\.com|chamberofcommerce\.com|birdeye\.com|houzz\.com|porch\.com|facebook\.com|fb\.com|instagram\.com|linkedin\.com|google\.com)$/i.test(e)) {
    return false;
  }
  const [local = '', dom = ''] = e.split('@');
  const domBase = dom.split('.')[0] || '';
  if (/^\d+x\d+/i.test(e)) return false;
  if (/^[a-f0-9]{20,}$/i.test(local) || /^[a-f0-9]{16,}$/i.test(domBase)) return false;
  if (/^([a-z0-9])\1{2,}$/i.test(local) || /^([a-z0-9])\1{2,}$/i.test(domBase)) return false;
  if (/^(?:x{2,}|y{2,}|a{3,}|z{3,}|test\d*|testing|demo\d*|sample\d*|example\d*|placeholder|name|user\d*|username|yourname|youremail|myemail|someone|somebody|nobody|noreply|no-reply|donotreply|do-not-reply|mailer-daemon|postmaster|hostmaster|abuse|privacy|security)$/i.test(local)) {
    return false;
  }
  if (/^(?:xxxx+|example|test|sample|placeholder|yourdomain|yoursite|domain|email|website|mysite|companyname|businessname)$/i.test(domBase)) {
    return false;
  }
  if (/no-?reply|do-?not-?reply/i.test(local)) return false;
  return true;
}

function normalizeFacebookUrl(rawUrl) {
  let u = String(rawUrl || '').trim().replace(/[),.;"'\]>]+$/, '');
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  if (!/https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com)\//i.test(u)) return '';
  if (/facebook\.com\/(?:groups|events|marketplace|watch|reel|reels|stories|gaming|login|help|policies|privacy|legal|ads|business|developers|sharer(?:\.php)?|share(?:\.php)?|plugins?|tr|dialog|hashtag|search|photo\.php|video\.php)(?:\/|$|\?)/i.test(u)) {
    return '';
  }
  const lMatch = u.match(/[?&]u=([^&]+)/i);
  if (/l\.facebook\.com\/l\.php/i.test(u) && lMatch) {
    try { u = decodeURIComponent(lMatch[1]); } catch (_) {}
  }
  u = u.replace(/^https?:\/\/(?:m|mbasic|mobile|touch|web)\.(facebook\.com)/i, 'https://www.$1');
  u = u.replace(/^http:\/\/(www\.)?facebook\.com/i, 'https://www.facebook.com');
  u = u.replace(/^https:\/\/facebook\.com/i, 'https://www.facebook.com');

  const pathPart = u.replace(/^https?:\/\/(?:www\.)?(?:facebook\.com|fb\.com)/i, '');
  if (!pathPart || pathPart === '/' || /^\/\d{6,}\/(?:posts|photos|videos)\//i.test(pathPart)) return '';
  if (/^\/profile\.php/i.test(pathPart)) {
    const idMatch = pathPart.match(/[?&]id=(\d+)/i);
    return idMatch ? `https://www.facebook.com/profile.php?id=${idMatch[1]}` : '';
  }
  let cleanPath = pathPart.split('?')[0].split('#')[0]
    .replace(/\/(?:posts|photos|videos|about|reviews|mentions|reels)\b.*$/i, '')
    .replace(/\/+$/, '');
  if (!cleanPath || cleanPath === '/' || /^\/(?:pages|p|people|pg)$/i.test(cleanPath)) return '';
  return `https://www.facebook.com${cleanPath}`;
}

const SCRAPER_BIZ_STOPWORDS = new Set([
  'tree', 'trees', 'service', 'services', 'care', 'company', 'inc', 'llc', 'co', 'corp', 'ltd',
  'wisconsin', 'wi', 'green', 'bay', 'appleton', 'oshkosh', 'neenah', 'menasha', 'sherwood', 'brillion', 'omro',
  'kaukauna', 'kimberly', 'little', 'chute', 'de', 'pere', 'fox', 'valley', 'cities', 'north', 'east',
  'the', 'and', 'of', 'mr', 'pro', 'pros', 'custom', 'quality', 'best', 'premier', 'elite', 'local', 'northeast', 'midwest',
  'all', 'season', 'seasons', 'fencing', 'fence', 'deck', 'decks', 'siding', 'window', 'windows',
  'door', 'doors', 'painting', 'painter', 'roofing', 'roof', 'concrete', 'sewer', 'drain',
  'plumbing', 'plumber', 'heating', 'cooling', 'hvac', 'refrigeration', 'electric', 'electrical',
  'landscaping', 'landscape', 'design', 'lawn', 'asphalt', 'blacktop', 'sealcoat', 'sealcoating',
  'paving', 'waterproofing', 'basement', 'demolition', 'earthwork', 'dirt', 'grading', 'hauling', 'trucking',
  'foundation', 'contractor', 'contracting', 'construction', 'builders', 'remodeling', 'drywall', 'flooring', 'masonry',
  'excavating', 'excavation', 'septic', 'well', 'pump', 'stump', 'removal', 'trimming', 'pruning',
  'snow', 'plow', 'plowing', 'supply', 'supplies', 'mechanical', 'system', 'systems', 'solutions',
  'expert', 'experts', 'specialist', 'specialists', 'concept', 'concepts', 'works', 'work',
  'plus', 'usa', 'america', 'american', 'national', 'united', 'general', 'superior', 'badger', 'four',
  'group', 'enterprises', 'industries', 'associates', 'brothers', 'bros', 'sons', 'home', 'residential', 'commercial'
]);

function getDistinctiveBizTokensList(bizName) {
  return String(bizName || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(tok => tok.length >= 2 && !SCRAPER_BIZ_STOPWORDS.has(tok));
}

function getBrandStems(bizName) {
  const words = String(bizName || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(w => w.length >= 2 && !/^(?:the|and|of|llc|inc|co|corp|ltd)$/i.test(w));
  const stems = [];
  if (words.length >= 2) {
    stems.push(words.join(''));
    const startsWithGeo = /^(?:fox|wisconsin|wi|green|appleton|oshkosh|neenah|menasha|kaukauna|kimberly)$/i.test(words[0]);
    if (!startsWithGeo) {
      if (words.length >= 3) stems.push(words.slice(0, 3).join(''));
      stems.push(words.slice(0, 2).join(''));
    }
  } else if (words.length === 1) {
    stems.push(words[0]);
  }
  return [...new Set(stems.filter(s => s.length >= 5))];
}

function normalizePhone10(phoneStr) {
  const digits = String(phoneStr || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.charAt(0) === '1') return digits.slice(1);
  return digits.length === 10 ? digits : '';
}

function evaluateCompanyPhoneMatch(text, expectedPhone) {
  const target10 = normalizePhone10(expectedPhone);
  if (!target10) return 'unknown';
  const phoneMatches = String(text || '').match(/(?:\+?1[-.\s]?)?(?:\(\s*([2-9]\d{2})\s*\)|\b([2-9]\d{2}))[-.\s]*(\d{3})[-.\s]*(\d{4})\b/g) || [];
  if (!phoneMatches.length) return 'none';
  const tollFree = new Set(['800', '888', '877', '866', '855', '844', '833']);
  let sawOtherLocalPhone = false;
  for (const m of phoneMatches) {
    const p10 = normalizePhone10(m);
    if (!p10) continue;
    if (p10 === target10) return 'match';
    if (!tollFree.has(p10.slice(0, 3))) sawOtherLocalPhone = true;
  }
  return sawOtherLocalPhone ? 'conflict' : 'none';
}

function matchesBusinessIdentity(targetText, bizName) {
  const targetClean = String(targetText || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!targetClean) return false;
  const tokens = getDistinctiveBizTokensList(bizName);
  if (tokens.length > 0) {
    return tokens.some(t => targetClean.includes(t));
  }
  const stems = getBrandStems(bizName);
  return stems.some(st => targetClean.includes(st));
}

function extractFacebookSlugInfo(rawUrl) {
  const cleanUrl = String(rawUrl || '').trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
  const pathPart = cleanUrl.replace(/^https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com)/i, '');
  if (/^\/profile\.php/i.test(String(rawUrl || '').trim().replace(/^https?:\/\/(?:[a-z0-9-]+\.)?(?:facebook\.com|fb\.com)/i, '')) || /^\/\d{6,}$/.test(pathPart)) {
    return { hasNamedSlug: false, slugClean: '' };
  }
  const pagesM = pathPart.match(/^\/(?:pages\/category\/[^/]+|pages|p|people|pg)\/([^/]+)/i);
  let slugPart = pagesM ? pagesM[1] : (pathPart.replace(/^\//, '').split('/')[0] || '');
  slugPart = slugPart.replace(/-\d{6,}$/, '');
  const slugClean = slugPart.toLowerCase().replace(/[^a-z0-9]/g, '');
  const hasNamedSlug = Boolean(slugClean && !/^\d+$/.test(slugClean) && slugClean !== 'profilephp');
  return { hasNamedSlug, slugClean };
}

function isMatchingCompanyFacebook(fbUrl, bizName, extraText = '') {
  const norm = normalizeFacebookUrl(fbUrl);
  if (!norm) return false;
  const slugInfo = extractFacebookSlugInfo(norm);
  if (slugInfo.hasNamedSlug && !matchesBusinessIdentity(slugInfo.slugClean, bizName)) {
    return false;
  }
  if (extraText) {
    const freeMail = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'live.com', 'msn.com', 'att.net', 'sbcglobal.net', 'charter.net', 'spectrum.net', 'new.rr.com']);
    const emails = String(extraText).match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,12})/gi) || [];
    for (const em of emails) {
      const dom = em.split('@')[1].toLowerCase();
      if (!freeMail.has(dom) && !matchesBusinessIdentity(dom.split('.')[0], bizName)) {
        return false;
      }
    }
  }
  return true;
}

const DIRECTORY_HOST_FRAGMENTS = [
  'facebook.com', 'fb.com', 'instagram.com', 'linkedin.com', 'bbb.org', 'yelp.com', 'yelpcdn.com',
  'yellowpages.com', 'mapquest.com', 'mapq.st', 'angi.com', 'angieslist.com', 'homeadvisor.com',
  'thumbtack.com', 'porch.com', 'houzz.com', 'nextdoor.com', 'manta.com', 'chamberofcommerce.com',
  'birdeye.com', 'superpages.com', 'buildzoom.com', 'bizapedia.com', 'zoominfo.com', 'dnb.com',
  'opencorporates.com', 'expertise.com', 'threebestrated.com', 'bestprosintown.com', 'experience.com',
  'constructiondirectory.us', 'findtreeservice.com', 'bark.com', 'networx.com', 'homeyou.com', 'fixr.com',
  'wiseintro.com', 'alignable.com', 'hotfrog.com', 'brownbook.net', 'cylex.us.com', 'merchantcircle.com',
  'showmelocal.com', 'citysearch.com', 'insiderpages.com', 'ezlocal.com', 'whitepages.com', 'spokeo.com',
  'allbiz.com', 'local.com', 'ebusinesspages.com', 'cybo.com', 'fyple.com', 'yasabe.com', 'judysbook.com',
  'townplanner.com', 'oshkoshdirect.us', 'appletondirect.us'
];

function isDirectoryHostOrUrl(rawUrlOrHost) {
  const s = String(rawUrlOrHost || '').trim().toLowerCase();
  if (!s) return false;
  const host = s.replace(/^https?:\/\//i, '').split('/')[0].split('?')[0].replace(/^www\./i, '');
  if (!host) return false;
  if (/(?:^|\.)[a-z0-9-]+direct\.us$/i.test(host)) return true;
  if (/(?:\.(?:gov|edu)|\/(?:listings|directory|businesses|profile)\/)/i.test(s)) return true;
  return DIRECTORY_HOST_FRAGMENTS.some(dir => host === dir || host.endsWith('.' + dir));
}

function extractBestSiteEmail(htmlSource, websiteHost) {
  const decoded = decodeHtmlAndObfuscatedEmails(htmlSource);
  const hostClean = String(websiteHost || '').toLowerCase().replace(/^www\./, '');
  const scores = new Map();

  const scoreCandidate = (cand, isMailto) => {
    const e = cand.trim().toLowerCase();
    if (!isValidBusinessEmail(e)) return;
    const [local = '', dom = ''] = e.split('@');
    let sc = isMailto ? 110 : 80;
    if (hostClean && (dom === hostClean || dom.endsWith(`.${hostClean}`) || hostClean.endsWith(`.${dom}`))) sc += 25;
    if (/^(?:info|contact|office|estimates?|quotes?|sales|service|support|hello)$/i.test(local)) sc += 20;
    if (/^(?:webmaster|hostmaster|admin)$/i.test(local)) sc -= 25;
    const prev = scores.get(e) || -999;
    if (sc > prev) scores.set(e, sc);
  };

  let mm;
  const mailtoRe = /mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12})/gi;
  while ((mm = mailtoRe.exec(decoded)) !== null) scoreCandidate(mm[1], true);

  const rawMatches = decoded.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [];
  for (const rm of rawMatches) scoreCandidate(rm, false);

  let best = null;
  let bestScore = -999;
  for (const [email, sc] of scores.entries()) {
    if (sc > bestScore) {
      bestScore = sc;
      best = email;
    }
  }
  return best;
}

async function scrapeProspectWebsite(targetUrl, options = {}) {
  let urlStr = (targetUrl || '').trim();
  if (!urlStr) return null;
  if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
    urlStr = 'https://' + urlStr;
  }
  if (isDirectoryHostOrUrl(urlStr)) {
    console.warn(`[Scraper Agent] Skipping directory/social listing URL (${urlStr}).`);
    return null;
  }

  console.log(`[Scraper Agent] Initiating scrape for: ${urlStr}`);
  let html = '';
  let finalUrl = urlStr;
  let lastErr = null;

  for (const candidateUrl of buildUrlCandidates(urlStr)) {
    try {
      const resp = await fetchWithTimeout(candidateUrl);
      if (resp.ok) {
        const text = await resp.text();
        if (text && text.length >= 150) {
          finalUrl = resp.url || candidateUrl;
          html = text;
          break;
        }
      }
    } catch (err) {
      lastErr = err;
    }
  }

  if (!html || html.length < 150) {
    console.warn(`[Scraper Agent] Failed to fetch prospect website (${lastErr ? lastErr.message : 'empty response'}).`);
    return null;
  }

  if (/cgi-sys\/defaultwebpage\.cgi|<title>\s*Default Web Site Page\s*<\/title>|Account Suspended|Domain (?:Expired|For Sale)/i.test(html)) {
    console.warn(`[Scraper Agent] Detected default/parked hosting redirect at ${finalUrl}; ignoring.`);
    return null;
  }

  const result = {
    url: finalUrl,
    title: '',
    metaDescription: '',
    phone: null,
    email: null,
    facebook: null,
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

  // 3b. Email (decodes Cloudflare email protection, HTML entities & obfuscation, blocks placeholders)
  let siteHost = '';
  try { siteHost = new URL(finalUrl).hostname; } catch (_) {}
  const bestEmail = extractBestSiteEmail(allHtmlSources, siteHost);
  if (bestEmail) {
    result.email = bestEmail;
  }

  // 3c. Facebook Page (ignores sharer/groups/events/trackers)
  const fbMatches = allHtmlSources.match(/https?:\/\/(?:[a-z]+\.)?facebook\.com\/[^\s"'<>()]+/gi) || [];
  for (const fbRaw of fbMatches) {
    const cleanFb = normalizeFacebookUrl(fbRaw);
    if (cleanFb) {
      result.facebook = cleanFb;
      break;
    }
  }

  // 3c. Address & City
  const addressMatch = allHtmlSources.match(/(\d+\s+[\w\s.,#]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Highway|Hwy|Way|Court|Ct|County Road KK)[\w\s.,#]*,\s*[A-Za-z\s.]+,?\s*[A-Z]{2}\s+\d{5})/i);
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
    const srcRaw = extractImgSrcFromAttrs(attrs);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (!srcRaw) continue;

    const fullSrc = resolveUrl(srcRaw, finalUrl);
    if (!fullSrc) continue;
    const alt = altMatch ? altMatch[1] : '';

    if (/Header\.png/i.test(fullSrc)) {
      result.headerBanner = fullSrc;
    }

    const isThirdPartyBadge = /\bbbb[-_]?logo|\bdealer\b|generac|kohler|angi|homeadvisor/i.test(fullSrc + ' ' + alt);
    if (!isThirdPartyBadge && (/logo|brand|header-logo|site-logo|pipingservice\.com\/images\/Header/i.test(attrs + ' ' + fullSrc) || /logo|brand/i.test(alt))) {
      const score = /logo/i.test(fullSrc) ? 12 : 10;
      logoCandidates.push({ url: fullSrc, score });
    }
  }

  // Check CSS background-image logo selectors if no explicit <img> logo was found
  const bgLogoRegex = /\.(?:logo|brand|site-logo|navbar-brand)[^{]*\{[^}]*background(?:-image)?\s*:[^;]*url\(['"]?([^'")]+)['"]?\)/gi;
  let bgm;
  while ((bgm = bgLogoRegex.exec(combinedCss + ' ' + html)) !== null) {
    const fullBg = resolveUrl(bgm[1], finalUrl);
    if (fullBg && !fullBg.startsWith('data:')) {
      logoCandidates.push({ url: fullBg, score: 8 });
    }
  }

  // If apple-touch-icon / large icon fallback
  const iconRegex = /<link[^>]+rel=["'](?:apple-touch-icon|shortcut icon|icon)["'][^>]+href=["']([^"']+)["']/gi;
  let icm;
  while ((icm = iconRegex.exec(html)) !== null) {
    const fullHref = resolveUrl(icm[1], finalUrl);
    if (fullHref && !fullHref.endsWith('.ico') && !fullHref.endsWith('.gif')) {
      const isAppleTouch = /apple-touch-icon/i.test(icm[0]);
      logoCandidates.push({ url: fullHref, score: isAppleTouch ? 6 : 3 });
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
  const scoredImages = [];
  const allImgsRegex = /<img([^>]+)>/gi;
  let aim;
  while ((aim = allImgsRegex.exec(allHtmlSources)) !== null) {
    const attrs = aim[1];
    const srcRaw = extractImgSrcFromAttrs(attrs);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    if (!srcRaw) continue;

    const fullSrc = resolveUrl(srcRaw, finalUrl);
    if (!fullSrc) continue;
    const alt = altMatch ? altMatch[1].trim() : '';

    const lower = fullSrc.toLowerCase();
    if (seenImgs.has(fullSrc)) continue;
    seenImgs.add(fullSrc);

    // Certifications
    if (lower.includes('nsf') || lower.includes('iso') || lower.includes('aws') || lower.includes('asme')) {
      result.certifications.push({ url: fullSrc, name: alt || 'Certified' });
      continue;
    }

    if (isBadWorkImage(fullSrc, alt, attrs)) {
      continue;
    }

    // Skip the extracted logo from general work gallery candidates
    if (result.logo && fullSrc === result.logo) {
      continue;
    }

    const combinedText = `${lower} ${alt.toLowerCase()}`;
    let context = 'Work Photo';
    let priority = 40;
    if (/vans?\b|truck|fleet|vehicle/i.test(combinedText)) {
      context = 'Fleet & Service Vehicles';
      priority = 100;
    } else if (/crew|team|staff|owner/i.test(combinedText)) {
      context = 'Team & Crew';
      priority = 90;
    } else if (/fabricat|weld/i.test(combinedText)) {
      context = 'Fabrication';
      priority = 70;
    } else if (/waterjet/i.test(combinedText)) {
      context = 'Waterjet Cutting';
      priority = 70;
    } else if (/commercial/i.test(combinedText)) {
      context = 'Commercial Work';
      priority = 65;
    } else if (/outdoor|patio|lighting|panel|wiring|generator|furnace|hvac|roof|fence|concrete|paver/i.test(combinedText)) {
      context = 'Field & Project Work';
      priority = 65;
    } else if (/residential/i.test(combinedText)) {
      context = 'Residential Work';
      priority = 55;
    } else if (/about|shop/i.test(combinedText)) {
      context = 'Shop & Jobsite';
      priority = 50;
    }

    scoredImages.push({
      url: fullSrc,
      alt: alt || context,
      context: context,
      priority
    });
  }

  // Also capture og:image / twitter:image if valid & not already captured
  const metaImgRegex = /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi;
  let mim;
  while ((mim = metaImgRegex.exec(html)) !== null) {
    const fullMetaImg = resolveUrl(mim[1].trim(), finalUrl);
    if (fullMetaImg && !seenImgs.has(fullMetaImg) && !isBadWorkImage(fullMetaImg, '', '') && (!result.logo || fullMetaImg !== result.logo)) {
      seenImgs.add(fullMetaImg);
      scoredImages.push({ url: fullMetaImg, alt: 'Featured Business Work', context: 'Featured Work', priority: 75 });
    }
  }

  scoredImages.sort((a, b) => b.priority - a.priority);
  result.images = scoredImages.map(({ url, alt, context }) => ({ url, alt, context }));

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
  cleanHex,
  isValidBusinessEmail,
  normalizeFacebookUrl,
  decodeHtmlAndObfuscatedEmails,
  getDistinctiveBizTokensList,
  getBrandStems,
  matchesBusinessIdentity,
  isMatchingCompanyFacebook,
  normalizePhone10,
  evaluateCompanyPhoneMatch,
  isDirectoryHostOrUrl
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
