/* =============================================
   Dashboard Module
   Dashboard view with stats and upcoming classes
   ============================================= */

window.App = window.App || {};

window.App.renderDashboard = function() {
  // Stats
  const totalStudents = window.App.state.students.length;
  const totalClasses  = window.App.state.classes.length;
  const debtors       = window.App.state.students.filter(s => s.balance > 0);
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
    const sorted = [...debtors].sort((a, b) => b.balance - a.balance).slice(0, 6);
    debtorEl.innerHTML = sorted.map(s => window.App.buildStudentCard(s)).join('');
  }
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
