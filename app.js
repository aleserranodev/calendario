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
const TYPE_ICON = { general: '', guardia: '🏥 ', continuidad: '⏱ ', curso: '🎓 ', tarea: '📝 ', examen: '📚 ' };
const TASK_LABEL = { pendiente: 'Pendiente', en_curso: 'En curso', entregada: 'Entregada' };
const TASK_NEXT = { pendiente: 'en_curso', en_curso: 'entregada', entregada: 'pendiente' };

// Colores por defecto (cada evento puede elegir otro)
const PERSON_COLOR = { alejandro: '#3B82F6', cristina: '#EC4899', ambos: '#10B981' };
const TYPE_COLOR = {
  guardia: '#DC2626', continuidad: '#F97316', curso: '#8B5CF6', tarea: '#06B6D4', examen: '#EAB308',
};
const SALIENTE_COLOR = '#FECACA';
const FREE_COLOR = { alejandro: '#BFDBFE', cristina: '#FBCFE8', ambos: '#A7F3D0' };
const SWATCHES = [
  '#EF4444', '#DC2626', '#F43F5E', '#EC4899', '#D946EF', '#A855F7', '#8B5CF6', '#6366F1',
  '#3B82F6', '#0EA5E9', '#06B6D4', '#14B8A6', '#10B981', '#22C55E', '#84CC16', '#EAB308',
  '#F59E0B', '#F97316', '#78716C', '#64748B',
];
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

// Saliente: el día en que termina una guardia que cruza la medianoche
// (una guardia "todo el día" genera saliente al día siguiente)
function salienteDay(ev) {
  if (ev.type !== 'guardia') return null;
  if (ev.allDay) return addDays(ev.end || ev.start, 1);
  const sd = ymd(new Date(ev.start)), ed = ymd(new Date(ev.end));
  return ed > sd ? ed : null;
}

// ── Utilidades de color ───────────────────────────────────────
function colorOf(ev) { return ev.color || TYPE_COLOR[ev.type] || PERSON_COLOR[ev.owner]; }
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
    const color = colorOf(ev);
    const pending = ev.status === 'pendiente';
    const classNames = [];
    if (pending) classNames.push('ev-pendiente');
    if (ev.status === 'rechazado') classNames.push('ev-rechazado');
    if (ev.type === 'tarea' && ev.taskStatus === 'entregada') classNames.push('ev-hecha');

    out.push({
      id: 'e:' + ev.id,
      title: (pending ? '⏳ ' : '') + TYPE_ICON[ev.type] + ev.title,
      start: ev.allDay ? ev.start.slice(0, 10) : ev.start,
      end: ev.allDay ? addDays(ev.end || ev.start, 1) : (ev.end === ev.start ? null : ev.end),
      allDay: ev.allDay,
      backgroundColor: pending ? alpha(color, 0.18) : color,
      borderColor: color,
      textColor: pending ? 'inherit' : textOn(color),
      classNames,
      extendedProps: { kind: 'event', ref: ev },
    });

    const sd = salienteDay(ev);
    if (sd && sd >= from && sd < to) {
      out.push({
        id: 's:' + ev.id,
        title: '😴 Saliente',
        start: sd, allDay: true,
        backgroundColor: SALIENTE_COLOR, borderColor: SALIENTE_COLOR, textColor: '#991B1B',
        classNames: ['ev-marca'],
        extendedProps: { kind: 'saliente', ref: ev, day: sd },
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
        title: '🔁 ' + s.title,
        start: `${d}T${s.startTime}:00`,
        end: `${d}T${s.endTime}:00`,
        backgroundColor: color, borderColor: color, textColor: textOn(color),
        extendedProps: { kind: 'series', ref: s, day: d },
      });
    }
  }

  // 3. Días libres ("los dos" si están marcados ambos)
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
    ['Curso', TYPE_COLOR.curso], ['Tarea', TYPE_COLOR.tarea], ['Examen', TYPE_COLOR.examen], ['Libre', FREE_COLOR.ambos],
  ];
  $('legend').replaceChildren(...legend.map(([l, c]) => h('span', {}, h('i', { class: 'dot', style: { background: c } }), l)));
}

