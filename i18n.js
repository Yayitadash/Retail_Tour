// ============================================================
// RETAIL TOUR — Español / Inglés
// ============================================================

const I18N = {
  es: {
    boot: 'Preparando el recorrido…',
    welcomeTitle: '¿Cómo te llamas?',
    welcomeSub: 'Yaya quiere saber con quién va a hacer el recorrido.',
    namePlaceholder: 'Tu nombre',
    chooseAvatar: 'Elige a Yaya',
    startTour: 'Empezar el tour',
    greeting: (name) => `Hola ${name}, Yaya está aquí para acompañarte en este tour.`,
    whereToday: '¿A qué región vas hoy?',
    stepStart: 'Selecciona para empezar el recorrido.',
    whichCountry: '¿Qué país?',
    whichAccount: '¿Qué cuenta vas a visitar?',
    countries: 'países',
    accounts: 'cuentas',
    whichStore: '¿A qué sucursal vamos?',
    update: 'Actualizar',
    noClassif: 'Sin clasificación este mes',
    noClassifSub: 'No hay suficiente venta o inventario registrado para clasificar la cuenta en este periodo.',
    firstMonthAs: (c) => `Primer mes clasificado como ${c}.`,
    streakMonths: (n, c) => `La cuenta acumula <strong>${n} meses consecutivos</strong> como ${c}.`,
    changedFrom: (n, c) => `Cambió este mes, tras <strong>${n} meses</strong> como ${c}.`,
    accountOverview: 'Cómo va la cuenta',
    storeOverview: 'Cómo va esta sucursal',
    growthUnits: 'Crecimiento unidades',
    growthValor: 'Crecimiento $',
    woh: 'Semanas de inventario',
    avgMonthly: (n) => `Venta prom. mensual (${n}m)`,
    whatSells: 'Qué vende esta sucursal',
    units: 'unid.',
    inInventory: 'en inventario',
    concentratedIn: 'El negocio está concentrado en',
    leadingFamilies: 'Familias/Siluetas líderes',
    monthWoh: 'WOH del mes',
    forConversation: 'Para la conversación con el cliente',
    noMovement: (p) => `Esta sucursal no tiene movimiento en ${p}.`,
    noMovementShort: 'sin venta',
    noData: 'No hay data para esta cuenta.',
    uploadTitle: 'Actualizar datos',
    uploadCopy: 'Sube el archivo del mes nuevo (mismo formato que la base original). Se procesa aquí mismo y queda disponible en todos tus dispositivos.',
    processing: 'Procesando archivo…',
    saving: (p) => `Guardando ${p}…`,
    done: (p) => `Listo. Se actualizó ${p}.`,
    unLabels: { FW: 'Calzado', APP: 'Ropa', EQ: 'Equipo', LIC: 'Licencias' },
    genLabels: { MEN: 'Hombre', WOMEN: 'Mujer', KIDS: 'Niños' },
    categoriesIn: 'Categorías',
    genderIn: 'Género',
    familiesIn: 'Familias/Siluetas',
    businessUnitsIn: 'Unidades de negocio',
    tapToExplore: 'Toca para ver el detalle',
    recoTemplates: {
      'Las Estrellas': 'La cuenta mantiene un ritmo sobresaliente. Buen momento para proponer ampliar el surtido en las familias de mejor rotación.',
      'Las Aceleradas': 'La demanda crece más rápido que el inventario disponible. Vale la pena revisar si el abastecimiento alcanza para sostenerla.',
      'Las Robustas': 'La cuenta crece con inventario amplio. Hay espacio para explorar categorías nuevas o menos trabajadas.',
      'Zona de Riesgo': 'El inventario es alto frente a la demanda actual. Conviene entender juntos qué está frenando la rotación.',
      'Desabastecidas': 'La demanda bajó y el inventario también está ajustado. Vale la pena revisar el surtido disponible en tienda.',
      'Riesgo Crítico': 'Inventario elevado y demanda a la baja. Es un buen momento para una conversación abierta sobre el plan de surtido.'
    },
    recoUn: (label) => `${label} lidera la venta de esta sucursal. Vale la pena preguntar cómo va la rotación en el resto de las unidades de negocio.`,
    recoCat: (cat) => `${cat} puede ser un buen punto de partida para la visita.`,
    recoLowWoh: (fam) => `${fam} tiene el inventario bajo frente a su venta — vale la pena revisar si conviene reabastecer.`,
    changeName: 'Cambiar nombre / ícono',
    greetingCardTitle: (name) => `Hola ${name} 👋`,
    greetingCardBody: 'Soy Yaya. Ya revisé la información de tus clientes para hoy. Vamos a preparar juntos cada visita.',
    continueBtn: 'Empezar',
    confirmRegion: (r) => `Perfecto, hoy estaremos en ${r}.`,
    confirmPais: (p) => `Iremos a ${p}.`,
    confirmCliente: (c) => `Visitaremos ${c}.`,
    askRegion: '¿Qué región visitaremos hoy?',
    askPais: '¿Qué país visitaremos?',
    askCliente: '¿Qué cliente visitaremos?',
    askSucursal: '¿A qué sucursal iremos ahora?',
    beforeStore: 'Antes de entrar a la tienda, te comparto un resumen rápido de la cuenta.',
    beforeIndicators: 'Esto es lo más importante que deberías saber antes de comenzar la visita.',
    closingTitle: 'Listo, ya estás preparad@ para esta visita.',
    closingBody: 'Cuando quieras, seguimos con la siguiente tienda.',
    anotherStore: 'Ver otra sucursal',
    trendPositive: (n) => `La cuenta mantiene una tendencia positiva durante los últimos ${n} meses.`,
    trendNegative: (n) => `La cuenta viene desacelerando durante los últimos ${n} meses.`,
    topDriver: (cat) => `${cat} continúa siendo el principal impulsor de esta sucursal.`
  },
  en: {
    boot: 'Getting the tour ready…',
    welcomeTitle: "What's your name?",
    welcomeSub: 'Yaya wants to know who she’s touring with today.',
    namePlaceholder: 'Your name',
    chooseAvatar: 'Choose Yaya',
    startTour: 'Start the tour',
    greeting: (name) => `Hi ${name}, Yaya is here with you for this tour.`,
    whereToday: 'Which region are you visiting today?',
    stepStart: 'Pick one to start the tour.',
    whichCountry: 'Which country?',
    whichAccount: 'Which account are you visiting?',
    countries: 'countries',
    accounts: 'accounts',
    whichStore: 'Which store are we going to?',
    update: 'Update',
    noClassif: 'Not classified this month',
    noClassifSub: 'There isn’t enough recorded sales or inventory to classify this account this period.',
    firstMonthAs: (c) => `First month classified as ${c}.`,
    streakMonths: (n, c) => `The account has been <strong>${n} straight months</strong> as ${c}.`,
    changedFrom: (n, c) => `Changed this month, after <strong>${n} months</strong> as ${c}.`,
    accountOverview: 'How the account is doing',
    storeOverview: 'How this store is doing',
    growthUnits: 'Unit growth',
    growthValor: '$ growth',
    woh: 'Weeks of inventory',
    avgMonthly: (n) => `Avg. monthly sales (${n}m)`,
    whatSells: 'What this store sells',
    units: 'units',
    inInventory: 'in stock',
    concentratedIn: 'The business is concentrated in',
    leadingFamilies: 'Leading families/silhouettes',
    monthWoh: 'This month\'s WOH',
    forConversation: 'For the conversation with the client',
    noMovement: (p) => `This store had no movement in ${p}.`,
    noMovementShort: 'no sales',
    noData: 'No data for this account.',
    uploadTitle: 'Update data',
    uploadCopy: 'Upload the new month\'s file (same format as the original base). It\'s processed right here and becomes available on all your devices.',
    processing: 'Processing file…',
    saving: (p) => `Saving ${p}…`,
    done: (p) => `Done. ${p} was updated.`,
    unLabels: { FW: 'Footwear', APP: 'Apparel', EQ: 'Equipment', LIC: 'Licensed' },
    genLabels: { MEN: 'Men', WOMEN: 'Women', KIDS: 'Kids' },
    categoriesIn: 'Categories',
    genderIn: 'Gender',
    familiesIn: 'Families/Silhouettes',
    businessUnitsIn: 'Business units',
    tapToExplore: 'Tap to see the detail',
    recoTemplates: {
      'Las Estrellas': 'The account is on an outstanding streak. Good time to suggest expanding the assortment in the best-rotating families.',
      'Las Aceleradas': 'Demand is growing faster than available inventory. Worth checking whether supply can keep up.',
      'Las Robustas': 'The account is growing with healthy inventory. There\'s room to explore new or under-worked categories.',
      'Zona de Riesgo': 'Inventory is high relative to current demand. Worth understanding together what\'s slowing rotation.',
      'Desabastecidas': 'Demand dropped and inventory is also tight. Worth reviewing what\'s actually available in store.',
      'Riesgo Crítico': 'High inventory and falling demand. A good moment for an open conversation about the assortment plan.'
    },
    recoUn: (label) => `${label} leads this store\'s sales. Worth asking how the rest of the business units are rotating.`,
    recoCat: (cat) => `${cat} could be a good opener for the visit.`,
    recoLowWoh: (fam) => `${fam} is low on inventory relative to its sales — worth checking if it needs restocking.`,
    changeName: 'Change name / icon',
    greetingCardTitle: (name) => `Hi ${name} 👋`,
    greetingCardBody: 'I\'m Yaya. I\'ve already gone through your accounts for today. Let\'s prep each visit together.',
    continueBtn: 'Start',
    confirmRegion: (r) => `Great, we\'re in ${r} today.`,
    confirmPais: (p) => `Heading to ${p}.`,
    confirmCliente: (c) => `We\'ll visit ${c}.`,
    askRegion: 'Which region are we visiting today?',
    askPais: 'Which country?',
    askCliente: 'Which account are we visiting?',
    askSucursal: 'Which store are we heading to now?',
    beforeStore: 'Before we go in, here\'s a quick rundown of the account.',
    beforeIndicators: 'Here\'s the most important thing to know before starting the visit.',
    closingTitle: 'You\'re ready for this visit.',
    closingBody: 'Whenever you\'re ready, let\'s move on to the next store.',
    anotherStore: 'See another store',
    trendPositive: (n) => `The account has kept a positive trend for the last ${n} months.`,
    trendNegative: (n) => `The account has been slowing down for the last ${n} months.`,
    topDriver: (cat) => `${cat} continues to be the main driver in this store.`
  }
};

