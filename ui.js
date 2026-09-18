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

  // Comentario/hallazgo automático (mismo motor que usa la app), generado en
  // ambos idiomas de una vez para que el reporte descargado pueda cambiar de
  // idioma sin depender de la app. Sin ninguna referencia a "Yaya": este
  // documento puede terminar en manos del cliente, así que el texto va en
  // tono de análisis neutral, no de asistente.
  const cd = state.clientePeriodo[cliente];
  const metrics = cd ? computeMetricsForPeriod(cd.hist, periodo) : null;
  const clasif = metrics ? metrics.clasif : null;
  const savedLang = state.lang;
  let insightEs = null, insightEn = null;
  if (clasif) {
    state.lang = 'es'; insightEs = findAccountInsight(cliente, periodo, clasif);
    state.lang = 'en'; insightEn = findAccountInsight(cliente, periodo, clasif);
  }
  state.lang = savedLang;

  const html = buildAccountReportHTML(cliente, mes, anio, rows, pyRows, { es: insightEs, en: insightEn });
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeCliente = titleCase(cliente).replace(/[^a-zA-Z0-9]+/g, '_');
  a.href = url;
  a.download = `${safeCliente}_${periodoLabelI18n(periodo, 'es').replace(/\s+/g, '')}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


function buildAccountReportHTML(cliente, mes, anio, rows, pyRows, insight) {
  const dataJson = JSON.stringify({ cliente, periodo: { mes, anio }, rows, pyRows: pyRows || [], insight: insight || { es: null, en: null } });
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titleCase(cliente)} — Retail Tour</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500&display=swap" rel="stylesheet">
<style>
  :root{
    --paper:#F6F3EC; --paper-card:#FFFFFF; --ink:#17202A; --text:#2A322D; --text-soft:#6B6459;
    --line:#E4DFD3; --gold:#C89B3C; --gold-soft:#EDE0C2; --steel:#3A5A78; --red:#B4432F; --green:#3E7A4F;
    --radius:14px; --font-display:'Anton',sans-serif; --font-body:'Inter',sans-serif; --font-mono:'IBM Plex Mono',monospace;
  }
  *{box-sizing:border-box;}
  body{margin:0; background:var(--paper); color:var(--text); font-family:var(--font-body); line-height:1.5; -webkit-font-smoothing:antialiased;}
  .wrap{max-width:880px; margin:0 auto; padding:0 20px 80px;}
  header{display:flex; justify-content:space-between; align-items:flex-start; padding:32px 0 24px; border-bottom:2px solid var(--ink); gap:16px; flex-wrap:wrap;}
  .brand{display:flex; flex-direction:column; gap:2px;}
  .brand-eyebrow{font-family:var(--font-mono); font-size:11px; letter-spacing:0.06em; color:var(--gold); text-transform:uppercase;}
  .brand-name{font-family:var(--font-display); font-weight:400; font-size:34px; color:var(--ink); line-height:0.95; text-transform:uppercase; letter-spacing:-0.01em;}
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
  .hero-label{font-size:13px; color:var(--text-soft); margin-bottom:6px;}
  .hero-number{font-family:var(--font-display); font-weight:400; font-size:clamp(40px,8vw,68px); color:var(--ink); line-height:1;}
  .hero-growth{font-family:var(--font-mono); font-weight:600; font-size:14px; margin-top:8px;}
  .hero-growth-empty{font-family:var(--font-body); font-weight:400; font-size:12.5px; color:var(--text-soft); font-style:italic;}
  .hero-sub{display:flex; justify-content:center; gap:28px; margin-top:18px; flex-wrap:wrap;}
  .hero-stat{text-align:center;}
  .hero-stat-value{font-family:var(--font-mono); font-weight:500; font-size:20px; color:var(--ink);}
  .hero-stat-label{font-size:11.5px; color:var(--text-soft); margin-top:2px;}
  .hero-stat-growth{font-family:var(--font-mono); font-weight:600; font-size:11.5px; margin-top:3px;}
  .podium-growth{font-family:var(--font-mono); font-weight:600; font-size:11px; margin-top:2px;}
  .stat-pos{color:var(--green);}
  .stat-neg{color:var(--red);}
  .insight-note{background:var(--paper-card); border:1.5px solid var(--gold-soft); border-left:4px solid var(--gold); border-radius:var(--radius); padding:14px 18px; margin:24px 0 0;}
  .insight-note-label{font-family:var(--font-mono); font-size:10.5px; letter-spacing:0.06em; text-transform:uppercase; color:var(--gold); margin-bottom:5px;}
  .insight-note-text{font-size:13.5px; line-height:1.5; color:var(--text);}
  section{margin-top:48px;}
  .section-head{display:flex; align-items:baseline; justify-content:space-between; margin-bottom:16px; gap:12px;}
  .section-title{font-family:var(--font-display); font-weight:400; font-size:22px; color:var(--ink); text-transform:uppercase; letter-spacing:-0.005em;}
  .section-note{font-size:12px; color:var(--text-soft);}
  .podium-list{display:flex; flex-direction:column; gap:9px;}
  .podium-row{display:grid; grid-template-columns:26px 1fr 44px auto; align-items:center; gap:12px; background:var(--paper-card); border:1.5px solid var(--line); border-radius:var(--radius); padding:12px 16px; cursor:pointer; text-align:left; width:100%; font-family:inherit; color:inherit;}
  .podium-row:hover{border-color:var(--gold-soft);}
  .podium-row.active{border-color:var(--gold); background:color-mix(in srgb, var(--gold) 6%, white);}
  .podium-row.dim{opacity:0.4;}
  .store-back-btn{display:flex; align-items:center; justify-content:center; gap:6px; background:none; border:1.5px dashed var(--line); border-radius:var(--radius); padding:11px 16px; font-family:var(--font-mono); font-size:12.5px; color:var(--text-soft); cursor:pointer; width:100%;}
  .store-back-btn:hover{border-color:var(--gold); color:var(--ink);}
  .podium-rank{font-family:var(--font-display); font-weight:400; font-size:18px; color:var(--gold); text-align:center;}
  .podium-main{display:flex; flex-direction:column; gap:5px; min-width:0;}
  .podium-name{font-weight:600; font-size:14px; color:var(--ink);}
  .podium-track{background:var(--paper); border-radius:6px; height:7px; overflow:hidden;}
  .podium-fill{background:var(--gold); height:100%; border-radius:6px;}
  .podium-woh{text-align:center; white-space:nowrap;}
  .podium-woh-value{font-family:var(--font-mono); font-weight:600; font-size:14px; color:var(--steel);}
  .podium-woh-label{font-family:var(--font-mono); font-size:8.5px; color:var(--text-soft); letter-spacing:0.04em;}
  .podium-figures{text-align:right; white-space:nowrap;}
  .podium-share{font-family:var(--font-mono); font-weight:600; font-size:16px; color:var(--ink);}
  .podium-money{font-size:11px; color:var(--text-soft); margin-top:2px;}
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
  es: { eyebrow:'Retail Tour — Reporte de cuenta', periodLabel:(m,a)=>MESES.es[m-1]+' '+a, heroLabelAll:'Venta total del periodo', heroLabelFiltered:'Venta de la selección',
    unitsLabel:'Unidades vendidas', inventoryLabel:'Unidades en inventario', wohLabel:'Semanas de inventario',
    storesLabel:'Sucursales', storesTitle:'Desempeño por sucursal', storesNote:'toca una para filtrar todo lo demás',
    storesNoteFiltered:'mostrando solo esta sucursal', backToAllStores:'Ver todas las sucursales',
    unTitle:'Unidad de negocio', catTitle:'Categoría', genTitle:'Género', catStatSales:'Venta', catStatGrowth:'vs año anterior',
    famTitle:'Familias / siluetas líderes', famNote:'top 10 por venta, dentro de la selección',
    famCol1:'Familia / Silueta', famColSold:'Unid. vendidas', famColInv:'Inventario', famColWoh:'WOH', famCol3:'Venta', famCol4:'% de la selección', famEmpty:'No hay datos para esta combinación.',
    clearAll:'Ver todo', footerLeft:'Preparado con Retail Tour', footerRight:(m,a)=>'Datos de '+MESES.es[m-1].toLowerCase()+' '+a,
    vsPy:(m,a)=>'vs '+MESES.es[m-1]+' '+a, noPyData:'Sin datos del año anterior para comparar',
    insightLabel:'Observación',
    un:{FW:'Calzado',APP:'Ropa',EQ:'Equipo',LIC:'Licencias'}, gen:{MEN:'Hombre',WOMEN:'Mujer',KIDS:'Niños'} },
  en: { eyebrow:'Retail Tour — Account report', periodLabel:(m,a)=>MESES.en[m-1]+' '+a, heroLabelAll:'Total sales for the period', heroLabelFiltered:'Sales for this selection',
    unitsLabel:'Units sold', inventoryLabel:'Units in inventory', wohLabel:'Weeks of inventory',
    storesLabel:'Stores', storesTitle:'Performance by store', storesNote:'tap one to filter everything else',
    storesNoteFiltered:'showing only this store', backToAllStores:'View all stores',
    unTitle:'Business unit', catTitle:'Category', genTitle:'Gender', catStatSales:'Sales', catStatGrowth:'vs last year',
    famTitle:'Leading families / silhouettes', famNote:'top 10 by sales, within the selection',
    famCol1:'Family / Silhouette', famColSold:'Units sold', famColInv:'Inventory', famColWoh:'WOH', famCol3:'Sales', famCol4:'% of selection', famEmpty:'No data for this combination.',
    clearAll:'Show all', footerLeft:'Prepared with Retail Tour', footerRight:(m,a)=>MESES.en[m-1]+' '+a+' data',
    vsPy:(m,a)=>'vs '+MESES.en[m-1]+' '+a, noPyData:'No prior-year data to compare',
    insightLabel:'Observation',
    un:{FW:'Footwear',APP:'Apparel',EQ:'Equipment',LIC:'Licensed'}, gen:{MEN:'Men',WOMEN:'Women',KIDS:'Kids'} }
};
function t(k){ const v=I18N[LANG][k]; return typeof v==='function'?v(arguments[1],arguments[2]):v; }
function fmtMoney(v){ return '$'+Math.round(v).toLocaleString(LANG==='es'?'es-US':'en-US'); }
function fmtUnits(v){ return Math.round(v).toLocaleString(LANG==='es'?'es-US':'en-US'); }
function fmtPct(v){ return (v*100).toFixed(1)+'%'; }
function fmtGrowth(v){ if(v===null||v===undefined) return '—'; var pct=(v*100).toFixed(0); return (v>=0?'+':'')+pct+'%'; }
function gClass(v){ if(v===null||v===undefined) return ''; return v>=0?'stat-pos':'stat-neg'; }
function computeWoh(e,u){ return u ? (e/u)*4.33 : null; }
function fmtWoh(v){ return v===null ? '—' : v.toFixed(1); }
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

  var storeCandidates=groupBy(filterRows('s'),'s').sort(function(a,b){return b.v-a.v;});
  var storeTotal=storeCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var pyStoreMap={}; groupBy(filterRows('s',pyRows),'s').forEach(function(x){ pyStoreMap[x.key]=x; });
  var unCandidates=groupBy(filterRows('un'),'un').sort(function(a,b){return b.v-a.v;});
  var unTotal=unCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var catCandidatesAll=groupBy(filterRows('cat'),'cat').sort(function(a,b){return b.v-a.v;});
  var catTotal=catCandidatesAll.reduce(function(s,x){return s+x.v;},0)||1;
  var catCandidates=catCandidatesAll.slice(0,8);
  var pyCatMap={}; groupBy(filterRows('cat',pyRows),'cat').forEach(function(x){ pyCatMap[x.key]=x; });
  var genCandidates=groupBy(filterRows('gen'),'gen').sort(function(a,b){return b.v-a.v;});
  var genTotal=genCandidates.reduce(function(s,x){return s+x.v;},0)||1;
  var famList=groupBy(fullyFiltered,'fam').sort(function(a,b){return b.v-a.v;}).slice(0,10);
  var famTotal=totals.v||1;
  var maxStoreV=Math.max.apply(null,storeCandidates.map(function(s){return s.v;}).concat([1]));

  function chipLabel(dim,key){ if(dim==='un') return I18N[LANG].un[key]||key; if(dim==='gen') return I18N[LANG].gen[key]||key; if(dim==='s') return titleCase(key); return key; }
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

  var insightText = DATA.insight && DATA.insight[LANG];
  if(insightText){
    html += '<div class="insight-note"><div class="insight-note-label">'+t('insightLabel')+'</div><div class="insight-note-text">'+insightText+'</div></div>';
  }

  html += '<div class="hero"><div class="hero-label">'+(filtered?t('heroLabelFiltered'):t('heroLabelAll'))+'</div>';
  html += '<div class="hero-number">'+fmtMoney(totals.v)+'</div>';
  if(hasPy){
    html += '<div class="hero-growth '+gClass(growthValor)+'">'+fmtGrowth(growthValor)+' '+t('vsPy',DATA.periodo.mes,DATA.periodo.anio-1)+'</div>';
  } else {
    html += '<div class="hero-growth hero-growth-empty">'+t('noPyData')+'</div>';
  }
  html += '<div class="hero-sub">';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtUnits(totals.u)+'</div><div class="hero-stat-label">'+t('unitsLabel')+'</div>'+(hasPy?'<div class="hero-stat-growth '+gClass(growthUnits)+'">'+fmtGrowth(growthUnits)+'</div>':'')+'</div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtUnits(totals.e)+'</div><div class="hero-stat-label">'+t('inventoryLabel')+'</div></div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+fmtWoh(computeWoh(totals.e,totals.u))+'</div><div class="hero-stat-label">'+t('wohLabel')+'</div></div>';
  html += '<div class="hero-stat"><div class="hero-stat-value">'+storeCandidates.length+'</div><div class="hero-stat-label">'+t('storesLabel')+'</div></div>';
  html += '</div></div>';

  html += '<section><div class="section-head"><span class="section-title">'+t('storesTitle')+'</span><span class="section-note">'+(filters.s?t('storesNoteFiltered'):t('storesNote'))+'</span></div><div class="podium-list">';
  storeCandidates.forEach(function(s,i){
    var isActive=filters.s===s.key;
    if(filters.s && !isActive) return; // se eligió una sucursal: las demás no se muestran (antes solo se atenuaban)
    var share=s.v/storeTotal;
    var pyS=pyStoreMap[s.key], sGrowth=(hasPy&&pyS&&pyS.v)?(s.v-pyS.v)/Math.abs(pyS.v):null;
    html += '<button class="podium-row '+(isActive?'active':'')+'" data-dim="s" data-key="'+escapeAttr(s.key)+'">';
    html += '<span class="podium-rank">'+(i+1)+'</span>';
    html += '<div class="podium-main"><span class="podium-name">'+titleCase(s.key)+'</span>';
    html += '<div class="podium-track"><div class="podium-fill" style="width:'+(s.v/maxStoreV*100).toFixed(0)+'%"></div></div></div>';
    html += '<div class="podium-woh"><div class="podium-woh-value">'+fmtWoh(computeWoh(s.e,s.u))+'</div><div class="podium-woh-label">WOH</div></div>';
    html += '<div class="podium-figures"><div class="podium-share">'+fmtPct(share)+'</div><div class="podium-money">'+fmtMoney(s.v)+'</div>'+(hasPy?'<div class="podium-growth '+gClass(sGrowth)+'">'+fmtGrowth(sGrowth)+'</div>':'')+'</div>';
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

  html += '<section><div class="section-head"><span class="section-title">'+t('catTitle')+'</span></div><div class="cat-list">';
  catCandidates.forEach(function(x){
    var isActive=filters.cat===x.key, isDim=filters.cat&&!isActive, share=x.v/catTotal;
    var pyX=pyCatMap[x.key], catGrowth=(hasPy&&pyX&&pyX.v)?(x.v-pyX.v)/Math.abs(pyX.v):null;
    var catWoh=computeWoh(x.e,x.u);
    html += '<button class="cat-row '+(isActive?'active':'')+' '+(isDim?'dim':'')+'" data-dim="cat" data-key="'+escapeAttr(x.key)+'">';
    html += '<div class="cat-row-top"><span class="cat-label">'+x.key+'</span><span class="cat-share">'+fmtPct(share)+'</span></div>';
    html += '<div class="bar-track"><div class="bar-fill gold" style="width:'+(share*100).toFixed(0)+'%"></div></div>';
    html += '<div class="cat-row-stats">';
    html += '<div class="cat-stat"><div class="cat-stat-value">'+fmtMoney(x.v)+'</div><div class="cat-stat-label">'+t('catStatSales')+'</div></div>';
    html += '<div class="cat-stat"><div class="cat-stat-value '+(hasPy?gClass(catGrowth):'')+'">'+(hasPy?fmtGrowth(catGrowth):'—')+'</div><div class="cat-stat-label">'+t('catStatGrowth')+'</div></div>';
    html += '<div class="cat-stat"><div class="cat-stat-value">'+fmtWoh(catWoh)+'</div><div class="cat-stat-label">WOH</div></div>';
    html += '</div></button>';
  });
  html += '</div></section>';

  html += '<section><div class="section-head"><span class="section-title">'+t('famTitle')+'</span><span class="section-note">'+t('famNote')+'</span></div>';
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
