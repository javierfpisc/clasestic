/* =============================================
   Academia MVP – app.js
   Single-file vanilla JS application
   ============================================= */

'use strict';

// ─── CONSTANTS ───────────────────────────────
const STORAGE_KEY = 'academia_mvp_data';
const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                   'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MONTHS_SHORT = ['ene','feb','mar','abr','may','jun',
                      'jul','ago','sep','oct','nov','dic'];
const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

// ─── STATE ───────────────────────────────────
let state = {
  courses:  [],   // { id, name, description }
  students: [],   // { id, name, phone, course, createdAt, balance, receipts[] }
  classes:  [],   // { id, type, course, date, time, fee, studentIds, gcalEventId? }
  settings: {
    academyName: 'Mi Academia', gcalClientId: '', gcalCalendarId: 'primary',
    githubToken: '', githubRepo: '', githubBranch: 'main', githubFilePath: 'academia_data.json',
  },
  receiptCounter: 0,
  lastModified:   null,
};

let calendarDate = new Date();  // currently viewed month

// Detail modal keeps track of selected class id
let detailClassId = null;

// Confirm callback
let confirmCallback = null;

// ─── UTILS ───────────────────────────────────
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function fmtDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function fmtCurrency(val) {
  const n = parseFloat(val) || 0;
  return n.toFixed(2).replace('.', ',') + ' €';
}

function dayOfWeek(dateStr) {
  if (!dateStr) return '';
  // Parse as local date to avoid UTC offset shifting the day
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay(); // 0=Sun
  return DAYS_ES[dow === 0 ? 6 : dow - 1];    // Mon=0 in our array
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ─── PERSISTENCE ─────────────────────────────
// Save only to localStorage (no timestamp update, no GitHub push).
// Used internally by sync code to avoid re-triggering pushes.
function saveLocalOnly() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    showToast('Error guardando datos', 'error');
  }
}

// Save to localStorage, stamp lastModified, and schedule a GitHub push.
function saveState() {
  state.lastModified = new Date().toISOString();
  saveLocalOnly();
  scheduleGithubPush();
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.students) && Array.isArray(parsed.classes)) {
        state = parsed;
        // backward-compat: old exports may not have courses
        if (!Array.isArray(state.courses)) state.courses = [];
      }
    }
  } catch (e) {
    // corrupt data – start fresh
    state = { courses: [], students: [], classes: [] };
  }
  // backward-compat: ensure new fields exist
  if (!state.settings) state.settings = { academyName: 'Mi Academia', gcalClientId: '', gcalCalendarId: 'primary' };
  if (!state.settings.academyName)    state.settings.academyName    = 'Mi Academia';
  if (!state.settings.gcalCalendarId) state.settings.gcalCalendarId = 'primary';
  if (!state.settings.githubToken)    state.settings.githubToken    = '';
  if (!state.settings.githubRepo)     state.settings.githubRepo     = '';
  if (!state.settings.githubBranch)   state.settings.githubBranch   = 'main';
  if (!state.settings.githubFilePath) state.settings.githubFilePath = 'academia_data.json';
  if (!state.receiptCounter) state.receiptCounter = 0;
  if (!state.lastModified)   state.lastModified   = null;
  state.students.forEach(s => { if (!Array.isArray(s.receipts)) s.receipts = []; });
}

// ─── EXPORT / IMPORT ─────────────────────────
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `academia_mvp_${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Base de datos descargada', 'success');
}

function importData(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed.students) || !Array.isArray(parsed.classes)) {
        showToast('Formato JSON inválido', 'error');
        return;
      }
      if (!Array.isArray(parsed.courses)) parsed.courses = [];
      confirmAction(
        '¿Importar base de datos?',
        'Se reemplazarán todos los datos actuales. Esta acción no se puede deshacer.',
        () => {
          state = parsed;
          saveState();
          renderAll();
          showToast('Datos importados correctamente', 'success');
        }
      );
    } catch {
      showToast('Error al leer el archivo JSON', 'error');
    }
  };
  reader.readAsText(file);
  // reset input so same file can be imported again
  document.getElementById('btn-import').value = '';
}

// ─── TOAST ───────────────────────────────────
let toastTimer = null;
function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast' + (type ? ' ' + type : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.classList.add('hidden'); }, 2600);
}

// ─── CONFIRM DIALOG ──────────────────────────
function confirmAction(title, message, onConfirm) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = onConfirm;
  openModal('modal-confirm');
}

// ─── MODAL HELPERS ───────────────────────────
function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  document.body.style.overflow = '';
}

// ─── NAVIGATION ──────────────────────────────
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  document.querySelector(`.nav-btn[data-tab="${tabName}"]`).classList.add('active');

  if (tabName === 'dashboard') renderDashboard();
  if (tabName === 'students')  renderStudents();
  if (tabName === 'classes')   renderClasses();
  if (tabName === 'calendar')  renderCalendar();  if (tabName === 'courses')   renderCourses();}

// ─── RENDER DASHBOARD ────────────────────────
function renderDashboard() {
  // Stats
  const totalStudents = state.students.length;
  const totalClasses  = state.classes.length;
  const debtors       = state.students.filter(s => s.balance > 0);
  const totalDebt     = debtors.reduce((sum, s) => sum + (parseFloat(s.balance) || 0), 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card stat-primary">
      <span class="stat-label">Alumnos</span>
      <span class="stat-value">${totalStudents}</span>
    </div>
    <div class="stat-card stat-warning">
      <span class="stat-label">Clases</span>
      <span class="stat-value">${totalClasses}</span>
    </div>
    <div class="stat-card stat-danger">
      <span class="stat-label">Con deuda</span>
      <span class="stat-value">${debtors.length}</span>
    </div>
    <div class="stat-card stat-success">
      <span class="stat-label">Deuda total</span>
      <span class="stat-value" style="font-size:1.1rem">${fmtCurrency(totalDebt)}</span>
    </div>
  `;

  // Upcoming classes (today onwards, sorted)
  const today = todayStr();
  const upcoming = state.classes
    .filter(c => c.date >= today)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .slice(0, 5);

  const upcomingEl = document.getElementById('upcoming-classes');
  if (upcoming.length === 0) {
    upcomingEl.innerHTML = `<p class="empty-state" style="padding:20px 0"><small>No hay clases próximas</small></p>`;
  } else {
    upcomingEl.innerHTML = upcoming.map(c => {
      const d = c.date.split('-');
      const names = c.studentIds.map(id => {
        const s = state.students.find(s => s.id === id);
        return s ? s.name.split(' ')[0] : '?';
      }).join(', ');
      return `
        <div class="upcoming-item" data-class-id="${c.id}">
          <div class="upcoming-date-block">
            <div class="day">${d[2]}</div>
            <div class="month">${MONTHS_SHORT[parseInt(d[1]) - 1]}</div>
          </div>
          <div class="upcoming-info">
            <div class="title">${c.course || (c.type === 'individual' ? 'Individual' : 'Grupal')}</div>
            <div class="meta">${c.time} · ${c.studentIds.length} alumno${c.studentIds.length !== 1 ? 's' : ''} · ${names}</div>
          </div>
          <span class="class-type-badge ${c.type}">${c.type}</span>
        </div>`;
    }).join('');
  }

  // Debtors
  const debtorEl = document.getElementById('debtor-students');
  if (debtors.length === 0) {
    debtorEl.innerHTML = `<p class="empty-state" style="padding:20px 0"><small>Sin deudas pendientes 🎉</small></p>`;
  } else {
    const sorted = [...debtors].sort((a, b) => b.balance - a.balance).slice(0, 6);
    debtorEl.innerHTML = sorted.map(s => buildStudentCard(s)).join('');
  }
}

