# 💡 Tips y Mejores Prácticas

## 🚀 Primeros Pasos

### 1. Configuración Inicial
1. Abre la aplicación en un navegador moderno (Chrome, Firefox, Edge, Safari)
2. Ve a **Ajustes** ⚙️ 
3. Configura el nombre de tu academia
4. (Opcional) Configura GitHub y Google Calendar

### 2. Crear tu Primera Estructura
1. **Crea cursos** primero (ej: "Informática Básica", "Ofimática Avanzada")
2. **Añade estudiantes** y asígnalos a cursos
3. **Programa clases** desde el calendario o la pestaña Clases

## 📱 Uso Diario

### Flujo Recomendado
```
Lunes: Planificar clases de la semana
├─ Ir al Calendario
├─ Click en días futuros para crear clases
└─ Asignar estudiantes y cuotas

Después de cada clase:
├─ Marcar asistencia (implícito)
└─ La cuota se añade automáticamente al saldo

Fin de mes:
├─ Ver alumnos con deuda (Dashboard)
├─ Generar recibos individuales
└─ Marcar como pagados al recibir
```

## 💰 Gestión de Saldo

### Cómo Funciona
- Cada vez que asignas un estudiante a una clase, su **saldo aumenta** en el importe de la cuota
- El saldo representa lo que el estudiante **debe pagar**
- Al generar un recibo, se **descuenta del saldo**

### Ejemplo
```
Estudiante: Juan Pérez
Saldo inicial: 0 €

1. Clase individual (20 €) → Saldo: 20 €
2. Clase grupal (15 €) → Saldo: 35 €
3. Generar recibo de 30 € → Saldo: 5 €
4. Generar recibo de 5 € → Saldo: 0 €
```

## 🔄 Sincronización

### GitHub (Backup Automático)
- Se sincroniza automáticamente cada vez que guardas cambios
- **Debounce de 2 segundos**: espera 2s después del último cambio antes de subir
- Si trabajas en varios dispositivos, los cambios se mezclan inteligentemente
- **Los tokens NO se sincronizan** (solo en tu navegador)

### Google Calendar
- Las clases futuras se pueden sincronizar con Google Calendar
- **Manual**: Click en el botón de sincronizar en Ajustes
- **Automático**: Al crear/editar/eliminar una clase individual
- Aparece un enlace 📅 en el detalle de clase si está sincronizada

## 🎯 Mejores Prácticas

### Organización
- ✅ **Crea cursos específicos**: Facilita filtrar y agrupar
- ✅ **Usa nombres descriptivos**: "Excel Avanzado - Grupo A"
- ✅ **Planifica con antelación**: Crea clases de toda la semana
- ✅ **Revisa el Dashboard**: Resume todo en un vistazo

### Recibos
- ✅ **Genera recibos al recibir el pago**, no antes
- ✅ **Descárgalos en PDF** para enviarlos o imprimirlos
- ✅ **Verifica el saldo** antes de generar
- ⚠️ Un recibo pendiente se puede cancelar (devolverá el saldo)

### Datos
- ✅ **Exporta backups periódicamente**: Descarga > "Descargar base de datos"
- ✅ **Mantén GitHub actualizado**: Verifica el indicador verde ✓
- ⚠️ **Importar reemplaza TODO**: Úsalo solo para restaurar

## ⚠️ Precauciones

### ❌ NO Hagas Esto
- ❌ Editar el `academia_data.json` manualmente
- ❌ Eliminar estudiantes con clases asignadas (se pierden datos)
- ❌ Borrar el localStorage sin backup
- ❌ Compartir tokens de GitHub/Google

### ✅ En Lugar de Eso
- ✅ Usa la app para modificar datos
- ✅ Exporta antes de eliminar
- ✅ Usa GitHub sync como backup
- ✅ Mantén tokens privados

## 🐛 Solución de Problemas

### "No se sincroniza con GitHub"
1. Verifica que el token sea válido (Settings > Developer settings > Tokens)
2. Comprueba que el repositorio existe
3. Revisa los permisos del token (debe tener `repo`)
4. Abre la consola del navegador (F12) para ver errores detallados

### "Google Calendar no conecta"
1. Verifica el Client ID de Google Cloud Console
2. Asegúrate de que la API de Calendar esté habilitada
3. Comprueba que el dominio esté autorizado en OAuth 2.0

### "Perdí datos"
1. Si tenías GitHub configurado: Vacía localStorage y recarga → se importará automáticamente
2. Si exportabas regularmente: Importa el último JSON descargado
3. Última opción: Revisar backups del navegador/sistema

### "La fecha aparece con un día de diferencia"
- Este bug está corregido en v1.0.0
- Si aún ocurre, verifica la zona horaria del sistema

## 🔐 Seguridad

### Datos Locales
- Todo se guarda en **localStorage del navegador**
- **No hay servidor**, todo es local
- Para cambiar de dispositivo: Exporta > Importa o usa GitHub sync

### Tokens
- **GitHub Token**: Solo lectura/escritura de tu repo
- **Google OAuth**: Solo acceso a tu calendario
- **Nunca se sincronizan** con GitHub (solo local)
- Si compartes el PC, cierra sesión del navegador

### HTTPS
- Recomendado servir la app por HTTPS si usas en producción
- Los tokens OAuth de Google requieren HTTPS (excepto localhost)

## 📈 Escalabilidad

### ¿Cuántos datos soporta?
- **Estudiantes**: Sin límite práctico (hasta ~1000 fluido)
- **Clases**: Miles sin problema
- **localStorage**: ~5-10 MB (navegador web)

### Si creces mucho
- Considera backend con base de datos
- Usa la app actual como prototipo/MVP
- El código modular facilita migrar a API REST

## 🎨 Personalización

### Cambiar Mensajes
Edita `js/config.js`:
```javascript
export const MESSAGES = {
  saved: 'Guardado correctamente', // Cambia aquí
  // ...
};
```

### Cambiar Nombre de App
Edita `js/config.js`:
```javascript
export const APP_CONFIG = {
  appName: 'Mi Academia Personalizada',
  // ...
};
```

Y actualiza `index.html`:
```html
<title>Mi Academia Personalizada</title>
<h1 class="app-title">Mi Academia Personalizada</h1>
```

## 📞 Soporte

Para reportar bugs o sugerir mejoras:
1. Revisa el código en `js/`
2. Lee `DEVELOPER_GUIDE.md` para entender la arquitectura
3. Abre un issue o pull request en GitHub

---

**¡Disfruta usando Academia TIC!** 🎓
