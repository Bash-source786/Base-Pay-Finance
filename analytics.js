(() => {
  const config = window.BASEPAY_ANALYTICS_CONFIG;
  if (!config?.token || !config?.host) return;
  const key = 'basepay-analytics-consent';
  let consent = null, loading = false, ready = false, queue = [];
  let userId = null, identifiedId = null;
  function identify() {
    if (!ready || consent !== 'yes' || !userId || identifiedId === userId) return;
    window.posthog.identify(userId);
    identifiedId = userId;
  }
  // Keep only the account UUID in memory; never send email or auth credentials.
  window.basepayAnalyticsUser = id => {
    const next = typeof id === 'string' && id ? id : null;
    if (next === userId) return;
    if (userId || !next) {
      queue = [];
      if (ready) { try { window.posthog.reset(); } catch (_) {} }
      identifiedId = null;
    }
    userId = next;
    try { identify(); } catch (_) {}
  };
  try { consent = localStorage.getItem(key); } catch (_) {}
  const allowed = new Set([
    'signup_viewed', 'auth_request_started', 'auth_request_failed', 'auth_email_resend_accepted',
    'signup_submitted', 'signup_account_ready', 'sign_in_succeeded', 'sign_out_succeeded',
    'guest_entered', 'account_entered', 'simulator_started', 'simulator_resumed',
    'section_viewed', 'lesson_started', 'lesson_step_viewed', 'quiz_answered', 'lesson_completed'
  ]);
  const authActions = new Set(['signup', 'signin', 'reset', 'new-password', 'signup_resend', 'reset_resend']);
  const authReasons = new Set([
    'email_cooldown', 'email_rate_limit', 'email_unconfirmed',
    'email_address_not_authorized', 'invalid_credentials', 'other'
  ]);
  window.basepayTrack = (event, properties = {}) => {
    if (consent !== 'yes' || !allowed.has(event)) return;
    const safe = {};
    for (const name of ['section','lesson_id','step','correct']) {
      if (['string','number','boolean'].includes(typeof properties[name])) safe[name] = properties[name];
    }
    if (authActions.has(properties.action)) safe.action = properties.action;
    if (authReasons.has(properties.reason)) safe.reason = properties.reason;
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
          autocapture: false, capture_pageview: false, capture_pageleave: false,
          disable_session_recording: true, disable_surveys: true,
          capture_exceptions: false, person_profiles: 'identified_only',
          persistence: 'localStorage', ip: false,
          before_send: event => {
            if (consent !== 'yes') return null;
            if (event?.properties) {
              event.properties.$current_url = location.origin + location.pathname;
              for (const property of Object.keys(event.properties)) {
                if (property !== '$current_url' && /url|referrer/i.test(property)) {
                  delete event.properties[property];
                }
              }
              delete event.properties.$set;
              delete event.properties.$set_once;
            }
            return event;
          },
          loaded: client => {
            ready = true;
            if (consent !== 'yes') { client.opt_out_capturing(); queue = []; return; }
            client.opt_in_capturing({captureEventName:false});
            const storedUserId = client.get_property('$user_id');
            if (storedUserId && storedUserId !== userId) client.reset();
            identifiedId = null;
            identify();
            client.capture('$pageview');
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
      if (ready) { window.posthog.opt_in_capturing({captureEventName:false}); identify(); }
      else start();
    } else {
      queue = [];
      if (ready) { window.posthog.reset(); window.posthog.opt_out_capturing(); }
      identifiedId = null;
    }
  }
  const panel = document.createElement('aside');
  panel.id = 'analytics-choice';
  panel.setAttribute('aria-label','Analytics preferences');
  panel.style.cssText = 'position:fixed;bottom:82px;left:12px;right:12px;max-width:520px;margin:auto;z-index:2100;background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;box-shadow:0 4px 24px #0005';
  panel.innerHTML = '<strong>Help improve BasePay?</strong><p style="margin:8px 0;font-size:12px">Allow PostHog analytics to measure visits, account steps, sign-in errors and lesson progress, linked across devices using your account ID. We do not send your email, password or financial inputs, or record your screen. Change this choice anytime.</p><div class="btn-row"><button class="btn" id="analytics-decline">No thanks</button><button class="btn" id="analytics-accept">Allow analytics</button></div>';
  panel.hidden = consent !== null;
  document.body.appendChild(panel);
  document.getElementById('analytics-decline').onclick = () => choose('no');
  document.getElementById('analytics-accept').onclick = () => choose('yes');
  const settings = document.createElement('button');
  settings.className = 'btn sm';
  settings.textContent = 'Analytics preferences';
  settings.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:2101;font-size:10px';
  settings.onclick = () => { panel.hidden = false; };
  document.body.appendChild(settings);
  start();
})();

