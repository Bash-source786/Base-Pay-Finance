/* BasePay authentication: Supabase manages credentials and sessions. No passwords are stored here. */
(() => {
  const config = window.BASEPAY_AUTH_CONFIG;
  const $ = (id) => document.getElementById(id);
  const css = document.createElement('style');
  css.textContent = `
  #bp-account{position:fixed;top:12px;left:12px;z-index:90;padding:7px 12px;background:var(--surface,#141a28);border:1px solid var(--border,#252d42);color:var(--text,#fff);border-radius:20px;cursor:pointer;font:12px system-ui}
  #bp-auth-overlay{position:fixed;inset:0;z-index:1000;background:#000b;display:flex;align-items:center;justify-content:center;padding:18px}
  #bp-auth-overlay[hidden]{display:none}
  #bp-auth-panel{background:var(--surface,#141a28);color:var(--text,#fff);border:1px solid var(--border,#252d42);border-radius:16px;width:min(100%,390px);padding:24px;box-shadow:0 12px 60px #0006;font:14px system-ui}
  #bp-auth-panel h2{font-size:20px;margin:0 0 8px}#bp-auth-panel p{color:var(--text-dim,#aaa)}
  #bp-auth-panel input{width:100%;padding:12px;margin:8px 0;border-radius:9px;background:var(--bg,#0b0e15);color:var(--text,#fff);border:1px solid var(--border,#252d42);font:inherit}
  #bp-auth-panel button{padding:10px 14px;border-radius:9px;cursor:pointer;background:var(--green,#2fa872);border:0;color:#fff;font:inherit}
  #bp-auth-panel button:disabled{opacity:.6;cursor:wait}#bp-auth-close{float:right;background:transparent!important;color:inherit!important}
  #bp-auth-message{min-height:20px;margin-top:10px;overflow-wrap:anywhere}`;
  document.head.appendChild(css);
  const button = document.createElement('button');
  button.id = 'bp-account'; button.type='button'; button.textContent='Sign in';
  const overlay = document.createElement('div');
  overlay.id='bp-auth-overlay';overlay.hidden=true;
  overlay.innerHTML = `<div id="bp-auth-panel" role="dialog" aria-modal="true" aria-labelledby="bp-auth-title">
    <button type="button" id="bp-auth-close" aria-label="Close sign-in">✕</button>
    <h2 id="bp-auth-title">Your BasePay account</h2>
    <p id="bp-auth-description">Enter your email to receive a secure sign-in link. No password needed.</p>
    <form id="bp-auth-form"><label for="bp-auth-email">Email address</label>
      <input type="email" id="bp-auth-email" name="email" autocomplete="email" required placeholder="you@example.com">
      <button type="submit" id="bp-auth-submit">Email me a sign-in link</button>
    </form>
    <div id="bp-auth-message" role="status" aria-live="polite"></div>
    <button type="button" id="bp-auth-signout" hidden>Sign out</button>
    <p style="font-size:12px">Your simulator progress currently stays on this device; signing in does not back it up or sync it.</p>
  </div>`;
  document.body.append(button,overlay);
  const show = () => {overlay.hidden=false;$('bp-auth-message').textContent='';$('bp-auth-email')?.focus();};
  const hide = () => {overlay.hidden=true;button.focus();};
  button.onclick=show;
  $('bp-auth-close').onclick=hide;
  overlay.addEventListener('click',e=>{if(e.target===overlay)hide();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)hide();});
  if (!config?.url || !config?.anonKey || !window.supabase?.createClient) {
    button.textContent='Accounts unavailable';
    button.onclick=()=>{show();$('bp-auth-message').textContent='Sign-in is not configured yet. The site owner must set SUPABASE_URL and SUPABASE_ANON_KEY in Cloudflare Pages and deploy again.';};
    $('bp-auth-form').hidden=true;
    return;
  }
  const client=window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  window.basepayAuth=client.auth;
  function render(session){
    const email=session?.user?.email;
    button.textContent=email?'Account: '+email:'Sign in';
    $('bp-auth-form').hidden=!!email;$('bp-auth-signout').hidden=!email;
    $('bp-auth-description').textContent=email?'Signed in as '+email:'Enter your email to receive a secure sign-in link. No password needed.';
  }
  client.auth.getSession().then(({data,error})=>{render(data?.session);if(error) $('bp-auth-message').textContent=error.message;}).catch(()=>{});
  client.auth.onAuthStateChange((_event,session)=>render(session));
  $('bp-auth-form').onsubmit=async(e)=>{
    e.preventDefault();
    const submit=$('bp-auth-submit');submit.disabled=true;
    $('bp-auth-message').textContent='Sending your sign-in link…';
    try{
      const email=$('bp-auth-email').value.trim();
      const redirectTo=location.origin+location.pathname;
      const {error}=await client.auth.signInWithOtp({email,options:{emailRedirectTo:redirectTo}});
      $('bp-auth-message').textContent=error?error.message:'Check your email for the sign-in link. If an account is allowed, a message will arrive shortly.';
    }catch(_){$('bp-auth-message').textContent='Unable to send the link. Please try again.';}
    finally{submit.disabled=false;}
  };
  $('bp-auth-signout').onclick=async()=>{
    $('bp-auth-message').textContent='Signing out…';
    const {error}=await client.auth.signOut();
    $('bp-auth-message').textContent=error?error.message:'Signed out.';
  };
})();