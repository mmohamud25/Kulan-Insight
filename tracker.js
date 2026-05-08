/**
 * Kulan Analytics Tracker v4.0
 * ─────────────────────────────
 * NEW in v4:
 *   - Mouse hover/move heatmap tracking
 *   - Form field analytics (focus, blur, skip detection)
 *   - Custom event properties via data-kl-props
 *   - Ecommerce purchase tracking
 *   - Bot detection & filtering
 *   - Channel auto-classification
 *
 * Usage:
 *   <script src="https://analytics.kulaninstitute.org/tracker.js"
 *           data-site="Portfolio"
 *           data-group="main"
 *           defer></script>
 *
 * Custom goal with properties:
 *   <button data-kl-goal="signup" data-kl-props='{"plan":"pro","value":29}'>
 *
 * Ecommerce purchase:
 *   <button data-kl-purchase data-kl-props='{"product":"Pro Plan","revenue":29,"currency":"USD"}'>
 *
 * Form analytics (auto-detected or manual):
 *   <form data-kl-form="checkout">...</form>
 *
 * Search:
 *   <input data-kl-search placeholder="Search...">
 */
(function () {
  'use strict';

  /* ── BOT DETECTION ─────────────────────────────────────────────── */
  const BOT_PATTERNS = /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer|playwright|prerender|lighthouse|pagespeed|google-structured|facebookexternalhit|twitterbot|linkedinbot|slurp|bingbot|googlebot|yandex|baidu/i;
  if (BOT_PATTERNS.test(navigator.userAgent)) return; // silent exit for bots

  /* ── CONFIG ─────────────────────────────────────────────────────── */
  const SUPABASE_URL = 'https://xkadqvmqxdyqoddiypet.supabase.co';
  const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWRxdm1xeGR5cW9kZGl5cGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzI5NDMsImV4cCI6MjA4ODk0ODk0M30.FPBEXOx62vaTcLom7IkVRKRLda1xKk09slhQZ9yuRWc';
  const TABLE        = 'analytics_events';
  const GEO_API      = 'https://ipapi.co/json/';
  const HOVER_SAMPLE = 50; // record 1 in every N mousemove events

  const script        = document.currentScript;
  const SITE_ID       = script?.getAttribute('data-site')  || 'default';
  const CONTENT_GROUP = script?.getAttribute('data-group') || null;

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
      sessionStorage.setItem('_kl_pst', Date.now().toString());
    }
    return s;
  }

  function isReturning() {
    const k = '_kl_ret';
    const was = localStorage.getItem(k);
    localStorage.setItem(k, '1');
    return !!was;
  }

  /* ── Channel classification ─────────────────────────────────────── */
  function getChannel(ref, utmMedium, utmSource) {
    const med = (utmMedium || '').toLowerCase();
    const src = (utmSource  || '').toLowerCase();
    if (/cpc|ppc|paid|paidsearch|paid_search/.test(med)) return 'Paid Search';
    if (/paidsocial|paid_social|paid-social/.test(med))  return 'Paid Social';
    if (/email|newsletter|mail/.test(med))                return 'Email';
    if (/social|social-media|sm/.test(med))               return 'Social';
    if (/affiliate/.test(med))                            return 'Affiliate';
    if (src || med)                                        return 'Campaign';
    if (!ref)                                             return 'Direct';
    let host = '';
    try { host = new URL(ref).hostname.toLowerCase(); } catch { host = ref.toLowerCase(); }
    if (/google|bing|yahoo|duckduckgo|baidu|yandex|ask\.com/.test(host)) return 'Organic Search';
    if (/facebook|instagram|twitter|x\.com|linkedin|pinterest|tiktok|youtube|reddit|snapchat/.test(host)) return 'Social';
    if (/mail\.|gmail|yahoo\.com|hotmail|outlook\.com/.test(host)) return 'Email';
    return 'Referral';
  }

  /* ── UTM ────────────────────────────────────────────────────────── */
  function readUTM() {
    const p = new URLSearchParams(location.search);
    const utm = {
      utm_source: p.get('utm_source'), utm_medium: p.get('utm_medium'),
      utm_campaign: p.get('utm_campaign'), utm_content: p.get('utm_content'),
      utm_term: p.get('utm_term'),
    };
    if (Object.values(utm).some(Boolean)) { sessionStorage.setItem('_kl_utm', JSON.stringify(utm)); return utm; }
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
      color_depth: screen.colorDepth||null, pixel_ratio: Math.round((window.devicePixelRatio||1)*100)/100,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone||null, language: navigator.language||null,
      platform: navigator.platform||null, connection_type: conn?(conn.effectiveType||conn.type||null):null,
      device_memory: navigator.deviceMemory||null, hardware_concurrency: navigator.hardwareConcurrency||null,
      touch_support: navigator.maxTouchPoints>0,
    };
  }

  /* ── Geo ────────────────────────────────────────────────────────── */
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
      _geo = { country: d.country_name||null, city: d.city||null, region: d.region||null,
               postal_code: d.postal||null, latitude: d.latitude||null, longitude: d.longitude||null, ip_address: d.ip||null };
    } catch { _geo = { country:null,city:null,region:null,postal_code:null,latitude:null,longitude:null,ip_address:null }; }
    sessionStorage.setItem('_kl_geo', JSON.stringify(_geo));
    return _geo;
  }

  let _battery = null;
  if (navigator.getBattery) navigator.getBattery().then(b => { _battery = Math.round(b.level*1000)/1000; }).catch(()=>{});

  /* ── Base payload ───────────────────────────────────────────────── */
  async function basePayload() {
    const geo = await getGeo();
    const utm = readUTM();
    const dev = getDeviceInfo();
    const channel = getChannel(document.referrer, utm.utm_medium, utm.utm_source);
    return {
      site_id: SITE_ID, url: location.href, page_title: document.title,
      referrer: document.referrer||null, session_id: getSessionId(), visitor_id: getVisitorId(),
      device_type: getDeviceType(), browser: getBrowser(), os: getOS(),
      screen_width: screen.width, screen_height: screen.height,
      is_returning: isReturning(), content_group: CONTENT_GROUP, channel,
      is_bot: false,
      ...geo, ...dev, battery_level: _battery,
      utm_source: utm.utm_source||null, utm_medium: utm.utm_medium||null,
      utm_campaign: utm.utm_campaign||null, utm_content: utm.utm_content||null, utm_term: utm.utm_term||null,
    };
  }

  /* ── Sender ─────────────────────────────────────────────────────── */
  async function track(type, extra) {
    const payload = Object.assign(await basePayload(), { event_type: type }, extra||{});
    Object.keys(payload).forEach(k => { if (payload[k]==null) delete payload[k]; });
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`, {
        method:'POST', keepalive:true,
        headers:{'Content-Type':'application/json','apikey':ANON_KEY,'Authorization':'Bearer '+ANON_KEY,'Prefer':'return=minimal'},
        body: JSON.stringify(payload),
      });
    } catch(_) {}
  }

  /* ── Page view ──────────────────────────────────────────────────── */
  function trackPageView() {
    sessionStorage.setItem('_kl_pst', Date.now().toString());
    track('pageview');
  }

  /* ── Scroll depth ───────────────────────────────────────────────── */
  (function(){
    const fired=new Set();
    window.addEventListener('scroll',function(){
      const pct=Math.round(((window.scrollY+window.innerHeight)/Math.max(document.documentElement.scrollHeight,1))*100);
      [25,50,75,100].forEach(m=>{if(pct>=m&&!fired.has(m)){fired.add(m);track('scroll',{scroll_depth:m});}});
    },{passive:true});
  })();

  /* ── Hover / mousemove heatmap ──────────────────────────────────── */
  (function(){
    let moveCount=0;
    const batch=[];
    function flush(){
      if(!batch.length)return;
      const items=[...batch]; batch.length=0;
      items.forEach(({x,y})=>track('hover',{hover_x:x,hover_y:y}));
    }
    const flushDebounced=debounce(flush,2000);
    document.addEventListener('mousemove',function(e){
      moveCount++;
      if(moveCount%HOVER_SAMPLE!==0)return;
      const pageH=Math.max(document.body.scrollHeight,1);
      batch.push({
        x:Math.round((e.clientX/window.innerWidth)*100),
        y:Math.round(((e.clientY+window.scrollY)/pageH)*100),
      });
      if(batch.length>=20)flush();
      else flushDebounced();
    },{passive:true});
  })();

  /* ── Click events ───────────────────────────────────────────────── */
  document.addEventListener('click',function(e){
    const el=e.target.closest('a,button,[data-kl],[data-kl-goal],[data-kl-purchase]');
    if(!el)return;
    const goalName=el.getAttribute('data-kl-goal')||null;
    const isPurchase=el.hasAttribute('data-kl-purchase');
    const propsRaw=el.getAttribute('data-kl-props');
    let props={},revenue=null,currency=null,product_name=null;
    if(propsRaw){try{props=JSON.parse(propsRaw);}catch(_){}}
    if(isPurchase){revenue=props.revenue||null;currency=props.currency||'USD';product_name=props.product||null;}
    const pageH=Math.max(document.body.scrollHeight,1);
    const extra={
      element_tag:el.tagName.toLowerCase(), element_id:el.id||null,
      element_text:(el.textContent||'').trim().slice(0,120),
      click_x:Math.round((e.clientX/window.innerWidth)*100),
      click_y:Math.round(((e.clientY+window.scrollY)/pageH)*100),
      event_properties:Object.keys(props).length?JSON.stringify(props):null,
    };
    if(isPurchase) track('purchase',{...extra,revenue,currency,product_name,goal_name:'purchase'});
    if(goalName)   track('goal',{...extra,goal_name:goalName});
    track('click',extra);
  },{passive:true,capture:true});

  /* ── Form analytics ─────────────────────────────────────────────── */
  (function(){
    const formData={};
    function getFormId(form){return form.getAttribute('data-kl-form')||form.id||form.name||'form';}
    function getFieldName(field){return field.name||field.id||field.getAttribute('aria-label')||field.type||'field';}

    document.addEventListener('focusin',function(e){
      const field=e.target;
      if(!['INPUT','SELECT','TEXTAREA'].includes(field.tagName))return;
      const form=field.closest('form');if(!form)return;
      const fid=getFormId(form),fname=getFieldName(field);
      if(!formData[fid])formData[fid]={fields:{}};
      formData[fid].fields[fname]={focused:Date.now(),blurred:null,value_entered:false,skipped:false};
    },{passive:true});

    document.addEventListener('focusout',function(e){
      const field=e.target;
      if(!['INPUT','SELECT','TEXTAREA'].includes(field.tagName))return;
      const form=field.closest('form');if(!form)return;
      const fid=getFormId(form),fname=getFieldName(field);
      if(!formData[fid]?.fields[fname])return;
      const f=formData[fid].fields[fname];
      f.blurred=Date.now();
      f.value_entered=!!(field.value||'').trim();
      f.skipped=!f.value_entered;
      track('form_field',{
        form_id:fid, form_field:fname,
        time_on_field:f.blurred-f.focused,
        field_skipped:f.skipped,
        field_completed:f.value_entered,
      });
    },{passive:true});
  })();

  /* ── Form submits ───────────────────────────────────────────────── */
  document.addEventListener('submit',function(e){
    const form=e.target;
    const goalName=form.getAttribute('data-kl-goal')||(form.id?'form:'+form.id:'form_submit');
    track('goal',{goal_name:goalName,element_tag:'form',element_id:form.id||null});
  },{passive:true,capture:true});

  /* ── Site search ────────────────────────────────────────────────── */
  (function(){
    const SELS=['input[type=search]','input[name=q]','input[name=query]','input[name=search]','input[name=s]','input[data-kl-search]','input[placeholder*=search i]','input[placeholder*=find i]'];
    function attach(input){
      if(input._klSearch)return; input._klSearch=true;
      input.addEventListener('keydown',function(e){
        if(e.key==='Enter'){const q=(input.value||'').trim();if(q)track('search',{search_query:q.slice(0,200)});}
      });
    }
    SELS.forEach(s=>document.querySelectorAll(s).forEach(attach));
    new MutationObserver(()=>SELS.forEach(s=>document.querySelectorAll(s).forEach(attach))).observe(document.body,{childList:true,subtree:true});
  })();

  /* ── Session end ────────────────────────────────────────────────── */
  window.addEventListener('pagehide',function(){
    const sessStart=sessionStorage.getItem('_kl_sst');
    const pageStart=sessionStorage.getItem('_kl_pst');
    track('session_end',{
      duration:sessStart?Math.round((Date.now()-parseInt(sessStart,10))/1000):null,
      time_on_page:pageStart?Math.round((Date.now()-parseInt(pageStart,10))/1000):null,
    });
  });

  /* ── SPA support ────────────────────────────────────────────────── */
  const _push=history.pushState.bind(history);
  history.pushState=function(){_push.apply(history,arguments);setTimeout(trackPageView,50);};
  window.addEventListener('popstate',()=>setTimeout(trackPageView,50));

  /* ── Utils ──────────────────────────────────────────────────────── */
  function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

  /* ── Boot ───────────────────────────────────────────────────────── */
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',trackPageView);
  else trackPageView();
})();
