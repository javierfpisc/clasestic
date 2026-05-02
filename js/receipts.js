/* =============================================
   Receipts Module
   Receipt generation, management, PDF export
   ============================================= */

window.App = window.App || {};

window.App.generateReceipt = function(studentId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const balance = window.App.calculateStudentBalance(studentId);
  if (balance <= 0) { window.App.showToast('Este alumno no tiene saldo pendiente de clases pasadas', 'error'); return; }

  const hasPending = (s.receipts || []).some(r => r.status === 'pending');
  if (hasPending) {
    window.App.confirmAction(
      'Ya existe un recibo pendiente',
      `${s.name} ya tiene un recibo sin descargar. ¿Generar uno nuevo de todas formas?`,
      () => doGenerateReceipt(s)
    );
  } else {
    doGenerateReceipt(s);
  }
}

function doGenerateReceipt(s) {
  window.App.state.receiptCounter = (window.App.state.receiptCounter || 0) + 1;
  const now   = new Date();
  const year  = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const seq   = String(window.App.state.receiptCounter).padStart(3, '0');

  const receipt = {
    id:          window.App.uid(),
    number:      `${year}${month}-${seq}`,
    generatedAt: window.App.todayStr(),
    amount:      window.App.calculateStudentBalance(s.id),
    status:      'pending',  // pending | sent | paid
    sentAt:      null,
    paidAt:      null,
  };
  if (!s.receipts) s.receipts = [];
  s.receipts.push(receipt);
  window.App.saveState();
  window.App.renderCurrentTab();
  window.App.showToast(`Recibo ${receipt.number} generado`, 'success');
  window.App.openStudentReceipts(s.id);
}

window.App.openStudentReceipts = function(studentId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  window.App.currentReceiptsStudentId = studentId; // Save for new receipt button
  renderReceiptsModal(s);
  window.App.openModal('modal-receipts');
}

function renderReceiptsModal(s) {
  document.getElementById('receipts-student-name').textContent = s.name;
  const receipts  = (s.receipts || []).slice().reverse();
  const container = document.getElementById('receipts-list');

  if (receipts.length === 0) {
    container.innerHTML = `<p class="empty-state" style="padding:20px 0;text-align:center">No hay recibos generados</p>`;
    return;
  }

  const statusLabels = {
    pending: 'Pendiente',
    sent: 'Enviado',
    paid: 'Pagado'
  };
  
  container.innerHTML = receipts.map(r => `
    <div class="receipt-item ${r.status}">
      <div class="receipt-item-header">
        <span class="receipt-number">Nº ${window.App.escHtml(r.number)}</span>
        <span class="receipt-status-badge ${r.status}">${statusLabels[r.status] || r.status}</span>
      </div>
      <div class="receipt-item-body">
        <div>
          <div class="receipt-date">Generado: ${window.App.fmtDate(r.generatedAt)}</div>
          ${r.sentAt ? `<div class="receipt-date" style="color:#f59e0b">Enviado: ${window.App.fmtDate(r.sentAt)}</div>` : ''}
          ${r.paidAt ? `<div class="receipt-date" style="color:var(--success)">Pagado: ${window.App.fmtDate(r.paidAt)}</div>` : ''}
        </div>
        <div class="receipt-amount">${window.App.fmtCurrency(r.amount)}</div>
      </div>
      <div class="receipt-item-actions">
        ${r.status === 'pending' ? `
          <button class="btn btn-sm btn-secondary" onclick="window.markReceiptAsSent('${s.id}','${r.id}')">Marcar enviado</button>
          <button class="btn btn-sm btn-secondary" onclick="window.cancelReceipt('${s.id}','${r.id}')">Cancelar</button>
        ` : ''}
        ${r.status === 'sent' ? `
          <button class="btn btn-sm btn-primary" onclick="window.markReceiptAsPaid('${s.id}','${r.id}')">Marcar pagado</button>
        ` : ''}
        <button class="btn btn-sm ${r.status === 'paid' ? 'btn-secondary' : 'btn-primary'}" onclick="window.downloadReceiptPdf('${s.id}','${r.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          PDF
        </button>
      </div>
    </div>`).join('');
}

window.App.cancelReceipt = function(studentId, receiptId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r || r.status !== 'pending') return;
  window.App.confirmAction('Cancelar recibo', `¿Cancelar el recibo ${r.number}?`, () => {
    s.receipts = s.receipts.filter(r => r.id !== receiptId);
    window.App.saveState();
    renderReceiptsModal(s);
    window.App.renderCurrentTab();
    window.App.showToast(`Recibo ${r.number} cancelado`);
  });
}

