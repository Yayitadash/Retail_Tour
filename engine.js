// ============================================================
// RETAIL TOUR — Motor de cálculo
// Única fuente de verdad para: crecimiento, ventas promedio, WOH
// y clasificación. Se usa tanto para renderizar como para procesar
// data nueva que suba el usuario.
// ============================================================

const MARCA_UN = { 456: 'FW', 789: 'APP', 790: 'EQ' };
const UN_CODES = new Set(['FW', 'APP', 'EQ', 'LIC']);
function unFromMarca(marca) {
  const asText = String(marca).trim().toUpperCase();
  if (UN_CODES.has(asText)) return asText; // el archivo ya trae FW/APP/EQ/LIC directo
  return MARCA_UN[Number(marca)] || 'LIC';  // formato viejo: código numérico de marca
}

const MESES_ES = ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function periodoLabel(p) {
  const y = Math.floor(p / 100), m = p % 100;
  return `${MESES_ES[m]} ${y}`;
}

function periodoAddMonths(p, delta) {
  const y = Math.floor(p / 100), m = p % 100;
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12), nm = (idx % 12) + 1;
  return ny * 100 + nm;
}

function sameMonthPrevYear(p) { return p - 100; }

const CLASIFICACIONES = {
  'Las Estrellas':   { color: '#D9A63C', label: 'Las Estrellas', icon: '⭐' },
  'Las Aceleradas':  { color: '#3C8B62', label: 'Las Aceleradas', icon: '🚀' },
  'Las Robustas':    { color: '#3B5B8C', label: 'Las Robustas', icon: '💪' },
  'Zona de Riesgo':  { color: '#C08A2E', label: 'Zona de Riesgo', icon: '⚠️' },
  'Desabastecidas':  { color: '#B85C3E', label: 'Desabastecidas', icon: '🛒' },
  'Riesgo Crítico':  { color: '#9C3B3B', label: 'Riesgo Crítico', icon: '🚨' }
};

/**
 * Dada una serie ordenada de {p,u,v,e} para UN cliente, calcula todas las
 * métricas para un periodo específico: crecimiento, ventas promedio, WOH,
 * clasificación.
 */
function computeMetricsForPeriod(series, periodo) {
  const byPeriod = {};
  series.forEach(r => { byPeriod[r.p] = r; });
  const row = byPeriod[periodo];
  if (!row) return null;

  const pyPeriod = sameMonthPrevYear(periodo);
  const pyRow = byPeriod[pyPeriod];

  let growthUnits = null, growthValor = null;
  if (pyRow && pyRow.u !== 0) growthUnits = (row.u - pyRow.u) / Math.abs(pyRow.u);
  if (pyRow && pyRow.v !== 0) growthValor = (row.v - pyRow.v) / Math.abs(pyRow.v);

  // Ventas promedio: ventana de hasta 12 meses hacia atrás, solo meses con data real
  const windowPeriods = new Set();
  for (let k = 0; k < 12; k++) windowPeriods.add(periodoAddMonths(periodo, -k));
  const avail = series.filter(r => windowPeriods.has(r.p));
  const nMonths = avail.length;
  const avgUnits = nMonths > 0 ? avail.reduce((s, r) => s + r.u, 0) / nMonths : null;

  let woh = null;
  if (avgUnits !== null && avgUnits !== 0) woh = (row.e / avgUnits) * 4.33;

  let clasif = null;
  if (row.v && row.e && growthUnits !== null && woh !== null) {
    if (growthUnits >= -0.02) {
      if (woh >= 20 && woh <= 26) clasif = 'Las Estrellas';
      else if (woh < 20) clasif = 'Las Aceleradas';
      else clasif = 'Las Robustas';
    } else {
      if (woh >= 20 && woh <= 26) clasif = 'Zona de Riesgo';
      else if (woh < 20) clasif = 'Desabastecidas';
      else clasif = 'Riesgo Crítico';
    }
  }

  return {
    periodo, unidades: row.u, valor: row.v, existencia: row.e,
    growthUnits, growthValor, avgUnits, nMonths, woh, clasif
  };
}

/** Calcula la clasificación para TODOS los periodos de una serie (para detectar rachas) */
function computeFullHistory(series) {
  return series
    .slice()
    .sort((a, b) => a.p - b.p)
    .map(r => computeMetricsForPeriod(series, r.p));
}

/** Detecta racha/tendencia de clasificación a partir del historial completo (ordenado asc) */
function detectStreak(fullHistory, periodo) {
  const idx = fullHistory.findIndex(h => h.periodo === periodo);
  if (idx === -1 || !fullHistory[idx].clasif) return null;
  const current = fullHistory[idx].clasif;
  let streak = 1;
  for (let i = idx - 1; i >= 0; i--) {
    if (fullHistory[i].clasif === current) streak++;
    else break;
  }
  // ¿Hubo cambio reciente? (racha anterior distinta)
  let changedFrom = null;
  if (streak === 1 && idx > 0) {
    // buscar cuántos meses estuvo en la clasificación previa antes de cambiar
    const prevClasif = fullHistory[idx - 1].clasif;
    if (prevClasif && prevClasif !== current) {
      let prevStreak = 1;
      for (let i = idx - 2; i >= 0; i--) {
        if (fullHistory[i].clasif === prevClasif) prevStreak++;
        else break;
      }
      changedFrom = { clasif: prevClasif, meses: prevStreak };
    }
  }
  return { clasif: current, meses: streak, changedFrom };
}