// ─── RENDER STUDENTS ─────────────────────────
function renderStudents() {
  // Populate course filter from state.courses (plus any orphan course names on students)
  const courseNames = [...new Set([
    ...state.courses.map(c => c.name),
    ...state.students.map(s => s.course).filter(Boolean),
  ])].sort();
  const filterEl = document.getElementById('student-filter-course');
  const prevVal = filterEl.value;
  filterEl.innerHTML = `<option value="">Todos los cursos</option>` +
    courseNames.map(c => `<option value="${escHtml(c)}" ${prevVal === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

  applyStudentFilters();
}

function applyStudentFilters() {
  const query  = document.getElementById('student-search').value.toLowerCase().trim();
  const course = document.getElementById('student-filter-course').value;

  let students = state.students;
  if (query)  students = students.filter(s => s.name.toLowerCase().includes(query) || (s.phone || '').includes(query));
  if (course) students = students.filter(s => s.course === course);

  const list = document.getElementById('students-list');
  if (students.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        <p>No hay alumnos registrados</p>
      </div>`;
  } else {
    list.innerHTML = students.map(s => buildStudentCard(s)).join('');
  }
}

function buildStudentCard(s) {
  const balance = parseFloat(s.balance) || 0;
  const isDebt  = balance > 0;
  const pendingReceipts = (s.receipts || []).filter(r => r.status === 'pending');
  return `
    <div class="student-card">
      <div class="student-avatar">${initials(s.name)}</div>
      <div class="student-info">
        <div class="student-name">${escHtml(s.name)}</div>
        <div class="student-meta">${escHtml(s.course || '–')}${s.phone ? ' · ' + escHtml(s.phone) : ''}</div>
        <span class="balance-badge ${isDebt ? 'debt' : 'paid'}">
          ${isDebt ? '⚠ ' + fmtCurrency(balance) : '✓ Al corriente'}
        </span>
        ${pendingReceipts.length > 0 ? `
          <button class="receipt-pending-badge" onclick="openStudentReceipts('${s.id}')">
            📄 ${pendingReceipts.length} recibo${pendingReceipts.length !== 1 ? 's' : ''} pendiente${pendingReceipts.length !== 1 ? 's' : ''}
          </button>` : ''}
      </div>
      <div class="student-actions">
        <button class="btn btn-icon" onclick="openEditStudent('${s.id}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${isDebt ? `<button class="btn btn-sm btn-primary" onclick="generateReceipt('${s.id}')" title="Generar recibo PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Recibo
        </button>` : ''}
        ${(s.receipts || []).length > 0 && !isDebt ? `<button class="btn btn-sm btn-secondary" onclick="openStudentReceipts('${s.id}')">Ver recibos</button>` : ''}
        <button class="btn btn-icon" style="color:var(--danger)" onclick="deleteStudent('${s.id}')" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
}

function markPaid(studentId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  confirmAction(
    'Marcar como pagado',
    `¿Poner a 0 el saldo de ${s.name} (${fmtCurrency(s.balance)})?`,
    () => {
      s.balance = 0;
      saveState();
      renderCurrentTab();
      showToast(`${s.name} marcado como pagado`, 'success');
    }
  );
}

function deleteStudent(studentId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  confirmAction(
    'Eliminar alumno',
    `¿Eliminar a ${s.name}? Se eliminará de todas las clases.`,
    () => {
      state.students = state.students.filter(s => s.id !== studentId);
      state.classes.forEach(c => {
        c.studentIds = c.studentIds.filter(id => id !== studentId);
      });
      state.classes = state.classes.filter(c => c.studentIds.length > 0);
      saveState();
      renderCurrentTab();
      showToast('Alumno eliminado');
    }
  );
}

// ─── STUDENT FORM ────────────────────────────
function openNewStudent() {
  document.getElementById('modal-student-title').textContent = 'Nuevo alumno';
  document.getElementById('student-id').value      = '';
  document.getElementById('student-name').value    = '';
  document.getElementById('student-phone').value   = '';
  document.getElementById('student-balance').value = '0';
  populateCourseSelect('student-course', '');
  openModal('modal-student');
}

function openEditStudent(studentId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  document.getElementById('modal-student-title').textContent = 'Editar alumno';
  document.getElementById('student-id').value      = s.id;
  document.getElementById('student-name').value    = s.name;
  document.getElementById('student-phone').value   = s.phone || '';
  document.getElementById('student-balance').value = parseFloat(s.balance) || 0;
  populateCourseSelect('student-course', s.course || '');
  openModal('modal-student');
}

function saveStudent(e) {
  e.preventDefault();
  const id      = document.getElementById('student-id').value;
  const name    = document.getElementById('student-name').value.trim();
  const phone   = document.getElementById('student-phone').value.trim();
  const course  = document.getElementById('student-course').value;
  const balance = parseFloat(document.getElementById('student-balance').value) || 0;

  if (!name) {
    showToast('El nombre es obligatorio', 'error');
    return;
  }

  if (id) {
    const s = state.students.find(s => s.id === id);
    if (s) { s.name = name; s.phone = phone; s.course = course; s.balance = balance; }
  } else {
    state.students.push({ id: uid(), name, phone, course, createdAt: todayStr(), balance });
  }

  saveState();
  closeModal('modal-student');
  renderCurrentTab();
  showToast(id ? 'Alumno actualizado' : 'Alumno añadido', 'success');
}

// ─── RENDER CLASSES ──────────────────────────
function renderClasses() {
  applyClassFilters();
}

function applyClassFilters() {
  const date = document.getElementById('class-filter-date').value;
  const type = document.getElementById('class-filter-type').value;

  let classes = [...state.classes].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (date) classes = classes.filter(c => c.date === date);
  if (type) classes = classes.filter(c => c.type === type);

  const list = document.getElementById('classes-list');
  if (classes.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
        <p>No hay clases registradas</p>
      </div>`;
  } else {
    list.innerHTML = classes.map(c => buildClassCard(c)).join('');
  }
}

