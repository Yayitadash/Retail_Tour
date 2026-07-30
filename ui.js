// ============================================================
// RETAIL TOUR — Interfaz y lógica de Yaya (v2)
// ============================================================

const state = {
  nav: null, clientePeriodo: null, sucursalPeriodo: null,
  step: 'welcome', // welcome | region | pais | cliente | cuenta | sucursal
  region: null, pais: null, cliente: null, sucursal: null,
  periodo: null,
  selectedUn: null, selectedCat: null,
  clasifFilter: null,
  clasifLegendOpen: false,
  lang: loadLang(),
  user: loadUser(),
  loading: true
};

const REGION_LABELS = { CEN: 'Centroamérica', CAR: 'Caribe', COL: 'Colombia', VEN: 'Venezuela' };

const $app = document.getElementById('app');

function L(key, ...args) { return t(state.lang, key, ...args); }

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
function gClass(v) {
  if (v === null || v === undefined) return '';
  return v >= -0.02 ? 'stat-pos' : 'stat-neg';
}
function titleCase(s) {
  if (!s) return s;
  return s.toLowerCase().replace(/(^|\s|\/|\.)([a-záéíóúñ])/g, (m, p1, p2) => p1 + p2.toUpperCase());
}
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }

function yayaBubble(text, extraClass) {
  return `
    <div class="yaya-bubble" style="display:flex;align-items:flex-start;gap:8px;margin:0 0 14px;">
      <div class="yaya-bubble-avatar" style="width:32px;height:32px;border-radius:50%;overflow:hidden;flex-shrink:0;">${getYayaAvatar()}</div>
      <div class="yaya-bubble-content ${extraClass || ''}">
        <div class="yaya-bubble-name">Yaya</div>
        <div class="yaya-bubble-text">${text}</div>
      </div>
    </div>`;
}

// ---------- Boot ----------
async function boot() {
  if (!state.user) {
    state.step = 'welcome';
    renderWelcome();
    return;
  }
  await loadData();
}

async function loadData() {
  renderLoading();
  try {
    const { nav, clientePeriodo, sucursalPeriodo } = await loadAllData();
    state.nav = nav;
    state.clientePeriodo = clientePeriodo;
    state.sucursalPeriodo = sucursalPeriodo;
    state.loading = false;
    state.step = 'greeting';
    renderGreetingCard();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `<div class="error-screen"><p>${err.message}</p></div>`;
  }
}

function renderGreetingCard() {
  $app.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-avatar-big">${getYayaAvatar()}</div>
      <h1 class="welcome-title">${L('greetingCardTitle', state.user.name.split(' ')[0])}</h1>
      <p class="welcome-sub">${L('greetingCardBody')}</p>
      <button class="start-btn" id="continueBtn">${L('continueBtn')}</button>
    </div>`;
  document.getElementById('continueBtn').addEventListener('click', () => {
    state.step = 'region';
    render();
  });
}

function renderLoading() {
  $app.innerHTML = `
    <div class="boot-screen">
      <div class="boot-mark">RT</div>
      <div class="boot-text">${L('boot')}</div>
    </div>`;
}

// ---------- Welcome screen ----------
function renderWelcome() {
  $app.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-avatar-big">${getYayaAvatar()}</div>
      <h1 class="welcome-title">${L('welcomeTitle')}</h1>
      <p class="welcome-sub">${L('welcomeSub')}</p>
      <input type="text" id="nameInput" class="welcome-input" placeholder="${L('namePlaceholder')}" maxlength="30" value="${state.user ? escapeAttr(state.user.name) : ''}" />
      <button class="start-btn" id="startBtn">${L('startTour')}</button>
    </div>`;

  document.getElementById('startBtn').addEventListener('click', () => {
    const name = document.getElementById('nameInput').value.trim();
    if (!name) { document.getElementById('nameInput').focus(); return; }
    state.user = { name };
    saveUser(state.user);
    loadData();
  });
}

