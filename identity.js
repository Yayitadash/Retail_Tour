// ============================================================
// RETAIL TOUR — Yaya: identidad
// ============================================================

// Yaya tiene un solo ícono: su foto real.
function getYayaAvatar() {
  return `<img src="./images/yaya.png" alt="Yaya" class="yaya-photo" />`;
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

