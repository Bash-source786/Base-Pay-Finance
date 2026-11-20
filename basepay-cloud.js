/* Account files are stored together in the user's existing cloud save row.
   Guest progress always uses a separate browser-only save. */
(() => {
  'use strict';
  let account = null;
  let guest = false;
  const guestKey = 'basepayGuestSave:v1';
  const restartKey = 'basepayGuestRestart:v1';
  const slotCount = 3;
  const emptySlots = () => Array(slotCount).fill(null);
  const isSave = save => ['adult', 'youth'].includes(save?.mode)
    && Number.isFinite(Number(save.day)) && Number(save.day) >= 1;

  function status(label, error = false) {
    const el = document.getElementById('bp-save-status');
    if (!el) return;
    el.textContent = label;
    el.style.color = error ? 'var(--red)' : 'var(--text-dim)';
  }
  function readGuestSave() {
    let raw;
    try { raw = localStorage.getItem(guestKey); }
    catch (_) { return { issue: 'Browser storage is unavailable. Guest progress cannot be saved.' }; }
    if (raw === null) return {};
    try {
      const save = JSON.parse(raw);
      if (isSave(save) && window.basepayIsGuestSave(save)) return { save };
    } catch (_) {}
    return { issue: 'Your guest save could not be read. It is still stored in this browser.', damaged: true };
  }
  function activateGuest() {
    logout();
    guest = true;
    const result = readGuestSave();
    status(result.issue || 'Guest — this browser only', !!result.issue);
    return result;
  }
  function resetGuest() {
    if (!guest) throw new Error('Guest access required.');
    sessionStorage.setItem(restartKey, '1');
    try {
      localStorage.removeItem(guestKey);
    } catch (error) {
      sessionStorage.removeItem(restartKey);
      throw error;
    }
    guest = false;
  }
  function takeGuestRestart() {
    try {
      if (sessionStorage.getItem(restartKey) !== '1') return false;
      sessionStorage.removeItem(restartKey);
      return true;
    } catch (_) { return false; }
  }
  function accountSlots(saveData) {
    if (saveData == null) return emptySlots();
    if (isSave(saveData)) return [saveData, null, null];
    if (saveData.version === 2 && Array.isArray(saveData.slots)
      && saveData.slots.length === slotCount
      && saveData.slots.every(save => save === null || isSave(save))) {
      return saveData.slots;
    }
    throw new Error('The account save is in an unrecognised format.');
  }
  async function readFiles(session) {
    const {data, error} = await session.client.from('basepay_saves')
      .select('save_data, updated_at').eq('user_id', session.userId).maybeSingle();
    if (error) throw new Error('Could not load your save files. ' + error.message);
    return {slots: accountSlots(data?.save_data), updatedAt: data?.updated_at ?? null};
  }
  function cache(session, slots) {
    try {
      localStorage.setItem('basepayAccountSave:' + session.userId, JSON.stringify({version: 2, slots}));
    } catch (_) {}
  }
  async function activate(user, client) {
    logout();
    const session = {userId: user.id, client, slots: emptySlots(), slot: null, pending: null, timer: null, writing: null};
    account = session;
    status('Loading save files…');
    try {
      const {slots} = await readFiles(session);
      if (account !== session) return emptySlots();
      session.slots = slots;
      cache(session, slots);
      return slots;
    } catch (error) {
      if (account === session) account = null;
      throw error;
    }
  }
  async function listFiles() {
    const session = account;
    if (!session) throw new Error('Sign in to view your save files.');
    await flushPending(session);
    const {slots} = await readFiles(session);
    if (session !== account) throw new Error('Your session changed.');
    session.slots = slots;
    cache(session, slots);
    return slots;
  }
  function selectFile(index) {
    if (!account || !Number.isInteger(index) || index < 0 || index >= slotCount || account.pending) {
      throw new Error('Could not open the save file. Please try again.');
    }
    account.slot = index;
    const save = account.slots[index];
    status(save ? 'Cloud progress loaded' : 'New save file');
    return save ? structuredClone(save) : null;
  }
  async function createFile(save) {
    const session = account;
    const slot = session?.slot;
    if (!session || slot === null || session.slots[slot]) throw new Error('Choose an empty save file first.');
    const slots = await writeFile(session, slot, save, true);
    if (session !== account || !slots) throw new Error('Your session changed.');
    session.slots = slots;
    cache(session, slots);
    status('Saved to cloud ✓');
  }
  function enqueue(save) {
    if (!save) return;
    if (guest) {
      const {issue, damaged} = readGuestSave();
      if (damaged) {
        status('Guest — temporary progress. The unreadable save is still stored in this browser.', true);
        return;
      }
      if (issue) { status(issue, true); return; }
      try {
        localStorage.setItem(guestKey, JSON.stringify(save));
        status('Guest — saved in this browser only');
      } catch (_) { status('Guest — storage unavailable; progress will be lost when you leave', true); }
      return;
    }
    const session = account;
    if (!session || session.slot === null) return;
    session.pending = structuredClone(save);
    const slots = session.slots.slice();
    slots[session.slot] = session.pending;
    cache(session, slots);
    status('Saving…');
    clearTimeout(session.timer);
    session.timer = setTimeout(() => flush(session), 400);
  }
  async function writeFile(session, slot, save, isNew) {
    const table = () => session.client.from('basepay_saves');
    // Apply this file to the latest row. A write to another file on a
    // different device must not be lost between this read and the update.
    for (let attempt = 0; attempt < 4 && session === account; attempt++) {
      const {slots, updatedAt} = await readFiles(session);
      if (session !== account) return null;
      if (isNew && slots[slot]) {
        throw new Error('This file was started on another device. Your progress here could not be uploaded.');
      }
      slots[slot] = save;
      const save_data = {version: 2, slots};
      if (updatedAt === null) {
        const {error} = await table().insert({user_id: session.userId, save_data});
        if (!error) return slots;
        if (error.code !== '23505') throw error;
      } else {
        const updated_at = new Date(Math.max(Date.now(), Date.parse(updatedAt) + 1)).toISOString();
        const {data, error} = await table().update({save_data, updated_at})
          .eq('user_id', session.userId).eq('updated_at', updatedAt).select('updated_at');
        if (error) throw error;
        if (data.length) return slots;
      }
    }
    throw new Error('Could not save because the cloud copy changed. Please try again.');
  }
  function flush(session = account) {
    if (!session || session !== account || !session.pending) return;
    if (session.writing) return session.writing;
    clearTimeout(session.timer);
    const {slot, pending} = session;
    session.writing = writeFile(session, slot, pending, false).then(slots => {
      if (session !== account || !slots) return;
      session.slots = slots;
      if (session.pending === pending) {
        session.pending = null;
        cache(session, slots);
        status('Saved to cloud ✓');
      } else {
        const cached = slots.slice();
        cached[slot] = session.pending;
        cache(session, cached);
        session.timer = setTimeout(() => flush(session), 100);
      }
    }).catch(error => {
      if (session === account) status(error.message || 'Could not save your progress. Please try again.', true);
    }).finally(() => { session.writing = null; });
    return session.writing;
  }
  async function flushPending(session = account) {
    if (!session) return;
    clearTimeout(session.timer);
    for (let i = 0; i < 3 && session.pending; i++) await flush(session);
    if (session.pending) throw new Error('Your latest progress is waiting to upload. Check the save status and try again.');
  }
  function logout() {
    guest = false;
    clearTimeout(account?.timer);
    account = null;
    status('');
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.BasePayCloud = {
    activate, activateGuest, enqueue, flush, beforeSignOut: flushPending, logout,
    listFiles, selectFile, createFile, readGuestSave, resetGuest, takeGuestRestart, userId: () => account?.userId,
  };
})();
