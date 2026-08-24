// ============================================================
// RETAIL TOUR — Procesamiento de carga mensual
// Toma el Excel/CSV que sube la vendedora (mismo formato que la
// base original) y lo convierte en la misma estructura agregada
// que usa la app, lista para guardar en Firestore.
// ============================================================

const COLMAP = {
  mes: ['MES'], anio: ['AÑO', 'ANO', 'AÃ‘O'],
  region: ['REGION', 'REGIÓN'], pais: ['PAIS', 'PAÍS'],
  cuenta: ['CUENTA'], cliente: ['CLIENTE'],
  codsuc: ['COD SUC'], sucursal: ['SUCURSAL'],
  marca: ['MARCA'], cat: ['CAT'], gen: ['GEN'],
  familia: ['FAMILIA / SILUETA', 'FAMILIA/SILUETA'],
  unidades: ['UNID VENDIDAS'], valor: ['VALOR VENDIDO'],
  existencia: ['EXISTENCIA']
};

const findCol = (headers, candidates) => {
  for (const c of candidates) {
    const hit = headers.find(h => h.trim().toUpperCase() === c.toUpperCase());
    if (hit) return hit;
  }
  return null;
};

const CENTROAMERICA_PAISES = new Set(['COSTA RICA', 'EL SALVADOR', 'GUATEMALA', 'HONDURAS', 'PANAMA', 'ZONA LIBRE DE COLON']);
function remapRegion(pais, rawRegion) {
  if (rawRegion === 'CAC') return CENTROAMERICA_PAISES.has(pais) ? 'CEN' : 'CAR';
  return rawRegion;
}

// Algunas cuentas vienen mal etiquetadas de país en el sistema de origen
// (algunas de sus sucursales, en algunos meses). Se corrige aquí para que
// TODA carga futura por el botón ⇪ quede bien, no solo la que se procesó
// manualmente una vez.
const PAIS_OVERRIDE = {
  'CALZADO FINO': 'GUATEMALA'
};

