/* =============================================
   Receipts Module
   Receipt generation, management, PDF export
   ============================================= */

window.App = window.App || {};

window.App.generateReceipt = function(studentId) {
  const s = window.App.state.students.find(s => s.id === studentId);
  if (!s) return;
  const balance = parseFloat(s.balance) || 0;
  if (balance <= 0) { window.App.showToast('Este alumno no tiene saldo pendiente', 'error'); return; }

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
    amount:      parseFloat(s.balance) || 0,
    status:      'pending',
    printedAt:   null,
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

  container.innerHTML = receipts.map(r => `
    <div class="receipt-item ${r.status}">
      <div class="receipt-item-header">
        <span class="receipt-number">Nº ${window.App.escHtml(r.number)}</span>
        <span class="receipt-status-badge ${r.status}">${r.status === 'pending' ? 'Pendiente' : 'Cobrado'}</span>
      </div>
      <div class="receipt-item-body">
        <div>
          <div class="receipt-date">Generado: ${window.App.fmtDate(r.generatedAt)}</div>
          ${r.printedAt ? `<div class="receipt-date" style="color:var(--success)">Cobrado: ${window.App.fmtDate(r.printedAt)}</div>` : ''}
        </div>
        <div class="receipt-amount">${window.App.fmtCurrency(r.amount)}</div>
      </div>
      ${r.status === 'pending' ? `
        <div class="receipt-item-actions">
          <button class="btn btn-sm btn-secondary" onclick="window.cancelReceipt('${s.id}','${r.id}')">Cancelar</button>
          <button class="btn btn-sm btn-primary" onclick="window.downloadReceiptPdf('${s.id}','${r.id}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Descargar PDF y marcar pagado
          </button>
        </div>` : ''}
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

  // Mark printed and update balance
  r.status    = 'printed';
  r.printedAt = window.App.todayStr();
  s.balance   = Math.max(0, (parseFloat(s.balance) || 0) - r.amount);

  window.App.saveState();
  renderReceiptsModal(s);
  window.App.renderCurrentTab();
  window.App.showToast(`Recibo ${r.number} descargado · saldo actualizado`, 'success');
}

// Make functions globally available for onclick handlers
if (typeof window !== 'undefined') {
  window.generateReceipt = window.App.generateReceipt;
  window.openStudentReceipts = window.App.openStudentReceipts;
  window.cancelReceipt = window.App.cancelReceipt;
  window.downloadReceiptPdf = window.App.downloadReceiptPdf;
}
