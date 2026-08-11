// ============================================================
// RETAIL TOUR — Carga y fusión de datos
// Combina el histórico base (JSON estático) con los meses nuevos
// que se hayan subido a Firestore, para que la vista sea la misma
// sin importar desde qué dispositivo se abra la app.
//
// IMPORTANTE sobre memoria: nada de esto se carga todo de una vez.
// - Los archivos estáticos grandes (~77MB en total) se traen "por
//   partes" (shards), solo cuando el vendedor navega a esa parte.
// - Los meses subidos por el botón ⇪ se guardan en Firestore UN
//   DOCUMENTO POR CLIENTE (no uno por mes con todas las cuentas), y
//   también se traen solo del cliente que se está viendo. Así, por
//   más meses que se acumulen (agosto, septiembre...), nunca se
//   descarga todo de golpe — ni al abrir la app, ni al navegar.
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
  const { getFirestore, collection, getDocs, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
  fbApp = initializeApp(firebaseConfig);
  fbDb = getFirestore(fbApp);
  window.__fb = { getFirestore, collection, getDocs, doc, getDoc, setDoc, db: fbDb };
  return window.__fb;
}

async function fetchJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('No se pudo cargar ' + path);
  return res.json();
}

function clientDocId(cliente) {
  return cliente.replace(/\//g, '_').slice(0, 300);
}

/**
 * Carga solo lo liviano al iniciar: nav.json, cliente_periodo.json, el
 * mapa de qué cliente vive en qué archivo (shard_map.json), y un pequeño
 * "aviso" de si alguna cuenta nueva (que no existía en la base original)
 * fue agregada por el botón ⇪, para que aparezca en la navegación.
 * NO carga los archivos grandes de sucursales ni los meses de Firestore
 * de cada cliente todavía — eso pasa bajo demanda con ensureClienteDataLoaded().
 */
async function loadAllData() {
  const [nav, clientePeriodo, shardMap] = await Promise.all([
    fetchJSON('./data/nav.json'),
    fetchJSON('./data/cliente_periodo.json'),
    fetchJSON('./data/shard_map.json')
  ]);

  try {
    const fb = await initFirebase();
    const navSnap = await fb.getDoc(fb.doc(fb.db, 'monthly_uploads_meta', 'nav_updates'));
    if (navSnap.exists()) mergeNav(nav, navSnap.data().nav || {});
  } catch (err) {
    console.warn('No se pudo traer el aviso de cuentas nuevas (nav_updates):', err);
  }

  return {
    nav, clientePeriodo, shardMap,
    sucursalPeriodo: {},          // se va llenando con ensureClienteDataLoaded()
    loadedShards: new Set(),
    loadedClientUploads: new Set() // clientes cuyos meses de Firestore ya se trajeron
  };
}

/**
 * Se asegura de que estos clientes ya tengan sus datos de sucursales en
 * memoria (state.sucursalPeriodo): trae el archivo estático (shard) que
 * les corresponda si hace falta, y también revisa Firestore por si ese
 * cliente tiene meses subidos por el botón ⇪ — todo por cliente, nunca
 * "todo de todos" de una vez.
 */
async function ensureClienteDataLoaded(state, clienteNames) {
  const shardsNeeded = new Set();
  for (const cliente of clienteNames) {
    const shard = state.shardMap[cliente];
    if (shard && !state.loadedShards.has(shard)) shardsNeeded.add(shard);
  }
  if (shardsNeeded.size) {
    const shardsArr = Array.from(shardsNeeded);
    const parts = await Promise.all(shardsArr.map(s => fetchJSON(`./data/sucursal_periodo_${s}.json`)));
    for (let i = 0; i < shardsArr.length; i++) {
      mergeSucursalPeriodo(state.sucursalPeriodo, parts[i]);
      state.loadedShards.add(shardsArr[i]);
    }
  }

  const clientesFirestore = clienteNames.filter(c => !state.loadedClientUploads.has(c));
  if (clientesFirestore.length) {
    let fb;
    try { fb = window.__fb || await initFirebase(); } catch (err) { console.warn('Firestore no disponible:', err); fb = null; }
    if (fb) {
      await Promise.all(clientesFirestore.map(async cliente => {
        try {
          const snap = await fb.getDoc(fb.doc(fb.db, 'monthly_uploads_by_client', clientDocId(cliente)));
          if (snap.exists()) {
            const data = snap.data();
            mergeClientePeriodo(state.clientePeriodo, data.cliente_periodo || {});
            mergeSucursalPeriodo(state.sucursalPeriodo, data.sucursal_periodo || {});
          }
        } catch (err) {
          console.warn('No se pudo traer Firestore para', cliente, err);
        }
        state.loadedClientUploads.add(cliente);
      }));
    }
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
 * Guarda los meses de UN cliente en Firestore, en un solo documento chico
 * (no todos los clientes juntos como antes). `payload` tiene la forma
 * { cliente, cliente_periodo, sucursal_periodo, nav }. Además actualiza un
 * pequeño "aviso" de navegación por si esa cuenta o sucursal es nueva, para
 * que aparezca de inmediato en la lista sin tener que cargar todo Firestore.
 */
async function saveClientUpload(payload) {
  const fb = window.__fb || await initFirebase();
  const docId = clientDocId(payload.cliente);
  await fb.setDoc(fb.doc(fb.db, 'monthly_uploads_by_client', docId), payload);

  const navRef = fb.doc(fb.db, 'monthly_uploads_meta', 'nav_updates');
  let existingNav = {};
  try {
    const snap = await fb.getDoc(navRef);
    if (snap.exists()) existingNav = snap.data().nav || {};
  } catch (err) { /* si no existe todavía, se crea */ }
  mergeNav(existingNav, payload.nav || {});
  await fb.setDoc(navRef, { nav: existingNav });
}
