(() => {
  const config = window.BASEPAY_ANALYTICS_CONFIG;
  if (!config?.token || !config?.host) return;
  const key = 'basepay-analytics-consent';
  let consent = null, loading = false, ready = false, queue = [];
  try { consent = localStorage.getItem(key); } catch (_) {}
  const allowed = new Set(['simulator_started','simulator_resumed','section_viewed','lesson_started','lesson_step_viewed','quiz_answered','lesson_completed']);
  window.basepayTrack = (event, properties = {}) => {
    if (consent !== 'yes' || !allowed.has(event)) return;
    const safe = {};
    for (const name of ['section','lesson_id','step','correct']) {
      if (['string','number','boolean'].includes(typeof properties[name])) safe[name] = properties[name];
    }
    try {
      if (ready) window.posthog.capture(event, safe);
      else if (queue.length < 30) queue.push([event,safe]);
    } catch (_) {}
  };
  function start() {
    if (loading || ready || consent !== 'yes') return;
    loading = true;
    const script = document.createElement('script');
    script.async = true;
    script.src = config.host.replace('.i.posthog.com','-assets.i.posthog.com') + '/static/array.js';
    script.onerror = () => { loading = false; queue = []; script.remove(); };
    script.onload = () => {
      loading = false;
      if (consent !== 'yes') return;
      try {
        window.posthog.init(config.token, {
          api_host: config.host, defaults: '2026-08-30',
          autocapture: false, capture_pageview: true, capture_pageleave: false,
          disable_session_recording: true, disable_surveys: true,
          capture_exceptions: false, person_profiles: 'never',
          persistence: 'localStorage', ip: false,
          before_send: event => {
            if (consent !== 'yes') return null;
            if (event?.properties) {
              event.properties.$current_url = location.origin + location.pathname;
              delete event.properties.$referrer;
              delete event.properties.$initial_referrer;
              delete event.properties.$set;
              delete event.properties.$set_once;
            }
            return event;
          },
          loaded: client => {
            ready = true;
            if (consent !== 'yes') { client.opt_out_capturing(); queue = []; return; }
            client.opt_in_capturing({captureEventName:false});
            queue.splice(0).forEach(([event,props]) => client.capture(event,props));
          }
        });
      } catch (_) { queue = []; }
    };
    document.head.appendChild(script);
  }
  function choose(value) {
    consent = value;
    try { localStorage.setItem(key,value); } catch (_) {}
    document.getElementById('analytics-choice').hidden = true;
    if (value === 'yes') {
      if (ready) window.posthog.opt_in_capturing({captureEventName:false});
      else start();
    } else {
      queue = [];
      if (ready) window.posthog.opt_out_capturing();
    }
  }
  const panel = document.createElement('aside');
  panel.id = 'analytics-choice';
  panel.setAttribute('aria-label','Analytics preferences');
  panel.style.cssText = 'position:fixed;bottom:82px;left:12px;right:12px;max-width:520px;margin:auto;z-index:150;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 4px 24px #0005';
  panel.innerHTML = '<strong>Help improve BasePay?</strong><p style="margin:8px 0;font-size:12px">Allow PostHog analytics to measure visits and lesson progress. We do not send your financial inputs or record your screen. Change this choice anytime.</p><div class="btn-row"><button class="btn" id="analytics-decline">No thanks</button><button class="btn" id="analytics-accept">Allow analytics</button></div>';
  panel.hidden = consent !== null;
  document.body.appendChild(panel);
  document.getElementById('analytics-decline').onclick = () => choose('no');
  document.getElementById('analytics-accept').onclick = () => choose('yes');
  const settings = document.createElement('button');
  settings.className = 'btn sm';
  settings.textContent = 'Analytics preferences';
  settings.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:40;font-size:10px';
  settings.onclick = () => { panel.hidden = false; };
  document.body.appendChild(settings);
  start();
})();
