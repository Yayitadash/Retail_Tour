// ============================================================
// RETAIL TOUR — Interfaz y lógica de Yaya (v2)
// ============================================================

const state = {
  nav: null, clientePeriodo: null, sucursalPeriodo: null,
  shardMap: null, loadedShards: null, loadedClientUploads: null,
  userRole: 'standard', // 'standard' | 'full' — según la clave con la que entró
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
function fmtMoneyShort(v) {
  if (v === null || v === undefined) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (abs >= 1000000) return sign + '$' + (abs / 1000000).toFixed(abs % 1000000 === 0 ? 0 : 1) + 'M';
  if (abs >= 1000) return sign + '$' + Math.round(abs / 1000) + 'K';
  return sign + '$' + Math.round(abs);
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
  return v >= 0 ? 'stat-pos' : 'stat-neg';
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
// Para cambiar cualquiera de las dos claves: edita el texto Y sube en 1 el
// número de APP_ACCESS_VERSION. Eso hace que TODOS los dispositivos (incluso
// los que ya tenían acceso, de cualquiera de los dos niveles) tengan que
// volver a escribir la clave nueva.
const APP_ACCESS_CODE = '1234';       // Acceso Estándar (vendedor / lead jr.)
const APP_ACCESS_CODE_FULL = '5678';  // Acceso Completo (lead senior / director)
const APP_ACCESS_VERSION = 1;

async function boot() {
  if (!hasAccess()) {
    renderAccessGate();
    return;
  }
  state.userRole = getAccessRole();
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
      saveAccess('standard');
      boot();
    } else if (val === APP_ACCESS_CODE_FULL) {
      saveAccess('full');
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
    const { nav, clientePeriodo, sucursalPeriodo, shardMap, loadedShards, loadedClientUploads } = await loadAllData();
    state.nav = nav;
    state.clientePeriodo = clientePeriodo;
    state.sucursalPeriodo = sucursalPeriodo;
    state.shardMap = shardMap;
    state.loadedShards = loadedShards;
    state.loadedClientUploads = loadedClientUploads;
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

/** Determina qué clientes hacen falta para la pantalla actual y trae sus datos si no están */
async function ensureShardsForContext() {
  if (state.step === 'cliente' && state.nav && state.region && state.pais) {
    const clientes = Object.keys(state.nav[state.region][state.pais] || {});
    await ensureClienteDataLoaded(state, clientes);
  } else if ((state.step === 'cuenta' || state.step === 'sucursal') && state.cliente) {
    await ensureClienteDataLoaded(state, [state.cliente]);
  }
}

/** Igual que render(), pero primero se asegura de tener los datos de sucursales que hagan falta */
async function renderWithData() {
  const needsShards = (state.step === 'cliente' || state.step === 'cuenta' || state.step === 'sucursal');
  if (needsShards) {
    renderLoading();
    try {
      await ensureShardsForContext();
    } catch (err) {
      console.error(err);
    }
  }
  render();
}

function goStepBack() {
  if (state.navPos <= 0) return;
  state.navPos--;
  Object.assign(state, state.navStack[state.navPos]);
  state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null;
  renderWithData();
}
function goStepForward() {
  if (state.navPos >= state.navStack.length - 1) return;
  state.navPos++;
  Object.assign(state, state.navStack[state.navPos]);
  state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null;
  renderWithData();
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
    let clasif = null, v = null, growth = null;
    if (cd && cd.hist.length) {
      clasif = lastKnownClasif(cd.hist);
      const lastP = cd.hist[cd.hist.length - 1].p;
      const m = computeMetricsForPeriod(cd.hist, lastP);
      if (m) { v = m.valor; growth = m.growthValor; }
    }
    return { c, clasif, v, growth };
  });

  const presentClasifs = new Set(clientesConClasif.map(x => x.clasif).filter(Boolean));
  const countsByClasif = {};
  for (const x of clientesConClasif) {
    if (x.clasif) countsByClasif[x.clasif] = (countsByClasif[x.clasif] || 0) + 1;
  }
  const keysToShow = state.clasifFilter ? [state.clasifFilter] : CLASIF_ORDER.filter(k => presentClasifs.has(k));
  const filterButtons = keysToShow.map(k => `
    <button class="clasif-long-btn ${state.clasifFilter === k ? 'active' : ''}" style="--c:${CLASIFICACIONES[k].color}" data-filter-clasif="${k}">
      <span class="clasif-long-icon">${CLASIFICACIONES[k].icon}</span>
      <span class="clasif-long-text">
        <span class="clasif-long-name">${classifLabel(k, state.lang)}</span>
        <span class="clasif-long-desc">${classifDesc(k, state.lang)}</span>
      </span>
      <span class="clasif-long-count">${countsByClasif[k] || 0}</span>
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
      ${visibles.map(({ c, clasif, v, growth }) => {
        const badge = clasif
          ? `<span class="mini-badge-icon" style="--c:${CLASIFICACIONES[clasif].color}" title="${classifLabel(clasif, state.lang)} — ${classifDesc(clasif, state.lang)}">${CLASIFICACIONES[clasif].icon}</span>`
          : '';
        return `
        <button class="pick-row" data-pick="cliente" data-value="${escapeAttr(c)}">
          <span class="pick-row-title">${titleCase(c)}</span>
          <span class="pick-row-right">
            ${v !== null ? `
              <span class="pick-row-sales">${fmtMoneyShort(v)}</span>
              <span class="pick-row-growth ${gClass(growth)}">${fmtPct(growth)}</span>
            ` : ''}
            ${badge}
          </span>
        </button>`;
      }).join('')}
    </div>`;
}

// ---------- Step: Cuenta (resumen general + elegir sucursal) ----------
function getClientCubeRows(cliente, periodo) {
  const stores = state.sucursalPeriodo[cliente] || {};
  let rows = [];
  for (const s in stores) {
    const r = stores[s].cube && stores[s].cube[String(periodo)];
    if (r) rows = rows.concat(r);
  }
  return rows;
}

/** Igual que arriba, pero cada fila conserva el nombre de la sucursal — lo necesita el reporte exportable */
function getClientCubeRowsWithStore(cliente, periodo) {
  const stores = state.sucursalPeriodo[cliente] || {};
  let rows = [];
  for (const s in stores) {
    const r = stores[s].cube && stores[s].cube[String(periodo)];
    if (r) rows = rows.concat(r.map(row => ({ s, un: row.un, cat: row.cat, gen: row.gen, fam: row.fam, u: row.u, v: row.v, e: row.e })));
  }
  return rows;
}

function clientCubeAvgTrailing(cliente, filters, periodo, months = 12) {
  const cd = state.clientePeriodo[cliente];
  const activePeriods = new Set((cd ? cd.hist : []).map(r => r.p));
  let sum = 0, nMonths = 0;
  for (let k = 0; k < months; k++) {
    const p = periodoAddMonths(periodo, -k);
    if (!activePeriods.has(p)) continue;
    nMonths++;
    sum += cubeTotals(cubeFilterRows(getClientCubeRows(cliente, p), filters)).u;
  }
  if (nMonths === 0) return { avg: null, nMonths: 0 };
  return { avg: sum / nMonths, nMonths };
}

function renderAccountFilters(cliente, periodo) {
  const cubeRows = getClientCubeRows(cliente, periodo);
  if (!cubeRows.length) return '';
  const unLabels = t(state.lang, 'unLabels');
  const genLabels = t(state.lang, 'genLabels');

  const unOptions = UN_ORDER.filter(u => cubeRows.some(r => r.un === u));
  const catOptions = cubeBreakdown(cubeRows, 'cat').slice(0, 4).map(x => x.key);
  const genOrder = ['MEN', 'WOMEN', 'KIDS'];
  const genOptions = genOrder.filter(g => cubeRows.some(r => r.gen === g));

  return `
    ${yayaBubble(L('exploreAccountTitle'))}
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
    </div>`;
}

function accountFilterScopeLabel() {
  const unLabels = t(state.lang, 'unLabels');
  const genLabels = t(state.lang, 'genLabels');
  const parts = [];
  if (state.filterUn) parts.push(unLabels[state.filterUn] || state.filterUn);
  if (state.filterCat) parts.push(catLabel(state.filterCat));
  if (state.filterGen) parts.push(genLabels[state.filterGen] || state.filterGen);
  return parts.join(' de ');
}

const DIM_NOUN = {
  es: { un: 'unidad', cat: 'categoría', fam: 'producto' },
  en: { un: 'business unit', cat: 'category', fam: 'product' }
};

/**
 * Analiza las distintas dimensiones de la cuenta (UN, categoría, familia)
 * y elige UN solo hallazgo — el más relevante comercialmente según las
 * reglas propias de cada clasificación — para el mensaje de Yaya.
 * Devuelve null si no hay nada suficientemente relevante que señalar.
 */
function findAccountInsight(cliente, periodo, clasif) {
  const HEALTHY_LOW = 20, HEALTHY_HIGH = 26;
  const rows = getClientCubeRows(cliente, periodo);
  if (!rows.length) return null;
  const totalV = cubeTotals(rows).v || 1;

  const buildCandidate = (type, key, label, filterObj) => {
    const filtered = cubeFilterRows(rows, filterObj);
    const tot = cubeTotals(filtered);
    if (!tot.v) return null;
    const avg = clientCubeAvgTrailing(cliente, filterObj, periodo, 12).avg;
    const woh = (avg && avg !== 0) ? (tot.e / avg * 4.33) : null;
    if (woh === null) return null;
    return { type, key, label, share: tot.v / totalV, woh, v: tot.v, u: tot.u };
  };

  const unLabels = t(state.lang, 'unLabels');
  const unCandidates = UN_ORDER.filter(u => rows.some(r => r.un === u))
    .map(u => buildCandidate('un', u, unLabels[u] || u, { un: u })).filter(Boolean);

  const catTop = cubeBreakdown(rows, 'cat').slice(0, 6);
  const catCandidates = catTop
    .map(c => buildCandidate('cat', c.key, catLabel(c.key), { cat: c.key })).filter(Boolean);

  const famTop = cubeTopFamilias(rows, 8);
  const famCandidates = famTop.map(f => {
    const woh = (f.e && f.u) ? (f.e / f.u * 4.33) : null;
    if (woh === null) return null;
    return { type: 'fam', key: f.fam, label: titleCase(f.fam), share: f.v / totalV, woh, v: f.v, u: f.u };
  }).filter(Boolean);

  const majorPool = unCandidates.concat(catCandidates);

  function bestByScore(pool, scoreFn, minShare) {
    const filtered = pool.filter(c => (!minShare || c.share >= minShare) && scoreFn(c) > 0);
    if (!filtered.length) return null;
    return filtered.reduce((a, b) => scoreFn(a) >= scoreFn(b) ? a : b);
  }

  if (clasif === 'Riesgo Crítico' || clasif === 'Las Robustas') {
    const scoreFn = c => c.share * (c.woh - HEALTHY_HIGH);
    let best = bestByScore(majorPool, scoreFn, 0.15);
    if (!best) best = bestByScore(famCandidates, scoreFn, 0);
    if (!best) return null;
    const key = clasif === 'Riesgo Crítico' ? 'insightRiesgoCritico' : 'insightRobustas';
    return L(key, best.label, Math.round(best.share * 100), best.woh.toFixed(1));
  }

  if (clasif === 'Desabastecidas') {
    const scoreFn = c => c.share * (HEALTHY_LOW - c.woh);
    let best = bestByScore(majorPool, scoreFn, 0.15);
    if (!best) best = bestByScore(famCandidates, scoreFn, 0);
    if (!best) return null;
    return L('insightDesabastecidas', best.label, DIM_NOUN[state.lang][best.type], Math.round(best.share * 100), best.woh.toFixed(1));
  }

  if (clasif === 'Zona de Riesgo') {
    const findImbalance = (candidates, dimType) => {
      const top4 = candidates.slice().sort((a, b) => b.share - a.share).slice(0, 4);
      if (top4.length < 2) return null;
      const leader = top4[0];
      let bestPair = null, bestSpread = 0;
      for (let i = 1; i < top4.length; i++) {
        const other = top4[i];
        let spread = 0, lowSide = null, highSide = null;
        if (leader.woh < HEALTHY_LOW && other.woh > HEALTHY_HIGH) { spread = other.woh - leader.woh; lowSide = leader; highSide = other; }
        else if (leader.woh > HEALTHY_HIGH && other.woh < HEALTHY_LOW) { spread = leader.woh - other.woh; lowSide = other; highSide = leader; }
        if (spread > bestSpread) { bestSpread = spread; bestPair = { lowSide, highSide }; }
      }
      return bestPair ? { ...bestPair, noun: DIM_NOUN[state.lang][dimType] } : null;
    };
    const result = findImbalance(catCandidates, 'cat') || findImbalance(unCandidates, 'un');
    if (!result) return null;
    return L('insightZonaRiesgo', result.lowSide.label, result.highSide.label, result.noun);
  }

  if (clasif === 'Las Estrellas') {
    const candidate = famCandidates.slice().sort((a, b) => b.v - a.v).find(c => c.woh < HEALTHY_LOW);
    if (candidate) return L('insightEstrellas', candidate.label, candidate.woh.toFixed(1));
    const catCandidate = catCandidates.slice().sort((a, b) => b.share - a.share).find(c => c.woh < HEALTHY_LOW);
    if (catCandidate) return L('insightEstrellas', catCandidate.label, catCandidate.woh.toFixed(1));
    return null;
  }

  if (clasif === 'Las Aceleradas') {
    const pool = famCandidates.concat(catCandidates).concat(unCandidates);
    let candidate = pool.filter(c => c.woh < 15).sort((a, b) => b.v - a.v)[0];
    if (!candidate) candidate = pool.filter(c => c.woh < 18).sort((a, b) => b.v - a.v)[0];
    if (!candidate) return null;
    return L('insightAceleradas', candidate.label, candidate.woh.toFixed(1));
  }

  return null;
}

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

  const filters = { un: state.filterUn, cat: state.filterCat, gen: state.filterGen };
  const anyFilter = filters.un || filters.cat || filters.gen;
  const scopeLabel = anyFilter ? accountFilterScopeLabel() : null;

  let statsCardHtml;
  if (anyFilter) {
    const curRows = cubeFilterRows(getClientCubeRows(state.cliente, periodo), filters);
    const curTotals = cubeTotals(curRows);
    const pyRows = cubeFilterRows(getClientCubeRows(state.cliente, periodo - 100), filters);
    const pyTotals = cubeTotals(pyRows);
    const growthUnits = pyTotals.u ? (curTotals.u - pyTotals.u) / Math.abs(pyTotals.u) : null;
    const growthValor = pyTotals.v ? (curTotals.v - pyTotals.v) / Math.abs(pyTotals.v) : null;
    const { avg } = clientCubeAvgTrailing(state.cliente, filters, periodo, 12);
    const woh = (avg && avg !== 0) ? (curTotals.e / avg) * 4.33 : null;
    statsCardHtml = `
      <div class="card stats-card">
        <div class="stats-title">${L('accountOverview')} — ${scopeLabel}</div>
        <div class="stats-grid">
          <div class="stat">
            <div class="stat-value">${fmtMoney(curTotals.v)}</div>
            <div class="stat-label">${L('salesAmount')}</div>
            <div class="stat-sub ${gClass(growthValor)}">${fmtPct(growthValor)}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtUnits(curTotals.u)}</div>
            <div class="stat-label">${L('unitsSold')}</div>
            <div class="stat-sub ${gClass(growthUnits)}">${fmtPct(growthUnits)}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtUnits(curTotals.e)}</div>
            <div class="stat-label">${L('inventoryUnits')}</div>
          </div>
          <div class="stat">
            <div class="stat-value">${fmtWoh(woh)}</div>
            <div class="stat-label">${L('woh')}</div>
          </div>
        </div>
      </div>`;
  } else {
    statsCardHtml = renderStatsCard(metrics, L('accountOverview'));
  }

  const sucursalesRaw = (state.nav[state.region][state.pais][state.cliente] || []);
  const sucursalesConVenta = sucursalesRaw.map(s => {
    const sucStore = (state.sucursalPeriodo[state.cliente] && state.sucursalPeriodo[state.cliente][s]) || null;
    const sucSeries = sucStore ? sucStore.periods : [];
    const sucRow = sucSeries.find(r => r.p === periodo);
    const pyRow = sucSeries.find(r => r.p === periodo - 100);

    let v, growthValor, hasData;
    if (anyFilter) {
      const curRows = cubeFilterRows((sucStore && sucStore.cube && sucStore.cube[String(periodo)]) || [], filters);
      const curT = cubeTotals(curRows);
      const pyRows = cubeFilterRows((sucStore && sucStore.cube && sucStore.cube[String(periodo - 100)]) || [], filters);
      const pyT = cubeTotals(pyRows);
      v = curT.v;
      growthValor = pyT.v ? (curT.v - pyT.v) / Math.abs(pyT.v) : null;
      hasData = !!sucRow; // la sucursal reportó ese mes, aunque esta combinación específica dé 0
    } else {
      v = sucRow ? sucRow.v : -1;
      growthValor = (sucRow && pyRow && pyRow.v) ? (sucRow.v - pyRow.v) / Math.abs(pyRow.v) : null;
      hasData = !!sucRow;
    }
    return { s, v, hasData, growthValor };
  }).sort((a, b) => b.v - a.v);

  return `
    <div class="step-head">
      ${yayaBubble(L('confirmCliente', titleCase(state.cliente)))}
    </div>
    <div class="period-nav">
      <button class="period-arrow" id="periodPrev" ${canPrev ? '' : 'disabled'}>‹</button>
      <span class="period-label">${periodoLabelI18n(periodo, state.lang)}</span>
      <button class="period-arrow" id="periodNext" ${canNext ? '' : 'disabled'}>›</button>
      <button class="download-report-btn" id="downloadReportBtn" title="${L('downloadReport')}">⤓</button>
    </div>
    ${yayaBubble(L('beforeStore'))}
    ${renderClassificationCard(metrics, streak, form)}
    ${statsCardHtml}
    ${!anyFilter ? renderAvgSalesBubble(metrics) : ''}
    ${!anyFilter ? renderAccountInsightBubble(state.cliente, periodo, metrics ? metrics.clasif : null) : ''}
    ${renderAccountFilters(state.cliente, periodo)}
    ${yayaBubble(L('askSucursal'))}
    <div class="pick-list">
      ${sucursalesConVenta.map(({ s, hasData, v, growthValor }) => {
        return `
        <button class="pick-row" data-pick="sucursal" data-value="${escapeAttr(s)}">
          <span class="pick-row-title">${titleCase(s)}</span>
          <span class="pick-row-right">
            ${hasData ? `
              <span class="pick-row-sales">${fmtMoneyShort(v)}</span>
              <span class="pick-row-growth ${gClass(growthValor)}">${fmtPct(growthValor)}</span>
            ` : `<span class="pick-row-sales pick-row-sales-empty">${L('noMovementShort')}</span>`}
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

  const unOptions = UN_ORDER.filter(u => cubeRows.some(r => r.un === u));
  const catOptions = cubeBreakdown(cubeRows, 'cat').slice(0, 4).map(x => x.key);
  const genOrder = ['MEN', 'WOMEN', 'KIDS'];
  const genOptions = genOrder.filter(g => cubeRows.some(r => r.gen === g));

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

function renderAccountInsightBubble(cliente, periodo, clasif) {
  if (!clasif) return '';
  const msg = findAccountInsight(cliente, periodo, clasif);
  if (!msg) return '';
  return yayaBubble(msg);
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
    el.addEventListener('click', async () => {
      const kind = el.getAttribute('data-pick');
      const value = el.getAttribute('data-value');
      if (kind === 'region') { state.region = value; state.step = 'pais'; }
      else if (kind === 'pais') { state.pais = value; state.clasifFilter = null; state.clasifLegendOpen = false; state.step = 'cliente'; }
      else if (kind === 'cliente') { state.cliente = value; state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null; state.step = 'cuenta'; }
      else if (kind === 'sucursal') { state.sucursal = value; state.periodo = null; state.filterUn = null; state.filterCat = null; state.filterGen = null; state.step = 'sucursal'; }
      pushHistory();
      await renderWithData();
    });
  });
  document.querySelectorAll('[data-nav]').forEach(el => {
    el.addEventListener('click', async () => {
      const target = el.getAttribute('data-nav');
      state.step = target;
      state.periodo = null;
      state.clasifFilter = null; state.clasifLegendOpen = false;
      if (target === 'region') { state.pais = state.cliente = state.sucursal = null; }
      if (target === 'pais') { state.cliente = state.sucursal = null; }
      if (target === 'cuenta') { state.sucursal = null; }
      pushHistory();
      await renderWithData();
    });
  });
  const prevBtn = document.getElementById('periodPrev');
  const nextBtn = document.getElementById('periodNext');
  if (prevBtn) prevBtn.addEventListener('click', () => shiftPeriod(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => shiftPeriod(1));
  const downloadBtn = document.getElementById('downloadReportBtn');
  if (downloadBtn) downloadBtn.addEventListener('click', () => downloadAccountReport(state.cliente, state.periodo));

  const anotherStoreBtn = document.getElementById('anotherStoreBtn');
  if (anotherStoreBtn) anotherStoreBtn.addEventListener('click', async () => {
    state.sucursal = null;
    state.periodo = null;
    state.filterUn = null; state.filterCat = null; state.filterGen = null;
    state.step = 'cuenta';
    pushHistory();
    await renderWithData();
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

// ============================================================
// Reporte descargable: un HTML autocontenido e interactivo con los
// datos de una cuenta en un mes específico — para compartir fuera de
// la app. Mismo espíritu que el reporte individual (Gold Medal), con
// filtros combinables de sucursal/UN/categoría/género.
// ============================================================
function downloadAccountReport(cliente, periodo) {
  const rows = getClientCubeRowsWithStore(cliente, periodo);
  const pyPeriodo = periodo - 100;
  const pyRows = getClientCubeRowsWithStore(cliente, pyPeriodo);
  const anio = Math.floor(periodo / 100), mes = periodo % 100;

  // Comentario general del reporte: describe cómo cerró la cuenta en cuanto
  // a su clasificación (venta/inventario) ese mes, reusando el mismo texto
  // de classifDesc() que ya usa la app — sin nombrar la clasificación, solo
  // con su ícono. Se arma en ambos idiomas de una vez para que el reporte
  // descargado pueda cambiar de idioma sin depender de la app. Sin ninguna
  // referencia a "Yaya": este documento puede terminar en manos del cliente,
  // así que el texto va en tono de análisis neutral, no de asistente.
  //
  // Nota: antes también mencionaba de qué clasificación venía la cuenta el
  // mes anterior, pero classifDesc() está escrito como etiqueta para EL MES
  // ACTUAL (p. ej. Aceleradas dice "...necesitan inventario ya", un tono de
  // urgencia que solo tiene sentido hablando de ahora) y al reusarlo para
  // describir el mes anterior la frase se volvía confusa. Se quitó esa parte
  // y el comentario se queda solo con la situación del mes actual.
  const cd = state.clientePeriodo[cliente];
  const metrics = cd ? computeMetricsForPeriod(cd.hist, periodo) : null;
  const clasif = metrics ? metrics.clasif : null;
  const fullHist = cd ? computeFullHistory(cd.hist) : [];
  const streak = clasif ? detectStreak(fullHist, periodo) : null;

  function buildClasifNarrative(lang) {
    if (!clasif) return null;
    const desc = classifDesc(clasif, lang);
    let sentence = (lang === 'es' ? 'La cuenta tuvo ' : 'The account had ') + desc;
    if (streak && streak.meses > 1) {
      sentence += lang === 'es'
        ? ' Lleva ' + streak.meses + ' meses consecutivos con este comportamiento.'
        : ' It has kept this pattern for ' + streak.meses + ' straight months.';
    }
    return sentence;
  }

  const insightEs = buildClasifNarrative('es');
  const insightEn = buildClasifNarrative('en');
  const clasifIcon = clasif && CLASIFICACIONES[clasif] ? CLASIFICACIONES[clasif].icon : '📊';

  const html = buildAccountReportHTML(cliente, mes, anio, rows, pyRows, { es: insightEs, en: insightEn, icon: clasifIcon });
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const safeCliente = titleCase(cliente).replace(/[^a-zA-Z0-9]+/g, '_');

  // En celular (sobre todo iOS/Safari), forzar la descarga de un .html con el
  // atributo `download` hace que el teléfono lo trate como un documento
  // genérico para compartir en vez de abrirlo como página — nunca se ve el
  // reporte de verdad. Ahí, en lugar de descargarlo, lo abrimos directo en
  // una pestaña nueva para que se vea y funcione igual que en computadora.
  // En computadora sí conviene el archivo descargado (para adjuntarlo a un
  // correo, por ejemplo), así que ese flujo no cambia.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isMobile) {
    window.open(url, '_blank');
  } else {
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeCliente}_${periodoLabelI18n(periodo, 'es').replace(/\s+/g, '')}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}


const HND_XBOLD_B64 = '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';
const HND_BOLD_B64 = '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';

function buildAccountReportHTML(cliente, mes, anio, rows, pyRows, insight) {
  const dataJson = JSON.stringify({ cliente, periodo: { mes, anio }, rows, pyRows: pyRows || [], insight: insight || { es: null, en: null, icon: '📊' } });
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleCase(cliente)} — Retail Tour</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  @font-face{
    font-family:'Helvetica Now Display'; font-weight:800; font-style:normal; font-display:swap;
    src:url(data:font/woff2;base64,${HND_XBOLD_B64}) format('woff2');
  }
  @font-face{
    font-family:'Helvetica Now Display'; font-weight:700; font-style:normal; font-display:swap;
    src:url(data:font/woff2;base64,${HND_BOLD_B64}) format('woff2');
  }
  :root{
    --paper:#F6F3EC; --paper-card:#FFFFFF; --ink:#17202A; --text:#2A322D; --text-soft:#6B6459;
    --line:#E4DFD3; --gold:#C89B3C; --gold-soft:#EDE0C2; --steel:#3A5A78; --red:#B4432F; --green:#3E7A4F;
    --radius:14px; --font-display:'Helvetica Now Display',sans-serif; --font-body:'Inter',sans-serif; --font-mono:'IBM Plex Mono',monospace;
  }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--paper); color:var(--text); font-family:var(--font-body); line-height:1.5; -webkit-font-smoothing:antialiased;}
  .wrap{max-width:880px; margin:0 auto; padding:0 20px 80px;}
  header{display:flex; justify-content:space-between; align-items:flex-start; padding:32px 0 24px; border-bottom:2px solid var(--ink); gap:16px; flex-wrap:wrap;}
  .brand{display:flex; flex-direction:column; gap:2px;}
  .brand-eyebrow{font-family:var(--font-mono); font-size:11px; letter-spacing:0.06em; color:var(--gold); text-transform:uppercase;}
  .brand-name{font-family:var(--font-display); font-weight:800; font-size:clamp(40px,10vw,102px); color:var(--ink); line-height:0.9; text-transform:uppercase; letter-spacing:-0.01em;}
  .brand-period{font-size:14px; color:var(--text-soft); margin-top:4px;}
  .lang-btn{font-family:var(--font-mono); font-size:12px; font-weight:500; letter-spacing:0.03em; border:1.5px solid var(--ink); background:none; color:var(--ink); padding:8px 14px; border-radius:8px; cursor:pointer;}
  .lang-btn:hover{background:var(--ink); color:var(--paper);}
  .filter-bar{display:flex; align-items:center; gap:8px; flex-wrap:wrap; padding:14px 0; border-bottom:1px solid var(--line); min-height:20px;}
  .filter-bar.empty{display:none;}
  .filter-bar-label{font-size:12px; color:var(--text-soft); margin-right:2px;}
  .filter-chip{display:flex; align-items:center; gap:6px; background:var(--ink); color:var(--paper); font-family:var(--font-mono); font-size:11.5px; padding:5px 6px 5px 12px; border-radius:20px;}
  .filter-chip button{background:rgba(255,255,255,0.18); border:none; color:var(--paper); width:18px; height:18px; border-radius:50%; cursor:pointer; font-size:12px; line-height:1; display:flex; align-items:center; justify-content:center;}
  .filter-clear-all{font-family:var(--font-mono); font-size:11.5px; color:var(--red); background:none; border:none; cursor:pointer; text-decoration:underline; padding:5px 0;}
  .hero{padding:32px 0 8px; text-align:center;}
  .hero-label{font-size:14px; color:var(--text-soft); margin-bottom:8px;}
  .hero-number{font-family:var(--font-display); font-weight:800; font-size:clamp(56px,12vw,104px); color:var(--ink); line-height:1;}
  .hero-growth{font-family:var(--font-mono); font-weight:600; font-size:17px; margin-top:10px;}
  .hero-growth-empty{font-family:var(--font-body); font-weight:400; font-size:12.5px; color:var(--text-soft); font-style:italic;}
  .hero-sub{display:flex; justify-content:center; gap:36px; margin-top:26px; flex-wrap:wrap;}
  .hero-stat{text-align:center;}
  .hero-stat-value{font-family:var(--font-mono); font-weight:500; font-size:32px; color:var(--ink);}
  .hero-stat-label{font-size:13px; color:var(--text-soft); margin-top:4px;}
  .hero-stat-growth{font-family:var(--font-mono); font-weight:600; font-size:11.5px; margin-top:3px;}
  .podium-growth{font-family:var(--font-mono); font-weight:600; font-size:11px; margin-top:2px;}
  .stat-pos{color:var(--green);}
  .stat-neg{color:var(--red);}
  .insight-note{margin:22px 0;}
  .insight-note-label{font-family:var(--font-mono); font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--gold); margin-bottom:4px;}
  .insight-note-icon{font-size:17px; line-height:1;}
  .insight-note-text{font-size:14px; line-height:1.5; color:var(--text-soft); font-style:italic;}
  section{margin-top:48px;}
  .section-head{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:16px; gap:12px;}
  .section-title{font-family:var(--font-display); font-weight:700; font-size:22px; color:var(--ink); text-transform:uppercase; letter-spacing:-0.005em;}
  .section-note{font-size:12px; color:var(--text-soft);}
  .podium-list{display:flex; flex-direction:column; gap:9px;}
  .podium-row{display:grid; grid-template-columns:26px 1fr 44px auto; align-items:center; gap:12px; background:var(--paper-card); border:1.5px solid var(--line); border-radius:var(--radius); padding:12px 16px; cursor:pointer; text-align:left; width:100%; font-family:inherit; color:inherit;}
  .podium-row:hover{border-color:var(--gold-soft);}
  .podium-row.active{border-color:var(--gold); background:color-mix(in srgb, var(--gold) 6%, white);}
  .podium-row.dim{opacity:0.4;}
  .store-back-btn{display:flex; align-items:center; justify-content:center; gap:6px; background:none; border:1.5px dashed var(--line); border-radius:var(--radius); padding:11px 16px; font-family:var(--font-mono); font-size:12.5px; color:var(--text-soft); cursor:pointer; width:100%;}
  .store-back-btn:hover{border-color:var(--gold); color:var(--ink);}
  .podium-rank{font-family:var(--font-display); font-weight:700; font-size:18px; color:var(--gold); text-align:center;}
  .podium-main{display:flex; flex-direction:column; gap:5px; min-width:0;}
  .podium-name{font-weight:600; font-size:14px; color:var(--ink);}
  .podium-track-row{display:flex; align-items:center; gap:7px;}
  .podium-track{flex:1; background:var(--paper); border-radius:6px; height:7px; overflow:hidden;}
  .podium-fill{background:var(--gold); height:100%; border-radius:6px;}
  .podium-share-inline{font-family:var(--font-mono); font-weight:700; font-size:11px; color:var(--gold); white-space:nowrap;}
  .podium-woh{text-align:center; white-space:nowrap;}
  .podium-woh-value{font-family:var(--font-mono); font-weight:600; font-size:14px; color:var(--steel);}
  .podium-woh-label{font-family:var(--font-mono); font-size:8.5px; color:var(--text-soft); letter-spacing:0.04em;}
  .podium-figures{text-align:right; white-space:nowrap;}
  .podium-money{font-family:var(--font-mono); font-weight:700; font-size:21px; color:var(--ink);}
  .bar-list{display:flex; flex-direction:column; gap:10px;}
  .bar-row{display:grid; grid-template-columns:100px 1fr 48px; align-items:center; gap:12px; background:none; border:1.5px solid transparent; border-radius:9px; padding:5px 8px; cursor:pointer; font-family:inherit; color:inherit; text-align:left; width:100%;}
  .bar-row:hover{border-color:var(--line);}
  .bar-row.active{border-color:var(--gold); background:color-mix(in srgb, var(--gold) 6%, white);}
  .bar-row.dim{opacity:0.4;}
  .bar-label{font-family:var(--font-mono); font-size:12px; font-weight:500; color:var(--text);}
  .bar-track{background:var(--paper-card); border:1px solid var(--line); border-radius:7px; height:12px; overflow:hidden;}
  .bar-fill{height:100%; border-radius:7px 0 0 7px;}
  .bar-fill.steel{background:var(--steel);} .bar-fill.gold{background:var(--gold);}
  .bar-pct{font-family:var(--font-mono); font-size:12.5px; font-weight:600; color:var(--ink); text-align:right;}
  .two-col{display:grid; grid-template-columns:1fr 1fr; gap:36px;}
  @media (max-width:640px){ .two-col{grid-template-columns:1fr;} }
  .table-scroll{width:100%; overflow-x:auto; -webkit-overflow-scrolling:touch;}
  .fam-table{width:100%; min-width:560px; border-collapse:collapse;}
  .fam-table th{text-align:left; font-family:var(--font-mono); font-size:11px; text-transform:uppercase; letter-spacing:0.04em; color:var(--text-soft); font-weight:500; padding:0 10px 10px 0; border-bottom:1.5px solid var(--ink); white-space:nowrap;}
  .fam-table th.num, .fam-table td.num{text-align:right;}
  .fam-table td{padding:12px 10px 12px 0; border-bottom:1px solid var(--line); font-size:14px; white-space:nowrap;}
  .fam-table td.num{font-family:var(--font-mono);}
  .fam-col-pct{font-size:11px; font-weight:400; color:var(--text-soft);}
  .woh-arrow{font-size:10px; margin-left:2px;}
  .cat-list{display:flex; flex-direction:column; gap:10px;}
  .cat-row{display:block; background:var(--paper-card); border:1.5px solid var(--line); border-radius:var(--radius); padding:12px 16px; cursor:pointer; font-family:inherit; color:inherit; text-align:left; width:100%;}
  .cat-row:hover{border-color:var(--gold-soft);}
  .cat-row.active{border-color:var(--gold); background:color-mix(in srgb, var(--gold) 6%, white);}
  .cat-row.dim{opacity:0.4;}
  .cat-row-top{display:flex; justify-content:space-between; align-items:baseline; margin-bottom:6px; gap:10px;}
  .cat-label{font-family:var(--font-mono); font-size:13px; font-weight:600; color:var(--text);}
  .cat-share{font-size:11px; font-weight:400; color:var(--text-soft); white-space:nowrap;}
  .cat-row-stats{display:flex; gap:22px; margin-top:10px; flex-wrap:wrap;}
  .cat-stat-value{font-family:var(--font-mono); font-size:14px; font-weight:600; color:var(--ink);}
  .cat-stat-label{font-size:10px; color:var(--text-soft); text-transform:uppercase; letter-spacing:0.03em; margin-top:2px;}
  .woh-down{color:var(--red);}
  .woh-up{color:var(--green);}
  .fam-rank{color:var(--text-soft); font-family:var(--font-mono); width:24px; display:inline-block;}
  .fam-empty{padding:30px 0; text-align:center; color:var(--text-soft); font-size:13.5px;}
  footer{margin-top:60px; padding-top:20px; border-top:1px solid var(--line); font-size:12px; color:var(--text-soft); display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px;}
