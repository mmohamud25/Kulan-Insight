/**
 * Kulan Analytics Tracker v3.0
 * ─────────────────────────────
 * NEW in v3:
 *   - Scroll depth events (25 / 50 / 75 / 100%)
 *   - Enhanced geo: region, postal code, lat/lng, IP
 *   - Full device fingerprint: color depth, pixel ratio,
 *     timezone, language, platform, connection, RAM, CPU cores,
 *     touch support, battery level
 *   - Site search query capture
 *   - Content grouping via data-group attribute
 *   - New vs returning visitor flag
 *   - Time on page per pageview
 *
 * Usage:
 *   <script src="https://analytics.kulaninstitute.org/tracker.js"
 *           data-site="portfolio"
 *           data-group="main"
 *           defer></script>
 *
 * Goals:
 *   <button data-kl-goal="cta_click">Get Started</button>
 *   <form   data-kl-goal="contact_submit">...</form>
 *
 * Search tracking (auto-detects common patterns, or tag manually):
 *   <input data-kl-search placeholder="Search...">
 */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────────────── */
  const SUPABASE_URL = 'https://xkadqvmqxdyqoddiypet.supabase.co';
  const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWRxdm1xeGR5cW9kZGl5cGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzI5NDMsImV4cCI6MjA4ODk0ODk0M30.FPBEXOx62vaTcLom7IkVRKRLda1xKk09slhQZ9yuRWc';
  const TABLE        = 'analytics_events';
  const GEO_API      = 'https://ipapi.co/json/';

  const script        = document.currentScript;
  const SITE_ID       = script?.getAttribute('data-site')    || 'default';
  const CONTENT_GROUP = script?.getAttribute('data-group')   || null;

  /* ── ID helpers ─────────────────────────────────────────────────── */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

  function getVisitorId() {
    const k = '_kl_vid';
    let v = localStorage.getItem(k);
    if (!v) localStorage.setItem(k, (v = uid()));
    return v;
  }

  function getSessionId() {
    const k = '_kl_sid';
    let s = sessionStorage.getItem(k);
    if (!s) {
      sessionStorage.setItem(k, (s = uid()));
      sessionStorage.setItem('_kl_sst', Date.now().toString());
      sessionStorage.setItem('_kl_pst', Date.now().toString()); // page start time
    }
    return s;
  }

  function isReturning() {
    const k = '_kl_ret';
    const was = localStorage.getItem(k);
    localStorage.setItem(k, '1');
    return !!was;
  }

  /* ── UTM ────────────────────────────────────────────────────────── */
  function readUTM() {
    const p = new URLSearchParams(location.search);
    const utm = {
      utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'), utm_content: p.get('utm_content'),
      utm_term: p.get('utm_term'),
    };
    if (Object.values(utm).some(Boolean)) {
      sessionStorage.setItem('_kl_utm', JSON.stringify(utm)); return utm;
    }
    const c = sessionStorage.getItem('_kl_utm');
    return c ? JSON.parse(c) : utm;
  }

  /* ── Device fingerprint ─────────────────────────────────────────── */
  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/Tablet|iPad|Playbook|Silk/i.test(ua))             return 'tablet';
    if (/Mobile|iPhone|iPod|Android|BlackBerry/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (/Firefox/i.test(ua))        return 'Firefox';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/OPR|Opera/i.test(ua))      return 'Opera';
    if (/Edg/i.test(ua))            return 'Edge';
    if (/Chrome/i.test(ua))         return 'Chrome';
    if (/Safari/i.test(ua))         return 'Safari';
    return 'Other';
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua))          return 'Windows';
    if (/Android/i.test(ua))          return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac/i.test(ua))              return 'macOS';
    if (/Linux/i.test(ua))            return 'Linux';
    return 'Other';
  }

  function getDeviceInfo() {
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return {
      color_depth:          screen.colorDepth || null,
      pixel_ratio:          Math.round((window.devicePixelRatio || 1) * 100) / 100,
      timezone:             Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      language:             navigator.language || null,
      platform:             navigator.platform || null,
      connection_type:      conn ? (conn.effectiveType || conn.type || null) : null,
      device_memory:        navigator.deviceMemory || null,
      hardware_concurrency: navigator.hardwareConcurrency || null,
      touch_support:        navigator.maxTouchPoints > 0,
    };
  }

  /* ── Geo (enhanced — cached per session) ────────────────────────── */
  let _geo = null;
  async function getGeo() {
    if (_geo) return _geo;
    const cached = sessionStorage.getItem('_kl_geo');
    if (cached) return (_geo = JSON.parse(cached));
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch(GEO_API, { signal: ctrl.signal });
      const d = await r.json();
      _geo = {
        country:     d.country_name  || null,
        city:        d.city          || null,
        region:      d.region        || null,   // state / province
        postal_code: d.postal        || null,
        latitude:    d.latitude      || null,
        longitude:   d.longitude     || null,
        ip_address:  d.ip            || null,
      };
    } catch {
      _geo = { country: null, city: null, region: null, postal_code: null,
               latitude: null, longitude: null, ip_address: null };
    }
    sessionStorage.setItem('_kl_geo', JSON.stringify(_geo));
    return _geo;
  }

  /* ── Battery (async, best-effort) ───────────────────────────────── */
  let _battery = null;
  if (navigator.getBattery) {
    navigator.getBattery().then(b => { _battery = Math.round(b.level * 1000) / 1000; }).catch(() => {});
  }

  /* ── Base payload ───────────────────────────────────────────────── */
  async function basePayload() {
    const geo = await getGeo();
    const utm = readUTM();
    const dev = getDeviceInfo();
    return {
      site_id:       SITE_ID,
      url:           location.href,
      page_title:    document.title,
      referrer:      document.referrer || null,
      session_id:    getSessionId(),
      visitor_id:    getVisitorId(),
      device_type:   getDeviceType(),
      browser:       getBrowser(),
      os:            getOS(),
      screen_width:  screen.width,
      screen_height: screen.height,
      is_returning:  isReturning(),
      content_group: CONTENT_GROUP,
      // geo
      country:     geo.country,
      city:        geo.city,
      region:      geo.region,
      postal_code: geo.postal_code,
      latitude:    geo.latitude,
      longitude:   geo.longitude,
      ip_address:  geo.ip_address,
      // device
      ...dev,
      battery_level: _battery,
      // utm
      utm_source:    utm.utm_source    || null,
      utm_medium:    utm.utm_medium    || null,
      utm_campaign:  utm.utm_campaign  || null,
      utm_content:   utm.utm_content   || null,
      utm_term:      utm.utm_term      || null,
    };
  }

  /* ── Event sender ───────────────────────────────────────────────── */
  async function track(type, extra) {
    const payload = Object.assign(await basePayload(), { event_type: type }, extra || {});
    // Strip nulls for cleaner rows
    Object.keys(payload).forEach(k => { if (payload[k] == null) delete payload[k]; });
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST', keepalive: true,
        headers: {
          'Content-Type': 'application/json',
          'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(payload),
      });
    } catch (_) { /* silent fail */ }
  }

  /* ── Page view ──────────────────────────────────────────────────── */
  function trackPageView() {
    sessionStorage.setItem('_kl_pst', Date.now().toString()); // reset page timer
    track('pageview');
  }

  /* ── Scroll depth ───────────────────────────────────────────────── */
  (function initScrollDepth() {
    const fired = new Set();
    function onScroll() {
      const scrolled   = window.scrollY + window.innerHeight;
      const totalHeight= Math.max(document.documentElement.scrollHeight, 1);
      const pct        = Math.round((scrolled / totalHeight) * 100);
      [25, 50, 75, 100].forEach(milestone => {
        if (pct >= milestone && !fired.has(milestone)) {
          fired.add(milestone);
          track('scroll', { scroll_depth: milestone });
        }
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ── Click events ───────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    const el = e.target.closest('a, button, [data-kl], [data-kl-goal]');
    if (!el) return;
    const goalName = el.getAttribute('data-kl-goal') || null;
    const pageH    = Math.max(document.body.scrollHeight, 1);
    const extra = {
      element_tag:  el.tagName.toLowerCase(),
      element_id:   el.id || null,
      element_text: (el.textContent || '').trim().slice(0, 120),
      click_x:      Math.round((e.clientX / window.innerWidth) * 100),
      click_y:      Math.round(((e.clientY + window.scrollY) / pageH) * 100),
    };
    if (goalName) track('goal', Object.assign({ goal_name: goalName }, extra));
    track('click', extra);
  }, { passive: true, capture: true });

  /* ── Form submits ───────────────────────────────────────────────── */
  document.addEventListener('submit', function (e) {
    const form     = e.target;
    const goalName = form.getAttribute('data-kl-goal') || (form.id ? 'form:' + form.id : 'form_submit');
    track('goal', { goal_name: goalName, element_tag: 'form', element_id: form.id || null });
  }, { passive: true, capture: true });

  /* ── Site search tracking ───────────────────────────────────────── */
  (function initSearchTracking() {
    // Auto-detect search inputs by common patterns
    const SEARCH_SELECTORS = [
      'input[type=search]',
      'input[name=q]', 'input[name=query]', 'input[name=search]', 'input[name=s]',
      'input[data-kl-search]',
      'input[placeholder*=search i]', 'input[placeholder*=find i]',
    ];

    function debounce(fn, ms) {
      let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
    }

    function attachSearchListener(input) {
      if (input._klSearch) return;
      input._klSearch = true;
      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          const q = input.value.trim();
          if (q) track('search', { search_query: q.slice(0, 200) });
        }
      });
    }

    // Attach to existing inputs
    SEARCH_SELECTORS.forEach(sel => {
      document.querySelectorAll(sel).forEach(attachSearchListener);
    });

    // Watch for dynamically added inputs
    new MutationObserver(() => {
      SEARCH_SELECTORS.forEach(sel => {
        document.querySelectorAll(sel).forEach(attachSearchListener);
      });
    }).observe(document.body, { childList: true, subtree: true });
  })();

  /* ── Session end ────────────────────────────────────────────────── */
  window.addEventListener('pagehide', function () {
    const sessStart = sessionStorage.getItem('_kl_sst');
    const pageStart = sessionStorage.getItem('_kl_pst');
    const duration  = sessStart ? Math.round((Date.now() - parseInt(sessStart, 10)) / 1000) : null;
    const timeOnPage= pageStart ? Math.round((Date.now() - parseInt(pageStart, 10)) / 1000) : null;
    track('session_end', { duration, time_on_page: timeOnPage });
  });

  /* ── SPA support ────────────────────────────────────────────────── */
  const _push = history.pushState.bind(history);
  history.pushState = function () {
    _push.apply(history, arguments);
    setTimeout(trackPageView, 50);
  };
  window.addEventListener('popstate', () => setTimeout(trackPageView, 50));

  /* ── Boot ───────────────────────────────────────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }
})();
