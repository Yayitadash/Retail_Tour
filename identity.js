// ============================================================
// RETAIL TOUR — Yaya: identidad
// ============================================================

// Yaya tiene un solo ícono: su foto real.
function getYayaAvatar() {
  return `<img src="./images/yaya.png" alt="Yaya" class="yaya-photo" style="width:100%;height:100%;object-fit:cover;display:block;" />`;
}

function loadUser() {
  try {
    const raw = localStorage.getItem('rt_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveUser(user) {
  localStorage.setItem('rt_user', JSON.stringify(user));
}
function loadLang() {
  return localStorage.getItem('rt_lang') || 'es';
}
function saveLang(lang) {
  localStorage.setItem('rt_lang', lang);
}
function hasAccess() {
  return localStorage.getItem('rt_access_version') === String(APP_ACCESS_VERSION);
}
function saveAccess(role) {
  localStorage.setItem('rt_access_version', String(APP_ACCESS_VERSION));
  localStorage.setItem('rt_access_role', role);
}
function getAccessRole() {
  // Los celulares que ya tenían acceso ANTES de que existiera el rol
  // (todo tu equipo actual) quedan como Estándar automáticamente, sin
  // tener que volver a escribir ninguna clave.
  const stored = localStorage.getItem('rt_access_role');
  return stored === 'full' ? 'full' : 'standard';
}