</style>
</head>
<body>
<div class="wrap" id="app"></div>
<script>
let DATA = ${dataJson};
let LANG = 'es';
let filters = { s: null, un: null, cat: null, gen: null };
const MESES = { es:['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
                en:['January','February','March','April','May','June','July','August','September','October','November','December'] };
const I18N = {
  es: { eyebrow:'Retail Tour — Reporte Mensual', periodLabel:(m,a)=>MESES.es[m-1]+' '+a, heroLabelAll:'Venta total del periodo', heroLabelFiltered:'Venta de la selección',
    unitsLabel:'Unidades vendidas', inventoryLabel:'Unidades en inventario', wohLabel:'Semanas de inventario',
    storesLabel:'Sucursales', storesTitle:'Desempeño por sucursal', storesNote:'toca una para filtrar todo lo demás',
    storesNoteFiltered:'mostrando solo esta selección', backToAllStores:'Ver todas las sucursales', backToAllCats:'Ver todas las categorías',
    unTitle:'Unidad de negocio', catTitle:'Categoría', genTitle:'Género', catStatSales:'Venta', catStatGrowth:'vs año anterior',
    famTitle:'Familias / siluetas líderes', famNote:'top 10 por venta, dentro de la selección',
    famCol1:'Familia / Silueta', famColSold:'Unid. vendidas', famColInv:'Inventario', famColWoh:'WOH', famCol3:'Venta', famCol4:'% de la selección', famEmpty:'No hay datos para esta combinación.',
    clearAll:'Ver todo', footerLeft:'Preparado con Retail Tour', footerRight:(m,a)=>'Datos de '+MESES.es[m-1].toLowerCase()+' '+a,
    vsPy:(m,a)=>'vs '+MESES.es[m-1]+' '+a, noPyData:'Sin datos del año anterior para comparar',
    insightLabel:'Observación', noChange:'No hay cambios',
    insightGeneralLabel:'Observación', insightStoresLabel:'Sucursales', insightCatLabel:'Categorías', insightFamLabel:'Inventario', insightUnGenLabel:'BU y Género',
    nounStore:'sucursal', nounCat:'categoría', nounFam:'producto',
    insightGeneralNeutral:'La cuenta no muestra señales de riesgo relevantes en este periodo.',
    insightUnGenNeutral:'No hay suficientes datos de unidad de negocio o género en esta selección.',
    insightGrowthSuffix:(g)=>' Cambió '+g+' frente al año anterior.',
    insightUnGenSelected:(name,sharePct,woh,growthSuffix)=>name+' representa el '+sharePct+'% de la venta seleccionada, con '+woh+' semanas de inventario.'+growthSuffix,
    insightUnTop:(name,sharePct,woh,growthSuffix)=>name+' es tu unidad de negocio más fuerte este periodo, con '+sharePct+'% de la venta y '+woh+' semanas de inventario.'+growthSuffix,
    insightStoresNeutral:'La cobertura de inventario entre sucursales se ve equilibrada, sin señales de riesgo relevantes.',
    insightCatNeutral:'La cobertura de inventario entre categorías se ve equilibrada, sin señales de riesgo relevantes.',
    insightFamNeutral:'La cobertura de inventario en las familias líderes se ve saludable, sin señales de desabasto ni sobre-stock relevantes.',
    insightRobustas:(label,noun,sharePct,woh)=>label+' es tu '+noun+' más fuerte ('+sharePct+'% de la venta), pero ya acumula '+woh+' semanas de inventario. Vale la pena revisar el mix ahí antes de seguir reabasteciendo.',
    insightDesabastecidas:(label,noun,sharePct,woh)=>label+' es tu '+noun+' más fuerte ('+sharePct+'% de la venta), pero su inventario apenas alcanza '+woh+' semanas. Ahí puede haber ventas quedándose sobre la mesa por falta de stock.',
    insightEstrellas:(label,noun,woh)=>label+' es tu '+noun+' más fuerte este mes, pero su inventario ya bajó a '+woh+' semanas. Vale la pena asegurar reabastecimiento para no perder ese impulso.',
    insightAceleradas:(label,woh)=>label+' está entre lo más vendido y su inventario ya bajó a solo '+woh+' semanas. Con el ritmo de crecimiento, vale la pena anticiparse antes de quedarte sin stock.',
    un:{FW:'Calzado',APP:'Ropa',EQ:'Equipo',LIC:'Licencias'}, gen:{MEN:'Hombre',WOMEN:'Mujer',KIDS:'Niños'} },
  en: { eyebrow:'Retail Tour — Monthly Report', periodLabel:(m,a)=>MESES.en[m-1]+' '+a, heroLabelAll:'Total sales for the period', heroLabelFiltered:'Sales for this selection',
    unitsLabel:'Units sold', inventoryLabel:'Units in inventory', wohLabel:'Weeks of inventory',
    storesLabel:'Stores', storesTitle:'Performance by store', storesNote:'tap one to filter everything else',
    storesNoteFiltered:'showing only this selection', backToAllStores:'View all stores', backToAllCats:'View all categories',
    unTitle:'Business unit', catTitle:'Category', genTitle:'Gender', catStatSales:'Sales', catStatGrowth:'vs last year',
    famTitle:'Leading families / silhouettes', famNote:'top 10 by sales, within the selection',
    famCol1:'Family / Silhouette', famColSold:'Units sold', famColInv:'Inventory', famColWoh:'WOH', famCol3:'Sales', famCol4:'% of selection', famEmpty:'No data for this combination.',
    clearAll:'Show all', footerLeft:'Prepared with Retail Tour', footerRight:(m,a)=>MESES.en[m-1]+' '+a+' data',
    vsPy:(m,a)=>'vs '+MESES.en[m-1]+' '+a, noPyData:'No prior-year data to compare',
    insightLabel:'Observation', noChange:'No Change',
    insightGeneralLabel:'Observation', insightStoresLabel:'Stores', insightCatLabel:'Categories', insightFamLabel:'Inventory', insightUnGenLabel:'BU & Gender',
    nounStore:'store', nounCat:'category', nounFam:'product',
    insightGeneralNeutral:'The account shows no notable risk signals this period.',
    insightUnGenNeutral:'Not enough business-unit or gender data in this selection.',
    insightGrowthSuffix:(g)=>' It changed '+g+' vs last year.',
    insightUnGenSelected:(name,sharePct,woh,growthSuffix)=>name+' accounts for '+sharePct+'% of the selected sales, with '+woh+' weeks of inventory.'+growthSuffix,
    insightUnTop:(name,sharePct,woh,growthSuffix)=>name+' is your strongest business unit this period, with '+sharePct+'% of sales and '+woh+' weeks of inventory.'+growthSuffix,
    insightStoresNeutral:'Inventory coverage across stores looks balanced, with no notable risk signals.',
    insightCatNeutral:'Inventory coverage across categories looks balanced, with no notable risk signals.',
    insightFamNeutral:'Inventory coverage across the leading families looks healthy, with no notable stockout or overstock signals.',
    insightRobustas:(label,noun,sharePct,woh)=>label+' is your strongest '+noun+' ('+sharePct+'% of sales), but it is already carrying '+woh+' weeks of inventory. Worth reviewing the mix there before restocking further.',
    insightDesabastecidas:(label,noun,sharePct,woh)=>label+' is your strongest '+noun+' ('+sharePct+'% of sales), but its inventory only covers about '+woh+' weeks. There may be sales left on the table here due to low stock.',
    insightEstrellas:(label,noun,woh)=>label+' is your top '+noun+' this month, but its inventory already dropped to '+woh+' weeks. Worth securing restock so as not to lose that momentum.',
    insightAceleradas:(label,woh)=>label+' is among your best sellers and its inventory already dropped to just '+woh+' weeks. Given the growth pace, it is worth getting ahead of a potential stockout.',
    un:{FW:'Footwear',APP:'Apparel',EQ:'Equipment',LIC:'Licensed'}, gen:{MEN:'Men',WOMEN:'Women',KIDS:'Kids'} }
};
function t(k){ const v=I18N[LANG][k]; return typeof v==='function'?v(arguments[1],arguments[2],arguments[3],arguments[4]):v; }
function fmtMoney(v){ return '$'+Math.round(v).toLocaleString(LANG==='es'?'es-US':'en-US'); }
function fmtMoneyShort(v){ if(v===null||v===undefined) return '—'; var abs=Math.abs(v); var sign=v<0?'-':''; if(abs>=1000000) return sign+'$'+(abs/1000000).toFixed(abs%1000000===0?0:1)+'M'; if(abs>=1000) return sign+'$'+Math.round(abs/1000)+'K'; return sign+'$'+Math.round(abs); }
function fmtUnits(v){ return Math.round(v).toLocaleString(LANG==='es'?'es-US':'en-US'); }
function fmtPct(v){ return (v*100).toFixed(1)+'%'; }
function fmtGrowth(v){ if(v===null||v===undefined) return '—'; var pct=(v*100).toFixed(0); return (v>=0?'+':'')+pct+'%'; }
function gClass(v){ if(v===null||v===undefined) return ''; return v>=0?'stat-pos':'stat-neg'; }
function computeWoh(e,u){ return u ? (e/u)*4.33 : null; }
function fmtUnitDiff(cur,py){ if(cur===null||cur===undefined||py===null||py===undefined) return null; var diff=Math.round(cur)-Math.round(py); if(diff===0) return t('noChange'); return (diff>0?'+':'')+fmtUnits(diff); }
function fmtPtsDiff(cur,py){ if(cur===null||cur===undefined||py===null||py===undefined) return null; var diff=cur-py; if(Math.abs(diff)<0.05) return t('noChange'); return (diff>0?'+':'')+diff.toFixed(1)+' pts'; }
function diffClass(cur,py){ if(cur===null||cur===undefined||py===null||py===undefined) return ''; var diff=cur-py; if(Math.abs(diff)<0.0001) return ''; return diff>0?'stat-pos':'stat-neg'; }
function fmtWoh(v){ return v===null ? '—' : v.toFixed(1); }
var HEALTHY_LOW=20, HEALTHY_HIGH=26;
function bestByScore(pool,scoreFn,minShare){
  var filtered=pool.filter(function(c){ return (!minShare||c.share>=minShare) && scoreFn(c)>0; });
  if(!filtered.length) return null;
  return filtered.reduce(function(a,b){ return scoreFn(a)>=scoreFn(b)?a:b; });
}
function sectionInsight(pool,noun,minShare,neutralKey){
  var clean=pool.filter(function(c){ return c.woh!==null && c.woh!==undefined && c.share>0; });
  if(!clean.length) return t(neutralKey);
  var over=bestByScore(clean,function(c){return c.share*(c.woh-HEALTHY_HIGH);},minShare);
  var over_s=over?over.share*(over.woh-HEALTHY_HIGH):0;
  var under=bestByScore(clean,function(c){return c.share*(HEALTHY_LOW-c.woh);},minShare);
  var under_s=under?under.share*(HEALTHY_LOW-under.woh):0;
  if(!over && !under) return t(neutralKey);
  if(under && under_s>=over_s) return t('insightDesabastecidas',under.label,noun,Math.round(under.share*100),under.woh.toFixed(1));
  return t('insightRobustas',over.label,noun,Math.round(over.share*100),over.woh.toFixed(1));
}
function titleCase(s){ if(!s) return s; var lower=String(s).toLowerCase(); var out=''; for(var i=0;i<lower.length;i++){ var prev = i===0 ? ' ' : lower.charAt(i-1); var isSep = (prev===' '||prev==='/'||prev==='#'); out += isSep ? lower.charAt(i).toUpperCase() : lower.charAt(i); } return out; }
function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }
function matchesFilters(row,f,exclude){ var dims=['s','un','cat','gen']; for(var i=0;i<dims.length;i++){ var k=dims[i]; if(k===exclude) continue; if(f[k] && row[k]!==f[k]) return false; } return true; }
function filterRows(exclude,source){ return (source||DATA.rows).filter(function(r){return matchesFilters(r,filters,exclude);}); }
function sumRows(rows){ return rows.reduce(function(a,r){a.v+=r.v;a.u+=r.u;a.e+=r.e;return a;},{v:0,u:0,e:0}); }
function groupBy(rows,keyName){ var map={}; rows.forEach(function(r){ var k=r[keyName]; if(!map[k]) map[k]={key:k,v:0,u:0,e:0}; map[k].v+=r.v;map[k].u+=r.u;map[k].e+=r.e; }); return Object.values(map); }
function anyFilterActive(){ return filters.s||filters.un||filters.cat||filters.gen; }
var $app=document.getElementById('app');

