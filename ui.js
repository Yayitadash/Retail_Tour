// ============================================================
// RETAIL TOUR — Interfaz y lógica de Yaya (v2)
// ============================================================

const state = {
  nav: null, clientePeriodo: null, sucursalPeriodo: null,
  step: 'welcome', // welcome | region | pais | cliente | cuenta | sucursal
  region: null, pais: null, cliente: null, sucursal: null,
  periodo: null,
  filterUn: null, filterCat: null, filterGen: null,
  clasifFilter: null,
  clasifLegendOpen: false,
  navStack: [], navPos: -1,
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
function catLabel(cat) { return cat ? String(cat).toUpperCase() : cat; }

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
// Para cambiar la clave: edita APP_ACCESS_CODE Y sube en 1 el número de
// APP_ACCESS_VERSION. Eso hace que TODOS los dispositivos (incluso los que
// ya tenían acceso) tengan que volver a escribir la clave nueva.
const APP_ACCESS_CODE = '1234';
const APP_ACCESS_VERSION = 1;

async function boot() {
  if (!hasAccess()) {
    renderAccessGate();
    return;
  }
  if (!state.user) {
    state.step = 'welcome';
    renderWelcome();
    return;
  }
  await loadData();
}

function renderAccessGate(error) {
  $app.innerHTML = `
    <div class="welcome-screen">
      <div class="welcome-avatar-big">${getYayaAvatar()}</div>
      <h1 class="welcome-title">${L('accessTitle')}</h1>
      <p class="welcome-sub">${L('accessSub')}</p>
      <input type="password" inputmode="numeric" id="accessInput" class="welcome-input" placeholder="${L('accessPlaceholder')}" maxlength="12" />
      ${error ? `<p class="access-error">${L('accessError')}</p>` : ''}
      <button class="start-btn" id="accessBtn">${L('accessButton')}</button>
    </div>`;

  const submit = () => {
    const val = document.getElementById('accessInput').value.trim();
    if (val === APP_ACCESS_CODE) {
      saveAccess();
      boot();
    } else {
      renderAccessGate(true);
    }
  };
  document.getElementById('accessBtn').addEventListener('click', submit);
  document.getElementById('accessInput').addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
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
    pushHistory();
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

// ---------- Historial de navegación (atrás / adelante propios de la app) ----------
function snapshotNav() {
  return { step: state.step, region: state.region, pais: state.pais, cliente: state.cliente, sucursal: state.sucursal };
}
function pushHistory() {
  state.navStack = state.navStack.slice(0, state.navPos + 1);
  state.navStack.push(snapshotNav());
  state.navPos = state.navStack.length - 1;
}
function goStepBack() {
  if (state.navPos <= 0) return;
  state.navPos--;
  Object.assign(state, state.navStack[state.navPos]);
  state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null;
  render();
}
function goStepForward() {
  if (state.navPos >= state.navStack.length - 1) return;
  state.navPos++;
  Object.assign(state, state.navStack[state.navPos]);
  state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null;
  render();
}

let lastRenderedStep = null;


// ---------- Router ----------
function render() {
  const stepChanged = state.step !== lastRenderedStep;
  lastRenderedStep = state.step;
  const crumbs = renderBreadcrumb();
  let body = '';
  if (state.step === 'region') body = renderRegionStep();
  else if (state.step === 'pais') body = renderPaisStep();
  else if (state.step === 'cliente') body = renderClienteStep();
  else if (state.step === 'cuenta') body = renderCuentaStep();
  else if (state.step === 'sucursal') body = renderSucursalBriefing();

  $app.innerHTML = `
    <div class="sticky-header">
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
    </div>
    <main class="view">${body}</main>
    <div id="uploadModal" class="modal-backdrop hidden">
      ${renderUploadModal()}
    </div>
    <div id="clasifGuideModal" class="modal-backdrop hidden">
      ${renderClasifGuideModal()}
    </div>
    ${renderStepNavBar()}
  `;
  attachHandlers();
  if (stepChanged) window.scrollTo(0, 0);
}

function renderClasifGuideModal() {
  return `
    <div class="modal clasif-guide-modal">
      <div class="modal-head">
        <span>${L('clasifGuideTitle')}</span>
        <button id="closeClasifGuide" class="modal-close">✕</button>
      </div>
      ${renderClasifGuide()}
    </div>`;
}

function renderStepNavBar() {
  if (state.step === 'welcome' || state.step === 'greeting') return '';
  const canBack = state.navPos > 0;
  const canForward = state.navPos < state.navStack.length - 1;
  return `
    <div class="step-nav-bar">
      <button class="step-nav-btn" id="navBackBtn" ${canBack ? '' : 'disabled'}>‹ ${L('backWord')}</button>
      <button class="step-nav-btn step-nav-btn-guide" id="clasifGuideBtn" title="${L('clasifGuideTitle')}">📖</button>
      <button class="step-nav-btn" id="navForwardBtn" ${canForward ? '' : 'disabled'}>${L('forwardWord')} ›</button>
    </div>`;
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
    </div>
    ${renderClasifGuide()}`;
}

function renderClasifGuide() {
  const buttons = CLASIF_ORDER.map(k => `
    <div class="clasif-long-btn clasif-long-static" style="--c:${CLASIFICACIONES[k].color}">
      <span class="clasif-long-icon">${CLASIFICACIONES[k].icon}</span>
      <span class="clasif-long-text">
        <span class="clasif-long-name">${classifLabel(k, state.lang)}</span>
        <span class="clasif-long-desc">${classifDesc(k, state.lang)}</span>
      </span>
    </div>`).join('');
  return `
    <div class="clasif-guide">
      ${yayaBubble(L('clasifGuideIntro'))}
      <div class="clasif-long-list">${buttons}</div>
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

function lastKnownClasif(hist) {
  if (!hist || !hist.length) return null;
  const fullHist = computeFullHistory(hist);
  for (let i = fullHist.length - 1; i >= 0; i--) {
    if (fullHist[i].clasif) return fullHist[i].clasif;
  }
  return null;
}

function renderClienteStep() {
  const clientes = Object.keys(state.nav[state.region][state.pais]).sort();
  const clientesConClasif = clientes.map(c => {
    const cd = state.clientePeriodo[c];
    return { c, clasif: lastKnownClasif(cd && cd.hist) };
  });

  const presentClasifs = new Set(clientesConClasif.map(x => x.clasif).filter(Boolean));
  const keysToShow = state.clasifFilter ? [state.clasifFilter] : CLASIF_ORDER.filter(k => presentClasifs.has(k));
  const filterButtons = keysToShow.map(k => `
    <button class="clasif-long-btn ${state.clasifFilter === k ? 'active' : ''}" style="--c:${CLASIFICACIONES[k].color}" data-filter-clasif="${k}">
      <span class="clasif-long-icon">${CLASIFICACIONES[k].icon}</span>
      <span class="clasif-long-text">
        <span class="clasif-long-name">${classifLabel(k, state.lang)}</span>
        <span class="clasif-long-desc">${classifDesc(k, state.lang)}</span>
      </span>
    </button>`).join('');

  const visibles = state.clasifFilter
    ? clientesConClasif.filter(x => x.clasif === state.clasifFilter)
    : clientesConClasif;

  return `
    <div class="step-head">
      ${yayaBubble(L('confirmPaisClasifIntro', titleCase(state.pais)))}
    </div>
    <div class="clasif-long-list">${filterButtons}</div>
    <div class="step-head" style="margin-top:20px;">
      <h1>${L('askCliente')}</h1>
    </div>
    ${state.clasifFilter ? `
      <div class="filter-status-row">
        <span class="filter-status-count">${visibles.length} ${visibles.length === 1 ? L('accountSingular') : L('accounts')}</span>
        <button class="filter-clear-btn" id="filterClearBtn">${L('seeAllAccounts')}</button>
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

  const sucursalesRaw = (state.nav[state.region][state.pais][state.cliente] || []);
  const sucursalesConVenta = sucursalesRaw.map(s => {
    const sucSeries = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][s] && state.sucursalPeriodo[state.cliente][s].periods) || [];
    const sucRow = sucSeries.find(r => r.p === periodo);
    return { s, v: sucRow ? sucRow.v : -1, sucRow };
  }).sort((a, b) => b.v - a.v);

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
    ${renderAvgSalesBubble(metrics)}
    ${renderAccountRecoCard(metrics)}
    ${trend ? yayaBubble(trend.positive ? L('trendPositive', trend.months) : L('trendNegative', trend.months)) : ''}
    ${yayaBubble(L('askSucursal'))}
    <div class="pick-list">
      ${sucursalesConVenta.map(({ s, sucRow }) => {
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
          <div class="stat-value">${fmtMoney(metrics.valor)}</div>
          <div class="stat-label">${L('salesAmount')}</div>
          <div class="stat-sub ${gClass(metrics.growthValor)}">${fmtPct(metrics.growthValor)}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtUnits(metrics.unidades)}</div>
          <div class="stat-label">${L('unitsSold')}</div>
          <div class="stat-sub ${gClass(metrics.growthUnits)}">${fmtPct(metrics.growthUnits)}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtUnits(metrics.existencia)}</div>
          <div class="stat-label">${L('inventoryUnits')}</div>
        </div>
        <div class="stat">
          <div class="stat-value">${fmtWoh(metrics.woh)}</div>
          <div class="stat-label">${L('woh')}</div>
        </div>
      </div>
    </div>`;
}

function renderAvgSalesBubble(metrics) {
  if (metrics.avgUnits === null || metrics.avgUnits === undefined) return '';
  return yayaBubble(L('avgSalesLine', fmtUnits(metrics.avgUnits), metrics.nMonths));
}

const UN_ORDER = ['FW', 'APP', 'EQ', 'LIC'];

// ---------- Step: Sucursal (briefing, todo a nivel tienda) ----------
function renderSucursalBriefing() {
  const sucStore = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][state.sucursal]) || null;
  const sucSeries = sucStore ? sucStore.periods : [];
  if (!sucSeries.length) return `<div class="empty">${L('noData')}</div>`;
  if (!state.periodo || !sucSeries.some(r => r.p === state.periodo)) state.periodo = sucSeries[sucSeries.length - 1].p;
  const periodo = state.periodo;

  const simpleSeries = sucSeries.map(r => ({ p: r.p, u: r.u, v: r.v, e: r.e }));
  const metrics = computeMetricsForPeriod(simpleSeries, periodo);
  const periodRow = sucSeries.find(r => r.p === periodo);
  const cubeRows = (sucStore.cube && sucStore.cube[String(periodo)]) || [];

  const canPrev = sucSeries.some(r => r.p < periodo);
  const canNext = sucSeries.some(r => r.p > periodo);

  const catBreak = cubeBreakdown(cubeRows, 'cat');
  const topCat = catBreak.length ? catBreak[0].key : null;
  const topCatUnBreak = topCat ? cubeBreakdown(cubeFilterRows(cubeRows, { cat: topCat }), 'un') : [];
  const topCatUn = topCatUnBreak.length ? topCatUnBreak[0].key : null;

  return `
    <div class="period-nav">
      <button class="period-arrow" id="periodPrev" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="period-label">${periodoLabelI18n(periodo, state.lang)}</span>
      <button class="period-arrow" id="periodNext" ${canNext ? '' : 'disabled'}>›</button>
    </div>
    ${yayaBubble(L('beforeIndicators'))}
    ${metrics ? renderStatsCard(metrics, L('storeOverview')) : ''}
    ${periodRow ? renderStoreCard(cubeRows, sucStore, periodo) : `<div class="card muted-card">${L('noMovement', periodoLabelI18n(periodo, state.lang))}</div>`}
    ${topCat ? yayaBubble(topCatUn ? L('topDriverUn', t(state.lang, 'unLabels')[topCatUn] || topCatUn, catLabel(topCat)) : L('topDriverPlain', catLabel(topCat))) : ''}
    ${periodRow ? renderExploreSection(cubeRows, sucStore, periodo) : ''}
    ${renderRecommendationCard(cubeRows)}
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

// ---------- Tarjeta estática: "Datos relevantes de esta sucursal" ----------
function renderStoreCard(cubeRows, sucStore, periodo) {
  const unLabels = t(state.lang, 'unLabels');
  const unBreak = cubeBreakdown(cubeRows, 'un').sort((a, b) => UN_ORDER.indexOf(a.key) - UN_ORDER.indexOf(b.key));
  const totalUnUnits = unBreak.reduce((s, x) => s + x.u, 0) || 1;

  const catBreak = cubeBreakdown(cubeRows, 'cat').slice(0, 3);
  const totalCatUnits = cubeBreakdown(cubeRows, 'cat').reduce((s, x) => s + x.u, 0) || 1;

  const genBreak = cubeBreakdown(cubeRows, 'gen');
  const totalGenUnits = genBreak.reduce((s, x) => s + x.u, 0) || 1;
  const genLabels = t(state.lang, 'genLabels');
  const genOrder = ['MEN', 'WOMEN', 'KIDS'];

  const topFams = cubeTopFamilias(cubeRows, 3);
  const { avg, nMonths } = cubeAvgTrailing(sucStore, {}, periodo, 12);

  return `
    <div class="card store-card">
      <div class="stats-title">${L('relevantData')}</div>
      ${avg !== null ? `<div class="dynamic-avg">${L('avgSalesLine', fmtUnits(avg), nMonths)}</div>` : ''}

      <div class="un-bars">
        ${unBreak.map(x => `
          <div class="un-bar-row un-bar-static">
            <span class="un-bar-label">${unLabels[x.key] || x.key}</span>
            <div class="un-bar-track"><div class="un-bar-fill" style="width:${(x.u / totalUnUnits * 100).toFixed(0)}%"></div></div>
            <span class="un-bar-pct">${(x.u / totalUnUnits * 100).toFixed(0)}%</span>
          </div>
        `).join('')}
      </div>

      ${catBreak.length ? `
        <div class="chip-row">
          <span class="chip-row-label">${L('concentratedIn')}...</span>
          <div class="un-bars">
            ${catBreak.map(x => `
              <div class="un-bar-row un-bar-static">
                <span class="un-bar-label">${catLabel(x.key)}</span>
                <div class="un-bar-track"><div class="un-bar-fill cat-fill" style="width:${(x.u / totalCatUnits * 100).toFixed(0)}%"></div></div>
                <span class="un-bar-pct">${(x.u / totalCatUnits * 100).toFixed(0)}%</span>
              </div>
            `).join('')}
          </div>
        </div>` : ''}

      ${genBreak.length ? `
        <div class="chip-row">
          <span class="chip-row-label">${L('genderIn')}</span>
          <div class="un-bars">
            ${genOrder.filter(g => genBreak.some(x => x.key === g)).map(g => {
              const x = genBreak.find(y => y.key === g);
              return `
              <div class="un-bar-row un-bar-static">
                <span class="un-bar-label">${genLabels[g] || g}</span>
                <div class="un-bar-track"><div class="un-bar-fill gen-fill" style="width:${(x.u / totalGenUnits * 100).toFixed(0)}%"></div></div>
                <span class="un-bar-pct">${(x.u / totalGenUnits * 100).toFixed(0)}%</span>
              </div>`;
            }).join('')}
          </div>
        </div>` : ''}

      ${topFams.length ? `
        <div class="chip-row">
          <span class="chip-row-label">${L('leadingFamilies')}</span>
          ${renderFamList(topFams)}
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

// ---------- Sección interactiva: "¿Qué te gustaría explorar en esta sucursal?" ----------
function renderExploreSection(cubeRows, sucStore, periodo) {
  const unLabels = t(state.lang, 'unLabels');
  const genLabels = t(state.lang, 'genLabels');

  const unOptions = UN_ORDER.filter(u => cubeRows.some(r => r[0] === u));
  const catOptions = cubeBreakdown(cubeRows, 'cat').slice(0, 4).map(x => x.key);
  const genOrder = ['MEN', 'WOMEN', 'KIDS'];
  const genOptions = genOrder.filter(g => cubeRows.some(r => r[2] === g));

  const filters = { un: state.filterUn, cat: state.filterCat, gen: state.filterGen };
  const anyFilter = filters.un || filters.cat || filters.gen;

  let resultHtml = '';
  if (anyFilter) {
    const filtered = cubeFilterRows(cubeRows, filters);
    const totals = cubeTotals(filtered);
    const topFams = cubeTopFamilias(filtered, 3);
    const { avg } = cubeAvgTrailing(sucStore, filters, periodo, 12);
    const scopeParts = [];
    if (filters.un) scopeParts.push(unLabels[filters.un] || filters.un);
    if (filters.cat) scopeParts.push(catLabel(filters.cat));
    if (filters.gen) scopeParts.push(genLabels[filters.gen] || filters.gen);
    const scopeLabel = scopeParts.join(' de ');

    // Crecimiento vs mismo mes del año anterior, para esta misma combinación de filtros
    const pyPeriodo = periodo - 100;
    const pyRows = (sucStore.cube && sucStore.cube[String(pyPeriodo)]) || [];
    const pyTotals = cubeTotals(cubeFilterRows(pyRows, filters));
    const growthUnits = pyTotals.u ? (totals.u - pyTotals.u) / Math.abs(pyTotals.u) : null;
    const growthValor = pyTotals.v ? (totals.v - pyTotals.v) / Math.abs(pyTotals.v) : null;
    const woh = (avg && avg !== 0) ? (totals.e / avg) * 4.33 : null;

    resultHtml = `
      <div class="detail-panel">
        <div class="detail-panel-title">${scopeLabel}</div>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">${fmtMoney(totals.v)}</div>
            <div class="stat-label">${L('salesAmount')}</div>
            <div class="stat-sub ${gClass(growthValor)}">${fmtPct(growthValor)}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtUnits(totals.u)}</div>
            <div class="stat-label">${L('unitsSold')}</div>
            <div class="stat-sub ${gClass(growthUnits)}">${fmtPct(growthUnits)}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtUnits(totals.e)}</div>
            <div class="stat-label">${L('inventoryUnits')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtWoh(woh)}</div>
            <div class="stat-label">${L('woh')}</div>
          </div>
        </div>
        ${topFams.length ? `
          <div class="detail-section">
            <span class="detail-section-label">${L('leadingFamiliesScoped', scopeLabel)}</span>
            ${renderFamList(topFams)}
          </div>` : `<p class="explore-empty">${L('exploreNoData')}</p>`}
      </div>`;
  } else {
    resultHtml = `<p class="explore-hint">${L('exploreHint')}</p>`;
  }

  return `
    ${yayaBubble(L('exploreTitle'))}
    <div class="card explore-card">
      <div class="explore-group">
        <span class="detail-section-label">${L('businessUnitsIn')}</span>
        <div class="chips">
          ${unOptions.map(u => `<button class="chip chip-filter ${state.filterUn === u ? 'active' : ''}" data-filter-un="${u}">${unLabels[u] || u}</button>`).join('')}
        </div>
      </div>
      <div class="explore-group">
        <span class="detail-section-label">${L('categoriesIn')}</span>
        <div class="chips">
          ${catOptions.map(c => `<button class="chip chip-filter ${state.filterCat === c ? 'active' : ''}" data-filter-cat="${escapeAttr(c)}">${catLabel(c)}</button>`).join('')}
        </div>
      </div>
      <div class="explore-group">
        <span class="detail-section-label">${L('genderIn')}</span>
        <div class="chips">
          ${genOptions.map(g => `<button class="chip chip-filter ${state.filterGen === g ? 'active' : ''}" data-filter-gen="${g}">${genLabels[g] || g}</button>`).join('')}
        </div>
      </div>
      ${resultHtml}
    </div>`;
}

function renderAccountRecoCard(metrics) {
  const templates = t(state.lang, 'recoTemplates');
  if (!metrics || !metrics.clasif || !templates[metrics.clasif]) return '';
  return yayaBubble(`${templates[metrics.clasif]}`);
}

function renderRecommendationCard(cubeRows) {
  const lines = buildRecommendations(cubeRows);
  if (!lines.length) return '';
  return yayaBubble(`<ul class="reco-list">${lines.map(l => `<li>${l}</li>`).join('')}</ul>`);
}

function buildRecommendations(cubeRows) {
  const lines = [];
  if (!cubeRows || !cubeRows.length) return lines;
  const unLabels = t(state.lang, 'unLabels');
  const genLabels = t(state.lang, 'genLabels');

  // 1) Unidad de negocio líder + su género dominante
  const unBreak = cubeBreakdown(cubeRows, 'un');
  if (unBreak.length) {
    const topUn = unBreak[0].key;
    const genForUn = cubeBreakdown(cubeFilterRows(cubeRows, { un: topUn }), 'gen');
    if (genForUn.length) lines.push(L('recoUnGen', unLabels[topUn] || topUn, genLabels[genForUn[0].key] || genForUn[0].key));
    else lines.push(L('recoCat', unLabels[topUn] || topUn));
  }

  // 2) Producto de alta rotación con inventario en zona crítica, dentro de la categoría líder
  const catBreak = cubeBreakdown(cubeRows, 'cat');
  if (catBreak.length) {
    const topCat = catBreak[0].key;
    const catFams = cubeTopFamilias(cubeFilterRows(cubeRows, { cat: topCat }), 5);
    const hot = catFams.find(f => f.e && f.u && (f.e / f.u * 4.33) < 15);
    if (hot) lines.push(L('recoHotItem', titleCase(hot.fam), catLabel(topCat)));
    else lines.push(L('recoCat', catLabel(topCat)));
  }

  // 3) Alerta de posible quiebre de tallas, solo Calzado y Ropa
  for (const un of ['FW', 'APP']) {
    const unRows = cubeFilterRows(cubeRows, { un });
    if (!unRows.length) continue;
    const fams = cubeTopFamilias(unRows, 5);
    const low = fams.find(f => f.e && f.u && (f.e / f.u * 4.33) < 15);
    if (low) {
      const genForLow = cubeBreakdown(unRows, 'gen');
      const gen = genForLow.length ? genForLow[0].key : null;
      lines.push(L('recoLowWohSizes', titleCase(low.fam), gen ? (genLabels[gen] || gen) : (unLabels[un] || un)));
      break;
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
      else if (kind === 'cliente') { state.cliente = value; state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null; state.step = 'cuenta'; }
      else if (kind === 'sucursal') { state.sucursal = value; state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null; state.step = 'sucursal'; }
      pushHistory();
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
      pushHistory();
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
    state.filterUn = null; state.filterCat = null; state.filterGen = null;
    state.step = 'cuenta';
    pushHistory();
    render();
  });

  const navBackBtn = document.getElementById('navBackBtn');
  const navForwardBtn = document.getElementById('navForwardBtn');
  if (navBackBtn) navBackBtn.addEventListener('click', goStepBack);
  if (navForwardBtn) navForwardBtn.addEventListener('click', goStepForward);

  document.querySelectorAll('[data-filter-clasif]').forEach(el => {
    el.addEventListener('click', () => {
      const k = el.getAttribute('data-filter-clasif');
      state.clasifFilter = state.clasifFilter === k ? null : k;
      render();
    });
  });

  const filterClearBtn = document.getElementById('filterClearBtn');
  if (filterClearBtn) filterClearBtn.addEventListener('click', () => {
    state.clasifFilter = null;
    render();
  });

  document.querySelectorAll('[data-filter-un]').forEach(el => {
    el.addEventListener('click', () => {
      const un = el.getAttribute('data-filter-un');
      state.filterUn = state.filterUn === un ? null : un;
      render();
    });
  });
  document.querySelectorAll('[data-filter-cat]').forEach(el => {
    el.addEventListener('click', () => {
      const cat = el.getAttribute('data-filter-cat');
      state.filterCat = state.filterCat === cat ? null : cat;
      render();
    });
  });
  document.querySelectorAll('[data-filter-gen]').forEach(el => {
    el.addEventListener('click', () => {
      const gen = el.getAttribute('data-filter-gen');
      state.filterGen = state.filterGen === gen ? null : gen;
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

  const clasifGuideBtn = document.getElementById('clasifGuideBtn');
  const clasifGuideModal = document.getElementById('clasifGuideModal');
  if (clasifGuideBtn) clasifGuideBtn.addEventListener('click', () => clasifGuideModal.classList.remove('hidden'));
  const closeClasifGuide = document.getElementById('closeClasifGuide');
  if (closeClasifGuide) closeClasifGuide.addEventListener('click', () => clasifGuideModal.classList.add('hidden'));

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
    ? (state.sucursalPeriodo[state.cliente][state.sucursal].periods)
    : (state.clientePeriodo[state.cliente].hist);
  const periods = series.map(r => r.p).sort((a, b) => a - b);
  const idx = periods.indexOf(state.periodo);
  const newIdx = idx + dir;
  if (newIdx >= 0 && newIdx < periods.length) {
    state.periodo = periods[newIdx];
    state.filterUn = null; state.filterCat = null; state.filterGen = null;
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
    const payloads = splitByPeriodo(parsed);

    // Aplicamos los cambios en memoria de una vez (la app se ve actualizada al instante)
    for (const payload of payloads) {
      mergeClientePeriodo(state.clientePeriodo, payload.cliente_periodo);
      mergeSucursalPeriodo(state.sucursalPeriodo, payload.sucursal_periodo);
      mergeNav(state.nav, payload.nav);
    }

    // Guardado en Firebase en paralelo, para que un archivo con muchos meses no se sienta lento
    let done = 0;
    statusEl.textContent = L('savingProgress', done, payloads.length);
    await Promise.all(payloads.map(payload =>
      saveMonthlyUpload(payload).then(() => {
        done++;
        statusEl.textContent = L('savingProgress', done, payloads.length);
      })
    ));

    statusEl.textContent = L('done', labels);
    setTimeout(() => { document.getElementById('uploadModal').classList.add('hidden'); render(); }, 1200);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Error: ' + err.message;
  }
}

boot();
