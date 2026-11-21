/* BasePay account authentication and per-user cloud save bootstrap. */
(() => {
  'use strict';
  let client = null, user = null, activeUid = null, entering = null, generation = 0;
  let guest = false;
  let submitting = false;
  let sentEmail = '', sentType = 'signup', cooldownTimer = null, returnFocus = null;
  const cooldowns = new Map();
  // Remember retry times without putting email addresses or passwords in storage.
  async function emailRequestKey(email, type) {
    const value = new TextEncoder().encode(type + ':' + email.trim().toLowerCase());
    const digest = await crypto.subtle.digest('SHA-256', value);
    return 'basepayEmailRetry:' + Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2,'0')).join('');
  }
  function retrySeconds(key) {
    let until = cooldowns.get(key) || 0;
    try { until = Math.max(until, Number(localStorage.getItem(key)) || 0); } catch (_) {}
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }
  function rememberRetry(key, seconds) {
    const until = Date.now() + seconds * 1000;
    cooldowns.set(key, until);
    try { localStorage.setItem(key, String(until)); } catch (_) {}
  }
  let activeRetryKey = null;
  function updateRetryControls() {
    const seconds = activeRetryKey ? retrySeconds(activeRetryKey) : 0;
    const sendingEmail = ['signup','reset'].includes(mode);
    const submit = $('bp-auth-submit'), resend = $('bp-auth-resend');
    if (submit) {
      submit.disabled = submitting || (sendingEmail && seconds > 0);
      submit.textContent = submitting ? 'Please wait…' : mode === 'signup' ? 'Create account'
        : mode === 'reset' ? 'Send reset link' : mode === 'new-password' ? 'Save new password' : 'Sign in';
    }
    if (resend) {
      resend.disabled = submitting || seconds > 0;
      resend.textContent = seconds > 0 ? 'Resend available in ' + seconds + 's' : 'Resend email';
    }
    const status = $('bp-auth-cooldown');
    if (status) status.textContent = seconds > 0 && (sendingEmail || mode === 'email-sent')
      ? 'Please wait ' + seconds + ' seconds before requesting another email.' : '';
    clearTimeout(cooldownTimer);
    if (seconds > 0) cooldownTimer = setTimeout(updateRetryControls,1000);
  }
  async function refreshRetryKey() {
    const currentMode = mode, email = $('bp-auth-email').value.trim();
    const type = mode === 'email-sent' ? sentType : mode;
    const key = ['signup','reset','email-sent'].includes(mode)
      ? await emailRequestKey(mode === 'email-sent' ? sentEmail : email,type) : null;
    if (currentMode !== mode || (mode !== 'email-sent' && email !== $('bp-auth-email').value.trim())) return;
    activeRetryKey = key;
    updateRetryControls();
  }
  function showPanel() {
    const root = panel();
    if (root.classList.contains('hide')) returnFocus = document.activeElement;
    root.classList.remove('hide');
    document.querySelector('.wrap').inert = true;
    $('bp-auth-title').focus();
  }
  function showEmailSent(email, type) {
    sentEmail = email;
    sentType = type;
    $('bp-auth-password').value = '';
    setMode('email-sent');
    $('bp-email-destination').textContent = email;
    $('bp-email-sent-description').textContent = type === 'reset'
      ? 'If an account uses this address, a password reset link is on its way. Open the email to choose a new password.'
      : 'Open the verification email and follow the link to finish creating your account.';
    $('bp-auth-title').focus();
  }
  function trackAuth(event, properties) {
    try { window.basepayTrack?.(event, properties); } catch (_) {}
  }
  function showAuthError(error, action) {
    const text = error.message || '';
    const limit = error.code === 'over_email_send_rate_limit' || /email.*rate.*limit|security purposes.*seconds/i.test(text);
    const wait = text.match(/after\s+(\d+)\s+seconds/i);
    const reason = limit || wait ? (wait ? 'email_cooldown' : 'email_rate_limit')
      : error.code === 'email_not_confirmed' ? 'email_unconfirmed'
      : error.code === 'email_address_not_authorized' ? 'email_address_not_authorized'
      : error.code === 'invalid_credentials' ? 'invalid_credentials'
      : 'other';
    trackAuth('auth_request_failed', {action, reason});
    if (wait && activeRetryKey) {
      rememberRetry(activeRetryKey,Number(wait[1]));
      message('An email was requested recently. You can request another in ' + wait[1] + ' seconds. Check your inbox and junk folder for the first email.','error');
    } else if (limit) {
      message('Email requests are temporarily limited. Please try again later. You can still sign in with a verified account or continue as a guest.','error');
    } else if (error.code === 'email_not_confirmed') {
      message('Please verify your email first. Check your inbox and junk folder, or use “Resend verification email” below.','error');
      $('bp-auth-verify').classList.remove('hide');
    } else {
      message(text || 'Could not connect. Check your connection and try again.','error');
    }
    updateRetryControls();
  }
  async function resendEmail() {
    if (submitting || !client) return;
    setSubmitting(true);
    const action = sentType === 'reset' ? 'reset_resend' : 'signup_resend';
    try {
      activeRetryKey = await emailRequestKey(sentEmail,sentType);
      if (retrySeconds(activeRetryKey)) { updateRetryControls(); return; }
      trackAuth('auth_request_started', {action});
      const result = sentType === 'reset'
        ? await client.auth.resetPasswordForEmail(sentEmail,{redirectTo:location.origin + location.pathname})
        : await client.auth.resend({type:'signup',email:sentEmail,options:{emailRedirectTo:location.origin + location.pathname}});
      if (result.error) throw result.error;
      trackAuth('auth_email_resend_accepted', {action});
      rememberRetry(activeRetryKey,60);
      message('Email requested. Please check your inbox and junk folder.');
    } catch (error) { showAuthError(error, action); }
    finally { setSubmitting(false); }
  }
  function setSubmitting(value) {
    submitting = value;
    for (const id of ['bp-auth-submit','bp-auth-switch','bp-auth-reset','bp-continue-guest','bp-auth-resend','bp-auth-change-email','bp-auth-verify']) {
      const el = $(id);
      if (el) el.disabled = value;
    }
    if ($('bp-auth-email')) $('bp-auth-email').disabled=value || mode==='new-password';
    if ($('bp-auth-password')) $('bp-auth-password').disabled=value || mode==='reset';
    $('bp-auth-form')?.setAttribute('aria-busy',String(value));
    updateRetryControls();
  }
  function locked() { return document.body.classList.contains('bp-auth-locked'); }
  function requireLogin(note) {
    if (guest) return;
    document.body.classList.add('bp-auth-locked');
    showPanel();
    setMode('signin');
    const {damaged, issue} = window.BasePayCloud.readGuestSave();
    const notice = [note, damaged ? issue : ''].filter(Boolean).join(' ');
    if (notice) message(notice, 'error');
  }
  function allowAccess() {
    document.body.classList.remove('bp-auth-locked');
    close();
  }
  const $ = id => document.getElementById(id);
  function configured() {
    return !!(window.BASEPAY_SUPABASE_URL && window.BASEPAY_SUPABASE_PUBLISHABLE_KEY);
  }
  function message(value, kind='') {
    const el = $('bp-auth-message');
    if (!el) return;
    el.textContent = value || '';
    el.dataset.kind = kind;
    el.style.color = kind === 'error' ? 'var(--red)' : 'var(--text-dim)';
  }
  function updateButtons() {
    for (const id of ['bp-account-landing','bp-account-app']) {
      const el = $(id);
      if (el) el.textContent = user ? 'My account' : 'Sign in';
    }
  }
  function panel() {
    let root = $('bp-auth-root');
    if (root) return root;
    root = document.createElement('div');
    root.id = 'bp-auth-root';
    root.className = 'bp-auth-backdrop hide';
    root.innerHTML = `
      <section class="bp-auth-panel" role="dialog" aria-modal="true" aria-labelledby="bp-auth-title" aria-describedby="bp-auth-description">
        <button type="button" class="bp-auth-close" id="bp-auth-close" aria-label="Close">✕</button>
        <div class="bp-auth-brand"><img src="/assets/basepay-icon-bw.svg" alt="" width="54" height="54"><span>BasePay</span></div>
        <p class="bp-auth-caption">Build confidence with money, one decision at a time.</p>
        <h2 id="bp-auth-title" tabindex="-1">Sign in</h2>
        <p id="bp-auth-description" class="bp-auth-caption">Sign in with your email address.</p>
        <p id="bp-signup-email-note" class="bp-auth-caption hide" role="note">We’ll send you an email to verify your account. Please check your inbox, including your junk or spam folder, for the verification link.</p>
        <form id="bp-auth-form">
          <label for="bp-auth-email">Email address</label>
          <input id="bp-auth-email" type="email" autocomplete="email" required placeholder="you@example.com">
          <div id="bp-password-wrap">
            <label for="bp-auth-password">Password</label>
            <div class="bp-password-field"><input id="bp-auth-password" type="password" autocomplete="current-password" minlength="6" required placeholder="Your password">
            <button id="bp-password-toggle" class="btn ghost" type="button" aria-label="Show password" aria-controls="bp-auth-password" aria-pressed="false">Show</button></div>
          </div>
          <button id="bp-auth-submit" class="btn primary" type="submit">Sign in</button>
        </form>
        <section id="bp-email-sent" class="hide" aria-label="Email confirmation">
          <strong id="bp-email-destination"></strong>
          <p id="bp-email-sent-description"></p>
          <p>Please check your junk or spam folder too.</p>
          <button type="button" class="btn block" id="bp-auth-resend">Resend email</button>
          <button type="button" class="btn ghost block" id="bp-auth-change-email">Use a different email</button>
        </section>
        <p id="bp-auth-cooldown" aria-live="off"></p>
        <p id="bp-auth-message" role="status" aria-live="polite"></p>
        <div class="bp-auth-actions" id="bp-auth-actions">
          <button type="button" id="bp-auth-switch">Create an account</button>
          <button type="button" id="bp-auth-reset">Forgot password?</button>
          <button type="button" id="bp-auth-verify" class="hide">Resend verification email</button>
        </div>
        <div id="bp-auth-signed-in" class="hide">
          <p>Signed in as <strong id="bp-auth-user"></strong></p>
          <button type="button" id="bp-auth-signout" class="btn ghost">Sign out</button>
        </div>
        <p class="bp-auth-caption">Sign in to save your lessons, achievements and simulator progress across devices.</p>
        <div id="bp-guest-option">
          <button type="button" id="bp-continue-guest" class="btn ghost block" aria-describedby="bp-guest-notice">Continue without signing in</button>
          <p id="bp-guest-notice" class="bp-auth-caption">Guest progress stays in this browser on this device. Clearing browser data can erase it. It cannot transfer to an account or another device.</p>
        </div>
        <footer class="footer-note">
          <p>BasePay is an educational simulation. It is not financial advice.</p>
          <nav aria-label="Privacy">
            <a href="privacy.html">Privacy</a>
          </nav>
        </footer>
      </section>`;
    document.body.appendChild(root);
    $('bp-auth-close').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root && !locked()) close(); });
    $('bp-auth-form').addEventListener('submit', submit);
    $('bp-auth-email').addEventListener('input', () => {
      $('bp-auth-verify').classList.add('hide');
      refreshRetryKey();
    });
    $('bp-auth-resend').addEventListener('click',resendEmail);
    $('bp-auth-change-email').addEventListener('click',()=>{
      setMode(sentType === 'reset' ? 'reset' : 'signup');
      $('bp-auth-email').focus();
    });
    $('bp-auth-verify').addEventListener('click',()=>{
      showEmailSent($('bp-auth-email').value.trim(),'signup');
    });
    $('bp-password-toggle').addEventListener('click', () => {
      setPasswordVisible($('bp-auth-password').type === 'password');
    });
    $('bp-auth-switch').addEventListener('click', () => setMode(['signup','email-sent'].includes(mode) ? 'signin' : 'signup'));
    $('bp-auth-reset').addEventListener('click', () => setMode(mode === 'reset' ? 'signin' : 'reset'));
    $('bp-auth-signout').addEventListener('click', signOut);
    $('bp-continue-guest').addEventListener('click', () => {
      if (continueAsGuest()) trackAuth('guest_entered');
    });
    return root;
  }
  let mode = 'signin';
  function continueAsGuest() {
    if (submitting || user || entering || mode === 'new-password') return;
    if (guest) { allowAccess(); return; }
    generation++;
    guest = true;
    try { window.basepayAnalyticsUser?.(null); } catch (_) {}
    const result = window.BasePayCloud.activateGuest();
    window.basepayLoadGuestSave(result);
    updateButtons();
    allowAccess();
    $(result.save ? 'app-main' : 'mode-title').focus();
    return true;
  }
  function setPasswordVisible(visible) {
    const input = $('bp-auth-password'), toggle = $('bp-password-toggle');
    if (!input || !toggle) return;
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide' : 'Show';
    toggle.setAttribute('aria-label',visible ? 'Hide password' : 'Show password');
    toggle.setAttribute('aria-pressed', String(visible));
  }
  function setMode(next) {
    const previous = mode;
    mode = next;
    if (next === 'signup' && previous !== next) trackAuth('signup_viewed');
    setPasswordVisible(false);
    const signedIn = !!user && next !== 'new-password';
    const emailSent = next === 'email-sent';
    $('bp-guest-option').classList.toggle('hide',!!user || next === 'new-password');
    $('bp-auth-title').textContent = signedIn ? 'Your account' : next === 'signup' ? 'Create an account' : next === 'reset' ? 'Reset your password' : next === 'new-password' ? 'Choose a new password' : emailSent ? 'Check your email' : 'Welcome back';
    $('bp-auth-description').textContent = signedIn ? 'You are signed in to BasePay.' : next === 'reset' ? 'We will email you a password reset link.' : next === 'new-password' ? 'Enter your new password below.' : emailSent ? 'Your next step is in your inbox.' : next === 'signup' ? 'Save your learning and simulation progress across devices.' : 'Sign in to pick up where you left off.';
    $('bp-signup-email-note').classList.toggle('hide',signedIn || next !== 'signup');
    $('bp-auth-form').classList.toggle('hide',signedIn || emailSent);
    $('bp-email-sent').classList.toggle('hide',!emailSent);
    $('bp-auth-verify').classList.add('hide');
    $('bp-auth-actions').classList.toggle('hide',signedIn || next === 'new-password');
    $('bp-auth-signed-in').classList.toggle('hide',!signedIn);
    $('bp-password-wrap').classList.toggle('hide',next === 'reset');
    $('bp-auth-email').parentElement.querySelector('label[for="bp-auth-email"]').classList.toggle('hide',next === 'new-password');
    $('bp-auth-email').classList.toggle('hide',next === 'new-password');
    $('bp-auth-email').required = next !== 'new-password';
    $('bp-auth-password').required = next !== 'reset';
    $('bp-auth-password').disabled = next === 'reset';
    $('bp-auth-email').disabled = next === 'new-password';
    $('bp-auth-password').autocomplete = (next === 'signup' || next === 'new-password') ? 'new-password' : 'current-password';
    $('bp-auth-submit').textContent = next === 'signup' ? 'Create account' : next === 'reset' ? 'Send reset link' : next === 'new-password' ? 'Save new password' : 'Sign in';
    $('bp-auth-switch').textContent = (next === 'signup' || emailSent) ? 'Already have an account? Sign in' : 'Create an account';
    $('bp-auth-reset').classList.toggle('hide',emailSent);
    $('bp-auth-reset').textContent = next === 'reset' ? 'Back to sign in' : 'Forgot password?';
    if (signedIn) $('bp-auth-user').textContent = user.email || 'BasePay user';
    message('');
    refreshRetryKey();
  }
  function close() {
    if (locked()) return;
    setPasswordVisible(false);
    const root = $('bp-auth-root');
    if (root) root.classList.add('hide');
    document.querySelector('.wrap').inert = false;
    if (returnFocus?.isConnected && !returnFocus.closest('.hide')) returnFocus.focus();
    returnFocus = null;
  }
  window.openBasePayAuth = () => {
    showPanel();
    setMode('signin');
    if (!client) message('Sign-in service is temporarily unavailable. Please try refreshing this page.', 'error');
    else if (!user) $('bp-auth-email').focus();
  };
  async function submit(event) {
    event.preventDefault();
    if (submitting) return;
    if (!client) { message('Supabase connection has not been configured yet.', 'error'); return; }
    const email = $('bp-auth-email').value.trim();
    const password = $('bp-auth-password').value;
    setPasswordVisible(false);
    const submittedMode = mode;
    setSubmitting(true);
    message('Please wait…');
    try {
      if (['signup','reset'].includes(submittedMode)) {
        activeRetryKey = await emailRequestKey(email,submittedMode);
        const remaining = retrySeconds(activeRetryKey);
        if (remaining) {
          message('An email was requested recently. Please check your inbox and wait before trying again.');
          return;
        }
      }
      trackAuth('auth_request_started', {action: submittedMode});
      let result;
      if (submittedMode === 'new-password') result = await client.auth.updateUser({password});
      else if (submittedMode === 'signup') result = await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin + location.pathname}});
      else if (submittedMode === 'reset') result = await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin + location.pathname});
      else result = await client.auth.signInWithPassword({email,password});
      if (result.error) throw result.error;
      try {
        if (submittedMode === 'signin' && result.data?.user) {
          window.basepayAnalyticsUser?.(result.data.user.id);
          window.basepayTrack?.('sign_in_succeeded');
        } else if (submittedMode === 'signup') {
          trackAuth('signup_submitted');
          if (result.data?.session) trackAuth('signup_account_ready');
        }
      } catch (_) {}
      if (submittedMode === 'new-password') { $('bp-auth-password').value = ''; mode = 'signin'; enterAccount(user); }
      else if (submittedMode === 'reset' || (submittedMode === 'signup' && !result.data.session)) {
        rememberRetry(activeRetryKey,60);
        showEmailSent(email,submittedMode);
      }
      else { $('bp-auth-password').value = ''; message('Signed in successfully.'); if (submittedMode === 'signup') setMode('signin'); }
    } catch (error) {
      showAuthError(error, submittedMode);
    }
    finally { setSubmitting(false); }
  }
  async function signOut() {
    if (!client) return;
    try {
      await window.BasePayCloud.beforeSignOut();
      const {error} = await client.auth.signOut();
      if (error) throw error;
      clearAccount();
    } catch (error) { message(error.message || 'Sign-out failed.','error'); }
  }
  function clearAccount(){
    try {
      if (activeUid) window.basepayTrack?.('sign_out_succeeded');
      window.basepayAnalyticsUser?.(null);
    } catch (_) {}
    guest = false;
    generation++;
    activeUid = null; entering = null; user = null;
    window.BasePayCloud?.logout();
    window.basepayClearForSignOut?.();
    updateButtons();
    requireLogin();
  }
  function enterAccount(current){
    if (!current) return;
    try { window.basepayAnalyticsUser?.(current.id); } catch (_) {}
    if (activeUid === current.id) { allowAccess(); return; }
    if (entering) return;
    guest = false;
    const expectedGeneration = generation, expectedId = current.id;
    document.body.classList.add('bp-auth-locked');
    showPanel();
    message('Loading your saved progress…');
    entering = window.BasePayCloud.activate(current,client).then(slots => {
      if (generation !== expectedGeneration || user?.id !== expectedId) return;
      activeUid = expectedId;
      allowAccess();
      window.basepayLoadAccountFiles(slots);
      trackAuth('account_entered');
    }).catch(error => {
      console.error('BasePay account loading failed',error);
      if (generation === expectedGeneration) requireLogin(
        'Could not load your account progress. '+ (error.message || 'Please try again.'));
    }).finally(()=>{ entering = null; });
  }
  function enterGuestOrRequireLogin(note) {
    if (user || mode === 'new-password') return;
    if (window.BasePayCloud.readGuestSave().save) continueAsGuest();
    else requireLogin(note);
  }
  function init() {
    if (window.BasePayCloud.takeGuestRestart()) continueAsGuest();
    updateButtons();
    if (!configured()) { enterGuestOrRequireLogin('Sign-in configuration is unavailable. Please contact BasePay support.'); return; }
    if (!window.supabase || !window.supabase.createClient) { console.warn('BasePay: Supabase client failed to load'); enterGuestOrRequireLogin('Sign-in service could not load. Please refresh this page.'); return; }
    try {
      // The implicit signup callback contains the token before Supabase clears the URL.
      // Match the authenticated session to that callback to exclude restored sessions.
      const callback = new URLSearchParams(location.hash.slice(1));
      let signupToken = callback.get('type') === 'signup' ? callback.get('access_token') : null;
      client = window.supabase.createClient(window.BASEPAY_SUPABASE_URL,window.BASEPAY_SUPABASE_PUBLISHABLE_KEY);
      client.auth.onAuthStateChange((event,session) => {
        const hadAccount = !!(user || activeUid || entering);
        user = session?.user || null;
        updateButtons();
        if (signupToken && session?.access_token === signupToken && user?.email_confirmed_at) {
          signupToken = null;
          try { window.basepayAnalyticsUser?.(user.id); } catch (_) {}
          trackAuth('signup_account_ready');
        }
        if (event === 'PASSWORD_RECOVERY') {
          document.body.classList.add('bp-auth-locked');
          showPanel();
          setMode('new-password');
          return;
        }
        if (event === 'SIGNED_OUT') {
          if (hadAccount) clearAccount();
          else enterGuestOrRequireLogin();
          return;
        }
        if (user && mode !== 'new-password') {
          // Schedule outside the Auth callback so data queries don't block Auth.
          setTimeout(() => enterAccount(user), 0);
        }
      });
      client.auth.getUser().then(({data,error}) => {
        if (error || !data.user) {
          enterGuestOrRequireLogin();
        } else {
          user = data.user;
          updateButtons();
          if (mode !== 'new-password') enterAccount(user);
        }
      }).catch(() => enterGuestOrRequireLogin('Unable to verify your session. Please sign in.'));

    } catch (e) { console.warn('BasePay: Could not initialize authentication',e); enterGuestOrRequireLogin('Sign-in could not start. Please refresh this page.'); }
  }
  document.addEventListener('keydown',event=>{
    const root=$('bp-auth-root');
    if (!root || root.classList.contains('hide')) return;
    if (event.key === 'Escape' && !locked()) close();
    if (event.key !== 'Tab') return;
    const controls=Array.from(root.querySelectorAll('button:not(:disabled),input:not(:disabled),a[href]'))
      .filter(control=>control.getClientRects().length > 0);
    const first=controls[0], last=controls[controls.length-1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === $('bp-auth-title'))) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault(); first?.focus();
    }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();


