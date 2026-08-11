// ============================================================
// RETAIL TOUR — Carga y fusión de datos
// Combina el histórico base (JSON estático) con los meses nuevos
// que se hayan subido a Firestore, para que la vista sea la misma
// sin importar desde qué dispositivo se abra la app.
//
// IMPORTANTE: los datos de sucursales (~77MB en total) NO se cargan
// todos de una vez — eso hacía que Safari en iPhone se quedara sin
// memoria y cerrara la página ("A problem repeatedly occurred").
// En vez de eso, se cargan "por partes" (shards) solo cuando el
// vendedor realmente navega a las cuentas de esa parte.
// ============================================================

const firebaseConfig = {
  apiKey: "AIzaSyAtAGkwFQCvWbdiwG1rQfSPH8Y2-6fAnj8",
  authDomain: "retail-b5af4.firebaseapp.com",
  projectId: "retail-b5af4",
  storageBucket: "retail-b5af4.firebasestorage.app",
  messagingSenderId: "201612595555",
  appId: "1:201612595555:web:04c5ccbf26f2613dd4c356"
};

let fbApp = null, fbDb = null;

async function initFirebase() {
  const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
  const { getFirestore, collection, getDocs, doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  fbApp = initializeApp(firebaseConfig);
  fbDb = getFirestore(fbApp);
  window.__fb = { getFirestore, collection, getDocs, doc, setDoc, db: fbDb };
  return window.__fb;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('No se pudo cargar ' + path);
  return res.json();
}

/**
 * Carga solo lo liviano al iniciar: nav.json, cliente_periodo.json, el
 * mapa de qué cliente vive en qué archivo (shard_map.json), y los meses
 * subidos por Firestore (se guardan en crudo para poder re-aplicarlos
 * cada vez que se cargue un shard nuevo). NO carga los archivos grandes
 * de sucursales todavía — eso pasa bajo demanda con ensureShardsLoaded().
 */
async function loadAllData() {
  const [nav, clientePeriodo, shardMap] = await Promise.all([
    fetchJSON('./data/nav.json'),
    fetchJSON('./data/cliente_periodo.json'),
    fetchJSON('./data/shard_map.json')
  ]);

  let rawUploads = [];
  try {
    const fb = await initFirebase();
    const snap = await fb.getDocs(fb.collection(fb.db, 'monthly_uploads'));
    snap.forEach(d => rawUploads.push(d.data()));
  } catch (err) {
    console.warn('No se pudo conectar a Firestore, se usará solo el histórico base:', err);
  }
  rawUploads.sort((a, b) => a.periodo - b.periodo);

  // cliente_periodo y nav son livianos: los meses subidos se aplican de una vez
  for (const up of rawUploads) {
    mergeClientePeriodo(clientePeriodo, up.cliente_periodo || {});
    mergeNav(nav, up.nav || {});
  }

  return {
    nav, clientePeriodo, shardMap, rawUploads,
    sucursalPeriodo: {},       // se va llenando con ensureShardsLoaded()
    loadedShards: new Set()
  };
}

/**
 * Se asegura de que los archivos de sucursales de estos clientes ya estén
 * cargados en memoria (state.sucursalPeriodo). Si algún shard todavía no
 * se ha pedido, lo trae y lo fusiona — y de paso vuelve a aplicar los
 * meses de Firestore por si tenían datos de esos clientes.
 */
async function ensureShardsLoaded(state, clienteNames) {
  const needed = new Set();
  for (const cliente of clienteNames) {
    const shard = state.shardMap[cliente];
    if (shard && !state.loadedShards.has(shard)) needed.add(shard);
  }
  if (!needed.size) return;

  const shardsArr = Array.from(needed);
  const parts = await Promise.all(shardsArr.map(s => fetchJSON(`./data/sucursal_periodo_${s}.json`)));
  for (let i = 0; i < shardsArr.length; i++) {
    mergeSucursalPeriodo(state.sucursalPeriodo, parts[i]);
    state.loadedShards.add(shardsArr[i]);
  }

  // Re-aplicar los meses de Firestore para que cubran también lo recién cargado
  for (const up of state.rawUploads) {
    mergeSucursalPeriodo(state.sucursalPeriodo, up.sucursal_periodo || {});
  }
}

function mergeClientePeriodo(base, delta) {
  for (const cliente in delta) {
    if (!base[cliente]) {
      base[cliente] = { region: delta[cliente].region, pais: delta[cliente].pais, hist: [] };
    }
    for (const row of delta[cliente].hist) {
      const existingIdx = base[cliente].hist.findIndex(r => r.p === row.p);
      if (existingIdx >= 0) base[cliente].hist[existingIdx] = row;
      else base[cliente].hist.push(row);
    }
    base[cliente].hist.sort((a, b) => a.p - b.p);
  }
}

function mergeSeriesByPeriod(baseArr, deltaArr) {
  for (const row of deltaArr) {
    const idx = baseArr.findIndex(r => r.p === row.p);
    if (idx >= 0) baseArr[idx] = row;
    else baseArr.push(row);
  }
  baseArr.sort((a, b) => a.p - b.p);
}

function mergeSucursalPeriodo(base, delta) {
  for (const cliente in delta) {
    if (!base[cliente]) base[cliente] = {};
    for (const sucursal in delta[cliente]) {
      const incoming = delta[cliente][sucursal];
      if (!base[cliente][sucursal]) base[cliente][sucursal] = { periods: [], cube: {} };
      const store = base[cliente][sucursal];

      mergeSeriesByPeriod(store.periods, incoming.periods || []);

      for (const p in (incoming.cube || {})) {
        store.cube[p] = incoming.cube[p]; // el mes nuevo reemplaza por completo el detalle de ese periodo
      }
    }
  }
}

function mergeNav(base, delta) {
  for (const region in delta) {
    if (!base[region]) base[region] = {};
    for (const pais in delta[region]) {
      if (!base[region][pais]) base[region][pais] = {};
      for (const cliente in delta[region][pais]) {
        if (!base[region][pais][cliente]) base[region][pais][cliente] = [];
        for (const suc of delta[region][pais][cliente]) {
          if (!base[region][pais][cliente].includes(suc)) base[region][pais][cliente].push(suc);
        }
      }
    }
  }
}

/**
 * Guarda un "pedazo" (chunk) de un mes en Firestore. Un mes completo con
 * todas las cuentas puede pasar el límite de 1MB por documento, así que
 * cada payload trae `chunk` (0, 1, 2...) y se guarda como documento aparte
 * (ej. "202607_0", "202607_1"). `payload` tiene la forma
 * { periodo, chunk, cliente_periodo, sucursal_periodo, nav }.
 */
async function saveMonthlyUpload(payload) {
  const fb = window.__fb || await initFirebase();
  const docId = `${payload.periodo}_${payload.chunk ?? 0}`;
  await fb.setDoc(fb.doc(fb.db, 'monthly_uploads', docId), payload);
}
