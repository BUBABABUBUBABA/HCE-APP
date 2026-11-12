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

  /* medaglie: gruppi Base, Risultati, Obiettivi, Abitudini, Strumenti, Io, Studio.
     Una medaglia con soglie ha tre gradi (bronzo, argento, oro); senza soglie è unica. */
  var MEDAL_GROUPS = [['ris', 'Risultati'], ['obi', 'Obiettivi'], ['abi', 'Abitudini'], ['str', 'Strumenti'], ['io', 'Su di te'], ['stu', 'Studio'], ['base', 'Costanza']];
  var LV_EMO = { iu: '🤝', pi: '✨', op: '🗣️', sc: '🎨', ab: '🌱', fo: '🎯', ob: '🏔️', bi: '🧠', ec: '🧍', pe: '❤️', al: '🔤', sl: '🧩', sa: '👔', ve: '🛒', 'in': '🪝', it: '💡', tr: '🏆', dm: '⚖️', le: '🦁', pm: '👥', we: '🎥' };
  var AR_EMO = { Connection: '🌐', Improve: '📈', Inside: '🧠', Persuasion: '🗝️', Sales: '💼', Team: '👥', Webinar: '🎥' };
  var MIX_MED = [['fel', '😊', 'Felicità'], ['fid', '🤝', 'Fiducia'], ['att', '👀', 'Attenzione'], ['rel', '😌', 'Calma'], ['ecc', '🤩', 'Entusiasmo'], ['ten', '⏱️', 'Urgenza'], ['dis', '🗣️', 'Confronto']];
  var IST_MED = [['int', '💡', 'Interessante', 'Interesting'], ['sup', '🏔️', 'Insuperabile', 'Insuperable'], ['imp', '❗', 'Imperativo', 'Imperative'], ['irr', '🧲', 'Irresistibile', 'Irresistible']];
  var GYM_T = [['e3', 'E³'], ['ibm', 'Matrice biochimica'], ['ist', 'I-STAIR'], ['fb', 'Feedback'], ['diz', 'Dizionario'], ['gl', 'Termini']];
  function medals(pk) {
    var S = stats(), c = {}, ev = S.events, out = [];
    ev.forEach(function (e) { var k = e.type === 'io' ? e.ref : e.type; c[k] = (c[k] || 0) + 1; });
    var L2 = function (k, d) { return J(lsGet(k), d) || d; };
    function M(g, k, e, n, how, href, th, v, ex) { var o = { g: g, k: k, e: e, n: n, how: how, href: href, th: th || null, v: v || 0 };
      if (th) { o.tier = -1; th.forEach(function (t, i) { if (o.v >= t) o.tier = i; }); o.got = o.tier >= 0; } else o.got = !!v;
      if (ex) for (var x in ex) o[x] = ex[x]; out.push(o); }
    /* --- dati --- */
    var preps = L2('prep_v1', []), mlog = L2('mib_log_v1', []), goals = L2('io_goals_v1', []), habits = L2('io_habits_v1', []);
    var daily = L2('e3_daily_v1', {}), plans = L2('e3_plans_v1', []), fbs = L2('fb_v1', []), sl = L2('slcc_v1', []), slm = L2('slcc_msg_v1', []), inc = L2('incontro_v1', []);
    var foc = L2('io_focus_v1', []), emo = L2('io_emo_v1', []), pred = L2('io_pred_v1', []), gym = L2('gym_v1', []), exa = L2('ex_v1', {}), rip = L2('ripasso_v1', {}), done = L2('studio_hce_v1', {}), mine = L2('diz_my_v1', []);
    /* --- Risultati: mix ottenuti --- */
    var mixOk = {}; preps.forEach(function (p) { var a = p.after || {}, nd = (p.him || {}).need; if (a.res === 'si' && nd) mixOk[nd] = (mixOk[nd] || 0) + 1; });
    MIX_MED.forEach(function (m) { M('ris', 'mix_' + m[0], m[1], m[2], 'In Prepara scegli il mix «' + m[2].replace('Calma', 'Relax').replace('Entusiasmo', 'Eccitazione').replace('Urgenza', 'Tensione').replace('Confronto', 'Dissenso') + '» come quello che serve all\'altro; nel Dopo rispondi «Sì» a «Obiettivo raggiunto?».', 'prep.html#nuova', [1, 5, 15], mixOk[m[0]]); });
    var fire = mlog.filter(function (x) { return (x.from === 'ten' || x.from === 'dis') && (x.to === 'rel' || x.to === 'fid'); }).length;
    M('ris', 'pompiere', '🧯', 'Pompiere', 'Nella Matrice biochimica registra un passaggio da Tensione o Dissenso a Relax o Fiducia, usato in un\'interazione vera.', 'mib.html', [1, 5, 15], fire);
    M('ris', 'alchimista', '⚗️', 'Alchimista', 'Ottieni tutti e 7 i mix almeno una volta (medaglie dei mix qui sopra).', 'prep.html#nuova', [7], MIX_MED.filter(function (m) { return mixOk[m[0]]; }).length);
    var stOrd = ['ind', 'int', 'sup', 'imp', 'irr'], stc = {};
    preps.forEach(function (p) { var st = (p.after || {}).st, i = stOrd.indexOf(st); for (var j = 1; j <= i; j++) stc[stOrd[j]] = (stc[stOrd[j]] || 0) + 1; });
    IST_MED.forEach(function (m) { M('ris', 'ist_' + m[0], m[1], m[2], 'I-STAIR: porta qualcuno almeno al gradino ' + m[3] + '. Lo segni nel Dopo di Prepara.', 'prep.html', [1, 5, 15], stc[m[0]]); });
    var aft = preps.filter(function (p) { return p.after && p.after.res; });
    M('ris', 'si', '✅', 'Obiettivo centrato', 'Nel Dopo di Prepara rispondi «Sì» a «Obiettivo raggiunto?».', 'prep.html', [3, 10, 30], aft.filter(function (p) { return p.after.res === 'si'; }).length);
    M('ris', 'occhio', '👁️', 'Occhio clinico', 'Il mix in cui pensavi di trovare l\'altro (Prepara, passo 2) è quello in cui l\'hai trovato davvero (Dopo).', 'prep.html', [1, 5, 15], preps.filter(function (p) { return (p.him || {}).now && (p.after || {}).mix === p.him.now; }).length);
    M('ris', 'svolta', '🌤️', 'Svolta', 'Trovi l\'altro in Tensione o Dissenso e lo porti a Felicità o Fiducia: Dopo con «Sì».', 'prep.html', [1, 5, 15], preps.filter(function (p) { var h = p.him || {}; return (h.now === 'ten' || h.now === 'dis') && (h.need === 'fel' || h.need === 'fid') && (p.after || {}).res === 'si'; }).length);
    M('ris', 'lezione', '📚', 'Lezione imparata', 'Quando va male («No» o «In parte»), scrivi cosa cambi la prossima volta.', 'prep.html', [1, 5, 15], aft.filter(function (p) { return p.after.res !== 'si' && (p.after.next || '').trim(); }).length);
    /* --- Obiettivi REACH --- */
    var F = function (g, k) { return ((g.f || {})[k] || '').trim(); }, D = function (g, k) { return (g.done || {})[k]; };
    M('obi', 'g_R', '❓', 'Ho un perché', 'Completa la fase Reason di un obiettivo, con i Cinque perché scritti.', 'io.html#obiettivi', [1, 3, 10], goals.filter(function (g) { return D(g, 'R') && F(g, 'R.why'); }).length);
    M('obi', 'g_E', '📐', 'Architetto', 'Completa la fase Engineer con il Premortem scritto.', 'io.html#obiettivi', [1, 3, 10], goals.filter(function (g) { return D(g, 'E') && F(g, 'E.premortem'); }).length);
    M('obi', 'g_A', '🏃', 'Sul campo', 'Completa la fase Accomplish con KPI e sprint settimanale scritti.', 'io.html#obiettivi', [1, 3, 10], goals.filter(function (g) { return D(g, 'A') && F(g, 'A.kpi') && F(g, 'A.sprint'); }).length);
    M('obi', 'g_C', '🏆', 'Traguardo', 'Raggiungi un obiettivo e celebralo (fase Cheer).', 'io.html#obiettivi', [1, 3, 10], goals.filter(function (g) { return D(g, 'C'); }).length);
    M('obi', 'g_n', '🎯', 'Nuovi obiettivi', 'Scrivi un obiettivo in Io → Obiettivi.', 'io.html#obiettivi', [1, 3, 10], goals.length);
    [['R.future', '🔭', 'Il sé futuro'], ['R.pain', '🎢', 'Dolore e piacere'], ['R.mine', '🪪', 'È davvero mio?'], ['E.map', '🗺️', 'Mappatura'], ['E.cross', '🔀', 'Trasversalità'], ['E.reward', '🎁', 'La ricompensa'],
     ['A.minute', '⌚', 'Il minuto'], ['C.ritual', '🥂', 'Rituale della vittoria'], ['C.thanks', '🙏', 'Gratitudine condivisa'], ['H.diary', '📔', 'Diario del successo'], ['H.skills', '🗃️', 'Inventario delle competenze'], ['H.decon', '🧱', 'Decostruzione del successo']].forEach(function (t) {
      var n = goals.filter(function (g) { return F(g, t[0]); }).length;
      M('obi', 'gt_' + t[0], t[1], t[2], 'Usa lo strumento REACH «' + t[2] + '» in un obiettivo (fase ' + t[0][0] + ').', 'io.html#obiettivi', null, n, { cnt: n }); });
    M('obi', 'g_all', '🌟', 'REACH completo', 'Tutte e 5 le fasi completate sullo stesso obiettivo.', 'io.html#obiettivi', [1, 3, 10], goals.filter(function (g) { return ['R', 'E', 'A', 'C', 'H'].every(function (k) { return D(g, k); }); }).length);
    var hd = 0; goals.forEach(function (g) { var c0 = D(g, 'C'), h = g.hold || []; if (c0 && h.length) hd = Math.max(hd, Math.floor((Math.max.apply(null, h) - c0) / 864e5)); });
    M('obi', 'g_H', '🛡️', 'Tenuta', 'Dopo il traguardo, conferma nella fase Hold che lo stai mantenendo: 30, 90, 120 giorni.', 'io.html#obiettivi', [30, 90, 120], hd, { unit: 'giorni' });
    var hEnd = goals.map(function (g) { return D(g, 'H'); }).filter(Boolean), rel = hEnd.length ? goals.filter(function (g) { return hEnd.some(function (t) { return +g.id > t; }); }).length : 0;
    M('obi', 'g_re', '🚀', 'Rilancio', 'Chiudi la fase Hold di un obiettivo e parti con uno nuovo.', 'io.html#obiettivi', null, rel);
    /* --- Abitudini --- */
    function nlog(h) { return Object.keys(h.log || {}).length; }
    function best(h) { var ks = Object.keys(h.log || {}).sort(), b = 0, r = 0, pv = null; ks.forEach(function (d) { var t = Date.parse(d + 'T12:00:00'); r = pv != null && Math.round((t - pv) / 864e5) === 1 ? r + 1 : 1; pv = t; if (r > b) b = r; }); return b; }
    var nw = habits.filter(function (h) { return h.type !== 'old'; }), od = habits.filter(function (h) { return h.type === 'old'; });
    M('abi', 'h_7', '🌱', 'Germoglio', 'Segna un\'abitudine nuova per 7 giorni.', 'io.html#abitudini', null, nw.some(function (h) { return nlog(h) >= 7; }), { cnt: nw.filter(function (h) { return nlog(h) >= 7; }).length });
    M('abi', 'h_66', '🌳', 'Radici', '66 giorni segnati su un\'abitudine: la mediana dello studio di Lally citato nel corso.', 'io.html#abitudini', null, nw.some(function (h) { return nlog(h) >= 66; }), { cnt: nw.filter(function (h) { return nlog(h) >= 66; }).length });
    M('abi', 'h_100', '💯', 'Cento', '100 giorni segnati su un\'abitudine.', 'io.html#abitudini', null, nw.some(function (h) { return nlog(h) >= 100; }), { cnt: nw.filter(function (h) { return nlog(h) >= 100; }).length });
    M('abi', 'h_run', '🔗', 'Catena', 'Giorni di fila sulla stessa abitudine, senza saltarne uno.', 'io.html#abitudini', [7, 30, 66], Math.max.apply(null, [0].concat(nw.map(best))), { unit: 'giorni' });
    M('abi', 'h_old', '🔓', 'Catena spezzata', '30 giorni segnati su un\'abitudine vecchia da smontare.', 'io.html#abitudini', null, od.some(function (h) { return nlog(h) >= 30; }), { cnt: od.filter(function (h) { return nlog(h) >= 30; }).length });
    M('abi', 'h_n', '🧱', 'Costruttore', 'Crea un\'abitudine in Io → Abitudini.', 'io.html#abitudini', [1, 3, 5], habits.length);
    M('abi', 'h_1', '🌰', 'Primo passo', 'Segna il primo giorno di un\'abitudine.', 'io.html#abitudini', null, habits.some(function (h) { return nlog(h) >= 1; }));
    var hdays = {}; habits.forEach(function (h) { Object.keys(h.log || {}).forEach(function (d) { hdays[d] = 1; }); });
    M('abi', 'h_tot', '📆', 'Giorni di abitudini', 'Giorni in cui hai segnato almeno un\'abitudine.', 'io.html#abitudini', [10, 50, 200], Object.keys(hdays).length, { unit: 'giorni' });
    M('abi', 'h_two', '🤹', 'Doppietta', 'Lo stesso giorno, segna due abitudini diverse.', 'io.html#abitudini', null, Object.keys(hdays).some(function (d) { return habits.filter(function (h) { return (h.log || {})[d]; }).length >= 2; }));
    /* --- Strumenti --- */
    var tried = {}; Object.keys(daily).forEach(function (d) { var v = daily[d]; if (v && v.n) tried[v.n] = 1; });
    var ph = {}, allT = [];
    if (pk && pk.e3) pk.e3.phases.forEach(function (p) { ph[p.k] = []; (p.aspects || []).forEach(function (a) { (a.tools || []).forEach(function (t) { ph[p.k].push(t.n); allT.push(t.n); }); }); });
    M('str', 'e3_all', '🧰', 'Cassetta E³', 'Prova in una conversazione vera gli strumenti E³ del giorno, in Home.', 'index.html', [5, 15, allT.length || 27], allT.filter(function (n) { return tried[n]; }).length);
    [['engage', '🪝', 'Engage'], ['explain', '📢', 'Explain'], ['exchange', '🔄', 'Exchange']].forEach(function (x) { var l = ph[x[0]] || [];
      M('str', 'e3_' + x[0], x[1], x[2] + ' completo', 'Prova tutti gli strumenti della fase ' + x[2] + ' (strumento del giorno, in Home).', 'e3.html', null, l.length && l.every(function (n) { return tried[n]; }), { prog: [l.filter(function (n) { return tried[n]; }).length, l.length] }); });
    M('str', 'e3_plan', '📝', 'Copione', 'Scrivi un piano E³ nella sezione Prepara dell\'Algoritmo E³.', 'e3.html', [1, 10, 30], plans.length);
    M('str', 'prep', '🧾', 'Preparato', 'Prepara un\'interazione vera in Prepara.', 'prep.html#nuova', [1, 10, 30], preps.length);
    M('str', 'dopo', '↩️', 'Il Dopo', 'Compila «com\'è andata» dopo un\'interazione (Prepara, D-P-I, Prima di un incontro).', 'prep.html', [3, 15, 40], (c.prepafter || 0) + (c.after || 0) + inc.filter(function (x) { return x.esito; }).length);
    M('str', 'dpi', '🔍', 'Detective', 'Fai una sessione del protocollo D-P-I.', 'protocollo.html#prima', [1, 10, 30], c.ses);
    M('str', 'mib', '🔬', 'Osservatore', 'Registra nella Matrice un mix usato in un\'interazione vera.', 'mib.html', [1, 10, 30], mlog.length);
    M('str', 'rings', '💍', 'RINGS', 'Prepara un feedback con il modello RINGS.', 'feedback.html', [1, 5, 15], fbs.filter(function (x) { return x.model === 'rings'; }).length);
    M('str', 'arise', '🌅', 'ARISE', 'Prepara un feedback con il modello ARISE.', 'feedback.html', [1, 5, 15], fbs.filter(function (x) { return x.model === 'arise'; }).length);
    var full = sl.filter(function (x) { var p = x.p || {}; return Object.keys(p).filter(function (k) { return p[k]; }).length >= 15; }).length;
    M('str', 'sl_dec', '🔎', 'Decoder', 'Completa il profilo SLCC di una persona su tutte e 15 le preferenze.', 'slcc.html', null, full, { cnt: full });
    M('str', 'sl_micro', '✉️', 'MICRO', 'Scrivi un messaggio con la combinazione MICRO.', 'slcc.html#combo', [1, 5, 15], slm.filter(function (x) { return x.k === 'MICRO'; }).length);
    M('str', 'sl_macro', '📜', 'MACRO', 'Scrivi un messaggio con la combinazione MACRO.', 'slcc.html#combo', [1, 5, 15], slm.filter(function (x) { return x.k === 'MACRO'; }).length);
    var early = inc.filter(function (x) { var e = x.e || {}; return ['E', 'A', 'R', 'L', 'Y'].every(function (k) { return (e[k] || '').trim(); }); }).length;
    M('str', 'early', '🐦', 'EARLY', 'Compila tutte e 5 le lettere EARLY in una scheda «Prima di un incontro».', 'incontro.html', [1, 5, 15], early);
    M('str', 'e3_days', '🗓️', 'Strumento del giorno', 'Giorni in cui hai provato lo strumento E³ del giorno.', 'index.html', [7, 30, 100], Object.keys(daily).length, { unit: 'giorni' });
    var asp = {}; if (pk && pk.e3) pk.e3.phases.forEach(function (p) { (p.aspects || []).forEach(function (a) { asp[a.k] = p.k; }); });
    M('str', 'e3_full', '🎬', 'Copione completo', 'In Prepara, scrivi il copione E³ con almeno una battuta per Engage, Explain ed Exchange.', 'prep.html#nuova', [1, 5, 15], preps.filter(function (p) { var e = p.e3 || {}, f = {}; Object.keys(e).forEach(function (k) { var v = e[k] || {}; if ((v.text || '').trim() || v.tool) f[asp[k]] = 1; }); return f.engage && f.explain && f.exchange; }).length);
    M('str', 'dpi_after', '🧩', 'Profiler', 'Compila il Dopo di una sessione D-P-I.', 'protocollo.html', [1, 10, 30], c.after);
    M('str', 'fb_both', '🤲', 'Doppio feedback', 'Usa sia RINGS sia ARISE almeno una volta.', 'feedback.html', null, fbs.some(function (x) { return x.model === 'rings'; }) && fbs.some(function (x) { return x.model === 'arise'; }));
    M('str', 'sl_n', '🖼️', 'Ritrattista', 'Crea il profilo SLCC di una persona.', 'slcc.html', [1, 5, 15], sl.length);
    M('str', 'sl_both', '🎼', 'Combinazione doppia', 'Scrivi sia un MICRO sia un MACRO per la stessa persona.', 'slcc.html#combo', null, sl.some(function (x) { return slm.some(function (m) { return m.who === x.id && m.k === 'MICRO'; }) && slm.some(function (m) { return m.who === x.id && m.k === 'MACRO'; }); }));
    M('str', 'inc_dic', '👗', 'Stilista', 'In una scheda «Prima di un incontro», scegli dove stare su tutte e 5 le dicotomie del look.', 'incontro.html', null, inc.some(function (x) { var d = x.dic || {}; return [0, 1, 2, 3, 4].every(function (i) { return d[i] != null && d[i] !== ''; }); }));
    M('str', 'inc_amb', '🛋️', 'Ambiente letto', 'Scrivi cosa c\'è di significativo nel luogo dell\'incontro e come lo gestisci.', 'incontro.html', [1, 5, 15], inc.filter(function (x) { return (x.amb || '').trim(); }).length);
    M('str', 'inc_av', '🧼', 'Parole pulite', 'Spunta tutte le frasi da non dire in una scheda «Prima di un incontro».', 'incontro.html', null, inc.some(function (x) { var a = x.av || {}; return Object.keys(a).filter(function (k) { return a[k]; }).length >= 7; }));
    [['cliente', '💼', 'Nuovo cliente'], ['colloquio', '🧑‍💼', 'Colloquio'], ['telefono', '📞', 'Telefonata'], ['video', '💻', 'Videochiamata'], ['pubblico', '🎤', 'In pubblico'], ['team', '👥', 'Nuovo nel team'], ['intro', '🙋', 'Presentato da altri'], ['bambini', '🧸', 'Con i bambini'], ['social', '📱', 'Social o sito']].forEach(function (x) {
      var n = inc.filter(function (y) { return y.ctx === x[0]; }).length;
      M('str', 'ctx_' + x[0], x[1], x[2], 'Prepara una scheda «Prima di un incontro» di tipo «' + x[2] + '».', 'incontro.html', null, n, { cnt: n }); });
    /* --- Su di te --- */
    M('io', 'check', '🪞', 'Specchio', 'Fai il check-in in Io.', 'io.html#oggi', [7, 30, 100], c.check);
    M('io', 'flow', '🌊', 'Flow', 'Porta a termine una sessione di focus con il timer.', 'io.html#focus', [5, 15, 50], foc.filter(function (x) { return x.full; }).length);
    M('io', 'fondo', '🏊', 'Fondo', 'Completa una sessione di focus da 30 minuti.', 'io.html#focus', null, foc.some(function (x) { return x.full && x.min >= 30; }));
    var emoAll = emo.filter(function (x) { var f = x.f || {}; return Object.keys(f).filter(function (k) { return (f[k] || '').trim(); }).length >= 7; }).length;
    M('io', 'emo', '☸️', 'Timoniere', 'Gestisci un\'emozione scrivendo tutte e 7 le fasi.', 'io.html#emozioni', [1, 5, 15], emoAll);
    var pr = pred.filter(function (x) { return x.kind === 'pred' && x.res; }), hit = pr.filter(function (x) { return (x.res === 'si') === (x.prob >= 50); }).length;
    M('io', 'pred', '🔮', 'Previsore', 'Registra previsioni nella scheda Bias e segna com\'è andata.', 'io.html#bias', [3, 10, 30], pr.length);
    M('io', 'calib', '⚖️', 'Ben calibrato', 'Almeno 10 previsioni risolte e 7 su 10 azzeccate (soglia scelta dall\'app).', 'io.html#bias', null, pr.length >= 10 && hit / pr.length >= 0.7, { prog: [pr.length >= 10 ? Math.round(100 * hit / pr.length) + '%' : pr.length + '/10'] });
    M('io', 'week', '📅', 'Settimane', 'Fai la revisione della settimana.', 'io.html#settimana', [1, 4, 12], c.week);
    var ck = L2('io_check_v1', {}), words = {}; Object.keys(ck).forEach(function (d) { var w = ((ck[d] || {}).emo || '').trim().toLowerCase(); if (w) words[w] = 1; });
    M('io', 'vocab', '🎨', 'Vocabolario emotivo', 'Nel check-in, dai un nome preciso a ciò che provi: conta le parole diverse che usi.', 'io.html#oggi', [10, 25, 50], Object.keys(words).length, { unit: 'parole' });
    var fmin = foc.reduce(function (a, x) { return a + (x.min || 0); }, 0);
    M('io', 'fmin', '⏳', 'Minuti di focus', 'Minuti totali delle sessioni di focus.', 'io.html#focus', [60, 600, 3000], fmin, { unit: 'min' });
    M('io', 'fclean', '🧘', 'Zero distrazioni', 'Una sessione di focus completa senza segnare distrazioni.', 'io.html#focus', [1, 10, 30], foc.filter(function (x) { return x.full && !x.distr; }).length);
    M('io', 'fback', '🪃', 'Rifocalizzato', 'Segna una distrazione e torna sul compito, come insegna il corso.', 'io.html#focus', [1, 10, 30], foc.reduce(function (a, x) { return a + (x.distr || 0); }, 0));
    var trg = L2('io_trig_v1', []);
    M('io', 'trig', '🔑', 'Trigger personali', 'Crea un trigger tuo nella scheda Emozioni.', 'io.html#emozioni', [1, 3, 10], trg.length);
    M('io', 'trig_u', '🎛️', 'Trigger usati', 'Usa un trigger in un momento vero e segnalo.', 'io.html#emozioni', [1, 10, 30], trg.reduce(function (a, x) { return a + (x.used || 0); }, 0));
    M('io', 'over', '😈', 'Avvocato del diavolo', 'Rifletti su una decisione con le domande contro l\'eccesso di fiducia (scheda Bias).', 'io.html#bias', [1, 5, 15], pred.filter(function (x) { return x.kind === 'over'; }).length);
    M('io', 'self', '🧐', 'Sguardo onesto', 'Rifletti su di te con le domande sul bias dell\'autovalutazione (scheda Bias).', 'io.html#bias', [1, 5, 15], pred.filter(function (x) { return x.kind === 'self'; }).length);
    /* --- Studio --- */
    if (pk && pk.data) {
      var by = {}, ar = {};
      pk.data.mods.forEach(function (m) { (by[m.l] = by[m.l] || []).push(m.id); });
      var ex3 = function (id) { var s = exa[id] || {}; return ['t1', 't2', 't3', 't4'].filter(function (k) { return s[k]; }).length >= 3; };
      pk.data.levels.forEach(function (l) { var ids = by[l.k] || [], n = ids.length, st = ids.filter(function (id) { return done[id] > 0; }).length,
        exIds = ids.filter(function (id) { return pk.ex && pk.ex[id]; }), exd = exIds.filter(ex3).length;
        var tier = st === n && n ? (exd === exIds.length ? 2 : 1) : (st * 2 >= n && n ? 0 : -1);
        (ar[l.p] = ar[l.p] || []).push(st === n && n > 0);
        out.push({ g: 'stu', k: 'lv_' + l.k, e: LV_EMO[l.k] || '🎓', n: l.n, how: 'Bronzo: metà dei moduli studiati. Argento: tutti studiati. Oro: anche esercitati (almeno 3 prove su 4).', href: 'percorso.html', tlab: ['metà', 'tutti', 'esercitati'], tier: tier, got: tier >= 0, prog: [st + '/' + n + ' studiati' + (exIds.length ? ', ' + exd + '/' + exIds.length + ' esercitati' : '')] }); });
      Object.keys(ar).forEach(function (a) { M('stu', 'ar_' + a, AR_EMO[a] || '🎓', a, 'Completa tutti i livelli dell\'area ' + a + '.', 'percorso.html', null, ar[a].every(Boolean), { prog: [ar[a].filter(Boolean).length + '/' + ar[a].length + ' livelli'] }); });
    }
    GYM_T.forEach(function (t) { M('stu', 'gym_' + t[0], '💯', '10/10 · ' + t[1], 'Un giro di Palestra su «' + t[1] + '» senza errori, almeno 10 domande.', 'palestra.html', null, gym.some(function (x) { return x.tp === t[0] && x.n >= 10 && x.ok === x.n; })); });
    var r137 = {}; Object.keys(rip).forEach(function (k) { var id = k.split('@')[0]; r137[id] = (r137[id] || 0) + 1; });
    M('stu', 'r137', '🧠', 'Memoria di ferro', 'Ripassa lo stesso modulo a 1, 3 e 7 giorni.', 'index.html', [1, 10, 30], Object.keys(r137).filter(function (id) { return r137[id] >= 3; }).length);
    M('stu', 'kid', '🧒', 'Spiegalo a un bambino', 'In «Esercitati», fai la prova «Spiegalo» di un modulo.', 'percorso.html', [5, 25, 100], Object.keys(exa).filter(function (id) { return (exa[id] || {}).t2; }).length);
    M('stu', 'mine', '✍️', 'Le mie espressioni', 'Aggiungi espressioni tue nel Dizionario.', 'dizionario.html#mie', [1, 10, 30], mine.length);
    var exk = function (k) { return Object.keys(exa).filter(function (id) { return (exa[id] || {})[k]; }).length; };
    M('stu', 'ex_t1', '🃏', 'Flashcard', 'In «Esercitati», completa il test sul momento di un modulo.', 'percorso.html', [5, 25, 100], exk('t1'));
    M('stu', 'ex_t3', '🕳️', 'Lacune colmate', 'In «Esercitati», completa «Colma le lacune».', 'percorso.html', [5, 25, 100], exk('t3'));
    M('stu', 'ex_t4', '✂️', 'Semplificatore', 'In «Esercitati», completa «Organizza e semplifica».', 'percorso.html', [5, 25, 100], exk('t4'));
    var gOk = gym.reduce(function (a, x) { return a + (x.ok || 0); }, 0);
    M('stu', 'gym_ok', '✔️', 'Risposte giuste', 'Risposte giuste in Palestra, in totale.', 'palestra.html', [100, 500, 2000], gOk);
    M('stu', 'gym_err', '🥊', 'Rivincita', 'In Palestra, rifai le domande che avevi sbagliato.', 'palestra.html', [1, 5, 15], gym.filter(function (x) { return x.tp === 'err'; }).length);
    M('stu', 'gym_mix', '🎲', 'Tutto insieme', 'Un giro di Palestra su tutti gli argomenti insieme.', 'palestra.html', [1, 10, 30], gym.filter(function (x) { return x.tp === 'all'; }).length);
    var perDay = {}, hrs = { m: 0, n: 0 }; Object.keys(done).forEach(function (id) { var t = done[id]; if (!(t > 1e12)) return; var d = new Date(t), k = dayKey(t); perDay[k] = (perDay[k] || 0) + 1; if (d.getHours() < 8) hrs.m++; if (d.getHours() >= 22) hrs.n++; });
    var maxDay = Math.max.apply(null, [0].concat(Object.keys(perDay).map(function (k) { return perDay[k]; })));
    M('stu', 'maraton', '🏁', 'Maratona di studio', 'Moduli studiati nello stesso giorno.', 'percorso.html', [5, 10, 20], maxDay, { unit: 'moduli' });
    M('stu', 'early', '🐓', 'Mattiniero', 'Studia un modulo prima delle 8.', 'percorso.html', null, hrs.m > 0, { cnt: hrs.m });
    M('stu', 'owl', '🦉', 'Nottambulo', 'Studia un modulo dopo le 22.', 'percorso.html', null, hrs.n > 0, { cnt: hrs.n });
    /* --- Costanza --- */
    var ds = Object.keys(S.days).sort(), bs = 0, run = 0, prev = null;
    ds.forEach(function (d) { var t = Date.parse(d + 'T12:00:00'); run = prev != null && Math.round((t - prev) / 864e5) === 1 ? run + 1 : 1; prev = t; if (run > bs) bs = run; });
    M('base', 'streak', '🔥', 'Costanza', 'Usa l\'app tutti i giorni (record di giorni di fila).', 'index.html', [3, 7, 30], bs, { unit: 'giorni' });
    M('base', 'xp', '⚡', 'Punti', 'Ogni attività vale XP.', 'index.html', [500, 2000, 5000], S.xp, { unit: 'XP' });
    M('base', 'mod', '📖', 'Studio', 'Segna «✓ Studiato» alla fine di un modulo.', 'percorso.html', [10, 50, 150], S.mods, { unit: 'moduli' });
    M('base', 'rip', '🔁', 'Ripasso', 'I ripassi di 1, 3 e 7 giorni, in Home.', 'index.html', [5, 25, 100], c.rip);
    M('base', 'gym', '🏋️', 'Palestra', 'Un giro di domande in Palestra.', 'palestra.html', [5, 25, 100], gym.length);
    M('base', 'days', '📍', 'Presenze', 'Giorni in cui hai usato l\'app, in totale.', 'index.html', [10, 50, 200], ds.length, { unit: 'giorni' });
    var back = false; for (var q = 1; q < ds.length; q++) if ((Date.parse(ds[q]) - Date.parse(ds[q - 1])) / 864e5 >= 7) back = true;
    M('base', 'back', '👋', 'Bentornato', 'Torna a usare l\'app dopo almeno una settimana di pausa: conta ripartire.', 'index.html', null, back);
    var wk = ds.some(function (d) { var t = new Date(d + 'T12:00:00'); return t.getDay() === 6 && S.days[dayKey(t.getTime() + 864e5)]; });
    M('base', 'wkend', '🏖️', 'Anche nel weekend', 'Usa l\'app sia il sabato sia la domenica dello stesso weekend.', 'index.html', null, wk);
    M('base', 'all', '🧭', 'Esploratore', 'Usa almeno una volta Prepara, D-P-I, IBM, Feedback, Palestra, SLCC, Prima di un incontro, Io ed Esercitati.', 'strumenti.html', null,
      preps.length && c.ses && mlog.length && fbs.length && gym.length && (sl.length || slm.length) && inc.length && c.check && Object.keys(exa).length);
    M('base', 'backup', '💾', 'Al sicuro', 'Esporta il tuo primo backup.', 'index.html#set-bk', null, +(lsGet('ui_last_backup') || 0) > 0);
    return out;
  }
  function medalUnits(m) { return (m.th || m.tlab) ? (m.tier + 1) : (m.got ? 1 : 0); }
  function medalMax(m) { return m.th ? m.th.length : (m.tlab ? 3 : 1); }
  /* medaglia nuova: un avviso in basso, una volta sola */
  function medalCheck() {
    pack().then(function (pk) { if (!pk) return;
      var all = medals(pk), seen = J(lsGet('medals_seen_v3'), null), first = !seen; seen = seen || {};
      all.forEach(function (m) { m.sk = m.k + (m.tier != null && m.tier >= 0 ? '#' + m.tier : ''); });
      var nu = all.filter(function (m) { return m.got && !seen[m.sk]; });
      nu.forEach(function (m) { seen[m.sk] = first ? 1 : Date.now(); }); lsSet('medals_seen_v3', JSON.stringify(seen));
      if (first || !nu.length) return;
      var t = document.createElement('a'); t.href = 'io.html#medaglie'; t.className = 'medal-toast'; t.setAttribute('role', 'status');
      t.innerHTML = '<span class="mt-ic">🏅</span><span><b>' + (nu.length > 1 ? nu.length + ' medaglie nuove' : 'Medaglia sbloccata') + '</b><span>' + nu.slice(0, 3).map(function (m) { return m.e + ' ' + m.n + (m.tier != null && m.tier >= 0 && (m.th || m.tlab) ? ' · ' + ['bronzo', 'argento', 'oro'][m.tier] : ''); }).join(', ').replace(/[<>&]/g, '') + (nu.length > 3 ? ' e altre ' + (nu.length - 3) : '') + '</span></span>';
      var st = document.createElement('style');
      st.textContent = '.medal-toast{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom,0px));z-index:50;display:flex;gap:12px;align-items:center;max-width:min(92vw,420px);padding:12px 16px;border-radius:18px;background:var(--fg);color:var(--bg);text-decoration:none;box-shadow:0 8px 24px rgba(0,0,0,.25);animation:mtin .3s ease-out}.medal-toast .mt-ic{font-size:1.8rem}.medal-toast b{display:block;font-weight:900}.medal-toast span span{font-size:.88rem;font-weight:700}@keyframes mtin{from{opacity:0;transform:translate(-50%,16px)}}@media (prefers-reduced-motion:reduce){.medal-toast{animation:none}}';
      document.head.appendChild(st); document.body.appendChild(t);
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 6000);
    }).catch(function () {});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(medalCheck, 900); }); else setTimeout(medalCheck, 900);
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  return { get: get, pack: pack, ready: ready, importPack: importPack, exportBackup: exportBackup, importBackup: importBackup, save: save, pickButton: pickButton, nav: nav, stats: stats, dayKey: dayKey, lsJ: lsJ, lsPut: lsPut, USER_KEYS: USER_KEYS, medals: medals, medalGroups: MEDAL_GROUPS, medalUnits: medalUnits, medalMax: medalMax, ui: { get: uiGet, set: uiSet } };
})();