function buildClassCard(c) {
  const studentNames = c.studentIds.map(id => {
    const s = state.students.find(s => s.id === id);
    return s ? s.name.split(' ')[0] : '?';
  });
  const gcalBadge = c.gcalEventId
    ? `<span class="gcal-synced-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> GCal</span>`
    : '';
  return `
    <div class="class-card" onclick="openClassDetail('${c.id}')">
      <div class="class-card-header">
        <span class="class-type-badge ${c.type}">${c.type}</span>
        <span class="class-date-time">
          <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${fmtDate(c.date)} · <span style="font-weight:600">${dayOfWeek(c.date)}</span> · ${c.time}${gcalBadge}
        </span>
      </div>
      <div class="class-course">${escHtml(c.course || '–')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        <div class="class-students-count">
          ${c.studentIds.length} alumno${c.studentIds.length !== 1 ? 's' : ''}:
          ${studentNames.slice(0, 3).join(', ')}${studentNames.length > 3 ? '...' : ''}
        </div>
        <div style="text-align:right">
          <div class="class-fee">${fmtCurrency(c.fee)}<small style="font-weight:400;color:var(--gray-400)"> /alumno</small></div>
          ${c.type === 'grupal' ? `<div style="font-size:0.75rem;font-weight:700;color:var(--gray-600)">Total: ${fmtCurrency(c.fee * c.studentIds.length)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

// ─── CLASS FORM ──────────────────────────────
function openNewClass(prefillDate) {
  document.getElementById('modal-class-title').textContent = 'Nueva clase';
  document.getElementById('class-id').value   = '';
  document.getElementById('class-type').value = 'individual';
  document.getElementById('class-date').value = prefillDate || todayStr();
  document.getElementById('class-time').value = '16:00';
  document.getElementById('class-fee').value  = '';
  populateCourseSelect('class-course', '');
  buildStudentsPicker([]);
  updateClassHint('individual');
  openModal('modal-class');
}

function openEditClass(classId) {
  const c = state.classes.find(c => c.id === classId);
  if (!c) return;
  document.getElementById('modal-class-title').textContent = 'Editar clase';
  document.getElementById('class-id').value   = c.id;
  document.getElementById('class-type').value = c.type;
  document.getElementById('class-date').value = c.date;
  document.getElementById('class-time').value = c.time;
  document.getElementById('class-fee').value  = c.fee;
  populateCourseSelect('class-course', c.course || '');
  buildStudentsPicker(c.studentIds);
  updateClassHint(c.type);
  openModal('modal-class');
}

function buildStudentsPicker(selectedIds) {
  const type       = document.getElementById('class-type').value;
  const courseFilter = document.getElementById('class-course').value;
  const picker     = document.getElementById('class-students-picker');

  // Filter students by course (if one is selected)
  let students = state.students.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (courseFilter) {
    students = students.filter(s => s.course === courseFilter);
  }

  if (students.length === 0) {
    picker.innerHTML = `<p style="color:var(--gray-400);font-size:0.8rem;padding:8px">${
      courseFilter ? 'No hay alumnos en este curso' : 'Sin alumnos registrados'
    }</p>`;
    return;
  }

  picker.innerHTML = students.map(s => {
    const isChecked = selectedIds.includes(s.id);
    const inputType = type === 'individual' ? 'radio' : 'checkbox';
    return `
      <label class="picker-student ${isChecked ? 'selected' : ''}" data-id="${s.id}">
        <input type="${inputType}" name="picker_student" value="${s.id}" ${isChecked ? 'checked' : ''} />
        <div class="picker-check">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="2 6 5 9 10 3"/>
          </svg>
        </div>
        <span class="picker-name">${escHtml(s.name)} <small style="color:var(--gray-400)">(${escHtml(s.course || '–')})</small></span>
      </label>`;
  }).join('');

  // Interaction – e.preventDefault() stops the browser from re-clicking
  // the hidden input (which would bubble back to the label and double-fire)
  picker.querySelectorAll('.picker-student').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const input = el.querySelector('input');
      if (input.type === 'radio') {
        picker.querySelectorAll('.picker-student').forEach(p => p.classList.remove('selected'));
        el.classList.add('selected');
        input.checked = true;
      } else {
        el.classList.toggle('selected');
        input.checked = el.classList.contains('selected');
      }
    });
  });
}

function updateClassHint(type) {
  const hint = document.getElementById('class-students-hint');
  hint.textContent = type === 'individual'
    ? 'Selecciona exactamente un alumno'
    : 'Selecciona uno o más alumnos';
  buildStudentsPicker(getPickerSelected());
}

function updatePickerByCourse() {
  // Rebuild picker preserving current selection (only keeps those still visible)
  buildStudentsPicker(getPickerSelected());
}

function getPickerSelected() {
  return Array.from(
    document.querySelectorAll('#class-students-picker .picker-student.selected')
  ).map(el => el.dataset.id);
}

function saveClass(e) {
  e.preventDefault();
  const id     = document.getElementById('class-id').value;
  const type   = document.getElementById('class-type').value;
  const course = document.getElementById('class-course').value;
  const date   = document.getElementById('class-date').value;
  const time   = document.getElementById('class-time').value;
  const fee    = parseFloat(document.getElementById('class-fee').value);
  const studentIds = getPickerSelected();

  if (!date || !time) { showToast('Fecha y hora obligatorias', 'error'); return; }
  if (isNaN(fee) || fee < 0) { showToast('Cuota inválida', 'error'); return; }
  if (studentIds.length === 0) { showToast('Selecciona al menos un alumno', 'error'); return; }
  if (type === 'individual' && studentIds.length > 1) { showToast('Clase individual: solo 1 alumno', 'error'); return; }

  // Check for time conflict (same date+time, different id)
  const conflict = state.classes.find(c => c.date === date && c.time === time && c.id !== id);
  if (conflict) {
    const label = conflict.course ? `"${conflict.course}"` : `de tipo ${conflict.type}`;
    showToast(`Conflicto: ya hay una clase ${label} a las ${time}`, 'error');
    return;
  }

  if (id) {
    // Editing existing class: first reverse previous fee for these students,
    // then apply new fee
    const existing = state.classes.find(c => c.id === id);
    if (existing) {
      // Reverse old fee
      existing.studentIds.forEach(sid => {
        const s = state.students.find(s => s.id === sid);
        if (s) s.balance = Math.max(0, (parseFloat(s.balance) || 0) - (parseFloat(existing.fee) || 0));
      });
      // Update class
      Object.assign(existing, { type, course, date, time, fee, studentIds });
      // Apply new fee
      studentIds.forEach(sid => {
        const s = state.students.find(s => s.id === sid);
        if (s) s.balance = (parseFloat(s.balance) || 0) + fee;
      });
    }
  } else {
    // New class: add fee to each student balance
    const newId = uid();
    studentIds.forEach(sid => {
      const s = state.students.find(s => s.id === sid);
      if (s) s.balance = (parseFloat(s.balance) || 0) + fee;
    });
    state.classes.push({ id: newId, type, course, date, time, fee, studentIds });
  }

  saveState();
  closeModal('modal-class');
  renderCurrentTab();
  showToast(id ? 'Clase actualizada' : 'Clase creada', 'success');

  // Auto-sync new/updated class to Google Calendar if connected
  if (isGCalConnected()) {
    const savedId = id || state.classes[state.classes.length - 1]?.id;
    const saved   = state.classes.find(c => c.id === savedId);
    if (saved) {
      upsertGCalEvent(saved).then(eventId => {
        if (eventId) {
          saved.gcalEventId = eventId;
          saveState();
          renderCurrentTab();
        }
      });
    }
  }
}