window.App.downloadReceiptPdf = function(studentId, receiptId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r) return;

  if (!window.jspdf?.jsPDF) { window.App.showToast('La librería PDF no está disponible', 'error'); return; }

  const { jsPDF } = window.jspdf;
  const doc      = new jsPDF({ unit: 'mm', format: 'a5' });
  const pageW    = doc.internal.pageSize.getWidth();
  const pageH    = doc.internal.pageSize.getHeight();
  const margin   = 14;
  const contentW = pageW - margin * 2;
  const academyName = window.App.state.settings?.academyName || 'Academia';

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
  doc.text(`Nº ${r.number}`, pageW - margin, 12, { align: 'right' });
  doc.text(window.App.fmtDate(r.generatedAt), pageW - margin, 20, { align: 'right' });

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
  const meta = [s.course, s.phone].filter(Boolean).join('  ·  ');
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
  doc.text(window.App.fmtCurrency(r.amount), margin + 4, y + 17);

  // Concept
  y += 30;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(107, 114, 128);
  doc.text('CONCEPTO', margin + 4, y);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(31, 41, 55);
  doc.text('Clases recibidas' + (s.course ? '  ·  ' + s.course : ''), margin + 4, y + 7);

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

  window.App.showToast(`Recibo ${r.number} descargado`, 'success');
}

// Render receipts panel (all receipts grouped by student)
window.App.renderReceipts = function() {
  window.App.applyReceiptFilters();
}

