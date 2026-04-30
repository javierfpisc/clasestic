/* =============================================
   Classes Module
   Class list, form, CRUD operations
   ============================================= */

window.App = window.App || {};

window.App.renderClasses = function() {
  window.App.applyClassFilters();
}

window.App.applyClassFilters = function() {
  const date        = document.getElementById('class-filter-date').value;
  const type        = document.getElementById('class-filter-type').value;
  const onlyFuture  = document.getElementById('class-filter-future').checked;

  let classes = [...window.App.state.classes].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  if (onlyFuture) {
    const today = window.App.todayStr();
    const nowTime = window.App.currentTimeStr();
    classes = classes.filter(c => c.date > today || (c.date === today && c.time >= nowTime));
  }
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
    const s = window.App.state.students.find(s => s.id === id);
    return s ? s.name.split(' ')[0] : '?';
  });
  const gcalBadge = c.gcalEventId
    ? `<span class="gcal-synced-badge"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:10px;height:10px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> GCal</span>`
    : '';
  return `
    <div class="class-card" onclick="window.openClassDetail('${c.id}')">
      <div class="class-card-header">
        <span class="class-type-badge ${c.type}">${c.type}</span>
        <span class="class-date-time">
          <svg style="width:13px;height:13px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          ${window.App.fmtDate(c.date)} · <span style="font-weight:600">${window.App.dayOfWeek(c.date)}</span> · ${c.time}${gcalBadge}
        </span>
      </div>
      <div class="class-course">${window.App.escHtml(c.course || '–')}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:4px">
        <div class="class-students-count">
          ${c.studentIds.length} alumno${c.studentIds.length !== 1 ? 's' : ''}:
          ${studentNames.slice(0, 3).join(', ')}${studentNames.length > 3 ? '...' : ''}
        </div>
        <div style="text-align:right">
          <div class="class-fee">${window.App.fmtCurrency(c.fee)}<small style="font-weight:400;color:var(--gray-400)"> /alumno</small></div>
          ${c.type === 'grupal' ? `<div style="font-size:0.75rem;font-weight:700;color:var(--gray-600)">Total: ${window.App.fmtCurrency(c.fee * c.studentIds.length)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

window.App.openNewClass = function(prefillDate) {
  document.getElementById('modal-class-title').textContent = 'Nueva clase';
  document.getElementById('class-id').value   = '';
  document.getElementById('class-type').value = 'individual';
  
  // Always use today or future date
  const today = window.App.todayStr();
  let proposedDate = prefillDate || today;
  
  // If prefilled date is in the past, use today instead
  if (prefillDate && prefillDate < today) {
    proposedDate = today;
  }
  
  const dateInput = document.getElementById('class-date');
  const timeInput = document.getElementById('class-time');
  
  dateInput.value = proposedDate;
  dateInput.min = today;
  
  // Set time
  const currentTime = window.App.currentTimeStr();
  if (proposedDate === today) {
    timeInput.value = currentTime;
    timeInput.min = currentTime;
  } else {
    timeInput.value = '16:00';
    timeInput.removeAttribute('min');
  }
  
  document.getElementById('class-fee').value  = '';
  populateCourseSelect('class-course', '');
  buildStudentsPicker([]);
  updateClassHint('individual');
  
  // Add listener for date changes
  dateInput.onchange = function() {
    const selectedDate = this.value;
    const today = window.App.todayStr();
    if (selectedDate === today) {
      const now = window.App.currentTimeStr();
      timeInput.min = now;
      if (timeInput.value < now) {
        timeInput.value = now;
      }
    } else {
      timeInput.removeAttribute('min');
    }
  };
  
  window.App.openModal('modal-class');
}

window.App.openEditClass = function(classId) {
  const c = window.App.state.classes.find(c => c.id === classId);
  if (!c) return;
  document.getElementById('modal-class-title').textContent = 'Editar clase';
  document.getElementById('class-id').value   = c.id;
  document.getElementById('class-type').value = c.type;
  
  const dateInput = document.getElementById('class-date');
  const timeInput = document.getElementById('class-time');
  const today = window.App.todayStr();
  
  dateInput.value = c.date;
  dateInput.min = today;
  timeInput.value = c.time;
  
  // Set time min if editing today's class
  if (c.date === today) {
    const currentTime = window.App.currentTimeStr();
    timeInput.min = currentTime;
  } else {
    timeInput.removeAttribute('min');
  }
  
  document.getElementById('class-fee').value  = c.fee;
  populateCourseSelect('class-course', c.course || '');
  buildStudentsPicker(c.studentIds);
  updateClassHint(c.type);
  
  // Add listener for date changes
  dateInput.onchange = function() {
    const selectedDate = this.value;
    const today = window.App.todayStr();
    if (selectedDate === today) {
      const now = window.App.currentTimeStr();
      timeInput.min = now;
      if (timeInput.value < now) {
        timeInput.value = now;
      }
    } else {
      timeInput.removeAttribute('min');
    }
  };
  
  window.App.openModal('modal-class');
}

function buildStudentsPicker(selectedIds) {
  const type       = document.getElementById('class-type').value;
  const courseFilter = document.getElementById('class-course').value;
  const picker     = document.getElementById('class-students-picker');

  // Filter students by course (if one is selected)
  let students = window.App.state.students.slice().sort((a, b) => a.name.localeCompare(b.name));
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
        <span class="picker-name">${window.App.escHtml(s.name)} <small style="color:var(--gray-400)">(${window.App.escHtml(s.course || '–')})</small></span>
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

window.App.saveClass = function(e) {
  e.preventDefault();
  const id     = document.getElementById('class-id').value;
  const type   = document.getElementById('class-type').value;
  const course = document.getElementById('class-course').value;
  const date   = document.getElementById('class-date').value;
  const time   = document.getElementById('class-time').value;
  const fee    = parseFloat(document.getElementById('class-fee').value);
  const studentIds = getPickerSelected();

  if (!date || !time) { window.App.showToast('Fecha y hora obligatorias', 'error'); return; }
  if (isNaN(fee) || fee < 0) { window.App.showToast('Cuota inválida', 'error'); return; }
  if (studentIds.length === 0) { window.App.showToast('Selecciona al menos un alumno', 'error'); return; }
  if (type === 'individual' && studentIds.length > 1) { window.App.showToast('Clase individual: solo 1 alumno', 'error'); return; }

  // Check if date/time is in the past
  const classDateTime = new Date(`${date}T${time}`);
  const now = new Date();
  if (classDateTime < now) {
    window.App.showToast('No se puede crear una clase en el pasado', 'error');
    return;
  }

  // Check for time conflict (same date+time, different id)
  const conflict = window.App.state.classes.find(c => c.date === date && c.time === time && c.id !== id);
  if (conflict) {
    const label = conflict.course ? `"${conflict.course}"` : `de tipo ${conflict.type}`;
    window.App.showToast(`Conflicto: ya hay una clase ${label} a las ${time}`, 'error');
    return;
  }

  if (id) {
    // Editing existing class: first reverse previous fee for these students,
    // then apply new fee
    const existing = window.App.state.classes.find(c => c.id === id);
    if (existing) {
      // Reverse old fee
      existing.studentIds.forEach(sid => {
        const s = window.App.state.students.find(s => s.id === sid);
        if (s) s.balance = Math.max(0, (parseFloat(s.balance) || 0) - (parseFloat(existing.fee) || 0));
      });
      // Update class
      Object.assign(existing, { type, course, date, time, fee, studentIds });
      // Apply new fee
      studentIds.forEach(sid => {
        const s = window.App.state.students.find(s => s.id === sid);
        if (s) s.balance = (parseFloat(s.balance) || 0) + fee;
      });
    }
  } else {
    // New class: add fee to each student balance
    const newId = window.App.uid();
    studentIds.forEach(sid => {
      const s = window.App.state.students.find(s => s.id === sid);
      if (s) s.balance = (parseFloat(s.balance) || 0) + fee;
    });
    window.App.state.classes.push({ id: newId, type, course, date, time, fee, studentIds });
  }

  window.App.saveState();
  window.App.closeModal('modal-class');
  window.App.renderCurrentTab();
  window.App.showToast(id ? 'Clase actualizada' : 'Clase creada', 'success');

  // Auto-sync new/updated class to Google Calendar if connected
  if (window.App.isGCalConnected()) {
    const savedId = id || window.App.state.classes[window.App.state.classes.length - 1]?.id;
    const saved   = window.App.state.classes.find(c => c.id === savedId);
    if (saved) {
      window.App.upsertGCalEvent(saved).then(eventId => {
        if (eventId) {
          saved.gcalEventId = eventId;
          window.App.saveState();
          window.App.renderCurrentTab();
        }
      });
    }
  }
}

window.App.openClassDetail = function(classId) {
  const c = window.App.state.classes.find(c => c.id === classId);
  if (!c) return;
  window.App.setDetailClassId(classId);

  const studentChips = c.studentIds.map(id => {
    const s = window.App.state.students.find(s => s.id === id);
    return `<span class="detail-student-chip">${s ? window.App.escHtml(s.name) : 'Alumno eliminado'}</span>`;
  }).join('');

  document.getElementById('class-detail-content').innerHTML = `
    <div class="detail-row"><span class="detail-label">Tipo</span><span class="detail-value"><span class="class-type-badge ${c.type}">${c.type}</span></span></div>
    <div class="detail-row"><span class="detail-label">Fecha</span><span class="detail-value">${window.App.fmtDate(c.date)} · ${window.App.dayOfWeek(c.date)}</span></div>
    <div class="detail-row"><span class="detail-label">Hora</span><span class="detail-value">${c.time}</span></div>
    <div class="detail-row"><span class="detail-label">Curso</span><span class="detail-value">${window.App.escHtml(c.course || '–')}</span></div>
    <div class="detail-row"><span class="detail-label">Cuota/alumno</span><span class="detail-value" style="font-weight:700;color:var(--primary)">${window.App.fmtCurrency(c.fee)}</span></div>
    ${c.type === 'grupal' ? `<div class="detail-row"><span class="detail-label">Total clase</span><span class="detail-value" style="font-weight:700;color:var(--gray-800)">${window.App.fmtCurrency(c.fee * c.studentIds.length)}</span></div>` : ''}
    <div class="detail-row"><span class="detail-label">Alumnos</span><span class="detail-value">${studentChips}</span></div>
  `;
  window.App.openModal('modal-class-detail');
}

window.App.deleteClass = function(classId) {
  const c = window.App.state.classes.find(c => c.id === classId);
  if (!c) return;
  window.App.confirmAction(
    'Eliminar clase',
    `¿Eliminar esta clase? Se restarán ${window.App.fmtCurrency(c.fee)} del saldo de cada alumno.`,
    async () => {
      // Remove from Google Calendar if synced
      if (c.gcalEventId) await window.App.deleteGCalEvent(c);
      // Reverse fees
      c.studentIds.forEach(sid => {
        const s = window.App.state.students.find(s => s.id === sid);
        if (s) s.balance = Math.max(0, (parseFloat(s.balance) || 0) - (parseFloat(c.fee) || 0));
      });
      window.App.state.classes = window.App.state.classes.filter(cl => cl.id !== classId);
      window.App.saveState();
      window.App.closeModal('modal-class-detail');
      window.App.renderCurrentTab();
      window.App.showToast('Clase eliminada');
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

// Initialize class events
window.App.initClassEvents = function() {
  document.getElementById('btn-new-class').addEventListener('click', () => window.App.openNewClass());
  document.getElementById('form-class').addEventListener('submit', window.App.saveClass);
  document.getElementById('class-type').addEventListener('change', (e) => updateClassHint(e.target.value));
  document.getElementById('class-course').addEventListener('change', updatePickerByCourse);
  document.getElementById('class-filter-date').addEventListener('change', window.App.applyClassFilters);
  document.getElementById('class-filter-type').addEventListener('change', window.App.applyClassFilters);
  document.getElementById('class-filter-future').addEventListener('change', window.App.applyClassFilters);
  
  document.getElementById('btn-detail-edit').addEventListener('click', () => {
    window.App.closeModal('modal-class-detail');
    window.App.openEditClass(window.App.detailClassId);
  });
  document.getElementById('btn-detail-delete').addEventListener('click', () => {
    window.App.closeModal('modal-class-detail');
    window.App.deleteClass(window.App.detailClassId);
  });
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.openClassDetail = window.App.openClassDetail;
  window.openNewClass = window.App.openNewClass;
}
