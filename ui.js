// ============================================================
// RETAIL TOUR — Interfaz y lógica de Yaya
// ============================================================

const state = {
  nav: null, clientePeriodo: null, sucursalPeriodo: null,
  step: 'region', // region | pais | cliente | sucursal | briefing
  region: null, pais: null, cliente: null, sucursal: null,
  periodo: null,
  loading: true
};

const REGION_LABELS = { CAC: 'Caribe / Centroamérica', COL: 'Colombia', VEN: 'Venezuela' };

const $app = document.getElementById('app');

function fmtMoney(v) {
  if (v === null || v === undefined) return '—';
  return '$' + Math.round(v).toLocaleString('es-US');
}
function fmtUnits(v) {
  if (v === null || v === undefined) return '—';
  return Math.round(v).toLocaleString('es-US');
}
function fmtPct(v) {
  if (v === null || v === undefined) return '—';
  const pct = (v * 100).toFixed(0);
  return (v >= 0 ? '+' : '') + pct + '%';
}
function fmtWoh(v) {
  if (v === null || v === undefined) return '—';
  return v.toFixed(1);
}

// ---------- Boot ----------
async function boot() {
  renderLoading();
  try {
    const { nav, clientePeriodo, sucursalPeriodo } = await loadAllData();
    state.nav = nav;
    state.clientePeriodo = clientePeriodo;
    state.sucursalPeriodo = sucursalPeriodo;
    state.loading = false;
    render();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="error-screen"><p>No se pudo cargar la información.</p><p class="error-detail">${err.message}</p></div>`;
  }
}

function renderLoading() {
  $app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-mark">RT</div>
      <div class="boot-text">Preparando el recorrido…</div>
    </div>`;
}

// ---------- Router ----------
function render() {
  const crumbs = renderBreadcrumb();
  let body = '';
  if (state.step === 'region') body = renderRegionStep();
  else if (state.step === 'pais') body = renderPaisStep();
  else if (state.step === 'cliente') body = renderClienteStep();
  else if (state.step === 'sucursal') body = renderSucursalStep();
  else if (state.step === 'briefing') body = renderBriefing();

  $app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">RT</span>
        <span class="brand-name">Retail Tour</span>
      </div>
      <button class="upload-btn" id="btnUpload" title="Actualizar datos">⇪ Actualizar</button>
    </header>
    ${crumbs}
    <main class="view">${body}</main>
    <div id="uploadModal" class="modal-backdrop hidden">
      ${renderUploadModal()}
    </div>
  `;
  attachHandlers();
}

function renderBreadcrumb() {
  if (state.step === 'region') return '';
  const parts = [];
  parts.push(`<button data-nav="region">${REGION_LABELS[state.region] || state.region}</button>`);
  if (state.pais) parts.push(`<button data-nav="pais">${state.pais}</button>`);
  if (state.cliente) parts.push(`<button data-nav="cliente">${titleCase(state.cliente)}</button>`);
  if (state.sucursal) parts.push(`<button data-nav="sucursal">${titleCase(state.sucursal)}</button>`);
  return `<nav class="breadcrumb">${parts.join('<span class="sep">/</span>')}</nav>`;
}

function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().replace(/(^|\s|\/|\.)([a-záéíóúñ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}

// ---------- Step: Región ----------
function renderRegionStep() {
  const regions = Object.keys(state.nav);
  return `
    <div class="step-head">
      <h1>¿A qué región vas hoy?</h1>
      <p class="step-sub">Selecciona para empezar el recorrido.</p>
    </div>
    <div class="card-grid">
      ${regions.map(r => `
        <button class="pick-card" data-pick="region" data-value="${r}">
          <span class="pick-title">${REGION_LABELS[r] || r}</span>
          <span class="pick-meta">${Object.keys(state.nav[r]).length} países</span>
        </button>
      `).join('')}
    </div>`;
}

// ---------- Step: País ----------
function renderPaisStep() {
  const paises = Object.keys(state.nav[state.region]).sort();
  return `
    <div class="step-head">
      <h1>¿Qué país?</h1>
    </div>
    <div class="card-grid">
      ${paises.map(p => `
        <button class="pick-card" data-pick="pais" data-value="${p}">
          <span class="pick-title">${titleCase(p)}</span>
          <span class="pick-meta">${Object.keys(state.nav[state.region][p]).length} cuentas</span>
        </button>
      `).join('')}
    </div>`;
}

// ---------- Step: Cliente ----------
function renderClienteStep() {
  const clientes = Object.keys(state.nav[state.region][state.pais]).sort();
  return `
    <div class="step-head">
      <h1>¿Qué cuenta vas a visitar?</h1>
    </div>
    <div class="pick-list">
      ${clientes.map(c => {
        const cd = state.clientePeriodo[c];
        const last = cd && cd.hist.length ? cd.hist[cd.hist.length - 1] : null;
        const metrics = cd ? computeMetricsForPeriod(cd.hist, last.p) : null;
        const badge = metrics && metrics.clasif
          ? `<span class="mini-badge" style="--c:${CLASIFICACIONES[metrics.clasif].color}">${metrics.clasif}</span>`
          : '';
        return `
        <button class="pick-row" data-pick="cliente" data-value="${escapeAttr(c)}">
          <span class="pick-row-title">${titleCase(c)}</span>
          ${badge}
        </button>`;
      }).join('')}
    </div>`;
}

// ---------- Step: Sucursal ----------
function renderSucursalStep() {
  const sucursales = state.nav[state.region][state.pais][state.cliente].slice().sort();
  return `
    <div class="step-head">
      <h1>¿Qué sucursal?</h1>
      <p class="step-sub">${titleCase(state.cliente)}</p>
    </div>
    <div class="pick-list">
      ${sucursales.map(s => `
        <button class="pick-row" data-pick="sucursal" data-value="${escapeAttr(s)}">
          <span class="pick-row-title">${titleCase(s)}</span>
          <span class="chevron">›</span>
        </button>
      `).join('')}
    </div>`;
}

function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

// ---------- Step: Briefing ----------
function renderBriefing() {
  const cd = state.clientePeriodo[state.cliente];
  if (!cd || !cd.hist.length) return `<div class="empty">No hay data para esta cuenta.</div>`;

  if (!state.periodo) state.periodo = cd.hist[cd.hist.length - 1].p;
  const periodo = state.periodo;
  const fullHist = computeFullHistory(cd.hist);
  const metrics = computeMetricsForPeriod(cd.hist, periodo);
  const streak = detectStreak(fullHist, periodo);
  const form = recentForm(fullHist, periodo, 6);

  const canPrev = cd.hist.some(r => r.p < periodo);
  const canNext = cd.hist.some(r => r.p > periodo);

  const sucRows = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][state.sucursal]) || [];
  const sucRow = sucRows.find(r => r.p === periodo);

  return `
    <div class="period-nav">
      <button class="period-arrow" id="periodPrev" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="period-label">${periodoLabel(periodo)}</span>
      <button class="period-arrow" id="periodNext" ${canNext ? '' : 'disabled'}>›</button>
    </div>

    ${renderClassificationCard(metrics, streak, form)}
    ${renderAccountStatsCard(metrics)}
    ${sucRow ? renderStoreCard(sucRow) : `<div class="card muted-card">Esta sucursal no tiene movimiento en ${periodoLabel(periodo)}.</div>`}
    ${renderRecommendationCard(metrics, sucRow)}
  `;
}

function renderClassificationCard(metrics, streak, form) {
  if (!metrics || !metrics.clasif) {
    return `<div class="card classif-card classif-empty">
      <div class="classif-label">Sin clasificación este mes</div>
      <div class="classif-sub">No hay suficiente venta o inventario registrado para clasificar la cuenta en este periodo.</div>
    </div>`;
  }
  const c = CLASIFICACIONES[metrics.clasif];
  let streakText = '';
  if (streak) {
    if (streak.meses > 1) {
      streakText = `La cuenta acumula <strong>${streak.meses} meses consecutivos</strong> como ${c.label}.`;
    } else if (streak.changedFrom) {
      streakText = `Cambió este mes, tras <strong>${streak.changedFrom.meses} meses</strong> como ${streak.changedFrom.clasif}.`;
    } else {
      streakText = `Primer mes clasificado como ${c.label}.`;
    }
  }
  const formDots = form.map(h => {
    const color = h.clasif ? CLASIFICACIONES[h.clasif].color : '#D8D3C7';
    return `<span class="form-dot" style="--c:${color}" title="${periodoLabel(h.periodo)}: ${h.clasif || 'sin clasificar'}"></span>`;
  }).join('');

  return `
    <div class="card classif-card" style="--c:${c.color}">
      <div class="classif-top">
        <div class="classif-label">${c.label}</div>
        <div class="form-strip">${formDots}</div>
      </div>
      <div class="classif-sub">${streakText}</div>
    </div>`;
}

function renderAccountStatsCard(metrics) {
  return `
    <div class="card stats-card">
      <div class="stats-title">Cómo va la cuenta</div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value ${gClass(metrics.growthUnits)}">${fmtPct(metrics.growthUnits)}</div>
          <div class="stat-label">Crecimiento unidades</div>
        </div>
        <div class="stat">
          <div class="stat-value ${gClass(metrics.growthValor)}">${fmtPct(metrics.growthValor)}</div>
          <div class="stat-label">Crecimiento $</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtWoh(metrics.woh)}</div>
          <div class="stat-label">Semanas de inventario</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtUnits(metrics.avgUnits)}</div>
          <div class="stat-label">Venta prom. mensual (${metrics.nMonths}m)</div>
        </div>
      </div>
    </div>`;
}

function gClass(v) {
  if (v === null || v === undefined) return '';
  return v >= -0.02 ? 'stat-pos' : 'stat-neg';
}

const UN_LABELS = { FW: 'Calzado', APP: 'Prendas', EQ: 'Equipo', LIC: 'Licencias' };

function renderStoreCard(sucRow) {
  const unEntries = Object.entries(sucRow.un || {}).sort((a, b) => b[1].u - a[1].u);
  const totalUnUnits = unEntries.reduce((s, [, v]) => s + v.u, 0) || 1;

  return `
    <div class="card store-card">
      <div class="stats-title">Qué vende esta sucursal</div>
      <div class="store-totals">
        <span>${fmtUnits(sucRow.u)} unid.</span>
        <span>${fmtMoney(sucRow.v)}</span>
        <span>${fmtUnits(sucRow.e)} en inventario</span>
      </div>
      <div class="un-bars">
        ${unEntries.map(([un, v]) => `
          <div class="un-bar-row">
            <span class="un-bar-label">${UN_LABELS[un] || un}</span>
            <div class="un-bar-track"><div class="un-bar-fill" style="width:${(v.u / totalUnUnits * 100).toFixed(0)}%"></div></div>
            <span class="un-bar-pct">${(v.u / totalUnUnits * 100).toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>
      ${sucRow.cat && sucRow.cat.length ? `
        <div class="chip-row">
          <span class="chip-row-label">Deportes que más rotan</span>
          <div class="chips">${sucRow.cat.map(c => `<span class="chip">${c.cat}</span>`).join('')}</div>
        </div>` : ''}
      ${sucRow.fam && sucRow.fam.length ? `
        <div class="chip-row">
          <span class="chip-row-label">Familias líderes</span>
          <div class="chips">${sucRow.fam.map(f => `<span class="chip chip-outline">${titleCase(f.fam)}</span>`).join('')}</div>
        </div>` : ''}
    </div>`;
}

function renderRecommendationCard(metrics, sucRow) {
  const lines = buildRecommendations(metrics, sucRow);
  if (!lines.length) return '';
  return `
    <div class="card reco-card">
      <div class="stats-title">Para la conversación con el cliente</div>
      <ul class="reco-list">
        ${lines.map(l => `<li>${l}</li>`).join('')}
      </ul>
    </div>`;
}

function buildRecommendations(metrics, sucRow) {
  const lines = [];
  const templates = {
    'Las Estrellas': 'La cuenta mantiene un ritmo sobresaliente. Buen momento para proponer ampliar el surtido en las familias de mejor rotación.',
    'Las Aceleradas': 'La demanda crece más rápido que el inventario disponible. Vale la pena revisar si el abastecimiento alcanza para sostenerla.',
    'Las Robustas': 'La cuenta crece con inventario amplio. Hay espacio para explorar categorías nuevas o menos trabajadas.',
    'Zona de Riesgo': 'El inventario es alto frente a la demanda actual. Conviene entender juntos qué está frenando la rotación.',
    'Desabastecidas': 'La demanda bajó y el inventario también está ajustado. Vale la pena revisar el surtido disponible en tienda.',
    'Riesgo Crítico': 'Inventario elevado y demanda a la baja. Es un buen momento para una conversación abierta sobre el plan de surtido.'
  };
  if (metrics && metrics.clasif && templates[metrics.clasif]) lines.push(templates[metrics.clasif]);

  if (sucRow) {
    const unEntries = Object.entries(sucRow.un || {}).sort((a, b) => b[1].u - a[1].u);
    if (unEntries.length) {
      const [topUn] = unEntries[0];
      lines.push(`${UN_LABELS[topUn] || topUn} lidera la venta de esta sucursal. Vale la pena preguntar cómo va la rotación en el resto de las unidades de negocio.`);
    }
    if (sucRow.cat && sucRow.cat.length) {
      lines.push(`${titleCase(sucRow.cat[0].cat)} es el deporte con mejor rotación aquí. Puede ser un buen punto de partida para la visita.`);
    }
  }
  return lines;
}

// ---------- Upload modal ----------
function renderUploadModal() {
  return `
    <div class="modal">
      <div class="modal-head">
        <span>Actualizar datos</span>
        <button id="closeUpload" class="modal-close">✕</button>
      </div>
      <p class="modal-copy">Sube el archivo del mes nuevo (mismo formato que la base original). Se procesa aquí mismo y queda disponible en todos tus dispositivos.</p>
      <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" />
      <div id="uploadStatus" class="upload-status"></div>
    </div>`;
}

// ---------- Handlers ----------
function attachHandlers() {
  document.querySelectorAll('[data-pick]').forEach(el => {
    el.addEventListener('click', () => {
      const kind = el.getAttribute('data-pick');
      const value = el.getAttribute('data-value');
      if (kind === 'region') { state.region = value; state.step = 'pais'; }
      else if (kind === 'pais') { state.pais = value; state.step = 'cliente'; }
      else if (kind === 'cliente') { state.cliente = value; state.step = 'sucursal'; }
      else if (kind === 'sucursal') { state.sucursal = value; state.periodo = null; state.step = 'briefing'; }
      render();
    });
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-nav');
      state.step = target;
      if (target === 'region') { state.pais = state.cliente = state.sucursal = null; }
      if (target === 'pais') { state.cliente = state.sucursal = null; }
      if (target === 'cliente') { state.sucursal = null; }
      render();
    });
  });
  const prevBtn = document.getElementById('periodPrev');
  const nextBtn = document.getElementById('periodNext');
  if (prevBtn) prevBtn.addEventListener('click', () => shiftPeriod(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => shiftPeriod(1));

  const btnUpload = document.getElementById('btnUpload');
  const modal = document.getElementById('uploadModal');
  if (btnUpload) btnUpload.addEventListener('click', () => modal.classList.remove('hidden'));
  const closeUpload = document.getElementById('closeUpload');
  if (closeUpload) closeUpload.addEventListener('click', () => modal.classList.add('hidden'));
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.addEventListener('change', handleFileUpload);
}

function shiftPeriod(dir) {
  const cd = state.clientePeriodo[state.cliente];
  const periods = cd.hist.map(r => r.p).sort((a, b) => a - b);
  const idx = periods.indexOf(state.periodo);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < periods.length) {
    state.periodo = periods[newIdx];
    render();
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = 'Procesando archivo…';
  try {
    const parsed = await parseUploadedFile(file);
    if (!parsed.periodos.length) throw new Error('No se encontraron periodos válidos en el archivo.');
    statusEl.textContent = `Guardando ${parsed.periodos.map(periodoLabel).join(', ')}…`;
    const payloads = splitByPeriodo(parsed);
    for (const payload of payloads) {
      await saveMonthlyUpload(payload);
      mergeClientePeriodo(state.clientePeriodo, payload.cliente_periodo);
      mergeSucursalPeriodo(state.sucursalPeriodo, payload.sucursal_periodo);
      mergeNav(state.nav, payload.nav);
    }
    statusEl.textContent = `Listo. Se actualizó ${parsed.periodos.map(periodoLabel).join(', ')}.`;
    setTimeout(() => { document.getElementById('uploadModal').classList.add('hidden'); render(); }, 1200);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

boot();