window.App.applyReceiptFilters = function() {
  const statusFilter = document.getElementById('receipt-filter-status')?.value || '';
  
  // Get all students with receipts
  const studentsWithReceipts = window.App.state.students
    .map(s => {
      let receipts = (s.receipts || []).slice();
      if (statusFilter) {
        receipts = receipts.filter(r => r.status === statusFilter);
      }
      return { student: s, receipts };
    })
    .filter(item => item.receipts.length > 0);
  
  const list = document.getElementById('receipts-panel-list');
  
  if (studentsWithReceipts.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <p>No hay recibos${statusFilter ? ' con este estado' : ''}</p>
      </div>`;
    return;
  }
  
  const statusLabels = { pending: 'Pendiente', sent: 'Enviado', paid: 'Pagado' };
  
  list.innerHTML = studentsWithReceipts.map(item => {
    const s = item.student;
    const receipts = item.receipts.sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
    
    return `
      <div class="card" style="margin-bottom:16px">
        <div style="margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid var(--gray-200)">
          <h4 style="margin:0;font-size:0.95rem;font-weight:700;color:var(--gray-800)">${window.App.escHtml(s.name)}</h4>
          <div style="font-size:0.75rem;color:var(--gray-500);margin-top:2px">
            ${receipts.length} recibo${receipts.length !== 1 ? 's' : ''}
            ${s.phone ? ` · ${s.phone}` : ''}
          </div>
        </div>
        ${receipts.map(r => `
          <div class="receipt-item ${r.status}" style="margin-bottom:10px">
            <div class="receipt-item-header">
              <span class="receipt-number">Nº ${window.App.escHtml(r.number)}</span>
              <span class="receipt-status-badge ${r.status}">${statusLabels[r.status]}</span>
            </div>
            <div class="receipt-item-body">
              <div>
                <div class="receipt-date">Generado: ${window.App.fmtDate(r.generatedAt)}</div>
                ${r.sentAt ? `<div class="receipt-date" style="color:#f59e0b">Enviado: ${window.App.fmtDate(r.sentAt)}</div>` : ''}
                ${r.paidAt ? `<div class="receipt-date" style="color:var(--success)">Pagado: ${window.App.fmtDate(r.paidAt)}</div>` : ''}
              </div>
              <div class="receipt-amount">${window.App.fmtCurrency(r.amount)}</div>
            </div>
            <div class="receipt-item-actions">
              ${r.status === 'pending' ? `
                <button class="btn btn-sm btn-secondary" onclick="window.markReceiptAsSent('${s.id}','${r.id}')">Marcar enviado</button>
                <button class="btn btn-sm btn-secondary" onclick="window.cancelReceipt('${s.id}','${r.id}')">Cancelar</button>
              ` : ''}
              ${r.status === 'sent' ? `
                <button class="btn btn-sm btn-primary" onclick="window.markReceiptAsPaid('${s.id}','${r.id}')">Marcar pagado</button>
              ` : ''}
              <button class="btn btn-sm ${r.status === 'paid' ? 'btn-secondary' : 'btn-primary'}" onclick="window.downloadReceiptPdf('${s.id}','${r.id}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                PDF
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

// Mark receipt as sent (balance is calculated dynamically)
window.App.markReceiptAsSent = function(studentId, receiptId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r || r.status !== 'pending') return;
  
  r.status = 'sent';
  r.sentAt = window.App.todayStr();
  
  window.App.saveState();
  window.App.renderCurrentTab();
  window.App.showToast(`Recibo ${r.number} marcado como enviado · saldo actualizado`, 'success');
}

// Mark receipt as paid (informational only, balance already deducted when sent)
window.App.markReceiptAsPaid = function(studentId, receiptId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const r = (s.receipts || []).find(r => r.id === receiptId);
  if (!r) return;
  
  if (r.status === 'pending') {
    window.App.showToast('Debes marcar el recibo como enviado primero', 'error');
    return;
  }
  
  if (r.status === 'paid') {
    window.App.showToast('Este recibo ya está marcado como pagado', 'error');
    return;
  }
  
  r.status = 'paid';
  r.paidAt = window.App.todayStr();
  
  window.App.saveState();
  
  // Update modal if it's open for this student
  if (window.App.currentReceiptsStudentId === studentId) {
    renderReceiptsModal(s);
  }
  
  window.App.renderCurrentTab();
  window.App.showToast(`Recibo ${r.number} marcado como pagado`, 'success');
}

// Send pending receipts via WhatsApp
window.App.sendPendingReceipts = async function() {
  const whatsappPhone = window.App.state.settings?.whatsappPhone;
  if (!whatsappPhone) {
    window.App.showToast('Configura tu número de WhatsApp en Ajustes', 'error');
    return;
  }
  
  // Get all pending receipts grouped by student
  const studentsPending = window.App.state.students
    .map(s => {
      const pending = (s.receipts || []).filter(r => r.status === 'pending');
      return { student: s, receipts: pending };
    })
    .filter(item => item.receipts.length > 0 && item.student.phone);
  
  if (studentsPending.length === 0) {
    window.App.showToast('No hay recibos pendientes para enviar', 'error');
    return;
  }
  
  window.App.confirmAction(
    'Enviar recibos por WhatsApp',
    `Se enviarán ${studentsPending.reduce((sum, item) => sum + item.receipts.length, 0)} recibos a ${studentsPending.length} alumno${studentsPending.length !== 1 ? 's' : ''} por WhatsApp. ¿Continuar?`,
    () => {
      let sent = 0;
      studentsPending.forEach(item => {
        item.receipts.forEach(r => {
          const academyName = window.App.state.settings?.academyName || 'Academia';
          const message = `Hola ${item.student.name.split(' ')[0]},\n\nTienes un recibo pendiente de ${academyName}:\n\nRecibo Nº: ${r.number}\nImporte: ${window.App.fmtCurrency(r.amount)}\nFecha: ${window.App.fmtDate(r.generatedAt)}\n\nPuedes realizar el pago y solicitar tu recibo. ¡Gracias!`;
          
          const url = `https://wa.me/${item.student.phone}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
          
          // Mark as sent (balance is calculated dynamically)
          r.status = 'sent';
          r.sentAt = window.App.todayStr();
          sent++;
        });
      });
      
      window.App.saveState();
      window.App.renderCurrentTab();
      window.App.showToast(`${sent} recibo${sent !== 1 ? 's' : ''} enviados por WhatsApp`, 'success');
    }
  );
}

// Initialize receipt events
window.App.initReceiptEvents = function() {
  const filterStatus = document.getElementById('receipt-filter-status');
  if (filterStatus) {
    filterStatus.addEventListener('change', window.App.applyReceiptFilters);
  }
  
  const btnSend = document.getElementById('btn-send-pending-receipts');
  if (btnSend) {
    btnSend.addEventListener('click', window.App.sendPendingReceipts);
  }
  
  const btnNewReceipt = document.getElementById('btn-new-receipt');
  if (btnNewReceipt) {
    btnNewReceipt.addEventListener('click', () => {
      if (window.App.currentReceiptsStudentId) {
        window.App.generateReceipt(window.App.currentReceiptsStudentId);
      }
    });
  }
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.generateReceipt = window.App.generateReceipt;
  window.openStudentReceipts = window.App.openStudentReceipts;
  window.cancelReceipt = window.App.cancelReceipt;
  window.downloadReceiptPdf = window.App.downloadReceiptPdf;
  window.markReceiptAsSent = window.App.markReceiptAsSent;
  window.markReceiptAsPaid = window.App.markReceiptAsPaid;
}
