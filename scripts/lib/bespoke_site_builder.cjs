/**
 * ============================================================================
 * 624 Siteworks Canonical Bespoke Website Builder Core
 * ============================================================================
 * Single source of truth shared by:
 *   - 624siteworks.com/scripts/autonomous_lead_engine.js (6am cron & CLI)
 *   - 624LLC Firebase Cloud Functions generateStaticSite (Admin Hub Prospector)
 * ============================================================================
 */

const fs = require('node:fs');
const path = require('node:path');

const scraperUtilsPath = fs.existsSync(path.join(__dirname, 'prospect_web_scraper.cjs'))
  ? path.join(__dirname, 'prospect_web_scraper.cjs')
  : path.join(__dirname, '..', 'prospect_web_scraper.cjs');
const {
  isValidBusinessEmail,
  normalizeFacebookUrl,
  matchesBusinessIdentity,
  isMatchingCompanyFacebook,
  getBrandStems,
  evaluateCompanyPhoneMatch,
  isDirectoryHostOrUrl
} = require(scraperUtilsPath);

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

function buildTradePhotographyTaxonomy(stockRootDir) {
  const stock = (...segments) => path.join(stockRootDir, ...segments);
  return {
    'Fencing': {
      wood: [
        'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1595846519845-68e298c2edd8?auto=format&fit=crop&w=800&q=80'
      ],
      vinyl: [
        'https://images.unsplash.com/photo-1549247796-5d8f09e9034b?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1622372738946-62e02505feb3?auto=format&fit=crop&w=800&q=80'
      ],
      chain_link: [
        'https://images.unsplash.com/photo-1553379027-7fcd98bc5f35?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=800&q=80'
      ],
      metal_iron: [
        'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1584905066893-7d5c142ba4e1?auto=format&fit=crop&w=800&q=80'
      ],
      deck_patio: [
        'https://images.unsplash.com/photo-1591825729269-caeb344f6df2?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1517581177682-a085bb7ffb15?auto=format&fit=crop&w=800&q=80'
      ],
      repair: [
        'https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1588880331179-bc9b93a8cb5e?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1528740561666-dc2479dc08ab?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'Roofing': {
      shingle: [
        'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1505705694340-019e1e335916?auto=format&fit=crop&w=800&q=80'
      ],
      metal: [
        'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80'
      ],
      flat_commercial: [
        'https://images.unsplash.com/photo-1597484661643-2f5fef640dd1?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=800&q=80'
      ],
      repair_inspection: [
        'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1632759145351-1d592919f522?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1628744448840-55bdb2497bd4?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'Concrete': {
      driveway_patio: [
        stock('concrete', 'driveways.jpg'),
        stock('concrete', 'patios-walkways.jpg')
      ],
      patio_walkway: [
        stock('concrete', 'patios-walkways.jpg'),
        stock('concrete', 'driveways.jpg')
      ],
      stamped_decorative: [
        stock('concrete', 'decorative-stamped.jpg')
      ],
      garage_floors: [
        stock('concrete', 'garage-floors.jpg')
      ],
      foundation_footing: [
        stock('concrete', 'garage-floors.jpg'),
        stock('concrete', 'concrete-crew-hero.jpg')
      ],
      repair_leveling: [
        stock('concrete', 'concrete-crew-hero.jpg')
      ],
      hero: [
        stock('concrete', 'concrete-crew-hero.jpg'),
        stock('concrete', 'patios-walkways.jpg')
      ],
      about: [
        stock('concrete', 'patios-walkways.jpg'),
        stock('concrete', 'concrete-crew-hero.jpg')
      ]
    },
    'Plumbing': {
      pipe_water: [
        'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80'
      ],
      drain_sewer: [
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=800&q=80'
      ],
      fixture_bath: [
        'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80'
      ],
      emergency_repair: [
        'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1607472586893-edb57bdc0e39?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'HVAC': {
      ac_cooling: [
        stock('hvac', 'ac-condenser.jpg')
      ],
      heating_furnace: [
        stock('hvac', 'furnace-heating.jpg')
      ],
      ductwork_air: [
        stock('hvac', 'ductwork-air.jpg')
      ],
      tuneup_diagnostics: [
        stock('hvac', 'hvac-tech.jpg'),
        stock('hvac', 'ac-condenser.jpg')
      ],
      hero: [
        stock('hvac', 'hvac-tech.jpg'),
        stock('hvac', 'ac-condenser.jpg')
      ],
      about: [
        stock('hvac', 'furnace-heating.jpg'),
        stock('hvac', 'ductwork-air.jpg')
      ]
    },
    'Tree Service': {
      removal_felling: [
        'https://images.unsplash.com/photo-1699391414255-3a10698f8d50?auto=format&fit=crop&w=800&q=80',
        stock('tree-service', 'storm-clearing.jpg')
      ],
      trimming_pruning: [
        stock('tree-service', 'trimming-pruning.jpg')
      ],
      emergency_storm: [
        stock('tree-service', 'storm-clearing.jpg')
      ],
      stump_grinding: [
        stock('tree-service', 'stump-grinding.jpg')
      ],
      hero: [
        'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80',
        stock('tree-service', 'storm-clearing.jpg')
      ],
      about: [
        stock('tree-service', 'storm-clearing.jpg'),
        stock('tree-service', 'trimming-pruning.jpg')
      ]
    },
    'Landscaping': {
      lawn_turf: [
        stock('landscaping', 'mulch-beds-planting.jpg'),
        stock('landscaping', 'grading-sod.jpg')
      ],
      grading_sod: [
        stock('landscaping', 'grading-sod.jpg')
      ],
      hardscaping_stone: [
        stock('landscaping', 'paver-patio-hardscape.jpg')
      ],
      hero: [
        stock('landscaping', 'paver-patio-hardscape.jpg'),
        stock('landscaping', 'mulch-beds-planting.jpg')
      ],
      about: [
        stock('landscaping', 'mulch-beds-planting.jpg'),
        stock('landscaping', 'grading-sod.jpg')
      ]
    },
    'Electricians': {
      panel_upgrade: [
        'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=800&q=80',
        'https://images.unsplash.com/photo-1741177364447-f79669c51f12?auto=format&fit=crop&w=800&q=80'
      ],
      lighting_fixtures: [
        'https://images.unsplash.com/photo-1660330589693-99889d60181e?auto=format&fit=crop&w=800&q=80'
      ],
      wiring_ev: [
        'https://images.unsplash.com/photo-1783419752280-46a2073ef7dc?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1544724569-5f546fd6f2b5?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1660330589693-99889d60181e?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'Asphalt Paving': {
      driveway_paving: [
        'https://images.unsplash.com/photo-1772852311587-329719989e2b?auto=format&fit=crop&w=800&q=80'
      ],
      commercial_parking: [
        'https://images.unsplash.com/photo-1784454936095-28042e9b1652?auto=format&fit=crop&w=800&q=80'
      ],
      roller_compaction: [
        'https://images.unsplash.com/photo-1561008218-7485044173e2?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1784454936095-28042e9b1652?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1561008218-7485044173e2?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'Foundation Repair': {
      piering_stabilization: [
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80'
      ],
      wall_crack_repair: [
        'https://images.unsplash.com/photo-1517646287270-a5a9ca602e5c?auto=format&fit=crop&w=800&q=80'
      ],
      waterproofing_drainage: [
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80'
      ],
      concrete_footing: [
        'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=800&q=80'
      ]
    },
    'Mechanical Contractor': {
      process_piping: [
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?auto=format&fit=crop&w=1200&q=80'
      ],
      welding_fabrication: [
        'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1574689049868-e94ed5301745?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80'
      ],
      waterjet_machining: [
        'https://images.unsplash.com/photo-1565043589221-1a6fd9ae45c7?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80'
      ],
      boilers_power_piping: [
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581094794329-c8112a89af12?auto=format&fit=crop&w=1200&q=80'
      ],
      hero: [
        'https://images.unsplash.com/photo-1504148455328-c376907d081c?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=1200&q=80'
      ],
      about: [
        'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1200&q=80',
        'https://images.unsplash.com/photo-1516937941344-00b4e0337589?auto=format&fit=crop&w=1200&q=80'
      ]
    }
  };
}

function normalizeTradeCategory(tradeStr) {
  const t = (tradeStr || '').toLowerCase();
  if (t.includes('mechanical') || t.includes('piping') || t.includes('welding') || t.includes('welder') || t.includes('fabricat') || t.includes('boiler') || t.includes('waterjet') || t.includes('chiller') || t.includes('process pipe') || t.includes('industrial pipe')) return 'Mechanical Contractor';
  if (t.includes('fence')) return 'Fencing';
  if (t.includes('roof')) return 'Roofing';
  if (t.includes('concrete') || t.includes('masonry')) return 'Concrete';
  if (t.includes('plumb')) return 'Plumbing';
  if (t.includes('hvac') || t.includes('heat') || t.includes('cooling') || t.includes('air cond')) return 'HVAC';
  if (t.includes('tree') || t.includes('arborist')) return 'Tree Service';
  if (t.includes('landscap') || t.includes('lawn')) return 'Landscaping';
  if (t.includes('electr')) return 'Electricians';
  if (t.includes('asphalt') || t.includes('paving')) return 'Asphalt Paving';
  if (t.includes('foundation') || t.includes('waterproof') || t.includes('basement')) return 'Foundation Repair';
  return 'Mechanical Contractor';
}

function getSlugSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < (str || '').length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
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

function getHexYiq(hexColor) {
  const raw = (hexColor || '#2563eb').replace('#', '').trim();
  const hex = raw.length === 3 ? raw.split('').map(c => c + c).join('') : raw;
  const r = parseInt(hex.substring(0, 2), 16) || 0;
  const g = parseInt(hex.substring(2, 4), 16) || 0;
  const b = parseInt(hex.substring(4, 6), 16) || 0;
  return ((r * 299) + (g * 587) + (b * 114)) / 1000;
}

function getContrastColor(hexColor) {
  return (getHexYiq(hexColor) >= 140) ? '#0f172a' : '#ffffff';
}

function normalizeHexColor(val, fallback) {
  if (!val || typeof val !== 'string') return fallback;
  const clean = val.trim().replace(/^#+/, '');
  return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?$/.test(clean) ? `#${clean}` : fallback;
}

function normalizePalette(palette, tradeKey, researchData) {
  const src = palette || {};
  const defaults = {
    tree: { primary: '#15803d', accent: '#d97706' },
    landscaping: { primary: '#15803d', accent: '#d97706' },
    fencing: { primary: '#9a3412', accent: '#f59e0b' },
    mechanical: { primary: '#dc2626', accent: '#f59e0b' },
    concrete: { primary: '#334155', accent: '#ea580c' },
    roofing: { primary: '#1e3a8a', accent: '#d97706' }
  }[tradeKey] || { primary: '#1e3a8a', accent: '#ea580c' };

  const primaryFallback = normalizeHexColor(researchData?.extractedColors?.[0], defaults.primary);
  const accentFallback = normalizeHexColor(researchData?.extractedColors?.[1], defaults.accent);
  const primary = normalizeHexColor(src.primary, primaryFallback);

  return {
    primary,
    primaryHover: normalizeHexColor(src.primaryHover, primary),
    secondary: normalizeHexColor(src.secondary, '#0f172a'),
    accent: normalizeHexColor(src.accent, accentFallback),
    background: normalizeHexColor(src.background, '#ffffff'),
    surface: normalizeHexColor(src.surface, '#ffffff'),
    border: normalizeHexColor(src.border, '#e2e8f0'),
    textPrimary: normalizeHexColor(src.textPrimary, '#111827'),
    textSecondary: normalizeHexColor(src.textSecondary, '#475569')
  };
}

function formatCityState(cityStr) {
  const raw = (cityStr || 'Appleton, WI').trim();
  const cityOnly = raw
    .replace(/,\s*WI\b/gi, '')
    .replace(/,\s*Wisconsin\b/gi, '')
    .replace(/\bfox\s+valley\b/gi, 'Fox Valley')
    .trim() || 'Appleton';
  const isFoxValley = /appleton|neenah|menasha|kaukauna|kimberly|little chute|oshkosh|fox valley/i.test(cityOnly);
  const isGreenBay = /green bay|de pere|howard|suamico|new franken|ashwaubenon|pulaski|luxemburg/i.test(cityOnly);
  const isRegionCity = /^fox\s+valley$/i.test(cityOnly);
  return {
    cityOnly,
    cityState: `${cityOnly}, WI`,
    isFoxValley,
    isGreenBay,
    regionShort: isFoxValley ? 'Fox Valley & NE Wisconsin' : (isGreenBay ? 'Greater Green Bay & NE Wisconsin' : 'Northeast Wisconsin'),
    regionLabel: isRegionCity ? 'Fox Valley' : (isFoxValley ? `${cityOnly} & Fox Valley` : `${cityOnly} & Northeast Wisconsin`),
    schemaCities: isGreenBay
      ? ['Green Bay', 'De Pere', 'Howard', 'Ashwaubenon']
      : Array.from(new Set(isRegionCity ? ['Appleton', 'Neenah', 'Menasha', 'Kaukauna'] : [cityOnly, 'Appleton', 'Neenah', 'Menasha', 'Kaukauna'])).slice(0, 4)
  };
}

function hasRealCustomServices(services) {
  if (!Array.isArray(services) || services.length < 3) return false;
  const nonEmpty = services.filter(s => s && String(s.name || '').trim() !== '');
  if (nonEmpty.length < 3) return false;
  const serialized = JSON.stringify(nonEmpty);
  return !/custom installations & upgrades|\(gemini 4 argon|withstand northeast wisconsin weather|primary .+ services/i.test(serialized);
}

function hasGenericPlaceholderVibe(vibe) {
  if (!vibe || typeof vibe !== 'string') return true;
  return /gemini 4 argon in antigravity ide/i.test(vibe);
}

function getTradeKey(trade) {
  const t = (trade || '').toLowerCase();
  if (/tree|arbor|stump|forestry|logging|canopy/.test(t)) return 'tree';
  if (/landscap|lawn|turf|hardscap|mulch/.test(t)) return 'landscaping';
  if (/mechanical|piping|welding|welder|fabricat|boiler|waterjet|chiller/.test(t)) return 'mechanical';
  if (/hvac|heat|cool|air cond|furnace|geothermal/.test(t)) return 'hvac';
  if (/fenc|post hole|deck/.test(t)) return 'fencing';
  if (/roof/.test(t)) return 'roofing';
  if (/concrete|flatwork|masonry|stamped/.test(t)) return 'concrete';
  if (/asphalt|paving|blacktop|sealcoat/.test(t)) return 'asphalt';
  if (/foundation|waterproof|basement|crawlspace/.test(t)) return 'foundation';
  if (/plumb|drain|sewer|water heater/.test(t)) return 'plumbing';
  if (/electric|wiring|panel|generator/.test(t)) return 'electrical';
  return 'generic';
}

const COMPARISON_FACTORS_BY_TRADE = {
  mechanical: [
    { factor: 'Certification & Code Standards', us: 'ASME & AWS Certified Code Welding + NSF-61', them: 'Uncertified field welds without code audit' },
    { factor: 'Testing & Fit-Up Precision', us: '100% Hydrostatic Testing & +/-0.008" CNC Tolerances', them: 'Untested lines & rough hand cuts' },
    { factor: 'Shop Capacity & Turnaround', us: '300+ Spools/Wk Shop Capacity + Prompt Quotes', them: '1 - 3 Weeks waiting with slow field fitting' },
    { factor: 'Workmanship Guarantee', us: 'Multi-Year Industrial Craftsmanship Warranty', them: '90-Day limited or none' }
  ],
  hvac: [
    { factor: 'Equipment Sizing & Efficiency', us: 'Manual J Load Calculations + High-SEER2 Systems', them: 'Rule-of-thumb guesswork & outdated units' },
    { factor: 'Installation & Airflow Integrity', us: 'Sealed Mastic Ductwork & Nitrogen-Purged Brazing', them: 'Tape patches & unpurged lines (acid build-up)' },
    { factor: 'Emergency Dispatch & Response', us: '24/7 Priority Dispatch Across NE Wisconsin', them: 'Voicemail delays during extreme cold/heat' },
    { factor: 'Parts & Labor Coverage', us: '10-Year Equipment Warranty + Local Workmanship', them: 'Basic 1-year limited coverage' }
  ],
  fencing: [
    { factor: 'Post Setting Depth & Anchoring', us: '48" Below Wisconsin Frost Line in Solid Compacted Concrete', them: '30" - 36" (Prone to frost heave & sagging)' },
    { factor: 'Structural Posts & Fasteners', us: 'PostMaster Steel / Ring-Shank Stainless Hardware', them: 'Untreated wood posts & galvanized nails (black streaks)' },
    { factor: 'Ground Contour Alignment', us: 'Custom Ground Contour Fitting & Reinforced Gate Latches', them: 'Stairstepped gaps & sagging standard gates' },
    { factor: 'Craftsmanship Warranty', us: 'Multi-Year Structural & Wind-Resistant Guarantee', them: '90-Day limited or none' }
  ],
  roofing: [
    { factor: 'Materials & Underlayment', us: 'Architectural Shingles + Ice & Water Barrier', them: 'Basic 15lb felt (prone to leaks)' },
    { factor: 'Flashing & Clean-Up', us: 'Heavy-Gauge Flashing + Magnetic Nail Sweep', them: 'Thin tin & loose nails in grass' },
    { factor: 'Turnaround Time', us: '24 - 48 Hours Written Proposal', them: '1 - 3 Weeks waiting' },
    { factor: 'Workmanship Warranty', us: 'Multi-Year Craftsmanship Warranty', them: '1-Year basic warranty' }
  ],
  tree: [
    { factor: 'Property & Lawn Protection', us: 'Controlled Rope Rigging, Turf Mats & Protected Drop Zones', them: 'Free-falling limbs risking roofs, fences & lawns' },
    { factor: 'Insurance & Safety Credentials', us: "Full Commercial Liability & Workers' Comp Coverage", them: 'Uninsured cash crews exposing homeowners to liability' },
    { factor: 'Debris & Stump Cleanup', us: 'Complete Limb Haul-Away, Chipping & Final Yard Rake', them: 'Unstacked brush piles & deep wheel ruts left behind' },
    { factor: 'Estimates & Scheduling', us: 'Clear Written Quote & Reliable Arrival Windows', them: 'Vague ballpark pricing & unannounced no-shows' }
  ],
  landscaping: [
    { factor: 'Grading & Drainage Prep', us: 'Laser-Checked Slope Grading & Heavy Geotextile Base', them: 'Shallow prep causing puddles & sinking pavers' },
    { factor: 'Materials & Plant Hardiness', us: 'Zone 4-5 Hardy Stock & Commercial-Grade Stone', them: 'Short-lived thin edging & uncompacted aggregate' },
    { factor: 'Property Respect & Finish', us: 'Crisp Bed Edges, Blown Walks & Complete Site Sweep', them: 'Soil tracks left across driveways & turf' },
    { factor: 'Schedule & Communication', us: 'Dedicated Crew Dates & Transparent Upfront Proposals', them: 'Half-finished beds & unanswered calls' }
  ],
  concrete: [
    { factor: 'Base Preparation', us: '6" Compacted Crushed Gravel Base', them: 'Thin sand or raw dirt' },
    { factor: 'Reinforcement & Mix', us: 'Tied Rebar Grid + Air-Entrained 4,000+ PSI Mix', them: 'Unreinforced or wire laid on ground' },
    { factor: 'Turnaround Time', us: '24 - 48 Hours Written Proposal', them: '1 - 3 Weeks waiting' },
    { factor: 'Workmanship Warranty', us: 'Multi-Year Structural & Freeze-Thaw Warranty', them: '90-Day limited' }
  ],
  asphalt: [
    { factor: 'Sub-Base Compaction', us: 'Dense Compacted Crushed Limestone Base & Proper Crown', them: 'Thin hot-mix laid over soft dirt' },
    { factor: 'Mat Thickness & Seams', us: 'Uniform Compacted Lift Depth & Tamped Edges', them: 'Thin edges that crumble after one winter' },
    { factor: 'Drainage Pitch', us: 'Laser-Verified Runoff Slope Away From Structures', them: 'Standing water low spots along garage doors' },
    { factor: 'Turnaround & Warranty', us: 'Written On-Site Quote & Workmanship Guarantee', them: 'Fly-by-night crews with zero callbacks' }
  ],
  foundation: [
    { factor: 'Root-Cause Engineering', us: 'Full Structural Wall & Hydrostatic Pressure Assessment', them: 'Surface caulk patches that peel within months' },
    { factor: 'Bracing & Water Control', us: 'Steel Wall Bracing, Drain Tile & Sealed Sump Systems', them: 'Undersized brackets & exterior-only guesswork' },
    { factor: 'Basement Cleanliness', us: 'Dust containment & Clean Floor Restoration', them: 'Jackhammer slurry tracked upstairs' },
    { factor: 'Warranty Documentation', us: 'Written Specifications & Transferable Structural Warranty', them: 'Verbal promises with no documentation' }
  ],
  plumbing: [
    { factor: 'Licensing & Code Compliance', us: 'State-Licensed Plumbers & Full Code Inspection', them: 'Unpermitted handyman shortcuts' },
    { factor: 'Piping & Valve Quality', us: 'Type L Copper, PEX-A & Quarter-Turn Brass Valves', them: 'Thin plastic shutoffs & temporary compression fixes' },
    { factor: 'Home & Floor Protection', us: 'Boot Covers, Drop Cloths & Spotless Area Cleanup', them: 'Water marks & messy drain cleanups' },
    { factor: 'Pricing Transparency', us: 'Upfront Written Pricing Before Work Starts', them: 'Surprise hourly markups & trip fees' }
  ],
  electrical: [
    { factor: 'NEC Code & Permitting', us: 'Master Electrician Oversight & Full NEC 2023 Compliance', them: 'Overloaded circuits & unpermitted splices' },
    { factor: 'Panels & Connections', us: 'Cleanly Labeled Commercial Breakers & Torqued Lugs', them: 'Mixed breakers & messy panel boxes' },
    { factor: 'Safety Testing', us: 'Load Calculations, Grounding & AFCI/GFCI Verification', them: 'Quick device swaps with no circuit load test' },
    { factor: 'Scheduling & Quotes', us: 'Itemized Written Estimates & On-Time Arrivals', them: 'Open-ended billing with long delays' }
  ],
  generic: [
    { factor: 'Credentials & Insurance', us: 'Fully Insured, Local Professionals', them: 'Unverified subcontractors' },
    { factor: 'Workmanship Standards', us: 'Detailed Quality Checks & Reliable Equipment', them: 'Rushed shortcuts to cut corners' },
    { factor: 'Site Cleanup', us: 'Thorough Job-Site Cleanup Before Departure', them: 'Mess and debris left behind' },
    { factor: 'Estimates & Communication', us: 'Clear Written Quotes & Responsive Local Scheduling', them: 'Hidden fees & slow callbacks' }
  ]
};

function getComparisonFactors(trade) {
  return COMPARISON_FACTORS_BY_TRADE[getTradeKey(trade)] || COMPARISON_FACTORS_BY_TRADE.generic;
}

function getTradeCopyProfile(trade, bizName, rawCity, serviceArea) {
  const key = getTradeKey(trade);
  const cityInfo = formatCityState(rawCity);
  const cityOnly = cityInfo.cityOnly;
  const city = cityInfo.cityState;
  const cleanRawTrade = (trade || 'Home Service').replace(/\s*contractor\b/gi, '').trim() || 'Home Service';
  const defaultDisplayTrade = cleanRawTrade.replace(/\b\w/g, c => c.toUpperCase());

  const profiles = {
    tree: {
      displayTrade: 'Tree Service',
      headerSub: `Tree Care & Removal • ${city}`,
      heroEyebrow: `Safe Tree Care, Pruning & Removal • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Full Liability Insured & Safety-First Crew',
      heroCardLabel: 'Field Crew in Action',
      heroCardFallbackTitle: `Safe Tree Removal & Canopy Care in ${cityOnly}`,
      heroCardSubtitle: 'Precision rigging, hazardous takedowns & complete brush haul-away.',
      fortressEyebrow: `${cityOnly}'s Trusted Standard for Safe Tree Care`,
      fortressFallbackOwnerStory: `Trusted tree removal, canopy pruning, stump grinding, and storm cleanup backed by full insurance and spotless cleanup across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Tree Service & Quote Estimator',
      estimatorSubtitle: 'Tell us about your trees or yard for a fast, transparent quote.',
      estimatorScopeLabel: 'Tree / Job Size',
      estimatorDefaultTypes: ['Hazardous Tree Removal', 'Tree Trimming & Pruning', 'Stump Grinding', 'Storm Damage Cleanup'],
      estimatorScopeOptions: [
        { value: '1 Small-Med Tree', label: '1 Small or Medium Tree' },
        { value: '1 Large Tree', label: '1 Large or Overhanging Tree' },
        { value: 'Multi-Tree / Lot', label: 'Multiple Trees or Lot Clearing' },
        { value: 'Stump / Storm Cleanup', label: 'Stump Grinding / Storm Cleanup' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Tree Care`,
      servicesHeading: 'Safe, Controlled Tree Services',
      servicesSubtitle: 'Controlled rigging, seasonal pruning, below-grade stump grinding, and spotless property cleanup.',
      serviceCardCta: 'Explore Service Details',
      defaultBadge: 'Arborist Service',
      aboutEyebrow: 'Local Tree Care Heritage',
      aboutHeading: 'Built on Safety, Precision & Clean Yards',
      aboutQuote: `We treat every tree removal and pruning job with the safety, rigging care, and thorough yard cleanup we'd expect on our own property. Careful cuts, full insurance, zero shortcuts.`,
      galleryEyebrow: `${cityOnly} Field Work`,
      galleryHeading: 'Completed Tree Care & Removal Work',
      gallerySubtitle: `Recent tree removals, pruning, and yard cleanups across ${serviceArea || city}.`,
      galleryAltPrefix: 'Completed Tree Care Job',
      galleryCardPrefix: 'Field Job #',
      comparisonEyebrow: 'Safety & Cleanup Standard',
      comparisonHeading: `${bizName} vs Low-Bid Tree Crews`,
      comparisonFactorCol: 'Safety & Service Factor',
      comparisonThemCol: 'Uninsured Cut-Rate Crews',
      ctaBadge: 'Fully Insured Crews • Free On-Site Tree Assessments',
      ctaHeadline: 'Need Safe Tree Removal, Trimming, or Stump Grinding?',
      ctaBullet1: 'Controlled Rigging & Complete Cleanup',
      summaryRole: 'trusted local tree service',
      servicesPageEyebrow: 'Tree Care Capabilities',
      servicesPageHeading: 'Complete Tree Care & Removal Services',
      servicesPageSubtitle: 'Every job is handled with proper rigging equipment, full liability insurance, and thorough debris cleanup.',
      aboutPageTitleSuffix: `${cityOnly} Tree Service`,
      aboutSecondaryParagraph: `We take pride in setting a higher bar for tree care safety and dependability across ${cityInfo.regionLabel}. From clear written quotes and controlled limb rigging to complete brush and chipper cleanup, we protect your home and leave your yard looking great.`,
      contactMsgPlaceholder: 'Describe the tree size, location near buildings or lines, stump work needed, and your address...',
      llmsPortfolioLabel: 'Tree Services & Capabilities',
      fallbackAestheticVibe: 'Rich Evergreen Forestry & Safe Arboriculture',
      fallbackTagline: `Safe Tree Removal & Canopy Care in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} provides dependable tree removal, precision pruning, stump grinding, and rapid storm cleanup for homeowners and businesses across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'Safe Tree Removal', desc: `Controlled rigging and sectional takedowns for hazardous, dead, or unwanted trees near structures across ${cityOnly}. Full brush cleanup included.`, badge: 'Most Popular' },
        { name: 'Tree Trimming & Pruning', desc: `Healthy canopy thinning, roofline clearance, and deadwood removal tailored to keep trees strong through Wisconsin storms and seasons.`, badge: 'Seasonal Care' },
        { name: 'Stump Grinding & Storm Clearing', desc: `Deep below-grade stump grinding and fast emergency downed-limb response so your lawn stays safe, level, and clean.`, badge: 'Fast Response' }
      ]
    },
    landscaping: {
      displayTrade: 'Landscaping',
      headerSub: `Landscaping & Grounds • ${city}`,
      heroEyebrow: `Custom Outdoor Living & Grounds Care • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Hardy Zone 4-5 Materials & Clean Grading',
      heroCardLabel: 'Featured Property Project',
      heroCardFallbackTitle: `Custom Hardscapes & Lawn Care in ${cityOnly}`,
      heroCardSubtitle: 'Clean property grading, stonework & four-season curb appeal.',
      fortressEyebrow: `${cityOnly}'s Standard for Grounds & Outdoor Living`,
      fortressFallbackOwnerStory: `Dependable landscape design, hardscaping, drainage grading, and property maintenance across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Landscaping Quote Estimator',
      estimatorSubtitle: 'Share your property goals for an upfront estimate and walkthrough.',
      estimatorScopeLabel: 'Property Scope',
      estimatorDefaultTypes: ['Hardscape Patio / Walk', 'Retaining Wall & Grading', 'Planting & Mulch Refresh', 'Ongoing Grounds Care'],
      estimatorScopeOptions: [
        { value: 'Front Beds / Refresh', label: 'Front Yard / Entry Bed Refresh' },
        { value: 'Patio or Wall', label: 'Backyard Patio or Retaining Wall' },
        { value: 'Full Yard Makeover', label: 'Full Property Design & Grading' },
        { value: 'Commercial Maintenance', label: 'Commercial Grounds Maintenance' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Specialties`,
      servicesHeading: 'Tailored Landscaping & Hardscaping',
      servicesSubtitle: 'Thoughtful drainage grading, durable stonework, and healthy plantings built for Midwest seasons.',
      serviceCardCta: 'Explore Service Details',
      defaultBadge: 'Outdoor Service',
      aboutEyebrow: 'Our Wisconsin Roots',
      aboutHeading: 'Crafted Curb Appeal & Clean Properties',
      aboutQuote: `We treat every yard and hardscape project with crisp edges, proper drainage grading, and clean site habits we'd expect at our own home.`,
      galleryEyebrow: `${cityOnly} Portfolio`,
      galleryHeading: 'Completed Landscape Projects',
      gallerySubtitle: `Recent patios, walls, and property cleanups completed across ${serviceArea || city}.`,
      galleryAltPrefix: 'Landscaping Project',
      galleryCardPrefix: 'Property Project #',
      comparisonEyebrow: 'Grounds & Hardscape Standard',
      comparisonHeading: `${bizName} vs Low-Bid Lawn Crews`,
      comparisonFactorCol: 'Design & Durability Factor',
      comparisonThemCol: 'Cut-Rate Crews',
      ctaBadge: 'Custom Design & Clean Grading • Free Walkthroughs',
      ctaHeadline: 'Ready to Upgrade Your Yard, Patio, or Property?',
      ctaBullet1: 'Proper Drainage & Compacted Stone Bases',
      summaryRole: 'local landscaping contractor',
      servicesPageEyebrow: 'Landscaping Portfolio',
      servicesPageHeading: 'Complete Landscaping & Hardscape Capabilities',
      servicesPageSubtitle: 'Thoughtful grading, durable hardscapes, and clean finishing tailored to Northeast Wisconsin properties.',
      aboutPageTitleSuffix: `${cityOnly} Landscaping`,
      aboutSecondaryParagraph: `We take pride in delivering tidy, lasting outdoor work across ${cityInfo.regionLabel}—from honest written estimates through spotless final cleanup.`,
      contactMsgPlaceholder: 'Describe your yard, patio, drainage, or planting goals and property address...',
      llmsPortfolioLabel: 'Landscaping Services & Capabilities',
      fallbackAestheticVibe: 'Natural Stone & Evergreen Landscape Craft',
      fallbackTagline: `Custom Hardscapes & Grounds Care in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} helps homeowners and commercial properties across ${cityInfo.regionLabel} transform outdoor spaces with dependable grading, hardscapes, and lawn care.`,
      fallbackServices: [
        { name: 'Patios & Retaining Walls', desc: `Precision-leveled paver patios, walkways, and segmental retaining walls built on compacted aggregate bases across ${cityOnly}.`, badge: 'Most Popular' },
        { name: 'Landscape Design & Planting', desc: `Fresh mulch beds, edging, native shrubs, and yard grading tailored for clean four-season curb appeal.`, badge: 'Residential' },
        { name: 'Grading & Property Cleanups', desc: `Spring/fall leaf clearing, topsoil re-grading, and drainage corrections with prompt turnaround.`, badge: 'Free Estimates' }
      ]
    },
    fencing: {
      displayTrade: 'Fencing',
      headerSub: `Fencing Specialists • ${city}`,
      heroEyebrow: `Wood, Vinyl & Metal Fence Installations • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Deep Frost-Line Footings & Straight Lines',
      heroCardLabel: 'Featured Fence Build',
      heroCardFallbackTitle: `Custom Privacy & Perimeter Fencing in ${cityOnly}`,
      heroCardSubtitle: 'Frost-depth concrete post footings, plumb rails & heavy-duty gates.',
      fortressEyebrow: `${cityOnly}'s Benchmark for Lasting Fence Builds`,
      fortressFallbackOwnerStory: `Custom cedar, vinyl, chain link, and ornamental iron fences engineered to stand straight through Wisconsin frost heave across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Instant Fence & Material Estimator',
      estimatorSubtitle: 'Select your fence material and approximate length for a fast quote.',
      estimatorScopeLabel: 'Approx. Footage',
      estimatorDefaultTypes: ['Cedar Privacy Fence', 'White Vinyl Privacy', 'Black Chain Link', 'Ornamental Aluminum / Iron'],
      estimatorScopeOptions: [
        { value: '25-50 ft', label: '25 - 50 Linear Feet' },
        { value: '50-100 ft', label: '50 - 100 Linear Feet' },
        { value: '100-200 ft', label: '100 - 200 Linear Feet' },
        { value: '200+ ft', label: '200+ Linear Feet (Full Yard)' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Specialties`,
      servicesHeading: 'Specialized Fence & Gate Installations',
      servicesSubtitle: 'Posts anchored below the 48-inch frost line with heavy-duty gates and straight property lines.',
      serviceCardCta: 'Explore Fence Specs',
      defaultBadge: 'Fence Installation',
      aboutEyebrow: 'Our Wisconsin Story',
      aboutHeading: 'Built on Straight Lines & Deep Footings',
      aboutQuote: `We build every fence and gate with deep-set posts, corrosion-resistant fasteners, and clean craftsmanship we'd want around our own backyard.`,
      galleryEyebrow: `${cityOnly} Projects`,
      galleryHeading: 'Completed Client Fence Builds',
      gallerySubtitle: `Recent wood, vinyl, and metal fence installations across ${serviceArea || city}.`,
      galleryAltPrefix: 'Completed Fence Project',
      galleryCardPrefix: 'Fence Build #',
      comparisonEyebrow: 'The Wisconsin Standard',
      comparisonHeading: `${bizName} vs Budget Fence Crews`,
      comparisonFactorCol: 'Structural & Material Factor',
      comparisonThemCol: 'Typical Budget Installers',
      ctaBadge: '48" Frost-Depth Footings • Zero Obligation Quotes',
      ctaHeadline: 'Ready for a Straight, Storm-Strong Fence & Gate?',
      ctaBullet1: 'Posts Set Below the Frost Line',
      summaryRole: 'local fencing contractor',
      servicesPageEyebrow: 'Fencing Portfolio',
      servicesPageHeading: 'Complete Fencing & Gate Capabilities',
      servicesPageSubtitle: 'Every fence installation uses heavy-gauge posts and frost-depth footings designed for Wisconsin seasons.',
      aboutPageTitleSuffix: `${cityOnly} Fence Contractor`,
      aboutSecondaryParagraph: `We take pride in setting a higher bar for fencing craftsmanship in Wisconsin—from property line marking and utility locates to clean post hole dirt removal.`,
      contactMsgPlaceholder: 'Share approximate linear feet, preferred material (wood, vinyl, chain link, iron), gate count, and address...',
      llmsPortfolioLabel: 'Fencing Services & Build Specs',
      fallbackAestheticVibe: 'Warm Cedar Timber & Perimeter Craftsmanship',
      fallbackTagline: `Custom Cedar, Vinyl & Metal Fencing in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} installs straight, frost-resistant residential and commercial fences backed by deep concrete footings and dependable local crews across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'Custom Cedar & Wood Fencing', desc: `Hand-built Western Red Cedar privacy and shadowbox fences set on deep frost-line footings across ${cityOnly}.`, badge: 'Most Popular' },
        { name: 'Low-Maintenance Vinyl Fencing', desc: `Clean residential and pool-code PVC privacy fencing engineered against sun fading and heavy wind loads.`, badge: 'No Maintenance' },
        { name: 'Chain Link & Security Gates', desc: `Heavy-gauge commercial and backyard pet enclosures with smooth-swinging reinforced gates and latches.`, badge: 'Commercial & Pet' }
      ]
    },
    roofing: {
      displayTrade: 'Roofing',
      headerSub: `Roofing Specialists • ${city}`,
      heroEyebrow: `Residential & Commercial Roofing Systems • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Ice-Dam Shielding & Magnetic Yard Sweep',
      heroCardLabel: 'Featured Roof Replacement',
      heroCardFallbackTitle: `Complete Roof Replacement & Storm Protection in ${cityOnly}`,
      heroCardSubtitle: 'Full ice-and-water membrane, ridge ventilation & spotless magnetic sweep.',
      fortressEyebrow: `${cityOnly}'s Benchmark for Weather-Tight Roofing`,
      fortressFallbackOwnerStory: `Code-compliant architectural shingle, standing seam metal, and flat commercial roofing built to beat ice dams and high winds across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Instant Roof Estimate Calculator',
      estimatorSubtitle: 'Choose your roof type and home size for a fast written inspection quote.',
      estimatorScopeLabel: 'Approx. Roof Size',
      estimatorDefaultTypes: ['Architectural Shingle Roof', 'Standing Seam Metal', 'Flat / EPDM / TPO Roof', 'Storm Damage / Leak Repair'],
      estimatorScopeOptions: [
        { value: 'Garage / Porch', label: 'Garage or Porch (~500-1,000 sq ft)' },
        { value: 'Standard Home', label: 'Standard Home (1,200-2,200 sq ft)' },
        { value: 'Large Home', label: 'Large Home (2,400+ sq ft)' },
        { value: 'Commercial Building', label: 'Commercial Flat / Low-Slope Roof' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Roofing`,
      servicesHeading: 'Weather-Tight Roofing Systems',
      servicesSubtitle: 'Built with ice-and-water barrier, proper attic airflow, and heavy-gauge valley flashing.',
      serviceCardCta: 'Explore Roofing Specs',
      defaultBadge: 'Roofing System',
      aboutEyebrow: 'Our Wisconsin Story',
      aboutHeading: 'Built on Solid Decking & Honest Inspections',
      aboutQuote: `We inspect every roof deck thoroughly and install proper ice-and-water underlayment we'd trust over our own family's heads.`,
      galleryEyebrow: `${cityOnly} Roofing Portfolio`,
      galleryHeading: 'Completed Roof Installations',
      gallerySubtitle: `Recent tear-offs, metal roofs, and repairs across ${serviceArea || city}.`,
      galleryAltPrefix: 'Completed Roof Project',
      galleryCardPrefix: 'Roof Project #',
      comparisonEyebrow: 'The Wisconsin Roofing Standard',
      comparisonHeading: `${bizName} vs Budget Roofers`,
      comparisonFactorCol: 'Underlayment & Install Factor',
      comparisonThemCol: 'Typical Budget Crews',
      ctaBadge: 'Storm-Rated Systems • Free Roof Inspections',
      ctaHeadline: 'Need a Honest Roof Inspection, Repair, or Tear-Off?',
      ctaBullet1: 'Full Ice-and-Water Membrane & Nail Sweep',
      summaryRole: 'licensed local roofing contractor',
      servicesPageEyebrow: 'Roofing Capabilities',
      servicesPageHeading: 'Complete Residential & Commercial Roofing',
      servicesPageSubtitle: 'Every roof system is installed to manufacturer specs with full underlayment protection and clean nail sweeps.',
      aboutPageTitleSuffix: `${cityOnly} Roofing Contractor`,
      aboutSecondaryParagraph: `From transparent photo inspections to thorough magnetic nail sweeps across driveways and lawns, ${bizName} makes roof replacement stress-free.`,
      contactMsgPlaceholder: 'Mention roof age, leaks, shingle vs metal preference, storm damage, and property address...',
      llmsPortfolioLabel: 'Roofing Systems & Capabilities',
      fallbackAestheticVibe: 'Bold High-Contrast Roofing Protection',
      fallbackTagline: `Weather-Tight Shingle & Metal Roofing in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} protects homes and commercial buildings across ${cityInfo.regionLabel} with complete roof tear-offs, storm restoration, and honest written estimates.`,
      fallbackServices: [
        { name: 'Architectural Shingle Tear-Offs', desc: `Complete shingle replacements with full synthetic felt, ice-and-water eave shielding, and balanced ridge ventilation across ${cityOnly}.`, badge: 'Most Popular' },
        { name: 'Standing Seam Metal Roofing', desc: `Concealed-fastener structural steel roofing engineered to shed heavy snow loads and resist decades of high winds.`, badge: 'Long-Life System' },
        { name: 'Roof Repairs & Storm Response', desc: `Prompt leak diagnostics, chimney flashing upgrades, and hail/wind claim inspections with clear photos.`, badge: 'Free Inspections' }
      ]
    },
    concrete: {
      displayTrade: 'Concrete',
      headerSub: `Concrete & Flatwork • ${city}`,
      heroEyebrow: `Structural Flatwork & Stamped Concrete • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: '6" Compacted Base & 4,000+ PSI Rebar Mix',
      heroCardLabel: 'Featured Concrete Pour',
      heroCardFallbackTitle: `Reinforced Driveways & Stamped Patios in ${cityOnly}`,
      heroCardSubtitle: 'Tied rebar grids, compacted gravel base & clean control joints.',
      fortressEyebrow: `${cityOnly}'s Benchmark for Freeze-Thaw Concrete`,
      fortressFallbackOwnerStory: `Heavily reinforced concrete driveways, aprons, foundations, and decorative stamped patios poured to withstand harsh freeze-thaw seasons across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Instant Concrete Pour Estimator',
      estimatorSubtitle: 'Choose your flatwork type and approximate size for an on-site quote.',
      estimatorScopeLabel: 'Approx. Area',
      estimatorDefaultTypes: ['Concrete Driveway', 'Stamped / Colored Patio', 'Garage Floor / Apron', 'Sidewalk / Steps Repair'],
      estimatorScopeOptions: [
        { value: '< 300 sq ft', label: 'Walkway / Small Pad (< 300 sq ft)' },
        { value: '300-700 sq ft', label: 'Patio or Apron (300 - 700 sq ft)' },
        { value: '700-1,500 sq ft', label: 'Standard Driveway (700 - 1,500 sq ft)' },
        { value: '1,500+ sq ft', label: 'Commercial / Large Slab (1,500+ sq ft)' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Flatwork`,
      servicesHeading: 'Rebar-Reinforced Concrete Solutions',
      servicesSubtitle: 'Proper sub-grade excavation, compacted crushed stone base, and air-entrained mixes.',
      serviceCardCta: 'Explore Pour Specs',
      defaultBadge: 'Concrete Work',
      aboutEyebrow: 'Our Wisconsin Roots',
      aboutHeading: 'Built on Solid Sub-Bases & Crisp Finishes',
      aboutQuote: `We prep every slab with compacted crushed gravel, tied rebar, and proper drainage pitch so your driveway or patio stays flat for decades.`,
      galleryEyebrow: `${cityOnly} Concrete Portfolio`,
      galleryHeading: 'Completed Concrete Pours',
      gallerySubtitle: `Driveways, stamped patios, and commercial slabs poured across ${serviceArea || city}.`,
      galleryAltPrefix: 'Completed Concrete Pour',
      galleryCardPrefix: 'Concrete Pour #',
      comparisonEyebrow: 'The Structural Standard',
      comparisonHeading: `${bizName} vs Budget Flatwork Crews`,
      comparisonFactorCol: 'Sub-Base & Mix Factor',
      comparisonThemCol: 'Typical Low-Bid Crews',
      ctaBadge: 'Air-Entrained 4,000+ PSI Mix • Free Site Estimates',
      ctaHeadline: 'Ready for a Crack-Resistant Driveway or Patio?',
      ctaBullet1: '6" Compacted Base & Rebar Reinforcement',
      summaryRole: 'local concrete and flatwork contractor',
      servicesPageEyebrow: 'Concrete Portfolio',
      servicesPageHeading: 'Complete Concrete & Flatwork Capabilities',
      servicesPageSubtitle: 'Every pour is formed on compacted aggregate with proper reinforcement and sealer protection.',
      aboutPageTitleSuffix: `${cityOnly} Concrete Contractor`,
      aboutSecondaryParagraph: `From tear-out and gravel compaction through saw-cutting and sealing, ${bizName} handles every pour across ${cityInfo.regionLabel} without shortcuts.`,
      contactMsgPlaceholder: 'Share project type (driveway, patio, apron), rough dimensions in sq ft, and address...',
      llmsPortfolioLabel: 'Concrete Services & Pour Specs',
      fallbackAestheticVibe: 'Heavy Granite Industrial Concrete Craft',
      fallbackTagline: `Structural Concrete Driveways & Stamped Patios in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} pours durable, rebar-reinforced driveways, patios, slabs, and sidewalks across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'Poured Concrete Driveways', desc: `Excavation, 6-inch compacted gravel base, rebar reinforcement, and broomed high-PSI concrete driveways across ${cityOnly}.`, badge: 'Most Popular' },
        { name: 'Stamped & Decorative Patios', desc: `Custom stone patterns, integral colors, and weather-sealed outdoor patios built to resist salt and frost heaving.`, badge: 'Custom Outdoor' },
        { name: 'Garage Floors & Commercial Slabs', desc: `Laser-leveled interior flatwork, steps, and tear-out replacements finished on schedule with clean grading.`, badge: 'Free Estimates' }
      ]
    },
    asphalt: {
      displayTrade: 'Asphalt Paving',
      headerSub: `Asphalt Paving • ${city}`,
      heroEyebrow: `Residential Driveways & Commercial Lots • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Compacted Limestone Base & Dense Hot-Mix',
      heroCardLabel: 'Featured Paving Project',
      heroCardFallbackTitle: `Smooth Asphalt Driveways & Parking Lots in ${cityOnly}`,
      heroCardSubtitle: 'Laser-graded crushed base, hot-mix paving & clean roller compaction.',
      fortressEyebrow: `${cityOnly}'s Standard for Lasting Blacktop`,
      fortressFallbackOwnerStory: `Commercial-grade asphalt paving, driveway resurfacing, patching, and sealcoating across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Instant Asphalt Scope Estimator',
      estimatorSubtitle: 'Choose your paving project and driveway size for a fast on-site quote.',
      estimatorScopeLabel: 'Driveway / Lot Size',
      estimatorDefaultTypes: ['New Asphalt Driveway', 'Asphalt Resurfacing / Overlay', 'Parking Lot Paving', 'Sealcoating & Crack Fill'],
      estimatorScopeOptions: [
        { value: 'Single Driveway', label: 'Single Driveway (~500-800 sq ft)' },
        { value: 'Double Driveway', label: 'Double Driveway (800-1,800 sq ft)' },
        { value: 'Long Rural Lane', label: 'Long Lane / Acreage Driveway' },
        { value: 'Commercial Lot', label: 'Commercial Parking Lot' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Paving`,
      servicesHeading: 'Precision Asphalt Paving & Maintenance',
      servicesSubtitle: 'Proper water pitch, heavy base compaction, and smooth hot-mix blacktop.',
      serviceCardCta: 'Explore Paving Specs',
      defaultBadge: 'Asphalt Service',
      aboutEyebrow: 'Our Wisconsin Story',
      aboutHeading: 'Compacted Sub-Bases & Crisp Edges',
      aboutQuote: `Every driveway and parking lot depends on what sits underneath it—we compact the gravel base right and lay full-depth hot-mix.`,
      galleryEyebrow: `${cityOnly} Paving Gallery`,
      galleryHeading: 'Completed Paving Projects',
      gallerySubtitle: `Recent residential driveways and commercial parking lots across ${serviceArea || city}.`,
      galleryAltPrefix: 'Completed Asphalt Project',
      galleryCardPrefix: 'Paving Project #',
      comparisonEyebrow: 'The Paving Standard',
      comparisonHeading: `${bizName} vs Low-Bid Blacktop Crews`,
      comparisonFactorCol: 'Base & Compaction Factor',
      comparisonThemCol: 'Drive-By Low-Bid Crews',
      ctaBadge: 'Full-Depth Hot-Mix • Free On-Site Measurements',
      ctaHeadline: 'Need Smooth, Long-Lasting Asphalt Paving?',
      ctaBullet1: 'Laser-Graded Drainage & Tamped Edges',
      summaryRole: 'local asphalt paving contractor',
      servicesPageEyebrow: 'Paving Capabilities',
      servicesPageHeading: 'Complete Asphalt Paving & Sealcoating',
      servicesPageSubtitle: 'Compacted aggregate bases and hot-mix asphalt engineered for heavy vehicles and snow plowing.',
      aboutPageTitleSuffix: `${cityOnly} Paving Contractor`,
      aboutSecondaryParagraph: `From old driveway removal through base grading and finish rolling, ${bizName} delivers clean, durable blacktop across ${cityInfo.regionLabel}.`,
      contactMsgPlaceholder: 'Share driveway/lot size, current condition, and your property address...',
      llmsPortfolioLabel: 'Asphalt Paving & Services',
      fallbackAestheticVibe: 'Industrial Slate & Clean Hot-Mix Paving',
      fallbackTagline: `Durable Asphalt Driveways & Parking Lots in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} delivers smooth, properly drained asphalt paving, overlays, and lot maintenance across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'New Driveway Paving', desc: `Full excavation, graded crushed stone base, and heavy-compacted residential blacktop driveways across ${cityOnly}.`, badge: 'Most Popular' },
        { name: 'Parking Lots & Resurfacing', desc: `Commercial asphalt overlays, patching, and striped traffic areas built for heavy delivery trucks and plows.`, badge: 'Commercial' },
        { name: 'Crack Filling & Sealcoating', desc: `Protective asphalt sealing and hot-rubber crack repair to block moisture intrusion and extend pavement life.`, badge: 'Preventative' }
      ]
    },
    foundation: {
      displayTrade: 'Foundation Repair',
      headerSub: `Foundation & Basement • ${city}`,
      heroEyebrow: `Structural Foundation & Waterproofing • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Engineered Wall Bracing & Dry Basements',
      heroCardLabel: 'Featured Structural Repair',
      heroCardFallbackTitle: `Permanent Foundation Bracing & Basement Waterproofing in ${cityOnly}`,
      heroCardSubtitle: 'Steel I-beam stabilization, epoxy crack sealing & perimeter drain tile.',
      fortressEyebrow: `${cityOnly}'s Trusted Structural Foundation Experts`,
      fortressFallbackOwnerStory: `Permanent basement wall stabilization, hydrostatic drainage systems, and concrete crack repair protecting homes across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Foundation Assessment Request',
      estimatorSubtitle: 'Tell us what symptoms you see in your basement for an honest evaluation.',
      estimatorScopeLabel: 'Primary Issue',
      estimatorDefaultTypes: ['Bowing Basement Walls', 'Water Seepage / Drain Tile', 'Foundation Wall Cracks', 'Sinking Footing / Slab'],
      estimatorScopeOptions: [
        { value: 'Wall Crack', label: 'Hairline or Leaking Wall Crack' },
        { value: 'Bowing Wall', label: 'Bowing or Leaning Basement Wall' },
        { value: 'Water / Sump', label: 'Basement Water or Sump Backup' },
        { value: 'Settling Slab', label: 'Settling Floor or Slab Lifting' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Structural Care`,
      servicesHeading: 'Permanent Foundation & Drainage Repairs',
      servicesSubtitle: 'Stopping hydrostatic pressure, inward wall movement, and basement moisture at the source.',
      serviceCardCta: 'Explore Repair Methods',
      defaultBadge: 'Structural Repair',
      aboutEyebrow: 'Structural Integrity First',
      aboutHeading: 'Honest Diagnostics & Permanent Fixes',
      aboutQuote: `We diagnose why water or clay soil is pushing on your foundation—and fix the structural root cause rather than selling unnecessary extras.`,
      galleryEyebrow: `${cityOnly} Case Studies`,
      galleryHeading: 'Completed Structural Repairs',
      gallerySubtitle: `Verified wall stabilization and waterproofing work across ${serviceArea || city}.`,
      galleryAltPrefix: 'Foundation Repair Project',
      galleryCardPrefix: 'Repair Case #',
      comparisonEyebrow: 'Structural Engineering Standard',
      comparisonHeading: `${bizName} vs Quick-Patch Crews`,
      comparisonFactorCol: 'Engineering & Drainage Factor',
      comparisonThemCol: 'Cosmetic Patch Crews',
      ctaBadge: 'Honest Structural Audits • Written Estimates',
      ctaHeadline: 'Concerned About Basement Cracks, Water, or Bowing Walls?',
      ctaBullet1: 'Root-Cause Structural Inspection',
      summaryRole: 'foundation repair & waterproofing specialist',
      servicesPageEyebrow: 'Structural Capabilities',
      servicesPageHeading: 'Complete Foundation & Waterproofing Solutions',
      servicesPageSubtitle: 'Code-compliant structural wall bracing, perimeter drain tile, and crack sealing built for clay soils.',
      aboutPageTitleSuffix: `${cityOnly} Foundation Specialists`,
      aboutSecondaryParagraph: `With dust-controlled work zones and honest engineering evaluations, ${bizName} protects homeowner equity across ${cityInfo.regionLabel}.`,
      contactMsgPlaceholder: 'Describe wall cracks, bowing, water seepage spots, and your property address...',
      llmsPortfolioLabel: 'Foundation Services & Repair Specs',
      fallbackAestheticVibe: 'Deep Steel Structural Trust & Protection',
      fallbackTagline: `Permanent Foundation & Waterproofing in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} helps homeowners across ${cityInfo.regionLabel} protect their basements from clay-soil pressure, bowing walls, and groundwater seepage.`,
      fallbackServices: [
        { name: 'Steel Wall Stabilization & Bracing', desc: `Heavy-duty structural bracing and straightening for bowing or inward-leaning basement walls across ${cityOnly}.`, badge: 'Structural' },
        { name: 'Interior Drain Tile & Sumps', desc: `Full perimeter weeping tile, clean gravel trenching, and backup sump pumps to keep basements bone-dry year-round.`, badge: 'Waterproofing' },
        { name: 'Crack Injection & Sill Repair', desc: `Structural epoxy and expanding polyurethane injections sealing leaking poured-concrete cracks cleanly from inside.`, badge: 'Free Inspection' }
      ]
    },
    hvac: {
      displayTrade: 'HVAC',
      headerSub: `Heating & Cooling • ${city}`,
      heroEyebrow: `High-Efficiency Heating & Air Conditioning • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Manual J Load Sizing & 24/7 Diagnostics',
      heroCardLabel: 'Featured Comfort Upgrade',
      heroCardFallbackTitle: `Dependable Heating, Cooling & Ductwork in ${cityOnly}`,
      heroCardSubtitle: 'Proper BTU sizing, sealed sheet-metal ductwork & clean utility rooms.',
      fortressEyebrow: `${cityOnly}'s Standard for Reliable Heating & Cooling`,
      fortressFallbackOwnerStory: `Fast furnace repairs, high-efficiency AC replacements, boilers, and indoor air quality upgrades keeping homes comfortable across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Instant Heating & Cooling Quote Estimator',
      estimatorSubtitle: 'Select your HVAC need and home size for upfront options.',
      estimatorScopeLabel: 'Home / Building Size',
      estimatorDefaultTypes: ['Furnace Replacement / Repair', 'Central A/C Installation', 'Heat Pump / Mini-Split', 'Seasonal Tune-Up / Service'],
      estimatorScopeOptions: [
        { value: 'Service / Repair', label: 'Repair or Tune-Up Only' },
        { value: '< 1,500 sq ft', label: 'Home Under 1,500 sq ft' },
        { value: '1,500-2,800 sq ft', label: 'Home 1,500 - 2,800 sq ft' },
        { value: 'Large / Commercial', label: 'Large Home or Commercial Unit' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} HVAC`,
      servicesHeading: 'Dependable Heating & Cooling Services',
      servicesSubtitle: 'Accurate diagnostics, sealed ductwork, and high-AFUE systems built for extreme winter cold and humid summers.',
      serviceCardCta: 'Explore System Specs',
      defaultBadge: 'Comfort Service',
      aboutEyebrow: 'Home Comfort Craft',
      aboutHeading: 'Honest Diagnostics & No-Pressure Comfort',
      aboutQuote: `We size and service every furnace and A/C unit with clean sheet-metal craft, safe venting, and zero pushy upsells.`,
      galleryEyebrow: `${cityOnly} Mechanical Work`,
      galleryHeading: 'Clean HVAC & Utility Room Work',
      gallerySubtitle: `Recent furnace, A/C, and heat pump upgrades across ${serviceArea || city}.`,
      galleryAltPrefix: 'HVAC Project',
      galleryCardPrefix: 'Comfort Install #',
      comparisonEyebrow: 'Comfort & Efficiency Standard',
      comparisonHeading: `${bizName} vs High-Turnover Chains`,
      comparisonFactorCol: 'Efficiency & Craft Factor',
      comparisonThemCol: 'Sales-First Chains',
      ctaBadge: 'Manual J Load Sizing • Upfront Flat Pricing',
      ctaHeadline: 'Need Fast Furnace Service, A/C Upgrade, or Quote?',
      ctaBullet1: 'Honest Repair-vs-Replace Guidance',
      summaryRole: 'licensed heating & cooling contractor',
      servicesPageEyebrow: 'HVAC Capabilities',
      servicesPageHeading: 'Complete Heating, Cooling & Air Quality',
      servicesPageSubtitle: 'Precision sizing, clean sheet-metal transitions, and reliable comfort systems.',
      aboutPageTitleSuffix: `${cityOnly} Heating & Cooling`,
      aboutSecondaryParagraph: `Whether a furnace quits on a sub-zero night or you want lower energy bills, ${bizName} delivers responsive local HVAC service across ${cityInfo.regionLabel}.`,
      contactMsgPlaceholder: 'Share equipment type, issue (no heat, noisy fan, quote for new unit), and address...',
      llmsPortfolioLabel: 'HVAC Services & Equipment Specs',
      fallbackAestheticVibe: 'Modern Precision Climate Engineering',
      fallbackTagline: `Reliable Heating & Air Conditioning in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} keeps homes and businesses across ${cityInfo.regionLabel} comfortable year-round with fast HVAC repairs and high-efficiency equipment installations.`,
      fallbackServices: [
        { name: 'Furnace & Boiler Service', desc: `Prompt winter heating repair, safety heat-exchanger checks, and high-efficiency modulating furnace upgrades across ${cityOnly}.`, badge: 'Fast Dispatch' },
        { name: 'Central A/C & Heat Pumps', desc: `Quiet high-SEER2 air conditioners and cold-climate ductless mini-splits properly matched to your ductwork.`, badge: 'High Efficiency' },
        { name: 'Indoor Air Quality & Tune-Ups', desc: `Duct modifications, humidifiers, ERVs, and pre-season maintenance checks to prevent mid-season breakdowns.`, badge: 'Preventative' }
      ]
    },
    plumbing: {
      displayTrade: 'Plumbing',
      headerSub: `Licensed Plumbing • ${city}`,
      heroEyebrow: `Master Plumbing, Drains & Water Heaters • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'State-Licensed Plumbers & Upfront Quotes',
      heroCardLabel: 'Featured Plumbing Work',
      heroCardFallbackTitle: `Clean Piping, Water Heaters & Fixture Service in ${cityOnly}`,
      heroCardSubtitle: 'Type L copper & PEX-A repiping, spotless workspaces & fast leak response.',
      fortressEyebrow: `${cityOnly}'s Trusted Standard for Licensed Plumbing`,
      fortressFallbackOwnerStory: `Fast leak repair, tank and tankless water heaters, sump pumps, and fixture installations backed by clean workmanship across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Plumbing Service Request',
      estimatorSubtitle: 'Tell us what fixture, pipe, or drain needs attention for fast help.',
      estimatorScopeLabel: 'Urgency & Scope',
      estimatorDefaultTypes: ['Leak / Pipe Repair', 'Water Heater Replacement', 'Drain Clearing / Sump Pump', 'Bath / Kitchen Remodel'],
      estimatorScopeOptions: [
        { value: 'Same-Day Repair', label: 'Same-Day Leak or Drain Repair' },
        { value: 'Water Heater', label: 'Water Heater Replacement' },
        { value: 'Fixture Upgrade', label: 'Fixture / Faucet / Toilet Upgrade' },
        { value: 'Repipe / Remodel', label: 'Full Repipe or Remodel Plumbing' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Plumbing`,
      servicesHeading: 'Licensed Plumbing & Pipe Services',
      servicesSubtitle: 'Code-compliant copper, PEX, water heaters, sump backups, and tidy in-home service.',
      serviceCardCta: 'Explore Plumbing Services',
      defaultBadge: 'Licensed Plumbing',
      aboutEyebrow: 'Trusted In-Home Craft',
      aboutHeading: 'Clean Shoes, Neat Pipework & Honest Rates',
      aboutQuote: `We protect your floors with drop cloths, replace faulty shutoffs properly, and leave mechanical rooms cleaner than we found them.`,
      galleryEyebrow: `${cityOnly} Workmanship`,
      galleryHeading: 'Completed Plumbing & Mechanical Work',
      gallerySubtitle: `Recent water heaters, repiping, and bath upgrades across ${serviceArea || city}.`,
      galleryAltPrefix: 'Plumbing Service Work',
      galleryCardPrefix: 'Plumbing Job #',
      comparisonEyebrow: 'The Master Plumber Standard',
      comparisonHeading: `${bizName} vs Handyman Shortcuts`,
      comparisonFactorCol: 'Code & Piping Factor',
      comparisonThemCol: 'Handyman Shortcuts',
      ctaBadge: 'Licensed & Code-Compliant • Upfront Flat Pricing',
      ctaHeadline: 'Need a Reliable Plumber, Water Heater, or Leak Fix?',
      ctaBullet1: 'Type L Copper, PEX-A & Clean Cleanup',
      summaryRole: 'state-licensed plumbing contractor',
      servicesPageEyebrow: 'Plumbing Capabilities',
      servicesPageHeading: 'Complete Residential & Commercial Plumbing',
      servicesPageSubtitle: 'Code-compliant piping, dependable water heaters, and clean fixture workmanship.',
      aboutPageTitleSuffix: `${cityOnly} Licensed Plumbers`,
      aboutSecondaryParagraph: `Homeowners across ${cityInfo.regionLabel} count on ${bizName} for clear upfront pricing, punctuality, and repairs that stay leak-free.`,
      contactMsgPlaceholder: 'Describe the leak, water heater issue, drain backup, or fixture project and address...',
      llmsPortfolioLabel: 'Plumbing Services & Capabilities',
      fallbackAestheticVibe: 'Crisp Copper, Blue-Steel & Code Precision',
      fallbackTagline: `Licensed Plumbing, Water Heaters & Drain Service in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} provides dependable residential and commercial plumbing, water heaters, and drain solutions across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'Leak Repair & Whole-Home Repiping', desc: `Clean copper and PEX-A upgrades, frozen pipe repair, and brass ball-valve replacements across ${cityOnly}.`, badge: 'Licensed' },
        { name: 'Water Heaters & Tankless Systems', desc: `Same-day gas, electric, and high-efficiency tankless water heater replacements with full venting and expansion control.`, badge: 'Most Popular' },
        { name: 'Sump Pumps & Fixture Upgrades', desc: `Battery-backup sump protection, toilets, disposals, and kitchen/bath rough-ins done right the first time.`, badge: 'Clean Service' }
      ]
    },
    electrical: {
      displayTrade: 'Electrical',
      headerSub: `Licensed Electrical • ${city}`,
      heroEyebrow: `NEC Code-Compliant Electrical & Panels • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'NEC 2023 Compliant & Clean Panel Labeling',
      heroCardLabel: 'Featured Electrical Upgrade',
      heroCardFallbackTitle: `200A Panel Upgrades, Wiring & Backup Power in ${cityOnly}`,
      heroCardSubtitle: 'Permitted panel swaps, EV chargers, generator interlocks & safe troubleshooting.',
      fortressEyebrow: `${cityOnly}'s Standard for Safe, Permitted Electrical`,
      fortressFallbackOwnerStory: `Licensed residential and commercial electrical service upgrades, troubleshooting, lighting, and generator hookups across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Electrical Quote Request',
      estimatorSubtitle: 'Select your electrical need for clear upfront guidance and scheduling.',
      estimatorScopeLabel: 'Project Scope',
      estimatorDefaultTypes: ['200A Service Panel Upgrade', 'EV Charger / Garage Subpanel', 'Generator Hookup', 'Troubleshooting & Lighting'],
      estimatorScopeOptions: [
        { value: 'Troubleshooting / Repair', label: 'Troubleshooting or Outlet Repair' },
        { value: '200A Panel Upgrade', label: '100A to 200A Panel Upgrade' },
        { value: 'EV / Generator', label: 'EV Charger or Generator Interlock' },
        { value: 'Remodel / Commercial', label: 'Full Remodel or Commercial Wiring' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Electrical`,
      servicesHeading: 'Safe, Code-Compliant Electrical Solutions',
      servicesSubtitle: 'Properly grounded service panels, dedicated circuits, surge protection, and commercial lighting.',
      serviceCardCta: 'Explore Electrical Services',
      defaultBadge: 'NEC Code Service',
      aboutEyebrow: 'Safety & Precision First',
      aboutHeading: 'Neat Panel Work & Zero Electrical Guesswork',
      aboutQuote: `Every breaker panel, splice box, and fixture we touch is torqued to spec, clearly labeled, and tested for homeowner peace of mind.`,
      galleryEyebrow: `${cityOnly} Electrical Work`,
      galleryHeading: 'Completed Electrical Projects',
      gallerySubtitle: `Recent panel upgrades, lighting, and generator hookups across ${serviceArea || city}.`,
      galleryAltPrefix: 'Electrical Work Project',
      galleryCardPrefix: 'Electrical Job #',
      comparisonEyebrow: 'NEC Safety Standard',
      comparisonHeading: `${bizName} vs Unpermitted Shortcuts`,
      comparisonFactorCol: 'Code & Safety Factor',
      comparisonThemCol: 'Unpermitted Handymen',
      ctaBadge: 'Licensed & Insured Electricians • Upfront Quotes',
      ctaHeadline: 'Need a Panel Upgrade, Troubleshooting, or Generator Hookup?',
      ctaBullet1: 'Full Load Check & Clear Circuit Labeling',
      summaryRole: 'licensed electrical contractor',
      servicesPageEyebrow: 'Electrical Capabilities',
      servicesPageHeading: 'Complete Residential & Commercial Electrical',
      servicesPageSubtitle: 'Master-grade panel work, dedicated circuits, EV chargers, and permitted troubleshooting.',
      aboutPageTitleSuffix: `${cityOnly} Licensed Electricians`,
      aboutSecondaryParagraph: `Safety starts with neat work and proper load checks—${bizName} handles permits, utility coordination, and clean testing across ${cityInfo.regionLabel}.`,
      contactMsgPlaceholder: 'Describe your panel amperage, tripped breakers, EV charger, lighting need, and address...',
      llmsPortfolioLabel: 'Electrical Services & Code Capabilities',
      fallbackAestheticVibe: 'Precision Industrial Electric & Code Safety',
      fallbackTagline: `Licensed Panel Upgrades & Electrical Service in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} delivers safe, NEC code-compliant electrical troubleshooting, panel upgrades, and lighting across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: '200A Service & Panel Upgrades', desc: `Cleanly wired main panels, whole-home surge arresters, and utility coordination replacing outdated fuse or Federal Pacific boxes in ${cityOnly}.`, badge: 'Code Upgrade' },
        { name: 'EV Chargers & Backup Generators', desc: `Dedicated 240V circuits, manual interlocks, and automatic transfer switches installed cleanly in garages and basements.`, badge: 'Most Popular' },
        { name: 'Troubleshooting & LED Lighting', desc: `Fast circuit fault tracing, GFCI/AFCI protection, recessed interior lighting, and commercial shop bays.`, badge: 'Same-Week Service' }
      ]
    },
    mechanical: {
      displayTrade: 'Process Piping & Mechanical',
      headerSub: `Mechanical & Piping • ${city}`,
      heroEyebrow: `ASME Process Piping & Industrial Fabrication • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'ASME/AWS Certified Welds & CNC Precision',
      heroCardLabel: 'Featured Industrial Build',
      heroCardFallbackTitle: `Turnkey Process Piping & Shop Fabrication in ${cityOnly}`,
      heroCardSubtitle: 'Sanitary stainless welding, CNC cutting, boiler systems & heavy rigging.',
      fortressEyebrow: `${cityOnly}'s Industrial Benchmark for Process Piping`,
      fortressFallbackOwnerStory: `ASME-certified process piping, sanitary orbital welding, chiller/boiler loops, and turnkey millwright installation across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Industrial Bid & Scope Request',
      estimatorSubtitle: 'Provide pipe specs or plant turnaround scope for rapid engineering pricing.',
      estimatorScopeLabel: 'Facility Scope',
      estimatorDefaultTypes: ['Sanitary Process Piping', 'CNC Shop Fabrication & Spools', 'Steam / Chiller Mechanical', 'Plant Outage & Millwrighting'],
      estimatorScopeOptions: [
        { value: 'Emergency Line Repair', label: 'Single Line / Emergency Repair' },
        { value: 'Skid / Process Tie-In', label: 'Skid / Process Piping Tie-In' },
        { value: 'Structural / CNC Parts', label: 'Structural Welding / CNC Parts' },
        { value: 'Plant Shutdown', label: 'Turnkey Plant Outage / Shutdown' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Industrial`,
      servicesHeading: 'Turnkey Process Piping & Fabrication',
      servicesSubtitle: 'Custom prefab pipe spools, hydro-tested weldments, and plant mechanical systems built to schedule.',
      serviceCardCta: 'Explore Fabrication Specs',
      defaultBadge: 'Industrial Fabrication',
      aboutEyebrow: 'Shop Capacity & Field Precision',
      aboutHeading: 'Engineered for Zero Plant Downtime',
      aboutQuote: `We prefabricate and hydro-test pipe spools in-shop so field tie-ins finish inside tight plant shutdown windows.`,
      galleryEyebrow: `${cityOnly} Industrial Gallery`,
      galleryHeading: 'Completed Piping & Shop Assemblies',
      gallerySubtitle: `Recent industrial piping, skid fabrication, and mechanical installations across ${serviceArea || city}.`,
      galleryAltPrefix: 'Industrial Piping Project',
      galleryCardPrefix: 'Industrial Assembly #',
      comparisonEyebrow: 'The Industrial Code Standard',
      comparisonHeading: `${bizName} vs Typical Field Subcontractors`,
      comparisonFactorCol: 'Code & Tolerance Factor',
      comparisonThemCol: 'Typical Subcontractors',
      ctaBadge: 'ASME / AWS Code Compliant • On-Site Walkthroughs',
      ctaHeadline: 'Planning a Process Tie-In, Skid Build, or Plant Outage?',
      ctaBullet1: 'Hydro-Tested In-Shop Prefab Spools',
      summaryRole: 'industrial mechanical & piping contractor',
      servicesPageEyebrow: 'Mechanical Capabilities',
      servicesPageHeading: 'Complete Industrial Piping & Fabrication',
      servicesPageSubtitle: 'Precision-welded process lines, boiler/chiller mechanicals, and turnkey millwright execution.',
      aboutPageTitleSuffix: `${cityOnly} Mechanical Contractor`,
      aboutSecondaryParagraph: `From food-grade stainless orbital welds to heavy structural steel fabrication, ${bizName} meets tight industrial tolerances across Wisconsin.`,
      contactMsgPlaceholder: 'Provide alloy specs, pipe sizes, print availability, shutdown dates, and facility address...',
      llmsPortfolioLabel: 'Piping & Mechanical Capabilities',
      fallbackAestheticVibe: 'Industrial Crimson Steel & ASME Precision',
      fallbackTagline: `Turnkey Process Piping & Industrial Mechanical in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} delivers ASME-certified process piping, shop fabrication, and industrial mechanical systems across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: 'ASME Process & Sanitary Piping', desc: `Food-grade orbital stainless, carbon steel steam lines, and CIP systems built and hydro-tested to strict industrial codes in ${cityOnly}.`, badge: 'ASME Certified' },
        { name: 'In-Shop Spool & CNC Fabrication', desc: `High-capacity custom structural weldments and prefabricated pipe spools reducing on-site shutdown downtime.`, badge: 'Prefab Capacity' },
        { name: 'Boilers, Chillers & Millwrighting', desc: `Turnkey equipment setting, heavy rigging, thermal insulation coordination, and emergency plant repairs.`, badge: 'Turnkey Plant' }
      ]
    },
    generic: {
      displayTrade: defaultDisplayTrade,
      headerSub: `${defaultDisplayTrade} Specialists • ${city}`,
      heroEyebrow: `Trusted Local ${defaultDisplayTrade} • ${city}`,
      heroRootChip: cityInfo.regionLabel,
      heroTrustBadge: 'Licensed, Insured & Spotless Site Cleanup',
      heroCardLabel: 'Featured Local Project',
      heroCardFallbackTitle: `Dependable ${defaultDisplayTrade} in ${cityOnly}`,
      heroCardSubtitle: 'Transparent written estimates, dependable crews & clean work sites.',
      fortressEyebrow: `${cityOnly}'s Trusted Standard for ${defaultDisplayTrade}`,
      fortressFallbackOwnerStory: `Reliable residential and commercial ${defaultDisplayTrade.toLowerCase()} backed by honest communication and clean results across ${cityInfo.regionLabel}.`,
      estimatorHeading: 'Quick Service & Quote Estimator',
      estimatorSubtitle: 'Select your service and scope for a fast written estimate.',
      estimatorScopeLabel: 'Project Scope',
      estimatorDefaultTypes: [`Residential ${defaultDisplayTrade}`, `Commercial ${defaultDisplayTrade}`, 'Custom Project', 'Repairs & Maintenance'],
      estimatorScopeOptions: [
        { value: 'Small Repair', label: 'Small Repair / Service Call' },
        { value: 'Standard Residential', label: 'Standard Residential Project' },
        { value: 'Full Property', label: 'Full Property / Multi-Day Job' },
        { value: 'Commercial Scope', label: 'Commercial Facility Scope' }
      ],
      servicesEyebrow: `${cityInfo.regionShort} Services`,
      servicesHeading: `Dependable ${defaultDisplayTrade} Solutions`,
      servicesSubtitle: 'Clear communication, reliable equipment, and quality workmanship tailored to your property.',
      serviceCardCta: 'Explore Service Details',
      defaultBadge: 'Local Service',
      aboutEyebrow: 'Our Wisconsin Roots',
      aboutHeading: 'Built on Local Dependability & Pride',
      aboutQuote: `We treat every ${defaultDisplayTrade.toLowerCase()} job with the care, clear communication, and clean workmanship we'd expect for our own property.`,
      galleryEyebrow: `${cityOnly} Work Gallery`,
      galleryHeading: 'Completed Client Projects',
      gallerySubtitle: `Recent work completed for homeowners and businesses across ${serviceArea || city}.`,
      galleryAltPrefix: `${defaultDisplayTrade} Work`,
      galleryCardPrefix: 'Completed Job #',
      comparisonEyebrow: 'The Local Quality Standard',
      comparisonHeading: `${bizName} vs Low-Bid Crews`,
      comparisonFactorCol: 'Quality & Service Factor',
      comparisonThemCol: 'Typical Low-Bid Crews',
      ctaBadge: 'Insured Local Crew • Free Written Estimates',
      ctaHeadline: `Ready for Dependable ${defaultDisplayTrade} Service?`,
      ctaBullet1: 'Thorough Job-Site Cleanup Guaranteed',
      summaryRole: `local ${defaultDisplayTrade.toLowerCase()} specialist`,
      servicesPageEyebrow: 'Service Capabilities',
      servicesPageHeading: `Complete ${defaultDisplayTrade} Capabilities`,
      servicesPageSubtitle: 'Every job is handled with reliable equipment, upfront communication, and spotless cleanup.',
      aboutPageTitleSuffix: `${cityOnly} ${defaultDisplayTrade}`,
      aboutSecondaryParagraph: `We take pride in setting a higher bar for dependability across ${cityInfo.regionLabel}. From free written estimates to thorough cleanup, we handle every detail smoothly.`,
      contactMsgPlaceholder: 'Describe your service needs, approximate size or urgency, and your address...',
      llmsPortfolioLabel: 'Services & Capabilities',
      fallbackAestheticVibe: 'Bold High-Contrast Modern Service Brand',
      fallbackTagline: `Dependable ${defaultDisplayTrade} Solutions in ${cityOnly}`,
      fallbackOwnerStory: `${bizName} delivers reliable residential and commercial ${defaultDisplayTrade.toLowerCase()} services with upfront quotes across ${cityInfo.regionLabel}.`,
      fallbackServices: [
        { name: `Residential ${defaultDisplayTrade}`, desc: `Tailored ${defaultDisplayTrade.toLowerCase()} solutions for homeowners across ${cityOnly} with clear communication and neat work sites.`, badge: 'Most Popular' },
        { name: `Commercial ${defaultDisplayTrade}`, desc: `Scheduled service, multi-site support, and heavy-duty capability tailored for businesses and property managers.`, badge: 'Commercial' },
        { name: 'Repairs, Maintenance & Quotes', desc: `Prompt response times, thorough diagnostics, and transparent written estimates with zero guesswork.`, badge: 'Free Estimates' }
      ]
    }
  };

  return profiles[key] || profiles.generic;
}

function isJunkImageUrl(url) {
  if (!url || typeof url !== 'string') return true;
  const u = url.toLowerCase();
  const junkHosts = [
    'shopify.com', 'f-cdn.com', 'freelancer.com', 'mementor.no', 'sanity.io',
    '99static.com', '99designs.com', 'ghost.io', 'novacare', 'wixstatic.com/media/generic',
    'shutterstock', 'istockphoto', 'gettyimages', 'stock.adobe', 'facebook.com',
    'fbsbx.com', 'lookaside', 'instagram.com', 'linkedin.com', 'yelp.com', 'yelpcdn.com',
    'yellowpages.com', 'mapquest.com', 'mapq.st', 'bbb.org', 'usegalaxy.', 'wud.no',
    'wikipedia.org', 'wikimedia.org', 'youtube.com', 'youtu.be', 'pinterest.com',
    'dreamstime.com', 'vecteezy.com', 'alamy.com', '123rf.com', 'depositphotos.com',
    'freepik.com', 'canva.com', 'tenor.com', 'giphy.com', 'yimg.com', 'yahoo.com',
    'experience.com/noimage', 'constructiondirectory.us', 'angi.com', 'angieslist.com',
    'homeadvisor.com', 'thumbtack.com', 'nextdoor.com', 'manta.com', 'birdeye.com',
    'superpages.com', 'buildzoom.com', 'porch.com', 'houzz.com', 'oshkoshdirect.us',
    'showmelocal.com', 'appletondirect.us', 'citydirect', 'streetviewpixels-pa.googleapis.com'
  ];
  if (/\.no(?:\/|$)|\/favicon|sprite|spacer|1x1|tracking|pixel|pwa-app\/logo-default/i.test(u)) return true;
  if (/^https?:\/\/images\//i.test(u)) return true;
  return junkHosts.some(host => u.includes(host));
}

function isNonWorkGraphicUrl(url, alt = '') {
  const rawUrl = String(url || '').toLowerCase();
  const pathAndFile = rawUrl.replace(/^https?:\/\/[^/]+/, '');
  const altLower = String(alt || '').toLowerCase();
  const combined = `${rawUrl} ${altLower}`;
  const pathCombined = `${pathAndFile} ${altLower}`;
  return (
    /security_?photo|captcha|recaptcha|securimage/i.test(combined) ||
    /coupon|rebate|flyer|spring_?20|double_your_power|financing_?banner/i.test(combined) ||
    /(?:^|[^a-z0-9])(?:offer|promo)(?:[^a-z0-9]|$)/i.test(pathAndFile) ||
    /(?:^|[^a-z0-9])(?:bbb[-_]?logo|bbb[-_]?badge|dealer|angi|accredited)(?:[^a-z0-9]|$)/i.test(pathCombined) ||
    /authorized[-_ ]?dealer|certified[-_ ]?dealer|homeadvisor|angies?list|award[-_ ]?badge|google[-_ ]?review|birdeye|mapq\.st/i.test(combined)
  );
}

function getDistinctiveBizTokens(bizName) {
  const generic = new Set([
    'tree', 'trees', 'service', 'services', 'care', 'company', 'inc', 'llc', 'co', 'corp', 'ltd',
    'wisconsin', 'wi', 'green', 'bay', 'appleton', 'oshkosh', 'neenah', 'menasha', 'sherwood', 'brillion', 'omro',
    'kaukauna', 'kimberly', 'little', 'chute', 'de', 'pere', 'fox', 'valley', 'cities', 'north', 'east',
    'the', 'and', 'of', 'mr', 'pro', 'pros', 'custom', 'quality', 'best', 'premier', 'elite',
    'all', 'season', 'seasons', 'fencing', 'fence', 'deck', 'decks', 'siding', 'window', 'windows',
    'door', 'doors', 'painting', 'painter', 'roofing', 'roof', 'concrete', 'sewer', 'drain',
    'plumbing', 'plumber', 'heating', 'cooling', 'hvac', 'refrigeration', 'electric', 'electrical',
    'landscaping', 'landscape', 'design', 'lawn', 'asphalt', 'blacktop', 'sealcoat', 'sealcoating', 'paving',
    'waterproofing', 'basement', 'demolition', 'earthwork', 'dirt', 'grading', 'hauling', 'trucking',
    'foundation', 'contractor', 'contracting', 'construction', 'builders', 'remodeling', 'drywall', 'flooring', 'masonry',
    'excavating', 'excavation', 'septic', 'well', 'pump', 'stump', 'removal', 'trimming', 'pruning',
    'snow', 'plow', 'plowing', 'supply', 'supplies', 'mechanical', 'system', 'systems', 'solutions',
    'expert', 'experts', 'specialist', 'specialists', 'concept', 'concepts', 'works', 'work',
    'plus', 'usa', 'america', 'american', 'national', 'united', 'general', 'superior', 'badger', 'four',
    'group', 'enterprises', 'industries', 'associates', 'brothers', 'bros', 'sons', 'home', 'residential', 'commercial',
    'local', 'northeast', 'midwest'
  ]);
  return (bizName || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(tok => tok.length >= 2 && !generic.has(tok));
}

function isTrustworthyResearchImage(url, detail, bizName, cleanDomain, expectedPhone = '') {
  if (isJunkImageUrl(url) || isDirectoryHostOrUrl(url)) return false;
  const u = url.toLowerCase();
  const title = detail?.title || detail?.alt || '';
  const source = detail?.source || '';
  const pageLink = detail?.link || '';
  const titleLower = title.toLowerCase();
  const sourceLower = source.toLowerCase();
  const pageLinkLower = pageLink.toLowerCase();
  const combined = `${titleLower} ${sourceLower} ${pageLinkLower} ${u}`;

  if (pageLink && isDirectoryHostOrUrl(pageLink) && !/(?:facebook\.com|fb\.com)/i.test(pageLink)) {
    return false;
  }
  if (/\b(?:mapquest|yelp|yellow\s*pages|manta|angi|angies\s*list|homeadvisor|thumbtack|nextdoor|porch|houzz|bbb|better business bureau|birdeye|superpages|buildzoom|chamber\s*of\s*commerce|oshkoshdirect|citydirect|direct\.us|expertise|threebestrated|bestprosintown|alignable|hotfrog|cylex|brownbook|citysearch|showmelocal)\b/i.test(`${sourceLower} ${titleLower}`)) {
    return false;
  }
  if (/\b(?:top\s*\d+|best\s+\d+|the\s+best\s+\d+|best\s+.+\s+near)\b/i.test(titleLower)
    || /(?:site is undergoing maintenance|under construction|coming soon|404 not found|domain (?:for sale|expired)|default web site page)/i.test(titleLower)) {
    return false;
  }
  if (expectedPhone && evaluateCompanyPhoneMatch(`${title} ${source}`, expectedPhone) === 'conflict') {
    return false;
  }
  if (isNonWorkGraphicUrl(url, title) && !/(?:^|[/\-_])logo(?:[/\-_.]|$)/i.test(u)) {
    return false;
  }

  const safeCleanDomain = (cleanDomain && !isDirectoryHostOrUrl(cleanDomain)) ? cleanDomain.toLowerCase() : '';
  const imgHost = u.replace(/^https?:\/\/(?:www\.)?/i, '').split('/')[0].split('?')[0];
  const pageHost = pageLinkLower.replace(/^https?:\/\/(?:www\.)?/i, '').split('/')[0].split('?')[0];

  // Block third-party trade mentions not matching this company (e.g. Vick's Lawncare on concrete site)
  const bizLower = String(bizName || '').toLowerCase();
  const foreignTradeMatch = titleLower.match(/\b(lawncare|lawn\s*care|landscap\w*|glass|auto\s*repair|salon|restaurant|roof\w*|tree\s*service|fenc\w*|plumb\w*|hvac|heating|cooling|electric\w*|concrete|asphalt|paving|waterproof\w*|excavat\w*)\b/i);
  if (foreignTradeMatch) {
    const mentionedTrade = foreignTradeMatch[1].toLowerCase().slice(0, 4);
    const isConstructionOrFlatwork = /construct|build|contract|conc|flat|side|patio|drive|slab|mason|found|waterproof|cement|pave/.test(bizLower);
    const matchesBizTrade = bizLower.includes(mentionedTrade)
      || (isConstructionOrFlatwork && /conc|cement|pave|mason|found|water|excav|asph|roof|fenc/.test(mentionedTrade));
    if (!matchesBizTrade && (!safeCleanDomain || (imgHost !== safeCleanDomain && pageHost !== safeCleanDomain))) {
      return false;
    }
  }

  // Require positive ownership proof:
  // 1. Hosted on / linked directly from verified company website domain
  if (safeCleanDomain && ((imgHost === safeCleanDomain || imgHost.endsWith('.' + safeCleanDomain)) || (pageHost === safeCleanDomain || pageHost.endsWith('.' + safeCleanDomain)))) {
    return true;
  }
  // 2. Direct Google Maps Business Profile photo (only without conflicting brand/trade text)
  if (u.includes('googleusercontent.com/gps-cs-s') || u.includes('googleusercontent.com/grass-cs') || u.includes('googleusercontent.com/p/') || u.includes('lh3.googleusercontent.com/places')) {
    return !titleLower || matchesBusinessIdentity(combined, bizName);
  }
  // 3. Verified matching Facebook business page photo (never unverified crawler / post links)
  if (pageLink && /(?:facebook\.com|fb\.com)/i.test(pageLink) && isMatchingCompanyFacebook(pageLink, bizName, title)) {
    return true;
  }
  // 4. Image/page host itself matches the company brand identity
  const hostClean = (pageHost || imgHost).replace(/[^a-z0-9]/g, '');
  if (hostClean && matchesBusinessIdentity(hostClean, bizName) && (!titleLower || matchesBusinessIdentity(titleLower + ' ' + pageLinkLower, bizName))) {
    return true;
  }

  return false;
}

function resolveDesignProfile(layoutStyle, bizName, tradeKey, seed = 0) {
  const validLayouts = ['industrial-contractor', 'modern-architectural', 'shield-banner-estimator', 'split-hero-timber'];
  let resolvedLayout = validLayouts.includes(layoutStyle) ? layoutStyle : '';
  const isWarmCraft = tradeKey === 'fencing' || tradeKey === 'tree' || tradeKey === 'landscaping' || /deck|timber|wood|tree|lawn|make/i.test(bizName || '');
  if (!resolvedLayout) {
    if (isWarmCraft) {
      resolvedLayout = 'split-hero-timber';
    } else if (tradeKey === 'concrete' || tradeKey === 'paving' || tradeKey === 'foundation' || tradeKey === 'excavating' || tradeKey === 'roofing') {
      const nonCraftOptions = ['industrial-contractor', 'modern-architectural', 'shield-banner-estimator'];
      resolvedLayout = nonCraftOptions[Math.abs(Number(seed) || 0) % nonCraftOptions.length];
    } else {
      const altOptions = ['modern-architectural', 'shield-banner-estimator', 'industrial-contractor'];
      resolvedLayout = altOptions[Math.abs(Number(seed) || 0) % altOptions.length];
    }
  }

  const profiles = {
    'industrial-contractor': {
      layoutStyle: 'industrial-contractor',
      fontUrl: 'https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      headingFont: "'Barlow Condensed', 'Plus Jakarta Sans', sans-serif",
      bodyFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      headingTrack: '-0.01em',
      cardRadius: '0.75rem',
      btnRadius: '0.375rem',
      heroFirst: false
    },
    'modern-architectural': {
      layoutStyle: 'modern-architectural',
      fontUrl: 'https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap',
      headingFont: "'Outfit', 'Inter', sans-serif",
      bodyFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      headingTrack: '-0.02em',
      cardRadius: '0.875rem',
      btnRadius: '0.5rem',
      heroFirst: true
    },
    'shield-banner-estimator': {
      layoutStyle: 'shield-banner-estimator',
      fontUrl: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap',
      headingFont: "'Space Grotesk', 'Inter', sans-serif",
      bodyFont: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      headingTrack: '-0.02em',
      cardRadius: '1rem',
      btnRadius: '0.625rem',
      heroFirst: false
    },
    'split-hero-timber': {
      layoutStyle: 'split-hero-timber',
      fontUrl: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
      headingFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      bodyFont: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
      headingTrack: '-0.02em',
      cardRadius: '1.25rem',
      btnRadius: '0.75rem',
      heroFirst: true
    }
  };

  return profiles[resolvedLayout] || profiles['modern-architectural'];
}

function createSiteBuilder(options = {}) {
  const {
    stockRootDir,
    previewBannerPath,
    contactApiPath,
    styleCssPath,
    clientOverridesDir,
    appsScriptUrl,
    geminiApiKey = '',
    geminiModel = 'gemini-3.5-flash',
    geminiFallbackModel = 'gemini-3.5-flash-lite',
    agencyPhone = '(920) 234-5633',
    claimBaseUrl = 'https://624siteworks.com/claim.html',
    gaMeasurementId = process.env.DEMO_GA_MEASUREMENT_ID || 'G-07ZVHY3BBN',
    serpApiKey = process.env.SERP_API_KEY || '',
    scrapeProspectWebsite,
    logger = {}
  } = options;

  const logSub = logger.logSub || ((m) => console.log(`  -> ${m}`));
  const logSuccess = logger.logSuccess || ((m) => console.log(`  [OK] ${m}`));
  const logWarn = logger.logWarn || ((m) => console.warn(`  [WARN] ${m}`));

  const TRADE_PHOTOGRAPHY_TAXONOMY = buildTradePhotographyTaxonomy(stockRootDir);

  function resolveContextualPhoto(tradeKey, contextText, role, offset = 0) {
    const normTrade = normalizeTradeCategory(tradeKey);
    const tradePool = TRADE_PHOTOGRAPHY_TAXONOMY[normTrade] || TRADE_PHOTOGRAPHY_TAXONOMY['Fencing'];

    if (role === 'hero' && tradePool.hero?.length) {
      return tradePool.hero[offset % tradePool.hero.length];
    }
    if (role === 'about' && tradePool.about?.length) {
      return tradePool.about[offset % tradePool.about.length];
    }

    const text = (contextText || '').toLowerCase();

    if (normTrade === 'Fencing') {
      if (/chain\s*link|cyclone|wire|security|industrial/i.test(text)) return tradePool.chain_link[offset % tradePool.chain_link.length];
      if (/vinyl|pvc|white\s*picket|composite/i.test(text)) return tradePool.vinyl[offset % tradePool.vinyl.length];
      if (/wood|cedar|timber|pine|board|privacy\s*wood/i.test(text)) return tradePool.wood[offset % tradePool.wood.length];
      if (/iron|metal|aluminum|ornamental|gate/i.test(text)) return tradePool.metal_iron[offset % tradePool.metal_iron.length];
      if (/deck|patio|pergola/i.test(text)) return tradePool.deck_patio[offset % tradePool.deck_patio.length];
      if (/repair|storm|post|maintenance/i.test(text)) return tradePool.repair[offset % tradePool.repair.length];
      const order = [tradePool.wood, tradePool.vinyl, tradePool.chain_link, tradePool.metal_iron];
      return order[offset % order.length][0];
    }
    if (normTrade === 'Roofing') {
      if (/metal|standing\s*seam|steel/i.test(text)) return tradePool.metal[offset % tradePool.metal.length];
      if (/flat|commercial|membrane|tpo|epdm/i.test(text)) return tradePool.flat_commercial[offset % tradePool.flat_commercial.length];
      if (/repair|storm|leak|inspection|chimney/i.test(text)) return tradePool.repair_inspection[offset % tradePool.repair_inspection.length];
      return tradePool.shingle[offset % tradePool.shingle.length];
    }
    if (normTrade === 'Concrete') {
      if (/stamped|decorative|stained|slate/i.test(text)) return tradePool.stamped_decorative[offset % tradePool.stamped_decorative.length];
      if (/garage|shop\s*slab|interior\s*slab|floor/i.test(text)) return tradePool.garage_floors[offset % tradePool.garage_floors.length];
      if (/patio|walkway|sidewalk|stoop|step/i.test(text)) return tradePool.patio_walkway[offset % tradePool.patio_walkway.length];
      if (/foundation|footing|rebar/i.test(text)) return tradePool.foundation_footing[offset % tradePool.foundation_footing.length];
      return tradePool.driveway_patio[offset % tradePool.driveway_patio.length];
    }
    if (normTrade === 'Plumbing') {
      if (/drain|sewer|clog|jet/i.test(text)) return tradePool.drain_sewer[offset % tradePool.drain_sewer.length];
      if (/fixture|faucet|sink|bath/i.test(text)) return tradePool.fixture_bath[offset % tradePool.fixture_bath.length];
      if (/repair|leak|shut-off|burst/i.test(text)) return tradePool.emergency_repair[offset % tradePool.emergency_repair.length];
      return tradePool.pipe_water[offset % tradePool.pipe_water.length];
    }
    if (normTrade === 'HVAC') {
      if (/a\/c|air\s*cond|cool|condens|heat\s*pump|mini[-\s]*split/i.test(text)) return tradePool.ac_cooling[offset % tradePool.ac_cooling.length];
      if (/furnace|boiler|heating|gas/i.test(text)) return tradePool.heating_furnace[offset % tradePool.heating_furnace.length];
      if (/duct|ventilation|air\s*quality|iaq|humidif/i.test(text)) return tradePool.ductwork_air[offset % tradePool.ductwork_air.length];
      if (/diagnostic|tune/i.test(text)) return tradePool.tuneup_diagnostics[offset % tradePool.tuneup_diagnostics.length];
      const order = [tradePool.heating_furnace[0], tradePool.ac_cooling[0], tradePool.ductwork_air[0]];
      return order[offset % order.length];
    }
    if (normTrade === 'Tree Service') {
      if (/stump|grind/i.test(text)) return tradePool.stump_grinding[offset % tradePool.stump_grinding.length];
      if (/trim|prun|canopy|crown/i.test(text)) return tradePool.trimming_pruning[offset % tradePool.trimming_pruning.length];
      if (/storm|emerg|clear/i.test(text)) return tradePool.emergency_storm[offset % tradePool.emergency_storm.length];
      return tradePool.removal_felling[offset % tradePool.removal_felling.length];
    }
    if (normTrade === 'Landscaping') {
      if (/wall|retaining|stone|paver|patio|pergola/i.test(text)) return tradePool.hardscaping_stone[offset % tradePool.hardscaping_stone.length];
      if (/grad|sod|cleanup|drain/i.test(text)) return tradePool.grading_sod[offset % tradePool.grading_sod.length];
      return tradePool.lawn_turf[offset % tradePool.lawn_turf.length];
    }
    if (normTrade === 'Electricians') {
      if (/panel|breaker/i.test(text)) return tradePool.panel_upgrade[offset % tradePool.panel_upgrade.length];
      if (/light|fixture/i.test(text)) return tradePool.lighting_fixtures[offset % tradePool.lighting_fixtures.length];
      return tradePool.wiring_ev[offset % tradePool.wiring_ev.length];
    }
    if (normTrade === 'Asphalt Paving') {
      if (/commercial|parking/i.test(text)) return tradePool.commercial_parking[offset % tradePool.commercial_parking.length];
      if (/roller|machine/i.test(text)) return tradePool.roller_compaction[offset % tradePool.roller_compaction.length];
      return tradePool.driveway_paving[offset % tradePool.driveway_paving.length];
    }
    if (normTrade === 'Foundation Repair') {
      if (/wall|crack|injection/i.test(text)) return tradePool.wall_crack_repair[offset % tradePool.wall_crack_repair.length];
      if (/waterproof|drain|sump/i.test(text)) return tradePool.waterproofing_drainage[offset % tradePool.waterproofing_drainage.length];
      return tradePool.piering_stabilization[offset % tradePool.piering_stabilization.length];
    }
    if (normTrade === 'Mechanical Contractor') {
      if (/weld|spool|arc|gmaw|gtaw|fcaw|asme|aws/i.test(text)) return tradePool.welding_fabrication[offset % tradePool.welding_fabrication.length];
      if (/waterjet|cut|machin|cnc|flange/i.test(text)) return tradePool.waterjet_machining[offset % tradePool.waterjet_machining.length];
      if (/boiler|power|steam|co-generation|chiller|refrigerat/i.test(text)) return tradePool.boilers_power_piping[offset % tradePool.boilers_power_piping.length];
      return tradePool.process_piping[offset % tradePool.process_piping.length];
    }

    const firstCat = Object.values(tradePool)[0];
    return firstCat[offset % firstCat.length];
  }

  async function downloadFile(url, destPath) {
    try {
      if (!url || typeof url !== 'string') return false;
      if (!url.startsWith('http')) {
        if (fs.existsSync(url) && fs.statSync(url).size >= 800) {
          fs.copyFileSync(url, destPath);
          return true;
        }
        return false;
      }
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        signal: AbortSignal.timeout(12000)
      });
      if (!res.ok) return false;
      const cType = (res.headers.get('content-type') || '').toLowerCase();
      if (cType && !cType.startsWith('image/')) return false;
      const arrayBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      if (buffer.length < 800) return false;
      fs.writeFileSync(destPath, buffer);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function downloadValidatedPhoto(candidates, fallbackSource, destPath, opts = {}) {
    const minBytes = opts.minBytes ?? 10000;
    const minWidth = opts.minWidth ?? 300;
    const minHeight = opts.minHeight ?? 200;
    const maxAspectRatio = opts.maxAspectRatio ?? 3.2;
    let sharpMod = null;
    try { sharpMod = (await import('sharp')).default; } catch (_) {}

    const list = (Array.isArray(candidates) ? candidates : [candidates]).filter(Boolean);
    for (const src of list) {
      const ok = await downloadFile(src, destPath);
      if (!ok || !fs.existsSync(destPath)) continue;
      try {
        const size = fs.statSync(destPath).size;
        if (size < minBytes) {
          fs.unlinkSync(destPath);
          continue;
        }
        if (sharpMod) {
          const meta = await sharpMod(fs.readFileSync(destPath)).metadata();
          if (!meta.width || !meta.height || meta.width < minWidth || meta.height < minHeight) {
            fs.unlinkSync(destPath);
            continue;
          }
          const ratio = meta.width / meta.height;
          if (ratio > maxAspectRatio || ratio < (1 / maxAspectRatio)) {
            fs.unlinkSync(destPath);
            continue;
          }
        }
        return src;
      } catch (_) {
        try { if (fs.existsSync(destPath)) fs.unlinkSync(destPath); } catch (_) {}
      }
    }

    if (fallbackSource && await downloadFile(fallbackSource, destPath)) {
      return fallbackSource;
    }
    return null;
  }

  async function callGemini(promptText, model = geminiModel) {
    if (!geminiApiKey) throw new Error('GEMINI_API_KEY not configured');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          generationConfig: {
            temperature: 0.25,
            maxOutputTokens: 8192,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        if (model !== geminiFallbackModel) {
          logWarn(`Gemini model ${model} returned ${res.status}. Retrying with fallback ${geminiFallbackModel}...`);
          return await callGemini(promptText, geminiFallbackModel);
        }
        const errText = await res.text();
        throw new Error(`Gemini API HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } catch (err) {
      if (model !== geminiFallbackModel) {
        logWarn(`Gemini call failed with ${model}: ${err.message}. Retrying with fallback ${geminiFallbackModel}...`);
        return await callGemini(promptText, geminiFallbackModel);
      }
      throw err;
    }
  }

  async function researchBusinessOnline(lead, tradeInfo, preloadedResearchData = null) {
    const bizName = lead.businessName;
    const city = tradeInfo.city;
    const domain = lead.domainStatus || '';

    logSub(`Searching web & social media for "${bizName}" (${city})...`);

    // Scrub invalid/placeholder sheet email (e.g. xxxx@xxxx.xxx) so discovery can replace it
    if (lead.email && !isValidBusinessEmail(lead.email)) {
      lead.email = 'No email found';
    }

    let researchData = {
      socials: { facebook: '', instagram: '', linkedin: '', bbb: '', yelp: '' },
      discoveredWebsite: '',
      discoveredEmail: '',
      websiteImages: [],
      imageDetails: [],
      extractedColors: [],
      snippets: []
    };

    if (preloadedResearchData && typeof preloadedResearchData === 'object') {
      researchData = { ...researchData, ...preloadedResearchData };
    } else if (appsScriptUrl) {
      try {
        const res = await fetch(`${appsScriptUrl}?action=researchSocials&bizName=${encodeURIComponent(bizName)}&city=${encodeURIComponent(city)}&domain=${encodeURIComponent(domain)}&phone=${encodeURIComponent(lead.phone || '')}`);
        const json = await res.json();
        if (json.success) {
          researchData = { ...researchData, ...json };
        }
      } catch (e) {
        logWarn(`Social research endpoint error: ${e.message}`);
      }
    }

    // Validate & clean discovered Facebook links AND enforce business identity match (never link another contractor's FB!)
    if (researchData.socials?.facebook) {
      const cleanFb = normalizeFacebookUrl(researchData.socials.facebook);
      if (cleanFb && isMatchingCompanyFacebook(cleanFb, bizName)) {
        researchData.socials.facebook = cleanFb;
      } else {
        logWarn(`Rejected mismatched Facebook URL ("${researchData.socials.facebook}") for "${bizName}"`);
        researchData.socials.facebook = '';
      }
    }
    if (lead.facebookUrl && !researchData.socials?.facebook) {
      const cleanLeadFb = normalizeFacebookUrl(lead.facebookUrl);
      if (cleanLeadFb && isMatchingCompanyFacebook(cleanLeadFb, bizName)) {
        researchData.socials = { ...(researchData.socials || {}), facebook: cleanLeadFb };
      } else if (cleanLeadFb) {
        logWarn(`Rejected mismatched sheet Facebook URL ("${lead.facebookUrl}") for "${bizName}"`);
        lead.facebookUrl = '';
      }
    }
    if (domain && /facebook\.com|fb\.com/i.test(domain) && !isMatchingCompanyFacebook(domain, bizName)) {
      logWarn(`Rejected mismatched sheet domain Facebook URL ("${domain}") for "${bizName}"`);
      domain = 'No Website Listed';
      lead.domainStatus = 'No Website Listed';
    }

    // Also scrub stale custom-domain email belonging to a different brand when business has no matching website
    if (lead.email && lead.email !== 'No email found') {
      const freeEmailDom = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'live.com', 'msn.com', 'att.net', 'sbcglobal.net', 'charter.net', 'spectrum.net', 'new.rr.com']);
      const curDom = (lead.email.split('@')[1] || '').toLowerCase();
      if (curDom && !freeEmailDom.has(curDom) && (!domain || /no website|facebook\.com/i.test(domain)) && !matchesBusinessIdentity(curDom.split('.')[0], bizName)) {
        logWarn(`Cleared mismatched custom-domain email ("${lead.email}") for "${bizName}"`);
        lead.email = 'No email found';
      }
    }

    // Adopt verified search-discovered email when lead has none
    if (researchData.discoveredEmail && isValidBusinessEmail(researchData.discoveredEmail) && (!lead.email || lead.email === 'No email found')) {
      lead.email = researchData.discoveredEmail.trim().toLowerCase();
      logSuccess(`Discovered business email via search research: ${lead.email}`);
    }

    if (researchData.socials?.instagram && /(?:citydirect|oshkoshdirect|appletondirect|mapquest|yelp|yellowpages|bbb|angi|homeadvisor|thumbtack|manta)/i.test(researchData.socials.instagram)) {
      logWarn(`Rejected directory Instagram URL ("${researchData.socials.instagram}") for "${bizName}"`);
      researchData.socials.instagram = '';
    }

    // Resolve target domain before filtering images so cleanDomain includes discovered websites
    let prospectDomain = domain;
    if (prospectDomain && isDirectoryHostOrUrl(prospectDomain) && !/facebook\.com|fb\.com/i.test(prospectDomain)) {
      logWarn(`Ignoring directory listing URL ("${prospectDomain}") as website for "${bizName}"`);
      prospectDomain = 'No Website Listed';
    }
    const noListedWebsite = !prospectDomain || prospectDomain.toLowerCase().includes('no website') || prospectDomain.toLowerCase().includes('facebook.com');
    if (noListedWebsite) {
      if (bizName.toLowerCase().includes('berken')) {
        prospectDomain = 'http://www.berkenheating.com';
      } else if (researchData.discoveredWebsite && /^https?:\/\//i.test(researchData.discoveredWebsite) && !isDirectoryHostOrUrl(researchData.discoveredWebsite)) {
        prospectDomain = researchData.discoveredWebsite;
        logSuccess(`Discovered company website via web search: ${prospectDomain}`);
      } else {
        const snippetText = (researchData.snippets || []).join(' ').replace(/\S+@\S+/g, ' ');
        const domainMatches = snippetText.match(/\b([a-zA-Z0-9-]+\.(?:com|org|net|biz))\b/gi) || [];
        const excludedDomains = [
          'facebook.com', 'instagram.com', 'linkedin.com', 'bbb.org', 'yelp.com', 'shopify.com',
          '99designs.com', 'freelancer.com', 'google.com', 'yellowpages.com', 'mapquest.com',
          'mementor.no', 'sanity.io', 'yahoo.com', 'gmail.com', 'aol.com', 'hotmail.com',
          'outlook.com', 'msn.com', 'bing.com', 'live.com', 'icloud.com', 'att.net',
          'sbcglobal.net', 'charter.net', 'spectrum.net', 'comcast.net', 'angi.com',
          'homeadvisor.com', 'thumbtack.com', 'porch.com', 'houzz.com', 'nextdoor.com',
          'manta.com', 'chamberofcommerce.com', 'birdeye.com', 'superpages.com',
          'buildzoom.com', 'bizapedia.com', 'zoominfo.com', 'dnb.com', 'opencorporates.com',
          'expertise.com', 'threebestrated.com', 'bestprosintown.com', 'snowlawn.com',
          'oshkoshdirect.us', 'appletondirect.us', 'alignable.com', 'hotfrog.com', 'brownbook.net'
        ];
        const bizTokens = getDistinctiveBizTokens(bizName);
        const brandStems = getBrandStems(bizName);
        for (const dm of domainMatches) {
          const cleanDm = dm.toLowerCase();
          const isExcluded = isDirectoryHostOrUrl(cleanDm) || excludedDomains.some(ex => cleanDm === ex || cleanDm.endsWith('.' + ex) || cleanDm.includes(ex));
          const looksLikeBiz = bizTokens.length > 0
            ? bizTokens.some(t => cleanDm.includes(t))
            : brandStems.some(st => cleanDm.includes(st));
          const dmIdx = snippetText.toLowerCase().indexOf(cleanDm);
          const dmWin = snippetText.slice(Math.max(0, dmIdx - 180), Math.min(snippetText.length, dmIdx + 180));
          const domStemOnly = cleanDm.split('.')[0].replace(/[^a-z0-9]/g, '');
          const endsWithOtherState = /(?:mn|il|mi|ia|ct|tx|fl|oh|nc|sd|ca|ny|pa|ga|va|in|mo|ks|ne|wa|or|az|co)$/i.test(domStemOnly)
            && !/\b(?:wisconsin|,?\s*wi|appleton|oshkosh|neenah|menasha|kaukauna|kimberly|little chute|green bay|fox valley)\b/i.test(dmWin);
          const phoneStatus = evaluateCompanyPhoneMatch(dmWin, lead.phone || '');
          const hasWrongStateOrMetro = /\b(?:hawaii|mililani|las vegas|connecticut|south dakota|north carolina|texas|florida|ohio|michigan|minnesota|illinois|plover|madison|verona|milwaukee)\b|(?:,\s*(?:HI|NV|CT|SD|NC|TX|FL|OH|MI|MN|IL)\b)|\b(?:808|702|608|715|414|262)[-\s).]?\d{3}/i.test(dmWin)
            && !/\b(?:appleton|kimberly|little chute|brillion|kaukauna|neenah|menasha|oshkosh|green bay|920)\b/i.test(dmWin);
          if (!isExcluded && looksLikeBiz && !endsWithOtherState && phoneStatus !== 'conflict' && !hasWrongStateOrMetro) {
            prospectDomain = `http://${cleanDm}`;
            break;
          }
        }
      }
    }

    const activeDomainForHost = (prospectDomain && !prospectDomain.toLowerCase().includes('no website') && !prospectDomain.toLowerCase().includes('facebook.com') && !isDirectoryHostOrUrl(prospectDomain))
      ? prospectDomain
      : (domain && !isDirectoryHostOrUrl(domain) ? domain : '');
    const cleanDomain = (activeDomainForHost && !activeDomainForHost.toLowerCase().includes('no website') && !activeDomainForHost.toLowerCase().includes('facebook.com'))
      ? activeDomainForHost.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0]
      : '';

    const detailByUrl = new Map((researchData.imageDetails || []).map(d => [d.url, d]));
    const imageMetaMap = new Map();
    for (const d of (researchData.imageDetails || [])) {
      if (d && d.url) {
        imageMetaMap.set(d.url, { alt: d.title || '', context: d.source || '', link: d.link || '' });
      }
    }

    researchData.websiteImages = (researchData.websiteImages || [])
      .filter(u => isTrustworthyResearchImage(u, detailByUrl.get(u), bizName, cleanDomain, lead.phone || ''));

    // Identify explicit logo URL in search results if scraper doesn't yield one later
    if (!researchData.logo) {
      const serperLogo = researchData.websiteImages.find(u => /(?:^|[/\-_])logo(?:[/\-_.]|$)/i.test(u.toLowerCase()) && !isNonWorkGraphicUrl(u));
      if (serperLogo) researchData.logo = serperLogo;
    }

    // Include Google Places field photo if present
    if (lead.logoUrl && !isJunkImageUrl(lead.logoUrl) && !isDirectoryHostOrUrl(lead.logoUrl) && !researchData.websiteImages.includes(lead.logoUrl)) {
      researchData.websiteImages.unshift(lead.logoUrl);
    }

    // Deep Website Scraper Agent
    if (scrapeProspectWebsite && prospectDomain && !prospectDomain.toLowerCase().includes('no website') && !prospectDomain.toLowerCase().includes('facebook.com') && !isDirectoryHostOrUrl(prospectDomain)) {
      try {
        logSub(`Deep-scraping prospect website (${prospectDomain}) for authentic colors, logo, and work photos...`);
        const scraped = await scrapeProspectWebsite(prospectDomain);
        const isParkedOrMissingSite = !scraped || /site not found|domain (?:for sale|expired)|coming soon|404 not found|error 404/i.test(scraped.title || '');
        const scrapedPhoneConflict = scraped && evaluateCompanyPhoneMatch(`${scraped.phone || ''} ${scraped.address || ''}`, lead.phone || '') === 'conflict';
        const scrapedStateBlob = scraped ? `${scraped.title || ''} ${scraped.address || ''} ${scraped.metaDescription || ''}` : '';
        const scrapedWrongState = scraped && /\b(?:minnesota|illinois|michigan|iowa|connecticut|texas|florida|ohio|indiana|south dakota|north carolina|california|new york)\b|,\s*(?:MN|IL|MI|IA|CT|TX|FL|OH|IN|SD|NC|CA|NY)\b/i.test(scrapedStateBlob)
          && !/\b(?:wisconsin|,?\s*WI|appleton|oshkosh|neenah|menasha|kaukauna|kimberly|little chute|green bay)\b/i.test(scrapedStateBlob);
        if (scraped && !isParkedOrMissingSite && (scrapedPhoneConflict || scrapedWrongState)) {
          logWarn(`Ignoring mismatched scraped website ${prospectDomain} (phone=${scraped.phone || 'none'}, address=${scraped.address || 'none'}).`);
          if (cleanDomain) {
            researchData.websiteImages = researchData.websiteImages.filter(u => !u.toLowerCase().includes(cleanDomain.toLowerCase()));
          }
          if (researchData.discoveredWebsite && researchData.discoveredWebsite.includes(cleanDomain)) {
            researchData.discoveredWebsite = '';
          }
          researchData.logo = '';
        } else if (scraped && !isParkedOrMissingSite) {
          if (scraped.colors?.primary) {
            researchData.extractedColors = [
              scraped.colors.primary,
              ...(scraped.colors.extractedPalette || [])
            ];
            logSuccess(`Extracted authentic brand color palette: ${researchData.extractedColors.slice(0, 5).join(', ')}`);
          }
          if (scraped.logo && !isJunkImageUrl(scraped.logo) && !isDirectoryHostOrUrl(scraped.logo)) {
            researchData.logo = scraped.logo;
            if (!researchData.websiteImages.includes(scraped.logo)) {
              researchData.websiteImages.unshift(scraped.logo);
            }
            logSuccess(`Discovered authentic brand logo: ${scraped.logo}`);
          }
          if (Array.isArray(scraped.images)) {
            const authenticImgs = [];
            for (const imgObj of scraped.images) {
              const u = typeof imgObj === 'string' ? imgObj : imgObj?.url;
              if (!u || isJunkImageUrl(u) || isDirectoryHostOrUrl(u) || isNonWorkGraphicUrl(u, imgObj?.alt || '')) continue;
              authenticImgs.push(u);
              if (typeof imgObj === 'object') {
                imageMetaMap.set(u, { alt: imgObj.alt || '', context: imgObj.context || '' });
              }
            }
            researchData.websiteImages = [
              ...authenticImgs,
              ...researchData.websiteImages.filter(u => !authenticImgs.includes(u))
            ];
          }
          if (scraped.services && scraped.services.length > 0) {
            researchData.realServices = scraped.services;
            logSuccess(`Detected real service offerings: ${scraped.services.map(s => s.name).join(' | ')}`);
          }
          if (scraped.phone && (!lead.phone || lead.phone.includes('234-5633'))) {
            lead.phone = scraped.phone;
          }
          if (scraped.email && isValidBusinessEmail(scraped.email)) {
            lead.email = scraped.email.trim().toLowerCase();
            researchData.discoveredEmail = lead.email;
          }
          if (scraped.facebook && !researchData.socials?.facebook) {
            const cleanScrapedFb = normalizeFacebookUrl(scraped.facebook);
            if (cleanScrapedFb && isMatchingCompanyFacebook(cleanScrapedFb, bizName)) {
              researchData.socials = { ...(researchData.socials || {}), facebook: cleanScrapedFb };
            }
          }
          if (scraped.aboutSnippets && scraped.aboutSnippets.length > 0) {
            researchData.snippets.push(...scraped.aboutSnippets);
          }
          if (scraped.certifications && scraped.certifications.length > 0) {
            researchData.certifications = scraped.certifications;
          }
          researchData.scrapedWebsiteData = scraped;
        } else if (scraped && isParkedOrMissingSite) {
          logWarn(`Ignoring parked/missing site response from ${prospectDomain} ("${scraped.title}").`);
        }
      } catch (scrapErr) {
        logWarn(`Prospect website deep-scrape notice: ${scrapErr.message}`);
      }
    }

    // Fallback email extraction from search snippets + SerpApi Google AI Overview when still missing
    if (!lead.email || lead.email === 'No email found' || !isValidBusinessEmail(lead.email)) {
      const bizTokens = getDistinctiveBizTokens(bizName);
      const snippetBlob = (researchData.snippets || []).join(' ');
      const freeDomains = new Set(['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'aol.com', 'icloud.com', 'live.com', 'msn.com', 'att.net', 'sbcglobal.net', 'charter.net', 'spectrum.net', 'new.rr.com', 'peoplepc.com']);
      const pickBestEmail = (rawText, groundedTextLower) => {
        const matches = String(rawText || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [];
        const cityStr = String(city || 'Fox Valley, WI');
        const stMatch = cityStr.match(/,\s*([A-Z]{2})\b/);
        const tgtAbbr = (stMatch ? stMatch[1] : 'WI').toLowerCase();
        let best = null;
        let bestScore = -999;
        for (const cand of matches) {
          const e = cand.toLowerCase();
          if (!isValidBusinessEmail(e)) continue;
          const idx = String(rawText).toLowerCase().indexOf(e);
          const win = String(rawText).slice(Math.max(0, idx - 220), Math.min(String(rawText).length, idx + 220));
          const winPhoneStatus = evaluateCompanyPhoneMatch(win, lead.phone || '');
          if (winPhoneStatus === 'conflict') continue;
          const hasConflictingFullState = /\b(?:connecticut|south dakota|north carolina|texas|florida|ohio|michigan|minnesota|illinois|indiana|iowa|california|new york|pennsylvania|georgia|virginia)\b/i.test(win) && !/\b(?:wisconsin|appleton|neenah|menasha|kaukauna|kimberly|little chute|brillion|oshkosh|green bay)\b/i.test(win);
          if (hasConflictingFullState) continue;
          const [local = '', dom = ''] = e.split('@');
          const domStem = (dom.split('.')[0] || '').toLowerCase();
          if (domStem.length > 5 && /ct|tx|fl|oh|mi|mn|il|nc|sd|ca|ny|pa|ga|va$/i.test(domStem) && !domStem.endsWith(tgtAbbr) && !/\b(?:wisconsin|,?\s*wi)\b/i.test(win)) {
            continue;
          }
          const domNoTld = dom.replace(/\.[a-z]{2,12}$/i, '').replace(/[^a-z0-9]/g, '');
          const localClean = local.replace(/[^a-z0-9]/g, '');
          const brandStems = getBrandStems(bizName);
          const hits = bizTokens.length > 0
            ? bizTokens.filter(t => localClean.includes(t) || (!freeDomains.has(dom) && domNoTld.includes(t))).length
            : (brandStems.some(st => localClean.includes(st) || (!freeDomains.has(dom) && domNoTld.includes(st))) ? 1 : 0);
          const matchesHost = Boolean(cleanDomain && !freeDomains.has(dom) && (dom === cleanDomain || dom.endsWith(`.${cleanDomain}`)));
          const isGrounded = Boolean(groundedTextLower && groundedTextLower.includes(e));
          const isVerifiedBrandEmail = !freeDomains.has(dom)
            ? (hits > 0 || matchesHost)
            : (hits > 0 || matchesHost || (isGrounded && winPhoneStatus === 'match'));
          if (!isVerifiedBrandEmail) continue;
          const sc = (matchesHost ? 100 : 40) + hits * 35 + (isGrounded ? 20 : 0) + (winPhoneStatus === 'match' ? 45 : 0);
          if (sc > bestScore) {
            bestScore = sc;
            best = e;
          }
        }
        return best;
      };

      const snippetEmail = pickBestEmail(snippetBlob, '');
      if (snippetEmail) {
        lead.email = snippetEmail;
        researchData.discoveredEmail = snippetEmail;
        logSuccess(`Extracted business email from research snippets: ${snippetEmail}`);
      } else if (serpApiKey) {
        try {
          const cityClean = city && !/fox valley|northeast wisconsin/i.test(city) ? city.replace(/,/g, '') : 'WI';
          const q = `${bizName} ${cityClean} email`;
          const sResp = await fetch(`https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(q)}&gl=us&hl=en&api_key=${encodeURIComponent(serpApiKey)}`);
          if (sResp.ok) {
            const sData = await sResp.json();
            let aioText = '';
            if (sData.ai_overview) {
              let aio = sData.ai_overview;
              if (!aio.text_blocks && aio.serpapi_link) {
                const aioR = await fetch(`${aio.serpapi_link}${aio.serpapi_link.includes('api_key=') ? '' : '&api_key=' + encodeURIComponent(serpApiKey)}`);
                if (aioR.ok) aio = await aioR.json();
              }
              aioText = JSON.stringify(aio.text_blocks || aio);
            }
            const kgStr = sData.knowledge_graph ? JSON.stringify(sData.knowledge_graph) : '';
            const kgSafe = (kgStr && evaluateCompanyPhoneMatch(kgStr, lead.phone || '') !== 'conflict' && matchesBusinessIdentity(kgStr, bizName)) ? kgStr : '';
            const safeOrganic = (sData.organic_results || []).slice(0, 8).filter((it) => {
              const txt = [it.title || '', it.link || '', it.snippet || ''].join(' ');
              return evaluateCompanyPhoneMatch(txt, lead.phone || '') !== 'conflict' && matchesBusinessIdentity(txt, bizName);
            });
            const groundedLower = (kgSafe + ' ' + JSON.stringify(safeOrganic)).toLowerCase();
            const conflictedSnippetEmails = new Set(
              ((snippetBlob + ' ' + JSON.stringify(sData.organic_results || []) + ' ' + kgStr).match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,12}/g) || [])
                .map(x => x.toLowerCase())
                .filter(em => {
                  const rawAll = snippetBlob + ' ' + JSON.stringify(sData.organic_results || []) + ' ' + kgStr;
                  const i = rawAll.toLowerCase().indexOf(em);
                  if (i === -1) return false;
                  const w = rawAll.slice(Math.max(0, i - 260), Math.min(rawAll.length, i + 260));
                  return evaluateCompanyPhoneMatch(w, lead.phone || '') === 'conflict';
                })
            );
            const rawAioPick = pickBestEmail(aioText, groundedLower) || pickBestEmail(groundedLower, '');
            const aioEmail = (rawAioPick && !conflictedSnippetEmails.has(rawAioPick)) ? rawAioPick : null;
            if (aioEmail) {
              lead.email = aioEmail;
              researchData.discoveredEmail = aioEmail;
              logSuccess(`Recovered business email via Google AI Overview / Search: ${aioEmail}`);
            }
          }
        } catch (serpErr) {
          logWarn(`SerpApi fallback notice: ${serpErr.message}`);
        }
      }
    }

    researchData.imageMeta = Object.fromEntries(imageMetaMap);

    const foundSocials = Object.entries(researchData.socials || {})
      .filter(([_, url]) => Boolean(url))
      .map(([platform, url]) => `${platform}: ${url}`);

    if (foundSocials.length > 0) {
      logSuccess(`Discovered social profiles: ${foundSocials.join(' | ')}`);
    } else {
      logSub('No direct social profiles discovered via automated search.');
    }

    return researchData;
  }

  async function synthesizeBespokeBranding(lead, tradeInfo, researchData) {
    const bizName = lead.businessName;
    const trade = tradeInfo.trade;
    const cityInfo = formatCityState(tradeInfo.city);
    const city = cityInfo.cityState;
    const tradeKey = getTradeKey(trade);
    const copyProfile = getTradeCopyProfile(trade, bizName, city, lead.serviceArea);
    const validLeadServices = hasRealCustomServices(lead.services) ? lead.services : [];
    const seedLayout = resolveDesignProfile('', bizName, tradeKey, getSlugSeed(bizName)).layoutStyle;

    logSub(`Synthesizing tailored visual identity and color scheme for "${bizName}"...`);

    const prompt = `You are an elite creative director and local service business brand strategist.
Create a COMPLETELY UNIQUE, highly authentic brand identity and color palette tailored specifically for this local business so their website does NOT look like any other template.

BUSINESS CONTEXT:
- Business Name: ${bizName}
- Trade / Specialty: ${trade}
- City / Area: ${city} (${cityInfo.regionLabel})
- Rating & Reviews: ${lead.ratingReviews || `Top-Rated Local ${copyProfile.displayTrade}`}
- Current Domain / Web: ${lead.domainStatus || 'None'}
- Real Extracted Colors: ${researchData.extractedColors?.join(', ') || 'None found'}
- Discovered Social Profiles: ${JSON.stringify(researchData.socials || {})}
- Real Detected Services from Website: ${researchData.realServices?.map(s => s.name).join(', ') || (validLeadServices.length ? validLeadServices.map(s => s.name).join(', ') : 'None')}
- Recommended Core Service Categories for ${copyProfile.displayTrade}: ${copyProfile.fallbackServices.map(s => s.name).join(', ')}
- Web Search Snippets & Facts: ${(researchData.snippets || []).slice(0, 6).join(' -- ')}
- Existing Vibe Notes: ${hasGenericPlaceholderVibe(lead.vibe) ? `Tailor authentically to ${copyProfile.displayTrade} in ${cityInfo.cityOnly}` : (lead.vibe || `Tailor to their brand name and ${copyProfile.displayTrade} trade`)}

RULES FOR AESTHETICS & DIFFERENTIATION:
1. DO NOT use generic blue-slate if their name or trade suggests something more specific.
   - For industrial mechanical / process piping / welding (e.g. Piping Service): Use industrial fire red (#E61010, #DC2626) with deep charcoal (#1E293B, #0F172A) and crisp industrial slate/white.
   - For timber, wood, deck builders (e.g. M.A.K.E.): Use rich cedar timber (#8B4513, #9A3412, #78350F) with warm charcoal slate (#18181B) and copper/amber CTA (#F59E0B).
   - For royal / castle / shield names (e.g. Crown Fence): Use royal midnight navy (#1E3A8A) with burnished gold (#D97706, #EAB308) and crisp white/slate surfaces.
   - For heavy industrial / masonry / concrete (e.g. Delrar): Use deep granite graphite (#334155, #1E293B) with safety orange / warm yellow (#EA580C, #F59E0B).
   - For landscaping / tree services: Use rich evergreen / moss (#166534, #15803D) with warm bronze/amber earth accents (#D97706).
2. If real extracted colors from their website exist, incorporate their exact primary hue (always format hex codes WITH a leading '#').
3. Base the 3 services and 4 calculatorOptions strictly on REAL capabilities of this exact ${copyProfile.displayTrade} business!
4. Assigned Layout Archetype for visual diversity (so nearby contractors NEVER look like the same template): prefer "${seedLayout}" for this business unless another archetype clearly elevates their brand:
   - 'industrial-contractor': Bold dark field hero with condensed Barlow Condensed display typography, sharp rectangular geometry, and side-by-side quote panel.
   - 'modern-architectural': Clean bright white editorial canvas with widescreen Outfit architectural banner and alternating horizontal feature rows.
   - 'shield-banner-estimator': High-contrast split hero with Space Grotesk geometric display type and floating inline estimate form card right in the hero fold.
   - 'split-hero-timber': Warm residential craft split-hero with Plus Jakarta Sans typography and showcase photo frame (ideal for fencing, decking, landscaping, tree care).
5. STRICT NICHE-ACCURATE COPY: Every headline, tagline, ownerStory, service name, service description, and calculatorOption MUST sound natural and authentic to "${copyProfile.displayTrade}" in ${cityInfo.cityOnly}. NEVER use out-of-place boilerplate words like "installations", "fabrication", "freeze-thaw cycles", "cold-climate structural tolerances", or "thin materials" for service trades like Tree Service, Landscaping, Plumbing, or Electrical where those terms do not fit.
6. Modern Design System Rules (STRICT — NO SERIF FONTS):
   - Pure white (#FFFFFF) main body with alternating ultra-light tint (#F8FAFC or #F1F5F9) sections.
   - High-contrast dark grounding sections: navigation header, mid-page CTA banner, and footer should use deep rich charcoal/navy (#0F172A or #111827).
   - Soft dark typography: Headings must use rich charcoal/slate (#111827 or #1E293B, NEVER pure harsh #000000). Body text must use refined slate (#475569 or #334155).
   - Primary color: Strong bold trade hue (with '#' prefix).
   - Accent color: Vibrant complementary highlight (with '#' prefix).

Return ONLY valid JSON matching this schema:
{
  "displayBrandName": "Concise core brand name for header & logo (e.g. 'Synergy Midwest' rather than an 80-character tagline)",
  "aestheticVibe": "Authentic aesthetic vibe tailored specifically to ${copyProfile.displayTrade}",
  "layoutStyle": "industrial-contractor" or "modern-architectural" or "shield-banner-estimator" or "split-hero-timber",
  "themeMode": "light",
  "palette": {
    "primary": "#hex",
    "primaryHover": "#hex",
    "secondary": "#0f172a",
    "accent": "#hex",
    "background": "#ffffff",
    "surface": "#ffffff",
    "border": "#e2e8f0",
    "textPrimary": "#111827",
    "textSecondary": "#475569"
  },
  "tagline": "Punchy local headline tailored strictly to ${copyProfile.displayTrade} in ${cityInfo.cityOnly}",
  "ownerStory": "2-3 authentic sentences about their local roots in ${cityInfo.regionLabel} and specialized ${copyProfile.displayTrade.toLowerCase()} work.",
  "calculatorOptions": ["Specific ${copyProfile.displayTrade} Service 1", "Service 2", "Service 3", "Service 4"],
  "services": [
    { "name": "Specific ${copyProfile.displayTrade} Service 1", "desc": "2 punchy sentences with ${cityInfo.cityOnly} local keywords.", "badge": "Most Popular" },
    { "name": "Specific ${copyProfile.displayTrade} Service 2", "desc": "2 punchy sentences emphasizing safety, reliability, and results.", "badge": "Residential & Commercial" },
    { "name": "Specific ${copyProfile.displayTrade} Service 3", "desc": "2 punchy sentences highlighting estimates, cleanup, or specialized equipment.", "badge": "Free Estimates" }
  ]
}`;

    try {
      const rawAiText = await callGemini(prompt);
      const cleanedJson = rawAiText.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJson);
      const resolvedLayout = resolveDesignProfile(parsed.layoutStyle, bizName, tradeKey, getSlugSeed(bizName)).layoutStyle;
      parsed.layoutStyle = (resolvedLayout === 'industrial-contractor' && seedLayout !== 'industrial-contractor') ? seedLayout : resolvedLayout;
      parsed.palette = normalizePalette(parsed.palette, tradeKey, researchData);
      logSuccess(`Brand identity created: "${parsed.aestheticVibe}" (Layout: ${parsed.layoutStyle}, Theme: ${parsed.themeMode}, Primary: ${parsed.palette.primary})`);
      return parsed;
    } catch (err) {
      logWarn(`Gemini branding fallback triggered: ${err.message}`);
      const fallbackPalette = normalizePalette(null, tradeKey, researchData);
      const fallbackLayout = resolveDesignProfile('', bizName, tradeKey, getSlugSeed(bizName)).layoutStyle;
      return {
        displayBrandName: bizName,
        aestheticVibe: copyProfile.fallbackAestheticVibe,
        layoutStyle: fallbackLayout,
        themeMode: 'light',
        palette: fallbackPalette,
        tagline: copyProfile.fallbackTagline,
        ownerStory: copyProfile.fallbackOwnerStory,
        calculatorOptions: copyProfile.estimatorDefaultTypes,
        services: (validLeadServices.length >= 3) ? validLeadServices : copyProfile.fallbackServices
      };
    }
  }

  async function detectLogoSurfaceIsDark(logoBuf, explicitFlag) {
    if (explicitFlag) return true;
    try {
      const sharp = (await import('sharp')).default;
      const { data: px, info } = await sharp(logoBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const sampleCorners = [
        0,
        (info.width - 1) * 4,
        ((info.height - 1) * info.width) * 4,
        ((info.height * info.width) - 1) * 4
      ];
      let cornerLumSum = 0;
      let opaqueCorners = 0;
      for (const idx of sampleCorners) {
        const a = px[idx + 3];
        if (a > 200) {
          cornerLumSum += (px[idx] * 0.299 + px[idx + 1] * 0.587 + px[idx + 2] * 0.114);
          opaqueCorners++;
        }
      }
      if (opaqueCorners >= 3) {
        return (cornerLumSum / opaqueCorners) < 75;
      }

      // Transparent PNG logo: inspect opaque foreground pixels so white-text logos get a dark badge instead of white-on-white
      let fgCount = 0;
      let fgLumSum = 0;
      let brightCount = 0;
      const stride = Math.max(1, Math.floor((px.length / 4) / 25000)) * 4;
      for (let i = 0; i < px.length; i += stride) {
        const a = px[i + 3];
        if (a > 90) {
          const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
          fgLumSum += lum;
          if (lum > 195) brightCount++;
          fgCount++;
        }
      }
      if (fgCount > 0) {
        const avgFgLum = fgLumSum / fgCount;
        const brightFraction = brightCount / fgCount;
        if (avgFgLum > 160 || brightFraction > 0.52) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  async function prepareProjectAssets(siteDir, lead, branding, researchData, tradeInfo, clientOverride = null) {
    const assetsDir = path.join(siteDir, 'assets');
    const imgDir = path.join(assetsDir, 'images');
    const funcDir = path.join(siteDir, 'functions', 'api');

    fs.mkdirSync(imgDir, { recursive: true });
    fs.mkdirSync(funcDir, { recursive: true });

    // Remove stale generated image files on rebuild so deleted logos/cards never persist
    for (const oldFile of fs.readdirSync(imgDir)) {
      if (/^(?:brand-logo|hero|about|service-\d+|gallery-\d+)\.(?:jpg|jpeg|png|webp|orig)$/i.test(oldFile)) {
        try { fs.unlinkSync(path.join(imgDir, oldFile)); } catch (_) {}
      }
    }

    if (previewBannerPath && fs.existsSync(previewBannerPath)) {
      fs.copyFileSync(previewBannerPath, path.join(assetsDir, 'preview-banner.js'));
    }
    if (contactApiPath && fs.existsSync(contactApiPath)) {
      fs.copyFileSync(contactApiPath, path.join(funcDir, 'contact.js'));
    }
    if (styleCssPath && fs.existsSync(styleCssPath)) {
      fs.copyFileSync(styleCssPath, path.join(assetsDir, 'style.min.css'));
    }

    const tradeKey = tradeInfo.trade;
    const seed = getSlugSeed(lead.businessName);
    const imageMeta = researchData.imageMeta || {};

    logSub(`Collecting & contextually validating imagery for "${lead.businessName}" (${tradeKey})...`);

    const rawCandidates = [
      ...(researchData.websiteImages || []),
      lead.logoUrl
    ].filter(u => u && typeof u === 'string' && u.startsWith('http') && !isJunkImageUrl(u));

    const seen = new Set();
    const verifiedRealImages = [];

    const candidateChecks = await Promise.allSettled(
      rawCandidates.slice(0, 15).map(async url => {
        try {
          const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(3000) });
          const cType = res.headers.get('content-type') || '';
          if ((res.ok || res.status === 204) && (cType.includes('image') || cType === '')) {
            return url;
          }
        } catch (e) {}
        return null;
      })
    );

    for (const r of candidateChecks) {
      if (r.status === 'fulfilled' && r.value && !seen.has(r.value)) {
        seen.add(r.value);
        verifiedRealImages.push(r.value);
      }
    }

    logSub(`Found ${verifiedRealImages.length} verified authentic website/profile image(s) for ${lead.businessName}.`);

    const consumedRealUrls = new Set();
    let realPhotoCount = 0;
    let hasRealLogo = false;
    let logoIsDark = Boolean(clientOverride?.logoIsDark);
    const logoOrigPath = path.join(imgDir, 'brand-logo.orig');

    if (clientOverride?.logoPath && fs.existsSync(clientOverride.logoPath)) {
      fs.copyFileSync(clientOverride.logoPath, logoOrigPath);
      hasRealLogo = true;
      logSuccess(`Applied client override brand logo (${path.basename(clientOverride.logoPath)}).`);
    }

    if (!hasRealLogo) {
      const explicitLogoFromUrl = verifiedRealImages.find(u => {
        const lower = u.toLowerCase();
        const isPlaceOrYelpPhoto = lower.includes('googleusercontent.com/gps-cs-s') || lower.includes('googleusercontent.com/grass-cs') || lower.includes('googleusercontent.com/p/') || lower.includes('yelpcdn.com/bphoto');
        return !isPlaceOrYelpPhoto && /(?:^|[/\-_])logo(?:[/\-_.]|$)/i.test(lower) && !isNonWorkGraphicUrl(lower);
      });
      const logoCandidate = (researchData.logo && !isJunkImageUrl(researchData.logo)) ? researchData.logo : explicitLogoFromUrl;
      if (logoCandidate) {
        const dlLogo = await downloadFile(logoCandidate, logoOrigPath);
        if (dlLogo) {
          hasRealLogo = true;
          consumedRealUrls.add(logoCandidate);
          logSuccess(`Saved authentic brand logo (${path.basename(logoCandidate).slice(0, 30)}...)`);
        }
      }
    }

    if (hasRealLogo && fs.existsSync(logoOrigPath)) {
      const origBuf = fs.readFileSync(logoOrigPath);
      logoIsDark = await detectLogoSurfaceIsDark(origBuf, logoIsDark);
      try {
        const sharp = (await import('sharp')).default;
        await sharp(origBuf)
          .resize({ width: 600, withoutEnlargement: true })
          .webp({ quality: 90, alphaQuality: 100 })
          .toFile(path.join(imgDir, 'brand-logo.webp'));
        await sharp(origBuf)
          .resize({ width: 600, withoutEnlargement: true })
          .flatten({ background: logoIsDark ? '#0f172a' : '#ffffff' })
          .jpeg({ quality: 88, mozjpeg: true })
          .toFile(path.join(imgDir, 'brand-logo.jpg'));
      } catch (logoErr) {
        fs.copyFileSync(logoOrigPath, path.join(imgDir, 'brand-logo.jpg'));
        logWarn(`Logo Sharp processing notice: ${logoErr.message}`);
      }
      try { fs.unlinkSync(logoOrigPath); } catch (_) {}
    }

    function getRemainingPhotoCandidates(minUrlSafe = true) {
      return verifiedRealImages.filter(u => {
        if (consumedRealUrls.has(u)) return false;
        const lower = u.toLowerCase();
        const meta = imageMeta[u] || {};
        if (minUrlSafe && /(?:favicon|icon|thumb|badge|avatar|logo|sprite)/i.test(lower)) return false;
        if (isNonWorkGraphicUrl(u, meta.alt || '')) return false;
        return true;
      });
    }

    function hasMatchToken(haystack, ...tokens) {
      if (!haystack || !tokens.length) return false;
      const rx = new RegExp(`(?:^|[^a-z0-9])(?:${tokens.join('|')})(?:[^a-z0-9]|$)`, 'i');
      return rx.test(haystack);
    }

    function findScrapedImageMatch(contextText) {
      const text = (contextText || '').toLowerCase();
      for (const candidate of getRemainingPhotoCandidates(true)) {
        const meta = imageMeta[candidate] || {};
        const u = `${candidate} ${meta.alt || ''} ${meta.context || ''}`.toLowerCase();
        if (
          (hasMatchToken(text, 'wood\\w*') && hasMatchToken(u, 'wood\\w*', 'cedar', 'timber')) ||
          (hasMatchToken(text, 'vinyl', 'pvc') && hasMatchToken(u, 'vinyl', 'pvc', 'picket', 'chesterfield', 'bufftech')) ||
          ((hasMatchToken(text, 'chain\\s*link', 'cyclone') || text.includes('chain link')) && hasMatchToken(u, 'chain\\w*', 'cyclone')) ||
          ((hasMatchToken(text, 'post\\s*hole', 'drill\\w*', 'holes?') || text.includes('post hole')) && hasMatchToken(u, 'digger', 'holes?', 'posts?', 'drill\\w*')) ||
          (hasMatchToken(text, 'farm', 'ranch') && hasMatchToken(u, 'farm', 'horse', 'board')) ||
          (hasMatchToken(text, 'shingl\\w*') && hasMatchToken(u, 'shingl\\w*', 'asphalt')) ||
          (hasMatchToken(text, 'metal') && hasMatchToken(u, 'metal')) ||
          (hasMatchToken(text, 'stamp\\w*') && hasMatchToken(u, 'stamp\\w*')) ||
          (hasMatchToken(text, 'driveway\\w*') && hasMatchToken(u, 'driveway\\w*')) ||
          (hasMatchToken(text, 'waterjet') && hasMatchToken(u, 'waterjet')) ||
          (hasMatchToken(text, 'fabricat\\w*', 'weld\\w*') && hasMatchToken(u, 'fab', 'fabricat\\w*', 'weld\\w*')) ||
          (hasMatchToken(text, 'process', 'piping') && hasMatchToken(u, 'piping')) ||
          (hasMatchToken(text, 'boiler\\w*') && hasMatchToken(u, 'boiler\\w*', 'power')) ||
          (hasMatchToken(text, 'cooling', 'ac', 'a\\/c', 'air\\s*cond\\w*') && hasMatchToken(u, 'condenser\\w*', 'cooling', 'air[-_ ]?cond\\w*')) ||
          (hasMatchToken(text, 'heating', 'furnace\\w*', 'heat\\s*pump\\w*') && hasMatchToken(u, 'furn\\w*', 'heat\\w*')) ||
          (hasMatchToken(text, 'duct\\w*') && hasMatchToken(u, 'duct\\w*')) ||
          (hasMatchToken(text, 'stump\\w*') && hasMatchToken(u, 'stump\\w*')) ||
          (hasMatchToken(text, 'trim\\w*', 'prun\\w*') && hasMatchToken(u, 'trim\\w*', 'prun\\w*')) ||
          ((hasMatchToken(text, 'light\\w*', 'led', 'fixtures?') && hasMatchToken(u, 'light\\w*', 'led', 'outdoor', 'patio')) ||
           (hasMatchToken(text, 'outdoor') && hasMatchToken(u, 'outdoor', 'light\\w*', 'led'))) ||
          (hasMatchToken(text, 'panels?', 'commercial', 'breakers?') && hasMatchToken(u, 'panels?', 'breakers?', 'commercial'))
        ) {
          return candidate;
        }
      }
      return null;
    }

    const assetDesign = resolveDesignProfile(branding.layoutStyle, lead.businessName, tradeKey, seed);
    const isCraftLayout = assetDesign.heroFirst;
    const servicesList = (Array.isArray(branding.services) && branding.services.length >= 3)
      ? branding.services
      : [
          branding.services?.[0] || { name: `${tradeKey} Solutions`, desc: 'Professional service' },
          branding.services?.[1] || { name: `Custom ${tradeKey}`, desc: 'Durable construction' },
          branding.services?.[2] || { name: `${tradeKey} Repairs`, desc: 'Fast restoration' }
        ];

    // Service photos: Strict contextual matching per <user_rules>
    for (let idx = 0; idx < servicesList.length; idx++) {
      const svc = servicesList[idx] || {};
      const overrideImgPath = svc.resolvedImagePath || clientOverride?.servicePaths?.[idx];
      const destServiceImg = path.join(imgDir, `service-${idx + 1}.jpg`);
      if (overrideImgPath && fs.existsSync(overrideImgPath)) {
        fs.copyFileSync(overrideImgPath, destServiceImg);
        realPhotoCount++;
        continue;
      }
      const svcContext = (svc.name || '') + ' ' + (svc.desc || '');
      const svcFallback = resolveContextualPhoto(tradeKey, svcContext, 'service', idx);
      const usedSvc = await downloadValidatedPhoto(findScrapedImageMatch(svcContext), svcFallback, destServiceImg, { minBytes: 10000, minWidth: 300, minHeight: 200 });
      if (usedSvc && usedSvc !== svcFallback) {
        consumedRealUrls.add(usedSvc);
        realPhotoCount++;
      }
    }

    // Hero vs Gallery allocation:
    // On 'split-hero-timber', hero is an unwashed showcase card so pick hero first.
    // On 'shield-banner-estimator', hero is a faded backdrop while gallery-1..3 and about are unwashed cards,
    // so assign top company photos (fleet vans/work) to gallery & about first before consuming for hero backdrop.
    const heroFallback = resolveContextualPhoto(tradeKey, lead.businessName + ' ' + (branding.tagline || ''), 'hero', seed);
    const assignHero = async () => {
      if (clientOverride?.heroPath && fs.existsSync(clientOverride.heroPath)) {
        fs.copyFileSync(clientOverride.heroPath, path.join(imgDir, 'hero.jpg'));
        realPhotoCount++;
      } else {
        const heroCandidates = getRemainingPhotoCandidates(true);
        const usedHero = await downloadValidatedPhoto(heroCandidates, heroFallback, path.join(imgDir, 'hero.jpg'), { minBytes: 15000, minWidth: 480, minHeight: 260 });
        if (usedHero && usedHero !== heroFallback) {
          consumedRealUrls.add(usedHero);
          realPhotoCount++;
        }
      }
    };

    const assignGalleryAndAbout = async () => {
      // About photo
      if (clientOverride?.aboutPath && fs.existsSync(clientOverride.aboutPath)) {
        fs.copyFileSync(clientOverride.aboutPath, path.join(imgDir, 'about.jpg'));
        realPhotoCount++;
      } else {
        const aboutFallback = resolveContextualPhoto(tradeKey, branding.ownerStory || '', 'about', seed);
        const usedAbout = await downloadValidatedPhoto(getRemainingPhotoCandidates(true), aboutFallback, path.join(imgDir, 'about.jpg'), { minBytes: 10000, minWidth: 300, minHeight: 200 });
        if (usedAbout && usedAbout !== aboutFallback) {
          consumedRealUrls.add(usedAbout);
          realPhotoCount++;
        }
      }

      // Gallery photos
      for (let gIdx = 0; gIdx < 3; gIdx++) {
        const destGalleryImg = path.join(imgDir, `gallery-${gIdx + 1}.jpg`);
        const gOverridePath = clientOverride?.galleryPaths?.[gIdx];
        if (gOverridePath && fs.existsSync(gOverridePath)) {
          fs.copyFileSync(gOverridePath, destGalleryImg);
          realPhotoCount++;
          continue;
        }
        const gSvc = servicesList[gIdx] || servicesList[0];
        const gFallback = resolveContextualPhoto(tradeKey, (gSvc?.name || '') + ' ' + (gSvc?.desc || ''), 'service', gIdx + 3);
        const usedG = await downloadValidatedPhoto(getRemainingPhotoCandidates(true), gFallback, destGalleryImg, { minBytes: 10000, minWidth: 240, minHeight: 200 });
        if (usedG && usedG !== gFallback) {
          consumedRealUrls.add(usedG);
          realPhotoCount++;
        }
      }
    };

    if (isCraftLayout) {
      await assignHero();
      await assignGalleryAndAbout();
    } else {
      // Reserve gallery-1 (unwashed on homepage) for top fleet/project photo, then about, then rest of gallery, then hero
      const destG1 = path.join(imgDir, 'gallery-1.jpg');
      let gallery1Set = false;
      if (clientOverride?.galleryPaths?.[0] && fs.existsSync(clientOverride.galleryPaths[0])) {
        fs.copyFileSync(clientOverride.galleryPaths[0], destG1);
        realPhotoCount++;
        gallery1Set = true;
      } else {
        const g1Svc = servicesList[0];
        const g1Fallback = resolveContextualPhoto(tradeKey, (g1Svc?.name || '') + ' ' + (g1Svc?.desc || ''), 'service', 3);
        const usedG1 = await downloadValidatedPhoto(getRemainingPhotoCandidates(true), g1Fallback, destG1, { minBytes: 10000, minWidth: 240, minHeight: 200 });
        if (usedG1 && usedG1 !== g1Fallback) {
          consumedRealUrls.add(usedG1);
          realPhotoCount++;
        }
        gallery1Set = true;
      }

      if (clientOverride?.aboutPath && fs.existsSync(clientOverride.aboutPath)) {
        fs.copyFileSync(clientOverride.aboutPath, path.join(imgDir, 'about.jpg'));
        realPhotoCount++;
      } else {
        const aboutFallback = resolveContextualPhoto(tradeKey, branding.ownerStory || '', 'about', seed);
        const aboutCandidates = getRemainingPhotoCandidates(true);
        const usedAbout = await downloadValidatedPhoto(aboutCandidates, aboutFallback, path.join(imgDir, 'about.jpg'), { minBytes: 10000, minWidth: 300, minHeight: 200 });
        if (usedAbout && usedAbout !== aboutFallback) {
          consumedRealUrls.add(usedAbout);
          realPhotoCount++;
        } else if (aboutCandidates.length === 0 && fs.existsSync(destG1) && !clientOverride?.aboutPath) {
          // If company only had 1 real photo (put in gallery-1), also feature it on About page instead of generic stock
          fs.copyFileSync(destG1, path.join(imgDir, 'about.jpg'));
        }
      }

      for (let gIdx = 1; gIdx < 3; gIdx++) {
        const destGalleryImg = path.join(imgDir, `gallery-${gIdx + 1}.jpg`);
        const gOverridePath = clientOverride?.galleryPaths?.[gIdx];
        if (gOverridePath && fs.existsSync(gOverridePath)) {
          fs.copyFileSync(gOverridePath, destGalleryImg);
          realPhotoCount++;
          continue;
        }
        const gSvc = servicesList[gIdx] || servicesList[0];
        const gFallback = resolveContextualPhoto(tradeKey, (gSvc?.name || '') + ' ' + (gSvc?.desc || ''), 'service', gIdx + 3);
        const usedG = await downloadValidatedPhoto(getRemainingPhotoCandidates(true), gFallback, destGalleryImg, { minBytes: 10000, minWidth: 240, minHeight: 200 });
        if (usedG && usedG !== gFallback) {
          consumedRealUrls.add(usedG);
          realPhotoCount++;
        }
      }

      await assignHero();
    }

    // Optimize non-logo photos to JPEG + WebP (flatten PNG alpha corners cleanly to white so rounded PNG photos never turn black-cornered)
    let heroWebpCreated = false;
    try {
      const sharp = (await import('sharp')).default;
      const files = fs.readdirSync(imgDir);
      for (const f of files) {
        if (f.startsWith('brand-logo.')) continue;
        if (!f.endsWith('.jpg') && !f.endsWith('.jpeg') && !f.endsWith('.png')) continue;
        const full = path.join(imgDir, f);
        const name = path.parse(f).name;
        const buf = fs.readFileSync(full);

        await sharp(buf)
          .resize({ width: 1200, withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .jpeg({ quality: 82, mozjpeg: true })
          .toFile(full + '.tmp');
        fs.renameSync(full + '.tmp', full);

        const webpPath = path.join(imgDir, `${name}.webp`);
        await sharp(buf)
          .resize({ width: 1200, withoutEnlargement: true })
          .flatten({ background: '#ffffff' })
          .webp({ quality: 82 })
          .toFile(webpPath);
        if (name === 'hero') heroWebpCreated = true;
      }
    } catch (e) {
      logWarn(`Image optimization notice: ${e.message}`);
    }

    const serviceUrls = servicesList.map((_, idx) => {
      const n = idx + 1;
      return fs.existsSync(path.join(imgDir, `service-${n}.webp`)) ? `assets/images/service-${n}.webp` : `assets/images/service-${n}.jpg`;
    });

    return {
      hasRealLogo,
      logoIsDark,
      logoUrl: hasRealLogo ? (fs.existsSync(path.join(imgDir, 'brand-logo.webp')) ? 'assets/images/brand-logo.webp' : 'assets/images/brand-logo.jpg') : null,
      heroUrl: heroWebpCreated ? 'assets/images/hero.webp' : (fs.existsSync(path.join(imgDir, 'hero.jpg')) ? 'assets/images/hero.jpg' : 'assets/images/service-1.jpg'),
      heroWebpUrl: heroWebpCreated ? 'assets/images/hero.webp' : (fs.existsSync(path.join(imgDir, 'hero.jpg')) ? 'assets/images/hero.jpg' : 'assets/images/service-1.jpg'),
      service1Url: serviceUrls[0],
      service2Url: serviceUrls[1],
      service3Url: serviceUrls[2],
      serviceUrls,
      aboutUrl: fs.existsSync(path.join(imgDir, 'about.webp')) ? 'assets/images/about.webp' : 'assets/images/about.jpg',
      gallery: [
        fs.existsSync(path.join(imgDir, 'gallery-1.webp')) ? 'assets/images/gallery-1.webp' : 'assets/images/gallery-1.jpg',
        fs.existsSync(path.join(imgDir, 'gallery-2.webp')) ? 'assets/images/gallery-2.webp' : 'assets/images/gallery-2.jpg',
        fs.existsSync(path.join(imgDir, 'gallery-3.webp')) ? 'assets/images/gallery-3.webp' : 'assets/images/gallery-3.jpg'
      ],
      realImageCount: realPhotoCount
    };
  }

  function loadClientOverride(slug) {
    if (!clientOverridesDir) return null;
    try {
      const baseDir = path.join(clientOverridesDir, slug);
      const jsonPath = path.join(baseDir, 'override.json');
      if (!fs.existsSync(jsonPath)) return null;
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const resolveAsset = (rel) => {
        if (!rel) return null;
        const resolved = path.resolve(baseDir, rel);
        if (fs.existsSync(resolved)) return resolved;
        if (rel.includes('stock/') && stockRootDir) {
          const idx = rel.indexOf('stock/');
          const fromStock = path.join(stockRootDir, rel.slice(idx + 'stock/'.length));
          if (fs.existsSync(fromStock)) return fromStock;
        }
        return resolved;
      };
      return {
        ...raw,
        logoPath: resolveAsset(raw.logoFile),
        heroPath: resolveAsset(raw.heroFile),
        aboutPath: resolveAsset(raw.aboutFile),
        galleryPaths: Array.isArray(raw.galleryFiles) ? raw.galleryFiles.map(resolveAsset) : null,
        services: Array.isArray(raw.services)
          ? raw.services.map(s => ({ ...s, resolvedImagePath: resolveAsset(s.imageFile) }))
          : null,
        servicePaths: Array.isArray(raw.services)
          ? raw.services.map(s => resolveAsset(s.imageFile))
          : null
      };
    } catch (e) {
      logWarn(`Client override load notice for ${slug}: ${e.message}`);
      return null;
    }
  }

  function generateBespokeSiteMarkup(lead, tradeInfo, branding, researchData, assetPaths, deployedSlug = null) {
    const rawBizName = branding.displayBrandName || lead.businessName;
    const cleanDisplayBizName = rawBizName
      .split(/\s+[-–—|]\s+(?:heating|cooling|hvac|fence|fencing|roofing|concrete|tree|plumbing|electric|specialists|services|contractor|paving|foundation|blower door)/i)[0]
      .trim() || rawBizName;
    const bizName = cleanDisplayBizName;
    const slug = deployedSlug || sanitizeSlug(bizName);
    const phone = lead.phone || agencyPhone;
    const cleanPhone = phone.replace(/[^\d+]/g, '');
    const email = (lead.email && lead.email !== 'No email found') ? lead.email : '';
    const cityInfo = formatCityState(tradeInfo.city);
    const city = cityInfo.cityState;
    const trade = tradeInfo.trade;
    const tradeKey = getTradeKey(trade);
    const rawServiceArea = lead.serviceArea || '';
    const serviceArea = (!rawServiceArea || (!cityInfo.isFoxValley && /^fox valley & northeast wisconsin \(appleton/i.test(rawServiceArea)))
      ? `${cityInfo.regionShort} (${cityInfo.schemaCities.join(', ')})`
      : rawServiceArea;
    const cp = getTradeCopyProfile(trade, bizName, city, serviceArea);
    const normalizeCopyRegion = (txt) => {
      if (!txt || typeof txt !== 'string') return txt;
      const capitalized = txt.replace(/\bfox\s+valley\b/gi, 'Fox Valley');
      if (cityInfo.isFoxValley || /fox valley/i.test(bizName)) return capitalized;
      return capitalized.replace(/(?:the\s+)?fox valley(?:\s+area)?/gi, cityInfo.regionLabel);
    };
    const rawServices = hasRealCustomServices(branding.services) ? branding.services : cp.fallbackServices;
    const activeServices = rawServices.map(s => ({
      ...s,
      name: normalizeCopyRegion(s.name),
      desc: normalizeCopyRegion(s.desc)
    }));
    const activeOwnerStory = normalizeCopyRegion((!branding.ownerStory || hasGenericPlaceholderVibe(branding.ownerStory)) ? cp.fallbackOwnerStory : branding.ownerStory);
    const activeTagline = normalizeCopyRegion(branding.tagline || cp.fallbackTagline);
    const activeCalcOptions = (Array.isArray(branding.calculatorOptions) && branding.calculatorOptions.length > 0)
      ? branding.calculatorOptions
      : cp.estimatorDefaultTypes;
    const p = normalizePalette(branding.palette, tradeKey, researchData);
    const isSecondaryDark = getHexYiq(p.secondary) < 150;
    const chromeBg = p.secondary;
    const chromeBorder = isSecondaryDark ? 'rgba(255, 255, 255, 0.14)' : p.border;
    const chromeTextPrimary = isSecondaryDark ? '#FFFFFF' : '#0F172A';
    const chromeTextSecondary = isSecondaryDark ? '#E2E8F0' : '#475569';
    const chromeTextMuted = isSecondaryDark ? '#CBD5E1' : '#64748B';
    const accentYiq = getHexYiq(p.accent);
    const primaryYiq = getHexYiq(p.primary);
    const darkSurfaceAccent = accentYiq >= 135 ? p.accent : '#FBBF24';
    const lightSurfaceAccent = accentYiq <= 140 ? p.accent : (primaryYiq <= 145 ? p.primary : '#B45309');
    const chromeAccent = isSecondaryDark ? darkSurfaceAccent : lightSurfaceAccent;

    const socials = researchData.socials || {};
    function buildSocialIcons(onDarkSurface) {
      const items = [];
      const fbClass = onDarkSurface ? 'hover:opacity-90 transition-opacity p-2 rounded-lg bg-white/10 text-white border border-white/15' : 'hover:opacity-80 transition-opacity p-2 rounded-lg bg-blue-600/10 text-blue-600';
      const igClass = onDarkSurface ? 'hover:opacity-90 transition-opacity p-2 rounded-lg bg-white/10 text-white border border-white/15' : 'hover:opacity-80 transition-opacity p-2 rounded-lg bg-pink-600/10 text-pink-600';
      const liClass = onDarkSurface ? 'hover:opacity-90 transition-opacity p-2 rounded-lg bg-white/10 text-white border border-white/15' : 'hover:opacity-80 transition-opacity p-2 rounded-lg bg-blue-700/10 text-blue-700';

      if (socials.facebook) {
        items.push(`
          <a href="${escapeHtml(socials.facebook)}" target="_blank" rel="noopener noreferrer" class="${fbClass}" title="Visit us on Facebook" aria-label="Facebook">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
          </a>
        `);
      }
      if (socials.instagram) {
        items.push(`
          <a href="${escapeHtml(socials.instagram)}" target="_blank" rel="noopener noreferrer" class="${igClass}" title="Follow us on Instagram" aria-label="Instagram">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
          </a>
        `);
      }
      if (socials.linkedin) {
        items.push(`
          <a href="${escapeHtml(socials.linkedin)}" target="_blank" rel="noopener noreferrer" class="${liClass}" title="Connect on LinkedIn" aria-label="LinkedIn">
            <svg class="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          </a>
        `);
      }
      return items;
    }

    const socialIconsHtml = buildSocialIcons(false);
    const chromeSocialIconsHtml = buildSocialIcons(isSecondaryDark);

    const socialRowHtml = socialIconsHtml.length > 0
      ? `<div class="flex items-center gap-2">${socialIconsHtml.join('')}</div>`
      : '';
    const chromeSocialRowHtml = chromeSocialIconsHtml.length > 0
      ? `<div class="flex items-center gap-2">${chromeSocialIconsHtml.join('')}</div>`
      : '';

    const logoFrameClass = assetPaths.logoIsDark
      ? 'brand-logo-img rounded-xl object-contain bg-black p-1.5 sm:p-2 border border-white/15 shadow-md shrink-0'
      : 'brand-logo-img rounded-xl object-contain bg-white p-1.5 sm:p-2 shadow-sm shrink-0';
    const logoMarkup = assetPaths.hasRealLogo
      ? `<img src="${assetPaths.logoUrl}" alt="${escapeHtml(bizName)} Logo" width="160" height="60" class="${logoFrameClass}">`
      : `<div class="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center font-extrabold text-lg sm:text-xl shadow-md shrink-0 bg-white" style="color: ${p.primary}; border: 2px solid ${p.primary};">${bizName.charAt(0)}</div>`;

    const designProfile = resolveDesignProfile(branding.layoutStyle, bizName, tradeKey, getSlugSeed(bizName));
    const layoutMode = designProfile.layoutStyle;
    const isCraft = layoutMode === 'split-hero-timber';
    const fontUrl = designProfile.fontUrl;
    const fontLink = `
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link rel="preload" as="style" href="${fontUrl}">
      <link rel="stylesheet" href="${fontUrl}" media="print" onload="this.media='all'">
      <noscript><link rel="stylesheet" href="${fontUrl}"></noscript>
    `;
    const fontCss = `body { font-family: ${designProfile.bodyFont}; } h1, h2, h3, h4, h5, h6, .brand-heading { font-family: ${designProfile.headingFont}; letter-spacing: ${designProfile.headingTrack}; }`;
    const tailwindInlineCss = (styleCssPath && fs.existsSync(styleCssPath)) ? fs.readFileSync(styleCssPath, 'utf8') : '';

    const customCss = `
      ${fontLink}
      ${tailwindInlineCss ? `<style id="tailwind-styles">${tailwindInlineCss}</style>` : '<link rel="stylesheet" href="assets/style.min.css">'}
      <style>
        :root {
          --c-primary: ${p.primary};
          --c-primary-hover: ${p.primaryHover};
          --c-secondary: ${chromeBg};
          --c-accent: ${lightSurfaceAccent};
          --c-bg: #ffffff;
          --c-bg-tint: #f8fafc;
          --c-surface: #ffffff;
          --c-border: #e2e8f0;
          --c-dark-section: #0f172a;
          --c-text-main: #111827;
          --c-text-muted: #475569;
          --r-card: ${designProfile.cardRadius};
          --r-btn: ${designProfile.btnRadius};
        }
        ${fontCss}
        body {
          background-color: #ffffff;
          color: #111827;
        }
        h1, h2, h3, h4, .brand-heading {
          color: #111827;
        }
        .brand-btn-primary {
          background-color: var(--c-primary);
          color: ${getContrastColor(p.primary)};
          border-radius: var(--r-btn);
        }
        .brand-btn-primary:hover {
          background-color: var(--c-primary-hover);
        }
        .brand-btn-accent {
          background-color: ${p.accent};
          color: ${getContrastColor(p.accent)};
          font-weight: 700;
          border-radius: var(--r-btn);
        }
        .brand-surface-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: var(--r-card);
        }
        .sw-card {
          background-color: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: var(--r-card);
          overflow: hidden;
        }
        .sw-btn-radius { border-radius: var(--r-btn); }
        .sw-grid-2 { display: grid; grid-template-columns: 1fr; gap: 2rem; }
        .sw-grid-3 { display: grid; grid-template-columns: 1fr; gap: 1.75rem; }
        .sw-grid-split, .sw-grid-split-rev { display: grid; grid-template-columns: 1fr; gap: 2.5rem; align-items: center; }
        .sw-service-row { display: flex; flex-direction: column; gap: 2rem; align-items: center; }
        .sw-service-media { width: 100%; height: 16rem; flex-shrink: 0; }
        .sw-estimator-bar { display: grid; grid-template-columns: 1fr; gap: 1rem; align-items: end; }
        @media (min-width: 640px) {
          .sw-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .sw-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .sw-estimator-bar { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (min-width: 768px) {
          .sw-service-row { flex-direction: row; gap: 2.5rem; }
          .sw-service-media { width: 42%; }
        }
        @media (min-width: 1024px) {
          .sw-grid-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .sw-grid-split { grid-template-columns: 1.15fr 0.85fr; gap: 3rem; }
          .sw-grid-split-rev { grid-template-columns: 0.9fr 1.1fr; gap: 3rem; }
          .sw-estimator-bar { grid-template-columns: 1.2fr 1.1fr 1fr 1fr 0.9fr; }
        }
        .site-header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.75rem;
          min-height: 4.75rem;
        }
        @media (min-width: 640px) {
          .site-header-inner {
            min-height: 5.5rem;
            gap: 1.25rem;
          }
        }
        .brand-logo-img {
          height: 3rem;
          max-height: 3.25rem;
          max-width: 140px;
          width: auto;
          object-fit: contain;
          flex-shrink: 0;
        }
        @media (min-width: 640px) {
          .brand-logo-img {
            height: 3.75rem;
            max-height: 4.25rem;
            max-width: 220px;
          }
        }
        .brand-title-main {
          display: block;
          font-weight: 800;
          font-size: 0.875rem;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          color: ${chromeTextPrimary} !important;
        }
        .brand-title-sub {
          display: block;
          font-size: 0.625rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          margin-top: 0.125rem;
        }
        @media (min-width: 640px) {
          .brand-title-main {
            font-size: 1.15rem;
          }
          .brand-title-sub {
            font-size: 0.725rem;
          }
        }
        @media (min-width: 1024px) {
          .brand-title-main {
            font-size: 1.25rem;
          }
        }
        #mobileNavDrawer.hidden {
          display: none !important;
        }
        #mobileNavDrawer:not(.hidden) {
          display: block !important;
        }
      </style>
    `;

    const industrialUtilityBar = layoutMode === 'industrial-contractor' ? `
      <div class="text-xs font-semibold py-1.5 px-3 sm:px-6 border-b" style="background-color: #090d16; border-color: rgba(255,255,255,0.08); color: #cbd5e1;">
        <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Serving ${escapeHtml(city)} &amp; ${escapeHtml(cityInfo.regionShort)}</span>
          <span class="hidden sm:inline">${escapeHtml(cp.heroTrustBadge)} • Direct Estimates: <strong style="color: #ffffff;">${escapeHtml(phone)}</strong></span>
        </div>
      </div>` : '';

    const architecturalHeaderAccent = layoutMode === 'modern-architectural'
      ? `border-top: 3px solid var(--c-primary);`
      : '';

    const headerHtml = `
      <header class="sticky top-0 z-50 backdrop-blur-md border-b" style="${architecturalHeaderAccent} background-color: ${chromeBg}f0; border-color: ${chromeBorder}; color: ${chromeTextSecondary};">
        ${industrialUtilityBar}
        <div class="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 site-header-inner">
          <a href="index.html" class="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1 mr-1 sm:mr-4">
            ${logoMarkup}
            <div class="min-w-0 flex-1 overflow-hidden">
              <span class="brand-title-main" style="color: ${chromeTextPrimary} !important;">${escapeHtml(cleanDisplayBizName)}</span>
              <span class="brand-title-sub" style="color: ${chromeAccent};">${escapeHtml(cp.headerSub)}</span>
            </div>
          </a>
          <nav class="hidden md:flex items-center gap-6 lg:gap-8 font-bold text-sm" style="color: ${chromeTextSecondary};">
            <a href="index.html" class="hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Home</a>
            <a href="services.html" class="hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Services</a>
            <a href="about.html" class="hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">About Us</a>
            <a href="contact.html" class="hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Free Estimate</a>
          </nav>
          <div class="flex items-center gap-2 sm:gap-3 shrink-0">
            ${chromeSocialIconsHtml.length > 0 ? `
              <div class="hidden lg:flex items-center gap-1.5">
                ${chromeSocialIconsHtml.join('')}
              </div>
            ` : ''}
            <a href="tel:${cleanPhone}" class="inline-flex items-center gap-1.5 brand-btn-primary px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all whitespace-nowrap shrink-0">
              <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span class="hidden sm:inline">${escapeHtml(phone)}</span>
              <span class="sm:hidden font-extrabold">Call</span>
            </a>
            <button type="button" onclick="toggleMobileNav()" aria-label="Toggle Navigation" class="md:hidden inline-flex items-center justify-center p-2.5 rounded-xl border transition-all shrink-0" style="border-color: ${chromeBorder}; color: ${chromeTextPrimary}; background-color: ${isSecondaryDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.06)'};">
              <svg id="mobileMenuOpenIcon" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
              <svg id="mobileMenuCloseIcon" class="w-5 h-5 hidden" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        <div id="mobileNavDrawer" class="hidden md:hidden border-t px-4 py-4 space-y-3 shadow-2xl backdrop-blur-md" style="background-color: ${chromeBg}; border-color: ${chromeBorder};">
          <div class="space-y-1">
            <a href="index.html" class="block px-3 py-2.5 rounded-lg font-bold text-sm hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Home</a>
            <a href="services.html" class="block px-3 py-2.5 rounded-lg font-bold text-sm hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Services</a>
            <a href="about.html" class="block px-3 py-2.5 rounded-lg font-bold text-sm hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">About Us</a>
            <a href="contact.html" class="block px-3 py-2.5 rounded-lg font-bold text-sm hover:opacity-80 transition-opacity" style="color: ${chromeTextPrimary};">Free Estimate</a>
          </div>
          <div class="pt-3 border-t flex items-center justify-between" style="border-color: ${chromeBorder};">
            <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 brand-btn-primary px-4 py-2 rounded-lg font-bold text-xs shadow-md">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
              <span>${escapeHtml(phone)}</span>
            </a>
            ${chromeSocialIconsHtml.length > 0 ? chromeSocialRowHtml : ''}
          </div>
        </div>
        <script>
          function toggleMobileNav() {
            var d = document.getElementById('mobileNavDrawer');
            var o = document.getElementById('mobileMenuOpenIcon');
            var c = document.getElementById('mobileMenuCloseIcon');
            if (d) {
              var isHidden = d.classList.toggle('hidden');
              if (o && c) {
                if (isHidden) {
                  o.classList.remove('hidden');
                  c.classList.add('hidden');
                } else {
                  o.classList.add('hidden');
                  c.classList.remove('hidden');
                }
              }
            }
          }
        </script>
      </header>
    `;

    const footerHtml = `
      <footer class="border-t py-14" style="background-color: ${chromeBg}; border-color: ${chromeBorder}; color: ${chromeTextSecondary};">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div class="md:col-span-2 space-y-4">
            <div class="flex items-center gap-3">
              ${logoMarkup}
              <span class="font-extrabold text-xl" style="color: ${chromeTextPrimary};">${escapeHtml(bizName)}</span>
            </div>
            <p class="text-sm leading-relaxed max-w-md" style="color: ${chromeTextSecondary};">
              ${escapeHtml(activeOwnerStory)}
            </p>
            ${chromeSocialIconsHtml.length > 0 ? `
              <div class="pt-2">
                <span class="text-xs uppercase tracking-wider font-semibold block mb-2" style="color: ${chromeAccent};">Connect on Social Media</span>
                ${chromeSocialRowHtml}
              </div>
            ` : ''}
            <p class="text-xs pt-4" style="color: ${chromeTextMuted};">
              &copy; ${new Date().getFullYear()} ${escapeHtml(bizName)}. Proudly serving ${escapeHtml(cityInfo.cityOnly)} and Northeast Wisconsin.
            </p>
          </div>
          <div>
            <h3 class="font-bold text-sm mb-4 uppercase tracking-wider" style="color: ${chromeTextPrimary};">Navigation</h3>
            <ul class="space-y-2 text-sm">
              <li><a href="index.html" class="hover:underline" style="color: ${chromeTextSecondary};">Home</a></li>
              <li><a href="services.html" class="hover:underline" style="color: ${chromeTextSecondary};">Services</a></li>
              <li><a href="about.html" class="hover:underline" style="color: ${chromeTextSecondary};">About Our Company</a></li>
              <li><a href="contact.html" class="hover:underline" style="color: ${chromeTextSecondary};">Schedule Free Estimate</a></li>
            </ul>
          </div>
          <div>
            <h3 class="font-bold text-sm mb-4 uppercase tracking-wider" style="color: ${chromeTextPrimary};">Hours &amp; Location</h3>
            <p class="text-base font-bold mb-1" style="color: ${chromeTextPrimary};">${escapeHtml(phone)}</p>
            <p class="text-sm font-medium mb-3" style="color: ${chromeAccent};">${escapeHtml(email)}</p>
            <p class="text-xs leading-relaxed" style="color: ${chromeTextSecondary};">${escapeHtml(lead.hours || 'Monday – Friday: 7:00 AM – 5:00 PM | Weekend: By Appointment')}</p>
          </div>
        </div>
      </footer>
      <script src="assets/preview-banner.js" data-business="${escapeHtml(bizName)}" data-slug="${escapeHtml(slug)}" data-ga-id="${escapeHtml(gaMeasurementId)}" defer></script>
    `;

    const headAnalyticsTagHtml = gaMeasurementId ? `
  <!-- Google tag (gtag.js) -->
  <script>
    (function () {
      var q = window.location.search || '';
      var isBot = navigator.webdriver || /lighthouse|pagespeed|headless|puppeteer|playwright|thum\.io|bot|crawl|spider/i.test(navigator.userAgent || '');
      if (/[?&](?:admin_preview|nolog)=1/i.test(q)) { try { sessionStorage.setItem('sw624_admin_preview', '1'); } catch (e) {} }
      var isAdmin = /[?&](?:admin_preview|nolog)=1/i.test(q) || (function () { try { return sessionStorage.getItem('sw624_admin_preview') === '1'; } catch (e) { return false; } })();
      if (isBot || isAdmin) { window['ga-disable-${escapeHtml(gaMeasurementId)}'] = true; window.__sw624SkipTracking = true; return; }
      window.__sw624GaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', '${escapeHtml(gaMeasurementId)}', {
        demo_slug: '${escapeHtml(slug)}',
        business_name: '${escapeHtml(bizName).replace(/'/g, "\\'")}',
        site_type: 'demo_preview'
      });
      var s = document.createElement('script');
      s.async = true;
      s.src = 'https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(gaMeasurementId)}';
      document.head.appendChild(s);
    })();
  </script>` : '';

    const schemaJson = JSON.stringify({
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": ["HomeAndConstructionBusiness", "LocalBusiness"],
          "@id": `https://${slug}.pages.dev/#business`,
          "name": bizName,
          "telephone": phone,
          "email": email,
          "url": `https://${slug}.pages.dev/`,
          "areaServed": cityInfo.schemaCities.map(c => ({ "@type": "City", "name": c })),
          "sameAs": Object.values(socials).filter(Boolean)
        }
      ]
    });

    const ratingMatch = String(lead.ratingReviews || '').match(/(\d+(?:\.\d+)?)\s*(?:★|stars?)/i);
    const parsedRating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
    const ratingChipLeft = parsedRating >= 4.0 ? `★ ${parsedRating.toFixed(1)}` : '★ Local';
    const ratingChipRight = parsedRating >= 4.0 ? 'Google Verified Reviews' : 'Trusted Local Service';

    const buildEstimateFormHtml = (variant = 'bar') => {
      const scopeOptionsHtml = cp.estimatorScopeOptions.map((opt, idx) => `<option value="${escapeHtml(opt.value)}"${idx === 1 ? ' selected' : ''}>${escapeHtml(opt.label)}</option>`).join('');
      const typeOptionsHtml = activeCalcOptions.map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('');
      const inputStyle = `background-color: #ffffff; color: #111827; border: 1px solid #cbd5e1;`;
      if (variant === 'card') {
        return `
          <form id="heroEstimateForm" class="p-6 sm:p-8 brand-surface-card shadow-2xl space-y-4 text-left">
            <div class="pb-3 border-b" style="border-color: #e2e8f0;">
              <span class="text-xs font-extrabold uppercase tracking-widest block" style="color: ${lightSurfaceAccent};">Fast Written Quote</span>
              <h2 class="text-xl sm:text-2xl font-bold mt-1 brand-heading" style="color: #111827;">${escapeHtml(cp.estimatorHeading)}</h2>
            </div>
            <div>
              <label for="custType" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">1. Service Type</label>
              <select id="custType" class="w-full px-3.5 py-2.5 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
                ${typeOptionsHtml}
              </select>
            </div>
            <div>
              <label for="custFootage" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">2. ${escapeHtml(cp.estimatorScopeLabel)}</label>
              <select id="custFootage" class="w-full px-3.5 py-2.5 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
                ${scopeOptionsHtml}
              </select>
            </div>
            <div class="sw-grid-2" style="gap: 0.75rem;">
              <div>
                <label for="custPhone" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">3. Your Phone</label>
                <input type="tel" id="custPhone" required placeholder="(920) 000-0000" class="w-full px-3.5 py-2.5 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
                <input type="hidden" id="custName" value="Prospective Client">
                <input type="hidden" id="custCity" value="${escapeHtml(city)}">
              </div>
              <div>
                <label for="custEmail" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">4. Email (Optional)</label>
                <input type="email" id="custEmail" placeholder="you@email.com" class="w-full px-3.5 py-2.5 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
              </div>
            </div>
            <button type="submit" id="heroSubmitBtn" class="w-full brand-btn-primary font-bold py-3.5 shadow-lg transition-transform hover:-translate-y-0.5 text-sm uppercase tracking-wider">
              Request Free Written Quote &rarr;
            </button>
            <div id="heroFormMsg" class="hidden text-center text-xs font-semibold py-1"></div>
          </form>
        `;
      }
      return `
        <form id="heroEstimateForm" class="p-6 sm:p-7 brand-surface-card shadow-xl sw-estimator-bar text-left">
          <div>
            <label for="custType" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">1. Service Type</label>
            <select id="custType" class="w-full px-3.5 py-3 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
              ${typeOptionsHtml}
            </select>
          </div>
          <div>
            <label for="custFootage" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">2. ${escapeHtml(cp.estimatorScopeLabel)}</label>
            <select id="custFootage" class="w-full px-3.5 py-3 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
              ${scopeOptionsHtml}
            </select>
          </div>
          <div>
            <label for="custPhone" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">3. Your Phone</label>
            <input type="tel" id="custPhone" required placeholder="(920) 000-0000" class="w-full px-3.5 py-3 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
            <input type="hidden" id="custName" value="Prospective Client">
            <input type="hidden" id="custCity" value="${escapeHtml(city)}">
          </div>
          <div>
            <label for="custEmail" class="block text-xs font-bold uppercase mb-1.5" style="color: #334155;">4. Email (Opt.)</label>
            <input type="email" id="custEmail" placeholder="you@email.com" class="w-full px-3.5 py-3 text-sm sw-btn-radius focus:outline-none" style="${inputStyle}">
          </div>
          <div>
            <button type="submit" id="heroSubmitBtn" class="w-full brand-btn-primary font-bold py-3.5 shadow-lg transition-transform hover:-translate-y-0.5 text-sm uppercase tracking-wider">
              Get My Quote &rarr;
            </button>
          </div>
          <div id="heroFormMsg" class="hidden text-center text-xs font-semibold py-1" style="grid-column: 1 / -1;"></div>
        </form>
      `;
    };

    const extraServicesHtml = activeServices.length > 3 ? `
      <div class="sw-grid-2 mt-8">
        ${activeServices.slice(3).map((extraSvc, extraIdx) => {
          const svcNum = extraIdx + 4;
          const imgUrl = assetPaths.serviceUrls?.[extraIdx + 3] || assetPaths.service3Url;
          return `
            <div class="sw-card shadow-md flex flex-col sm:flex-row items-stretch">
              <div class="w-full sm:w-44 h-44 sm:h-auto overflow-hidden flex-shrink-0">
                <img src="${imgUrl}" alt="${escapeHtml(extraSvc.name)}" class="w-full h-full object-cover">
              </div>
              <div class="p-6 flex flex-col justify-center">
                <span class="text-xs font-extrabold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">0${svcNum} • ${escapeHtml(extraSvc.badge || cp.defaultBadge)}</span>
                <h4 class="text-lg font-bold brand-heading mb-1.5" style="color: #111827;">${escapeHtml(extraSvc.name)}</h4>
                <p class="text-xs leading-relaxed" style="color: #475569;">${escapeHtml(extraSvc.desc)}</p>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    const comparisonSectionHtml = `
      <section class="py-16 lg:py-20 border-t" style="background-color: #F8FAFC; border-color: #E2E8F0;">
        <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="text-center mb-10">
            <span class="text-xs font-bold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.comparisonEyebrow)}</span>
            <h2 class="text-3xl font-extrabold mt-1 brand-heading" style="color: #111827;">${escapeHtml(cp.comparisonHeading)}</h2>
          </div>
          <div class="overflow-x-auto sw-card shadow-lg">
            <table class="w-full text-left text-sm">
              <thead>
                <tr class="border-b" style="border-color: #E2E8F0; background-color: #0F172A;">
                  <th class="p-4 font-bold text-white">${escapeHtml(cp.comparisonFactorCol)}</th>
                  <th class="p-4 font-extrabold" style="color: ${darkSurfaceAccent};">${escapeHtml(bizName)}</th>
                  <th class="p-4 font-normal text-slate-300">${escapeHtml(cp.comparisonThemCol)}</th>
                </tr>
              </thead>
              <tbody class="divide-y" style="border-color: #E2E8F0;">
                ${getComparisonFactors(trade).map(row => `
                  <tr>
                    <td class="p-4 font-semibold" style="color: #111827;">${escapeHtml(row.factor)}</td>
                    <td class="p-4 font-bold text-emerald-700">&#10004; ${escapeHtml(row.us)}</td>
                    <td class="p-4 text-slate-600">${escapeHtml(row.them)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    `;

    const ctaBannerHtml = `
      <section class="py-16 lg:py-20 text-white relative overflow-hidden" style="background-color: #0F172A;">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest mb-5" style="background-color: rgba(255, 255, 255, 0.1); color: ${darkSurfaceAccent};">
            <span>${escapeHtml(cp.ctaBadge)}</span>
          </div>
          <h2 class="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl mx-auto text-white leading-tight brand-heading">
            ${escapeHtml(cp.ctaHeadline)}
          </h2>
          <p class="mt-4 text-base sm:text-lg max-w-2xl mx-auto text-slate-300 leading-relaxed">
            Speak directly with ${escapeHtml(bizName)} for rapid scheduling, transparent written estimates, and reliable service across ${escapeHtml(cityInfo.regionLabel)}.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-4 pt-8">
            <a href="contact.html" class="brand-btn-primary px-8 py-4 font-extrabold text-sm sm:text-base shadow-xl transition-all hover:scale-105">
              Request Free Written Estimate &rarr;
            </a>
            <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 px-8 py-4 sw-btn-radius font-bold text-sm sm:text-base border border-slate-700 bg-slate-800 hover:bg-slate-700 text-white transition-all">
              <span>Call ${escapeHtml(phone)}</span>
            </a>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-8 pt-8 text-xs font-semibold text-slate-300">
            <span class="flex items-center gap-2"><span class="text-emerald-400 font-bold">&#10004;</span> ${escapeHtml(cp.ctaBullet1)}</span>
            <span class="flex items-center gap-2"><span class="text-emerald-400 font-bold">&#10004;</span> Fully Licensed &amp; Insured</span>
            <span class="flex items-center gap-2"><span class="text-emerald-400 font-bold">&#10004;</span> Rapid Quote Turnaround</span>
          </div>
        </div>
      </section>
    `;

    const buildGallerySectionHtml = (bgHex = '#FFFFFF', headingLeft = false) => `
      <section class="py-16 lg:py-20" style="background-color: ${bgHex};">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="${headingLeft ? 'flex flex-col sm:flex-row sm:items-end justify-between mb-10' : 'text-center mb-12'}">
            <div>
              <span class="text-xs font-extrabold tracking-widest uppercase block mb-1" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.galleryEyebrow)}</span>
              <h2 class="text-3xl font-extrabold brand-heading" style="color: #111827;">${escapeHtml(cp.galleryHeading)}</h2>
            </div>
            <p class="text-sm mt-2" style="color: #475569;">${escapeHtml(cp.gallerySubtitle)}</p>
          </div>
          <div class="sw-grid-3">
            ${assetPaths.gallery.map((gUrl, idx) => `
              <div class="sw-card shadow-lg group">
                <div class="h-64 overflow-hidden">
                  <img src="${gUrl}" alt="${escapeHtml(cp.galleryAltPrefix)} ${idx + 1}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                </div>
                <div class="p-4 flex items-center justify-between text-xs font-semibold" style="border-top: 1px solid #F1F5F9;">
                  <span style="color: #111827;">${escapeHtml(cp.galleryCardPrefix)}${idx + 1}</span>
                  <span style="color: ${lightSurfaceAccent};">${escapeHtml(city)}</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;

    let mainBodyLayoutHtml = '';
    if (layoutMode === 'industrial-contractor') {
      mainBodyLayoutHtml = `
        <section class="relative py-20 lg:py-28 overflow-hidden text-white" style="background-image: linear-gradient(95deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.84) 55%, rgba(15,23,42,0.52) 100%), url('${assetPaths.heroUrl}'); background-size: cover; background-position: center;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div class="max-w-3xl pl-5 sm:pl-7 border-l-4 space-y-6" style="border-color: ${darkSurfaceAccent};">
              <div class="inline-block text-xs font-extrabold uppercase tracking-widest px-3 py-1 sw-btn-radius" style="background-color: rgba(255,255,255,0.12); color: ${darkSurfaceAccent};">
                ${escapeHtml(city)} &bull; ${escapeHtml(cp.heroEyebrow)}
              </div>
              <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight leading-none text-white brand-heading">
                ${escapeHtml(activeTagline)}
              </h1>
              <p class="text-base sm:text-lg leading-relaxed text-slate-200 max-w-2xl">
                ${escapeHtml(activeOwnerStory)}
              </p>
              <div class="flex flex-wrap items-center gap-4 pt-2">
                <a href="#estimator" class="brand-btn-primary px-7 py-3.5 font-extrabold text-sm uppercase tracking-wider shadow-xl">
                  Request Free Written Quote &rarr;
                </a>
                <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 px-6 py-3.5 sw-btn-radius font-bold text-sm border border-white/25 bg-slate-900/70 hover:bg-slate-900 text-white">
                  Call ${escapeHtml(phone)}
                </a>
              </div>
            </div>
            <div class="sw-grid-3 mt-12 pt-8 border-t border-white/15">
              <div class="p-4 sw-btn-radius" style="background-color: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.14);">
                <div class="text-sm font-extrabold" style="color: ${darkSurfaceAccent};">${ratingChipLeft}</div>
                <div class="text-xs text-slate-200 mt-0.5">${ratingChipRight}</div>
              </div>
              <div class="p-4 sw-btn-radius" style="background-color: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.14);">
                <div class="text-sm font-extrabold text-white">${escapeHtml(cp.heroRootChip)}</div>
                <div class="text-xs text-slate-200 mt-0.5">${escapeHtml(cityInfo.regionLabel)}</div>
              </div>
              <div class="p-4 sw-btn-radius" style="background-color: rgba(15,23,42,0.72); border: 1px solid rgba(255,255,255,0.14);">
                <div class="text-sm font-extrabold text-white">${escapeHtml(cp.heroTrustBadge)}</div>
                <div class="text-xs text-slate-200 mt-0.5">Clear Written Scope &amp; Timeline</div>
              </div>
            </div>
          </div>
        </section>

        <section class="py-20" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-12 pb-6 border-b" style="border-color: #E2E8F0;">
              <div>
                <span class="text-xs font-extrabold uppercase tracking-widest block mb-1" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.servicesEyebrow)}</span>
                <h2 class="text-3xl sm:text-4xl font-extrabold brand-heading uppercase" style="color: #111827;">${escapeHtml(cp.servicesHeading)}</h2>
              </div>
              <p class="text-sm max-w-md" style="color: #475569;">${escapeHtml(cp.servicesSubtitle)}</p>
            </div>
            <div class="sw-grid-3">
              ${activeServices.slice(0, 3).map((s, idx) => {
                const imgUrl = assetPaths.serviceUrls?.[idx] || (idx === 0 ? assetPaths.service1Url : idx === 1 ? assetPaths.service2Url : assetPaths.service3Url);
                return `
                  <article class="sw-card shadow-md flex flex-col justify-between" style="border-top: 4px solid var(--c-primary);">
                    <div>
                      <div class="h-52 overflow-hidden relative">
                        <img src="${imgUrl}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover">
                        <span class="absolute bottom-3 left-3 text-xs font-extrabold px-2.5 py-1 bg-slate-900 text-white sw-btn-radius">0${idx + 1}</span>
                      </div>
                      <div class="p-6">
                        <span class="text-xs font-bold uppercase tracking-wider block mb-1.5" style="color: ${lightSurfaceAccent};">${escapeHtml(s.badge || cp.defaultBadge)}</span>
                        <h3 class="text-xl font-bold mb-2 brand-heading" style="color: #111827;">${escapeHtml(s.name)}</h3>
                        <p class="text-sm leading-relaxed" style="color: #475569;">${escapeHtml(s.desc)}</p>
                      </div>
                    </div>
                    <div class="px-6 py-4 border-t" style="border-color: #F1F5F9; background-color: #F8FAFC;">
                      <a href="services.html" class="text-xs font-extrabold uppercase tracking-wider" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.serviceCardCta)} &rarr;</a>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
            ${extraServicesHtml}
          </div>
        </section>

        <section id="estimator" class="py-20 border-t" style="background-color: #F8FAFC; border-color: #E2E8F0;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 sw-grid-split">
            <div class="space-y-6">
              <span class="text-xs font-extrabold uppercase tracking-widest block" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.aboutEyebrow)}</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold brand-heading uppercase" style="color: #111827;">${escapeHtml(cp.aboutHeading)}</h2>
              <p class="text-base leading-relaxed" style="color: #334155;">${escapeHtml(activeOwnerStory)}</p>
              <div class="sw-card shadow-lg">
                <img src="${assetPaths.aboutUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-72 object-cover">
              </div>
            </div>
            <div>
              ${buildEstimateFormHtml('card')}
            </div>
          </div>
        </section>

        ${buildGallerySectionHtml('#FFFFFF', true)}
        ${comparisonSectionHtml}
        ${ctaBannerHtml}
      `;
    } else if (layoutMode === 'modern-architectural') {
      mainBodyLayoutHtml = `
        <section class="pt-14 pb-12" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="sw-grid-split pb-10">
              <div class="space-y-5">
                <div class="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">
                  <span>&#9632;</span> <span>${escapeHtml(city)} &bull; ${escapeHtml(cp.displayTrade)}</span>
                </div>
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight brand-heading" style="color: #111827;">
                  ${escapeHtml(activeTagline)}
                </h1>
              </div>
              <div class="space-y-5">
                <p class="text-base sm:text-lg leading-relaxed" style="color: #475569;">
                  ${escapeHtml(activeOwnerStory)}
                </p>
                <div class="flex flex-wrap items-center gap-3">
                  <a href="#estimator" class="brand-btn-primary px-6 py-3.5 font-bold text-sm shadow-lg">
                    Schedule Free Walkthrough &rarr;
                  </a>
                  <a href="tel:${cleanPhone}" class="px-6 py-3.5 brand-surface-card font-bold text-sm" style="color: #111827;">
                    Call ${escapeHtml(phone)}
                  </a>
                </div>
                <div class="flex flex-wrap items-center gap-6 text-xs font-bold pt-2" style="color: #334155;">
                  <span>${ratingChipLeft} ${ratingChipRight}</span>
                  <span>&#10004; ${escapeHtml(cp.heroTrustBadge)}</span>
                </div>
              </div>
            </div>

            <div class="sw-card shadow-2xl mb-10">
              <img src="${assetPaths.heroUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-72 sm:h-96 object-cover">
            </div>

            <div id="estimator">
              ${buildEstimateFormHtml('bar')}
            </div>
          </div>
        </section>

        <section class="py-20 border-y" style="background-color: #F8FAFC; border-color: #E2E8F0;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="max-w-2xl mb-12">
              <span class="text-xs font-extrabold uppercase tracking-widest block mb-1" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.servicesEyebrow)}</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold brand-heading" style="color: #111827;">${escapeHtml(cp.servicesHeading)}</h2>
              <p class="mt-2 text-base" style="color: #475569;">${escapeHtml(cp.servicesSubtitle)}</p>
            </div>
            <div class="space-y-6">
              ${activeServices.slice(0, 3).map((s, idx) => {
                const imgUrl = assetPaths.serviceUrls?.[idx] || (idx === 0 ? assetPaths.service1Url : idx === 1 ? assetPaths.service2Url : assetPaths.service3Url);
                return `
                  <article class="sw-card shadow-sm ${idx % 2 === 1 ? 'sw-grid-split' : 'sw-grid-split-rev'}" style="gap: 0;">
                    <div class="h-64 sm:h-72 overflow-hidden ${idx % 2 === 1 ? 'lg:order-2' : ''}">
                      <img src="${imgUrl}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover">
                    </div>
                    <div class="p-8 lg:p-10 space-y-3">
                      <span class="text-xs font-extrabold uppercase tracking-wider" style="color: ${lightSurfaceAccent};">0${idx + 1} &bull; ${escapeHtml(s.badge || cp.defaultBadge)}</span>
                      <h3 class="text-2xl font-bold brand-heading" style="color: #111827;">${escapeHtml(s.name)}</h3>
                      <p class="text-sm sm:text-base leading-relaxed" style="color: #475569;">${escapeHtml(s.desc)}</p>
                      <div class="pt-2">
                        <a href="contact.html" class="inline-flex items-center gap-1.5 text-sm font-bold" style="color: ${lightSurfaceAccent};">
                          ${escapeHtml(cp.serviceCardCta)} &rarr;
                        </a>
                      </div>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
            ${extraServicesHtml}
          </div>
        </section>

        <section class="py-16" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="sw-grid-3 mb-16">
              <div class="p-6 brand-surface-card">
                <span class="text-xs font-extrabold uppercase tracking-widest block mb-2" style="color: ${lightSurfaceAccent};">Step 01</span>
                <h3 class="text-lg font-bold brand-heading mb-1" style="color: #111827;">On-Site Scope Review</h3>
                <p class="text-sm" style="color: #475569;">We evaluate your property in ${escapeHtml(cityInfo.cityOnly)} first so nothing gets guessed.</p>
              </div>
              <div class="p-6 brand-surface-card">
                <span class="text-xs font-extrabold uppercase tracking-widest block mb-2" style="color: ${lightSurfaceAccent};">Step 02</span>
                <h3 class="text-lg font-bold brand-heading mb-1" style="color: #111827;">Clear Written Quote</h3>
                <p class="text-sm" style="color: #475569;">Line-by-line specifications, timeline, and firm pricing before work begins.</p>
              </div>
              <div class="p-6 brand-surface-card">
                <span class="text-xs font-extrabold uppercase tracking-widest block mb-2" style="color: ${lightSurfaceAccent};">Step 03</span>
                <h3 class="text-lg font-bold brand-heading mb-1" style="color: #111827;">Dedicated Local Crew</h3>
                <p class="text-sm" style="color: #475569;">Clean jobsite execution and final walkthrough across ${escapeHtml(cityInfo.regionShort)}.</p>
              </div>
            </div>
            <div class="sw-grid-split-rev">
              <div class="sw-card shadow-xl">
                <img src="${assetPaths.aboutUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-80 object-cover">
              </div>
              <div class="space-y-4">
                <span class="text-xs font-extrabold uppercase tracking-widest block" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.aboutEyebrow)}</span>
                <h2 class="text-3xl font-extrabold brand-heading" style="color: #111827;">${escapeHtml(cp.aboutHeading)}</h2>
                <p class="text-base leading-relaxed" style="color: #475569;">${escapeHtml(activeOwnerStory)}</p>
                <div class="p-5 sw-card border-l-4" style="border-left-color: var(--c-primary); background-color: #F8FAFC;">
                  <p class="text-sm font-medium" style="color: #111827;">"${escapeHtml(cp.aboutQuote)}"</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        ${comparisonSectionHtml}
        ${buildGallerySectionHtml('#FFFFFF', true)}
        ${ctaBannerHtml}
      `;
    } else if (layoutMode === 'split-hero-timber') {
      mainBodyLayoutHtml = `
        <section class="relative py-16 lg:py-24 overflow-hidden" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="sw-grid-split">
              <div class="space-y-6">
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase brand-surface-card" style="color: ${lightSurfaceAccent};">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>${escapeHtml(cp.heroEyebrow)}</span>
                </div>
                <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight brand-heading" style="color: #111827;">
                  ${escapeHtml(activeTagline)}
                </h1>
                <p class="text-lg leading-relaxed max-w-2xl" style="color: #475569;">
                  ${escapeHtml(activeOwnerStory)}
                </p>
                <div class="flex flex-wrap items-center gap-4 pt-2">
                  <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 brand-btn-primary font-bold px-7 py-4 shadow-xl transition-all hover:scale-105 text-base">
                    Call ${escapeHtml(phone)}
                  </a>
                  <a href="#estimator" class="inline-flex items-center gap-2 brand-surface-card font-semibold px-7 py-4 transition-all hover:opacity-90 text-base" style="color: #111827;">
                    Request Free Quote &darr;
                  </a>
                </div>
                <div class="flex flex-wrap items-center gap-6 pt-6 border-t" style="border-color: #E2E8F0;">
                  <div class="flex items-center gap-2 text-sm font-semibold" style="color: #111827;">
                    <span class="text-amber-500">${ratingChipLeft}</span> <span>${ratingChipRight}</span>
                  </div>
                  <div class="flex items-center gap-2 text-sm font-semibold" style="color: #111827;">
                    <span class="text-emerald-600">&#10004;</span> <span>${escapeHtml(cp.heroRootChip)}</span>
                  </div>
                  <div class="flex items-center gap-2 text-sm font-semibold" style="color: #111827;">
                    <span>${escapeHtml(cp.heroTrustBadge)}</span>
                  </div>
                </div>
              </div>
              <div class="relative">
                <div class="relative sw-card shadow-2xl border-2" style="border-color: #E2E8F0;">
                  <img src="${assetPaths.heroUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-80 sm:h-96 object-cover">
                  <div class="p-5 text-white" style="background-color: #0F172A;">
                    <span class="text-xs uppercase tracking-widest font-extrabold block mb-1" style="color: ${darkSurfaceAccent};">${escapeHtml(cp.heroCardLabel)}</span>
                    <p class="font-bold text-base leading-snug text-white">${escapeHtml(activeTagline || cp.heroCardFallbackTitle)}</p>
                    <p class="text-xs text-slate-300 mt-1">${escapeHtml(cp.heroCardSubtitle)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="estimator" class="py-16 border-y" style="background-color: #F8FAFC; border-color: #E2E8F0;">
          <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center max-w-2xl mx-auto mb-10">
              <span class="text-xs font-bold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">Planning Your Service</span>
              <h2 class="text-3xl font-extrabold mt-1 brand-heading" style="color: #111827;">${escapeHtml(cp.estimatorHeading)}</h2>
              <p class="text-sm mt-2" style="color: #475569;">${escapeHtml(cp.estimatorSubtitle)}</p>
            </div>
            ${buildEstimateFormHtml('bar')}
          </div>
        </section>

        <section class="py-20" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center max-w-3xl mx-auto mb-14">
              <span class="text-xs font-extrabold tracking-widest uppercase" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.servicesEyebrow)}</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold mt-1 brand-heading" style="color: #111827;">${escapeHtml(cp.servicesHeading)}</h2>
              <p class="mt-3 text-base" style="color: #475569;">${escapeHtml(cp.servicesSubtitle)}</p>
            </div>
            <div class="sw-grid-3">
              ${activeServices.slice(0, 3).map((s, idx) => {
                const imgUrl = assetPaths.serviceUrls?.[idx] || (idx === 0 ? assetPaths.service1Url : idx === 1 ? assetPaths.service2Url : assetPaths.service3Url);
                return `
                  <div class="sw-card shadow-xl transition-all hover:-translate-y-1 group" style="border-top: 4px solid var(--c-primary);">
                    <div class="h-56 overflow-hidden relative">
                      <img src="${imgUrl}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700">
                      <span class="absolute top-3 right-3 text-xs font-bold px-3 py-1 rounded-full bg-slate-900 text-white">${escapeHtml(s.badge || cp.defaultBadge)}</span>
                    </div>
                    <div class="p-7">
                      <h3 class="text-xl font-bold mb-2 brand-heading" style="color: #111827;">${escapeHtml(s.name)}</h3>
                      <p class="text-sm leading-relaxed mb-5" style="color: #475569;">${escapeHtml(s.desc)}</p>
                      <a href="services.html" class="inline-flex items-center gap-2 font-bold text-sm" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.serviceCardCta)} &rarr;</a>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            ${extraServicesHtml}
          </div>
        </section>

        <section class="py-16 border-t" style="background-color: #F8FAFC; border-color: #E2E8F0;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 sw-grid-split">
            <div class="space-y-6">
              <span class="text-xs font-bold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.aboutEyebrow)}</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold brand-heading" style="color: #111827;">${escapeHtml(cp.aboutHeading)}</h2>
              <p class="text-base leading-relaxed" style="color: #475569;">${escapeHtml(activeOwnerStory)}</p>
              <div class="p-6 sw-card border-l-4" style="border-left-color: var(--c-primary);">
                <p class="text-sm italic font-medium" style="color: #111827;">"${escapeHtml(cp.aboutQuote)}"</p>
                <p class="text-xs uppercase tracking-wider font-bold mt-3" style="color: ${lightSurfaceAccent};">${escapeHtml(city)}</p>
              </div>
            </div>
            <div class="sw-card shadow-2xl border-2" style="border-color: #E2E8F0;">
              <img src="${assetPaths.aboutUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-80 object-cover">
            </div>
          </div>
        </section>

        ${comparisonSectionHtml}
        ${ctaBannerHtml}
        ${buildGallerySectionHtml('#FFFFFF', true)}
      `;
    } else {
      // 'shield-banner-estimator': Dark conversion split-hero with floating quote card + gallery strip + 1+2 service bento
      mainBodyLayoutHtml = `
        <section class="relative py-16 lg:py-24 overflow-hidden text-white" style="background-image: linear-gradient(125deg, rgba(15,23,42,0.95) 0%, rgba(15,23,42,0.88) 60%, rgba(15,23,42,0.78) 100%), url('${assetPaths.heroUrl}'); background-size: cover; background-position: center;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 sw-grid-split">
            <div class="space-y-6">
              <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase border border-white/15" style="background-color: rgba(255,255,255,0.08); color: ${darkSurfaceAccent};">
                <span>${escapeHtml(cp.fortressEyebrow)}</span>
              </div>
              <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-none text-white brand-heading">
                ${escapeHtml(activeTagline)}
              </h1>
              <p class="text-base sm:text-lg leading-relaxed text-slate-200 max-w-xl">
                ${escapeHtml(activeOwnerStory)}
              </p>
              <div class="flex flex-wrap items-center gap-4 pt-2">
                <a href="tel:${cleanPhone}" class="inline-flex items-center gap-2 px-7 py-3.5 sw-btn-radius font-bold text-sm sm:text-base border border-white/25 bg-slate-800 hover:bg-slate-700 text-white">
                  <span>Call ${escapeHtml(phone)}</span>
                </a>
                <a href="services.html" class="text-sm font-bold underline" style="color: ${darkSurfaceAccent};">
                  Explore Services &rarr;
                </a>
              </div>
              <div class="flex flex-wrap items-center gap-6 pt-4 text-xs font-semibold text-slate-300">
                <span>${ratingChipLeft} ${ratingChipRight}</span>
                <span>&#10004; ${escapeHtml(cp.heroRootChip)}</span>
              </div>
            </div>
            <div id="estimator">
              ${buildEstimateFormHtml('card')}
            </div>
          </div>
        </section>

        ${buildGallerySectionHtml('#F8FAFC', false)}

        <section class="py-20" style="background-color: #FFFFFF;">
          <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center max-w-3xl mx-auto mb-14">
              <span class="text-xs font-extrabold tracking-widest uppercase" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.servicesEyebrow)}</span>
              <h2 class="text-3xl sm:text-4xl font-extrabold mt-1 brand-heading" style="color: #111827;">${escapeHtml(cp.servicesHeading)}</h2>
              <p class="mt-3 text-base" style="color: #475569;">${escapeHtml(cp.servicesSubtitle)}</p>
            </div>
            <div class="sw-grid-split" style="align-items: stretch;">
              <div class="sw-card shadow-xl flex flex-col justify-between">
                <div class="h-72 overflow-hidden relative">
                  <img src="${assetPaths.service1Url}" alt="${escapeHtml(activeServices[0]?.name || cp.fallbackServices[0].name)}" class="w-full h-full object-cover">
                  <span class="absolute top-4 left-4 text-xs font-extrabold uppercase tracking-wider px-3 py-1.5 brand-btn-primary shadow-lg">Featured Service</span>
                </div>
                <div class="p-8">
                  <h3 class="text-2xl font-bold mb-3 brand-heading" style="color: #111827;">${escapeHtml(activeServices[0]?.name || cp.fallbackServices[0].name)}</h3>
                  <p class="text-base leading-relaxed mb-5" style="color: #475569;">${escapeHtml(activeServices[0]?.desc || cp.fallbackServices[0].desc)}</p>
                  <a href="contact.html" class="inline-flex items-center gap-2 font-bold text-sm" style="color: ${lightSurfaceAccent};">Request Consultation &rarr;</a>
                </div>
              </div>
              <div class="flex flex-col gap-6 justify-between">
                <div class="sw-card p-6 shadow-md flex items-center gap-5">
                  <img src="${assetPaths.service2Url}" alt="${escapeHtml(activeServices[1]?.name || cp.fallbackServices[1].name)}" class="w-28 h-28 sw-btn-radius object-cover flex-shrink-0">
                  <div>
                    <span class="text-xs font-extrabold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">02 &bull; ${escapeHtml(activeServices[1]?.badge || cp.defaultBadge)}</span>
                    <h4 class="text-lg font-bold brand-heading mb-1" style="color: #111827;">${escapeHtml(activeServices[1]?.name || cp.fallbackServices[1].name)}</h4>
                    <p class="text-xs leading-relaxed" style="color: #475569;">${escapeHtml(activeServices[1]?.desc || cp.fallbackServices[1].desc)}</p>
                  </div>
                </div>
                <div class="sw-card p-6 shadow-md flex items-center gap-5">
                  <img src="${assetPaths.service3Url}" alt="${escapeHtml(activeServices[2]?.name || cp.fallbackServices[2].name)}" class="w-28 h-28 sw-btn-radius object-cover flex-shrink-0">
                  <div>
                    <span class="text-xs font-extrabold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">03 &bull; ${escapeHtml(activeServices[2]?.badge || 'Free Estimates')}</span>
                    <h4 class="text-lg font-bold brand-heading mb-1" style="color: #111827;">${escapeHtml(activeServices[2]?.name || cp.fallbackServices[2].name)}</h4>
                    <p class="text-xs leading-relaxed" style="color: #475569;">${escapeHtml(activeServices[2]?.desc || cp.fallbackServices[2].desc)}</p>
                  </div>
                </div>
                <div class="sw-card shadow-md flex items-center gap-5 p-5" style="background-color: #F8FAFC;">
                  <img src="${assetPaths.aboutUrl}" alt="${escapeHtml(bizName)}" class="w-24 h-24 sw-btn-radius object-cover flex-shrink-0">
                  <div>
                    <span class="text-xs font-extrabold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">Local Reputation</span>
                    <p class="text-xs leading-relaxed" style="color: #334155;">${escapeHtml(cp.aboutQuote)}</p>
                  </div>
                </div>
              </div>
            </div>
            ${extraServicesHtml}
          </div>
        </section>

        ${comparisonSectionHtml}
        ${ctaBannerHtml}
      `;
    }

    const indexHtml = `<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(bizName)} | ${escapeHtml(activeTagline)}</title>
  <meta name="description" content="${escapeHtml(bizName)} delivers dependable ${escapeHtml(cp.displayTrade.toLowerCase())} in ${escapeHtml(city)} and Northeast Wisconsin. Free quotes, insured professionals. Call ${phone}.">
  <link rel="ard" href="/.well-known/ard.json">
  <link rel="canonical" href="https://${slug}.pages.dev/">
  <meta name="geo.region" content="US-WI">
  <meta name="geo.placename" content="${escapeHtml(city)}">
  <link rel="preload" as="image" href="${assetPaths.heroUrl}" fetchpriority="high">
  ${headAnalyticsTagHtml}
    ${customCss}
  <script type="application/ld+json">${schemaJson}</script>
</head>
<body class="font-sans antialiased">
  ${headerHtml}
  <main id="main-content">
  ${mainBodyLayoutHtml}

  <section id="ai-summary" class="py-12 border-y" style="background-color: #F8FAFC; border-color: #E2E8F0;">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="p-6 rounded-2xl bg-white border shadow-sm" style="border-color: #E2E8F0;">
        <p class="text-xs font-bold uppercase tracking-wider mb-2" style="color: var(--c-primary);">Company Summary for Property Owners</p>
        <p class="text-sm leading-relaxed" style="color: #334155;">
          <strong style="color: #111827;">${escapeHtml(bizName)}</strong> is a ${escapeHtml(cp.summaryRole)} headquartered in ${escapeHtml(city)}, providing dependable services across ${escapeHtml(serviceArea)}. Call <a href="tel:${cleanPhone}" class="font-bold underline" style="color: var(--c-primary);">${escapeHtml(phone)}</a> for free on-site consultations and transparent pricing.
        </p>
      </div>
    </div>
  </section>

  </main>
  ${footerHtml}

  <script>
    document.getElementById('heroEstimateForm')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('heroSubmitBtn');
      const msg = document.getElementById('heroFormMsg');
      btn.disabled = true;
      btn.innerText = 'Transmitting...';
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('custName').value,
            phone: document.getElementById('custPhone')?.value || '',
            email: document.getElementById('custEmail')?.value || '',
            service: document.getElementById('custType')?.value || '',
            city: document.getElementById('custCity').value,
            businessName: "${escapeHtml(bizName)}"
          })
        });
        msg.className = 'text-center text-xs font-bold py-1 text-green-400 block';
        msg.innerText = '✔ Thank you! Your request was received. We will contact you shortly.';
        btn.innerText = 'Request Received!';
      } catch (err) {
        msg.className = 'text-center text-xs font-bold py-1 text-amber-400 block';
        msg.innerText = 'Request submitted. You can also call us directly at ${escapeHtml(phone)}.';
      }
    });
  </script>
</body>
</html>`;

    const servicesHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Services | ${escapeHtml(bizName)} — ${escapeHtml(cp.displayTrade)}</title>
  <meta name="description" content="Explore ${escapeHtml(cp.displayTrade.toLowerCase())} services by ${escapeHtml(bizName)} in ${escapeHtml(city)}. Upfront pricing and dependable local service.">
  <link rel="ard" href="/.well-known/ard.json">
  <link rel="canonical" href="https://${slug}.pages.dev/services.html">
  ${headAnalyticsTagHtml}
    ${customCss}
</head>
<body class="font-sans antialiased">
  ${headerHtml}
  <main id="main-content" class="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-3xl mx-auto mb-16">
      <span class="text-xs font-bold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">${escapeHtml(cp.servicesPageEyebrow)}</span>
      <h1 class="brand-heading text-4xl font-extrabold mt-2 mb-4" style="color: #111827;">${escapeHtml(cp.servicesPageHeading)}</h1>
      <p class="text-base" style="color: #475569;">${escapeHtml(cp.servicesPageSubtitle)}</p>
    </div>

    <div class="space-y-12">
      ${activeServices.map((s, idx) => {
    const imgUrl = assetPaths.serviceUrls?.[idx] || (idx === 0 ? assetPaths.service1Url : idx === 1 ? assetPaths.service2Url : assetPaths.service3Url);
    return `
          <div class="sw-card sw-service-row p-8 lg:p-12 shadow-xl">
            <div class="sw-service-media overflow-hidden shadow-md sw-btn-radius">
              <img src="${imgUrl}" alt="${escapeHtml(s.name)}" class="w-full h-full object-cover">
            </div>
            <div class="flex-1 space-y-4">
              <span class="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full inline-block" style="background-color: #f8fafc; border: 1px solid #e2e8f0; color: ${lightSurfaceAccent};">0${idx + 1} • ${escapeHtml(s.badge || cp.defaultBadge)}</span>
              <h2 class="brand-heading text-2xl sm:text-3xl font-extrabold" style="color: #111827;">${escapeHtml(s.name)}</h2>
              <p class="text-base leading-relaxed" style="color: #475569;">${escapeHtml(s.desc)}</p>
              <div class="pt-2 flex flex-wrap gap-4">
                <a href="contact.html" class="brand-btn-primary sw-btn-radius inline-block px-6 py-3 font-bold text-sm shadow-md">
                  Request Quote on ${escapeHtml(s.name)} &rarr;
                </a>
              </div>
            </div>
          </div>
        `;
  }).join('')}
    </div>
  </main>
  ${footerHtml}
</body>
</html>`;

    const aboutHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>About Us | ${escapeHtml(bizName)} — ${escapeHtml(cp.aboutPageTitleSuffix)}</title>
  <meta name="description" content="Learn about ${escapeHtml(bizName)}, our local roots in ${escapeHtml(city)}, service standards, and customer reviews.">
  <link rel="ard" href="/.well-known/ard.json">
  <link rel="canonical" href="https://${slug}.pages.dev/about.html">
  ${headAnalyticsTagHtml}
    ${customCss}
</head>
<body class="font-sans antialiased">
  ${headerHtml}
  <main id="main-content" class="py-20 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="sw-grid-split mb-16">
      <div class="space-y-6">
        <span class="text-xs font-bold uppercase tracking-widest" style="color: ${lightSurfaceAccent};">Local Reputation</span>
        <h1 class="brand-heading text-4xl font-extrabold" style="color: #111827;">About ${escapeHtml(bizName)}</h1>
        <p class="text-lg leading-relaxed" style="color: #475569;">
          ${escapeHtml(activeOwnerStory)}
        </p>
        <p class="text-sm leading-relaxed" style="color: #475569;">
          ${escapeHtml(cp.aboutSecondaryParagraph)}
        </p>
        ${socialIconsHtml.length > 0 ? `
          <div class="p-4 sw-card flex items-center justify-between">
            <span class="text-sm font-bold" style="color: #111827;">Follow our local updates:</span>
            ${socialRowHtml}
          </div>
        ` : ''}
      </div>
      <div>
        <div class="sw-card shadow-2xl h-80">
          <img src="${assetPaths.aboutUrl}" alt="${escapeHtml(bizName)} ${escapeHtml(cp.displayTrade)}" class="w-full h-full object-cover">
        </div>
      </div>
    </div>
  </main>
  ${footerHtml}
</body>
</html>`;

    const contactHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Contact ${escapeHtml(bizName)} | Free Estimate in ${escapeHtml(city)}</title>
  <meta name="description" content="Contact ${escapeHtml(bizName)} in ${escapeHtml(city)}. Call ${phone} or request a free quote online.">
  <link rel="ard" href="/.well-known/ard.json">
  <link rel="canonical" href="https://${slug}.pages.dev/contact.html">
  ${headAnalyticsTagHtml}
    ${customCss}
</head>
<body class="font-sans antialiased">
  ${headerHtml}
  <main id="main-content" class="py-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <div class="text-center max-w-2xl mx-auto mb-14">
      <h1 class="brand-heading text-4xl font-extrabold mb-3" style="color: #111827;">Contact ${escapeHtml(bizName)}</h1>
      <p class="text-base" style="color: #475569;">Call our line or submit your details below for a prompt written quote.</p>
    </div>

    <div class="sw-grid-split-rev items-start">
      <div class="sw-card p-8 space-y-6 shadow-xl">
        <div>
          <span class="text-xs font-bold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">Direct Phone</span>
          <a href="tel:${cleanPhone}" class="text-2xl font-black hover:opacity-80 transition-opacity" style="color: #111827;">${escapeHtml(phone)}</a>
        </div>
        ${email ? `<div>
          <span class="text-xs font-bold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">Email</span>
          <p class="text-sm font-semibold" style="color: #475569;">${escapeHtml(email)}</p>
        </div>` : ''}
        <div>
          <span class="text-xs font-bold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">Service Territory</span>
          <p class="text-sm" style="color: #475569;">${escapeHtml(serviceArea)}</p>
        </div>
        <div>
          <span class="text-xs font-bold uppercase tracking-wider block mb-1" style="color: ${lightSurfaceAccent};">Hours</span>
          <p class="text-xs leading-relaxed" style="color: #475569;">${escapeHtml(lead.hours || 'Mon - Fri: 7:00 AM - 5:00 PM')}</p>
        </div>
        ${socialIconsHtml.length > 0 ? `
          <div class="pt-4 border-t" style="border-color: #e2e8f0;">
            <span class="text-xs font-bold uppercase tracking-wider block mb-3" style="color: #111827;">Official Social Channels</span>
            ${socialRowHtml}
          </div>
        ` : ''}
      </div>

      <div class="sw-card p-8 lg:p-10 shadow-xl">
        <form id="contactPageForm" class="space-y-5">
          <div class="sw-grid-2" style="gap: 1.25rem;">
            <div>
              <label for="cpName" class="block text-xs font-bold uppercase mb-2" style="color: #111827;">Name</label>
              <input type="text" id="cpName" required class="w-full sw-btn-radius px-4 py-3 text-sm focus:outline-none" style="background-color: #f8fafc; color: #111827; border: 1px solid #cbd5e1;">
            </div>
            <div>
              <label for="cpPhone" class="block text-xs font-bold uppercase mb-2" style="color: #111827;">Phone</label>
              <input type="tel" id="cpPhone" required class="w-full sw-btn-radius px-4 py-3 text-sm focus:outline-none" style="background-color: #f8fafc; color: #111827; border: 1px solid #cbd5e1;">
            </div>
          </div>
          <div>
            <label for="cpEmail" class="block text-xs font-bold uppercase mb-2" style="color: #111827;">Email Address (Optional)</label>
            <input type="email" id="cpEmail" placeholder="your@email.com (optional)" class="w-full sw-btn-radius px-4 py-3 text-sm focus:outline-none" style="background-color: #f8fafc; color: #111827; border: 1px solid #cbd5e1;">
          </div>
          <div>
            <label for="cpService" class="block text-xs font-bold uppercase mb-2" style="color: #111827;">Service Required</label>
            <select id="cpService" class="w-full sw-btn-radius px-4 py-3 text-sm focus:outline-none" style="background-color: #f8fafc; color: #111827; border: 1px solid #cbd5e1;">
              ${activeServices.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')}
              <option value="General Inquiry">General Consultation / Other</option>
            </select>
          </div>
          <div>
            <label for="cpMsg" class="block text-xs font-bold uppercase mb-2" style="color: #111827;">Scope &amp; Property Address</label>
            <textarea id="cpMsg" rows="4" placeholder="${escapeHtml(cp.contactMsgPlaceholder)}" class="w-full sw-btn-radius px-4 py-3 text-sm focus:outline-none" style="background-color: #f8fafc; color: #111827; border: 1px solid #cbd5e1;"></textarea>
          </div>
          <button type="submit" id="cpSubmitBtn" class="w-full brand-btn-primary sw-btn-radius font-bold py-4 shadow-lg transition-transform hover:-translate-y-0.5 text-sm uppercase tracking-wider">
            Send Message &rarr;
          </button>
          <div id="cpFormStatus" class="hidden text-center text-xs font-bold py-2"></div>
        </form>
      </div>
    </div>
  </main>
  ${footerHtml}

  <script>
    document.getElementById('contactPageForm')?.addEventListener('submit', async function(e) {
      e.preventDefault();
      const btn = document.getElementById('cpSubmitBtn');
      const status = document.getElementById('cpFormStatus');
      btn.disabled = true;
      btn.innerText = 'Transmitting...';
      try {
        await fetch('/api/contact', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: document.getElementById('cpName').value,
            phone: document.getElementById('cpPhone')?.value || '',
            email: document.getElementById('cpEmail')?.value || '',
            service: document.getElementById('cpService')?.value || '',
            message: document.getElementById('cpMsg').value,
            businessName: "${escapeHtml(bizName)}"
          })
        });
        status.className = 'text-center text-xs font-bold py-2 text-green-400 block';
        status.innerText = '✔ Message received! We will follow up shortly.';
        btn.innerText = 'Message Sent!';
      } catch (e) {
        status.className = 'text-center text-xs font-bold py-2 text-amber-400 block';
        status.innerText = 'Your message was sent. You can also call us directly at ${escapeHtml(phone)}.';
      }
    });
  </script>
</body>
</html>`;

    const llmsTxt = `# ${bizName} — ${cp.displayTrade} (${city})

> ${bizName} is a ${cp.summaryRole} serving ${serviceArea}.

## Business Information (AI & Voice Assistants)
- **Business Name:** ${bizName}
- **Primary Trade:** ${cp.displayTrade}
- **Phone:** ${phone}
- **Email:** ${email}
- **Location:** ${city}
- **Service Area:** ${serviceArea}
- **Hours:** ${lead.hours || 'Monday - Friday: 7:00 AM - 5:00 PM'}
- **Official Socials:** ${Object.entries(socials).filter(([_, u]) => u).map(([p, u]) => `${p}: ${u}`).join(', ') || 'Available on request'}

## Core Services
${activeServices.map((s, idx) => `${idx + 1}. **${s.name}:** ${s.desc}`).join('\n')}

## Pages & Links
- [${bizName} Home](https://${slug}.pages.dev/)
- [${cp.llmsPortfolioLabel}](https://${slug}.pages.dev/services.html)
- [About ${bizName}](https://${slug}.pages.dev/about.html)
- [Schedule Free On-Site Estimate](https://${slug}.pages.dev/contact.html)
`;

    const robotsTxt = `User-agent: *
Allow: /
Sitemap: https://${slug}.pages.dev/sitemap.xml
`;

    const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://${slug}.pages.dev/</loc><priority>1.0</priority></url>
  <url><loc>https://${slug}.pages.dev/services.html</loc><priority>0.8</priority></url>
  <url><loc>https://${slug}.pages.dev/about.html</loc><priority>0.8</priority></url>
  <url><loc>https://${slug}.pages.dev/contact.html</loc><priority>0.8</priority></url>
</urlset>
`;

    const ardManifest = {
      "@context": "https://agenticresourcediscovery.org/context/v1",
      "entries": [
        {
          "@context": "https://agenticresourcediscovery.org/context/v1",
          "identifier": `urn:air:${slug}.pages.dev:site:assistant`,
          "displayName": `${bizName} Agentic Assistant`,
          "type": "application/agent-card+json",
          "description": `Autonomous discovery card and capabilities catalog for ${bizName}, providing dependable ${cp.displayTrade.toLowerCase()} services in ${city} and Northeast Wisconsin.`,
          "url": `https://${slug}.pages.dev/llms.txt`,
          "capabilities": [
            `${cp.displayTrade.toLowerCase().replace(/[^a-z0-9]/g, '_')}_estimate`,
            "service_inquiry",
            "service_capabilities"
          ],
          "tags": [
            cp.displayTrade.toLowerCase(),
            `${cp.displayTrade.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-service`,
            cityInfo.cityOnly.toLowerCase(),
            "wisconsin"
          ],
          "representativeQueries": [
            `Get a transparent quote for ${cp.displayTrade.toLowerCase()} services in ${city}`,
            `Explore verified ${cp.displayTrade.toLowerCase()} services in ${cityInfo.regionShort}`,
            `Contact ${bizName} for on-site assessment and estimates`
          ],
          "version": "1.0.0",
          "updatedAt": new Date().toISOString()
        }
      ]
    };

    return {
      'index.html': indexHtml,
      'services.html': servicesHtml,
      'about.html': aboutHtml,
      'contact.html': contactHtml,
      'llms.txt': llmsTxt,
      'robots.txt': robotsTxt,
      'sitemap.xml': sitemapXml,
      '.well-known/ard.json': JSON.stringify(ardManifest, null, 2)
    };
  }

  function generatePitchEmailMarkup(lead, previewUrl, branding) {
    const bizName = lead.businessName;
    const rawCitySource = lead.serviceArea
      ? lead.serviceArea.replace(/\(.*$/g, '').split(',')[0].trim()
      : (branding?.city || 'Fox Valley');
    const cityLabel = (rawCitySource || 'Fox Valley').replace(/\bfox\s+valley\b/gi, 'Fox Valley');
    const contactGreeting = lead.contactName ? `Hi ${escapeHtml(lead.contactName.split(' ')[0])},` : `Hi ${escapeHtml(bizName)} team,`;
    const claimUrl = `${claimBaseUrl}?business=${encodeURIComponent(bizName)}&preview=${encodeURIComponent(previewUrl)}`;
    const slugForPitch = sanitizeSlug(bizName);
    const trackedEmailUrl = `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}utm_source=pitch&utm_medium=email&utm_campaign=${encodeURIComponent(slugForPitch)}`;
    const trackedQrUrl = `${previewUrl}${previewUrl.includes('?') ? '&' : '?'}src=qr`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(trackedQrUrl)}`;

    const qrBlockHtml = `
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 18px 0 20px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; max-width: 480px; width: 100%;">
        <tr>
          <td style="padding-right: 16px; vertical-align: middle; width: 130px;">
            <a href="${escapeHtml(trackedEmailUrl)}" target="_blank" style="display: inline-block; background: #ffffff; padding: 6px; border-radius: 10px; border: 1px solid #e2e8f0; text-decoration: none;">
              <img src="${escapeHtml(qrImageUrl)}" width="130" height="130" alt="Scan QR Code to preview ${escapeHtml(bizName)} on your phone" style="display: block; width: 130px; height: 130px; border: 0;" />
            </a>
          </td>
          <td style="vertical-align: middle; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #059669; margin-bottom: 4px;">Scan With Your Phone</div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-bottom: 6px;">See how ${escapeHtml(bizName)} looks on mobile</div>
            <div style="font-size: 12.5px; color: #475569; line-height: 1.45; margin-bottom: 10px;">Point your phone's camera at this QR code to open the live mobile preview right in your hand.</div>
            <a href="${escapeHtml(trackedEmailUrl)}" target="_blank" style="display: inline-block; padding: 8px 14px; background-color: #0f172a; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; border-radius: 6px;">Open Live Preview &rarr;</a>
          </td>
        </tr>
      </table>
    `;

    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b; max-width: 620px; line-height: 1.6; font-size: 15px;">
        <p style="margin: 0 0 14px 0; line-height: 1.6; color: #18181b; font-size: 15px;">${contactGreeting}</p>

        <p style="margin: 0 0 14px 0; line-height: 1.6; color: #18181b; font-size: 15px;">
          I'm Jason Woodrow, and I run a small local studio right here in Appleton (624 Siteworks)—not an out-of-state marketing agency.
        </p>

        <p style="margin: 0 0 14px 0; line-height: 1.6; color: #18181b; font-size: 15px;">
          While looking at local Fox Valley businesses, I noticed ${escapeHtml(bizName)} has a great reputation, but your current web setup is leaving local leads on the table. So I went ahead and built a live working preview of a new site for you:<br/>
          <a href="${escapeHtml(trackedEmailUrl)}" target="_blank" style="color: #2563eb; font-weight: 700; text-decoration: underline;">${escapeHtml(previewUrl)}</a>
        </p>

        ${qrBlockHtml}

        <p style="margin: 0 0 14px 0; line-height: 1.6; color: #18181b; font-size: 15px;">
          Simply swapping in this new site helps your business right away:<br/>
          • <strong>Instant Page Speed &amp; Mobile Fit:</strong> Loads in under 1 second on phones so customers don't bounce back to Google.<br/>
          • <strong>Stronger Local SEO:</strong> Built with ${escapeHtml(cityLabel)} search structure so you rank higher when homeowners search for your services.<br/>
          • <strong>More Calls &amp; Quotes:</strong> One-tap click-to-call buttons and fast estimate forms that turn visitors into booked jobs.
        </p>

        <p style="margin: 0 0 14px 0; line-height: 1.6; color: #18181b; font-size: 15px;">
          Zero obligation—I already built the draft. If you want to put it on your domain, my flat options are at <a href="${claimUrl}" target="_blank" style="color: #2563eb; font-weight: 700; text-decoration: underline;">${claimUrl}</a>, or just call/text my cell at (920) 234-5633.
        </p>

        <p style="margin: 20px 0 0 0; line-height: 1.6; color: #18181b; font-size: 15px;">
          Best,<br/>
          <strong>Jason Woodrow</strong><br/>
          624 Siteworks · Appleton, WI · (920) 234-5633<br/>
          <a href="https://624siteworks.com" target="_blank" style="color: #2563eb; text-decoration: none;">624siteworks.com</a>
        </p>
      </div>
    `;
  }

  function resolveLeadTradeAndCity(match, slug, specSitesRoot) {
    const rawTrade = match.ratingReviews?.includes('-')
      ? match.ratingReviews.split('-').slice(1).join('-').trim()
      : (match.businessType || 'Contractor');
    const tradeKey = getTradeCopyProfile(rawTrade, match.businessName, '').displayTrade;

    let city = '';
    if (specSitesRoot) {
      const targetSlug = slug || sanitizeSlug(match.businessName);
      const existingIndex = path.join(specSitesRoot, targetSlug, 'index.html');
      if (fs.existsSync(existingIndex)) {
        try {
          const html = fs.readFileSync(existingIndex, 'utf8');
          const geoMatch = html.match(/<meta\s+name="geo\.placename"\s+content="([^"]+)"/i);
          if (geoMatch && geoMatch[1]) {
            city = formatCityState(geoMatch[1]).cityState;
          }
        } catch (_) {}
      }
    }

    if (!city) {
      if (match.city) {
        city = formatCityState(match.city).cityState;
      } else if (match.serviceArea?.includes('(')) {
        city = formatCityState(match.serviceArea.split('(')[1].split(',')[0].trim()).cityState;
      } else {
        const matchedNiche = ROTATING_NICHES.find(n => getTradeKey(n.trade) === getTradeKey(tradeKey));
        if (matchedNiche) {
          city = matchedNiche.city;
        } else if (match.serviceArea && !/fox valley|northeast wisconsin/i.test(match.serviceArea)) {
          city = formatCityState(match.serviceArea.split(',')[0].trim()).cityState;
        } else {
          city = 'Appleton, WI';
        }
      }
    }

    return { tradeKey, city };
  }

  return {
    researchBusinessOnline,
    synthesizeBespokeBranding,
    prepareProjectAssets,
    generateBespokeSiteMarkup,
    generatePitchEmailMarkup,
    loadClientOverride,
    resolveLeadTradeAndCity,
    normalizeTradeCategory,
    resolveContextualPhoto,
    getComparisonFactors,
    getTradeCopyProfile,
    formatCityState,
    getTradeKey,
    hasRealCustomServices,
    hasGenericPlaceholderVibe,
    sanitizeSlug,
    escapeHtml
  };
}

module.exports = {
  ROTATING_NICHES,
  createSiteBuilder,
  normalizeTradeCategory,
  sanitizeSlug,
  escapeHtml,
  formatCityState,
  getTradeKey,
  getDistinctiveBizTokens,
  isJunkImageUrl,
  isNonWorkGraphicUrl,
  isTrustworthyResearchImage
};
