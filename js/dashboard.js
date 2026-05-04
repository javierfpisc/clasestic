/* =============================================
   Dashboard Module
   Dashboard view with stats and upcoming classes
   ============================================= */

window.App = window.App || {};

window.App.renderDashboard = function() {
  // Stats
  const totalStudents = window.App.state.students.length;
  const totalGroups = (window.App.state.groups || []).length;
  const totalCourses = (window.App.state.courses || []).length;
  
  // Count classes for current month (past and future)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12
  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const today = window.App.todayStr();
  
  const classesThisMonth = window.App.state.classes.filter(c => c.date.startsWith(monthPrefix));
  const pastClassesThisMonth = classesThisMonth.filter(c => c.date < today).length;
  const futureClassesThisMonth = classesThisMonth.filter(c => c.date >= today).length;
  
  // Students with unbilled classes (not in any receipt)
  const studentsWithUnbilledClasses = window.App.state.students.filter(s => {
    const billedClassIds = new Set();
    
    // Get all class IDs in ANY receipt (pending, sent, or paid)
    (s.receipts || []).forEach(r => {
      if (r.classIds) {
        r.classIds.forEach(id => billedClassIds.add(id));
      }
    });
    
    // Check if student has past unbilled classes
    const unbilledClasses = window.App.state.classes.filter(c => 
      c.date <= today && 
      c.studentIds.includes(s.id) && 
      !billedClassIds.has(c.id)
    );
    
    return unbilledClasses.length > 0;
  });
  
  // Calculate total amount of unbilled classes
  const totalUnbilledAmount = studentsWithUnbilledClasses.reduce((sum, s) => {
    const billedClassIds = new Set();
    (s.receipts || []).forEach(r => {
      if (r.classIds) r.classIds.forEach(id => billedClassIds.add(id));
    });
    const unbilledClasses = window.App.state.classes.filter(c => 
      c.date <= today && 
      c.studentIds.includes(s.id) && 
      !billedClassIds.has(c.id)
    );
    return sum + unbilledClasses.reduce((s2, c) => s2 + (parseFloat(c.fee) || 0), 0);
  }, 0);

  document.getElementById('stats-grid').innerHTML = `
    <div class="stat-card stat-primary">
      <span class="stat-label">Alumnos</span>
      <span class="stat-value">${totalStudents}</span>
      <small style="font-size:0.75rem;opacity:0.8;margin-top:4px">${totalGroups} grupos · ${totalCourses} cursos</small>
    </div>
    <div class="stat-card stat-warning">
      <span class="stat-label">Clases este mes</span>
      <span class="stat-value">${pastClassesThisMonth} + ${futureClassesThisMonth}</span>
      <small style="font-size:0.75rem;opacity:0.8;margin-top:4px">Impartidas + Futuras</small>
    </div>
    <div class="stat-card stat-danger">
      <span class="stat-label">Recibos a generar</span>
      <span class="stat-value">${studentsWithUnbilledClasses.length}</span>
    </div>
    <div class="stat-card stat-success">
      <span class="stat-label">Por facturar</span>
      <span class="stat-value" style="font-size:1.1rem">${window.App.fmtCurrency(totalUnbilledAmount)}</span>
    </div>
  `;

  // Upcoming classes (today onwards, sorted)
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

  // Students with unbilled classes
  const debtorEl = document.getElementById('debtor-students');
  if (studentsWithUnbilledClasses.length === 0) {
    debtorEl.innerHTML = `<p class="empty-state" style="padding:20px 0"><small>Todas las clases están facturadas 🎉</small></p>`;
  } else {
    // Sort by total unbilled amount (highest first)
    const sorted = [...studentsWithUnbilledClasses].sort((a, b) => {
      const getUnbilledAmount = (s) => {
        const billedClassIds = new Set();
        (s.receipts || []).forEach(r => {
          if (r.classIds) r.classIds.forEach(id => billedClassIds.add(id));
        });
        const unbilledClasses = window.App.state.classes.filter(c => 
          c.date <= today && 
          c.studentIds.includes(s.id) && 
          !billedClassIds.has(c.id)
        );
        return unbilledClasses.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);
      };
      return getUnbilledAmount(b) - getUnbilledAmount(a);
    }).slice(0, 6);
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
