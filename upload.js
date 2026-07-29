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

function findCol(headers, candidates) {
  for (const c of candidates) {
    const hit = headers.find(h => h.trim().toUpperCase() === c.toUpperCase());
    if (hit) return hit;
  }
  return null;
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
  const clientePeriodo = {};  // cliente -> {region,pais,hist:[{p,u,v,e}]}
  const sucursalTotales = {}; // cliente -> sucursal -> periodo -> {u,v,e}
  const sucursalUN = {};      // cliente -> sucursal -> periodo -> UN -> {u,v}
  const sucursalCAT = {};     // cliente -> sucursal -> periodo -> CAT -> {u,v}
  const sucursalFAM = {};     // cliente -> sucursal -> periodo -> familia -> {u,v}
  const periodosVistos = new Set();
  const navDelta = {};

  for (const r of rows) {
    const mes = Number(r[cols.mes]);
    const anio = Number(r[cols.anio]);
    if (!mes || !anio) continue;
    const periodo = anio * 100 + mes;
    periodosVistos.add(periodo);

    const region = String(r[cols.region] ?? '').trim();
    const pais = String(r[cols.pais] ?? '').trim();
    const cliente = String(r[cols.cliente] ?? '').trim();
    const sucursal = String(r[cols.sucursal] ?? '').trim();
    const marca = r[cols.marca];
    const cat = String(r[cols.cat] ?? '').trim();
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

    // UN
    sucursalUN[cliente] = sucursalUN[cliente] || {};
    sucursalUN[cliente][sucursal] = sucursalUN[cliente][sucursal] || {};
    sucursalUN[cliente][sucursal][periodo] = sucursalUN[cliente][sucursal][periodo] || {};
    const un_ = sucursalUN[cliente][sucursal][periodo][un] || { u: 0, v: 0 };
    un_.u += unidades; un_.v += valor;
    sucursalUN[cliente][sucursal][periodo][un] = un_;

    // CAT
    sucursalCAT[cliente] = sucursalCAT[cliente] || {};
    sucursalCAT[cliente][sucursal] = sucursalCAT[cliente][sucursal] || {};
    sucursalCAT[cliente][sucursal][periodo] = sucursalCAT[cliente][sucursal][periodo] || {};
    const cat_ = sucursalCAT[cliente][sucursal][periodo][cat] || { u: 0, v: 0 };
    cat_.u += unidades; cat_.v += valor;
    sucursalCAT[cliente][sucursal][periodo][cat] = cat_;

    // Familia
    sucursalFAM[cliente] = sucursalFAM[cliente] || {};
    sucursalFAM[cliente][sucursal] = sucursalFAM[cliente][sucursal] || {};
    sucursalFAM[cliente][sucursal][periodo] = sucursalFAM[cliente][sucursal][periodo] || {};
    const fam_ = sucursalFAM[cliente][sucursal][periodo][familia] || { u: 0, v: 0 };
    fam_.u += unidades; fam_.v += valor;
    sucursalFAM[cliente][sucursal][periodo][familia] = fam_;

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

  // Construir sucursal_periodo final: por cliente/sucursal, lista de periodos con un/cat top3/fam top3
  const sucursalPeriodoOut = {};
  for (const cliente in sucursalTotales) {
    sucursalPeriodoOut[cliente] = {};
    for (const sucursal in sucursalTotales[cliente]) {
      sucursalPeriodoOut[cliente][sucursal] = [];
      for (const periodo of Object.keys(sucursalTotales[cliente][sucursal])) {
        const p = Number(periodo);
        const tot = sucursalTotales[cliente][sucursal][periodo];
        const unObj = sucursalUN[cliente]?.[sucursal]?.[periodo] || {};
        const catObj = sucursalCAT[cliente]?.[sucursal]?.[periodo] || {};
        const famObj = sucursalFAM[cliente]?.[sucursal]?.[periodo] || {};

        const catTop = Object.entries(catObj)
          .sort((a, b) => b[1].u - a[1].u).slice(0, 3)
          .map(([cat, v]) => ({ cat, u: v.u, v: Math.round(v.v * 100) / 100 }));
        const famTop = Object.entries(famObj)
          .sort((a, b) => b[1].u - a[1].u).slice(0, 3)
          .map(([fam, v]) => ({ fam, u: v.u, v: Math.round(v.v * 100) / 100 }));

        sucursalPeriodoOut[cliente][sucursal].push({
          p, u: tot.u, v: Math.round(tot.v * 100) / 100, e: Math.round(tot.e * 100) / 100,
          un: unObj, cat: catTop, fam: famTop
        });
      }
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
        const rows = parsed.sucursal_periodo[cliente][sucursal].filter(r => r.p === periodo);
        if (rows.length) {
          sucursal_periodo[cliente] = sucursal_periodo[cliente] || {};
          sucursal_periodo[cliente][sucursal] = rows;
        }
      }
    }
    payloads.push({ periodo, cliente_periodo, sucursal_periodo, nav: parsed.nav });
  }
  return payloads;
}

