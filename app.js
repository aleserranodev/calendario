// ═════════════════════════════════════════════════════════════
//  NUESTRO CALENDARIO · app.js
//  Calendario (inicio) · Guardias · Estudios · Rutinas
//  Datos: API de Google Apps Script (config.js → API_URL)
// ═════════════════════════════════════════════════════════════

// ── Constantes ────────────────────────────────────────────────
const NAMES = { alejandro: 'Alejandro', cristina: 'Cristina', ambos: 'Los dos' };
const TYPE_LABEL = {
  general: 'Evento', guardia: 'Guardia', continuidad: 'Continuidad',
  curso: 'Curso', tarea: 'Tarea / PEC', examen: 'Examen',
};
const TYPE_ICON = { general: '', guardia: '🩺 ', continuidad: '⏱ ', curso: '🎓 ', tarea: '📝 ', examen: '📚 ' };
const TASK_LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', entregada: 'Entregada' };
const TASK_NEXT = { pendiente: 'en_curso', en_curso: 'entregada', entregada: 'pendiente' };

// Colores por defecto (cada evento puede elegir otro)
const PERSON_COLOR = { alejandro: '#3B82F6', cristina: '#EC4899', ambos: '#0F766E' }; // juntos: verde azulado oscuro (distinto del saliente)
const TYPE_COLOR = {
  guardia: '#DC2626', continuidad: '#F97316', curso: '#8B5CF6', tarea: '#06B6D4', examen: '#EAB308',
};
const SALIENTE_COLOR = '#16A34A'; // verde (letra blanca)
const SALIENTE_TEXT = '#FFFFFF';
const FREE_COLOR = { alejandro: '#BFDBFE', cristina: '#FBCFE8', ambos: '#FDE68A' };
const SWATCHES = [
  '#EF4444', '#DC2626', '#F43F5E', '#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#6366F1',
  '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E', '#84CC16', '#EAB308',
  '#F59E0B', '#F97316', '#78716C', '#64748B',
];
// ── Vacaciones ────────────────────────────────────────────────
// Evento "general" de día completo con subject = 'vacaciones' (desde start hasta end, ambos incluidos).
// owner: alejandro | cristina | ambos (ambos = propuesta que el otro acepta; cuenta para los dos).
const VAC_BG = '#BBF7D0';     // fondo verde claro del día
const VAC_PILL = '#86EFAC';   // etiqueta
const VAC_TEXT = '#14532D';
const isVacacion = (ev) => ev.type === 'general' && ev.subject === 'vacaciones';
const vacPeople = (ev) => (ev.owner === 'ambos' ? ['alejandro', 'cristina'] : [ev.owner]);
function daysOf(ev) {
  const out = [];
  const a = ev.start.slice(0, 10), b = (ev.end || ev.start).slice(0, 10);
  for (let d = a; d <= b && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

// Festivos nacionales de España (fijos + Viernes Santo). Añade aquí los autonómicos y locales.
const FESTIVOS_EXTRA = []; // p. ej. '2027-02-28'
function easter(y) { // domingo de Pascua (algoritmo de Gauss/Butcher)
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h2 = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h2 - k) % 7, m = Math.floor((a + 11 * h2 + 22 * l) / 451);
  const month = Math.floor((h2 + l - 7 * m + 114) / 31), day = ((h2 + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const festivosCache = {};
function festivosDe(y) {
  if (!festivosCache[y]) {
    const fixed = ['01-01', '01-06', '05-01', '08-15', '10-12', '11-01', '12-06', '12-08', '12-25'].map((md) => `${y}-${md}`);
    const vs = new Date(easter(y)); vs.setDate(vs.getDate() - 2);
    festivosCache[y] = new Set([...fixed, ymd(vs), ...FESTIVOS_EXTRA.filter((d) => d.startsWith(String(y)))]);
  }
  return festivosCache[y];
}
const isFestivo = (day) => festivosDe(Number(day.slice(0, 4))).has(day);
function classifyDays(days) {
  const r = { total: days.length, lab: 0, finde: 0, fest: 0 };
  for (const d of days) { if (isWeekendDay(d)) r.finde++; else if (isFestivo(d)) r.fest++; else r.lab++; }
  return r;
}
const fmtCount = (c) => `${c.total} ${c.total === 1 ? 'día' : 'días'} · ${c.lab} lab. · ${c.finde} finde · ${c.fest} fest.`;

// Iconos para eventos y rutinas. Se guardan delante del título ("🎬 Cine"); sin icono = solo texto.
const ICONS = ['🍽️', '☕', '🍻', '🎬', '🎵', '🎮', '⚽', '🏋️', '🏃', '✈️', '🏖️', '🚗', '🏠', '🛒', '💼', '💻',
  '🎓', '📚', '📝', '🎂', '🎉', '❤️', '👨‍👩‍👧', '🐶', '💊', '🦷', '💇', '📞', '🔁', '⭐'];
function splitIcon(title) {
  const t = String(title || '');
  const icon = ICONS.find((i) => t.startsWith(i + ' '));
  return icon ? { icon, text: t.slice(icon.length + 1) } : { icon: '', text: t };
}
const withIcon = (icon, text) => (icon ? `${icon} ${text}` : text);
// Letras de los turnos en el calendario
const LETTER = { guardia: 'G', continuidad: 'C', saliente: 'S' };

const WEEKDAYS = [ // orden visual lunes→domingo; valor = Date.getDay()
  { v: 1, l: 'L' }, { v: 2, l: 'M' }, { v: 3, l: 'X' }, { v: 4, l: 'J' },
  { v: 5, l: 'V' }, { v: 6, l: 'S' }, { v: 0, l: 'D' },
];
const GUARDIA_PRESETS = [
  { label: '24 h (8–8)', s: '08:00', e: '08:00', d: 1 },
  { label: '17 h (15–8)', s: '15:00', e: '08:00', d: 1 },
  { label: '12 h día', s: '08:00', e: '20:00', d: 0 },
  { label: '12 h noche', s: '20:00', e: '08:00', d: 1 },
];
// Asignaturas: color y abreviatura automáticos para tareas y exámenes
const SUBJECTS = [
  { name: 'AGO', short: 'AGO', color: '#1D4ED8', match: /^ago\b/i },
  { name: 'Álgebra', short: 'ALG', color: '#EA580C', match: /^(alg|álg)/i },
  { name: 'Sistemas Operativos', short: 'SO', color: '#15803D', match: /^(so\b|sistemas op)/i },
];
const subjectOf = (ev) => (['tarea', 'examen'].includes(ev.type) && ev.subject ? SUBJECTS.find((x) => x.match.test(ev.subject.trim())) : null);

// Entregas del semestre (todas a las 23:59). Se añaden desde Estudios con un botón.
const UOC_ENTREGAS = [
  ['2026-10-02', 'Álgebra', 'Cuestionario 1 (Reto 1)'],
  ['2026-10-14', 'AGO', 'PEC 1 + Cuestionario PEC 1'],
  ['2026-10-30', 'Álgebra', 'Cuestionarios 2, 3, 4 y 5 (Reto 2)'],
  ['2026-11-05', 'Sistemas Operativos', 'Práctica 1'],
  ['2026-11-06', 'AGO', 'PEC 2 + Cuestionario PEC 2'],
  ['2026-11-20', 'Álgebra', 'Cuestionarios 6 y 7 (Reto 3)'],
  ['2026-11-23', 'Sistemas Operativos', 'PEC 1'],
  ['2026-11-27', 'AGO', 'PEC 3 + Cuestionario PEC 3'],
  ['2026-12-11', 'Álgebra', 'Cuestionarios 8, 9, 10 y 11 (Reto 4)'],
  ['2026-12-18', 'AGO', 'PEC 4 + Cuestionario PEC 4'],
  ['2026-12-19', 'Sistemas Operativos', 'Práctica 2'],
  ['2026-12-22', 'Álgebra', 'Actividad R5 (síntesis, obligatoria)'],
  ['2027-01-07', 'Sistemas Operativos', 'PEC 2'],
];

// Tipo de guardia (se guarda en el campo "subject", que las guardias no usan;
// así no hace falta tocar la hoja ni el Apps Script)
const GUARDIA_KIND = { normal: 'Normal', festivo: 'Festivo', especial: 'Festivo especial' };
const KIND_COLOR = { normal: '#DC2626', festivo: '#D97706', especial: '#7C3AED' };
const KIND_ICON = { normal: '', festivo: '🎉 ', especial: '⭐ ' };

// subject de una guardia: 'normal' | 'festivo:AAAA-MM-DD' | 'especial:AAAA-MM-DD'
// (la fecha es el día que es festivo; las guardias antiguas sin fecha usan el día de inicio)
function guardiaInfo(ev) {
  if (ev.type !== 'guardia') return null;
  const [k, d] = String(ev.subject || '').split(':');
  const kind = GUARDIA_KIND[k] ? k : 'normal';
  const date = kind === 'normal' ? null : (RE_YMD.test(d || '') ? d : ymd(evStart(ev)));
  return { kind, date };
}
const RE_YMD = /^\d{4}-\d{2}-\d{2}$/;
const guardiaKind = (ev) => (ev.type !== 'guardia' ? null : guardiaInfo(ev).kind);
// 🎉 solo para festivos entre semana; ⭐ siempre para festivo especial
function kindIcon(ev) {
  const g = guardiaInfo(ev);
  if (!g) return '';
  if (g.kind === 'especial') return '⭐ ';
  if (g.kind === 'festivo' && g.date && !isWeekendDay(g.date)) return '🎉 ';
  return '';
}

// Reparto de horas de una guardia según el día natural en que cae cada hora:
//  · día marcado como festivo especial → horas de festivo especial
//  · sábado, domingo o día marcado como festivo → horas festivas
//  · resto → horas ordinarias
// Ej.: guardia domingo 8:00 → lunes 8:00 = 16 h festivas + 8 h ordinarias.
function horasGuardia(ev) {
  const g = guardiaInfo(ev);
  const out = { ord: 0, fest: 0, esp: 0 };
  let t = ev.allDay ? parseYmd(ev.start) : new Date(ev.start);
  const end = ev.allDay ? parseYmd(addDays(ev.end || ev.start, 1)) : new Date(ev.end);
  while (t < end) {
    const midnight = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const next = midnight < end ? midnight : end;
    const hrs = (next - t) / 36e5;
    const day = ymd(t);
    if (g.date === day && g.kind === 'especial') out.esp += hrs;
    else if (g.date === day || isWeekendDay(day)) out.fest += hrs;
    else out.ord += hrs;
    t = next;
  }
  for (const k in out) out[k] = Math.round(out[k] * 10) / 10;
  return out;
}
const fmtSplit = (x) => [x.ord && `${x.ord} ord`, x.fest && `${x.fest} fest`, x.esp && `${x.esp} esp`].filter(Boolean).join(' · ');
const isWeekendDay = (dateStr) => [0, 6].includes(parseYmd(dateStr).getDay());
const CONTINUIDAD = { s: '15:00', e: '20:00' };

// Saliente añadido a mano (o diferido de una guardia de sábado). Se guarda como evento
// "general" de Cristina, de día completo, con subject = 'saliente' (sin tocar la hoja ni el Apps Script).
const isSaliente = (ev) => ev.type === 'general' && ev.subject === 'saliente';
const salienteOn = (day) => state.data.events.find((e) => isSaliente(e) && e.start.slice(0, 10) === day);
async function addSaliente(day) {
  if (salienteOn(day)) return;
  await api('saveEvent', { title: 'Saliente', owner: 'cristina', type: 'general', subject: 'saliente',
    start: day, end: day, allDay: true, color: '', description: '' });
} // horario habitual de una continuidad
const TOKEN_KEY = 'cal_token';
const POLL_MS = 10000;

// ── Estado ────────────────────────────────────────────────────
const state = {
  me: null,
  version: null,
  data: { events: [], series: [], free: [] },
  tab: 'calendar',
  filter: pref('cal_filter', 'todo'),
  view: pref('cal_view', 'dayGridMonth'),
  estudiosTab: 'tareas',
  guardiasFilter: 'todo', // todo | guardia | continuidad | curso
  guardiasMode: 'lista',   // lista (próximas) | mes (registro mensual para la nómina)
  registroFilter: 'todo',  // todo | guardias | normal | festivo | especial | continuidad | curso
  guardiasMonth: null,     // 'YYYY-MM-01' del mes que se está viendo en el resumen
};
let calendar = null;

// ── Preferencias locales (siempre con try/catch) ──────────────
function pref(key, def) { try { return localStorage.getItem(key) || def; } catch { return def; } }
function setPref(key, val) { try { val ? localStorage.setItem(key, val) : localStorage.removeItem(key); } catch { /* sin almacenamiento */ } }
const getToken = () => pref(TOKEN_KEY, '');
const setToken = (t) => setPref(TOKEN_KEY, t);

// ── API ───────────────────────────────────────────────────────
async function api(action, ...args) {
  let res;
  try {
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
      body: JSON.stringify({ token: getToken(), action, args }),
    });
  } catch {
    setOffline(true);
    throw new Error('Sin conexión. Revisa tu internet.');
  }
  setOffline(false);
  if (!res.ok) throw new Error(`Error del servidor (${res.status})`);
  const json = await res.json();
  if (!json.ok) {
    const err = new Error(json.error || 'Error desconocido');
    err.auth = /código de acceso/i.test(json.error || '');
    throw err;
  }
  return json.data;
}

async function refresh() {
  const d = await api('load');
  state.me = d.me;
  state.version = d.version;
  state.data = { events: d.events, series: d.series, free: d.free };
  renderAll();
}

// Guarda algo en la API, recarga datos y muestra aviso
async function mutate(msg, action, ...args) {
  await api(action, ...args);
  await refresh();
  if (msg) toast(msg);
}

function handleError(e) {
  if (e && e.auth) return logout();
  toast(e && e.message ? e.message : String(e), true);
}

// ── Utilidades DOM ────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

let toastTimer;
function toast(msg, isError) {
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.className = 'toast'; }, isError ? 4000 : 2200);
}

