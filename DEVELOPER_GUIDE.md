# Guía de Desarrollo - Academia TIC

## 📋 Arquitectura de Módulos

### 🎯 Módulos Base

#### **config.js** - Configuración Central
Contiene todas las constantes y mensajes parametrizados.

**Exports:**
- `APP_CONFIG` - Configuración de la aplicación
- `GITHUB_CONFIG` - Configuración de GitHub
- `GCAL_CONFIG` - Configuración de Google Calendar
- `MESSAGES` - Todos los mensajes de la UI
- `MONTHS_ES`, `MONTHS_SHORT`, `DAYS_ES` - Localización
- `CLASS_TYPES` - Tipos de clases

**Uso:**
```javascript
import { APP_CONFIG, MESSAGES } from './config.js';
console.log(APP_CONFIG.appName); // "Academia TIC"
showToast(MESSAGES.saved, 'success');
```

#### **state.js** - Estado Global
Gestiona todo el estado de la aplicación.

**Exports:**
- `state` - Objeto principal con courses, students, classes, settings
- `calendarDate`, `detailClassId`, `confirmCallback` - Estado UI
- `gcalTokenClient`, `gcalAccessToken` - Estado Google Calendar
- `githubFileSha`, `githubSyncing`, etc. - Estado GitHub
- Funciones `set*()` para modificar estado de forma segura

**Uso:**
```javascript
import { state, setState, setGithubStatus } from './state.js';
state.students.push(newStudent);
setGithubStatus('syncing');
```

#### **utils.js** - Funciones Auxiliares
Funciones de utilidad sin dependencias.

**Exports:**
- `uid()` - Genera IDs únicos
- `fmtDate(dateStr)` - Formatea fecha a DD/MM/YYYY
- `fmtCurrency(val)` - Formatea moneda
- `dayOfWeek(dateStr)` - Obtiene día de la semana
- `initials(name)` - Obtiene iniciales
- `todayStr()` - Fecha actual YYYY-MM-DD
- `currentTimeStr()` - Hora actual HH:MM
- `formatDateStr(y, m, d)` - Formatea fecha
- `escHtml(str)` - Escapa HTML

---

### 🔧 Módulos de Funcionalidad

#### **persistence.js** - Almacenamiento
Gestiona localStorage e import/export.

**Exports:**
- `saveLocalOnly()` - Guarda sin timestamp ni GitHub push
- `saveState()` - Guarda con timestamp y programa GitHub push
- `loadState()` - Carga desde localStorage
- `exportData()` - Descarga JSON
- `importData(file, callback)` - Importa JSON

**Uso:**
```javascript
import { saveState, loadState } from './persistence.js';
loadState(); // Al iniciar
state.students.push(newStudent);
saveState(); // Guarda y sincroniza
```

#### **ui.js** - Interfaz de Usuario
Gestiona modales, toasts y navegación.

**Exports:**
- `showToast(msg, type)` - Muestra notificación
- `confirmAction(title, msg, callback)` - Diálogo de confirmación
- `openModal(id)` - Abre modal
- `closeModal(id)` - Cierra modal
- `switchTab(tabName)` - Cambia de pestaña
- `renderCurrentTab()` - Re-renderiza pestaña activa
- `renderAll()` - Re-renderiza todo
- `initConfirmEvents()` - Inicializa eventos de confirmación

**Uso:**
```javascript
import { showToast, confirmAction, openModal } from './ui.js';
showToast('Guardado', 'success');
confirmAction('¿Eliminar?', 'No se puede deshacer', () => {
  // Código de eliminación
});
openModal('modal-student');
```

#### **github.js** - Sincronización GitHub
Maneja backup automático en GitHub.

**Exports:**
- `githubPull()` - Descarga desde GitHub
- `githubPush(retry)` - Sube a GitHub
- `scheduleGithubPush()` - Programa push con debounce
- `manualGithubSync()` - Sincronización manual
- `testGithubConnection()` - Prueba conexión
- `setGithubStatus(status)` - Actualiza indicador
- `initGithubStatus()` - Inicializa estado

**Flujo:**
1. Usuario modifica datos → `saveState()`
2. `saveState()` → `scheduleGithubPush()`
3. Tras 2s de inactividad → `githubPush()`
4. Si hay conflicto → `githubPull()` + `githubPush()`

#### **gcal.js** - Google Calendar
Integración con Google Calendar API.

**Exports:**
- `initGCalTokenClient()` - Inicializa cliente OAuth
- `isGCalConnected()` - Verifica conexión
- `connectGCal()` - Conecta cuenta
- `disconnectGCal()` - Desconecta
- `updateGCalUI()` - Actualiza UI
- `syncAllToGCal()` - Sincroniza todas las clases
- `syncClassToGCal(classId)` - Sincroniza una clase
- `deleteGCalEvent(eventId)` - Elimina evento
- `onGISLoaded()` - Callback del SDK

**Uso:**
```javascript
import { connectGCal, syncClassToGCal } from './gcal.js';
// Al crear/editar clase
await syncClassToGCal(classId);
```

---

### 📊 Módulos de Dominio