/**
 * Promedio mensual de unidades en una ventana de hasta N meses hacia atrás
 * desde `periodo` (inclusive), usando solo los meses con datos reales.
 * A diferencia de computeMetricsForPeriod, no requiere que exista una fila
 * exactamente en `periodo` (útil para promedios filtrados por UN/CAT que
 * pueden no tener venta justo ese mes).
 */
function avgOverTrailingWindow(series, periodo, months = 12) {
  const windowPeriods = new Set();
  for (let k = 0; k < months; k++) windowPeriods.add(periodoAddMonths(periodo, -k));
  const avail = series.filter(r => windowPeriods.has(r.p));
  const nMonths = avail.length;
  if (nMonths === 0) return { avg: null, nMonths: 0 };
  const avg = avail.reduce((s, r) => s + r.u, 0) / nMonths;
  return { avg, nMonths };
}

// ============================================================
// Cubo de detalle: cada sucursal trae, por periodo, una lista de filas
// [UN, CAT, GEN, FAMILIA, u, v, e] con la granularidad más fina. A partir
// de esto se puede filtrar y combinar por cualquier subconjunto de
// UN/CAT/GEN (a diferencia de un solo filtro a la vez).
// ============================================================

/** Filtra las filas del cubo de un periodo según los filtros activos (los que sean null se ignoran) */
function cubeFilterRows(rows, filters) {
  if (!rows) return [];
  return rows.filter(r =>
    (!filters.un || r[0] === filters.un) &&
    (!filters.cat || r[1] === filters.cat) &&
    (!filters.gen || r[2] === filters.gen)
  );
}

/** Suma unidades/valor/existencia de un conjunto de filas del cubo */
function cubeTotals(rows) {
  return rows.reduce((acc, r) => { acc.u += r[4]; acc.v += r[5]; acc.e += r[6]; return acc; }, { u: 0, v: 0, e: 0 });
}

/** Top-N familias dentro de un conjunto de filas del cubo (ya filtradas) */
function cubeTopFamilias(rows, n = 3) {
  const map = {};
  for (const r of rows) {
    const fam = r[3];
    if (!map[fam]) map[fam] = { fam, u: 0, v: 0, e: 0 };
    map[fam].u += r[4]; map[fam].v += r[5]; map[fam].e += r[6];
  }
  return Object.values(map).sort((a, b) => b.u - a.u).slice(0, n);
}

/** Breakdown por UN o por CAT (sumando sobre las demás dimensiones), para barras */
function cubeBreakdown(rows, dim) {
  const idx = dim === 'un' ? 0 : dim === 'cat' ? 1 : 2;
  const map = {};
  for (const r of rows) {
    const key = r[idx];
    if (!map[key]) map[key] = { key, u: 0, v: 0 };
    map[key].u += r[4]; map[key].v += r[5];
  }
  return Object.values(map).sort((a, b) => b.u - a.u);
}

/**
 * Promedio mensual de los últimos `months` meses para una combinación de
 * filtros (UN/CAT/GEN, cualquiera puede ir vacío). El denominador cuenta
 * los meses en que la sucursal reportó datos (no en los que la combinación
 * específica tuvo cero, que sí cuenta como dato real).
 */
function cubeAvgTrailing(store, filters, periodo, months = 12) {
  const activePeriods = new Set(store.periods.map(r => r.p));
  let sum = 0, nMonths = 0;
  for (let k = 0; k < months; k++) {
    const p = periodoAddMonths(periodo, -k);
    if (!activePeriods.has(p)) continue;
    nMonths++;
    const rows = store.cube[String(p)];
    if (rows) sum += cubeTotals(cubeFilterRows(rows, filters)).u;
  }
  if (nMonths === 0) return { avg: null, nMonths: 0 };
  return { avg: sum / nMonths, nMonths };
}

function recentForm(fullHistory, periodo, n = 6) {
  const upTo = fullHistory.filter(h => h.periodo <= periodo).slice(-n);
  return upTo;
}

/** Detecta racha de crecimiento (positivo o negativo) para narrar tendencia */
function detectGrowthTrend(fullHistory, periodo) {
  const idx = fullHistory.findIndex(h => h.periodo === periodo);
  if (idx === -1 || fullHistory[idx].growthUnits === null) return null;
  const positive = fullHistory[idx].growthUnits >= -0.02;
  let months = 1;
  for (let i = idx - 1; i >= 0; i--) {
    const g = fullHistory[i].growthUnits;
    if (g === null) break;
    if ((g >= -0.02) === positive) months++;
    else break;
  }
  if (months < 2) return null;
  return { positive, months };
}
