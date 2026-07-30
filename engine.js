// ============================================================
// RETAIL TOUR — Motor de cálculo
// Única fuente de verdad para: crecimiento, ventas promedio, WOH
// y clasificación. Se usa tanto para renderizar como para procesar
// data nueva que suba el usuario.
// ============================================================

const MARCA_UN = { 456: 'FW', 789: 'APP', 790: 'EQ' };
function unFromMarca(marca) {
  return MARCA_UN[Number(marca)] || 'LIC';
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

/** Última clasificación disponible en el historial (para "forma reciente") */
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