#### **students.js** - Gestión de Estudiantes
**Exports:**
- `renderStudents()` - Renderiza lista
- `applyStudentFilters()` - Aplica filtros
- `buildStudentCard(student)` - Construye tarjeta
- `openNewStudent()` - Abre formulario nuevo
- `openEditStudent(id)` - Abre formulario edición
- `saveStudent(e)` - Guarda estudiante
- `deleteStudent(id)` - Elimina estudiante
- `initStudentEvents()` - Inicializa eventos

#### **classes.js** - Gestión de Clases
**Exports:**
- `renderClasses()` - Renderiza lista
- `applyClassFilters()` - Aplica filtros
- `openNewClass(date)` - Abre formulario nuevo
- `openEditClass(id)` - Abre formulario edición
- `saveClass(e)` - Guarda clase (valida fecha/hora)
- `openClassDetail(id)` - Muestra detalle
- `deleteClass(id)` - Elimina clase
- `initClassEvents()` - Inicializa eventos

**Validaciones:**
- No permite fechas/horas pasadas
- Detecta conflictos de horario
- Valida límite de alumnos por tipo

#### **courses.js** - Gestión de Cursos
**Exports:**
- `renderCourses()` - Renderiza lista
- `openNewCourse()` - Abre formulario nuevo
- `openEditCourse(id)` - Abre formulario edición
- `saveCourse(e)` - Guarda curso
- `deleteCourse(id)` - Elimina curso
- `populateCourseSelect(selectId, selected)` - Llena select
- `initCourseEvents()` - Inicializa eventos

#### **calendar.js** - Vista Calendario
**Exports:**
- `renderCalendar()` - Renderiza calendario mensual
- `openDayClasses(dateStr)` - Abre clases del día
- `initCalendarEvents()` - Inicializa navegación

**Características:**
- Resalta día actual
- Muestra indicadores de clases
- Deshabilita días pasados
- Permite crear clases con click

#### **dashboard.js** - Panel Principal
**Exports:**
- `renderDashboard()` - Renderiza estadísticas y resumen
- `renderAll()` - Helper para renderizar todo
- `initDashboardEvents()` - Inicializa eventos

#### **receipts.js** - Recibos
**Exports:**
- `generateReceipt(studentId)` - Genera nuevo recibo
- `openStudentReceipts(studentId)` - Muestra recibos
- `cancelReceipt(studentId)` - Cancela recibo pendiente
- `downloadReceiptPDF(studentId, receiptIndex)` - Descarga PDF

---

## 🔄 Flujo de Datos

### Creación de Estudiante
```
Usuario → Formulario → saveStudent() → 
state.students.push() → saveState() → 
localStorage + scheduleGithubPush() → 
renderStudents()
```

### Creación de Clase con Google Calendar
```
Usuario → Formulario → saveClass() →
Validaciones (fecha, conflictos) →
state.classes.push() → saveState() →
syncClassToGCal() → API Google →
renderClasses() + renderDashboard()
```

### Sincronización GitHub
```
saveState() → scheduleGithubPush() →
[Espera 2s] → githubPush() →
Sube datos (sin credenciales) →
Actualiza SHA → Indica estado OK
```

---

## 🛠️ Añadir Nueva Funcionalidad

### Ejemplo: Añadir campo "Email" a estudiantes

1. **Actualizar state.js**
```javascript
// No requiere cambios, los campos son dinámicos
```

2. **Actualizar students.js**
```javascript
function saveStudent(e) {
  // ...
  const email = document.getElementById('student-email').value.trim();
  const student = { 
    id, name, phone, email, // Añadir email
    course, createdAt, balance: 0, receipts: []
  };
  // ...
}
```

3. **Actualizar index.html**
```html
<div class="form-group">
  <label for="student-email">Email</label>
  <input type="email" id="student-email" />
</div>
```

4. **Actualizar renderizado**
```javascript
function buildStudentCard(s) {
  return `
    ...
    ${s.email ? `<p>📧 ${s.email}</p>` : ''}
    ...
  `;
}
```

---

## 🐛 Debugging

### Console Logs Importantes
```javascript
// En github.js
console.error('GitHub push error:', res.status, errorData);

// En gcal.js
console.log('GCal event created:', eventId);

// En classes.js
console.log('Saving class:', classData);
```

### Inspeccionar Estado
```javascript
// En consola del navegador
import { state } from './js/state.js';
console.log(state);
console.log(state.students);
console.log(state.classes);
```

### Resetear Datos
```javascript
localStorage.clear();
location.reload();
```

---

## ✅ Checklist de Testing

- [ ] Crear estudiante
- [ ] Editar estudiante
- [ ] Eliminar estudiante
- [ ] Crear clase (individual/grupal)
- [ ] Validar fecha pasada (debe rechazar)
- [ ] Detectar conflicto de horario
- [ ] Sincronizar con Google Calendar
- [ ] Crear curso
- [ ] Asignar curso a estudiante
- [ ] Ver calendario
- [ ] Crear clase desde calendario
- [ ] Generar recibo
- [ ] Descargar recibo PDF
- [ ] Exportar/Importar datos
- [ ] Sincronizar con GitHub
- [ ] Reconectar tras cambio de token

---

## 📚 Recursos Externos

- [Google Calendar API](https://developers.google.com/calendar/api)
- [GitHub REST API](https://docs.github.com/rest)
- [jsPDF Documentation](https://github.com/parallax/jsPDF)
- [ES6 Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)

---

**Última actualización**: Abril 2026
