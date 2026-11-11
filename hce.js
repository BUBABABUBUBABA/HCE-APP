/* HCE app: database locale, pacchetto contenuti, backup, barra di navigazione */
var HCE = (function () {
  var DBN = 'hce-app', DBV = 1, dbp = null;
  var USER_KEYS = ['dpi_su_di_me_v1', 'dpi_know_v1', 'studio_hce_v1', 'e3_plans_v1', 'e3_daily_v1', 'ripasso_v1', 'mib_log_v1', 'prep_v1', 'fb_v1', 'gym_v1', 'gym_err_v1', 'diz_my_v1', 'io_check_v1', 'io_goals_v1', 'io_habits_v1', 'io_focus_v1', 'io_emo_v1', 'io_trig_v1', 'io_pred_v1', 'io_week_v1', 'ex_v1', 'slcc_v1', 'slcc_msg_v1', 'incontro_v1'];

  function open() {
    if (dbp) return dbp;
    dbp = new Promise(function (res, rej) {
      var r = indexedDB.open(DBN, DBV);
      r.onupgradeneeded = function () {
        var d = r.result;
        ['meta', 'appunti'].forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); });
      };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function get(store, key) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var q = d.transaction(store).objectStore(store).get(key);
        q.onsuccess = function () { res(q.result); };
        q.onerror = function () { rej(q.error); };
      });
    });
  }
  function putAll(store, obj) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(store, 'readwrite'), os = tx.objectStore(store);
        Object.keys(obj).forEach(function (k) { os.put(obj[k], k); });
        tx.oncomplete = function () { res(); };
        tx.onerror = function () { rej(tx.error); };
      });
    });
  }
  function clear(store) {
    return open().then(function (d) {
      return new Promise(function (res, rej) {
        var tx = d.transaction(store, 'readwrite'); tx.objectStore(store).clear();
        tx.oncomplete = function () { res(); }; tx.onerror = function () { rej(tx.error); };
      });
    });
  }

  /* pacchetto contenuti (file privato importato una volta) */
  function importPack(text) {
    var p; try { p = JSON.parse(text); } catch (e) { throw new Error('il file scelto non è leggibile'); }
    if (p && p.app === 'hce-backup') throw new Error('questo è un file di backup: importalo più sotto, in «Backup dei tuoi dati»');
    if (!p || p.app !== 'hce-contenuti' || !p.data || !p.appunti) throw new Error('questo non è il file dei contenuti HCE');
    var pack = { version: p.version, vs: p.vs, vd: p.vd, data: p.data, areas: p.areas, sys: p.sys, toolnames: p.toolnames, unp: p.unp, books: p.books, e3: p.e3, mib: p.mib, istair: p.istair, feedback: p.feedback, diz: p.diz, io: p.io, ex: p.ex, lex: p.lex, slcc: p.slcc, inc: p.inc };
    return clear('appunti')
      .then(function () { return putAll('appunti', p.appunti); })
      .then(function () { return putAll('meta', { pack: pack, cerca: p.cerca }); })
      .then(function () { return pack; });
  }
  function pack() { return get('meta', 'pack'); }
  /* pulsante che sceglie e importa il file dei contenuti, poi ricarica la pagina */
  function pickButton(btn, out) {
    btn.addEventListener('click', function () {
      var inp = document.createElement('input'); inp.type = 'file'; inp.style.display = 'none';
      document.body.appendChild(inp);
      inp.addEventListener('change', function () {
        var f = inp.files[0]; if (!f) return;
        out.innerHTML = '<p class="muted">Importo «' + f.name + '»… può richiedere qualche secondo.</p>';
        var r = new FileReader();
        r.onload = function () {
          try { importPack(r.result).then(function () { location.reload(); }).catch(function (e) { out.innerHTML = '<p class="muted">Non riesco a importare: ' + (e && e.message || 'file non valido') + '</p>'; }); }
          catch (e) { out.innerHTML = '<p class="muted">Non riesco a importare: ' + (e && e.message || 'file non valido') + '. Scegli hce-contenuti.json.</p>'; }
        };
        r.readAsText(f);
      });
      inp.click();
    });
  }
  function ready(fn) {
    pack().then(function (p) {
      if (!p) { location.replace('index.html#contenuti'); return; }
      setTimeout(function () { fn(p); }, 0);
    }).catch(function () { location.replace('index.html#contenuti'); });
  }

  /* backup dei tuoi dati */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function exportBackup() {
    var data = {};
    USER_KEYS.forEach(function (k) { var v = lsGet(k); if (v != null) data[k] = v; });
    var d = new Date(), stamp = d.toISOString().slice(0, 10);
    lsSet('ui_last_backup', String(Date.now()));
    return { name: 'HCE_backup_' + stamp + '.json', text: JSON.stringify({ app: 'hce-backup', date: d.toISOString(), data: data }, null, 1) };
  }
  function J(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function importBackup(text) {
    var b; try { b = JSON.parse(text); } catch (e) { throw new Error('il file scelto non è leggibile'); }
    if (b && b.app === 'hce-contenuti') throw new Error('questo è il file dei contenuti: importalo più sopra, in «Contenuti del corso»');
    if (!b || b.app !== 'hce-backup' || !b.data) throw new Error('questo non è un file di backup HCE');
    var n = 0;
    // sessioni D-P-I: unione per id
    var a = J(lsGet('dpi_su_di_me_v1'), []), r = J(b.data['dpi_su_di_me_v1'], []);
    if (Array.isArray(r)) {
      var seen = {}; a.forEach(function (s) { seen[s.id] = s; });
      r.forEach(function (s) { if (!seen[s.id]) { a.push(s); n++; } else if (s.after && !seen[s.id].after) { seen[s.id].after = s.after; n++; } });
      a.sort(function (x, y) { return y.id > x.id ? 1 : -1; });
      lsSet('dpi_su_di_me_v1', JSON.stringify(a));
    }
    // conoscenza degli aspetti: vince la più recente
    var ka = J(lsGet('dpi_know_v1'), {}), kb = J(b.data['dpi_know_v1'], {});
    Object.keys(kb).forEach(function (k) { if (!ka[k] || (kb[k].t || 0) > (ka[k].t || 0)) { ka[k] = kb[k]; n++; } });
    lsSet('dpi_know_v1', JSON.stringify(ka));
    // moduli studiati: vince la modifica più recente
    var da = J(lsGet('studio_hce_v1'), {}), db = J(b.data['studio_hce_v1'], {});
    Object.keys(db).forEach(function (k) { if (Math.abs(db[k] || 0) > Math.abs(da[k] || 0)) { da[k] = db[k]; n++; } });
    lsSet('studio_hce_v1', JSON.stringify(da));
    // preparazioni E3: unione per id
    var pa = J(lsGet('e3_plans_v1'), []), pb = J(b.data['e3_plans_v1'], []);
    if (Array.isArray(pb)) {
      var ps = {}; pa.forEach(function (x) { ps[x.id] = 1; });
      pb.forEach(function (x) { if (x && !ps[x.id]) { pa.push(x); n++; } });
      pa.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('e3_plans_v1', JSON.stringify(pa));
    }
    // schede Prepara: unione per id (vince quella con il Dopo)
    var qa = J(lsGet('prep_v1'), []), qb = J(b.data['prep_v1'], []);
    if (Array.isArray(qb)) {
      var qi = {}; qa.forEach(function (x, i) { qi[x.id] = i; });
      qb.forEach(function (x) { if (!x) return; if (!(x.id in qi)) { qa.push(x); n++; } else if (x.after && !qa[qi[x.id]].after) { qa[qi[x.id]] = x; n++; } });
      qa.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('prep_v1', JSON.stringify(qa));
    }
    // feedback preparati: unione per id
    var fa = J(lsGet('fb_v1'), []), fb = J(b.data['fb_v1'], []);
    if (Array.isArray(fb)) {
      var fseen = {}; fa.forEach(function (x) { fseen[x.id] = 1; });
      fb.forEach(function (x) { if (x && !fseen[x.id]) { fa.push(x); n++; } });
      fa.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('fb_v1', JSON.stringify(fa));
    }
    // palestra: unione per id
    var ga = J(lsGet('gym_v1'), []), gb = J(b.data['gym_v1'], []);
    if (Array.isArray(gb)) {
      var gseen = {}; ga.forEach(function (x) { gseen[x.id] = 1; });
      gb.forEach(function (x) { if (x && !gseen[x.id]) { ga.push(x); n++; } });
      ga.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('gym_v1', JSON.stringify(ga));
    }
    // le mie espressioni del dizionario: unione per id
    var da = J(lsGet('diz_my_v1'), []), db = J(b.data['diz_my_v1'], []);
    if (Array.isArray(db)) {
      var dseen = {}; da.forEach(function (x) { dseen[x.id] = 1; });
      db.forEach(function (x) { if (x && !dseen[x.id]) { da.push(x); n++; } });
      da.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('diz_my_v1', JSON.stringify(da));
    }
    // matrice: unione per id
    var ma = J(lsGet('mib_log_v1'), []), mb = J(b.data['mib_log_v1'], []);
    if (Array.isArray(mb)) {
      var mseen = {}; ma.forEach(function (x) { mseen[x.id] = 1; });
      mb.forEach(function (x) { if (x && !mseen[x.id]) { ma.push(x); n++; } });
      ma.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('mib_log_v1', JSON.stringify(ma));
    }
    // strumento del giorno e ripassi: unione delle chiavi
    ['e3_daily_v1', 'ripasso_v1', 'gym_err_v1'].forEach(function (k) {
      var x = J(lsGet(k), {}) || {}, y = J(b.data[k], {}) || {};
      Object.keys(y).forEach(function (q) { if (!(q in x)) { x[q] = y[q]; n++; } });
      lsSet(k, JSON.stringify(x));
    });
    // scheda Io: liste unite per id (vince la versione aggiornata per ultima), oggetti uniti per chiave
    USER_KEYS.filter(function (k) { return k.indexOf('io_') === 0 || k === 'ex_v1' || k === 'slcc_v1' || k === 'slcc_msg_v1' || k === 'incontro_v1'; }).forEach(function (k) {
      var y = J(b.data[k], null); if (y == null) return;
      var x = J(lsGet(k), Array.isArray(y) ? [] : {});
      if (Array.isArray(y)) {
        var ix = {}; x.forEach(function (e, i) { if (e) ix[e.id] = i; });
        y.forEach(function (e) { if (!e) return; if (!(e.id in ix)) { x.push(e); n++; } else if ((e.u || 0) > (x[ix[e.id]].u || 0)) { x[ix[e.id]] = e; n++; } });
        x.sort(function (p, q) { return +q.id - +p.id; });
      } else { Object.keys(y).forEach(function (q) { if (!(q in x) || ((y[q] && y[q].u) || 0) > ((x[q] && x[q].u) || 0)) { x[q] = y[q]; n++; } }); }
      lsSet(k, JSON.stringify(x));
    });
    return n;
  }
  function save(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var file;
    try { file = new File([blob], name, { type: 'application/json' }); } catch (e) {}
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && /iPad|iPhone|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
      return navigator.share({ files: [file], title: name }).catch(function () {});
    }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    return Promise.resolve();
  }

  /* barra di navigazione comune */
  var ICON = {
    home: '<path d="M3 11 12 4l9 7v9H3z"/><path d="M9 20v-6h6v6"/>',
    percorso: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    studio: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5M8 7h7"/>',
    dpi: '<path d="M4 6h16M4 12h10M4 18h7"/><circle cx="18" cy="17" r="3"/>',
    e3: '<path d="M5 6h6M5 12h6M5 18h6"/><path d="M15 5h4v4M15 19h4v-4M19 9l-4 3 4 3"/>',
    prep: '<path d="M9 4h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="M9 12h6M9 16h4"/>',
    tools: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
    io: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>',
    mib: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/>'
  };
  function nav(cur) {
    var items = [['index.html', 'Home', 'home'], ['percorso.html', 'Percorso', 'percorso'], ['prep.html', 'Prepara', 'prep'], ['strumenti.html', 'Strumenti', 'tools'], ['io.html', 'Io', 'io']];
    var on = cur === 'studio' ? 'percorso' : (cur === 'e3' || cur === 'mib' || cur === 'tool' || cur === 'dpi') ? 'tools' : cur;
    document.body.classList.add(cur);
    var bar = document.createElement('div');
    bar.className = 'appbar';
    bar.setAttribute('role', 'navigation'); bar.setAttribute('aria-label', 'Sezioni');
    bar.innerHTML = items.map(function (i) {
      return '<a href="' + i[0] + '"' + (i[2] === on ? ' aria-current="page"' : '') + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[i[2]] + '</svg>' + i[1] + '</a>';
    }).join('');
    document.body.appendChild(bar);
  }

  /* gioco: XP, serie di giorni, piano di oggi */
  function dayKey(ts) { var d = new Date(ts); return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
  function stats() {
    var done = J(lsGet('studio_hce_v1'), {}) || {}, ses = J(lsGet('dpi_su_di_me_v1'), []) || [],
      plans = J(lsGet('e3_plans_v1'), []) || [], daily = J(lsGet('e3_daily_v1'), {}) || {}, rip = J(lsGet('ripasso_v1'), {}) || {}, mlog = J(lsGet('mib_log_v1'), []) || [], preps = J(lsGet('prep_v1'), []) || [], fbs = J(lsGet('fb_v1'), []) || [], gym = J(lsGet('gym_v1'), []) || [];
    function L(k, d) { return J(lsGet(k), d) || d; }
    var ev = [], nm = 0;
    function add(t, type, xp, ref) { if (t > 1e12) ev.push({ t: t, d: dayKey(t), type: type, xp: xp, ref: ref }); }
    Object.keys(done).forEach(function (k) { var t = done[k]; if (t > 0) { nm++; add(t, 'mod', 10, k); } });
    ses.forEach(function (s) { add(+s.id, 'ses', 30, s.id); if (s.after) add(s.after.t || Date.parse(s.after.date + 'T12:00:00') || +s.id, 'after', 10, s.id); });
    plans.forEach(function (x) { add(+x.id, 'plan', 20, x.id); });
    Object.keys(daily).forEach(function (k) { var v = daily[k]; if (v && v.t) add(v.t, 'tool', 10, v.n); });
    Object.keys(rip).forEach(function (k) { add(rip[k], 'rip', 5, k); });
    mlog.forEach(function (x) { add(+x.id, 'mib', 15, x.id); });
    fbs.forEach(function (x) { add(+x.id, 'fb', 20, x.id); });
    gym.forEach(function (x) { add(+x.id, 'gym', 5 + 2 * (x.ok || 0), x.id); });
    // scheda Io
    var ck = L('io_check_v1', {}); Object.keys(ck).forEach(function (k) { if (ck[k] && ck[k].t) add(ck[k].t, 'io', 10, 'check'); });
    L('io_goals_v1', []).forEach(function (g) { add(+g.id, 'io', 10, 'goal'); Object.keys(g.done || {}).forEach(function (p) { add(g.done[p], 'io', p === 'C' ? 30 : 10, 'reach'); }); });
    L('io_habits_v1', []).forEach(function (h) { Object.keys(h.log || {}).forEach(function (d) { add(h.log[d], 'io', 3, 'habit'); }); });
    L('io_focus_v1', []).forEach(function (x) { add(+x.id, 'io', 10, 'focus'); });
    L('io_emo_v1', []).forEach(function (x) { add(+x.id, 'io', 15, 'emo'); });
    L('io_pred_v1', []).forEach(function (x) { add(+x.id, 'io', 5, 'pred'); if (x.rt) add(x.rt, 'io', 5, 'pred'); });
    var exa = L('ex_v1', {}); Object.keys(exa).forEach(function (m) { var s = exa[m] || {};
      if (s.t1) add(s.t1, 'ex', 10, m); if (s.t2) add(s.t2, 'ex', 10, m); if (s.t3) add(s.t3, 'ex', 5, m); if (s.t4) add(s.t4, 'ex', 10, m);
      Object.keys(s.done || {}).forEach(function (i) { if (s.done[i] && s.done[i].t) add(s.done[i].t, 'exp', 10, m); }); });
    var wk = L('io_week_v1', {}); Object.keys(wk).forEach(function (k) { if (wk[k] && wk[k].t) add(wk[k].t, 'io', 20, 'week'); });
    L('slcc_v1', []).forEach(function (x) { add(+x.id, 'slcc', 10, 'prof'); });
    L('slcc_msg_v1', []).forEach(function (x) { add(+x.id, 'slcc', 15, 'msg'); });
    L('incontro_v1', []).forEach(function (x) { add(+x.id, 'inc', 20, x.id); if (x.esito && x.et) add(x.et, 'inc', 10, x.id); });
    preps.forEach(function (x) { add(+x.id, 'prep', 20, x.id); if (x.after && x.after.t) add(x.after.t, 'prepafter', 10, x.id); });
    var days = {}, xp = 0, today = dayKey(Date.now()), T = { mod: 0, ses: 0, plan: 0, tool: 0, rip: 0, after: 0, mib: 0, prep: 0, prepafter: 0, fb: 0, gym: 0, io: 0, ex: 0, exp: 0, slcc: 0, inc: 0 };
    ev.forEach(function (e) { days[e.d] = 1; xp += e.xp; if (e.d === today) T[e.type]++; });
    var streak = 0, d = new Date();
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (days[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    var plan = [Math.min(T.mod, 2) / 2, (T.ses + T.after + T.plan + T.mib + T.prep + T.prepafter + T.fb + T.gym + T.io + T.exp + T.slcc + T.inc) ? 1 : 0, T.tool ? 1 : 0];
    return { xp: xp, streak: streak, today: !!days[today], todayKey: today, days: days, events: ev, T: T,
      mods: nm, sessions: ses.length, plans: plans.length, preps: preps, done: done, ses: ses, planList: plans, daily: daily, rip: rip,
      goal: plan.filter(function (x) { return x >= 1; }).length, goalMax: 3, plan: plan };
  }
  function lsJ(k, d) { return J(lsGet(k), d); }
  function lsPut(k, v) { lsSet(k, JSON.stringify(v)); }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  /* aspetto: grandezza del testo e tema, scelti in Impostazioni */
  function uiGet() { return { font: lsGet('ui_font') || '100', theme: lsGet('ui_theme') || 'auto', lastBackup: +(lsGet('ui_last_backup') || 0) }; }
  function uiApply() {
    var u = uiGet(), r = document.documentElement;
    r.style.fontSize = u.font === '100' ? '' : u.font + '%';
    if (u.theme === 'light' || u.theme === 'dark') r.setAttribute('data-theme', u.theme); else r.removeAttribute('data-theme');
  }
  function uiSet(k, v) { lsSet('ui_' + k, v); uiApply(); }
  uiApply();
  /* schede che scorrono in orizzontale: una sfumatura sul bordo dice che ce ne sono altre */
  function tabsHint() {
    var st = document.createElement('style');
    st.textContent = '.tabs.more-r{-webkit-mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(90deg,#000 calc(100% - 44px),transparent)}.tabs.more-l{-webkit-mask-image:linear-gradient(270deg,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(270deg,#000 calc(100% - 44px),transparent)}.tabs.more-l.more-r{-webkit-mask-image:linear-gradient(90deg,transparent,#000 44px,#000 calc(100% - 44px),transparent);mask-image:linear-gradient(90deg,transparent,#000 44px,#000 calc(100% - 44px),transparent)}';
    document.head.appendChild(st);
    function upd(t) { var r = t.scrollLeft + t.clientWidth < t.scrollWidth - 6, l = t.scrollLeft > 6; t.classList.toggle('more-r', r); t.classList.toggle('more-l', l); }
    function all() { Array.prototype.forEach.call(document.querySelectorAll('.tabs'), function (t) { if (!t._hint) { t._hint = 1; t.addEventListener('scroll', function () { upd(t); }, { passive: true }); } upd(t); }); }
    document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.tab'); if (b && b.scrollIntoView) { try { b.scrollIntoView({ block: 'nearest', inline: 'center' }); } catch (x) {} } setTimeout(all, 60); });
    window.addEventListener('resize', all); setTimeout(all, 300); setTimeout(all, 1500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tabsHint); else tabsHint();
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  return { get: get, pack: pack, ready: ready, importPack: importPack, exportBackup: exportBackup, importBackup: importBackup, save: save, pickButton: pickButton, nav: nav, stats: stats, dayKey: dayKey, lsJ: lsJ, lsPut: lsPut, USER_KEYS: USER_KEYS, ui: { get: uiGet, set: uiSet } };
})();
