/**
 * ============================================================================
 * 624 Siteworks — Spec-Site Concept Preview Floating Banner (preview-banner.js)
 * ============================================================================
 * Drop into any generated 4-page static Tailwind spec build before </body>:
 *   <script src="https://624siteworks.com/assets/preview-banner.js" data-business="Acme Roofing LLC" defer></script>
 *
 * Optional attributes on the <script> tag:
 *   data-business="Business Name"     (Auto-detected from <title> if omitted)
 *   data-claim-url="https://..."      (Defaults to https://624siteworks.com/claim.html)
 * ============================================================================
 */
(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (document.getElementById('sw624-preview-banner')) return;

  function getDemoSlug(scriptEl, businessName) {
    var attrSlug =
      (scriptEl && scriptEl.getAttribute('data-slug')) ||
      window.SITEWORKS_DEMO_SLUG ||
      '';
    if (attrSlug) return String(attrSlug).trim().toLowerCase();

    var host = (window.location.hostname || '').toLowerCase();
    if (host.endsWith('.pages.dev')) {
      var parts = host.split('.');
      if (parts.length >= 3) {
        return parts[parts.length - 3].replace(/[^a-z0-9-]/g, '');
      }
    }
    return String(businessName || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function initDemoTelemetry(scriptEl, businessName) {
    if (window.__sw624TelemetryStarted) return;
    window.__sw624TelemetryStarted = true;

    var search = window.location.search || '';
    var ua = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : '';
    var isBot = Boolean(
      (typeof navigator !== 'undefined' && navigator.webdriver) ||
      /lighthouse|pagespeed|headless|puppeteer|playwright|thum\.io|bot|crawl|spider|slurp/i.test(ua)
    );

    if (/[?&](?:admin_preview|nolog)=1/i.test(search)) {
      try { sessionStorage.setItem('sw624_admin_preview', '1'); } catch (_) {}
    }

    var isAdmin = false;
    try { isAdmin = sessionStorage.getItem('sw624_admin_preview') === '1'; } catch (_) {}

    if (isBot || isAdmin || window.__sw624SkipTracking) {
      return null;
    }

    var slug = getDemoSlug(scriptEl, businessName);
    if (!slug) return null;

    var gaId =
      (scriptEl && scriptEl.getAttribute('data-ga-id')) ||
      window.SITEWORKS_DEMO_GA_ID ||
      'G-07ZVHY3BBN';
    var trackUrl =
      (scriptEl && scriptEl.getAttribute('data-track-url')) ||
      window.SITEWORKS_TRACK_URL ||
      'https://us-central1-admin-hub-cc0a2.cloudfunctions.net/trackDemoView';

    if (gaId && !window.__sw624GaLoaded && typeof window.gtag !== 'function') {
      window.__sw624GaLoaded = true;
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', gaId, {
        demo_slug: slug,
        business_name: businessName,
        site_type: 'demo_preview'
      });
      var gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(gaId);
      if (document.head) document.head.appendChild(gaScript);
    }

    var visitorId = '';
    try {
      visitorId = localStorage.getItem('sw624_vid') || '';
      if (!visitorId) {
        visitorId = 'v_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
        localStorage.setItem('sw624_vid', visitorId);
      }
    } catch (_) {}

    var sessionKey = 'sw624_session_' + slug;
    var seenKey = 'sw624_seen_' + slug;
    var isSessionStart = true;
    var isNewVisitor = true;
    try {
      isSessionStart = !sessionStorage.getItem(sessionKey);
      isNewVisitor = !localStorage.getItem(seenKey);
      sessionStorage.setItem(sessionKey, '1');
      localStorage.setItem(seenKey, '1');
    } catch (_) {}

    var isQr = /[?&](?:src=qr|utm_medium=qr)\b/i.test(search);
    var isPitchRef = isQr || /[?&](?:utm_source=pitch|src=pitch)\b/i.test(search);
    var sourceLabel = isQr ? 'QR Scan' : (isPitchRef ? 'Pitch Email' : (document.referrer ? 'Referral / Search' : 'Direct Link'));
    var deviceType = /Mobi|Android|iPhone|iPad/i.test(ua) ? 'Mobile' : 'Desktop';

    function sendBeaconEvent(eventType, extra) {
      if (!trackUrl) return;
      var payload = Object.assign({
        slug: slug,
        businessName: businessName,
        hostname: window.location.hostname || '',
        path: window.location.pathname || '/',
        referrer: (document.referrer || '').slice(0, 300),
        visitorId: visitorId,
        isNewVisitor: isNewVisitor,
        isPitchRef: isPitchRef,
        isQr: isQr,
        sourceLabel: sourceLabel,
        deviceType: deviceType,
        eventType: eventType || 'pageview'
      }, extra || {});

      try {
        var jsonStr = JSON.stringify(payload);
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          var blob = new Blob([jsonStr], { type: 'text/plain;charset=UTF-8' });
          navigator.sendBeacon(trackUrl, blob);
          return;
        }
        if (typeof fetch === 'function') {
          fetch(trackUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
            body: jsonStr,
            keepalive: true
          }).catch(function () {});
        }
      } catch (_) {}
    }

    sendBeaconEvent(isSessionStart ? 'session_start' : 'pageview');

    return {
      slug: slug,
      trackAction: function (actionType, label) {
        sendBeaconEvent(actionType);
        if (typeof window.gtag === 'function') {
          try {
            window.gtag('event', actionType, {
              demo_slug: slug,
              business_name: businessName,
              event_label: label || slug
            });
          } catch (_) {}
        }
      }
    };
  }

  function initBanner() {
    if (document.getElementById('sw624-preview-banner')) return;

    // Locate the script tag to read optional data-* attributes
    var scriptEl =
      document.currentScript ||
      document.querySelector('script[src*="preview-banner.js"]');

    var businessName =
      (scriptEl && scriptEl.getAttribute('data-business')) ||
      window.SITEWORKS_BUSINESS_NAME ||
      '';

    if (!businessName && document.title) {
      businessName = document.title.split(/[|\-–—]/)[0].trim();
    }
    if (!businessName) {
      businessName = 'Your Business';
    }

    var tracker = initDemoTelemetry(scriptEl, businessName);

    var baseClaimUrl =
      (scriptEl && scriptEl.getAttribute('data-claim-url')) ||
      'https://624siteworks.com/claim.html';

    var separator = baseClaimUrl.indexOf('?') === -1 ? '?' : '&';
    var claimHref =
      baseClaimUrl +
      separator +
      'business=' +
      encodeURIComponent(businessName) +
      '&preview=' +
      encodeURIComponent(window.location.href);

    var style = document.createElement('style');
    style.id = 'sw624-preview-banner-styles';
    style.textContent = [
      '#sw624-preview-banner {',
      '  position: fixed;',
      '  bottom: 0;',
      '  left: 0;',
      '  right: 0;',
      '  z-index: 2147483647;',
      '  background: rgba(2, 6, 23, 0.96);',
      '  backdrop-filter: blur(12px);',
      '  -webkit-backdrop-filter: blur(12px);',
      '  border-top: 1px solid rgba(59, 130, 246, 0.35);',
      '  box-shadow: 0 -8px 30px rgba(2, 6, 23, 0.65);',
      '  color: #f8fafc;',
      '  font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
      '  padding: 12px 16px;',
      '  transition: transform 0.25s ease, opacity 0.25s ease;',
      '}',
      '#sw624-preview-banner .sw624-inner {',
      '  max-width: 1240px;',
      '  margin: 0 auto;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: space-between;',
      '  gap: 14px;',
      '  flex-wrap: wrap;',
      '}',
      '#sw624-preview-banner .sw624-copy {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '  font-size: 14px;',
      '  line-height: 1.45;',
      '  color: #e2e8f0;',
      '  flex: 1 1 320px;',
      '}',
      '#sw624-preview-banner .sw624-badge {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: rgba(37, 99, 235, 0.2);',
      '  border: 1px solid rgba(59, 130, 246, 0.45);',
      '  color: #93c5fd;',
      '  font-size: 11px;',
      '  font-weight: 700;',
      '  text-transform: uppercase;',
      '  letter-spacing: 0.05em;',
      '  padding: 3px 9px;',
      '  border-radius: 9999px;',
      '  white-space: nowrap;',
      '}',
      '#sw624-preview-banner .sw624-dot {',
      '  width: 7px;',
      '  height: 7px;',
      '  border-radius: 50%;',
      '  background: #3b82f6;',
      '  box-shadow: 0 0 8px #3b82f6;',
      '}',
      '#sw624-preview-banner .sw624-actions {',
      '  display: flex;',
      '  align-items: center;',
      '  gap: 10px;',
      '}',
      '#sw624-preview-banner .sw624-call {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: rgba(255, 255, 255, 0.12);',
      '  border: 1px solid rgba(255, 255, 255, 0.25);',
      '  color: #ffffff !important;',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  padding: 8px 14px;',
      '  border-radius: 8px;',
      '  text-decoration: none !important;',
      '  white-space: nowrap;',
      '  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;',
      '}',
      '#sw624-preview-banner .sw624-call:hover {',
      '  background: rgba(255, 255, 255, 0.22);',
      '  border-color: rgba(255, 255, 255, 0.45);',
      '  transform: translateY(-1px);',
      '}',
      '#sw624-preview-banner .sw624-cta {',
      '  display: inline-flex;',
      '  align-items: center;',
      '  gap: 6px;',
      '  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);',
      '  color: #ffffff !important;',
      '  font-size: 13px;',
      '  font-weight: 700;',
      '  padding: 9px 16px;',
      '  border-radius: 8px;',
      '  text-decoration: none !important;',
      '  white-space: nowrap;',
      '  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4);',
      '  transition: transform 0.15s ease, box-shadow 0.15s ease;',
      '}',
      '#sw624-preview-banner .sw624-cta:hover {',
      '  transform: translateY(-1px);',
      '  box-shadow: 0 6px 20px rgba(37, 99, 235, 0.55);',
      '}',
      '#sw624-preview-banner .sw624-close {',
      '  background: transparent;',
      '  border: 0;',
      '  color: #94a3b8;',
      '  cursor: pointer;',
      '  padding: 6px;',
      '  font-size: 18px;',
      '  line-height: 1;',
      '  border-radius: 6px;',
      '}',
      '#sw624-preview-banner .sw624-close:hover {',
      '  color: #ffffff;',
      '  background: rgba(255, 255, 255, 0.08);',
      '}',
      '@media (max-width: 640px) {',
      '  #sw624-preview-banner {',
      '    padding: 10px 12px;',
      '  }',
      '  #sw624-preview-banner .sw624-copy {',
      '    font-size: 12.5px;',
      '  }',
      '  #sw624-preview-banner .sw624-actions {',
      '    width: 100%;',
      '    display: flex;',
      '    align-items: center;',
      '    gap: 8px;',
      '  }',
      '  #sw624-preview-banner .sw624-call {',
      '    flex: 1;',
      '    justify-content: center;',
      '    padding: 8px 8px;',
      '    font-size: 11.5px;',
      '  }',
      '  #sw624-preview-banner .sw624-cta {',
      '    flex: 1.2;',
      '    justify-content: center;',
      '    padding: 8px 8px;',
      '    font-size: 11.5px;',
      '  }',
      '}'
    ].join('\n');
    document.head.appendChild(style);

    var banner = document.createElement('div');
    banner.id = 'sw624-preview-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', '624 Siteworks Concept Preview Notice');

    var inner = document.createElement('div');
    inner.className = 'sw624-inner';

    var copy = document.createElement('div');
    copy.className = 'sw624-copy';

    var badge = document.createElement('span');
    badge.className = 'sw624-badge';
    var dot = document.createElement('span');
    dot.className = 'sw624-dot';
    badge.appendChild(dot);
    badge.appendChild(document.createTextNode('Live Concept'));

    var textSpan = document.createElement('span');
    textSpan.appendChild(document.createTextNode('Concept Preview Built for '));
    var strongBiz = document.createElement('strong');
    strongBiz.style.color = '#ffffff';
    strongBiz.textContent = businessName;
    textSpan.appendChild(strongBiz);
    textSpan.appendChild(
      document.createTextNode(' by 624 Siteworks (Appleton, WI) — Questions? Call ')
    );
    var phoneLink = document.createElement('a');
    phoneLink.href = 'tel:9202345633';
    phoneLink.style.color = '#93c5fd';
    phoneLink.style.fontWeight = '700';
    phoneLink.style.textDecoration = 'underline';
    phoneLink.textContent = '(920) 234-5633';
    textSpan.appendChild(phoneLink);

    copy.appendChild(badge);
    copy.appendChild(textSpan);

    var actions = document.createElement('div');
    actions.className = 'sw624-actions';

    var callBtn = document.createElement('a');
    callBtn.className = 'sw624-call';
    callBtn.href = 'tel:9202345633';
    callBtn.title = 'Call or text Jason Woodrow to discuss this website';
    callBtn.textContent = '📞 (920) 234-5633';
    if (tracker) {
      callBtn.addEventListener('click', function () {
        tracker.trackAction('cta_call', 'preview_banner_call');
      });
    }

    var cta = document.createElement('a');
    cta.className = 'sw624-cta';
    cta.href = claimHref;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = 'Claim & customize site →';
    if (tracker) {
      cta.addEventListener('click', function () {
        tracker.trackAction('cta_claim', 'preview_banner_claim');
      });
      var forms = document.querySelectorAll('form');
      for (var fi = 0; fi < forms.length; fi++) {
        forms[fi].addEventListener('submit', function () {
          tracker.trackAction('form_submit', 'demo_estimate_form');
        });
      }
    }

    var closeBtn = document.createElement('button');
    closeBtn.className = 'sw624-close';
    closeBtn.type = 'button';
    closeBtn.title = 'Temporarily hide preview bar';
    closeBtn.setAttribute('aria-label', 'Hide preview bar');
    closeBtn.innerHTML = '&times;';
    closeBtn.addEventListener('click', function () {
      banner.style.transform = 'translateY(110%)';
      banner.style.opacity = '0';
      document.body.style.paddingBottom = '';
      setTimeout(function () {
        if (banner.parentNode) banner.parentNode.removeChild(banner);
      }, 260);
    });

    actions.appendChild(callBtn);
    actions.appendChild(cta);
    actions.appendChild(closeBtn);

    inner.appendChild(copy);
    inner.appendChild(actions);
    banner.appendChild(inner);

    document.body.appendChild(banner);
    document.body.style.paddingBottom = '64px';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBanner);
  } else {
    initBanner();
  }
})();

