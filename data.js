// ============================================================
// RETAIL TOUR — Carga y fusión de datos
// Combina el histórico base (JSON estático) con los meses nuevos
// que se hayan subido a Firestore, para que la vista sea la misma
// sin importar desde qué dispositivo se abra la app.
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
 * Carga nav.json, cliente_periodo.json, los 4 archivos de sucursal_periodo
 * (partidos por región para no pasar el límite de 25MB de GitHub) y
 * los documentos de Firestore (monthly_uploads), y devuelve todo
 * fusionado en memoria.
 */
const SUCURSAL_REGIONS = ['CEN', 'CAR', 'COL', 'VEN'];

async function loadAllData() {
  const [nav, clientePeriodo, ...sucursalParts] = await Promise.all([
    fetchJSON('./data/nav.json'),
    fetchJSON('./data/cliente_periodo.json'),
    ...SUCURSAL_REGIONS.map(r => fetchJSON(`./data/sucursal_periodo_${r}.json`))
  ]);
  const sucursalPeriodo = Object.assign({}, ...sucursalParts);

  let uploads = [];
  try {
    const fb = await initFirebase();
    const snap = await fb.getDocs(fb.collection(fb.db, 'monthly_uploads'));
    snap.forEach(d => uploads.push(d.data()));
  } catch (err) {
    console.warn('No se pudo conectar a Firestore, se usará solo el histórico base:', err);
  }

  // Fusionar cada upload (meses nuevos ganan sobre el histórico base para ese mismo periodo)
  uploads.sort((a, b) => a.periodo - b.periodo);
  for (const up of uploads) {
    mergeClientePeriodo(clientePeriodo, up.cliente_periodo || {});
    mergeSucursalPeriodo(sucursalPeriodo, up.sucursal_periodo || {});
    mergeNav(nav, up.nav || {});
  }

  return { nav, clientePeriodo, sucursalPeriodo, uploadedPeriods: uploads.map(u => u.periodo) };
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
      if (!base[cliente][sucursal]) base[cliente][sucursal] = { periods: [], unHist: {}, catHist: {} };
      const store = base[cliente][sucursal];

      mergeSeriesByPeriod(store.periods, incoming.periods || []);

      for (const un in (incoming.unHist || {})) {
        store.unHist[un] = store.unHist[un] || [];
        mergeSeriesByPeriod(store.unHist[un], incoming.unHist[un]);
      }
      for (const cat in (incoming.catHist || {})) {
        store.catHist[cat] = store.catHist[cat] || [];
        mergeSeriesByPeriod(store.catHist[cat], incoming.catHist[cat]);
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
 * Guarda un mes nuevo en Firestore. `payload` debe tener la forma
 * { periodo, cliente_periodo, sucursal_periodo, nav }.
 */
async function saveMonthlyUpload(payload) {
  const fb = window.__fb || await initFirebase();
  const docId = String(payload.periodo);
  await fb.setDoc(fb.doc(fb.db, 'monthly_uploads', docId), payload);
}
