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
      '    justify-content: space-between;',
      '  }',
      '  #sw624-preview-banner .sw624-cta {',
      '    flex: 1;',
      '    justify-content: center;',
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
      document.createTextNode(' by 624 Siteworks (Appleton, WI) — Like this design?')
    );

    copy.appendChild(badge);
    copy.appendChild(textSpan);

    var actions = document.createElement('div');
    actions.className = 'sw624-actions';

    var cta = document.createElement('a');
    cta.className = 'sw624-cta';
    cta.href = claimHref;
    cta.target = '_blank';
    cta.rel = 'noopener noreferrer';
    cta.textContent = 'Click to claim & customize this site →';

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

