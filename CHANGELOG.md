# Changelog

## [1.0.0] - 2026-04-30

### 🎉 Refactorización Completa

#### Agregado
- **Arquitectura modular ES6**: Código reorganizado en 14 módulos independientes
- **Archivo de configuración** (`js/config.js`): Todos los mensajes y constantes parametrizadas
- **Documentación completa**:
  - README.md - Guía de usuario
  - DEVELOPER_GUIDE.md - Guía de desarrollo
  - Comentarios mejorados en el código
- **.gitignore** actualizado para excluir backups y archivos temporales

#### Modificado
- **Separación de responsabilidades**: Cada módulo tiene una función específica
  - `state.js` - Gestión del estado global
  - `utils.js` - Funciones auxiliares
  - `persistence.js` - localStorage e import/export
  - `ui.js` - Interfaz de usuario (modales, toasts, navegación)
  - `github.js` - Sincronización con GitHub
  - `gcal.js` - Integración Google Calendar
  - `students.js` - Gestión de estudiantes
  - `classes.js` - Gestión de clases
  - `courses.js` - Gestión de cursos
  - `calendar.js` - Vista de calendario
  - `dashboard.js` - Panel principal
  - `receipts.js` - Generación de recibos
  - `main.js` - Punto de entrada
- **Event listeners en lugar de onclick inline**: Mejor separación HTML/JS
- **Mensajes parametrizados**: Fácil personalización y multiidioma
- **Título actualizado**: "Academia TIC" en lugar de "Academia MVP"
- **Mejor manejo de fechas**: Usa hora local en lugar de UTC (corrige problema de timezone)

#### Corregido
- **Problema de fecha UTC**: Las fechas ahora usan la zona horaria local correctamente
- **Restricciones de fecha/hora**: No permite seleccionar fechas u horas pasadas
- **Error 422 GitHub**: Corregido formato de petición API
- **Error 522 GitHub**: Corregido token de autenticación
- **Encoding UTF-8**: Mejor manejo de caracteres especiales en GitHub sync

#### Técnico
- **ES6 Modules**: Import/export estándar
- **No más código inline**: Todo está en módulos
- **Estructura escalable**: Fácil añadir nuevas funcionalidades
- **Mantenibilidad**: Código organizado y documentado
- **Backup**: `app.js` original guardado como `app.js.backup`

### 📁 Estructura Nueva
```
clasestic/
├── index.html
├── styles.css
├── academia_data.json
├── README.md
├── DEVELOPER_GUIDE.md
├── CHANGELOG.md
├── .gitignore
├── app.js.backup
└── js/
    ├── config.js
    ├── state.js
    ├── utils.js
    ├── persistence.js
    ├── ui.js
    ├── github.js
    ├── gcal.js
    ├── students.js
    ├── classes.js
    ├── courses.js
    ├── calendar.js
    ├── dashboard.js
    ├── receipts.js
    └── main.js
```

### ✅ Funcionalidades Preservadas
- ✓ Gestión de estudiantes (CRUD)
- ✓ Gestión de clases (CRUD con validaciones)
- ✓ Gestión de cursos (CRUD)
- ✓ Vista de calendario
- ✓ Generación de recibos PDF
- ✓ Sistema de saldo y deudas
- ✓ Sincronización automática con GitHub
- ✓ Integración con Google Calendar
- ✓ Export/Import de base de datos
- ✓ Validación de fechas/horas pasadas
- ✓ Detección de conflictos de horario

---

## Versiones Anteriores

### [0.9.0] - Antes de refactor
- Aplicación monolítica en un solo archivo `app.js` (1825 líneas)
- Funcionamiento completo pero difícil de mantener
- Sin documentación estructurada
- Algunos bugs en manejo de fechas UTC

---

**Formato basado en [Keep a Changelog](https://keepachangelog.com/)**
