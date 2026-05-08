/**
 * Kulan Analytics Tracker v2.0
 * ─────────────────────────────
 * NEW in v2: UTM tracking, click coordinates (heatmap),
 *            goal events, form submit tracking
 *
 * Usage:
 *   <script src="https://analytics.kulaninstitute.org/tracker.js"
 *           data-site="portfolio" defer></script>
 *
 * Custom goals on any element:
 *   <button data-kl-goal="cta_click">Get Started</button>
 *   <form data-kl-goal="contact_form_submit">...</form>
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://xkadqvmqxdyqoddiypet.supabase.co';
  const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWRxdm1xeGR5cW9kZGl5cGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzI5NDMsImV4cCI6MjA4ODk0ODk0M30.FPBEXOx62vaTcLom7IkVRKRLda1xKk09slhQZ9yuRWc';
  const TABLE        = 'analytics_events';
  const GEO_API      = 'https://ipapi.co/json/';

  const script  = document.currentScript;
  const SITE_ID = script ? (script.getAttribute('data-site') || 'default') : 'default';

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

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
    }
    return s;
  }

  function readUTM() {
    const p = new URLSearchParams(location.search);
    const utm = {
      utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'), utm_content: p.get('utm_content'),
      utm_term: p.get('utm_term'),
    };
    if (Object.values(utm).some(Boolean)) {
      sessionStorage.setItem('_kl_utm', JSON.stringify(utm));
      return utm;
    }
    const cached = sessionStorage.getItem('_kl_utm');
    return cached ? JSON.parse(cached) : utm;
  }

  function getDeviceType() {
    const ua = navigator.userAgent;
    if (/Tablet|iPad|Playbook|Silk/i.test(ua)) return 'tablet';
    if (/Mobile|iPhone|iPod|Android|BlackBerry/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  function getBrowser() {
    const ua = navigator.userAgent;
    if (/Firefox/i.test(ua)) return 'Firefox';
    if (/SamsungBrowser/i.test(ua)) return 'Samsung Internet';
    if (/OPR|Opera/i.test(ua)) return 'Opera';
    if (/Edg/i.test(ua)) return 'Edge';
    if (/Chrome/i.test(ua)) return 'Chrome';
    if (/Safari/i.test(ua)) return 'Safari';
    return 'Other';
  }

  function getOS() {
    const ua = navigator.userAgent;
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS';
    if (/Mac/i.test(ua)) return 'macOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Other';
  }

  let _geo = null;
  async function getGeo() {
    if (_geo) return _geo;
    const cached = sessionStorage.getItem('_kl_geo');
    if (cached) return (_geo = JSON.parse(cached));
    try {
      const ctrl = new AbortController();
      setTimeout(() => ctrl.abort(), 3000);
      const r = await fetch(GEO_API, { signal: ctrl.signal });
      const d = await r.json();
      _geo = { country: d.country_name || null, city: d.city || null };
    } catch { _geo = { country: null, city: null }; }
    sessionStorage.setItem('_kl_geo', JSON.stringify(_geo));
    return _geo;
  }

  async function track(type, extra) {
    const geo = await getGeo();
    const utm = readUTM();
    const payload = Object.assign({
      site_id: SITE_ID, event_type: type,
      url: location.href, page_title: document.title,
      referrer: document.referrer || null,
      session_id: getSessionId(), visitor_id: getVisitorId(),
      device_type: getDeviceType(), browser: getBrowser(), os: getOS(),
      country: geo.country, city: geo.city,
      screen_width: screen.width, screen_height: screen.height,
      utm_source: utm.utm_source || null, utm_medium: utm.utm_medium || null,
      utm_campaign: utm.utm_campaign || null, utm_content: utm.utm_content || null,
      utm_term: utm.utm_term || null,
    }, extra || {});
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'apikey': ANON_KEY,
          'Authorization': 'Bearer ' + ANON_KEY, 'Prefer': 'return=minimal' },
        body: JSON.stringify(payload),
      });
    } catch (_) {}
  }

  function trackPageView() { track('pageview'); }

  document.addEventListener('click', function (e) {
    const el = e.target.closest('a, button, [data-kl], [data-kl-goal]');
    if (!el) return;
    const goalName = el.getAttribute('data-kl-goal') || null;
    const pageH = Math.max(document.body.scrollHeight, 1);
    const extra = {
      element_tag: el.tagName.toLowerCase(),
      element_id: el.id || null,
      element_text: (el.textContent || '').trim().slice(0, 120),
      click_x: Math.round((e.clientX / window.innerWidth) * 100),
      click_y: Math.round(((e.clientY + window.scrollY) / pageH) * 100),
    };
    if (goalName) track('goal', Object.assign({ goal_name: goalName }, extra));
    track('click', extra);
  }, { passive: true, capture: true });

  document.addEventListener('submit', function (e) {
    const form = e.target;
    const goalName = form.getAttribute('data-kl-goal') || (form.id ? 'form:' + form.id : 'form_submit');
    track('goal', { goal_name: goalName, element_tag: 'form', element_id: form.id || null });
  }, { passive: true, capture: true });

  window.addEventListener('pagehide', function () {
    const start = sessionStorage.getItem('_kl_sst');
    const duration = start ? Math.round((Date.now() - parseInt(start, 10)) / 1000) : null;
    track('session_end', { duration });
  });

  const _push = history.pushState.bind(history);
  history.pushState = function () { _push.apply(history, arguments); setTimeout(trackPageView, 50); };
  window.addEventListener('popstate', () => setTimeout(trackPageView, 50));

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', trackPageView);
  else trackPageView();
})();
