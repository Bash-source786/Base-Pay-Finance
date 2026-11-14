/* BasePay account-based cloud saves.
   Cloud is authoritative on login. Never copy a browser save across
   accounts silently; the user must explicitly choose to import it. */
(() => {
  'use strict';
  let client = null, userId = null, pending = null, timer = null, writing = false;
  let version = 0, lastWritten = 0, currentWrite = null;
  const key = id => 'basepayAccountSave:' + id;
  function status(label, error = false) {
    let el = document.getElementById('bp-save-status');
    if (!el) return;
    el.textContent = label;
    el.style.color = error ? 'var(--red)' : 'var(--text-dim)';
  }
  function cache(save) {
    if (!userId) return;
    try { localStorage.setItem(key(userId), JSON.stringify(save)); } catch (_) {}
  }
  async function activate(user, supabaseClient) {
    if (!user || !user.id) throw new Error('No authenticated user.');
    client = supabaseClient;
    userId = user.id;
    pending = null;
    version = lastWritten = 0;
    status('Loading cloud save…');
    const { data, error } = await client.from('basepay_saves')
      .select('save_data').eq('user_id',user.id).maybeSingle();
    if (error) {
      userId = null; client = null;
      throw new Error('Cloud saves are not ready: ' + error.message);
    }
    const save = data?.save_data || null;
    if (save && (!save.mode || !Number.isFinite(Number(save.day)))) {
      throw new Error('The account save was not in a recognised format.');
    }
    if (save) cache(save);
    status(save ? 'Cloud progress loaded' : 'New account');
    return save;
  }
  function enqueue(save) {
    if (!client || !userId || !save) return;
    pending = JSON.parse(JSON.stringify(save));
    cache(pending);
    version += 1;
    status('Saving…');
    clearTimeout(timer);
    timer = setTimeout(flush, 400);
  }
  async function flush() {
    if (writing) return currentWrite;
    if (!pending || !client || !userId) return;
    clearTimeout(timer);
    const selected = pending, savedVersion = version;
    const targetUser = userId, targetClient = client;
    writing = true;
    currentWrite = (async () => {
    try {
      const { error } = await targetClient.from('basepay_saves')
        .upsert({user_id: targetUser, save_data:selected, updated_at:new Date().toISOString()},
          {onConflict:'user_id'});
      if (error) throw error;
      if (userId === targetUser) {
        lastWritten = savedVersion;
        if (version === savedVersion) { pending = null; status('Saved to cloud ✓'); }
        else { timer = setTimeout(flush, 100); }
      }
    } catch (error) {
      console.warn('BasePay cloud save:',error);
      if (userId === targetUser) status('Cloud save failed — progress kept on this device', true);
    } finally { writing = false; currentWrite = null; }
    })();
    return currentWrite;
  }
  async function beforeSignOut() {
    clearTimeout(timer);
    for(let i=0; i<3 && pending; i++) await flush();
    if (pending) throw new Error('Your latest progress has not been uploaded yet. Please check your connection.');
  }
  function logout() {
    clearTimeout(timer);
    client = null; userId = null; pending = null; version = lastWritten = 0;
    status('');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && pending) flush();
  });
  window.BasePayCloud = {activate,enqueue,flush,beforeSignOut,logout,userId:()=>userId};
})();
