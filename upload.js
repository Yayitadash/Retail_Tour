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
  const clientePeriodo = {};  // cliente -> {region,pais,hist:[{p,u,v,e}]}
  const sucursalTotales = {}; // cliente -> sucursal -> periodo -> {u,v,e}
  const sucursalUN = {};      // cliente -> sucursal -> periodo -> UN -> {u,v}
  const sucursalCAT = {};     // cliente -> sucursal -> periodo -> CAT -> {u,v}
  const sucursalFAM = {};     // cliente -> sucursal -> periodo -> familia -> {u,v,e}
  const unCat = {};   // c->s->p->UN->CAT->{u,v}
  const unGen = {};   // c->s->p->UN->GEN->{u,v}
  const unFam = {};   // c->s->p->UN->fam->{u,v,e}
  const catUn = {};   // c->s->p->CAT->UN->{u,v}
  const catGen = {};  // c->s->p->CAT->GEN->{u,v}
  const catFam = {};  // c->s->p->CAT->fam->{u,v,e}
  const periodosVistos = new Set();
  const navDelta = {};

  function bump(map, keys, unidades, valor, existencia) {
    let node = map;
    for (let i = 0; i < keys.length - 1; i++) {
      node[keys[i]] = node[keys[i]] || {};
      node = node[keys[i]];
    }
    const last = keys[keys.length - 1];
    node[last] = node[last] || { u: 0, v: 0, e: 0 };
    node[last].u += unidades; node[last].v += valor; node[last].e += existencia;
  }

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
    const fam_ = sucursalFAM[cliente][sucursal][periodo][familia] || { u: 0, v: 0, e: 0 };
    fam_.u += unidades; fam_.v += valor; fam_.e += existencia;
    sucursalFAM[cliente][sucursal][periodo][familia] = fam_;

    // Detalle cruzado (para botones interactivos UN / CAT)
    const gen = String(r[cols.gen] ?? '').trim();
    bump(unCat, [cliente, sucursal, periodo, un, cat], unidades, valor, 0);
    bump(unGen, [cliente, sucursal, periodo, un, gen], unidades, valor, 0);
    bump(unFam, [cliente, sucursal, periodo, un, familia], unidades, valor, existencia);
    bump(catUn, [cliente, sucursal, periodo, cat, un], unidades, valor, 0);
    bump(catGen, [cliente, sucursal, periodo, cat, gen], unidades, valor, 0);
    bump(catFam, [cliente, sucursal, periodo, cat, familia], unidades, valor, existencia);

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
          .map(([fam, v]) => ({ fam, u: v.u, v: Math.round(v.v * 100) / 100, e: Math.round((v.e || 0) * 100) / 100 }));

        // Detalle por UN: para cada UN presente, sus categorías/género/familias top
        const du = {};
        const ucNode = unCat[cliente]?.[sucursal]?.[periodo] || {};
        const ugNode = unGen[cliente]?.[sucursal]?.[periodo] || {};
        const ufNode = unFam[cliente]?.[sucursal]?.[periodo] || {};
        for (const un in unObj) {
          const catList = Object.entries(ucNode[un] || {})
            .sort((a, b) => b[1].u - a[1].u).slice(0, 4)
            .map(([cat, v]) => ({ cat, u: v.u, v: Math.round(v.v * 100) / 100 }));
          const genObj = {};
          for (const [gen, v] of Object.entries(ugNode[un] || {})) genObj[gen] = { u: v.u, v: Math.round(v.v * 100) / 100 };
          const famList = Object.entries(ufNode[un] || {})
            .sort((a, b) => b[1].u - a[1].u).slice(0, 3)
            .map(([fam, v]) => ({ fam, u: v.u, v: Math.round(v.v * 100) / 100, e: Math.round((v.e || 0) * 100) / 100 }));
          du[un] = { cat: catList, gen: genObj, fam: famList };
        }

        // Detalle por CAT: solo para las top-3 categorías mostradas
        const dc = {};
        const cuNode = catUn[cliente]?.[sucursal]?.[periodo] || {};
        const cgNode = catGen[cliente]?.[sucursal]?.[periodo] || {};
        const cfNode = catFam[cliente]?.[sucursal]?.[periodo] || {};
        for (const { cat } of catTop) {
          const unList = Object.entries(cuNode[cat] || {})
            .sort((a, b) => b[1].u - a[1].u)
            .map(([un, v]) => ({ un, u: v.u, v: Math.round(v.v * 100) / 100 }));
          const genObj = {};
          for (const [gen, v] of Object.entries(cgNode[cat] || {})) genObj[gen] = { u: v.u, v: Math.round(v.v * 100) / 100 };
          const famList = Object.entries(cfNode[cat] || {})
            .sort((a, b) => b[1].u - a[1].u).slice(0, 3)
            .map(([fam, v]) => ({ fam, u: v.u, v: Math.round(v.v * 100) / 100, e: Math.round((v.e || 0) * 100) / 100 }));
          dc[cat] = { un: unList, gen: genObj, fam: famList };
        }

        sucursalPeriodoOut[cliente][sucursal].push({
          p, u: tot.u, v: Math.round(tot.v * 100) / 100, e: Math.round(tot.e * 100) / 100,
          un: unObj, cat: catTop, fam: famTop, du, dc
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

