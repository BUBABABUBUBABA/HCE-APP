/* HCE app: database locale, pacchetto contenuti, backup, barra di navigazione */
var HCE = (function () {
  var DBN = 'hce-app', DBV = 1, dbp = null;
  var USER_KEYS = ['dpi_su_di_me_v1', 'dpi_know_v1', 'studio_hce_v1', 'e3_plans_v1', 'e3_daily_v1', 'ripasso_v1', 'mib_log_v1', 'prep_v1'];

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
    var p = JSON.parse(text);
    if (!p || p.app !== 'hce-contenuti') throw new Error('Questo non è il file dei contenuti HCE.');
    var pack = { version: p.version, vs: p.vs, vd: p.vd, data: p.data, areas: p.areas, sys: p.sys, toolnames: p.toolnames, unp: p.unp, books: p.books, e3: p.e3, mib: p.mib };
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
    return { name: 'HCE_backup_' + stamp + '.json', text: JSON.stringify({ app: 'hce-backup', date: d.toISOString(), data: data }, null, 1) };
  }
  function J(s, d) { try { return s ? JSON.parse(s) : d; } catch (e) { return d; } }
  function importBackup(text) {
    var b = JSON.parse(text);
    if (!b || b.app !== 'hce-backup' || !b.data) throw new Error('Questo non è un file di backup HCE.');
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
    // matrice: unione per id
    var ma = J(lsGet('mib_log_v1'), []), mb = J(b.data['mib_log_v1'], []);
    if (Array.isArray(mb)) {
      var mseen = {}; ma.forEach(function (x) { mseen[x.id] = 1; });
      mb.forEach(function (x) { if (x && !mseen[x.id]) { ma.push(x); n++; } });
      ma.sort(function (x, y) { return +y.id - +x.id; });
      lsSet('mib_log_v1', JSON.stringify(ma));
    }
    // strumento del giorno e ripassi: unione delle chiavi
    ['e3_daily_v1', 'ripasso_v1'].forEach(function (k) {
      var x = J(lsGet(k), {}) || {}, y = J(b.data[k], {}) || {};
      Object.keys(y).forEach(function (q) { if (!(q in x)) { x[q] = y[q]; n++; } });
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
    mib: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18"/>'
  };
  function nav(cur) {
    var items = [['index.html', 'Home', 'home'], ['percorso.html', 'Percorso', 'percorso'], ['prep.html', 'Prepara', 'prep'], ['strumenti.html', 'Strumenti', 'tools'], ['protocollo.html', 'D-P-I', 'dpi']];
    var on = cur === 'studio' ? 'percorso' : (cur === 'e3' || cur === 'mib' || cur === 'tool') ? 'tools' : cur;
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
      plans = J(lsGet('e3_plans_v1'), []) || [], daily = J(lsGet('e3_daily_v1'), {}) || {}, rip = J(lsGet('ripasso_v1'), {}) || {}, mlog = J(lsGet('mib_log_v1'), []) || [], preps = J(lsGet('prep_v1'), []) || [];
    var ev = [], nm = 0;
    function add(t, type, xp, ref) { if (t > 1e12) ev.push({ t: t, d: dayKey(t), type: type, xp: xp, ref: ref }); }
    Object.keys(done).forEach(function (k) { var t = done[k]; if (t > 0) { nm++; add(t, 'mod', 10, k); } });
    ses.forEach(function (s) { add(+s.id, 'ses', 30, s.id); if (s.after) add(s.after.t || Date.parse(s.after.date + 'T12:00:00') || +s.id, 'after', 10, s.id); });
    plans.forEach(function (x) { add(+x.id, 'plan', 20, x.id); });
    Object.keys(daily).forEach(function (k) { var v = daily[k]; if (v && v.t) add(v.t, 'tool', 10, v.n); });
    Object.keys(rip).forEach(function (k) { add(rip[k], 'rip', 5, k); });
    mlog.forEach(function (x) { add(+x.id, 'mib', 15, x.id); });
    preps.forEach(function (x) { add(+x.id, 'prep', 20, x.id); if (x.after && x.after.t) add(x.after.t, 'prepafter', 10, x.id); });
    var days = {}, xp = 0, today = dayKey(Date.now()), T = { mod: 0, ses: 0, plan: 0, tool: 0, rip: 0, after: 0, mib: 0, prep: 0, prepafter: 0 };
    ev.forEach(function (e) { days[e.d] = 1; xp += e.xp; if (e.d === today) T[e.type]++; });
    var streak = 0, d = new Date();
    if (!days[dayKey(d)]) d.setDate(d.getDate() - 1);
    while (days[dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
    var plan = [Math.min(T.mod, 2) / 2, (T.ses + T.after + T.plan + T.mib + T.prep + T.prepafter) ? 1 : 0, T.tool ? 1 : 0];
    return { xp: xp, streak: streak, today: !!days[today], todayKey: today, days: days, events: ev, T: T,
      mods: nm, sessions: ses.length, plans: plans.length, preps: preps, done: done, ses: ses, planList: plans, daily: daily, rip: rip,
      goal: plan.filter(function (x) { return x >= 1; }).length, goalMax: 3, plan: plan };
  }
  function lsJ(k, d) { return J(lsGet(k), d); }
  function lsPut(k, v) { lsSet(k, JSON.stringify(v)); }

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  return { get: get, pack: pack, ready: ready, importPack: importPack, exportBackup: exportBackup, importBackup: importBackup, save: save, pickButton: pickButton, nav: nav, stats: stats, dayKey: dayKey, lsJ: lsJ, lsPut: lsPut, USER_KEYS: USER_KEYS };
})();