// ─── CLASS DETAIL ────────────────────────────
function openClassDetail(classId) {
  const c = state.classes.find(c => c.id === classId);
  if (!c) return;
  detailClassId = classId;

  const studentChips = c.studentIds.map(id => {
    const s = state.students.find(s => s.id === id);
    return `<span class="detail-student-chip">${s ? escHtml(s.name) : 'Alumno eliminado'}</span>`;
  }).join('');

  document.getElementById('class-detail-content').innerHTML = `
    <div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value"><span class="class-type-badge ${c.type}">${c.type}</span></span></div>
    <div class="detail-row"><span class="detail-label">Fecha</span><span class="detail-value">${fmtDate(c.date)} · ${dayOfWeek(c.date)}</span></div>
    <div class="detail-row"><span class="detail-label">Hora</span><span class="detail-value">${c.time}</span></div>
    <div class="detail-row"><span class="detail-label">Curso</span><span class="detail-value">${escHtml(c.course || '–')}</span></div>
    <div class="detail-row"><span class="detail-label">Cuota/alumno</span><span class="detail-value" style="font-weight:700;color:var(--primary)">${fmtCurrency(c.fee)}</span></div>
    ${c.type === 'grupal' ? `<div class="detail-row"><span class="detail-label">Total clase</span><span class="detail-value" style="font-weight:700;color:var(--gray-800)">${fmtCurrency(c.fee * c.studentIds.length)}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Alumnos</span><span class="detail-value">${studentChips}</span></div>
  `;
  openModal('modal-class-detail');
}

function deleteClass(classId) {
  const c = state.classes.find(c => c.id === classId);
  if (!c) return;
  confirmAction(
    'Eliminar clase',
    `¿Eliminar esta clase? Se restarán ${fmtCurrency(c.fee)} del saldo de cada alumno.`,
    async () => {
      // Remove from Google Calendar if synced
      if (c.gcalEventId) await deleteGCalEvent(c);
      // Reverse fees
      c.studentIds.forEach(sid => {
        const s = state.students.find(s => s.id === sid);
        if (s) s.balance = Math.max(0, (parseFloat(s.balance) || 0) - (parseFloat(c.fee) || 0));
      });
      state.classes = state.classes.filter(cl => cl.id !== classId);
      saveState();
      closeModal('modal-class-detail');
      renderCurrentTab();
      showToast('Clase eliminada');
    }
  );
}

// ─── CALENDAR ────────────────────────────────
function renderCalendar() {
  const year  = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  document.getElementById('cal-month-title').textContent =
    `${MONTHS_ES[month]} ${year}`;

  // First day of month (Mon=0)
  const firstDay = new Date(year, month, 1);
  let startDow = firstDay.getDay(); // 0=Sun
  startDow = startDow === 0 ? 6 : startDow - 1; // convert to Mon=0

  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const daysInPrevMon = new Date(year, month, 0).getDate();

  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);

  // Build a map: dateStr -> classes[]
  const classMap = {};
  state.classes.forEach(c => {
    if (!classMap[c.date]) classMap[c.date] = [];
    classMap[c.date].push(c);
  });

  const grid = document.getElementById('calendar-days');
  let html = '';

  const totalCells = Math.ceil((startDow + daysInMonth) / 7) * 7;

  for (let i = 0; i < totalCells; i++) {
    let dayNum, dateStr, isOther = false;
    if (i < startDow) {
      dayNum  = daysInPrevMon - startDow + 1 + i;
      dateStr = formatDateStr(year, month - 1, dayNum);
      isOther = true;
    } else if (i >= startDow + daysInMonth) {
      dayNum  = i - startDow - daysInMonth + 1;
      dateStr = formatDateStr(year, month + 1, dayNum);
      isOther = true;
    } else {
      dayNum  = i - startDow + 1;
      dateStr = formatDateStr(year, month, dayNum);
    }

    const cellDate = new Date(year, isOther ? (i < startDow ? month - 1 : month + 1) : month, dayNum);
    const isToday  = cellDate.getTime() === todayDate.getTime();
    const classes  = classMap[dateStr] || [];
    const hasClass = classes.length > 0;

    const dots = classes.slice(0, 3).map(c =>
      `<div class="class-dot ${c.type}"></div>`
    ).join('');

    html += `
      <div class="cal-day${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}${hasClass ? ' has-class' : ''}"
           ${hasClass ? `onclick="openDayClasses('${dateStr}')"` : ''}>
        ${dayNum}
        ${dots ? `<div class="cal-dots">${dots}</div>` : ''}
      </div>`;
  }

  grid.innerHTML = html;
}

function formatDateStr(year, month, day) {
  const d = new Date(year, month, day);
  return d.toISOString().slice(0, 10);
}

function openDayClasses(dateStr) {
  const classes = state.classes.filter(c => c.date === dateStr)
    .sort((a, b) => a.time.localeCompare(b.time));
  if (classes.length === 1) {
    openClassDetail(classes[0].id);
    return;
  }
  // Show first class detail (could be improved with a list modal)
  // For now open the first one
  openClassDetail(classes[0].id);
}

// ─── HELPERS ─────────────────────────────────
function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderCurrentTab() {
  const active = document.querySelector('.tab-content.active');
  if (!active) return;
  const tab = active.id.replace('tab-', '');
  if (tab === 'dashboard') renderDashboard();
  if (tab === 'students')  renderStudents();
  if (tab === 'classes')   renderClasses();
  if (tab === 'calendar')  renderCalendar();
  if (tab === 'courses')   renderCourses();
}

function renderAll() {
  renderCurrentTab();
}

// ─── COURSE SELECT HELPER ─────────────────────────────
function populateCourseSelect(selectId, selectedValue) {
  const sel = document.getElementById(selectId);
  const sorted = state.courses.slice().sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = `<option value="">– Sin curso –</option>` +
    sorted.map(c =>
      `<option value="${escHtml(c.name)}" ${selectedValue === c.name ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');
  // If there are orphan course names (old data) not in courses list, add them too
  if (selectedValue && !sorted.find(c => c.name === selectedValue)) {
    sel.innerHTML += `<option value="${escHtml(selectedValue)}" selected>${escHtml(selectedValue)} (sin lista)</option>`;
  }
  if (sorted.length === 0) {
    sel.innerHTML += `<option value="" disabled style="color:var(--gray-400)">— Crea cursos desde la pestaña Cursos —</option>`;
  }
}

// ─── COURSES CRUD ─────────────────────────────────────
function renderCourses() {
  const list = document.getElementById('courses-list');
  if (state.courses.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
          <path d="M6 12v5c3 3 9 3 12 0v-5"/>
        </svg>
        <p>No hay cursos creados</p>
      </div>`;
    return;
  }
  list.innerHTML = state.courses
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(c => {
      const studentCount = state.students.filter(s => s.course === c.name).length;
      const classCount   = state.classes.filter(cl => cl.course === c.name).length;
      return `
        <div class="card">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
            <div style="flex:1;min-width:0">
              <div style="font-size:0.95rem;font-weight:700;color:var(--gray-800)">${escHtml(c.name)}</div>
              ${c.description ? `<div style="font-size:0.78rem;color:var(--gray-500);margin-top:2px">${escHtml(c.description)}</div>` : ''}
              <div style="font-size:0.75rem;color:var(--gray-400);margin-top:5px">
                <span class="detail-student-chip">${studentCount} alumno${studentCount !== 1 ? 's' : ''}</span>
                <span class="detail-student-chip">${classCount} clase${classCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-icon" onclick="openEditCourse('${c.id}')" title="Editar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="btn btn-icon" style="color:var(--danger)" onclick="deleteCourse('${c.id}')" title="Eliminar">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </div>`;
    }).join('');
}

function openNewCourse() {
  document.getElementById('modal-course-title').textContent = 'Nuevo curso';
  document.getElementById('course-id').value          = '';
  document.getElementById('course-name').value        = '';
  document.getElementById('course-description').value = '';
  openModal('modal-course');
}

function openEditCourse(courseId) {
  const c = state.courses.find(c => c.id === courseId);
  if (!c) return;
  document.getElementById('modal-course-title').textContent = 'Editar curso';
  document.getElementById('course-id').value          = c.id;
  document.getElementById('course-name').value        = c.name;
  document.getElementById('course-description').value = c.description || '';
  openModal('modal-course');
}

function saveCourse(e) {
  e.preventDefault();
  const id          = document.getElementById('course-id').value;
  const name        = document.getElementById('course-name').value.trim();
  const description = document.getElementById('course-description').value.trim();

  if (!name) { showToast('El nombre del curso es obligatorio', 'error'); return; }
  const duplicate = state.courses.find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id);
  if (duplicate) { showToast('Ya existe un curso con ese nombre', 'error'); return; }

  if (id) {
    const c = state.courses.find(c => c.id === id);
    if (c) {
      const oldName = c.name;
      c.name = name;
      c.description = description;
      // Rename references in students and classes
      state.students.forEach(s  => { if (s.course   === oldName) s.course   = name; });
      state.classes.forEach(cl  => { if (cl.course  === oldName) cl.course  = name; });
    }
  } else {
    state.courses.push({ id: uid(), name, description });
  }

  saveState();
  closeModal('modal-course');
  renderCurrentTab();
  showToast(id ? 'Curso actualizado' : 'Curso creado', 'success');
}

function deleteCourse(courseId) {
  const c = state.courses.find(c => c.id === courseId);
  if (!c) return;
  const studentCount = state.students.filter(s => s.course === c.name).length;
  const classCount   = state.classes.filter(cl => cl.course === c.name).length;
  const extra = studentCount + classCount > 0
    ? ` Se borrará la referencia en ${studentCount} alumno${studentCount !== 1 ? 's' : ''} y ${classCount} clase${classCount !== 1 ? 's' : ''}.`
    : '';
  confirmAction(
    'Eliminar curso',
    `¿Eliminar el curso “${c.name}”?${extra}`,
    () => {
      state.students.forEach(s  => { if (s.course  === c.name) s.course  = ''; });
      state.classes.forEach(cl  => { if (cl.course === c.name) cl.course = ''; });
      state.courses = state.courses.filter(co => co.id !== courseId);
      saveState();
      renderCurrentTab();
      showToast('Curso eliminado');
    }
  );
}

// ─── GOOGLE CALENDAR ─────────────────────────
let gcalTokenClient = null;
let gcalAccessToken = null;
let gcalAccessExpiry = 0;

function onGISLoaded() {
  initGCalTokenClient();
}

function isGCalConnected() {
  return !!(gcalAccessToken && Date.now() < gcalAccessExpiry);
}

function initGCalTokenClient() {
  const clientId = state.settings?.gcalClientId?.trim();
  if (!clientId || !window.google?.accounts?.oauth2) return;
  gcalTokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: 'https://www.googleapis.com/auth/calendar.events',
    callback: handleGCalToken,
  });
  updateGCalUI();
}

function handleGCalToken(response) {
  if (response.error) {
    showToast('Error Google: ' + (response.error_description || response.error), 'error');
    return;
  }
  gcalAccessToken  = response.access_token;
  gcalAccessExpiry = Date.now() + ((parseInt(response.expires_in, 10) || 3600) - 60) * 1000;
  updateGCalUI();
  showToast('Google Calendar conectado ✓', 'success');
}

function connectGCal() {
  const clientId = state.settings?.gcalClientId?.trim();
  if (!clientId) {
    showToast('Introduce primero el Client ID en Ajustes', 'error');
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    showToast('El SDK de Google aún no está cargado, espera un momento', 'error');
    return;
  }
  if (!gcalTokenClient) initGCalTokenClient();
  gcalTokenClient.requestAccessToken({ prompt: '' });
}

function disconnectGCal() {
  if (gcalAccessToken && window.google?.accounts?.oauth2) {
    google.accounts.oauth2.revoke(gcalAccessToken, () => {});
  }
  gcalAccessToken  = null;
  gcalAccessExpiry = 0;
  gcalTokenClient  = null;
  updateGCalUI();
  showToast('Desconectado de Google Calendar');
}

function updateGCalUI() {
  const connected = isGCalConnected();
  const headerDot = document.getElementById('gcal-dot');
  if (headerDot) headerDot.className = 'gcal-dot ' + (connected ? 'connected' : 'disconnected');

  const syncBtn = document.getElementById('btn-gcal-sync');
  if (syncBtn) syncBtn.classList.toggle('hidden', !connected);

  const settingsDot    = document.getElementById('settings-gcal-dot');
  const settingsLabel  = document.getElementById('settings-gcal-label');
  const connectBtn     = document.getElementById('btn-gcal-connect');
  const disconnectBtn  = document.getElementById('btn-gcal-disconnect');
  if (settingsDot)   settingsDot.className    = 'gcal-dot ' + (connected ? 'connected' : 'disconnected');
  if (settingsLabel) settingsLabel.textContent = connected ? 'Conectado' : 'Desconectado';
  if (connectBtn)    connectBtn.classList.toggle('hidden', connected);
  if (disconnectBtn) disconnectBtn.classList.toggle('hidden', !connected);
}

async function syncAllToGCal() {
  if (!isGCalConnected()) { showToast('Conecta primero Google Calendar', 'error'); return; }
  const today  = todayStr();
  const toSync = state.classes.filter(c => c.date >= today);
  if (toSync.length === 0) { showToast('No hay clases futuras para sincronizar'); return; }

  showToast(`Sincronizando ${toSync.length} clase${toSync.length !== 1 ? 's' : ''}…`);
  let synced = 0;
  for (const cls of toSync) {
    const eventId = await upsertGCalEvent(cls);
    if (eventId) { cls.gcalEventId = eventId; synced++; }
    if (!isGCalConnected()) break;
  }
  if (synced > 0) {
    saveState();
    renderCalendar();
    showToast(`${synced} clase${synced !== 1 ? 's' : ''} sincronizada${synced !== 1 ? 's' : ''} ✓`, 'success');
  }
}

async function upsertGCalEvent(cls) {
  const calendarId = encodeURIComponent(state.settings?.gcalCalendarId || 'primary');
  const timeZone   = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const startDt    = new Date(`${cls.date}T${cls.time}:00`);
  const endDt      = new Date(startDt.getTime() + 60 * 60 * 1000);

  const studentNames = cls.studentIds.map(id => {
    const s = state.students.find(s => s.id === id);
    return s ? s.name : '?';
  }).join(', ');

  const event = {
    summary:     `Clase ${cls.type === 'individual' ? 'individual' : 'grupal'}${cls.course ? ' · ' + cls.course : ''}`,
    description: `Alumnos: ${studentNames}\nCuota: ${fmtCurrency(cls.fee)}/alumno`,
    start: { dateTime: startDt.toISOString(), timeZone },
    end:   { dateTime: endDt.toISOString(),   timeZone },
    colorId: cls.type === 'individual' ? '1' : '5',
  };

  try {
    let url, method;
    if (cls.gcalEventId) {
      url    = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(cls.gcalEventId)}`;
      method = 'PUT';
    } else {
      url    = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
      method = 'POST';
    }
    const res = await fetch(url, {
      method,
      headers: { 'Authorization': `Bearer ${gcalAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    if (res.status === 401) {
      gcalAccessToken = null; gcalAccessExpiry = 0;
      updateGCalUI();
      showToast('Sesión de Google expirada, reconecta', 'error');
      return null;
    }
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch {
    return null;
  }
}

async function deleteGCalEvent(cls) {
  if (!cls.gcalEventId || !isGCalConnected()) return;
  const calendarId = encodeURIComponent(state.settings?.gcalCalendarId || 'primary');
  try {
    await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(cls.gcalEventId)}`,
      { method: 'DELETE', headers: { 'Authorization': `Bearer ${gcalAccessToken}` } }
    );
  } catch { /* ignore */ }
}

// ─── GITHUB SYNC ─────────────────────────────
let githubFileSha   = null;   // SHA of the current remote file (required for updates)
let githubSyncTimer = null;   // debounce timer
let githubSyncing   = false;  // prevent concurrent pushes
let githubLastSync  = null;   // Date of last successful push
let githubStatus    = 'unconfigured';

function getGithubConfig() {
  const s        = state.settings;
  const token    = s?.githubToken?.trim();
  const repo     = s?.githubRepo?.trim();
  const branch   = s?.githubBranch?.trim()   || 'main';
  const filePath = s?.githubFilePath?.trim() || 'academia_data.json';
  if (!token || !repo) return null;
  return { token, repo, branch, filePath };
}

function githubApiHeaders(token) {
  return {
    'Authorization':       `Bearer ${token}`,
    'Accept':              'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type':        'application/json',
  };
}

// UTF-8 safe base64 encode — strips local-only credentials before upload
function stateToBase64() {
  const safe = Object.assign({}, state, {
    settings: Object.assign({}, state.settings, {
      githubToken:  '',   // never stored remotely
      gcalClientId: '',   // OAuth client ID stays local
    }),
  });
  return btoa(unescape(encodeURIComponent(JSON.stringify(safe, null, 2))));
}

// UTF-8 safe base64 decode
function base64ToObj(b64) {
  return JSON.parse(decodeURIComponent(escape(atob(b64.replace(/\n/g, '')))));
}

function setGithubStatus(status) {
  githubStatus = status;
  const dot = document.getElementById('github-sync-dot');
  if (!dot) return;
  dot.className = `github-sync-dot ${status}`;
  const labels = {
    unconfigured: 'GitHub Sync no configurado (Ajustes)',
    ok:      `Sincronizado${githubLastSync ? ' ' + githubLastSync.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : ''}`,
    pending: 'Pendiente de sincronizar\u2026',
    syncing: 'Sincronizando con GitHub\u2026',
    error:   'Error de sincronizaci\u00f3n con GitHub',
  };
  dot.title = labels[status] || status;
  // Update settings modal indicator if open
  const settingsDot   = document.getElementById('settings-github-dot');
  const settingsLabel = document.getElementById('settings-github-label');
  if (settingsDot)   settingsDot.className    = 'gcal-dot ' + (status === 'ok' ? 'connected' : 'disconnected');
  if (settingsLabel) settingsLabel.textContent = labels[status] || status;
}

// Pull remote state from GitHub and reconcile with local
async function githubPull() {
  const cfg = getGithubConfig();
  if (!cfg) return false;

  setGithubStatus('syncing');
  try {
    const filePath = cfg.filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${filePath}?ref=${encodeURIComponent(cfg.branch)}`;
    const res = await fetch(url, { headers: githubApiHeaders(cfg.token) });

    if (res.status === 404) {
      // File not yet in repo — first run, local state is the source of truth
      githubFileSha = null;
      setGithubStatus('ok');
      return true;
    }
    if (res.status === 401 || res.status === 403) {
      setGithubStatus('error');
      showToast('GitHub: acceso denegado. Revisa el token.', 'error');
      return false;
    }
    if (!res.ok) {
      setGithubStatus('error');
      showToast(`GitHub pull error ${res.status}`, 'error');
      return false;
    }

    const data    = await res.json();
    githubFileSha = data.sha;
    const remote  = base64ToObj(data.content);
    reconcileWithRemote(remote);
    return true;
  } catch (e) {
    setGithubStatus('error');
    return false;
  }
}

// Merge remote state into local according to timestamps
function reconcileWithRemote(remote) {
  if (!remote || typeof remote !== 'object') return;

  const localTs  = state.lastModified  ? new Date(state.lastModified).getTime()  : 0;
  const remoteTs = remote.lastModified ? new Date(remote.lastModified).getTime() : 0;

  if (remoteTs > localTs) {
    // Remote is newer — adopt it, but keep local GitHub credentials
    const localGhCreds = {
      githubToken:    state.settings?.githubToken    || '',
      githubRepo:     state.settings?.githubRepo     || '',
      githubBranch:   state.settings?.githubBranch   || 'main',
      githubFilePath: state.settings?.githubFilePath || 'academia_data.json',
    };
    state.courses        = Array.isArray(remote.courses)  ? remote.courses  : [];
    state.students       = Array.isArray(remote.students) ? remote.students : [];
    state.classes        = Array.isArray(remote.classes)  ? remote.classes  : [];
    state.receiptCounter = remote.receiptCounter || 0;
    state.lastModified   = remote.lastModified;
    state.settings       = Object.assign({}, remote.settings || {}, localGhCreds);
    // Ensure compat fields
    state.students.forEach(s => { if (!Array.isArray(s.receipts)) s.receipts = []; });
    saveLocalOnly();
    renderAll();
    showToast('Datos actualizados desde GitHub \u2713', 'success');
  } else {
    // Local is same age or newer — merge in any remote-only records
    const localCourseIds  = new Set((state.courses  || []).map(c  => c.id));
    const localStudentIds = new Set((state.students || []).map(s  => s.id));
    const localClassIds   = new Set((state.classes  || []).map(cl => cl.id));
    let changed = false;
    (remote.courses  || []).forEach(c  => { if (!localCourseIds.has(c.id))  { state.courses.push(c);  changed = true; } });
    (remote.students || []).forEach(s  => {
      if (!localStudentIds.has(s.id)) {
        if (!s.receipts) s.receipts = [];
        state.students.push(s);
        changed = true;
      }
    });
    (remote.classes  || []).forEach(cl => { if (!localClassIds.has(cl.id))  { state.classes.push(cl); changed = true; } });
    state.receiptCounter = Math.max(state.receiptCounter || 0, remote.receiptCounter || 0);
    if (changed) {
      saveLocalOnly();
      renderAll();
      showToast('Cambios remotos incorporados', 'success');
    }
    // Local is newer or equal — push our version to GitHub
    scheduleGithubPush();
  }
  setGithubStatus('ok');
}

// Schedule a debounced push (2 s after last saveState)
function scheduleGithubPush() {
  if (!getGithubConfig()) return;
  setGithubStatus('pending');
  clearTimeout(githubSyncTimer);
  githubSyncTimer = setTimeout(githubPush, 2000);
}

// Push current state to GitHub
async function githubPush(retry) {
  const cfg = getGithubConfig();
  if (!cfg || githubSyncing) return;

  githubSyncing = true;
  setGithubStatus('syncing');

  const content = stateToBase64();
  const body    = {
    message: `sync ${new Date().toLocaleString('es')}`,
    content,
    branch:  cfg.branch,
  };
  if (githubFileSha) body.sha = githubFileSha;

  try {
    const filePath = cfg.filePath.split('/').map(encodeURIComponent).join('/');
    const url = `https://api.github.com/repos/${cfg.repo}/contents/${filePath}`;
    const res = await fetch(url, {
      method:  'PUT',
      headers: githubApiHeaders(cfg.token),
      body:    JSON.stringify(body),
    });

    if (res.status === 409 && !retry) {
      // SHA mismatch: another device pushed first — pull, reconcile, then push again
      githubSyncing = false;
      const pulled = await githubPull();
      if (pulled) await githubPush(true);
      return;
    }
    if (res.status === 401 || res.status === 403) {
      githubSyncing = false;
      setGithubStatus('error');
      showToast('GitHub: acceso denegado. Revisa el token.', 'error');
      return;
    }
    if (!res.ok) {
      githubSyncing = false;
      setGithubStatus('error');
      showToast(`GitHub push error ${res.status}`, 'error');
      return;
    }

    const data    = await res.json();
    githubFileSha = data.content?.sha || githubFileSha;
    githubSyncing = false;
    githubLastSync = new Date();
    setGithubStatus('ok');
  } catch (e) {
    githubSyncing = false;
    setGithubStatus('error');
  }
}

// Manual sync triggered by the header button
async function manualGithubSync() {
  const cfg = getGithubConfig();
  if (!cfg) {
    showToast('Configura GitHub en Ajustes primero', 'error');
    return;
  }
  await githubPull();
}

// Connection test triggered from settings modal
async function testGithubConnection() {
  const token    = document.getElementById('settings-gh-token').value.trim();
  const repo     = document.getElementById('settings-gh-repo').value.trim();
  const branch   = document.getElementById('settings-gh-branch').value.trim() || 'main';
  const filePath = (document.getElementById('settings-gh-path').value.trim() || 'academia_data.json')
    .split('/').map(encodeURIComponent).join('/');

  if (!token || !repo) {
    showToast('Introduce token y repositorio', 'error');
    return;
  }

  const settingsLabel = document.getElementById('settings-github-label');
  const settingsDot   = document.getElementById('settings-github-dot');
  if (settingsLabel) settingsLabel.textContent = 'Comprobando\u2026';

  try {
    const url = `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: githubApiHeaders(token) });
    if (res.status === 200 || res.status === 404) {
      if (settingsLabel) settingsLabel.textContent = res.status === 200 ? 'Conexi\u00f3n OK \u2713' : 'Repositorio encontrado (archivo se crear\u00e1 al guardar)';
      if (settingsDot)   settingsDot.className = 'gcal-dot connected';
      showToast('Conexi\u00f3n con GitHub correcta \u2713', 'success');
    } else if (res.status === 401 || res.status === 403) {
      if (settingsLabel) settingsLabel.textContent = 'Acceso denegado';
      if (settingsDot)   settingsDot.className = 'gcal-dot disconnected';
      showToast('GitHub: token sin permisos o incorrecto', 'error');
    } else {
      if (settingsLabel) settingsLabel.textContent = `Error ${res.status}`;
      showToast(`GitHub error ${res.status}`, 'error');
    }
  } catch (e) {
    if (settingsLabel) settingsLabel.textContent = 'Error de red';
    showToast('Error de red al conectar con GitHub', 'error');
  }
}

// ─── SETTINGS MODAL ──────────────────────────
function openSettingsModal() {
  document.getElementById('settings-academy-name').value      = state.settings?.academyName    || '';
  document.getElementById('settings-gcal-client-id').value    = state.settings?.gcalClientId   || '';
  document.getElementById('settings-gcal-calendar-id').value  = state.settings?.gcalCalendarId || 'primary';
  document.getElementById('settings-gh-token').value  = state.settings?.githubToken    || '';
  document.getElementById('settings-gh-repo').value   = state.settings?.githubRepo     || '';
  document.getElementById('settings-gh-branch').value = state.settings?.githubBranch   || 'main';
  document.getElementById('settings-gh-path').value   = state.settings?.githubFilePath || 'academia_data.json';
  updateGCalUI();
  setGithubStatus(githubStatus);
  openModal('modal-settings');
}

function saveSettings() {
  const academyName    = document.getElementById('settings-academy-name').value.trim();
  const gcalClientId   = document.getElementById('settings-gcal-client-id').value.trim();
  const gcalCalendarId = document.getElementById('settings-gcal-calendar-id').value.trim() || 'primary';
  const githubToken    = document.getElementById('settings-gh-token').value.trim();
  const githubRepo     = document.getElementById('settings-gh-repo').value.trim();
  const githubBranch   = document.getElementById('settings-gh-branch').value.trim()  || 'main';
  const githubFilePath = document.getElementById('settings-gh-path').value.trim()    || 'academia_data.json';
  state.settings = {
    academyName: academyName || 'Mi Academia',
    gcalClientId, gcalCalendarId,
    githubToken, githubRepo, githubBranch, githubFilePath,
  };
  // Reset SHA so next push re-fetches it if repo changed
  githubFileSha = null;
  saveState();
  closeModal('modal-settings');
  showToast('Ajustes guardados', 'success');
  gcalTokenClient = null;
  initGCalTokenClient();
  setGithubStatus(getGithubConfig() ? 'pending' : 'unconfigured');
}

// ─── RECEIPTS ────────────────────────────────
function generateReceipt(studentId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  const balance = parseFloat(s.balance) || 0;
  if (balance <= 0) { showToast('Este alumno no tiene saldo pendiente', 'error'); return; }

  const hasPending = (s.receipts || []).some(r => r.status === 'pending');
  if (hasPending) {
    confirmAction(
      'Ya existe un recibo pendiente',
      `${s.name} ya tiene un recibo sin descargar. ¿Generar uno nuevo de todas formas?`,
      () => doGenerateReceipt(s)
    );
  } else {
    doGenerateReceipt(s);
  }
}

function doGenerateReceipt(s) {
  state.receiptCounter = (state.receiptCounter || 0) + 1;
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seq   = String(state.receiptCounter).padStart(3, '0');

  const receipt = {
    id:          uid(),
    number:      `${year}${month}-${seq}`,
    generatedAt: todayStr(),
    amount:      parseFloat(s.balance) || 0,
    status:      'pending',
    printedAt:   null,
  };
  if (!s.receipts) s.receipts = [];
  s.receipts.push(receipt);
  saveState();
  renderCurrentTab();
  showToast(`Recibo ${receipt.number} generado`, 'success');
  openStudentReceipts(s.id);
}

function openStudentReceipts(studentId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  renderReceiptsModal(s);
  openModal('modal-receipts');
}

function renderReceiptsModal(s) {
  document.getElementById('receipts-student-name').textContent = s.name;
  const receipts  = (s.receipts || []).slice().reverse();
  const container = document.getElementById('receipts-list');

  if (receipts.length === 0) {
    container.innerHTML = `<p class="empty-state" style="padding:20px 0;text-align:center">No hay recibos generados</p>`;
    return;
  }

  container.innerHTML = receipts.map(r => `
    <div class="receipt-item ${r.status}">
      <div class="receipt-item-header">
        <span class="receipt-number">Nº ${escHtml(r.number)}</span>
        <span class="receipt-status-badge ${r.status}">${r.status === 'pending' ? 'Pendiente' : 'Cobrado'}</span>
      </div>
      <div class="receipt-item-body">
        <div>
          <div class="receipt-date">Generado: ${fmtDate(r.generatedAt)}</div>
          ${r.printedAt ? `<div class="receipt-date" style="color:var(--success)">Cobrado: ${fmtDate(r.printedAt)}</div>` : ''}
        </div>
        <div class="receipt-amount">${fmtCurrency(r.amount)}</div>
      </div>
      ${r.status === 'pending' ? `
        <div class="receipt-item-actions">
          <button class="btn btn-sm btn-secondary" onclick="cancelReceipt('${s.id}','${r.id}')">Cancelar</button>
          <button class="btn btn-sm btn-primary" onclick="downloadReceiptPdf('${s.id}','${r.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar PDF y marcar pagado
          </button>
        </div>` : ''}
    </div>`).join('');
}

function cancelReceipt(studentId, receiptId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r || r.status !== 'pending') return;
  confirmAction('Cancelar recibo', `¿Cancelar el recibo ${r.number}?`, () => {
    s.receipts = s.receipts.filter(r => r.id !== receiptId);
    saveState();
    renderReceiptsModal(s);
    renderCurrentTab();
    showToast(`Recibo ${r.number} cancelado`);
  });
}

function downloadReceiptPdf(studentId, receiptId) {
  const s = state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r) return;

  if (!window.jspdf?.jsPDF) { showToast('La librería PDF no está disponible', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc      = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const margin   = 14;
  const contentW = pageW - margin * 2;
  const academyName = state.settings?.academyName || 'Academia';

  // Header band
  doc.setFillColor(79, 70, 229);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(academyName, margin, 12);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('RECIBO DE PAGO', margin, 20);
  doc.setFontSize(9);
  doc.text(`N\xba ${r.number}`, pageW - margin, 12, { align: 'right' });
  doc.text(fmtDate(r.generatedAt), pageW - margin, 20, { align: 'right' });

  // Student block
  let y = 38;
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(margin, y, contentW, 26, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('DATOS DEL ALUMNO', margin + 4, y + 6);
  doc.setFontSize(12);
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.text(s.name, margin + 4, y + 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  const meta = [s.course, s.phone].filter(Boolean).join('  \xb7  ');
  if (meta) doc.text(meta, margin + 4, y + 21);

  // Amount block
  y += 34;
  doc.setFillColor(224, 231, 255);
  doc.roundedRect(margin, y, contentW, 22, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.setFont('helvetica', 'bold');
  doc.text('IMPORTE', margin + 4, y + 6);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text(fmtCurrency(r.amount), margin + 4, y + 17);

  // Concept
  y += 30;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('CONCEPTO', margin + 4, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text('Clases recibidas' + (s.course ? '  \xb7  ' + s.course : ''), margin + 4, y + 7);

  // Divider
  y += 18;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageW - margin, y);

  // Footer
  y += 7;
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Este recibo acredita el pago de las clases indicadas.', margin, y);

  // Signature area
  const sigY = pageH - 20;
  doc.setDrawColor(209, 213, 219);
  doc.setLineWidth(0.3);
  doc.line(margin, sigY, margin + 48, sigY);
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175);
  doc.text('Firma / Sello', margin, sigY + 5);

  doc.save(`recibo_${r.number}_${s.name.replace(/\s+/g, '_')}.pdf`);

  // Mark printed and update balance
  r.status    = 'printed';
  r.printedAt = todayStr();
  s.balance   = Math.max(0, (parseFloat(s.balance) || 0) - r.amount);

  saveState();
  renderReceiptsModal(s);
  renderCurrentTab();
  showToast(`Recibo ${r.number} descargado \xb7 saldo actualizado`, 'success');
}

// ─── EVENT LISTENERS ─────────────────────────
function initEvents() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Export / Import
  document.getElementById('btn-export').addEventListener('click', exportData);
  document.getElementById('btn-import-trigger').addEventListener('click', () =>
    document.getElementById('btn-import').click()
  );
  document.getElementById('btn-import').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });

  // Course form
  document.getElementById('btn-new-course').addEventListener('click', openNewCourse);
  document.getElementById('form-course').addEventListener('submit', saveCourse);

  // Student form
  document.getElementById('btn-new-student').addEventListener('click', openNewStudent);
  document.getElementById('form-student').addEventListener('submit', saveStudent);

  // Student filters
  document.getElementById('student-search').addEventListener('input', applyStudentFilters);
  document.getElementById('student-filter-course').addEventListener('change', applyStudentFilters);

  // Class form
  document.getElementById('btn-new-class').addEventListener('click', () => openNewClass());
  document.getElementById('form-class').addEventListener('submit', saveClass);
  document.getElementById('class-type').addEventListener('change', (e) => updateClassHint(e.target.value));
  document.getElementById('class-course').addEventListener('change', updatePickerByCourse);

  // Class filters
  document.getElementById('class-filter-date').addEventListener('change', applyClassFilters);
  document.getElementById('class-filter-type').addEventListener('change', applyClassFilters);

  // Class detail actions
  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    closeModal('modal-class-detail');
    openEditClass(detailClassId);
  });
  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    closeModal('modal-class-detail');
    deleteClass(detailClassId);
  });

  // Calendar nav
  document.getElementById('cal-prev').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() - 1);
    renderCalendar();
  });
  document.getElementById('cal-next').addEventListener('click', () => {
    calendarDate.setMonth(calendarDate.getMonth() + 1);
    renderCalendar();
  });

  // Dashboard: upcoming class click
  document.getElementById('upcoming-classes').addEventListener('click', (e) => {
    const item = e.target.closest('[data-class-id]');
    if (item) openClassDetail(item.dataset.classId);
  });

  // Debtor student click → edit
  document.getElementById('debtor-students').addEventListener('click', (e) => {
    const btn = e.target.closest('[onclick]');
    if (btn) return; // let inline handlers work
  });

  // Modal: close buttons & backdrop
  document.querySelectorAll('.modal-close, [data-modal]').forEach(el => {
    el.addEventListener('click', () => closeModal(el.dataset.modal));
  });
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', () => {
      const modal = backdrop.closest('.modal');
      if (modal) closeModal(modal.id);
    });
  });

  // Confirm modal
  document.getElementById('confirm-ok').addEventListener('click', () => {
    closeModal('modal-confirm');
    if (typeof confirmCallback === 'function') {
      confirmCallback();
      confirmCallback = null;
    }
  });
  document.getElementById('confirm-cancel').addEventListener('click', () => {
    closeModal('modal-confirm');
    confirmCallback = null;
  });
}

// ─── INIT ─────────────────────────────────────
function init() {
  loadState();
  initEvents();
  initGCalTokenClient();
  updateGCalUI();
  setGithubStatus(getGithubConfig() ? 'pending' : 'unconfigured');
  renderDashboard();
  // Pull from GitHub in background after render
  githubPull();
}

document.addEventListener('DOMContentLoaded', init);
