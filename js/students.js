/* =============================================
   Students Module
   Student list, form, CRUD operations
   ============================================= */

window.App = window.App || {};

window.App.renderStudents = function() {
  // Populate course filter from window.App.state.courses (plus any orphan course names on students)
  const courseNames = [...new Set([
    ...window.App.state.courses.map(c => c.name),
    ...window.App.state.students.map(s => s.course).filter(Boolean),
  ])].sort();
  const filterEl = document.getElementById('student-filter-course');
  const prevVal = filterEl.value;
  filterEl.innerHTML = `<option value="">Todos los cursos</option>` +
    courseNames.map(c => `<option value="${window.App.escHtml(c)}" ${prevVal === c ? 'selected' : ''}>${window.App.escHtml(c)}</option>`).join('');

  window.App.applyStudentFilters();
};

window.App.applyStudentFilters = function() {
  const query  = document.getElementById('student-search').value.toLowerCase().trim();
  const course = document.getElementById('student-filter-course').value;

  let students = window.App.state.students;
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
    list.innerHTML = students.map(s => window.App.buildStudentCard(s)).join('');
  }
}

window.App.buildStudentCard = function(s) {
  const balance = parseFloat(s.balance) || 0;
  const isDebt  = balance > 0;
  const pendingReceipts = (s.receipts || []).filter(r => r.status === 'pending');
  return `
    <div class="student-card">
      <div class="student-avatar">${window.App.initials(s.name)}</div>
      <div class="student-info">
        <div class="student-name">${window.App.escHtml(s.name)}</div>
        <div class="student-meta">${window.App.escHtml(s.course || '–')}${s.phone ? ' · ' + window.App.escHtml(s.phone) : ''}</div>
        <span class="balance-badge ${isDebt ? 'debt' : 'paid'}">
          ${isDebt ? '⚠ ' + window.App.fmtCurrency(balance) : '✓ Al corriente'}
        </span>
        ${pendingReceipts.length > 0 ? `
          <button class="receipt-pending-badge" onclick="window.openStudentReceipts('${s.id}')">
            📄 ${pendingReceipts.length} recibo${pendingReceipts.length !== 1 ? 's' : ''} pendiente${pendingReceipts.length !== 1 ? 's' : ''}
          </button>` : ''}
      </div>
      <div class="student-actions">
        <button class="btn btn-icon" onclick="window.openEditStudent('${s.id}')" title="Editar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        ${isDebt ? `<button class="btn btn-sm btn-primary" onclick="window.generateReceipt('${s.id}')" title="Generar recibo PDF">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          Recibo
        </button>` : ''}
        ${(s.receipts || []).length > 0 && !isDebt ? `<button class="btn btn-sm btn-secondary" onclick="window.openStudentReceipts('${s.id}')">Ver recibos</button>` : ''}
        <button class="btn btn-icon" style="color:var(--danger)" onclick="window.deleteStudent('${s.id}')" title="Eliminar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
        </button>
      </div>
    </div>`;
}

window.App.openNewStudent = function() {
  document.getElementById('modal-student-title').textContent = 'Nuevo alumno';
  document.getElementById('student-id').value      = '';
  document.getElementById('student-name').value    = '';
  document.getElementById('student-phone').value   = '';
  document.getElementById('student-balance').value = '0';
  populateCourseSelect('student-course', '');
  window.App.openModal('modal-student');
}

window.App.openEditStudent = function(studentId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  document.getElementById('modal-student-title').textContent = 'Editar alumno';
  document.getElementById('student-id').value      = s.id;
  document.getElementById('student-name').value    = s.name;
  document.getElementById('student-phone').value   = s.phone || '';
  document.getElementById('student-balance').value = parseFloat(s.balance) || 0;
  populateCourseSelect('student-course', s.course || '');
  window.App.openModal('modal-student');
}

window.App.saveStudent = function(e) {
  e.preventDefault();
  const id      = document.getElementById('student-id').value;
  const name    = document.getElementById('student-name').value.trim();
  const phone   = document.getElementById('student-phone').value.trim();
  const course  = document.getElementById('student-course').value;
  const balance = parseFloat(document.getElementById('student-balance').value) || 0;

  if (!name) {
    window.App.showToast('El nombre es obligatorio', 'error');
    return;
  }

  if (id) {
    const s = window.App.state.students.find(s => s.id === id);
    if (s) { s.name = name; s.phone = phone; s.course = course; s.balance = balance; }
  } else {
    window.App.state.students.push({ 
      id: window.App.uid(), 
      name, 
      phone, 
      course, 
      createdAt: window.App.todayStr(), 
      balance,
      receipts: []
    });
  }

  window.App.saveState();
  window.App.closeModal('modal-student');
  window.App.renderCurrentTab();
  window.App.showToast(id ? 'Alumno actualizado' : 'Alumno añadido', 'success');
}

window.App.deleteStudent = function(studentId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  window.App.confirmAction(
    'Eliminar alumno',
    `¿Eliminar a ${s.name}? Se eliminará de todas las clases.`,
    () => {
      window.App.state.students = window.App.state.students.filter(s => s.id !== studentId);
      window.App.state.classes.forEach(c => {
        c.studentIds = c.studentIds.filter(id => id !== studentId);
      });
      window.App.state.classes = window.App.state.classes.filter(c => c.studentIds.length > 0);
      window.App.saveState();
      window.App.renderCurrentTab();
      window.App.showToast('Alumno eliminado');
    }
  );
}

function populateCourseSelect(selectId, selectedValue) {
  const sel = document.getElementById(selectId);
  const sorted = window.App.state.courses.slice().sort((a, b) => a.name.localeCompare(b.name));
  sel.innerHTML = `<option value="">– Sin curso –</option>` +
    sorted.map(c =>
      `<option value="${window.App.escHtml(c.name)}" ${selectedValue === c.name ? 'selected' : ''}>${window.App.escHtml(c.name)}</option>`
    ).join('');
  // If there are orphan course names (old data) not in courses list, add them too
  if (selectedValue && !sorted.find(c => c.name === selectedValue)) {
    sel.innerHTML += `<option value="${window.App.escHtml(selectedValue)}" selected>${window.App.escHtml(selectedValue)} (sin lista)</option>`;
  }
  if (sorted.length === 0) {
    sel.innerHTML += `<option value="" disabled style="color:var(--gray-400)">— Crea cursos desde la pestaña Cursos —</option>`;
  }
}

// Initialize student events
window.App.initStudentEvents = function() {
  document.getElementById('btn-new-student').addEventListener('click', window.App.openNewStudent);
  document.getElementById('form-student').addEventListener('submit', window.App.saveStudent);
  document.getElementById('student-search').addEventListener('input', window.App.applyStudentFilters);
  document.getElementById('student-filter-course').addEventListener('change', window.App.applyStudentFilters);
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.openEditStudent = window.App.openEditStudent;
  window.deleteStudent = window.App.deleteStudent;
}
