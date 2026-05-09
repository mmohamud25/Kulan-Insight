/**
 * Kulan Analytics Tracker v5.0
 * NEW: Performance monitoring (Web Vitals + Navigation Timing),
 *      Error tracking (JS errors, promise rejections, broken resources),
 *      LinkedIn UTM auto-tagging
 */
(function () {
  'use strict';

  /* ── BOT DETECTION ─────────────────────────────────────────── */
  const BOT = /bot|crawler|spider|scraper|headless|phantom|selenium|puppeteer|playwright|prerender|lighthouse|pagespeed|facebookexternalhit|twitterbot|linkedinbot|slurp|bingbot|googlebot|yandex|baidu/i;
  if (BOT.test(navigator.userAgent)) return;

  /* ── CONFIG ─────────────────────────────────────────────────── */
  const SUPABASE_URL = 'https://xkadqvmqxdyqoddiypet.supabase.co';
  const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhrYWRxdm1xeGR5cW9kZGl5cGV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNzI5NDMsImV4cCI6MjA4ODk0ODk0M30.FPBEXOx62vaTcLom7IkVRKRLda1xKk09slhQZ9yuRWc';
  const TABLE        = 'analytics_events';
  const GEO_API      = 'https://ipapi.co/json/';
  const HOVER_SAMPLE = 50;

  const script        = document.currentScript;
  const SITE_ID       = script?.getAttribute('data-site')  || 'default';
  const CONTENT_GROUP = script?.getAttribute('data-group') || null;

  /* ── IDs ────────────────────────────────────────────────────── */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
  function getVisitorId(){ const k='_kl_vid';let v=localStorage.getItem(k);if(!v)localStorage.setItem(k,(v=uid()));return v; }
  function getSessionId(){ const k='_kl_sid';let s=sessionStorage.getItem(k);if(!s){sessionStorage.setItem(k,(s=uid()));sessionStorage.setItem('_kl_sst',Date.now().toString());sessionStorage.setItem('_kl_pst',Date.now().toString());}return s; }
  function isReturning(){ const k='_kl_ret';const was=localStorage.getItem(k);localStorage.setItem(k,'1');return!!was; }

  /* ── Channel ────────────────────────────────────────────────── */
  function getChannel(ref,med,src){
    const m=(med||'').toLowerCase(),s=(src||'').toLowerCase();
    if(/cpc|ppc|paid/.test(m))return'Paid Search';
    if(/paidsocial|paid_social/.test(m))return'Paid Social';
    if(/email|newsletter/.test(m))return'Email';
    if(/social/.test(m))return'Social';
    if(s||m)return'Campaign';
    if(!ref)return'Direct';
    let h='';try{h=new URL(ref).hostname.toLowerCase();}catch{h=ref.toLowerCase();}
    if(/google|bing|yahoo|duckduckgo|baidu|yandex/.test(h))return'Organic Search';
    if(/linkedin/.test(h))return'LinkedIn';
    if(/facebook|instagram|twitter|x\.com|pinterest|tiktok|youtube|reddit/.test(h))return'Social';
    if(/mail\.|gmail|hotmail|outlook\.com/.test(h))return'Email';
    return'Referral';
  }

  /* ── UTM ────────────────────────────────────────────────────── */
  function readUTM(){
    const p=new URLSearchParams(location.search);
    const utm={utm_source:p.get('utm_source'),utm_medium:p.get('utm_medium'),utm_campaign:p.get('utm_campaign'),utm_content:p.get('utm_content'),utm_term:p.get('utm_term')};
    // Auto-detect LinkedIn referral
    if(!utm.utm_source){const ref=document.referrer||'';if(/linkedin\.com/i.test(ref)){utm.utm_source='linkedin';utm.utm_medium='social';}}
    if(Object.values(utm).some(Boolean)){sessionStorage.setItem('_kl_utm',JSON.stringify(utm));return utm;}
    const c=sessionStorage.getItem('_kl_utm');return c?JSON.parse(c):utm;
  }

  /* ── Device ─────────────────────────────────────────────────── */
  function getDeviceType(){const ua=navigator.userAgent;if(/Tablet|iPad|Playbook|Silk/i.test(ua))return'tablet';if(/Mobile|iPhone|iPod|Android|BlackBerry/i.test(ua))return'mobile';return'desktop';}
  function getBrowser(){const ua=navigator.userAgent;if(/Firefox/i.test(ua))return'Firefox';if(/SamsungBrowser/i.test(ua))return'Samsung Internet';if(/OPR|Opera/i.test(ua))return'Opera';if(/Edg/i.test(ua))return'Edge';if(/Chrome/i.test(ua))return'Chrome';if(/Safari/i.test(ua))return'Safari';return'Other';}
  function getOS(){const ua=navigator.userAgent;if(/Windows/i.test(ua))return'Windows';if(/Android/i.test(ua))return'Android';if(/iPhone|iPad|iPod/i.test(ua))return'iOS';if(/Mac/i.test(ua))return'macOS';if(/Linux/i.test(ua))return'Linux';return'Other';}

  function getDeviceInfo(){
    const conn=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
    function getBV(){const ua=navigator.userAgent;const m=ua.match(/Firefox\/([\d.]+)|SamsungBrowser\/([\d.]+)|OPR\/([\d.]+)|Edg\/([\d.]+)|Chrome\/([\d.]+)|Version\/([\d.]+).*Safari/i);if(!m)return null;return m.slice(1).find(Boolean)||null;}
    function getOSV(){const ua=navigator.userAgent;let m;if((m=ua.match(/Windows NT ([\d.]+)/i)))return'Windows '+({'10':'10','6.3':'8.1','6.2':'8','6.1':'7','6.0':'Vista'}[m[1]]||m[1]);if((m=ua.match(/Android ([\d.]+)/i)))return'Android '+m[1];if((m=ua.match(/iPhone OS ([\d_]+)/i)))return'iOS '+m[1].replace(/_/g,'.');if((m=ua.match(/iPad.*OS ([\d_]+)/i)))return'iPadOS '+m[1].replace(/_/g,'.');if((m=ua.match(/Mac OS X ([\d_]+)/i)))return'macOS '+m[1].replace(/_/g,'.');if(/Linux/i.test(ua))return'Linux';return null;}
    function getModel(){const ua=navigator.userAgent;let m;m=ua.match(/\(Linux;.*?;\s*([^;)]+?)\s*(?:Build|\/)/i);if(m)return m[1].trim();if(/iPhone/i.test(ua))return'iPhone';if(/iPad/i.test(ua))return'iPad';m=ua.match(/Samsung ([\w-]+)/i);if(m)return'Samsung '+m[1];return null;}
    function getGPU(){try{const c=document.createElement('canvas');const gl=c.getContext('webgl')||c.getContext('experimental-webgl');if(!gl)return{gpu_vendor:null,gpu_renderer:null};const d=gl.getExtension('WEBGL_debug_renderer_info');return{gpu_vendor:d?gl.getParameter(d.UNMASKED_VENDOR_WEBGL):null,gpu_renderer:d?gl.getParameter(d.UNMASKED_RENDERER_WEBGL):null};}catch(_){return{gpu_vendor:null,gpu_renderer:null};}}
    const gpu=getGPU();
    return{
      color_depth:screen.colorDepth||null,pixel_ratio:Math.round((window.devicePixelRatio||1)*100)/100,
      viewport_width:window.innerWidth||null,viewport_height:window.innerHeight||null,
      timezone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,language:navigator.language||null,
      languages:(navigator.languages||[]).join(',')||null,platform:navigator.platform||null,
      device_memory:navigator.deviceMemory||null,hardware_concurrency:navigator.hardwareConcurrency||null,
      touch_support:navigator.maxTouchPoints>0,max_touch_points:navigator.maxTouchPoints||0,
      connection_type:conn?(conn.effectiveType||conn.type||null):null,
      connection_downlink:conn?(conn.downlink||null):null,connection_rtt:conn?(conn.rtt||null):null,
      browser_version:getBV(),os_version:getOSV(),device_model:getModel(),
      ...gpu,cookies_enabled:navigator.cookieEnabled||false,do_not_track:navigator.doNotTrack==='1'||false,
    };
  }

  /* ── Geo ────────────────────────────────────────────────────── */
  let _geo=null;
  async function getGeo(){
    if(_geo)return _geo;
    const c=sessionStorage.getItem('_kl_geo');if(c)return(_geo=JSON.parse(c));
    try{const ctrl=new AbortController();setTimeout(()=>ctrl.abort(),4000);const r=await fetch(GEO_API,{signal:ctrl.signal});const d=await r.json();_geo={
        country:d.country_name||null,
        country_code:d.country_code||null,
        country_code_iso3:d.country_code_iso3||null,
        country_tld:d.country_tld||null,
        city:d.city||null,
        region:d.region||null,
        postal_code:d.postal||null,
        latitude:d.latitude||null,
        longitude:d.longitude||null,
        ip_address:d.ip||null,
        org:d.org||null,
        asn:d.asn||null,
        currency:d.currency||null,
        currency_name:d.currency_name||null,
        timezone:d.timezone||null,
        utc_offset:d.utc_offset||null,
        in_eu:d.in_eu||false,
        continent_code:d.continent_code||null,
        calling_code:d.country_calling_code||null,
        ip_languages:d.languages||null,
      };}
    catch{_geo={country:null,country_code:null,country_code_iso3:null,country_tld:null,city:null,region:null,postal_code:null,latitude:null,longitude:null,ip_address:null,org:null,asn:null,currency:null,currency_name:null,timezone:null,utc_offset:null,in_eu:false,continent_code:null,calling_code:null,ip_languages:null};}
    sessionStorage.setItem('_kl_geo',JSON.stringify(_geo));return _geo;
  }
  let _battery=null;
  if(navigator.getBattery)navigator.getBattery().then(b=>{_battery=Math.round(b.level*1000)/1000;}).catch(()=>{});

  /* ── Base payload ───────────────────────────────────────────── */
  async function basePayload(){
    const geo=await getGeo();const utm=readUTM();const dev=getDeviceInfo();
    const channel=getChannel(document.referrer,utm.utm_medium,utm.utm_source);
    return{site_id:SITE_ID,url:location.href,page_title:document.title,referrer:document.referrer||null,
      session_id:getSessionId(),visitor_id:getVisitorId(),device_type:getDeviceType(),browser:getBrowser(),os:getOS(),
      screen_width:screen.width,screen_height:screen.height,is_returning:isReturning(),content_group:CONTENT_GROUP,channel,is_bot:false,
      ...geo,...dev,battery_level:_battery,utm_source:utm.utm_source||null,utm_medium:utm.utm_medium||null,
      utm_campaign:utm.utm_campaign||null,utm_content:utm.utm_content||null,utm_term:utm.utm_term||null};
  }

  /* ── Sender ─────────────────────────────────────────────────── */
  async function track(type,extra){
    const payload=Object.assign(await basePayload(),{event_type:type},extra||{});
    Object.keys(payload).forEach(k=>{if(payload[k]==null)delete payload[k];});
    try{await fetch(`${SUPABASE_URL}/rest/v1/${TABLE}`,{method:'POST',keepalive:true,
      headers:{'Content-Type':'application/json','apikey':ANON_KEY,'Authorization':'Bearer '+ANON_KEY,'Prefer':'return=minimal'},
      body:JSON.stringify(payload)});}catch(_){}
  }

  /* ── Page view ──────────────────────────────────────────────── */
  function trackPageView(){sessionStorage.setItem('_kl_pst',Date.now().toString());track('pageview');}

  /* ── Performance monitoring ─────────────────────────────────── */
  function trackPerformance(){
    // Navigation Timing
    window.addEventListener('load',function(){
      setTimeout(function(){
        try{
          const nav=performance.getEntriesByType('navigation')[0];
          if(!nav)return;
          const perf={
            ttfb:         Math.round(nav.responseStart - nav.requestStart),
            page_load:    Math.round(nav.loadEventEnd - nav.startTime),
            dom_ready:    Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            dns_time:     Math.round(nav.domainLookupEnd - nav.domainLookupStart),
            tcp_time:     Math.round(nav.connectEnd - nav.connectStart),
            server_time:  Math.round(nav.responseEnd - nav.responseStart),
            transfer_size:nav.transferSize||null,
          };
          track('performance', perf);
        }catch(_){}
      }, 100);
    },{once:true});

    // Web Vitals via PerformanceObserver
    if('PerformanceObserver' in window){
      // LCP
      try{new PerformanceObserver(list=>{
        const e=list.getEntries().pop();
        if(e)track('web_vital',{vital_name:'LCP',vital_value:Math.round(e.startTime),vital_rating:e.startTime<2500?'good':e.startTime<4000?'needs-improvement':'poor'});
      }).observe({type:'largest-contentful-paint',buffered:true});}catch(_){}

      // CLS
      try{let cls=0;new PerformanceObserver(list=>{
        list.getEntries().forEach(e=>{if(!e.hadRecentInput)cls+=e.value;});
      }).observe({type:'layout-shift',buffered:true});
      window.addEventListener('pagehide',()=>{
        track('web_vital',{vital_name:'CLS',vital_value:parseFloat(cls.toFixed(4)),vital_rating:cls<0.1?'good':cls<0.25?'needs-improvement':'poor'});
      });}catch(_){}

      // FID / INP
      try{new PerformanceObserver(list=>{
        list.getEntries().forEach(e=>{
          track('web_vital',{vital_name:'FID',vital_value:Math.round(e.processingStart-e.startTime),vital_rating:e.processingStart-e.startTime<100?'good':e.processingStart-e.startTime<300?'needs-improvement':'poor'});
        });
      }).observe({type:'first-input',buffered:true});}catch(_){}

      // FCP
      try{new PerformanceObserver(list=>{
        const e=list.getEntries().find(e=>e.name==='first-contentful-paint');
        if(e)track('web_vital',{vital_name:'FCP',vital_value:Math.round(e.startTime),vital_rating:e.startTime<1800?'good':e.startTime<3000?'needs-improvement':'poor'});
      }).observe({type:'paint',buffered:true});}catch(_){}
    }
  }

  /* ── Error tracking ─────────────────────────────────────────── */
  function initErrorTracking(){
    // JS errors
    window.addEventListener('error',function(e){
      track('error',{
        error_type:'js_error',
        error_message:(e.message||'').slice(0,500),
        error_source:e.filename||null,
        error_line:e.lineno||null,
        error_col:e.colno||null,
        error_stack:e.error?.stack?.slice(0,1000)||null,
      });
    });
    // Unhandled promise rejections
    window.addEventListener('unhandledrejection',function(e){
      const msg=e.reason?.message||String(e.reason)||'Unhandled rejection';
      track('error',{error_type:'promise_rejection',error_message:msg.slice(0,500),error_stack:e.reason?.stack?.slice(0,1000)||null});
    });
    // Broken resources (images, scripts, stylesheets)
    document.addEventListener('error',function(e){
      const el=e.target;
      if(!['IMG','SCRIPT','LINK','SOURCE'].includes(el?.tagName))return;
      const src=el.src||el.href||null;
      track('error',{error_type:'broken_resource',error_message:`Failed to load ${el.tagName.toLowerCase()}: ${src}`,error_source:src});
    },true);
  }

  /* ── Scroll depth ───────────────────────────────────────────── */
  (function(){const fired=new Set();window.addEventListener('scroll',function(){const pct=Math.round(((window.scrollY+window.innerHeight)/Math.max(document.documentElement.scrollHeight,1))*100);[25,50,75,100].forEach(m=>{if(pct>=m&&!fired.has(m)){fired.add(m);track('scroll',{scroll_depth:m});}});},{passive:true});})();

  /* ── Hover heatmap ──────────────────────────────────────────── */
  (function(){let n=0;const b=[];function flush(){if(!b.length)return;const i=[...b];b.length=0;i.forEach(({x,y})=>track('hover',{hover_x:x,hover_y:y}));}
  const fd=debounce(flush,2000);
  document.addEventListener('mousemove',function(e){n++;if(n%HOVER_SAMPLE!==0)return;const pH=Math.max(document.body.scrollHeight,1);b.push({x:Math.round((e.clientX/window.innerWidth)*100),y:Math.round(((e.clientY+window.scrollY)/pH)*100)});if(b.length>=20)flush();else fd();},{passive:true});})();

  /* ── Clicks ─────────────────────────────────────────────────── */
  document.addEventListener('click',function(e){
    const el=e.target.closest('a,button,[data-kl],[data-kl-goal],[data-kl-purchase]');if(!el)return;
    const goalName=el.getAttribute('data-kl-goal')||null;const isPurchase=el.hasAttribute('data-kl-purchase');
    const propsRaw=el.getAttribute('data-kl-props');let props={},revenue=null,currency=null,product_name=null;
    if(propsRaw){try{props=JSON.parse(propsRaw);}catch(_){}}
    if(isPurchase){revenue=props.revenue||null;currency=props.currency||'USD';product_name=props.product||null;}
    const pH=Math.max(document.body.scrollHeight,1);
    const extra={element_tag:el.tagName.toLowerCase(),element_id:el.id||null,element_text:(el.textContent||'').trim().slice(0,120),click_x:Math.round((e.clientX/window.innerWidth)*100),click_y:Math.round(((e.clientY+window.scrollY)/pH)*100),event_properties:Object.keys(props).length?JSON.stringify(props):null};
    if(isPurchase)track('purchase',{...extra,revenue,currency,product_name,goal_name:'purchase'});
    if(goalName)track('goal',{...extra,goal_name:goalName});
    track('click',extra);
  },{passive:true,capture:true});

  /* ── Form analytics ─────────────────────────────────────────── */
  (function(){const fd={};function gfid(f){return f.getAttribute('data-kl-form')||f.id||f.name||'form';}function gfn(f){return f.name||f.id||f.getAttribute('aria-label')||f.type||'field';}
  document.addEventListener('focusin',function(e){const f=e.target;if(!['INPUT','SELECT','TEXTAREA'].includes(f.tagName))return;const fm=f.closest('form');if(!fm)return;const fid=gfid(fm),fn=gfn(f);if(!fd[fid])fd[fid]={fields:{}};fd[fid].fields[fn]={focused:Date.now(),blurred:null,value_entered:false};},{passive:true});
  document.addEventListener('focusout',function(e){const f=e.target;if(!['INPUT','SELECT','TEXTAREA'].includes(f.tagName))return;const fm=f.closest('form');if(!fm)return;const fid=gfid(fm),fn=gfn(f);if(!fd[fid]?.fields[fn])return;const d=fd[fid].fields[fn];d.blurred=Date.now();d.value_entered=!!(f.value||'').trim();track('form_field',{form_id:fid,form_field:fn,time_on_field:d.blurred-d.focused,field_skipped:!d.value_entered,field_completed:d.value_entered});},{passive:true});})();

  /* ── Form submits ───────────────────────────────────────────── */
  document.addEventListener('submit',function(e){const f=e.target;const g=f.getAttribute('data-kl-goal')||(f.id?'form:'+f.id:'form_submit');track('goal',{goal_name:g,element_tag:'form',element_id:f.id||null});},{passive:true,capture:true});

  /* ── Search ─────────────────────────────────────────────────── */
  (function(){const S=['input[type=search]','input[name=q]','input[name=query]','input[name=search]','input[name=s]','input[data-kl-search]','input[placeholder*=search i]','input[placeholder*=find i]'];
  function a(i){if(i._kl)return;i._kl=true;i.addEventListener('keydown',function(e){if(e.key==='Enter'){const q=(i.value||'').trim();if(q)track('search',{search_query:q.slice(0,200)});}});}
  S.forEach(s=>document.querySelectorAll(s).forEach(a));new MutationObserver(()=>S.forEach(s=>document.querySelectorAll(s).forEach(a))).observe(document.body,{childList:true,subtree:true});})();

  /* ── Session end ────────────────────────────────────────────── */
  window.addEventListener('pagehide',function(){
    const ss=sessionStorage.getItem('_kl_sst'),ps=sessionStorage.getItem('_kl_pst');
    track('session_end',{duration:ss?Math.round((Date.now()-parseInt(ss,10))/1000):null,time_on_page:ps?Math.round((Date.now()-parseInt(ps,10))/1000):null});
  });

  /* ── SPA ────────────────────────────────────────────────────── */
  const _push=history.pushState.bind(history);history.pushState=function(){_push.apply(history,arguments);setTimeout(trackPageView,50);};window.addEventListener('popstate',()=>setTimeout(trackPageView,50));

  /* ── Utils ──────────────────────────────────────────────────── */
  function debounce(fn,ms){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};}

  /* ── Boot ───────────────────────────────────────────────────── */
  trackPerformance();
  initErrorTracking();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',trackPageView);
  else trackPageView();
})();