// ---------- Router ----------
function render() {
  const crumbs = renderBreadcrumb();
  let body = '';
  if (state.step === 'region') body = renderRegionStep();
  else if (state.step === 'pais') body = renderPaisStep();
  else if (state.step === 'cliente') body = renderClienteStep();
  else if (state.step === 'cuenta') body = renderCuentaStep();
  else if (state.step === 'sucursal') body = renderSucursalBriefing();

  $app.innerHTML = `
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">RT</span>
        <span class="brand-name">Retail Tour</span>
      </div>
      <div class="topbar-actions">
        <button class="settings-btn" id="settingsBtn" title="${L('changeName')}">⚙</button>
        <button class="lang-toggle" id="langToggle">${state.lang.toUpperCase()}</button>
        <button class="upload-btn" id="btnUpload" title="${L('update')}">⇪</button>
      </div>
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
  if (state.pais) parts.push(`<button data-nav="pais">${titleCase(state.pais)}</button>`);
  if (state.cliente) parts.push(`<button data-nav="cuenta">${titleCase(state.cliente)}</button>`);
  if (state.sucursal) parts.push(`<button data-nav="sucursal">${titleCase(state.sucursal)}</button>`);
  return `<nav class="breadcrumb">${parts.join('<span class="sep">/</span>')}</nav>`;
}

// ---------- Step: Región ----------
function renderRegionStep() {
  const regions = Object.keys(state.nav);
  return `
    <div class="step-head">
      ${yayaBubble(L('greeting', state.user.name.split(' ')[0]))}
      <h1>${L('askRegion')}</h1>
    </div>
    <div class="card-grid">
      ${regions.map(r => `
        <button class="pick-card" data-pick="region" data-value="${r}">
          <span class="pick-title">${REGION_LABELS[r] || r}</span>
          <span class="pick-meta">${Object.keys(state.nav[r]).length} ${L('countries')}</span>
        </button>
      `).join('')}
    </div>`;
}

// ---------- Step: País ----------
function renderPaisStep() {
  const paises = Object.keys(state.nav[state.region]).sort();
  return `
    <div class="step-head">
      ${yayaBubble(L('confirmRegion', REGION_LABELS[state.region] || state.region))}
      <h1>${L('askPais')}</h1>
    </div>
    <div class="card-grid">
      ${paises.map(p => `
        <button class="pick-card" data-pick="pais" data-value="${p}">
          <span class="pick-title">${titleCase(p)}</span>
          <span class="pick-meta">${Object.keys(state.nav[state.region][p]).length} ${L('accounts')}</span>
        </button>
      `).join('')}
    </div>`;
}

// ---------- Step: Cliente (elegir cuenta) ----------
const CLASIF_ORDER = ['Las Estrellas', 'Las Aceleradas', 'Las Robustas', 'Zona de Riesgo', 'Desabastecidas', 'Riesgo Crítico'];

function renderClienteStep() {
  const clientes = Object.keys(state.nav[state.region][state.pais]).sort();
  const clientesConClasif = clientes.map(c => {
    const cd = state.clientePeriodo[c];
    const last = cd && cd.hist.length ? cd.hist[cd.hist.length - 1] : null;
    const metrics = cd && last ? computeMetricsForPeriod(cd.hist, last.p) : null;
    return { c, clasif: metrics ? metrics.clasif : null };
  });

  const presentClasifs = new Set(clientesConClasif.map(x => x.clasif).filter(Boolean));
  const filterRow = CLASIF_ORDER.filter(k => presentClasifs.has(k)).map(k => `
    <button class="clasif-filter-btn ${state.clasifFilter === k ? 'active' : ''}" style="--c:${CLASIFICACIONES[k].color}" data-filter-clasif="${k}" title="${classifLabel(k, state.lang)} — ${classifDesc(k, state.lang)}">
      ${CLASIFICACIONES[k].icon}
    </button>`).join('');

  const visibles = state.clasifFilter
    ? clientesConClasif.filter(x => x.clasif === state.clasifFilter)
    : clientesConClasif;

  return `
    <div class="step-head">
      ${yayaBubble(L('confirmPais', titleCase(state.pais)))}
      <h1>${L('askCliente')}</h1>
    </div>
    <div class="clasif-filter-row">${filterRow}</div>
    <button class="clasif-legend-toggle" id="clasifLegendToggle">${state.clasifLegendOpen ? L('hideIconsMean') : L('whatIconsMean')}</button>
    ${state.clasifLegendOpen ? `
      <div class="clasif-legend">
        ${CLASIF_ORDER.filter(k => presentClasifs.has(k)).map(k => `
          <div class="clasif-legend-item">
            <span class="clasif-legend-icon" style="--c:${CLASIFICACIONES[k].color}">${CLASIFICACIONES[k].icon}</span>
            <div>
              <div class="clasif-legend-name" style="color:${CLASIFICACIONES[k].color}">${classifLabel(k, state.lang)}</div>
              <div class="clasif-legend-desc">${classifDesc(k, state.lang)}</div>
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    <div class="pick-list">
      ${visibles.map(({ c, clasif }) => {
        const badge = clasif
          ? `<span class="mini-badge-icon" style="--c:${CLASIFICACIONES[clasif].color}" title="${classifLabel(clasif, state.lang)} — ${classifDesc(clasif, state.lang)}">${CLASIFICACIONES[clasif].icon}</span>`
          : '';
        return `
        <button class="pick-row" data-pick="cliente" data-value="${escapeAttr(c)}">
          <span class="pick-row-title">${titleCase(c)}</span>
          ${badge}
        </button>`;
      }).join('')}
    </div>`;
}

// ---------- Step: Cuenta (resumen general + elegir sucursal) ----------
function renderCuentaStep() {
  const cd = state.clientePeriodo[state.cliente];
  if (!cd || !cd.hist.length) return `<div class="empty">${L('noData')}</div>`;
  if (!state.periodo) state.periodo = cd.hist[cd.hist.length - 1].p;
  const periodo = state.periodo;
  const fullHist = computeFullHistory(cd.hist);
  const metrics = computeMetricsForPeriod(cd.hist, periodo);
  const streak = detectStreak(fullHist, periodo);
  const form = recentForm(fullHist, periodo, 6);
  const trend = detectGrowthTrend(fullHist, periodo);

  const canPrev = cd.hist.some(r => r.p < periodo);
  const canNext = cd.hist.some(r => r.p > periodo);

  const sucursales = (state.nav[state.region][state.pais][state.cliente] || []).slice().sort();

  return `
    <div class="step-head">
      ${yayaBubble(L('confirmCliente', titleCase(state.cliente)))}
    </div>
    <div class="period-nav">
      <button class="period-arrow" id="periodPrev" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="period-label">${periodoLabelI18n(periodo, state.lang)}</span>
      <button class="period-arrow" id="periodNext" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    ${yayaBubble(L('beforeStore'))}
    ${renderClassificationCard(metrics, streak, form)}
    ${renderStatsCard(metrics, L('accountOverview'))}
    ${trend ? yayaBubble(trend.positive ? L('trendPositive', trend.months) : L('trendNegative', trend.months), 'yaya-bubble-story') : ''}
    ${yayaBubble(L('askSucursal'))}
    <div class="pick-list">
      ${sucursales.map(s => {
        const sucSeries = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][s]) || [];
        const sucRow = sucSeries.find(r => r.p === periodo);
        return `
        <button class="pick-row" data-pick="sucursal" data-value="${escapeAttr(s)}">
          <span class="pick-row-title">${titleCase(s)}</span>
          <span class="pick-row-right">
            ${sucRow ? `<span class="pick-row-sales">${fmtMoney(sucRow.v)}</span>` : `<span class="pick-row-sales pick-row-sales-empty">${L('noMovementShort')}</span>`}
            <span class="chevron">›</span>
          </span>
        </button>`;
      }).join('')}
    </div>
  `;
}

// ---------- Tarjetas compartidas ----------
function renderClassificationCard(metrics, streak, form) {
  if (!metrics || !metrics.clasif) {
    return `<div class="card classif-card classif-empty">
      <div class="classif-label">${L('noClassif')}</div>
      <div class="classif-sub">${L('noClassifSub')}</div>
    </div>`;
  }
  const c = CLASIFICACIONES[metrics.clasif];
  const label = classifLabel(metrics.clasif, state.lang);
  const desc = classifDesc(metrics.clasif, state.lang);
  let streakText = '';
  if (streak) {
    if (streak.meses > 1) streakText = L('streakMonths', streak.meses, label);
    else if (streak.changedFrom) streakText = L('changedFrom', streak.changedFrom.meses, classifLabel(streak.changedFrom.clasif, state.lang));
    else streakText = L('firstMonthAs', label);
  }
  const formDots = form.map(h => {
    const color = h.clasif ? CLASIFICACIONES[h.clasif].color : '#D8D3C7';
    const lbl = h.clasif ? classifLabel(h.clasif, state.lang) : '—';
    return `<span class="form-dot" style="--c:${color}" title="${periodoLabelI18n(h.periodo, state.lang)}: ${lbl}"></span>`;
  }).join('');

  return `
    <div class="card classif-card" style="--c:${c.color}">
      <div class="classif-top">
        <div class="classif-label"><span class="classif-icon">${c.icon}</span> ${label}</div>
        <div class="form-strip">${formDots}</div>
      </div>
      <div class="classif-desc">${desc}</div>
      <div class="classif-sub">${streakText}</div>
    </div>`;
}

function renderStatsCard(metrics, title) {
  return `
    <div class="card stats-card">
      <div class="stats-title">${title}</div>
      <div class="stats-grid">
        <div class="stat">
          <div class="stat-value ${gClass(metrics.growthUnits)}">${fmtPct(metrics.growthUnits)}</div>
          <div class="stat-label">${L('growthUnits')}</div>
        </div>
        <div class="stat">
          <div class="stat-value ${gClass(metrics.growthValor)}">${fmtPct(metrics.growthValor)}</div>
          <div class="stat-label">${L('growthValor')}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtWoh(metrics.woh)}</div>
          <div class="stat-label">${L('woh')}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtUnits(metrics.avgUnits)}</div>
          <div class="stat-label">${L('avgMonthly', metrics.nMonths)}</div>
        </div>
      </div>
    </div>`;
}

const UN_ORDER = ['FW', 'APP', 'EQ', 'LIC'];

// ---------- Step: Sucursal (briefing, todo a nivel tienda) ----------
function renderSucursalBriefing() {
  const sucSeries = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][state.sucursal]) || [];
  if (!sucSeries.length) return `<div class="empty">${L('noData')}</div>`;
  if (!state.periodo || !sucSeries.some(r => r.p === state.periodo)) state.periodo = sucSeries[sucSeries.length - 1].p;
  const periodo = state.periodo;

  const simpleSeries = sucSeries.map(r => ({ p: r.p, u: r.u, v: r.v, e: r.e }));
  const metrics = computeMetricsForPeriod(simpleSeries, periodo);
  const sucRow = sucSeries.find(r => r.p === periodo);

  const canPrev = sucSeries.some(r => r.p < periodo);
  const canNext = sucSeries.some(r => r.p > periodo);

  const topCat = sucRow && sucRow.cat && sucRow.cat.length ? sucRow.cat[0].cat : null;

  return `
    <div class="period-nav">
      <button class="period-arrow" id="periodPrev" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="period-label">${periodoLabelI18n(periodo, state.lang)}</span>
      <button class="period-arrow" id="periodNext" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    ${yayaBubble(L('beforeIndicators'))}
    ${metrics ? renderStatsCard(metrics, L('storeOverview')) : ''}
    ${sucRow ? renderStoreCard(sucRow) : `<div class="card muted-card">${L('noMovement', periodoLabelI18n(periodo, state.lang))}</div>`}
    ${topCat ? yayaBubble(L('topDriver', titleCase(topCat)), 'yaya-bubble-story') : ''}
    ${renderRecommendationCard(sucRow)}
    ${renderClosingCard()}
  `;
}

function renderClosingCard() {
  return `
    <div class="card closing-card">
      <div class="closing-title">${L('closingTitle')}</div>
      <div class="closing-body">${L('closingBody')}</div>
      <button class="another-store-btn" id="anotherStoreBtn">${L('anotherStore')}</button>
    </div>`;
}

function renderStoreCard(sucRow) {
  const unEntries = Object.entries(sucRow.un || {})
    .sort((a, b) => UN_ORDER.indexOf(a[0]) - UN_ORDER.indexOf(b[0]));
  const totalUnUnits = unEntries.reduce((s, [, v]) => s + v.u, 0) || 1;
  const unLabels = t(state.lang, 'unLabels');

  const catEntries = sucRow.cat || [];
  const totalCatUnits = catEntries.reduce((s, c) => s + c.u, 0) || 1;

  return `
    <div class="card store-card">
      <div class="stats-title">${L('whatSells')}</div>
      <div class="store-totals">
        <span>${fmtUnits(sucRow.u)} ${L('units')}</span>
        <span>${fmtMoney(sucRow.v)}</span>
        <span>${fmtUnits(sucRow.e)} ${L('inInventory')}</span>
      </div>
      <div class="un-bars">
        ${unEntries.map(([un, v]) => `
          <button class="un-bar-row ${state.selectedUn === un ? 'active' : ''}" data-select-un="${un}">
            <span class="un-bar-label">${unLabels[un] || un}</span>
            <div class="un-bar-track"><div class="un-bar-fill" style="width:${(v.u / totalUnUnits * 100).toFixed(0)}%"></div></div>
            <span class="un-bar-pct">${(v.u / totalUnUnits * 100).toFixed(0)}%</span>
          </button>
        `).join('')}
      </div>
      <span class="tap-hint">${L('tapToExplore')}</span>
      ${catEntries.length ? `
        <div class="chip-row">
          <span class="chip-row-label">${L('concentratedIn')}...</span>
          <ul class="cat-list">
            ${catEntries.map(c => `
              <li>
                <button class="cat-list-btn ${state.selectedCat === c.cat ? 'active' : ''}" data-select-cat="${escapeAttr(c.cat)}">
                  ${titleCase(c.cat)} <span class="cat-pct">(${(c.u / totalCatUnits * 100).toFixed(0)}%)</span>
                </button>
              </li>`).join('')}
          </ul>
        </div>` : ''}
      ${renderDetailPanel(sucRow)}
      ${sucRow.fam && sucRow.fam.length ? `
        <div class="chip-row">
          <span class="chip-row-label">${L('leadingFamilies')}</span>
          ${renderFamList(sucRow.fam)}
        </div>` : ''}
    </div>`;
}

function renderFamList(famArr) {
  return `
    <div class="fam-list">
      ${famArr.map(f => {
        const famWoh = (f.e && f.u) ? (f.e / f.u * 4.33) : null;
        return `
        <div class="fam-item">
          <span class="fam-name">${titleCase(f.fam)}</span>
          <span class="fam-meta">${fmtMoney(f.v)} · ${L('monthWoh')}: ${fmtWoh(famWoh)}</span>
        </div>`;
      }).join('')}
    </div>`;
}

function renderGenBreakdown(genObj) {
  const genLabels = t(state.lang, 'genLabels');
  const order = ['MEN', 'WOMEN', 'KIDS'];
  const entries = order.filter(g => genObj[g]).map(g => [g, genObj[g]]);
  const total = entries.reduce((s, [, v]) => s + v.u, 0) || 1;
  return `
    <div class="gen-bars">
      ${entries.map(([g, v]) => `
        <div class="gen-bar-row">
          <span class="gen-bar-label">${genLabels[g] || g}</span>
          <div class="un-bar-track"><div class="un-bar-fill gen-fill" style="width:${(v.u / total * 100).toFixed(0)}%"></div></div>
          <span class="un-bar-pct">${(v.u / total * 100).toFixed(0)}%</span>
        </div>
      `).join('')}
    </div>`;
}

function renderDetailPanel(sucRow) {
  if (state.selectedUn && sucRow.du && sucRow.du[state.selectedUn]) {
    const d = sucRow.du[state.selectedUn];
    const unLabels = t(state.lang, 'unLabels');
    const totalCat = (d.cat || []).reduce((s, c) => s + c.u, 0) || 1;
    return `
      <div class="detail-panel">
        <div class="detail-panel-title">${unLabels[state.selectedUn] || state.selectedUn}</div>
        ${d.cat && d.cat.length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('categoriesIn')}</span>
            <ul class="cat-list">${d.cat.map(c => `<li>${titleCase(c.cat)} <span class="cat-pct">(${(c.u / totalCat * 100).toFixed(0)}%)</span></li>`).join('')}</ul>
          </div>` : ''}
        ${d.gen && Object.keys(d.gen).length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('genderIn')}</span>
            ${renderGenBreakdown(d.gen)}
          </div>` : ''}
        ${d.fam && d.fam.length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('familiesIn')}</span>
            ${renderFamList(d.fam)}
          </div>` : ''}
      </div>`;
  }
  if (state.selectedCat && sucRow.dc && sucRow.dc[state.selectedCat]) {
    const d = sucRow.dc[state.selectedCat];
    const unLabels = t(state.lang, 'unLabels');
    const totalUn = (d.un || []).reduce((s, u) => s + u.u, 0) || 1;
    return `
      <div class="detail-panel">
        <div class="detail-panel-title">${titleCase(state.selectedCat)}</div>
        ${d.un && d.un.length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('businessUnitsIn')}</span>
            <ul class="cat-list">${d.un.map(u => `<li>${unLabels[u.un] || u.un} <span class="cat-pct">(${(u.u / totalUn * 100).toFixed(0)}%)</span></li>`).join('')}</ul>
          </div>` : ''}
        ${d.gen && Object.keys(d.gen).length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('genderIn')}</span>
            ${renderGenBreakdown(d.gen)}
          </div>` : ''}
        ${d.fam && d.fam.length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('familiesIn')}</span>
            ${renderFamList(d.fam)}
          </div>` : ''}
      </div>`;
  }
  return '';
}

function renderRecommendationCard(sucRow) {
  const lines = buildRecommendations(sucRow);
  if (!lines.length) return '';
  return `
    <div class="card reco-card">
      <div class="stats-title">${L('forConversation')}</div>
      <ul class="reco-list">${lines.map(l => `<li>${l}</li>`).join('')}</ul>
    </div>`;
}

function buildRecommendations(sucRow) {
  const lines = [];
  const cd = state.clientePeriodo[state.cliente];
  const fullHist = computeFullHistory(cd.hist);
  const clientMetrics = computeMetricsForPeriod(cd.hist, state.periodo) || fullHist[fullHist.length - 1];
  const templates = t(state.lang, 'recoTemplates');
  if (clientMetrics && clientMetrics.clasif && templates[clientMetrics.clasif]) lines.push(templates[clientMetrics.clasif]);

  if (sucRow) {
    const unLabels = t(state.lang, 'unLabels');
    const unEntries = Object.entries(sucRow.un || {}).sort((a, b) => b[1].u - a[1].u);
    if (unEntries.length) {
      const [topUn] = unEntries[0];
      lines.push(L('recoUn', unLabels[topUn] || topUn));
    }
    if (sucRow.cat && sucRow.cat.length) {
      lines.push(L('recoCat', titleCase(sucRow.cat[0].cat)));
    }
    if (sucRow.fam && sucRow.fam.length) {
      const low = sucRow.fam.find(f => f.e && f.u && (f.e / f.u * 4.33) < 10);
      if (low) lines.push(L('recoLowWoh', titleCase(low.fam)));
    }
  }
  return lines;
}

// ---------- Upload modal ----------
function renderUploadModal() {
  return `
    <div class="modal">
      <div class="modal-head">
        <span>${L('uploadTitle')}</span>
        <button id="closeUpload" class="modal-close">✕</button>
      </div>
      <p class="modal-copy">${L('uploadCopy')}</p>
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
      else if (kind === 'pais') { state.pais = value; state.clasifFilter = null; state.clasifLegendOpen = false; state.step = 'cliente'; }
      else if (kind === 'cliente') { state.cliente = value; state.periodo = null; state.selectedUn = null; state.selectedCat = null; state.step = 'cuenta'; }
      else if (kind === 'sucursal') { state.sucursal = value; state.periodo = null; state.selectedUn = null; state.selectedCat = null; state.step = 'sucursal'; }
      render();
    });
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', () => {
      const target = el.getAttribute('data-nav');
      state.step = target;
      state.periodo = null;
      state.clasifFilter = null; state.clasifLegendOpen = false;
      if (target === 'region') { state.pais = state.cliente = state.sucursal = null; }
      if (target === 'pais') { state.cliente = state.sucursal = null; }
      if (target === 'cuenta') { state.sucursal = null; }
      render();
    });
  });
  const prevBtn = document.getElementById('periodPrev');
  const nextBtn = document.getElementById('periodNext');
  if (prevBtn) prevBtn.addEventListener('click', () => shiftPeriod(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => shiftPeriod(1));

  const anotherStoreBtn = document.getElementById('anotherStoreBtn');
  if (anotherStoreBtn) anotherStoreBtn.addEventListener('click', () => {
    state.sucursal = null;
    state.periodo = null;
    state.selectedUn = null; state.selectedCat = null;
    state.step = 'cuenta';
    render();
  });

  document.querySelectorAll('[data-filter-clasif]').forEach(el => {
    el.addEventListener('click', () => {
      const k = el.getAttribute('data-filter-clasif');
      state.clasifFilter = state.clasifFilter === k ? null : k;
      render();
    });
  });

  const clasifLegendToggle = document.getElementById('clasifLegendToggle');
  if (clasifLegendToggle) clasifLegendToggle.addEventListener('click', () => {
    state.clasifLegendOpen = !state.clasifLegendOpen;
    render();
  });

  document.querySelectorAll('[data-select-un]').forEach(el => {
    el.addEventListener('click', () => {
      const un = el.getAttribute('data-select-un');
      state.selectedUn = state.selectedUn === un ? null : un;
      state.selectedCat = null;
      render();
    });
  });
  document.querySelectorAll('[data-select-cat]').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.getAttribute('data-select-cat');
      state.selectedCat = state.selectedCat === cat ? null : cat;
      state.selectedUn = null;
      render();
    });
  });

  const btnUpload = document.getElementById('btnUpload');
  const modal = document.getElementById('uploadModal');
  if (btnUpload) btnUpload.addEventListener('click', () => modal.classList.remove('hidden'));
  const closeUpload = document.getElementById('closeUpload');
  if (closeUpload) closeUpload.addEventListener('click', () => modal.classList.add('hidden'));
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.addEventListener('change', handleFileUpload);

  const langToggle = document.getElementById('langToggle');
  if (langToggle) langToggle.addEventListener('click', () => {
    state.lang = state.lang === 'es' ? 'en' : 'es';
    saveLang(state.lang);
    render();
  });

  const settingsBtn = document.getElementById('settingsBtn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => {
    renderWelcome();
  });
}

