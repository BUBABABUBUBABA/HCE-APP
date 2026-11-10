/* HCE app: database locale, pacchetto contenuti, backup, barra di navigazione */
var HCE = (function () {
  var DBN = 'hce-app', DBV = 1, dbp = null;
  var USER_KEYS = ['dpi_su_di_me_v1', 'dpi_know_v1', 'studio_hce_v1'];

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
    var pack = { version: p.version, vs: p.vs, vd: p.vd, data: p.data, areas: p.areas, sys: p.sys, toolnames: p.toolnames, unp: p.unp, books: p.books };
    return clear('appunti')
      .then(function () { return putAll('appunti', p.appunti); })
      .then(function () { return putAll('meta', { pack: pack, cerca: p.cerca }); })
      .then(function () { return pack; });
  }
  function pack() { return get('meta', 'pack'); }
  function ready(fn) {
    pack().then(function (p) {
      if (!p) { location.replace('index.html#contenuti'); return; }
      fn(p);
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
  function nav(cur) {
    var items = [['index.html', 'Home', 'home'], ['studio.html', 'Studio', 'studio'], ['protocollo.html', 'Protocollo D-P-I', 'dpi']];
    var bar = document.createElement('div');
    bar.className = 'appbar';
    bar.innerHTML = items.map(function (i) {
      return '<a href="' + i[0] + '"' + (i[2] === cur ? ' aria-current="page"' : '') + '>' + i[1] + '</a>';
    }).join('');
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  if (navigator.storage && navigator.storage.persist) { navigator.storage.persist().catch(function () {}); }

  return { get: get, pack: pack, ready: ready, importPack: importPack, exportBackup: exportBackup, importBackup: importBackup, save: save, nav: nav, USER_KEYS: USER_KEYS };
})();