function setOffline(v) { $('offline').hidden = !v; }

// Botón con estado "Guardando…" mientras dura la operación
async function busy(btn, fn, label = 'Guardando…') {
  const txt = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  try { await fn(); } catch (e) { handleError(e); } finally { btn.disabled = false; btn.textContent = txt; }
}

// ── Utilidades de fecha (todo en hora local) ──────────────────
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hm = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
function parseYmd(s) { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
function localDT(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [H, M] = timeStr.split(':').map(Number);
  return new Date(y, m - 1, d, H, M);
}
const today = () => ymd(new Date());
const daysBetween = (a, b) => Math.round((parseYmd(b) - parseYmd(a)) / 864e5);
const fmtDay = (d) => cap(new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).format(d));
const fmtLongDay = (s) => cap(new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }).format(parseYmd(s)));
const fmtMonth = (d) => cap(new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(d));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Inicio y fin de un evento como Date
function evStart(ev) { return ev.allDay ? parseYmd(ev.start) : new Date(ev.start); }
function evEnd(ev) { return ev.allDay ? parseYmd(ev.end || ev.start) : new Date(ev.end || ev.start); }

// Texto "Sáb 3 oct · 08:00 → Dom 4 oct 08:00"
function fmtRange(ev) {
  const s = evStart(ev), e = evEnd(ev);
  if (ev.type === 'tarea') return fmtDay(s); // entregas: solo el día
  if (ev.allDay) {
    return ymd(s) === ymd(e) ? `${fmtDay(s)} · todo el día` : `${fmtDay(s)} → ${fmtDay(e)}`;
  }
  if (ymd(s) === ymd(e)) return ev.start === ev.end ? `${fmtDay(s)} · ${hm(s)}` : `${fmtDay(s)} · ${hm(s)}–${hm(e)}`;
  return `${fmtDay(s)} ${hm(s)} → ${fmtDay(e)} ${hm(e)}`;
}
function hoursOf(ev) {
  if (ev.allDay) return null;
  const hrs = (new Date(ev.end) - new Date(ev.start)) / 36e5;
  return Math.round(hrs * 10) / 10;
}

// Saliente automático: el día siguiente, salvo viernes y sábado (el de sábado es diferido y se pone a mano)
function salienteDay(ev) {
  if (ev.type !== 'guardia') return null;
  const sd = ymd(evStart(ev));             // día en que empieza la guardia
  const dow = parseYmd(sd).getDay();       // 0 domingo … 5 viernes, 6 sábado
  if (dow === 5 || dow === 6) return null; // viernes y sábado: sin saliente automático
  return addDays(sd, 1);                    // resto: el día siguiente
}

