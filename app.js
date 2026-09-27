// ─────────────────────────────────────────────────────────────
// Cliente de la API + página de prueba (Fase 2)
// ─────────────────────────────────────────────────────────────
const COLORS = { alejandro: '#3B82F6', cristina: '#EC4899', ambos: '#10B981' };
const NAMES = { alejandro: 'Alejandro', cristina: 'Cristina', ambos: 'Los dos' };
const TOKEN_KEY = 'cal_token';
const POLL_MS = 10000;

let state = { me: null, version: null, events: [], series: [], free: [] };

// ── Código de acceso guardado en el móvil ──────────────────────
function getToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
}
function setToken(t) {
  try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); } catch { /* modo privado */ }
}

// ── Llamada a la API de Apps Script ────────────────────────────
// Content-Type text/plain evita la petición previa CORS que Apps Script no admite.
async function api(action, ...args) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: getToken(), action, args }),
    });
  } catch {
    throw new Error('Sin conexión. Revisa tu internet.');
  }
  if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error || 'Error desconocido');
    err.auth = /código de acceso/i.test(json.error || '');
    throw err;
  }
  return json.data;
}

// ── Utilidades de interfaz ─────────────────────────────────────
const $ = (id) => document.getElementById(id);

function showErr(el, e) {
  el.textContent = e ? (e.message || String(e)) : '';
  el.style.display = e ? 'block' : 'none';
}

function h(tag, props, ...children) {
  const n = Object.assign(document.createElement(tag), props || {});
  children.forEach((c) => n.append(c));
  return n;
}

function showView(name) {
  $('login').hidden = name !== 'login';
  $('main').hidden = name !== 'main';
}

// ── Acceso ─────────────────────────────────────────────────────
async function login() {
  const code = $('code').value.trim();
  if (!code) return;
  $('btnLogin').disabled = true;
  setToken(code);
  try {
    await cargar();
    showErr($('loginErr'), null);
  } catch (e) {
    setToken('');
    showErr($('loginErr'), e);
  } finally {
    $('btnLogin').disabled = false;
  }
}

function logout() {
  setToken('');
  state = { me: null, version: null, events: [], series: [], free: [] };
  $('code').value = '';
  showView('login');
}

// ── Datos ──────────────────────────────────────────────────────
async function cargar() {
  state = await api('load');
  showView('main');
  showErr($('err'), null);
  pintar();
  marcarSync();
}

async function accion(action, ...args) {
  try {
    await api(action, ...args);
    await cargar();
  } catch (e) {
    if (e.auth) return logout();
    showErr($('err'), e);
  }
}

function crearPrueba(compartido) {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  const hora = new Date().toLocaleTimeString('es-ES');
  return accion('saveEvent', {
    title: (compartido ? 'Plan juntos ' : 'Prueba ') + hora,
    owner: compartido ? 'ambos' : state.me,
    type: 'general',
    start: start.toISOString(),
    end: end.toISOString(),
  });
}

// ── Pintado de la lista ────────────────────────────────────────
function pintar() {
  $('who').textContent = 'Conectado como ' + NAMES[state.me];
  const lista = $('lista');
  lista.replaceChildren();

  const events = state.events.slice().sort((a, b) => a.start.localeCompare(b.start));
  if (!events.length) lista.append(h('p', { className: 'muted', textContent: 'No hay eventos todavía.' }));

  events.forEach((ev) => {
    const card = h('div', { className: 'card ' + ev.status });
    card.style.borderLeftColor = ev.color || COLORS[ev.owner];
    const fecha = new Date(ev.start).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
    card.append(
      h('strong', { textContent: ev.title }),
      h('div', { className: 'muted', textContent: `${fecha} · ${NAMES[ev.owner]} · ${ev.type} · ${ev.status}` })
    );

    const actions = h('div', { className: 'actions' });
    if (ev.status === 'pendiente' && ev.createdBy !== state.me) {
      actions.append(
        h('button', { className: 'ok', textContent: 'Aceptar', onclick: () => accion('respondProposal', ev.id, true) }),
        h('button', { className: 'sec', textContent: 'Rechazar', onclick: () => accion('respondProposal', ev.id, false) })
      );
    }
    if (ev.owner === state.me || ev.owner === 'ambos') {
      actions.append(h('button', { className: 'del', textContent: 'Borrar', onclick: () => accion('deleteEvent', ev.id) }));
    }
    card.append(actions);
    lista.append(card);
  });
}

function marcarSync() {
  $('sync').textContent = 'Última comprobación: ' + new Date().toLocaleTimeString('es-ES');
}

// ── Sincronización cada 10 s (solo con la app en pantalla) ─────
async function poll() {
  if (document.hidden || !state.me) return;
  try {
    const v = await api('version');
    if (v !== state.version) await cargar();
    else marcarSync();
  } catch (e) {
    if (e.auth) return logout();
    showErr($('err'), e);
  }
}

// ── Arranque ───────────────────────────────────────────────────
$('btnLogin').onclick = login;
$('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
$('btnMine').onclick = () => crearPrueba(false);
$('btnShared').onclick = () => crearPrueba(true);
$('btnReload').onclick = () => cargar().catch((e) => showErr($('err'), e));
$('btnLogout').onclick = logout;

setInterval(poll, POLL_MS);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* la app funciona igual sin él */ });
}

if (getToken()) {
  cargar().catch((e) => { if (e.auth) setToken(''); showView('login'); showErr($('loginErr'), e); });
} else {
  showView('login');
}