function shiftPeriod(dir) {
  const series = state.step === 'sucursal'
    ? (state.sucursalPeriodo[state.cliente][state.sucursal])
    : (state.clientePeriodo[state.cliente].hist);
  const periods = series.map(r => r.p).sort((a, b) => a - b);
  const idx = periods.indexOf(state.periodo);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < periods.length) {
    state.periodo = periods[newIdx];
    state.selectedUn = null; state.selectedCat = null;
    render();
  }
}

async function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById('uploadStatus');
  statusEl.textContent = L('processing');
  try {
    const parsed = await parseUploadedFile(file);
    if (!parsed.periodos.length) throw new Error('No periods found.');
    const labels = parsed.periodos.map(p => periodoLabelI18n(p, state.lang)).join(', ');
    statusEl.textContent = L('saving', labels);
    const payloads = splitByPeriodo(parsed);
    for (const payload of payloads) {
      await saveMonthlyUpload(payload);
      mergeClientePeriodo(state.clientePeriodo, payload.cliente_periodo);
      mergeSucursalPeriodo(state.sucursalPeriodo, payload.sucursal_periodo);
      mergeNav(state.nav, payload.nav);
    }
    statusEl.textContent = L('done', labels);
    setTimeout(() => { document.getElementById('uploadModal').classList.add('hidden'); render(); }, 1200);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

boot();