// ── Utilidades de color ───────────────────────────────────────
function colorOf(ev) {
  if (ev.type === 'guardia' || ev.type === 'continuidad') return TYPE_COLOR[ev.type]; // siempre rojo / naranja
  const subj = subjectOf(ev);
  return ev.color || (subj && subj.color) || TYPE_COLOR[ev.type] || PERSON_COLOR[ev.owner];
}
function textOn(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) > 165 ? '#1f2937' : '#ffffff';
}
function alpha(hex, a) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${a})`;
}

// ── Permisos (los mismos que aplica el servidor) ──────────────
const other = () => (state.me === 'alejandro' ? 'cristina' : 'alejandro');
const canEdit = (owner) => owner === state.me || owner === 'ambos';
function allowedTypes(owner) {
  if (owner === 'ambos') return ['general', 'curso'];
  if (owner === 'cristina') return ['general', 'guardia', 'continuidad', 'curso'];
  return ['general', 'curso', 'tarea', 'examen'];
}
function passFilter(owner, filter = state.filter) {
  if (filter === 'todo') return true;
  if (filter === 'mio') return owner === state.me;
  if (filter === 'suyo') return owner === other();
  return owner === 'ambos';
}

// ═════════════════════════════════════════════════════════════
//  CALENDARIO
// ═════════════════════════════════════════════════════════════

// Convierte los datos en eventos de FullCalendar para un rango
function buildEvents(rangeStart, rangeEnd, filter = state.filter) {
  const out = [];
  const from = ymd(rangeStart), to = ymd(rangeEnd);

  // 1. Eventos puntuales (+ salientes)
  for (const ev of state.data.events) {
    if (!passFilter(ev.owner, filter)) continue;
    if (isVacacion(ev)) {
      // Solo las propuestas pendientes se pintan aquí (etiqueta discontinua); las confirmadas, más abajo
      if (ev.status === 'pendiente' && passFilter(ev.owner, filter)) {
        const a = ev.start.slice(0, 10), b = addDays((ev.end || ev.start).slice(0, 10), 1);
        if (a < to && b > from) out.push({
          id: 'vp:' + ev.id, title: '⏳ 🏖 Vacaciones juntos', start: a, end: b, allDay: true,
          backgroundColor: alpha(VAC_PILL, 0.3), borderColor: '#16A34A', textColor: 'inherit',
          classNames: ['ev-pendiente'], extendedProps: { kind: 'vacEvt', ref: ev },
        });
      }
      continue;
    }
    if (isSaliente(ev)) {
      const day = ev.start.slice(0, 10);
      if (day >= from && day < to) out.push({
        id: 'm:' + ev.id, title: '😴 ' + LETTER.saliente, start: day, end: addDays(day, 1), allDay: true,
        backgroundColor: SALIENTE_COLOR, borderColor: SALIENTE_COLOR, textColor: SALIENTE_TEXT,
        classNames: ['ev-letter'], extendedProps: { kind: 'salienteEvt', ref: ev, day, label: '😴 Saliente' },
      });
      continue;
    }
    const color = colorOf(ev);
    const pending = ev.status === 'pendiente';
    const classNames = [];
    if (pending) classNames.push('ev-pendiente');
    if (ev.status === 'rechazado') classNames.push('ev-rechazado');
    if (ev.type === 'tarea' && ev.taskStatus === 'entregada') classNames.push('ev-hecha');

    // Guardias: solo en el día en que empiezan (aunque duren 24 h), como bloque de día completo.
    // El día siguiente solo muestra el saliente, si corresponde.
    if (ev.type === 'guardia') {
      const day = ymd(evStart(ev));
      const hrs = hoursOf(ev);
      out.push({
        id: 'e:' + ev.id,
        title: TYPE_ICON.guardia + LETTER.guardia + (kindIcon(ev) ? ' ' + kindIcon(ev).trim() : ''), // 🩺 G ⭐
        start: day, end: addDays(day, 1), allDay: true,
        backgroundColor: color, borderColor: color, textColor: '#FFFFFF',
        classNames: [...classNames, 'ev-letter'],
        extendedProps: { kind: 'event', ref: ev, label: TYPE_ICON.guardia + kindIcon(ev) + ev.title + (hrs ? ` · ${hrs} h` : '') },
      });
    } else if (ev.type === 'tarea') {
      // Las tareas / entregas se pintan solo en su día, como evento de día completo y sin hora
      const day = ymd(evStart(ev));
      out.push({
        id: 'e:' + ev.id,
        title: displayTitle(ev),
        start: day, end: addDays(day, 1), allDay: true,
        backgroundColor: color, borderColor: color, textColor: textOn(color),
        classNames, extendedProps: { kind: 'event', ref: ev },
      });
    } else out.push({
      id: 'e:' + ev.id,
      title: (pending ? '⏳ ' : '') + (ev.type === 'continuidad' ? TYPE_ICON.continuidad + LETTER.continuidad : displayTitle(ev)),
      start: ev.allDay ? ev.start.slice(0, 10) : ev.start,
      // Entregas (inicio = fin): se les da 1 minuto para que una de 23:59 no invada el día siguiente
      end: ev.allDay ? addDays(ev.end || ev.start, 1)
        : (ev.end === ev.start || !ev.end ? new Date(new Date(ev.start).getTime() + 60000).toISOString() : ev.end),
      allDay: ev.allDay,
      backgroundColor: pending ? alpha(color, 0.18) : color,
      borderColor: color,
      textColor: pending ? 'inherit' : textOn(color),
      classNames: ev.type === 'continuidad' ? [...classNames, 'ev-letter'] : classNames,
      extendedProps: { kind: 'event', ref: ev, label: (pending ? '⏳ ' : '') + displayTitle(ev) },
    });

    const sd = salienteDay(ev);
    if (sd && sd >= from && sd < to) {
      out.push({
        id: 's:' + ev.id,
        title: '😴 ' + LETTER.saliente,
        start: sd, allDay: true,
        backgroundColor: SALIENTE_COLOR, borderColor: SALIENTE_COLOR, textColor: SALIENTE_TEXT,
        classNames: ['ev-letter'],
        extendedProps: { kind: 'saliente', ref: ev, day: sd, label: '😴 Saliente' },
      });
    }
  }

  // 2. Rutinas: se expanden día a día dentro del rango visible
  for (const s of state.data.series) {
    if (!passFilter(s.owner, filter)) continue;
    const color = colorOf(s);
    const startDay = s.startDate > from ? s.startDate : from;
    for (let d = startDay; d < to; d = addDays(d, 1)) {
      if (s.endDate && d > s.endDate) break;
      if (!s.weekdays.includes(parseYmd(d).getDay())) continue;
      if (s.exdates.includes(d)) continue;
      out.push({
        id: `r:${s.id}:${d}`,
        title: s.type === 'continuidad' ? TYPE_ICON.continuidad + LETTER.continuidad : s.title,
        start: `${d}T${s.startTime}:00`,
        end: `${d}T${s.endTime}:00`,
        backgroundColor: color, borderColor: color, textColor: s.type === 'continuidad' ? '#FFFFFF' : textOn(color),
        classNames: s.type === 'continuidad' ? ['ev-letter'] : [],
        extendedProps: { kind: 'series', ref: s, day: d, label: s.title },
      });
    }
  }

  // 3. Vacaciones confirmadas: día entero en verde claro + etiqueta de quién
  const vacByDay = {};
  for (const ev of state.data.events) {
    if (!isVacacion(ev) || ev.status !== 'confirmado') continue;
    for (const d of daysOf(ev)) {
      if (d < from || d >= to) continue;
      (vacByDay[d] = vacByDay[d] || new Set());
      vacPeople(ev).forEach((p) => vacByDay[d].add(p));
    }
  }
  for (const [day, set] of Object.entries(vacByDay)) {
    const show = filter === 'todo' || (filter === 'mio' && set.has(state.me))
      || (filter === 'suyo' && set.has(other())) || (filter === 'juntos' && set.size === 2);
    if (!show) continue;
    const label = set.size === 2 ? '🏖 Vacaciones juntos' : `🏖 Vacaciones ${NAMES[[...set][0]]}`;
    out.push({ id: 'vb:' + day, start: day, end: addDays(day, 1), allDay: true, display: 'background', backgroundColor: VAC_BG });
    out.push({
      id: 'vl:' + day, title: label, start: day, end: addDays(day, 1), allDay: true,
      backgroundColor: VAC_PILL, borderColor: VAC_PILL, textColor: VAC_TEXT, classNames: ['ev-marca'],
      extendedProps: { kind: 'vac', day },
    });
  }

  // 4. Días libres ("los dos" si están marcados ambos)
  const byDay = {};
  for (const f of state.data.free) (byDay[f.day] = byDay[f.day] || new Set()).add(f.person);
  for (const [day, set] of Object.entries(byDay)) {
    if (day < from || day >= to) continue;
    const who = set.size === 2 ? 'ambos' : [...set][0];
    if (!passFilter(who, filter)) continue;
    out.push({
      id: 'f:' + day,
      title: who === 'ambos' ? '💚 Libres los dos' : `🌿 Libre ${NAMES[who]}`,
      start: day, allDay: true,
      backgroundColor: FREE_COLOR[who], borderColor: FREE_COLOR[who], textColor: '#1f2937',
      classNames: ['ev-marca'],
      extendedProps: { kind: 'free', day },
    });
  }
  return out;
}

function initCalendar() {
  calendar = new FullCalendar.Calendar($('calendar'), {
    locale: 'es',
    firstDay: 1,
    initialView: state.view,
    headerToolbar: false,
    height: '100%',
    nowIndicator: true,
    dayMaxEvents: true,
    scrollTime: '07:00:00',
    allDayText: 'Día',
    eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    slotLabelFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
    eventDisplay: 'block',
    views: { dayGridMonth: { displayEventTime: false } }, // en el mes, solo títulos (más legible en móvil)
    noEventsText: 'No hay nada este mes',
    events: (info, success) => success(buildEvents(info.start, info.end)),
    dateClick: (info) => openDaySheet(ymd(info.date), info.allDay ? null : hm(info.date)),
    eventClick: (info) => { info.jsEvent.preventDefault(); openItem(info.event.extendedProps); },
    datesSet: () => { $('calTitle').textContent = cap(calendar.view.title); },
  });
  calendar.render();

  $('calPrev').onclick = () => calendar.prev();
  $('calNext').onclick = () => calendar.next();
  $('calToday').onclick = () => calendar.today();
  $('calViews').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.view = b.dataset.view; setPref('cal_view', state.view); calendar.changeView(state.view); markView(); };
  });
  markView();

  // Deslizar a izquierda/derecha para cambiar de mes/semana/día
  let x0 = null, y0 = null;
  const el = $('calendar');
  el.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) (dx < 0 ? calendar.next() : calendar.prev());
    x0 = null;
  }, { passive: true });
}

function markView() {
  $('calViews').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.view === state.view));
}

function renderFilters() {
  const opts = [
    ['todo', 'Todo'], ['mio', 'Míos'], ['suyo', 'De ' + NAMES[other()]], ['juntos', 'Juntos'],
  ];
  $('filters').replaceChildren(...opts.map(([v, l]) => h('button', {
    class: 'chip' + (state.filter === v ? ' on' : ''),
    onclick: () => { state.filter = v; setPref('cal_filter', v); renderFilters(); calendar.refetchEvents(); },
  }, l)));

  const legend = [
    ['Alejandro', PERSON_COLOR.alejandro], ['Cristina', PERSON_COLOR.cristina], ['Juntos', PERSON_COLOR.ambos],
    ['Guardia', TYPE_COLOR.guardia], ['Saliente', SALIENTE_COLOR], ['Continuidad', TYPE_COLOR.continuidad],
    ['Curso', TYPE_COLOR.curso], ['Tarea', TYPE_COLOR.tarea], ['Examen', TYPE_COLOR.examen],
    ...SUBJECTS.map((x) => [x.short, x.color]), ['Vacaciones', VAC_PILL], ['Libres', FREE_COLOR.ambos],
  ];
  $('legend').replaceChildren(...legend.map(([l, c]) => h('span', {}, h('i', { class: 'dot', style: { background: c } }), l)));
}

// Título mostrado: icono elegido (si lo hay) o el del tipo, asignatura y texto
function displayTitle(ev) {
  const { icon, text } = splitIcon(ev.title);
  const lead = icon ? icon + ' ' : TYPE_ICON[ev.type] + kindIcon(ev);
  return lead + (subjectOf(ev) ? subjectOf(ev).short + ' · ' : '') + text;
}

// Qué hacer al pulsar un elemento del calendario o de una lista
function openItem(p) {
  if (p.kind === 'event') return openEventForm(p.ref);
  if (p.kind === 'series') return openOccurrence(p.ref, p.day);
  if (p.kind === 'saliente') return openDaySheet(p.day);
  if (p.kind === 'salienteEvt') return openSalienteSheet(p.ref);
  if (p.kind === 'vacEvt') return openVacationForm(p.ref);
  if (p.kind === 'vac') {
    const evs = state.data.events.filter((e) => isVacacion(e) && e.status === 'confirmado' && daysOf(e).includes(p.day));
    if (evs.length === 1) return openVacationForm(evs[0]);
    return openDaySheet(p.day);
  }
  if (p.kind === 'free') return openDaySheet(p.day);
}

// ═════════════════════════════════════════════════════════════
//  HOJAS (formularios inferiores)
// ═════════════════════════════════════════════════════════════
function openSheet(title, ...body) {
  const root = $('sheet-root');
  root.replaceChildren(
    h('div', { class: 'backdrop', onclick: closeSheet }),
    h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'sheet-head' },
        h('h3', {}, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Cerrar', onclick: closeSheet }, '✕')),
      h('div', { class: 'sheet-body' }, ...body)),
  );
  document.body.classList.add('noscroll');
}
function closeSheet() {
  $('sheet-root').replaceChildren();
  document.body.classList.remove('noscroll');
}
// (div y no <label>: un <label> reenviaría los toques al primer botón que contenga)
const field = (label, ...inputs) => h('div', { class: 'field' }, h('span', {}, label), ...inputs);

function colorPicker(initial, onChange) {
  const wrap = h('div', { class: 'swatches' });
  ['', ...SWATCHES].forEach((c) => {
    const b = h('button', {
      type: 'button',
      class: 'swatch' + (c ? '' : ' auto') + (c === initial ? ' on' : ''),
      title: c || 'Automático',
      style: c ? { background: c } : null,
      onclick: () => {
        wrap.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        onChange(c);
      },
    }, c ? '' : 'Auto');
    wrap.append(b);
  });
  return wrap;
}

function iconPicker(initial, onChange) {
  const wrap = h('div', { class: 'swatches icons' });
  ['', ...ICONS].forEach((ic) => {
    const b = h('button', {
      type: 'button', class: 'swatch icon' + (ic ? '' : ' auto') + (ic === initial ? ' on' : ''),
      title: ic || 'Sin icono',
      onclick: () => {
        wrap.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
        b.classList.add('on');
        onChange(ic);
      },
    }, ic || 'Sin');
    wrap.append(b);
  });
  return wrap;
}

// ── Hoja de un día (al pulsar un día del calendario) ─────────
function openDaySheet(day, time) {
  const items = buildEvents(parseYmd(day), parseYmd(addDays(day, 1)), 'todo')
    .filter((e) => e.extendedProps.kind !== 'free' && e.display !== 'background')
    .filter((e) => {
      if (e.allDay) {
        const endEx = e.end || addDays(e.start, 1);
        return e.start <= day && day < endEx;
      }
      const s = new Date(e.start), en = e.end ? new Date(e.end) : s;
      return s < parseYmd(addDays(day, 1)) && en >= parseYmd(day);
    })
    .sort((a, b) => String(a.start).localeCompare(String(b.start)));

  const list = items.length
    ? h('div', { class: 'mini day-items' }, items.map((e) => h('button', {
        onclick: () => openItem(e.extendedProps),
        style: { background: e.backgroundColor, color: e.textColor === 'inherit' ? 'var(--text)' : e.textColor, borderColor: e.borderColor },
        class: e.classNames && e.classNames.includes('ev-pendiente') ? 'pend' : '',
      },
        h('span', { class: 't' }, e.allDay ? 'Todo el día' : `${hm(new Date(e.start))}${e.end ? '–' + hm(new Date(e.end)) : ''}`),
        h('span', { class: 'n' }, e.extendedProps.label || e.title))))
    : h('p', { class: 'note' }, 'No hay nada este día.');

  // Estado de "libre" de ese día
  const freeSet = new Set(state.data.free.filter((f) => f.day === day).map((f) => f.person));
  const current = freeSet.size === 2 ? 'ambos' : freeSet.size === 1 ? [...freeSet][0] : 'ninguno';
  const freeBtn = (mode, label) => h('button', {
    class: current === mode ? 'on' : '',
    onclick: (e) => busy(e.currentTarget, async () => { await mutate('Día actualizado', 'setFree', day, mode); closeSheet(); }, '…'),
  }, label);

  const quick = [h('button', { class: 'btn primary', onclick: () => openEventForm(null, { date: day, time }) }, '+ Evento')];
  if (state.me === 'cristina') {
    quick.push(h('button', { class: 'btn', onclick: () => openEventForm(null, { date: day, type: 'guardia' }) }, '+ Guardia'));
    quick.push(h('button', { class: 'btn', onclick: () => openEventForm(null, { date: day, type: 'continuidad' }) }, '+ Continuidad'));
    quick.push(salienteOn(day)
      ? h('button', { class: 'btn', disabled: true }, '😴 Saliente ✓')
      : h('button', { class: 'btn', style: { background: SALIENTE_COLOR, color: SALIENTE_TEXT },
          onclick: (e) => busy(e.currentTarget, async () => { await addSaliente(day); await refresh(); toast('Saliente añadido'); closeSheet(); }, '…') }, '+ Saliente'));
  }
  quick.push(h('button', { class: 'btn', style: { background: VAC_PILL, color: VAC_TEXT }, onclick: () => openVacationForm(null, { date: day }) }, '+ Vacaciones'));
  if (state.me === 'alejandro') {
    quick.push(h('button', { class: 'btn', onclick: () => openEventForm(null, { date: day, type: 'tarea' }) }, '+ Tarea'));
    quick.push(h('button', { class: 'btn', onclick: () => openEventForm(null, { date: day, type: 'examen', time: time || '09:00' }) }, '+ Examen'));
  }

  openSheet(fmtLongDay(day) + (time ? ' · ' + time : ''),
    list,
    h('div', { class: 'actions' }, quick),
    field('¿Quién está libre este día?',
      h('div', { class: 'free-opts' },
        freeBtn('alejandro', '🌿 Libre Alejandro'),
        freeBtn('cristina', '🌿 Libre Cristina'),
        freeBtn('ambos', '💚 Libres los dos'),
        freeBtn('ninguno', 'Nadie'))),
  );
  document.querySelector('#sheet-root .sheet').classList.add('sheet-day'); // al menos media pantalla
}

// ── Vacaciones: crear / editar / aceptar ─────────────────────
function openVacationForm(ev, prefill = {}) {
  const isNew = !ev;
  const editable = isNew || canEdit(ev.owner);
  let owner = ev ? ev.owner : state.me;
  const iFrom = h('input', { type: 'date', value: ev ? ev.start.slice(0, 10) : (prefill.date || today()), disabled: !editable });
  const iTo = h('input', { type: 'date', value: ev ? (ev.end || ev.start).slice(0, 10) : (prefill.date || today()), disabled: !editable });
  const iDesc = h('textarea', { placeholder: 'Destino, notas… (opcional)', disabled: !editable }, ev ? ev.description || '' : '');
  const summary = h('div', { class: 'note' });
  const updSummary = () => {
    if (!iFrom.value || !iTo.value || iTo.value < iFrom.value) { summary.textContent = 'Revisa las fechas'; return; }
    summary.textContent = fmtCount(classifyDays(daysOf({ start: iFrom.value, end: iTo.value })));
  };
  iFrom.addEventListener('change', () => { if (iTo.value < iFrom.value) iTo.value = iFrom.value; updSummary(); });
  iTo.addEventListener('change', updSummary);
  updSummary();

  const ownerSeg = h('div', { class: 'seg', style: { margin: 0 } });
  const renderOwnerSeg = () => {
    const opts = [[state.me, 'Solo yo'], ['ambos', 'Los dos']];
    if (!isNew && owner === other()) opts.unshift([other(), NAMES[other()]]);
    ownerSeg.replaceChildren(...opts.map(([o, l]) => h('button', {
      type: 'button', class: owner === o ? 'on' : '', disabled: !editable,
      onclick: () => { owner = o; renderOwnerSeg(); },
    }, l)));
  };
  renderOwnerSeg();

  const notes = [];
  if (ev && ev.status === 'pendiente' && ev.createdBy !== state.me) {
    notes.push(h('div', { class: 'note warn' }, `${NAMES[ev.createdBy]} propone estas vacaciones juntos.`,
      h('div', { class: 'actions', style: { marginTop: '8px' } },
        h('button', { class: 'btn ok', onclick: (e) => busy(e.currentTarget, async () => { await mutate('¡Aceptadas!', 'respondProposal', ev.id, true); closeSheet(); }, '…') }, 'Aceptar'),
        h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { await mutate('Rechazadas', 'respondProposal', ev.id, false); closeSheet(); }, '…') }, 'Rechazar'))));
  } else if (ev && ev.status === 'pendiente') {
    notes.push(h('div', { class: 'note' }, `⏳ Esperando que ${NAMES[other()]} acepte.`));
  } else if (ev && ev.status === 'rechazado') {
    notes.push(h('div', { class: 'note' }, '❌ Propuesta rechazada.'));
  }
  if (!editable) notes.push(h('div', { class: 'note' }, `Vacaciones de ${NAMES[ev.owner]} (solo lectura).`));

  const btnSave = h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, async () => {
    if (!iFrom.value || !iTo.value) throw new Error('Elige las fechas');
    if (iTo.value < iFrom.value) throw new Error('La fecha final es anterior a la inicial');
    await mutate(owner === 'ambos' && (isNew || ev.owner !== 'ambos') ? 'Propuesta enviada' : 'Vacaciones guardadas', 'saveEvent', {
      id: ev ? ev.id : undefined, title: 'Vacaciones', owner, type: 'general', subject: 'vacaciones',
      start: iFrom.value, end: iTo.value, allDay: true, color: '', description: iDesc.value.trim(),
    });
    closeSheet();
  }) }, isNew ? 'Guardar vacaciones' : 'Guardar');
  const btnDel = !isNew && editable ? h('button', { class: 'btn danger', onclick: (e) => {
    if (!confirmInline(e.currentTarget)) return;
    busy(e.currentTarget, async () => { await mutate('Vacaciones borradas', 'deleteEvent', ev.id); closeSheet(); }, 'Borrando…');
  } }, 'Borrar') : null;

  openSheet(isNew ? '🏖 Nuevas vacaciones' : '🏖 Vacaciones',
    ...notes,
    field('¿De quién?', ownerSeg,
      h('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--muted)' } }, '"Los dos" le llega al otro como propuesta para aceptar.')),
    h('div', { class: 'row2' }, field('Desde', iFrom), field('Hasta', iTo)),
    summary,
    field('Notas', iDesc),
    editable ? h('div', { class: 'actions' }, btnSave, btnDel) : null,
  );
}

// ── Saliente manual ───────────────────────────────────────────
function openSalienteSheet(ev) {
  const mine = ev.owner === state.me;
  const iDay = h('input', { type: 'date', value: ev.start.slice(0, 10), disabled: !mine });
  openSheet('😴 Saliente',
    h('div', { class: 'note' }, fmtLongDay(ev.start.slice(0, 10)), ' · todo el día'),
    mine ? field('Cambiar fecha', iDay) : null,
    mine ? h('div', { class: 'actions' },
      h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, async () => {
        if (!iDay.value) throw new Error('Elige una fecha');
        await mutate('Saliente movido', 'saveEvent', { ...ev, start: iDay.value, end: iDay.value });
        closeSheet();
      }) }, 'Guardar'),
      h('button', { class: 'btn danger', onclick: (e) => {
        if (!confirmInline(e.currentTarget)) return;
        busy(e.currentTarget, async () => { await mutate('Saliente borrado', 'deleteEvent', ev.id); closeSheet(); }, 'Borrando…');
      } }, 'Borrar')) : null,
  );
}

// ── Formulario de evento (crear / editar / ver) ──────────────
function openEventForm(ev, prefill = {}) {
  const isNew = !ev;
  const editable = isNew || canEdit(ev.owner);
  const v = ev
    ? { ...ev }
    : { title: '', owner: state.me, type: prefill.type || 'general', allDay: !prefill.time && !['guardia', 'continuidad', 'examen'].includes(prefill.type),
        description: '', color: '', subject: '', taskStatus: 'pendiente' };
  if (!allowedTypes(v.owner).includes(v.type)) v.type = 'general';

  // Fechas iniciales
  let sDate, sTime, eDate, eTime;
  if (ev && ev.allDay) {
    sDate = ev.start.slice(0, 10); eDate = (ev.end || ev.start).slice(0, 10); sTime = '09:00'; eTime = '10:00';
  } else if (ev) {
    const s = new Date(ev.start), e = new Date(ev.end || ev.start);
    sDate = ymd(s); sTime = hm(s); eDate = ymd(e); eTime = hm(e);
  } else {
    sDate = prefill.date || today();
    sTime = prefill.time || '09:00';
    const end = new Date(localDT(sDate, sTime).getTime() + 36e5);
    eDate = ymd(end); eTime = hm(end);
  }

  // Controles
  let { icon: evIcon, text: titleText } = splitIcon(v.title);
  const iTitle = h('input', { value: titleText, maxLength: 110, placeholder: 'Título' });
  const fTitle = field('Título', iTitle);
  const iOwner = h('div', { class: 'seg', style: { margin: 0 } });
  const iType = h('select');
  const iSubject = h('input', { value: v.type === 'guardia' ? '' : v.subject, maxLength: 80, placeholder: 'AGO, Álgebra, Sistemas Operativos…', list: 'subjects-list' });
  const subjectsList = h('datalist', { id: 'subjects-list' }, SUBJECTS.map((x) => h('option', { value: x.name })));
  const iTask = h('select', {}, Object.entries(TASK_LABEL).map(([k, l]) => h('option', { value: k, selected: k === v.taskStatus }, l)));
  const iAllDay = h('input', { type: 'checkbox', checked: v.allDay });
  const iSDate = h('input', { type: 'date', value: sDate });
  const iSTime = h('input', { type: 'time', value: sTime });
  const iEDate = h('input', { type: 'date', value: eDate });
  const iETime = h('input', { type: 'time', value: eTime });
  const iDesc = h('textarea', { placeholder: 'Notas (opcional)' }, v.description || '');
  let color = v.color || '';

  const fOwner = field('¿De quién es?', iOwner);
  const fColor = editable ? field('Color', colorPicker(color, (c) => { color = c; })) : h('div');
  const fIcon = editable ? field('Icono', iconPicker(evIcon, (ic) => { evIcon = ic; })) : h('div');
  const fSubject = field('Asignatura', iSubject);
  const fTask = field('Estado', iTask);
  const fAllDay = h('label', { class: 'check' }, iAllDay, h('span', { id: 'lblAllDay' }, 'Todo el día'));
  const presets = h('div', { class: 'presets' }, GUARDIA_PRESETS.map((p) => h('button', {
    type: 'button', class: 'chip',
    onclick: () => { iSTime.value = p.s; iETime.value = p.e; iEDate.value = addDays(iSDate.value, p.d); renderKindDate(); },
  }, p.label)));
  const fPresets = field('Duración', presets);

  // Tipo de guardia. En una guardia nueva se propone "Festivo" si cae en sábado o domingo,
  // hasta que se elija a mano.
  const gi = ev && ev.type === 'guardia' ? guardiaInfo(ev) : null;
  let kind = gi ? gi.kind : (isWeekendDay(sDate) ? 'festivo' : 'normal');
  let kindDate = gi && gi.date ? gi.date : null; // día que es festivo / festivo especial
  let kindTouched = !!ev;
  const iKind = h('div', { class: 'seg', style: { margin: 0 } });
  const renderKind = () => iKind.replaceChildren(...Object.entries(GUARDIA_KIND).map(([k, l]) => h('button', {
    type: 'button', class: kind === k ? 'on' : '', disabled: !editable,
    style: kind === k ? { color: KIND_COLOR[k] } : null,
    onclick: () => { kind = k; kindTouched = true; renderKind(); renderKindDate(); },
  }, KIND_ICON[k] + l)));
  renderKind();
  const fKind = field('Tipo de guardia', iKind);

  // ¿Qué día es el festivo? (los días que toca la guardia)
  const iKindDate = h('div', { class: 'seg', style: { margin: 0 } });
  const fKindDate = field('¿Qué día es festivo?', iKindDate,
    h('div', { class: 'sub', style: { fontSize: '12px', color: 'var(--muted)' } },
      'Las horas de ese día cuentan como festivas (o festivo especial). Sábados y domingos siempre cuentan como festivas; el resto, ordinarias.'));
  function renderKindDate() {
    const days = [];
    const a = iSDate.value, b = iEDate.value || iSDate.value;
    if (a) for (let d = a; d <= b && days.length < 3; d = addDays(d, 1)) days.push(d);
    if (!days.includes(kindDate)) kindDate = days[0] || null;
    fKindDate.querySelector('span').textContent = kind === 'especial' ? '¿Qué día es el festivo especial?' : '¿Qué día es festivo?';
    iKindDate.replaceChildren(...days.map((d) => h('button', {
      type: 'button', class: kindDate === d ? 'on' : '', disabled: !editable,
      onclick: () => { kindDate = d; renderKindDate(); },
    }, fmtDay(parseYmd(d)))));
    fKindDate.hidden = v.type !== 'guardia' || kind === 'normal';
  }

  // Guardia de sábado → "¿Sabes ya el saliente diferido?"
  let salKnown = false;
  const iSal = h('input', { type: 'date', value: addDays(sDate, 2) });
  const salSeg = h('div', { class: 'seg', style: { margin: 0 } });
  const renderSal = () => {
    salSeg.replaceChildren(
      h('button', { type: 'button', class: salKnown ? '' : 'on', onclick: () => { salKnown = false; renderSal(); } }, 'No lo sé'),
      h('button', { type: 'button', class: salKnown ? 'on' : '', onclick: () => { salKnown = true; renderSal(); } }, 'Sí, lo sé'));
    iSal.hidden = !salKnown;
  };
  renderSal();
  const fSal = field('¿Sabes ya el saliente diferido?', salSeg, iSal);
  const fStart = field('Inicio', h('div', { class: 'row2' }, iSDate, iSTime));
  const fEnd = field('Fin', h('div', { class: 'row2' }, iEDate, iETime));

  // Propietario: "Solo yo" o "Los dos"
  function renderOwner() {
    const opts = [[state.me, 'Solo yo'], ['ambos', 'Los dos']];
    if (!isNew && v.owner === other()) opts.unshift([other(), NAMES[other()]]);
    iOwner.replaceChildren(...opts.map(([o, l]) => h('button', {
      type: 'button', class: v.owner === o ? 'on' : '', disabled: !editable,
      onclick: () => { v.owner = o; renderOwner(); renderTypes(); sync(); },
    }, l)));
  }
  function renderTypes() {
    const types = allowedTypes(v.owner);
    if (!types.includes(v.type)) v.type = types[0];
    iType.replaceChildren(...types.map((t) => h('option', { value: t, selected: t === v.type }, TYPE_LABEL[t])));
  }

  // Muestra/oculta campos según el tipo
  function sync() {
    const t = v.type;
    fSubject.hidden = !['tarea', 'examen'].includes(t);
    fTask.hidden = t !== 'tarea';
    fPresets.hidden = t !== 'guardia';
    fKind.hidden = t !== 'guardia';
    renderKindDate();
    fSal.hidden = !(editable && t === 'guardia' && iSDate.value && parseYmd(iSDate.value).getDay() === 6);
    // Guardia y continuidad: nombre opcional, sin elegir dueño ni color (rojo / naranja fijos)
    const medical = t === 'guardia' || t === 'continuidad';
    fOwner.hidden = medical;
    fColor.hidden = medical;
    fIcon.hidden = medical;
    fTitle.querySelector('span').textContent = medical ? 'Nombre (opcional)' : 'Título';
    iTitle.placeholder = medical ? TYPE_LABEL[t] : 'Título';
    fAllDay.hidden = t === 'guardia';
    $('lblAllDay') && ($('lblAllDay').textContent = t === 'tarea' ? 'Sin hora concreta' : 'Todo el día');
    const allDay = t !== 'guardia' && iAllDay.checked;
    iSTime.hidden = allDay;
    iETime.hidden = allDay;
    fEnd.hidden = t === 'tarea';
    fStart.querySelector('span').textContent = t === 'tarea' ? 'Fecha de entrega' : 'Inicio';
  }

  // Al cambiar la fecha de inicio, el fin se mueve igual
  let prevS = iSDate.value;
  iSDate.addEventListener('change', () => {
    if (iSDate.value && prevS) iEDate.value = addDays(iEDate.value || prevS, daysBetween(prevS, iSDate.value));
    prevS = iSDate.value;
    if (!kindTouched && iSDate.value) { kind = isWeekendDay(iSDate.value) ? 'festivo' : 'normal'; kindDate = iSDate.value; renderKind(); }
    if (iSDate.value) iSal.value = addDays(iSDate.value, 2);
    sync();
  });
  iType.addEventListener('change', () => {
    v.type = iType.value;
    if (isNew) applyTypeDefaults();
    sync();
  });
  iAllDay.addEventListener('change', sync);
  iEDate.addEventListener('change', () => renderKindDate());

  renderOwner();
  renderTypes();
  // Horario por defecto según el tipo: guardia 24 h (8–8), continuidad 15:00–20:00
  function applyTypeDefaults() {
    if (v.type === 'guardia') {
      const p = GUARDIA_PRESETS[0];
      iSTime.value = p.s; iETime.value = p.e; iEDate.value = addDays(iSDate.value, p.d);
    } else if (v.type === 'continuidad') {
      iAllDay.checked = false;
      iSTime.value = CONTINUIDAD.s; iETime.value = CONTINUIDAD.e; iEDate.value = iSDate.value;
    }
  }
  if (isNew) applyTypeDefaults();

  // Recoge y valida el formulario
  function collect() {
    const type = v.type;
    const medical = type === 'guardia' || type === 'continuidad';
    const text = iTitle.value.trim() || (medical ? TYPE_LABEL[type] : '');
    if (!text) throw new Error('Pon un título');
    const title = medical ? text : withIcon(evIcon, text);
    const allDay = type !== 'guardia' && iAllDay.checked;
    if (!iSDate.value) throw new Error('Falta la fecha');
    let start, end;
    if (allDay) {
      start = iSDate.value;
      end = type === 'tarea' ? start : (iEDate.value || start);
      if (end < start) throw new Error('El fin es anterior al inicio');
    } else {
      if (!iSTime.value) throw new Error('Falta la hora');
      start = localDT(iSDate.value, iSTime.value).toISOString();
      end = type === 'tarea' ? start : localDT(iEDate.value || iSDate.value, iETime.value || iSTime.value).toISOString();
      if (new Date(end) < new Date(start)) throw new Error('El fin es anterior al inicio');
    }
    return {
      id: ev ? ev.id : undefined,
      title, owner: v.owner, type, start, end, allDay, color: medical ? '' : color,
      description: iDesc.value.trim(),
      subject: type === 'guardia' ? (kind === 'normal' ? 'normal' : `${kind}:${kindDate || iSDate.value}`)
        : ['tarea', 'examen'].includes(type) ? iSubject.value.trim() : '',
      taskStatus: type === 'tarea' ? iTask.value : '',
    };
  }

  // Avisos de propuestas
  const notes = [];
  if (ev && ev.status === 'pendiente' && ev.createdBy !== state.me) {
    notes.push(h('div', { class: 'note warn' }, `${NAMES[ev.createdBy]} te propone este plan.`,
      h('div', { class: 'actions', style: { marginTop: '8px' } },
        h('button', { class: 'btn ok', onclick: (e) => busy(e.currentTarget, async () => { await mutate('¡Aceptado!', 'respondProposal', ev.id, true); closeSheet(); }, '…') }, 'Aceptar'),
        h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { await mutate('Rechazado', 'respondProposal', ev.id, false); closeSheet(); }, '…') }, 'Rechazar'))));
  } else if (ev && ev.status === 'pendiente') {
    notes.push(h('div', { class: 'note' }, `⏳ Esperando que ${NAMES[other()]} acepte.`));
  } else if (ev && ev.status === 'rechazado') {
    notes.push(h('div', { class: 'note' }, `❌ ${NAMES[ev.createdBy === state.me ? other() : state.me]} rechazó este plan.`));
  }
  if (!editable) notes.push(h('div', { class: 'note' }, `Evento de ${NAMES[ev.owner]} (solo lectura).`));

  // Botones
  const btnSave = h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, async () => {
    const data = collect();
    const wantsSal = !fSal.hidden && salKnown;
    if (wantsSal && (!iSal.value || iSal.value <= iSDate.value)) throw new Error('El saliente tiene que ser después de la guardia');
    await api('saveEvent', data);
    if (wantsSal) await addSaliente(iSal.value);
    await refresh();
    toast(data.owner === 'ambos' && isNew ? 'Propuesta enviada' : wantsSal ? 'Guardado con su saliente' : 'Guardado');
    closeSheet();
  }) }, isNew ? 'Crear' : 'Guardar');
  const btnDel = !isNew && editable ? h('button', { class: 'btn danger', onclick: (e) => {
    if (!confirmInline(e.currentTarget)) return;
    busy(e.currentTarget, async () => { await mutate('Borrado', 'deleteEvent', ev.id); closeSheet(); }, 'Borrando…');
  } }, 'Borrar') : null;

  const inputs = [iTitle, iType, iSubject, iTask, iAllDay, iSDate, iSTime, iEDate, iETime, iDesc];
  if (!editable) inputs.forEach((i) => { i.disabled = true; });

  openSheet(isNew ? 'Nuevo' : (editable ? 'Editar' : 'Detalle'),
    ...notes,
    fTitle,
    fOwner,
    field('Tipo', iType),
    fSubject,
    fKind,
    fPresets,
    fAllDay,
    fStart,
    fEnd,
    fKindDate,
    fSal,
    fTask,
    fIcon,
    fColor,
    subjectsList,
    field('Descripción', iDesc),
    editable ? h('div', { class: 'actions' }, btnSave, btnDel) : null,
  );
  sync();
  if (isNew && !['guardia', 'continuidad'].includes(v.type)) iTitle.focus();
}

// Pide confirmación pulsando dos veces (evita diálogos del navegador)
function confirmInline(btn) {
  if (btn.dataset.armed) return true;
  btn.dataset.armed = '1';
  const txt = btn.textContent;
  btn.textContent = '¿Seguro? Pulsa otra vez';
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = txt; }, 3000);
  return false;
}

// ── Una aparición concreta de una rutina ─────────────────────
function openOccurrence(s, day) {
  const mine = s.owner === state.me;
  const days = WEEKDAYS.filter((w) => s.weekdays.includes(w.v)).map((w) => w.l).join(' ');
  openSheet(s.title,
    h('div', { class: 'note' },
      h('div', {}, h('b', {}, fmtLongDay(day)), ` · ${s.startTime}–${s.endTime}`),
      h('div', { style: { color: 'var(--muted)', marginTop: '4px' } }, `Rutina de ${NAMES[s.owner]} · ${days}`)),
    s.description ? h('p', {}, s.description) : null,
    mine ? h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: (e) => busy(e.currentTarget, async () => { await mutate('Quitado este día', 'skipOccurrence', s.id, day); closeSheet(); }, '…') }, 'Quitar solo este día'),
      h('button', { class: 'btn primary', onclick: () => openSeriesForm(s) }, 'Editar rutina'))
      : null,
  );
}

// ── Formulario de rutina (evento recurrente) ─────────────────
function openSeriesForm(s) {
  const isNew = !s;
  const v = s ? { ...s, weekdays: [...s.weekdays] } : {
    title: '', owner: state.me, type: 'general', color: '', weekdays: [1, 2, 3, 4, 5],
    startTime: '09:00', endTime: '14:00', startDate: today(), endDate: '', description: '',
  };
  const types = allowedTypes(state.me).filter((t) => !['tarea', 'examen', 'guardia'].includes(t));

  let { icon: sIcon, text: sText } = splitIcon(v.title);
  if (isNew) sIcon = '🔁';
  const iTitle = h('input', { value: sText, maxLength: 110, placeholder: 'Ej. Trabajo, Clase, Gimnasio' });
  const iType = h('select', {}, types.map((t) => h('option', { value: t, selected: t === v.type }, TYPE_LABEL[t])));
  const days = h('div', { class: 'days' });
  const renderDays = () => days.replaceChildren(...WEEKDAYS.map((w) => h('button', {
    type: 'button', class: v.weekdays.includes(w.v) ? 'on' : '',
    onclick: () => { v.weekdays = v.weekdays.includes(w.v) ? v.weekdays.filter((x) => x !== w.v) : [...v.weekdays, w.v]; renderDays(); },
  }, w.l)));
  renderDays();
  const iST = h('input', { type: 'time', value: v.startTime });
  const iET = h('input', { type: 'time', value: v.endTime });
  const iSD = h('input', { type: 'date', value: v.startDate });
  const iED = h('input', { type: 'date', value: v.endDate });
  const iDesc = h('textarea', { placeholder: 'Notas (opcional)' }, v.description || '');
  let color = v.color || '';

  const btnSave = h('button', { class: 'btn primary', onclick: (e) => busy(e.currentTarget, async () => {
    const text = iTitle.value.trim();
    if (!text) throw new Error('Pon un título');
    const title = withIcon(sIcon, text);
    if (!v.weekdays.length) throw new Error('Elige al menos un día');
    if (!iST.value || !iET.value || iET.value <= iST.value) throw new Error('Revisa las horas');
    await mutate('Rutina guardada', 'saveSeries', {
      id: s ? s.id : undefined, title, owner: state.me, type: iType.value, color,
      weekdays: v.weekdays, startTime: iST.value, endTime: iET.value,
      startDate: iSD.value || today(), endDate: iED.value, exdates: v.exdates || [], description: iDesc.value.trim(),
    });
    closeSheet();
  }) }, isNew ? 'Crear rutina' : 'Guardar');
  const btnDel = !isNew ? h('button', { class: 'btn danger', onclick: (e) => {
    if (!confirmInline(e.currentTarget)) return;
    busy(e.currentTarget, async () => { await mutate('Rutina borrada', 'deleteSeries', s.id); closeSheet(); }, 'Borrando…');
  } }, 'Borrar rutina') : null;

  openSheet(isNew ? 'Nueva rutina' : 'Editar rutina',
    field('Título', iTitle),
    field('Icono', iconPicker(sIcon, (ic) => { sIcon = ic; })),
    field('Tipo', iType),
    field('Días de la semana', days),
    field('Horario', h('div', { class: 'row2' }, iST, iET)),
    h('div', { class: 'row2' }, field('Desde', iSD), field('Hasta (opcional)', iED)),
    v.exdates && v.exdates.length ? h('div', { class: 'note' }, `${v.exdates.length} día(s) quitado(s) de esta rutina.`) : null,
    field('Color', colorPicker(color, (c) => { color = c; })),
    field('Descripción', iDesc),
    h('div', { class: 'actions' }, btnSave, btnDel),
  );
  if (isNew) iTitle.focus();
}

// ── Propuestas (campana) ─────────────────────────────────────
function openEvent(ev) {
  if (isVacacion(ev)) return openVacationForm(ev);
  if (isSaliente(ev)) return openSalienteSheet(ev);
  return openEventForm(ev);
}
function pendingForMe() {
  return state.data.events.filter((e) => e.status === 'pendiente' && e.createdBy !== state.me);
}
function openProposals() {
  const received = pendingForMe();
  const sent = state.data.events.filter((e) => e.owner === 'ambos' && e.createdBy === state.me && e.status !== 'confirmado');
  const row = (ev, side) => h('button', { class: 'item', onclick: () => openEvent(ev) },
    h('i', { class: 'bar', style: { background: colorOf(ev) } }),
    h('div', { class: 'main' }, h('div', { class: 'title' }, ev.title), h('div', { class: 'sub' }, fmtRange(ev))),
    side);
  openSheet('Propuestas',
    h('div', { class: 'group-title', style: { padding: '0' } }, 'Para ti'),
    received.length
      ? h('div', { class: 'list', style: { padding: 0 } }, received.map((ev) => row(ev, h('span', { class: 'tag', style: { background: '#fef3c7', color: '#92400e' } }, 'Responder'))))
      : h('p', { class: 'note' }, 'No tienes propuestas pendientes.'),
    h('div', { class: 'group-title', style: { padding: '0' } }, 'Enviadas por ti'),
    sent.length
      ? h('div', { class: 'list', style: { padding: 0 } }, sent.map((ev) => row(ev, h('span', { class: 'tag', style: { background: 'var(--surface-2)' } }, ev.status === 'pendiente' ? 'Esperando' : 'Rechazada'))))
      : h('p', { class: 'note' }, 'Nada pendiente.'),
  );
}

// ═════════════════════════════════════════════════════════════
//  PANTALLAS DE LISTA
// ═════════════════════════════════════════════════════════════
function groupByMonth(list, dateOf) {
  const groups = [];
  let key = null;
  for (const item of list) {
    const d = dateOf(item);
    const k = `${d.getFullYear()}-${d.getMonth()}`;
    if (k !== key) { groups.push({ title: fmtMonth(d), items: [] }); key = k; }
    groups[groups.length - 1].items.push(item);
  }
  return groups;
}

// ── Guardias ─────────────────────────────────────────────────
function renderGuardias() {
  $('gModes').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.mode === state.guardiasMode));
  const isMonth = state.guardiasMode === 'mes';
  $('gPastWrap').hidden = isMonth;
  $('gFilters').hidden = isMonth;
  if (isMonth) return renderGuardiasMes();

  const opts = [['todo', 'Todo'], ['guardia', 'Guardias'], ['continuidad', 'Continuidades'], ['curso', 'Cursos']];
  $('gFilters').replaceChildren(...opts.map(([k, l]) => h('button', {
    class: 'chip' + (state.guardiasFilter === k ? ' on' : ''),
    onclick: () => { state.guardiasFilter = k; renderGuardias(); },
  }, l)));
  const gf = state.guardiasFilter;
  const showPast = $('gPast').checked;
  const now = new Date();
  const list = state.data.events
    .filter((e) => e.owner === 'cristina' && ['guardia', 'continuidad', 'curso'].includes(e.type))
    .filter((e) => gf === 'todo' || e.type === gf)
    .filter((e) => showPast || evEnd(e) >= now || (e.allDay && ymd(evEnd(e)) >= today()))
    .sort((a, b) => evStart(a) - evStart(b));

  const box = $('gList');
  if (!list.length) {
    box.replaceChildren(h('p', { class: 'empty' }, state.me === 'cristina' ? 'No hay nada próximo. Pulsa + para añadir.' : 'Cristina no tiene nada próximo.'));
    return;
  }
  box.replaceChildren(...groupByMonth(list, evStart).flatMap((g) => [
    h('div', { class: 'group-title' }, g.title),
    h('div', { class: 'list' }, g.items.map((ev) => {
      const sal = salienteDay(ev);
      const hrs = hoursOf(ev);
      return h('button', { class: 'item', onclick: () => openEventForm(ev) },
        h('i', { class: 'bar', style: { background: colorOf(ev) } }),
        h('div', { class: 'main' },
          h('div', { class: 'title' }, TYPE_ICON[ev.type] + ev.title),
          h('div', { class: 'sub' }, fmtRange(ev)),
          sal ? h('div', { class: 'sub' }, '😴 Saliente: ' + fmtDay(parseYmd(sal))) : null),
        h('div', { class: 'side' },
          ev.type === 'guardia'
            ? h('span', { class: 'tag', style: { background: alpha(KIND_COLOR[guardiaKind(ev)], 0.15), color: KIND_COLOR[guardiaKind(ev)] } },
                kindIcon(ev) + (guardiaKind(ev) === 'normal' ? 'Guardia' : GUARDIA_KIND[guardiaKind(ev)]))
            : h('span', { class: 'tag', style: { background: alpha(colorOf(ev), 0.15), color: colorOf(ev) } }, TYPE_LABEL[ev.type]),
          hrs ? h('span', { class: 'sub' }, `${hrs} h`) : null));
    })),
  ]));
}

// ── Registro mensual de guardias y continuidades (para la nómina) ──
// Incluye los eventos sueltos y las continuidades creadas como rutina.
// Cada turno cuenta en el mes en que empieza.
function turnosDelMes(monthStart) {
  const m = parseYmd(monthStart);
  const from = monthStart;
  const to = ymd(new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const items = [];

  for (const ev of state.data.events) {
    if (ev.owner !== 'cristina' || !['guardia', 'continuidad', 'curso'].includes(ev.type)) continue;
    const d = ymd(evStart(ev));
    if (d < from || d >= to) continue;
    items.push({ type: ev.type, kind: guardiaKind(ev), icon: kindIcon(ev), split: ev.type === 'guardia' ? horasGuardia(ev) : null,
      day: d, start: evStart(ev), end: evEnd(ev),
      allDay: ev.allDay, hours: hoursOf(ev), title: ev.title, ref: ev });
  }
  for (const sr of state.data.series) {
    if (sr.owner !== 'cristina' || !['continuidad', 'curso'].includes(sr.type)) continue;
    for (let d = sr.startDate > from ? sr.startDate : from; d < to; d = addDays(d, 1)) {
      if (sr.endDate && d > sr.endDate) break;
      if (!sr.weekdays.includes(parseYmd(d).getDay()) || sr.exdates.includes(d)) continue;
      const st = localDT(d, sr.startTime), en = localDT(d, sr.endTime);
      items.push({ type: sr.type, kind: null, day: d, start: st, end: en, allDay: false,
        hours: Math.round((en - st) / 36e5 * 10) / 10, title: sr.title, series: sr });
    }
  }
  return items.sort((a, b) => a.start - b.start);
}

const REGISTRO_FILTERS = [
  ['todo', 'Todo'], ['guardias', 'Todas las guardias'], ['normal', 'Normales'], ['festivo', 'Festivas'],
  ['especial', '⭐ Festivos especiales'], ['continuidad', 'Continuidades'], ['curso', 'Cursos'],
];
function matchRegistro(x, f) {
  if (f === 'todo') return true;
  if (f === 'guardias') return x.type === 'guardia';
  if (['normal', 'festivo', 'especial'].includes(f)) return x.type === 'guardia' && x.kind === f;
  return x.type === f;
}
const sumHours = (arr) => Math.round(arr.reduce((t, x) => t + (x.hours || 0), 0) * 10) / 10;

function renderGuardiasMes() {
  if (!state.guardiasMonth) state.guardiasMonth = today().slice(0, 7) + '-01';
  const month = state.guardiasMonth;
  const mDate = parseYmd(month);
  const all = turnosDelMes(month);
  const f = state.registroFilter;
  const items = all.filter((x) => matchRegistro(x, f));
  const title = fmtMonth(mDate);

  const goMonth = (y, mIdx) => { state.guardiasMonth = ymd(new Date(y, mIdx, 1)); renderGuardias(); };
  const setFilter = (k) => { state.registroFilter = state.registroFilter === k && k !== 'todo' ? 'todo' : k; renderGuardias(); };

  // 1. Navegación: ‹ Mes › + selector de mes + tira con los 12 meses del año
  const monthInput = h('input', { type: 'month', value: month.slice(0, 7), style: { position: 'absolute', opacity: 0, inset: 0 },
    onchange: (e) => { if (e.target.value) { const [y, mm] = e.target.value.split('-').map(Number); goMonth(y, mm - 1); } } });
  const nav = h('div', { class: 'month-nav' },
    h('button', { class: 'icon-btn', 'aria-label': 'Mes anterior', onclick: () => goMonth(mDate.getFullYear(), mDate.getMonth() - 1) }, '‹'),
    h('h3', { style: { position: 'relative' } }, title, ' ▾', monthInput),
    h('button', { class: 'icon-btn', 'aria-label': 'Mes siguiente', onclick: () => goMonth(mDate.getFullYear(), mDate.getMonth() + 1) }, '›'));

  const year = mDate.getFullYear();
  const strip = h('div', { class: 'chips month-strip' }, Array.from({ length: 12 }, (_, i) => {
    const key = ymd(new Date(year, i, 1));
    const n = turnosDelMes(key).filter((x) => matchRegistro(x, f === 'todo' ? 'todo' : f)).length;
    const label = new Intl.DateTimeFormat('es-ES', { month: 'short' }).format(new Date(year, i, 1)).replace('.', '');
    return h('button', { class: 'chip mchip' + (key === month ? ' on' : ''), onclick: () => goMonth(year, i) },
      cap(label), h('small', {}, n || '–'));
  }));

  // 2. Recuento de horas del mes (control de nómina)
  const g = all.filter((x) => x.type === 'guardia');
  const byKind = (k) => g.filter((x) => x.kind === k);
  const cont = all.filter((x) => x.type === 'continuidad');
  const tot = g.reduce((a, x) => ({ ord: a.ord + x.split.ord, fest: a.fest + x.split.fest, esp: a.esp + x.split.esp }), { ord: 0, fest: 0, esp: 0 });
  for (const k in tot) tot[k] = Math.round(tot[k] * 10) / 10;
  const hStat = (color, value, label, extra, key) => h('button', {
    class: 'stat' + (key && f === key ? ' on' : ''), style: { borderTopColor: color }, onclick: key ? () => setFilter(key) : null,
  }, h('div', { class: 'n' }, `${value} h`), h('div', { class: 'l' }, label), extra ? h('div', { class: 'x' }, extra) : null);
  const summary = h('div', { class: 'note', style: { margin: '0 12px 8px', display: 'flex', justifyContent: 'space-between', gap: '8px' } },
    h('b', {}, `🩺 ${g.length} ${g.length === 1 ? 'guardia' : 'guardias'} · ${sumHours(g)} h`),
    h('span', {}, `⏱ ${cont.length} contin. · ${sumHours(cont)} h`));
  const stats = h('div', { class: 'stats stats-4' },
    hStat(KIND_COLOR.normal, tot.ord, 'Horas ordinarias', 'de guardia'),
    hStat(KIND_COLOR.festivo, tot.fest, 'Horas festivas', 'sáb., dom. y festivos', 'festivo'),
    hStat(KIND_COLOR.especial, tot.esp, '⭐ Horas festivo especial', `${byKind('especial').length} guardia(s)`, 'especial'),
    hStat(TYPE_COLOR.continuidad, sumHours(cont), 'Continuidades', `${cont.length} turno(s)`, 'continuidad'));

  // 3. Filtros
  const chips = h('div', { class: 'chips', style: { padding: '10px 12px 4px' } }, REGISTRO_FILTERS.map(([k, l]) =>
    h('button', { class: 'chip' + (f === k ? ' on' : ''), onclick: () => { state.registroFilter = k; renderGuardias(); } }, l)));

  // 4. Tabla del mes
  const short = (d) => (d.getMinutes() ? hm(d) : String(d.getHours())); // 15:00 → "15"
  const hhmm = (x) => (x.allDay ? 'Todo el día' : `${short(x.start)}–${short(x.end)} h`);
  const typeTag = (x) => {
    if (x.type === 'guardia') {
      const c = KIND_COLOR[x.kind];
      return h('span', { class: 'tag', style: { background: alpha(c, 0.15), color: c } }, (x.icon || '') + (x.kind === 'normal' ? 'Guardia' : GUARDIA_KIND[x.kind]));
    }
    const c = TYPE_COLOR[x.type];
    return h('span', { class: 'tag', style: { background: alpha(c, 0.15), color: c } }, TYPE_LABEL[x.type] + (x.series ? ' 🔁' : ''));
  };
  const row = (x) => h('div', { class: 'tr tr4', role: 'button', style: { cursor: 'pointer' },
      onclick: () => (x.ref ? openEventForm(x.ref) : openOccurrence(x.series, x.day)) },
    h('div', {}, fmtDay(x.start)),
    h('div', {}, typeTag(x), x.split ? h('div', { class: 'sub', style: { fontSize: '11px', marginTop: '3px' } }, fmtSplit(x.split)) : null),
    h('div', { class: 'sub' }, hhmm(x)),
    h('div', { class: 'num' }, x.hours ? `${x.hours} h` : '—'));
  const filterLabel = REGISTRO_FILTERS.find(([k]) => k === f)[1];
  const table = items.length
    ? h('div', { class: 'table', style: { marginTop: '8px' } },
        h('div', { class: 'tr tr4 th' }, h('div', {}, 'Día'), h('div', {}, 'Tipo'), h('div', {}, 'Horario'), h('div', { class: 'num' }, 'Horas')),
        items.map(row),
        h('div', { class: 'tr tr4 tf' }, h('div', {}, `${items.length} ${items.length === 1 ? 'turno' : 'turnos'}`), h('div', {}, f === 'todo' ? '' : filterLabel), h('div', {}), h('div', { class: 'num' }, `${sumHours(items)} h`)))
    : h('p', { class: 'empty' }, f === 'todo' ? 'No hay guardias ni continuidades este mes.' : `No hay "${filterLabel}" este mes.`);

  // 5. Copiar para comparar con la nómina
  const texto = () => {
    const lines = [
      `Registro ${title}`,
      `Guardias: ${g.length} (${sumHours(g)} h)`,
      `  Horas ordinarias: ${tot.ord} h`,
      `  Horas festivas: ${tot.fest} h`,
      `  Horas festivo especial: ${tot.esp} h`,
      `Continuidades: ${cont.length} (${sumHours(cont)} h)`,
      '',
    ];
    for (const x of items) {
      if (x.type === 'curso' && f === 'todo') continue;
      const tipo = x.type === 'guardia' ? `Guardia ${GUARDIA_KIND[x.kind].toLowerCase()}` : TYPE_LABEL[x.type];
      lines.push(`${fmtDay(x.start)} · ${tipo} · ${hhmm(x)}${x.hours ? ` · ${x.hours} h` : ''}${x.split ? ` (${fmtSplit(x.split)})` : ''}`);
    }
    return lines.join('\n');
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(texto()); toast('Registro copiado'); }
    catch { openSheet('Registro', h('textarea', { style: { minHeight: '260px' }, readOnly: true }, texto())); }
  };

  $('gList').replaceChildren(...[
    nav, strip, summary, stats, chips, table,
    all.length ? h('div', { style: { padding: '16px 12px' } }, h('button', { class: 'btn block', onclick: copy }, '📋 Copiar registro del mes')) : null,
  ].filter(Boolean));
  // Centra el mes elegido en la tira de meses
  const on = strip.querySelector('.on');
  if (on) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2;
}

// ── Estudios ─────────────────────────────────────────────────
function renderEstudios() {
  $('eTabs').querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.estudiosTab));
  const isTasks = state.estudiosTab === 'tareas';
  $('eDoneLabel').textContent = isTasks ? 'Ver entregadas' : 'Ver pasados';
  const showOld = $('eDone').checked;
  const t = today();
  const canChange = state.me === 'alejandro';

  const list = state.data.events
    .filter((e) => e.type === (isTasks ? 'tarea' : 'examen'))
    .filter((e) => (isTasks ? showOld || e.taskStatus !== 'entregada' : showOld || ymd(evStart(e)) >= t))
    .sort((a, b) => evStart(a) - evStart(b));

  const box = $('eList');
  const importCard = isTasks ? uocImportCard() : null;
  if (!list.length) {
    box.replaceChildren(...[importCard, h('p', { class: 'empty' }, isTasks ? 'No hay tareas pendientes 🎉' : 'No hay exámenes próximos.')].filter(Boolean));
    return;
  }

  box.replaceChildren(...[importCard].filter(Boolean), h('div', { class: 'list', style: { paddingTop: '8px' } }, list.map((ev) => {
    const d = daysBetween(t, ymd(evStart(ev)));
    const when = d === 0 ? 'Hoy' : d === 1 ? 'Mañana' : d > 0 ? `${d} días` : `Hace ${-d} d`;
    const late = isTasks && d < 0 && ev.taskStatus !== 'entregada';

    let side;
    if (isTasks) {
      const st = ev.taskStatus || 'pendiente';
      const colors = { pendiente: ['#fee2e2', '#b91c1c'], en_curso: ['#fef3c7', '#92400e'], entregada: ['#d1fae5', '#065f46'] }[st];
      side = h('div', { class: 'side' },
        h('span', {
          class: 'tag', role: canChange ? 'button' : null,
          style: { background: colors[0], color: colors[1] },
          onclick: canChange ? (e) => {
            e.stopPropagation();
            api('saveEvent', { ...ev, taskStatus: TASK_NEXT[st] }).then(refresh).then(() => toast(TASK_LABEL[TASK_NEXT[st]])).catch(handleError);
          } : null,
        }, TASK_LABEL[st]),
        h('span', { class: 'sub' + (late ? ' late' : '') }, late ? `Vencida (${-d} d)` : when));
    } else {
      side = h('div', { class: 'side' }, h('div', { class: 'count' + (d <= 7 && d >= 0 ? ' late' : '') },
        d >= 0 ? d : '—', h('small', {}, d === 0 ? '¡hoy!' : d === 1 ? 'día' : 'días')));
    }

    return h('button', { class: 'item', onclick: () => openEventForm(ev) },
      h('i', { class: 'bar', style: { background: colorOf(ev) } }),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, ev.title),
        h('div', { class: 'sub' }, [ev.subject, fmtRange(ev)].filter(Boolean).join(' · '))),
      side);
  })));
}

// Entregas UOC que aún no están en el calendario (se comparan por fecha + asignatura + título)
function uocMissing() {
  const have = new Set(state.data.events.filter((e) => e.type === 'tarea')
    .map((e) => `${ymd(evStart(e))}|${e.subject}|${e.title}`));
  return UOC_ENTREGAS.filter(([d, subj, title]) => !have.has(`${d}|${subj}|${title}`));
}
function uocImportCard() {
  if (state.me !== 'alejandro') return null;
  const missing = uocMissing();
  if (!missing.length) return null;
  const btn = h('button', { class: 'btn primary', onclick: async () => {
    btn.disabled = true;
    try {
      for (let i = 0; i < missing.length; i++) {
        btn.textContent = `Añadiendo ${i + 1}/${missing.length}…`;
        const [d, subj, title] = missing[i];
        const due = localDT(d, '23:59').toISOString();
        await api('saveEvent', { title, owner: 'alejandro', type: 'tarea', subject: subj, taskStatus: 'pendiente',
          start: due, end: due, allDay: false, color: '', description: 'Entrega UOC · vence a las 23:59' });
      }
      await refresh();
      toast('Entregas añadidas');
    } catch (e) { handleError(e); await refresh().catch(() => {}); }
  } }, `Añadir ${missing.length} entregas`);
  return h('div', { class: 'note', style: { margin: '8px 12px 0', display: 'flex', alignItems: 'center', gap: '10px' } },
    h('div', { style: { flex: 1 } }, h('b', {}, '📥 Entregas del semestre'), h('div', { class: 'sub' }, 'AGO · Álgebra · Sistemas Operativos (23:59)')),
    btn);
}

// ── Vacaciones (panel) ───────────────────────────────────────
function renderVacaciones() {
  if (!state.vacYear) state.vacYear = new Date().getFullYear();
  const y = String(state.vacYear);
  const inYear = (d) => d.startsWith(y);
  const vacs = state.data.events.filter(isVacacion);
  const confirmed = vacs.filter((e) => e.status === 'confirmado');

  const daysFor = (p) => {
    const set = new Set();
    confirmed.filter((e) => vacPeople(e).includes(p)).forEach((e) => daysOf(e).filter(inYear).forEach((d) => set.add(d)));
    return [...set].sort();
  };
  const dA = daysFor('alejandro'), dC = daysFor('cristina');
  const setC = new Set(dC);
  const dJ = dA.filter((d) => setC.has(d));

  const card = (title, color, days) => {
    const c = classifyDays(days);
    return h('div', { class: 'stat', style: { borderTopColor: color } },
      h('div', { class: 'n' }, c.total), h('div', { class: 'l' }, title),
      h('div', { class: 'x' }, `${c.lab} laborables`),
      h('div', { class: 'x' }, `${c.finde} fin de semana · ${c.fest} festivos`));
  };

  const periodRow = (ev) => {
    const days = daysOf(ev);
    const c = classifyDays(days);
    const a = parseYmd(days[0]), b = parseYmd(days[days.length - 1]);
    const range = days.length === 1 ? fmtDay(a) : `${fmtDay(a)} → ${fmtDay(b)}`;
    return h('button', { class: 'item', onclick: () => openVacationForm(ev) },
      h('i', { class: 'bar', style: { background: ev.owner === 'ambos' ? PERSON_COLOR.ambos : PERSON_COLOR[ev.owner] } }),
      h('div', { class: 'main' },
        h('div', { class: 'title' }, (ev.status === 'pendiente' ? '⏳ ' : ev.status === 'rechazado' ? '❌ ' : '') + range),
        h('div', { class: 'sub' }, `${c.lab} lab. · ${c.finde} finde · ${c.fest} fest.`),
        ev.description ? h('div', { class: 'sub' }, ev.description) : null),
      h('div', { class: 'side' }, h('div', { class: 'count' }, c.total, h('small', {}, c.total === 1 ? 'día' : 'días'))));
  };
  const section = (title, list) => [
    h('div', { class: 'group-title' }, title),
    list.length ? h('div', { class: 'list' }, list.map(periodRow)) : h('p', { class: 'empty', style: { padding: '8px 16px' } }, 'Ninguna este año.'),
  ];
  const byOwner = (o) => vacs.filter((e) => e.owner === o && daysOf(e).some(inYear)).sort((a, b) => a.start.localeCompare(b.start));

  $('vList').replaceChildren(...[
    h('div', { class: 'month-nav' },
      h('button', { class: 'icon-btn', 'aria-label': 'Año anterior', onclick: () => { state.vacYear--; renderVacaciones(); } }, '‹'),
      h('h3', {}, `Vacaciones ${y}`),
      h('button', { class: 'icon-btn', 'aria-label': 'Año siguiente', onclick: () => { state.vacYear++; renderVacaciones(); } }, '›')),
    h('div', { class: 'stats' },
      card('Alejandro', PERSON_COLOR.alejandro, dA),
      card('Cristina', PERSON_COLOR.cristina, dC)),
    h('div', { class: 'stats', style: { marginTop: '8px', gridTemplateColumns: '1fr' } }, card('Días juntos de vacaciones', PERSON_COLOR.ambos, dJ)),
    h('p', { class: 'sub', style: { padding: '6px 16px 0', fontSize: '12px', color: 'var(--muted)' } },
      'Festivos: nacionales (incluye Viernes Santo). Los autonómicos y locales se pueden añadir.'),
    ...section('Vacaciones juntos', byOwner('ambos')),
    ...section('Vacaciones de Alejandro', byOwner('alejandro')),
    ...section('Vacaciones de Cristina', byOwner('cristina')),
  ].filter(Boolean));
}

// ── Rutinas ──────────────────────────────────────────────────
function renderRutinas() {
  const box = $('rList');
  const section = (owner) => {
    const items = state.data.series.filter((s) => s.owner === owner).sort((a, b) => a.startTime.localeCompare(b.startTime));
    const title = owner === state.me ? 'Mis rutinas' : `Rutinas de ${NAMES[owner]}`;
    return [
      h('div', { class: 'group-title' }, title),
      items.length
        ? h('div', { class: 'list' }, items.map((s) => {
            const days = WEEKDAYS.filter((w) => s.weekdays.includes(w.v)).map((w) => w.l).join(' ');
            const range = s.endDate ? `hasta ${fmtDay(parseYmd(s.endDate))}` : 'sin fecha de fin';
            return h('button', { class: 'item', onclick: () => (owner === state.me ? openSeriesForm(s) : null) },
              h('i', { class: 'bar', style: { background: colorOf(s) } }),
              h('div', { class: 'main' },
                h('div', { class: 'title' }, s.title),
                h('div', { class: 'sub' }, `${days} · ${s.startTime}–${s.endTime}`),
                h('div', { class: 'sub' }, range)));
          }))
        : h('p', { class: 'empty', style: { padding: '12px' } }, owner === state.me ? 'Pulsa + para crear tu primera rutina.' : 'Sin rutinas.'),
    ];
  };
  box.replaceChildren(...section(state.me), ...section(other()));
}

// ═════════════════════════════════════════════════════════════
//  NAVEGACIÓN Y PINTADO GENERAL
// ═════════════════════════════════════════════════════════════
function renderAll() {
  const avatar = $('btnUser');
  avatar.textContent = NAMES[state.me].charAt(0);
  avatar.style.background = PERSON_COLOR[state.me];

  const n = pendingForMe().length;
  $('badge').hidden = !n;
  $('badge').textContent = n;

  renderFilters();
  if (calendar) calendar.refetchEvents();
  renderGuardias();
  renderEstudios();
  renderRutinas();
  renderVacaciones();
  renderFab();
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ['calendar', 'guardias', 'estudios', 'vacaciones', 'rutinas'].forEach((t) => { $('view-' + t).hidden = t !== tab; });
  if (tab === 'calendar' && calendar) calendar.updateSize();
  renderFab();
}

// El botón + cambia según la pantalla
function renderFab() {
  const fab = $('fab');
  const t = state.tab;
  const show = t === 'calendar' || t === 'rutinas' || t === 'vacaciones'
    || (t === 'guardias' && state.me === 'cristina')
    || (t === 'estudios' && state.me === 'alejandro');
  fab.hidden = !show;
}
function onFab() {
  const t = state.tab;
  if (t === 'calendar') return openEventForm(null, { date: calendar ? ymd(calendar.getDate()) : today() });
  if (t === 'guardias') return openEventForm(null, { type: state.guardiasFilter === 'todo' ? 'guardia' : state.guardiasFilter });
  if (t === 'estudios') return openEventForm(null, { type: state.estudiosTab === 'tareas' ? 'tarea' : 'examen', time: state.estudiosTab === 'tareas' ? null : '09:00' });
  if (t === 'rutinas') return openSeriesForm(null);
  if (t === 'vacaciones') return openVacationForm(null);
}

// Tema de la app en este móvil: auto (sigue al móvil) | light | dark
function applyTheme(theme) {
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  setPref('cal_theme', theme === 'auto' ? '' : theme);
}

function openAccount() {
  const current = pref('cal_theme', 'auto');
  const themeSeg = h('div', { class: 'seg', style: { margin: 0 } });
  const renderTheme = (sel) => themeSeg.replaceChildren(...[['auto', 'Como el móvil'], ['light', '☀️ Claro'], ['dark', '🌙 Oscuro']]
    .map(([k, l]) => h('button', { class: sel === k ? 'on' : '', onclick: () => { applyTheme(k); renderTheme(k); } }, l)));
  renderTheme(current);

  openSheet('Cuenta',
    h('div', { class: 'note' }, 'Conectado como ', h('b', {}, NAMES[state.me])),
    field('Apariencia (solo en este móvil)', themeSeg),
    h('button', { class: 'btn block', onclick: (e) => busy(e.currentTarget, async () => { await refresh(); toast('Actualizado'); closeSheet(); }, 'Cargando…') }, '🔄 Recargar datos'),
    h('button', { class: 'btn danger block', onclick: () => { closeSheet(); logout(); } }, 'Cerrar sesión en este móvil'),
  );
}

// ═════════════════════════════════════════════════════════════
//  ACCESO Y ARRANQUE
// ═════════════════════════════════════════════════════════════
function showScreen(name) {
  $('loader').hidden = name !== 'loader';
  $('login').hidden = name !== 'login';
  $('app').hidden = name !== 'app';
}

async function enterApp() {
  await refresh();
  showScreen('app');
  if (!calendar) initCalendar();
  switchTab(state.tab);
  renderAll();
}

async function login() {
  const code = $('code').value.trim();
  if (!code) return;
  setToken(code);
  $('loginErr').textContent = '';
  await busy($('btnLogin'), async () => {
    try { await enterApp(); } catch (e) { setToken(''); $('loginErr').textContent = e.message; }
  }, 'Entrando…');
}

function logout() {
  setToken('');
  state.me = null;
  closeSheet();
  $('code').value = '';
  showScreen('login');
}

// Sincronización: cada 10 s pregunta si hay cambios (solo con la app visible)
async function poll() {
  if (document.hidden || !state.me) return;
  try {
    const v = await api('version');
    if (v !== state.version) await refresh();
  } catch (e) {
    if (e.auth) logout();
  }
}

function bindUI() {
  $('btnLogin').onclick = login;
  $('code').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('btnBell').onclick = openProposals;
  $('btnUser').onclick = openAccount;
  $('fab').onclick = onFab;
  document.querySelectorAll('.tabbar button').forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });
  $('gPast').onchange = renderGuardias;
  let gx0 = null, gy0 = null;
  $('gList').addEventListener('touchstart', (e) => { gx0 = e.touches[0].clientX; gy0 = e.touches[0].clientY; }, { passive: true });
  $('gList').addEventListener('touchend', (e) => {
    if (gx0 === null || state.guardiasMode !== 'mes' || e.target.closest('.month-strip, .chips')) { gx0 = null; return; }
    const dx = e.changedTouches[0].clientX - gx0, dy = e.changedTouches[0].clientY - gy0;
    gx0 = null;
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      const d = parseYmd(state.guardiasMonth);
      state.guardiasMonth = ymd(new Date(d.getFullYear(), d.getMonth() + (dx < 0 ? 1 : -1), 1));
      renderGuardias();
    }
  }, { passive: true });
  $('gModes').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.guardiasMode = b.dataset.mode; renderGuardias(); };
  });
  $('eDone').onchange = renderEstudios;
  $('eTabs').querySelectorAll('button').forEach((b) => {
    b.onclick = () => { state.estudiosTab = b.dataset.tab; $('eDone').checked = false; renderEstudios(); };
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSheet(); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  setInterval(poll, POLL_MS);
}

(async function start() {
  bindUI();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

  if (typeof FullCalendar === 'undefined') {
    showScreen('login');
    $('loginErr').textContent = 'No se pudo cargar el calendario. Comprueba tu conexión y recarga.';
    return;
  }
  if (!getToken()) return showScreen('login');
  try {
    await enterApp();
  } catch (e) {
    if (e.auth) setToken('');
    showScreen('login');
    $('loginErr').textContent = e.message;
  }
})();