function t(lang, key, ...args) {
  const dict = I18N[lang] || I18N.es;
  const val = dict[key];
  if (typeof val === 'function') return val(...args);
  return val;
}

const MESES = {
  es: ['', 'Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
  en: ['', 'January','February','March','April','May','June','July','August','September','October','November','December']
};

function periodoLabelI18n(p, lang) {
  const y = Math.floor(p / 100), m = p % 100;
  return `${MESES[lang][m]} ${y}`;
}

const CLASIF_LABELS_EN = {
  'Las Estrellas': 'The Stars',
  'Las Aceleradas': 'The Fast Movers',
  'Las Robustas': 'The Steady Ones',
  'Zona de Riesgo': 'Risk Zone',
  'Desabastecidas': 'Understocked',
  'Riesgo Crítico': 'Critical Risk'
};
function classifLabel(key, lang) {
  if (!key) return null;
  return lang === 'en' ? (CLASIF_LABELS_EN[key] || key) : key;
}

const CLASIF_DESC = {
  es: {
    'Las Estrellas': 'Buena venta y buen inventario. El balance ideal de la cartera.',
    'Las Aceleradas': 'Volando en ventas, necesitan inventario ya.',
    'Las Robustas': 'Buena venta pero acumulando stock.',
    'Zona de Riesgo': 'Crecimiento bajo con desequilibrios en el mix de inventario.',
    'Desabastecidas': 'Cliente sin stock para lograr buenos resultados de venta.',
    'Riesgo Crítico': 'Ventas contraídas con exceso de inventario en producto de lento movimiento.'
  },
  en: {
    'Las Estrellas': 'Strong sales and healthy inventory. The ideal balance for the portfolio.',
    'Las Aceleradas': 'Sales are flying, inventory needs to catch up now.',
    'Las Robustas': 'Good sales but inventory is piling up.',
    'Zona de Riesgo': 'Low growth with an unbalanced inventory mix.',
    'Desabastecidas': 'No stock to support good sales results.',
    'Riesgo Crítico': 'Sales are shrinking with excess inventory in slow-moving product.'
  }
};
function classifDesc(key, lang) {
  if (!key) return null;
  return (CLASIF_DESC[lang] || CLASIF_DESC.es)[key] || '';
}