async function parseUploadedFile(file) {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) throw new Error('El archivo no tiene filas.');

  const headers = Object.keys(rows[0]);
  const cols = {};
  for (const key in COLMAP) {
    cols[key] = findCol(headers, COLMAP[key]);
  }
  const missing = Object.entries(cols).filter(([k, v]) => !v).map(([k]) => k);
  if (missing.length) {
    throw new Error('Faltan columnas esperadas en el archivo: ' + missing.join(', '));
  }

  // Acumuladores
  const clientePeriodo = {};   // cliente -> {region,pais,hist:{periodo:{p,u,v,e}}}
  const sucursalTotales = {};  // cliente -> sucursal -> periodo -> {u,v,e}
  const cube = {};             // cliente -> sucursal -> periodo -> "UN|CAT|GEN|FAM" -> {u,v,e}
  const periodosVistos = new Set();
  const navDelta = {};

  for (const r of rows) {
    const mes = Number(r[cols.mes]);
    const anio = Number(r[cols.anio]);
    if (!mes || !anio) continue;
    const periodo = anio * 100 + mes;
    periodosVistos.add(periodo);

    const rawRegion = String(r[cols.region] ?? '').trim();
    const cliente = String(r[cols.cliente] ?? '').trim();
    const pais = PAIS_OVERRIDE[cliente] || String(r[cols.pais] ?? '').trim();
    const region = remapRegion(pais, rawRegion);
    const sucursal = String(r[cols.sucursal] ?? '').trim();
    const marca = r[cols.marca];
    const cat = String(r[cols.cat] ?? '').trim();
    const gen = String(r[cols.gen] ?? '').trim();
    const familia = String(r[cols.familia] ?? 'SIN SILUETA').trim();
    const unidades = Number(r[cols.unidades]) || 0;
    const valor = Number(r[cols.valor]) || 0;
    const existencia = Number(r[cols.existencia]) || 0;
    const un = unFromMarca(marca);

    if (!cliente || !sucursal) continue;

    // Cliente-periodo
    if (!clientePeriodo[cliente]) clientePeriodo[cliente] = { region, pais, hist: {} };
    if (!clientePeriodo[cliente].hist[periodo]) clientePeriodo[cliente].hist[periodo] = { p: periodo, u: 0, v: 0, e: 0 };
    clientePeriodo[cliente].hist[periodo].u += unidades;
    clientePeriodo[cliente].hist[periodo].v += valor;
    clientePeriodo[cliente].hist[periodo].e += existencia;

    // Sucursal totales
    sucursalTotales[cliente] = sucursalTotales[cliente] || {};
    sucursalTotales[cliente][sucursal] = sucursalTotales[cliente][sucursal] || {};
    const st = sucursalTotales[cliente][sucursal][periodo] || { u: 0, v: 0, e: 0 };
    st.u += unidades; st.v += valor; st.e += existencia;
    sucursalTotales[cliente][sucursal][periodo] = st;

    // Cubo: una fila por combinación exacta UN/CAT/GEN/FAMILIA, para poder
    // filtrar y combinar cualquier subconjunto de esas 3 dimensiones.
    cube[cliente] = cube[cliente] || {};
    cube[cliente][sucursal] = cube[cliente][sucursal] || {};
    cube[cliente][sucursal][periodo] = cube[cliente][sucursal][periodo] || {};
    const cubeKey = un + '|' + cat + '|' + gen + '|' + familia;
    const cn = cube[cliente][sucursal][periodo][cubeKey] || { un, cat, gen, familia, u: 0, v: 0, e: 0 };
    cn.u += unidades; cn.v += valor; cn.e += existencia;
    cube[cliente][sucursal][periodo][cubeKey] = cn;

    // Nav
    navDelta[region] = navDelta[region] || {};
    navDelta[region][pais] = navDelta[region][pais] || {};
    navDelta[region][pais][cliente] = navDelta[region][pais][cliente] || [];
    if (!navDelta[region][pais][cliente].includes(sucursal)) navDelta[region][pais][cliente].push(sucursal);
  }

  // Convertir cliente_periodo.hist de objeto a arreglo
  const clientePeriodoOut = {};
  for (const cliente in clientePeriodo) {
    clientePeriodoOut[cliente] = {
      region: clientePeriodo[cliente].region,
      pais: clientePeriodo[cliente].pais,
      hist: Object.values(clientePeriodo[cliente].hist)
    };
  }

  // Construir sucursal_periodo final: por cliente/sucursal, {periods, cube}
  const sucursalPeriodoOut = {};
  for (const cliente in sucursalTotales) {
    sucursalPeriodoOut[cliente] = {};
    for (const sucursal in sucursalTotales[cliente]) {
      const periodsArr = [];
      const cubeOut = {};
      for (const periodo of Object.keys(sucursalTotales[cliente][sucursal])) {
        const p = Number(periodo);
        const tot = sucursalTotales[cliente][sucursal][periodo];
        periodsArr.push({ p, u: tot.u, v: Math.round(tot.v * 100) / 100, e: Math.round(tot.e * 100) / 100 });

        const cubeNode = cube[cliente]?.[sucursal]?.[periodo] || {};
        cubeOut[periodo] = Object.values(cubeNode)
          .filter(row => row.u !== 0 || row.e !== 0)
          .map(row => ({
            un: row.un, cat: row.cat, gen: row.gen, fam: row.familia,
            u: row.u, v: Math.round(row.v * 100) / 100, e: Math.round(row.e * 100) / 100
          }));
      }
      sucursalPeriodoOut[cliente][sucursal] = { periods: periodsArr, cube: cubeOut };
    }
  }

  return {
    periodos: Array.from(periodosVistos).sort((a, b) => a - b),
    cliente_periodo: clientePeriodoOut,
    sucursal_periodo: sucursalPeriodoOut,
    nav: navDelta
  };
}

/**
 * Reparte lo que se subió en un payload independiente POR CADA CLIENTE
 * (con todos los meses que traiga ese cliente en el archivo, no solo uno).
 * Así cada documento de Firestore es chiquito y se puede cargar de a un
 * cliente a la vez, en vez de traer todos los meses de todas las cuentas
 * de golpe cada vez que alguien abre la app.
 */
function splitByCliente(parsed) {
  const payloads = [];
  for (const cliente in parsed.sucursal_periodo) {
    const sucursal_periodo = { [cliente]: parsed.sucursal_periodo[cliente] };

    const cliente_periodo = {};
    if (parsed.cliente_periodo[cliente]) cliente_periodo[cliente] = parsed.cliente_periodo[cliente];

    const nav = {};
    for (const region in parsed.nav) {
      for (const pais in parsed.nav[region]) {
        if (parsed.nav[region][pais][cliente]) {
          nav[region] = nav[region] || {};
          nav[region][pais] = nav[region][pais] || {};
          nav[region][pais][cliente] = parsed.nav[region][pais][cliente];
        }
      }
    }

    payloads.push({ cliente, cliente_periodo, sucursal_periodo, nav });
  }
  return payloads;
}
