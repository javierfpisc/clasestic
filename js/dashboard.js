/* =============================================
   Dashboard Module
   Dashboard view with stats and upcoming classes
   ============================================= */

window.App = window.App || {};

window.App.renderDashboard = function() {
  // Stats
  const totalStudents = window.App.state.students.length;
  const totalClasses  = window.App.state.classes.length;
  const debtors       = window.App.state.students.filter(s => window.App.calculateStudentBalance(s.id) > 0);
  const totalDebt     = debtors.reduce((sum, s) => sum + window.App.calculateStudentBalance(s.id), 0);

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
      <span class="stat-value" style="font-size:1.1rem">${window.App.fmtCurrency(totalDebt)}</span>
    </div>
  `;

  // Upcoming classes (today onwards, sorted)
  const today = window.App.todayStr();
  const upcoming = window.App.state.classes
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
        const s = window.App.state.students.find(s => s.id === id);
        return s ? s.name.split(' ')[0] : '?';
      }).join(', ');
      return `
        <div class="upcoming-item" data-class-id="${c.id}">
          <div class="upcoming-date-block">
            <div class="day">${d[2]}</div>
            <div class="month">${window.App.MONTHS_SHORT[parseInt(d[1]) - 1]}</div>
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
    const sorted = [...debtors].sort((a, b) => window.App.calculateStudentBalance(b.id) - window.App.calculateStudentBalance(a.id)).slice(0, 6);
    debtorEl.innerHTML = sorted.map(s => window.App.buildDebtorCard(s)).join('');
  }
}

// Build debtor card for dashboard (shows unbilled classes)
window.App.buildDebtorCard = function(s) {
  const today = window.App.todayStr();
  const billedClassIds = new Set();
  
  // Get all class IDs in ANY receipt (pending, sent, or paid)
  (s.receipts || []).forEach(r => {
    if (r.classIds) {
      r.classIds.forEach(id => billedClassIds.add(id));
    }
  });
  
  // Get unbilled past classes
  const unbilledClasses = window.App.state.classes
    .filter(c => c.date <= today && c.studentIds.includes(s.id) && !billedClassIds.has(c.id))
    .sort((a, b) => b.date.localeCompare(a.date)); // Most recent first
  
  const totalAmount = unbilledClasses.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);
  
  // Get last receipt (most recent)
  const lastReceipt = (s.receipts || [])
    .filter(r => r.status !== 'paid') // Exclude paid ones
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  
  const statusLabels = { pending: 'Pendiente', sent: 'Enviado', paid: 'Pagado' };
  const statusColors = { pending: '#f59e0b', sent: '#3b82f6', paid: '#10b981' };
  
  return `
    <div class="student-card">
      <div class="student-avatar">${window.App.initials(s.name)}</div>
      <div class="student-info">
        <div class="student-name">${window.App.escHtml(s.name)}</div>
        <div class="student-meta">
          <strong>${window.App.fmtCurrency(totalAmount)}</strong> · ${unbilledClasses.length} clase${unbilledClasses.length !== 1 ? 's' : ''} pendiente${unbilledClasses.length !== 1 ? 's' : ''}
          ${lastReceipt ? ` · <span style="color:${statusColors[lastReceipt.status]};font-weight:500;">Recibo ${statusLabels[lastReceipt.status]}</span>` : ''}
        </div>
        <div style="margin-top:8px; font-size:0.85rem; color:var(--text-secondary);">
          ${unbilledClasses.map(c => {
            const classType = c.type === 'individual' ? 'Individual' : 
                             (c.groupId ? (window.App.state.groups.find(g => g.id === c.groupId)?.name || 'Grupo') : 'Grupo');
            return `
              <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--border-light);">
                <span>📅 ${window.App.fmtDate(c.date)} · ${classType}</span>
                <span style="font-weight:500;">${window.App.fmtCurrency(c.fee)}</span>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

window.App.renderAll = function() {
  window.App.renderCurrentTab();
}

// Initialize dashboard events
window.App.initDashboardEvents = function() {
  document.getElementById('upcoming-classes').addEventListener('click', (e) => {
    const item = e.target.closest('[data-class-id]');
    if (item) {
      window.App.openClassDetail(item.dataset.classId);
    }
  });
}