// Qué hacer al pulsar un elemento del calendario o de una lista
function openItem(p) {
  if (p.kind === 'event') return openEventForm(p.ref);
  if (p.kind === 'series') return openOccurrence(p.ref, p.day);
  if (p.kind === 'saliente') return openDaySheet(p.day);
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

// ── Hoja de un día (al pulsar un día del calendario) ─────────
function openDaySheet(day, time) {
  const items = buildEvents(parseYmd(day), parseYmd(addDays(day, 1)), 'todo')
    .filter((e) => e.extendedProps.kind !== 'free')
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
    ? h('div', { class: 'mini' }, items.map((e) => h('button', { onclick: () => openItem(e.extendedProps) },
        h('i', { class: 'dot', style: { background: e.borderColor } }),
        h('span', { class: 't' }, e.allDay ? 'Día' : hm(new Date(e.start))),
        h('span', {}, e.title))))
    : h('p', { class: 'note' }, 'No hay nada este día.');

  // Estado de "libre" de ese día
  const freeSet = new Set(state.data.free.filter((f) => f.day === day).map((f) => f.person));
  const current = freeSet.size === 2 ? 'ambos' : freeSet.size === 1 ? [...freeSet][0] : 'ninguno';
  const freeBtn = (mode, label) => h('button', {
    class: current === mode ? 'on' : '',
    onclick: (e) => busy(e.currentTarget, async () => { await mutate('Día actualizado', 'setFree', day, mode); closeSheet(); }, '…'),
  }, label);

  const quick = [h('button', { class: 'btn primary', onclick: () => openEventForm(null, { date: day, time }) }, '+ Evento')];
  if (state.me === 'cristina') quick.push(h('button', { class: 'btn', onclick: () => openEventForm(null, { date: day, type: 'guardia' }) }, '+ Guardia'));
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
}

// ── Formulario de evento (crear / editar / ver) ──────────────
function openEventForm(ev, prefill = {}) {
  const isNew = !ev;
  const editable = isNew || canEdit(ev.owner);
  const v = ev
    ? { ...ev }
    : { title: '', owner: state.me, type: prefill.type || 'general', allDay: !prefill.time && !['guardia', 'examen'].includes(prefill.type),
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
  const iTitle = h('input', { value: v.title, maxLength: 120, placeholder: 'Título' });
  const iOwner = h('div', { class: 'seg', style: { margin: 0 } });
  const iType = h('select');
  const iSubject = h('input', { value: v.subject, maxLength: 80, placeholder: 'Ej. Matemáticas II' });
  const iTask = h('select', {}, Object.entries(TASK_LABEL).map(([k, l]) => h('option', { value: k, selected: k === v.taskStatus }, l)));
  const iAllDay = h('input', { type: 'checkbox', checked: v.allDay });
  const iSDate = h('input', { type: 'date', value: sDate });
  const iSTime = h('input', { type: 'time', value: sTime });
  const iEDate = h('input', { type: 'date', value: eDate });
  const iETime = h('input', { type: 'time', value: eTime });
  const iDesc = h('textarea', { placeholder: 'Notas (opcional)' }, v.description || '');
  let color = v.color || '';

  const fOwner = field('¿De quién es?', iOwner);
  const fSubject = field('Asignatura', iSubject);
  const fTask = field('Estado', iTask);
  const fAllDay = h('label', { class: 'check' }, iAllDay, h('span', { id: 'lblAllDay' }, 'Todo el día'));
  const presets = h('div', { class: 'presets' }, GUARDIA_PRESETS.map((p) => h('button', {
    type: 'button', class: 'chip',
    onclick: () => { iSTime.value = p.s; iETime.value = p.e; iEDate.value = addDays(iSDate.value, p.d); },
  }, p.label)));
  const fPresets = field('Tipo de guardia', presets);
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
  });
  iType.addEventListener('change', () => {
    v.type = iType.value;
    if (v.type === 'guardia' && isNew) { const p = GUARDIA_PRESETS[0]; iSTime.value = p.s; iETime.value = p.e; iEDate.value = addDays(iSDate.value, p.d); }
    sync();
  });
  iAllDay.addEventListener('change', sync);

  renderOwner();
  renderTypes();
  if (isNew && v.type === 'guardia') { const p = GUARDIA_PRESETS[0]; iSTime.value = p.s; iETime.value = p.e; iEDate.value = addDays(iSDate.value, p.d); }

  // Recoge y valida el formulario
  function collect() {
    const title = iTitle.value.trim();
    if (!title) throw new Error('Pon un título');
    const type = v.type;
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
      title, owner: v.owner, type, start, end, allDay, color,
      description: iDesc.value.trim(),
      subject: ['tarea', 'examen'].includes(type) ? iSubject.value.trim() : '',
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
    await mutate(data.owner === 'ambos' && isNew ? 'Propuesta enviada' : 'Guardado', 'saveEvent', data);
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
    field('Título', iTitle),
    fOwner,
    field('Tipo', iType),
    fSubject,
    fPresets,
    fAllDay,
    fStart,
    fEnd,
    fTask,
    editable ? field('Color', colorPicker(color, (c) => { color = c; })) : null,
    field('Descripción', iDesc),
    editable ? h('div', { class: 'actions' }, btnSave, btnDel) : null,
  );
  sync();
  if (isNew) iTitle.focus();
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

  const iTitle = h('input', { value: v.title, maxLength: 120, placeholder: 'Ej. Trabajo, Clase, Gimnasio' });
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
    const title = iTitle.value.trim();
    if (!title) throw new Error('Pon un título');
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
function pendingForMe() {
  return state.data.events.filter((e) => e.status === 'pendiente' && e.createdBy !== state.me);
}
function openProposals() {
  const received = pendingForMe();
  const sent = state.data.events.filter((e) => e.owner === 'ambos' && e.createdBy === state.me && e.status !== 'confirmado');
  const row = (ev, side) => h('button', { class: 'item', onclick: () => openEventForm(ev) },
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
  const showPast = $('gPast').checked;
  const now = new Date();
  const list = state.data.events
    .filter((e) => e.owner === 'cristina' && ['guardia', 'continuidad', 'curso'].includes(e.type))
    .filter((e) => showPast || evEnd(e) >= now || (e.allDay && ymd(evEnd(e)) >= today()))
    .sort((a, b) => evStart(a) - evStart(b));

  const box = $('gList');
  if (!list.length) {
    box.replaceChildren(h('p', { class: 'empty' }, state.me === 'cristina' ? 'No hay guardias próximas. Pulsa + para añadir una.' : 'Cristina no tiene guardias próximas.'));
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
          h('span', { class: 'tag', style: { background: alpha(colorOf(ev), 0.15), color: colorOf(ev) } }, TYPE_LABEL[ev.type]),
          hrs ? h('span', { class: 'sub' }, `${hrs} h`) : null));
    })),
  ]));
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
  if (!list.length) {
    box.replaceChildren(h('p', { class: 'empty' }, isTasks ? 'No hay tareas pendientes 🎉' : 'No hay exámenes próximos.'));
    return;
  }

  box.replaceChildren(h('div', { class: 'list', style: { paddingTop: '8px' } }, list.map((ev) => {
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
  renderFab();
}

function switchTab(tab) {
  state.tab = tab;
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
  ['calendar', 'guardias', 'estudios', 'rutinas'].forEach((t) => { $('view-' + t).hidden = t !== tab; });
  if (tab === 'calendar' && calendar) calendar.updateSize();
  renderFab();
}

// El botón + cambia según la pantalla
function renderFab() {
  const fab = $('fab');
  const t = state.tab;
  const show = t === 'calendar' || t === 'rutinas'
    || (t === 'guardias' && state.me === 'cristina')
    || (t === 'estudios' && state.me === 'alejandro');
  fab.hidden = !show;
}
function onFab() {
  const t = state.tab;
  if (t === 'calendar') return openEventForm(null, { date: calendar ? ymd(calendar.getDate()) : today() });
  if (t === 'guardias') return openEventForm(null, { type: 'guardia' });
  if (t === 'estudios') return openEventForm(null, { type: state.estudiosTab === 'tareas' ? 'tarea' : 'examen', time: state.estudiosTab === 'tareas' ? null : '09:00' });
  if (t === 'rutinas') return openSeriesForm(null);
}

function openAccount() {
  openSheet('Cuenta',
    h('div', { class: 'note' }, 'Conectado como ', h('b', {}, NAMES[state.me])),
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
