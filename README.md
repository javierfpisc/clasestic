# Academia TIC - Aplicación de Gestión de Academia

## 📁 Estructura del Proyecto

```
clasestic/
├── index.html              # Página principal HTML
├── styles.css              # Estilos CSS
├── academia_data.json      # Datos de la aplicación (generado)
├── app.js.backup           # Código antiguo (backup)
└── js/                     # Módulos JavaScript (ES6)
    ├── config.js           # Constantes y mensajes parametrizados
    ├── state.js            # Estado global de la aplicación
    ├── utils.js            # Funciones auxiliares
    ├── persistence.js      # Gestión de localStorage
    ├── ui.js               # Interfaz de usuario (modales, toast, navegación)
    ├── github.js           # Sincronización con GitHub
    ├── gcal.js             # Integración con Google Calendar
    ├── students.js         # Gestión de estudiantes
    ├── classes.js          # Gestión de clases
    ├── courses.js          # Gestión de cursos
    ├── calendar.js         # Vista de calendario
    ├── dashboard.js        # Panel principal
    ├── receipts.js         # Generación de recibos
    └── main.js             # Punto de entrada principal
```

## 🚀 Características

### ✅ Gestión de Estudiantes
- Crear, editar y eliminar estudiantes
- Seguimiento de saldo y deudas
- Asignación de cursos
- Búsqueda y filtrado

### ✅ Gestión de Clases
- Clases individuales y grupales
- Asignación de cuota por clase
- Validación de fechas/horas pasadas
- Detección de conflictos de horario
- Sincronización con Google Calendar

### ✅ Gestión de Cursos
- Organización por cursos
- Descripción y detalles
- Asignación de estudiantes

### ✅ Calendario
- Vista mensual
- Indicadores visuales de clases
- Navegación mes a mes
- Click para crear/ver clases

### ✅ Recibos
- Generación automática de recibos
- Descarga en PDF
- Control de pagos
- Historial por estudiante

### ✅ Sincronización
- **GitHub**: Backup automático en repositorio
- **Google Calendar**: Sincronización de clases
- **localStorage**: Persistencia local

### ✅ Dashboard
- Estadísticas generales
- Clases próximas
- Control de deudas
- Resumen visual

## ⚙️ Configuración

### 1. GitHub Sync
1. Ir a **Ajustes** (⚙️)
2. Generar un [Personal Access Token](https://github.com/settings/tokens) con permisos `repo`
3. Configurar:
   - **Token**: Tu token de GitHub
   - **Repositorio**: `usuario/nombre-repo`
   - **Rama**: `main` (o la que uses)
   - **Archivo**: `academia_data.json`

### 2. Google Calendar
1. Ir a **Ajustes** (⚙️)
2. Crear un proyecto en [Google Cloud Console](https://console.cloud.google.com)
3. Habilitar la API de Google Calendar
4. Crear credenciales OAuth 2.0
5. Copiar el **Client ID** en la configuración
6. Click en **Conectar Google Calendar**

## 🔧 Desarrollo

### Estructura de Módulos

Todos los módulos usan **ES6 Modules** con import/export:

```javascript
// Ejemplo de uso
import { state } from './state.js';
import { showToast } from './ui.js';
import { saveState } from './persistence.js';
```

### Personalización

Para personalizar mensajes y configuraciones, edita **`js/config.js`**:

```javascript
export const APP_CONFIG = {
  appName: 'Academia TIC',        // Nombre de la app
  defaultAcademyName: 'Mi Academia', // Nombre por defecto
  version: '1.0.0',
  storageKey: 'academia_mvp_data',
};

export const MESSAGES = {
  saved: 'Guardado correctamente',
  // ... más mensajes
};
```

### Añadir Nuevas Funcionalidades

1. Crea un nuevo módulo en `js/`
2. Exporta las funciones necesarias
3. Importa en `main.js`
4. Inicializa en la función `init()`

## 📝 Notas Técnicas

### Seguridad
- Los tokens (GitHub, Google) **NO se sincronizan** con GitHub
- Solo se guardan en localStorage del navegador
- Nunca se exponen en el repositorio

### Compatibilidad
- Navegadores modernos con soporte ES6 Modules
- Requiere conexión a Internet para Google Calendar
- Funciona offline (excepto sincronización)

### Almacenamiento
- **localStorage**: Datos locales
- **GitHub**: Backup en la nube (sin credenciales)
- **Exportación**: JSON descargable

## 🐛 Debugging

Para ver logs en la consola del navegador (F12):
- Errores de GitHub sync
- Estado de Google Calendar
- Validaciones de formularios

## 📄 Licencia

Código desarrollado para uso académico y personal.

---

**Versión**: 1.0.0  
**Última actualización**: Abril 2026
