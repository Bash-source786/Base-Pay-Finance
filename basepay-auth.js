/* BasePay account authentication and per-user cloud save bootstrap. */
(() => {
  'use strict';
  let client = null, user = null, activeUid = null, entering = null, generation = 0;
  let guest = false;
  function locked() { return document.body.classList.contains('bp-auth-locked'); }
  function requireLogin(note) {
    if (guest) return;
    document.body.classList.add('bp-auth-locked');
    panel();
    $('bp-auth-root').classList.remove('hide');
    setMode('signin');
    if (note) message(note, 'error');
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
      <section class="bp-auth-panel" role="dialog" aria-modal="true" aria-labelledby="bp-auth-title">
        <button type="button" class="bp-auth-close" id="bp-auth-close" aria-label="Close">✕</button>
        <span class="eyebrow">BasePay account</span>
        <h2 id="bp-auth-title">Sign in</h2>
        <p id="bp-auth-description" class="bp-auth-caption">Sign in with your email address.</p>
        <p id="bp-signup-email-note" class="bp-auth-caption hide" role="note">We’ll send you an email to verify your account. Please check your inbox, including your junk or spam folder, for the verification link.</p>
        <form id="bp-auth-form">
          <label for="bp-auth-email">Email address</label>
          <input id="bp-auth-email" type="email" autocomplete="email" required placeholder="you@example.com">
          <div id="bp-password-wrap">
            <label for="bp-auth-password">Password</label>
            <input id="bp-auth-password" type="password" autocomplete="current-password" minlength="6" required placeholder="Your password">
            <button id="bp-password-toggle" class="btn ghost" type="button" aria-controls="bp-auth-password" aria-pressed="false" style="margin:0 0 6px;padding:6px 10px;font-size:12px">Show password</button>
          </div>
          <button id="bp-auth-submit" class="btn primary" type="submit">Sign in</button>
        </form>
        <p id="bp-auth-message" role="status" aria-live="polite"></p>
        <div class="bp-auth-actions" id="bp-auth-actions">
          <button type="button" id="bp-auth-switch">Create an account</button>
          <button type="button" id="bp-auth-reset">Forgot password?</button>
        </div>
        <div id="bp-auth-signed-in" class="hide">
          <p>Signed in as <strong id="bp-auth-user"></strong></p>
          <button type="button" id="bp-auth-signout" class="btn ghost">Sign out</button>
        </div>
        <p class="bp-auth-caption">Sign in to save your lessons, achievements and simulator progress across devices.</p>
        <div id="bp-guest-option">
          <button type="button" id="bp-continue-guest" class="btn ghost block" aria-describedby="bp-guest-notice">Continue without signing in</button>
          <p id="bp-guest-notice" class="bp-auth-caption">Guest progress is saved only in this browser on this device. It is not transferable and will not sync or be available on other devices or browsers. Clearing browser data or using private browsing may erase it. Guest progress is separate from account progress and is not automatically transferred when you sign in.</p>
        </div>
      </section>`;
    document.body.appendChild(root);
    $('bp-auth-close').addEventListener('click', close);
    root.addEventListener('click', e => { if (e.target === root && !locked()) close(); });
    $('bp-auth-form').addEventListener('submit', submit);
    $('bp-password-toggle').addEventListener('click', () => {
      setPasswordVisible($('bp-auth-password').type === 'password');
    });
    $('bp-auth-switch').addEventListener('click', () => setMode(mode === 'signup' ? 'signin' : 'signup'));
    $('bp-auth-reset').addEventListener('click', () => setMode(mode === 'reset' ? 'signin' : 'reset'));
    $('bp-auth-signout').addEventListener('click', signOut);
    $('bp-continue-guest').addEventListener('click', continueAsGuest);
    return root;
  }
  let mode = 'signin';
  function continueAsGuest() {
    if (user || entering || mode === 'new-password') return;
    if (guest) { allowAccess(); return; }
    generation++;
    guest = true;
    try { window.basepayAnalyticsUser?.(null); } catch (_) {}
    const saved = window.BasePayCloud.activateGuest();
    window.basepayLoadGuestSave(saved);
    updateButtons();
    allowAccess();
  }
  function setPasswordVisible(visible) {
    const input = $('bp-auth-password'), toggle = $('bp-password-toggle');
    if (!input || !toggle) return;
    input.type = visible ? 'text' : 'password';
    toggle.textContent = visible ? 'Hide password' : 'Show password';
    toggle.setAttribute('aria-pressed', String(visible));
  }
  function setMode(next) {
    mode = next;
    setPasswordVisible(false);
    const signedIn = !!user && next !== 'new-password';
    $('bp-guest-option').classList.toggle('hide',!!user || next === 'new-password');
    $('bp-auth-title').textContent = signedIn ? 'Your account' : next === 'signup' ? 'Create an account' : next === 'reset' ? 'Reset your password' : next === 'new-password' ? 'Choose a new password' : 'Sign in';
    $('bp-auth-description').textContent = signedIn ? 'You are signed in to BasePay.' : next === 'reset' ? 'We will email you a password reset link.' : next === 'new-password' ? 'Enter your new password below.' : 'Use your email and password.';
    $('bp-signup-email-note').classList.toggle('hide',signedIn || next !== 'signup');
    $('bp-auth-form').classList.toggle('hide',signedIn);
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
    $('bp-auth-switch').textContent = next === 'signup' ? 'Already have an account? Sign in' : 'Create an account';
    $('bp-auth-reset').textContent = next === 'reset' ? 'Back to sign in' : 'Forgot password?';
    if (signedIn) $('bp-auth-user').textContent = user.email || 'BasePay user';
    message('');
  }
  function close() { if (locked()) return; setPasswordVisible(false); const root = $('bp-auth-root'); if (root) root.classList.add('hide'); }
  window.openBasePayAuth = () => {
    panel();
    $('bp-auth-root').classList.remove('hide');
    setMode('signin');
    if (!client) message('Sign-in service is temporarily unavailable. Please try refreshing this page.', 'error');
    else if (!user) $('bp-auth-email').focus();
  };
  async function submit(event) {
    event.preventDefault();
    if (!client) { message('Supabase connection has not been configured yet.', 'error'); return; }
    const email = $('bp-auth-email').value.trim();
    const password = $('bp-auth-password').value;
    setPasswordVisible(false);
    const button = $('bp-auth-submit');
    button.disabled = true;
    message('Please wait…');
    try {
      let result;
      if (mode === 'new-password') result = await client.auth.updateUser({password});
      else if (mode === 'signup') result = await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin + location.pathname}});
      else if (mode === 'reset') result = await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin + location.pathname});
      else result = await client.auth.signInWithPassword({email,password});
      if (result.error) throw result.error;
      if (mode === 'new-password') { mode = 'signin'; enterAccount(user); }
      else if (mode === 'reset') message('If an account exists for that email, a reset link has been sent. Please check your inbox and your junk or spam folder.');
      else if (mode === 'signup' && !result.data.session) message('Verification email sent. Please check your inbox and your junk or spam folder for the verification link, then sign in.');
      else { message('Signed in successfully.'); if (mode === 'signup') setMode('signin'); }
    } catch (error) {
      const emailLimit = error.code === 'over_email_send_rate_limit' || /email.*rate.*limit/i.test(error.message || '');
      message(emailLimit
        ? 'BasePay has temporarily reached its email-sending limit. Please wait before requesting another verification or reset email. Changing your email address may not help. If your account is already verified, you can still sign in with your password.'
        : error.message || 'Authentication failed. Please try again.', 'error');
    }
    finally { button.disabled = false; }
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
    if (activeUid === current.id) { allowAccess(); return; }
    if (entering) return;
    guest = false;
    const expectedGeneration = generation, expectedId = current.id;
    document.body.classList.add('bp-auth-locked');
    panel();
    $('bp-auth-root').classList.remove('hide');
    message('Loading your saved progress…');
    entering = window.BasePayCloud.activate(current,client).then(save => {
      if (generation !== expectedGeneration || user?.id !== expectedId) return;
      activeUid = expectedId;
      window.basepayLoadAccountSave(save);
      allowAccess();
    }).catch(error => {
      console.error('BasePay account loading failed',error);
      if (generation === expectedGeneration) requireLogin(
        'Could not load your account progress. '+ (error.message || 'Please try again.'));
    }).finally(()=>{ entering = null; });
  }
  function init() {
    updateButtons();
    if (!configured()) { requireLogin('Sign-in configuration is unavailable. Please contact BasePay support.'); return; }
    if (!window.supabase || !window.supabase.createClient) { console.warn('BasePay: Supabase client failed to load'); requireLogin('Sign-in service could not load. Please refresh this page.'); return; }
    try {
      client = window.supabase.createClient(window.BASEPAY_SUPABASE_URL,window.BASEPAY_SUPABASE_PUBLISHABLE_KEY);
      client.auth.onAuthStateChange((event,session) => {
        user = session?.user || null;
        updateButtons();
        if (event === 'PASSWORD_RECOVERY') {
          document.body.classList.add('bp-auth-locked');
          panel();
          $('bp-auth-root').classList.remove('hide');
          setMode('new-password');
          return;
        }
        if (event === 'SIGNED_OUT') {
          clearAccount();
          return;
        }
        if (user && mode !== 'new-password') {
          // Schedule outside the Auth callback so data queries don't block Auth.
          setTimeout(() => enterAccount(user), 0);
        }
      });
      client.auth.getUser().then(({data,error}) => {
        if (error || !data.user) {
          if (!user) requireLogin();
        } else {
          user = data.user;
          updateButtons();
          if (mode !== 'new-password') enterAccount(user);
        }
      }).catch(() => requireLogin('Unable to verify your session. Please sign in.'));

    } catch (e) { console.warn('BasePay: Could not initialize authentication',e); requireLogin('Sign-in could not start. Please refresh this page.'); }
  }
  document.addEventListener('keydown',e=>{ if(e.key==='Escape' && !locked()) close(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',init);
  else init();
})();