function render(){
  var fullyFiltered=filterRows(null);
  var totals=sumRows(fullyFiltered);
  var filtered=anyFilterActive();

  var pyRows=DATA.pyRows||[];
  var hasPy=pyRows.length>0;
  var pyTotals=sumRows(filterRows(null,pyRows));
  var growthValor=(hasPy&&pyTotals.v)?(totals.v-pyTotals.v)/Math.abs(pyTotals.v):null;
  var growthUnits=(hasPy&&pyTotals.u)?(totals.u-pyTotals.u)/Math.abs(pyTotals.u):null;
  var curWoh=computeWoh(totals.e,totals.u);
  var pyWoh=hasPy?computeWoh(pyTotals.e,pyTotals.u):null;

  var storeCandidates=groupBy(filterRows('s'),'s').sort(function(a,b){return b.v-a.v;});
  var storeTotal=storeCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var pyStoreMap={}; groupBy(filterRows('s',pyRows),'s').forEach(function(x){ pyStoreMap[x.key]=x; });
  var pyStoreCount=hasPy?Object.keys(pyStoreMap).length:null;
  var unCandidates=groupBy(filterRows('un'),'un').sort(function(a,b){return b.v-a.v;});
  var unTotal=unCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var pyUnMap={}; groupBy(filterRows('un',pyRows),'un').forEach(function(x){ pyUnMap[x.key]=x; });
  var catCandidatesAll=groupBy(filterRows('cat'),'cat').sort(function(a,b){return b.v-a.v;});
  var catTotal=catCandidatesAll.reduce(function(s,x){return s+x.v;},0)||1;
  var catCandidates=catCandidatesAll.slice(0,8);
  var pyCatMap={}; groupBy(filterRows('cat',pyRows),'cat').forEach(function(x){ pyCatMap[x.key]=x; });
  var genCandidates=groupBy(filterRows('gen'),'gen').sort(function(a,b){return b.v-a.v;});
  var genTotal=genCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var pyGenMap={}; groupBy(filterRows('gen',pyRows),'gen').forEach(function(x){ pyGenMap[x.key]=x; });
  var famList=groupBy(fullyFiltered,'fam').sort(function(a,b){return b.v-a.v;}).slice(0,10);
  var famTotal=totals.v||1;
  var maxStoreV=Math.max.apply(null,storeCandidates.map(function(s){return s.v;}).concat([1]));
  var storesPool=storeCandidates.map(function(s){ return { label:titleCase(s.key), share:s.v/storeTotal, woh:computeWoh(s.e,s.u) }; });
  var catPool=catCandidatesAll.map(function(x){ return { label:x.key, share:x.v/catTotal, woh:computeWoh(x.e,x.u) }; });
  var famPool=famList.map(function(f){ return { label:titleCase(f.key), share:f.v/famTotal, woh:computeWoh(f.e,f.u) }; });

  function chipLabel(dim,key){ if(dim==='un') return I18N[LANG].un[key]||key; if(dim==='gen') return I18N[LANG].gen[key]||key; if(dim==='s') return titleCase(key); return key; }

  // Comentario de la sección Unidad de Negocio / Género: si hay una UN o un
  // Género puntual seleccionado, habla de ese; si no hay ningún filtro
  // activo, habla de la unidad de negocio que más vendió.
  function unGenInsight(){
    function growthSuffix(cur,py){
      if(!hasPy || !py || !py.v) return '';
      var g=(cur.v-py.v)/Math.abs(py.v);
      return t('insightGrowthSuffix', fmtGrowth(g));
    }
    if(filters.un){
      var x=unCandidates.filter(function(c){return c.key===filters.un;})[0];
      if(!x) return t('insightUnGenNeutral');
      var share=x.v/unTotal;
      return t('insightUnGenSelected', (I18N[LANG].un[x.key]||x.key), Math.round(share*100), fmtWoh(computeWoh(x.e,x.u)), growthSuffix(x,pyUnMap[x.key]));
    }
    if(filters.gen){
      var gx=genCandidates.filter(function(c){return c.key===filters.gen;})[0];
      if(!gx) return t('insightUnGenNeutral');
      var shareG=gx.v/genTotal;
      return t('insightUnGenSelected', (I18N[LANG].gen[gx.key]||gx.key), Math.round(shareG*100), fmtWoh(computeWoh(gx.e,gx.u)), growthSuffix(gx,pyGenMap[gx.key]));
    }
    var top=unCandidates[0];
    if(!top) return t('insightUnGenNeutral');
    var shareTop=top.v/unTotal;
    return t('insightUnTop', (I18N[LANG].un[top.key]||top.key), Math.round(shareTop*100), fmtWoh(computeWoh(top.e,top.u)), growthSuffix(top,pyUnMap[top.key]));
  }

  var activeChips=[];
  if(filters.s) activeChips.push(['s',filters.s]);
  if(filters.un) activeChips.push(['un',filters.un]);
  if(filters.cat) activeChips.push(['cat',filters.cat]);
  if(filters.gen) activeChips.push(['gen',filters.gen]);

  var html = '';
  html += '<header><div class="brand">';
  html += '<span class="brand-eyebrow">'+t('eyebrow')+'</span>';
  html += '<span class="brand-name">'+titleCase(DATA.cliente)+'</span>';
  html += '<span class="brand-period">'+t('periodLabel',DATA.periodo.mes,DATA.periodo.anio)+'</span>';
  html += '</div><button class="lang-btn" id="langBtn">'+(LANG==='es'?'EN':'ES')+'</button></header>';

  html += '<div class="filter-bar '+(activeChips.length?'':'empty')+'">';
  html += '<span class="filter-bar-label">'+(LANG==='es'?'Filtrando por:':'Filtering by:')+'</span>';
  activeChips.forEach(function(c){ html += '<span class="filter-chip">'+chipLabel(c[0],c[1])+'<button data-clear="'+c[0]+'">✕</button></span>'; });
  html += '<button class="filter-clear-all" id="clearAllBtn">'+t('clearAll')+'</button></div>';

  html += '<div class="hero"><div class="hero-label">'+(filtered?t('heroLabelFiltered'):t('heroLabelAll'))+'</div>';
  html += '<div class="hero-number">'+fmtMoney(totals.v)+'</div>';
  if(hasPy){
    html += '<div class="hero-growth '+gClass(growthValor)+'">'+fmtGrowth(growthValor)+' '+t('vsPy',DATA.periodo.mes,DATA.periodo.anio-1)+'</div>';
  } else {
    html += '<div class="hero-growth hero-growth-empty">'+t('noPyData')+'</div>';
  }
  html += '<div class="hero-sub">';
  var invDiff=hasPy?fmtUnitDiff(totals.e,pyTotals.e):null;
  var wohDiff=hasPy?fmtPtsDiff(curWoh,pyWoh):null;
  // Cuando hay una sucursal puntual seleccionada, el conteo de "Sucursales"
  // debe reflejar eso (1), no el total de sucursales que aplican a los
  // demás filtros activos (que es lo que mide storeCandidates.length).
  var heroStoreCount = filters.s ? 1 : storeCandidates.length;
  var heroPyStoreCount = hasPy ? (filters.s ? (pyStoreMap[filters.s] ? 1 : 0) : pyStoreCount) : null;
  var storesDiff=hasPy?fmtUnitDiff(heroStoreCount,heroPyStoreCount):null;
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtUnits(totals.u)+'</div><div class="hero-stat-label">'+t('unitsLabel')+'</div>'+(hasPy?'<div class="hero-stat-growth '+gClass(growthUnits)+'">'+fmtGrowth(growthUnits)+'</div>':'')+'</div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtUnits(totals.e)+'</div><div class="hero-stat-label">'+t('inventoryLabel')+'</div>'+(invDiff?'<div class="hero-stat-growth '+diffClass(totals.e,pyTotals.e)+'">'+invDiff+'</div>':'')+'</div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtWoh(curWoh)+'</div><div class="hero-stat-label">'+t('wohLabel')+'</div>'+(wohDiff?'<div class="hero-stat-growth '+diffClass(curWoh,pyWoh)+'">'+wohDiff+'</div>':'')+'</div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+heroStoreCount+'</div><div class="hero-stat-label">'+t('storesLabel')+'</div>'+(storesDiff?'<div class="hero-stat-growth '+diffClass(heroStoreCount,heroPyStoreCount)+'">'+storesDiff+'</div>':'')+'</div>';
  html += '</div></div>';

  // Comentario general: describe cómo cerró la cuenta en cuanto a su
  // clasificación (venta/inventario) durante el mes, sin nombrar la
  // clasificación — solo el ícono. Va justo debajo de los primeros KPIs.
  var insightText = (DATA.insight && DATA.insight[LANG]) || t('insightGeneralNeutral');
  var insightIcon = (DATA.insight && DATA.insight.icon) || '📊';
  html += '<div class="insight-note"><div class="insight-note-label insight-note-icon">'+insightIcon+'</div><div class="insight-note-text">'+insightText+'</div></div>';

  html += '<section><div class="section-head"><span class="section-title">'+t('storesTitle')+'</span><span class="section-note">'+(filters.s?t('storesNoteFiltered'):t('storesNote'))+'</span></div>';
  html += '<div class="insight-note"><div class="insight-note-label">'+t('insightStoresLabel')+'</div><div class="insight-note-text">'+sectionInsight(storesPool,t('nounStore'),0.15,'insightStoresNeutral')+'</div></div>';
  html += '<div class="podium-list">';
  storeCandidates.forEach(function(s,i){
    var isActive=filters.s===s.key;
    if(filters.s && !isActive) return; // se eligió una sucursal: las demás no se muestran (antes solo se atenuaban)
    var share=s.v/storeTotal;
    var pyS=pyStoreMap[s.key], sGrowth=(hasPy&&pyS&&pyS.v)?(s.v-pyS.v)/Math.abs(pyS.v):null;
    html += '<button class="podium-row '+(isActive?'active':'')+'" data-dim="s" data-key="'+escapeAttr(s.key)+'">';
    html += '<span class="podium-rank">'+(i+1)+'</span>';
    html += '<div class="podium-main"><span class="podium-name">'+titleCase(s.key)+'</span>';
    html += '<div class="podium-track-row"><div class="podium-track"><div class="podium-fill" style="width:'+(s.v/maxStoreV*100).toFixed(0)+'%"></div></div><span class="podium-share-inline">'+Math.round(share*100)+'%</span></div></div>';
    html += '<div class="podium-woh"><div class="podium-woh-value">'+fmtWoh(computeWoh(s.e,s.u))+'</div><div class="podium-woh-label">WOH</div></div>';
    html += '<div class="podium-figures"><div class="podium-money">'+fmtMoneyShort(s.v)+'</div>'+(hasPy?'<div class="podium-growth '+gClass(sGrowth)+'">'+fmtGrowth(sGrowth)+'</div>':'')+'</div>';
    html += '</button>';
  });
  if(filters.s){
    html += '<button class="store-back-btn" id="storeBackBtn">↺ '+t('backToAllStores')+'</button>';
  }
  html += '</div></section>';

  html += '<section class="two-col"><div><div class="section-head"><span class="section-title">'+t('unTitle')+'</span></div><div class="bar-list">';
  unCandidates.forEach(function(x){
    var isActive=filters.un===x.key, isDim=filters.un&&!isActive, share=x.v/unTotal;
    html += '<button class="bar-row '+(isActive?'active':'')+' '+(isDim?'dim':'')+'" data-dim="un" data-key="'+escapeAttr(x.key)+'">';
    html += '<span class="bar-label">'+(I18N[LANG].un[x.key]||x.key)+'</span>';
    html += '<div class="bar-track"><div class="bar-fill gold" style="width:'+(share*100).toFixed(0)+'%"></div></div>';
    html += '<span class="bar-pct">'+fmtPct(share)+'</span></button>';
  });
  html += '</div></div><div><div class="section-head"><span class="section-title">'+t('genTitle')+'</span></div><div class="bar-list">';
  genCandidates.forEach(function(x){
    var isActive=filters.gen===x.key, isDim=filters.gen&&!isActive, share=x.v/genTotal;
    html += '<button class="bar-row '+(isActive?'active':'')+' '+(isDim?'dim':'')+'" data-dim="gen" data-key="'+escapeAttr(x.key)+'">';
    html += '<span class="bar-label">'+(I18N[LANG].gen[x.key]||x.key)+'</span>';
    html += '<div class="bar-track"><div class="bar-fill steel" style="width:'+(share*100).toFixed(0)+'%"></div></div>';
    html += '<span class="bar-pct">'+fmtPct(share)+'</span></button>';
  });
  html += '</div></div></section>';

  html += '<div class="insight-note"><div class="insight-note-label">'+t('insightUnGenLabel')+'</div><div class="insight-note-text">'+unGenInsight()+'</div></div>';

  html += '<section><div class="section-head"><span class="section-title">'+t('catTitle')+'</span><span class="section-note">'+(filters.cat?t('storesNoteFiltered'):'')+'</span></div>';
  html += '<div class="insight-note"><div class="insight-note-label">'+t('insightCatLabel')+'</div><div class="insight-note-text">'+sectionInsight(catPool,t('nounCat'),0.15,'insightCatNeutral')+'</div></div>';
  html += '<div class="cat-list">';
  catCandidates.forEach(function(x){
    var isActive=filters.cat===x.key;
    if(filters.cat && !isActive) return; // se eligió una categoría: las demás no se muestran (misma lógica que sucursales)
    var share=x.v/catTotal;
    var pyX=pyCatMap[x.key], catGrowth=(hasPy&&pyX&&pyX.v)?(x.v-pyX.v)/Math.abs(pyX.v):null;
    var catWoh=computeWoh(x.e,x.u);
    html += '<button class="cat-row '+(isActive?'active':'')+'" data-dim="cat" data-key="'+escapeAttr(x.key)+'">';
    html += '<div class="cat-row-top"><span class="cat-label">'+x.key+'</span><span class="cat-share">'+fmtPct(share)+'</span></div>';
    html += '<div class="bar-track"><div class="bar-fill gold" style="width:'+(share*100).toFixed(0)+'%"></div></div>';
    html += '<div class="cat-row-stats">';
    html += '<div class="cat-stat"><div class="cat-stat-value">'+fmtMoney(x.v)+'</div><div class="cat-stat-label">'+t('catStatSales')+'</div></div>';
    html += '<div class="cat-stat"><div class="cat-stat-value '+(hasPy?gClass(catGrowth):'')+'">'+(hasPy?fmtGrowth(catGrowth):'—')+'</div><div class="cat-stat-label">'+t('catStatGrowth')+'</div></div>';
    html += '<div class="cat-stat"><div class="cat-stat-value">'+fmtWoh(catWoh)+'</div><div class="cat-stat-label">WOH</div></div>';
    html += '</div></button>';
  });
  if(filters.cat){
    html += '<button class="store-back-btn" id="catBackBtn">↺ '+t('backToAllCats')+'</button>';
  }
  html += '</div></section>';

  html += '<section><div class="section-head"><span class="section-title">'+t('famTitle')+'</span><span class="section-note">'+t('famNote')+'</span></div>';
  html += '<div class="insight-note"><div class="insight-note-label">'+t('insightFamLabel')+'</div><div class="insight-note-text">'+sectionInsight(famPool,t('nounFam'),0,'insightFamNeutral')+'</div></div>';
  if(famList.length){
    html += '<div class="table-scroll"><table class="fam-table"><thead><tr><th>'+t('famCol1')+'</th><th class="num fam-col-pct">'+t('famCol4')+'</th><th class="num">'+t('famColSold')+'</th><th class="num">'+t('famCol3')+'</th><th class="num">'+t('famColInv')+'</th><th class="num">'+t('famColWoh')+'</th></tr></thead><tbody>';
    famList.forEach(function(f,i){
      var fWoh=computeWoh(f.e,f.u);
      var arrow = fWoh===null ? '' : (fWoh<20 ? '<span class="woh-arrow woh-down">▼</span>' : '<span class="woh-arrow woh-up">▲</span>');
      html += '<tr><td><span class="fam-rank">'+(i+1)+'</span>'+titleCase(f.key)+'</td><td class="num fam-col-pct">'+fmtPct(f.v/famTotal)+'</td><td class="num">'+fmtUnits(f.u)+'</td><td class="num">'+fmtMoney(f.v)+'</td><td class="num">'+fmtUnits(f.e)+'</td><td class="num">'+fmtWoh(fWoh)+' '+arrow+'</td></tr>';
    });
    html += '</tbody></table></div>';
  } else {
    html += '<div class="fam-empty">'+t('famEmpty')+'</div>';
  }
  html += '</section>';

  html += '<footer><span>'+t('footerLeft')+'</span><span>'+t('footerRight',DATA.periodo.mes,DATA.periodo.anio)+'</span></footer>';

  $app.innerHTML = html;

  document.getElementById('langBtn').addEventListener('click', function(){ LANG = LANG==='es'?'en':'es'; render(); });
  document.getElementById('clearAllBtn').addEventListener('click', function(){ filters={s:null,un:null,cat:null,gen:null}; render(); });
  document.querySelectorAll('[data-clear]').forEach(function(el){ el.addEventListener('click',function(e){ e.stopPropagation(); filters[el.getAttribute('data-clear')]=null; render(); }); });
  document.querySelectorAll('[data-dim]').forEach(function(el){ el.addEventListener('click',function(){ var dim=el.getAttribute('data-dim'), key=el.getAttribute('data-key'); filters[dim]=filters[dim]===key?null:key; render(); }); });
  var storeBackBtn=document.getElementById('storeBackBtn');
  if(storeBackBtn) storeBackBtn.addEventListener('click', function(){ filters.s=null; render(); });
  var catBackBtn=document.getElementById('catBackBtn');
  if(catBackBtn) catBackBtn.addEventListener('click', function(){ filters.cat=null; render(); });
}
render();
</script>
</body>
</html>`;
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
    const payloads = splitByCliente(parsed);

    // Aplicamos los cambios en memoria de una vez (la app se ve actualizada al instante)
    for (const payload of payloads) {
      mergeClientePeriodo(state.clientePeriodo, payload.cliente_periodo);
      mergeSucursalPeriodo(state.sucursalPeriodo, payload.sucursal_periodo);
      mergeNav(state.nav, payload.nav);
    }

    // Guardado en Firebase en paralelo, un documento chico por cliente
    let done = 0;
    statusEl.textContent = L('savingProgress', done, payloads.length);
    await Promise.all(payloads.map(payload =>
      saveClientUpload(payload).then(() => {
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
