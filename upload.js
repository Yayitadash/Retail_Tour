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
    const pais = String(r[cols.pais] ?? '').trim();
    const region = remapRegion(pais, rawRegion);
    const cliente = String(r[cols.cliente] ?? '').trim();
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
 * Un archivo subido puede traer más de un mes. Firestore guarda un
 * documento por periodo, así que partimos el resultado de parseUploadedFile
 * en un payload independiente por cada periodo detectado.
 */
function splitByPeriodo(parsed) {
  const payloads = [];
  const MAX_CHUNK_BYTES = 700 * 1024; // margen cómodo bajo el límite de 1MB de Firestore

  for (const periodo of parsed.periodos) {
    const cliente_periodo = {};
    for (const cliente in parsed.cliente_periodo) {
      const rows = parsed.cliente_periodo[cliente].hist.filter(r => r.p === periodo);
      if (rows.length) {
        cliente_periodo[cliente] = {
          region: parsed.cliente_periodo[cliente].region,
          pais: parsed.cliente_periodo[cliente].pais,
          hist: rows
        };
      }
    }
    const sucursal_periodo = {};
    for (const cliente in parsed.sucursal_periodo) {
      for (const sucursal in parsed.sucursal_periodo[cliente]) {
        const store = parsed.sucursal_periodo[cliente][sucursal];
        const periods = store.periods.filter(r => r.p === periodo);
        if (!periods.length) continue;
        const cube = {};
        if (store.cube[periodo]) cube[periodo] = store.cube[periodo];
        sucursal_periodo[cliente] = sucursal_periodo[cliente] || {};
        sucursal_periodo[cliente][sucursal] = { periods, cube };
      }
    }

    // Un mes completo (todas las cuentas) puede pasar el límite de 1MB por
    // documento de Firestore, así que se reparte en varios "chunks" por
    // cliente. cliente_periodo y nav son chiquitos, van completos en cada uno.
    const clientesDelMes = Object.keys(sucursal_periodo);
    let chunkIdx = 0;
    let current = {};
    let currentBytes = 0;
    const flush = () => {
      if (Object.keys(current).length) {
        payloads.push({ periodo, chunk: chunkIdx++, cliente_periodo, sucursal_periodo: current, nav: parsed.nav });
        current = {};
        currentBytes = 0;
      }
    };
    for (const cliente of clientesDelMes) {
      const clienteBytes = JSON.stringify(sucursal_periodo[cliente]).length;
      if (currentBytes + clienteBytes > MAX_CHUNK_BYTES && Object.keys(current).length) flush();
      current[cliente] = sucursal_periodo[cliente];
      currentBytes += clienteBytes;
    }
    flush();
    if (!clientesDelMes.length) {
      // mes sin sucursales (raro, pero por si acaso no perder cliente_periodo/nav)
      payloads.push({ periodo, chunk: 0, cliente_periodo, sucursal_periodo: {}, nav: parsed.nav });
    }
  }
  return payloads;
}
