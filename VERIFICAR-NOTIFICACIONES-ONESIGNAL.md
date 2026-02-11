# 🔍 Verificar Notificaciones en OneSignal Dashboard

Si ves "✅ Notificación programada enviada a OneSignal" pero las notificaciones no llegan, sigue estos pasos:

## 📋 Paso 1: Verificar en el Dashboard de OneSignal

1. Ve a: https://dashboard.onesignal.com/
2. Selecciona tu app
3. Ve a **Messages** > **History**
4. Busca notificaciones recientes

### ¿Dónde ver las programadas?

- **Messages** → **History**: ahí aparecen los mensajes enviados y también los **programados** (con fecha de envío futura). Cada recordatorio que envías al guardar una suscripción debería aparecer aquí con el nombre tipo "Recordatorio: [nombre] - [fecha/hora]".
- Si no ves ninguna entrada después de guardar, revisa que **ONESIGNAL_REST_API_KEY** esté en GitHub Secrets y que el deploy haya terminado.

### ¿Qué buscar?

- **Si ves notificaciones programadas**: OneSignal las recibió correctamente y las enviará a la hora indicada.
- **Si NO ves notificaciones**: Hay un problema al enviarlas (REST API Key, Player ID o formato de la API).

## 🔍 Paso 2: Revisar los Logs en la Consola

Después de guardar una suscripción, abre la consola del navegador y busca:

### ✅ Logs que deberías ver:

```
📬 Iniciando programación de notificaciones con OneSignal REST API...
✅ REST API Key encontrado: ...
📋 Notificaciones en localStorage: X
📤 Notificaciones a enviar: X
🔍 Intentando obtener Player ID...
✅ Player ID obtenido: ... (longitud: 36)
📨 Programando notificación para: ...
📅 Fecha convertida: ...
📤 Enviando a OneSignal: ...
✅ Notificación programada enviada a OneSignal
📋 Respuesta completa: { "id": "...", ... }
✅ ID de notificación OneSignal: ...
💡 La notificación se enviará en: ...
```

### ❌ Logs que indican problemas:

```
❌ REST API Key no configurado
⚠️ No se pudo obtener Player ID
❌ Error al enviar notificación a OneSignal
❌ Errores de OneSignal: [...]
```

## 🐛 Problemas Comunes y Soluciones

### Problema 1: "Player ID no obtenido"

**Síntomas:**
- Log muestra: `⚠️ No se pudo obtener Player ID`
- Las notificaciones se intentan enviar a "todos" en lugar de a ti

**Solución:**
1. Ve a la página de Configuración
2. Haz clic en "Suscribirse a Notificaciones Push"
3. Acepta los permisos
4. Espera unos segundos
5. Vuelve a guardar la suscripción

### Problema 2: "Fecha en el pasado"

**Síntomas:**
- Log muestra: `⚠️ La fecha está en el pasado`
- OneSignal puede rechazar notificaciones con fechas pasadas

**Solución:**
- Configura una hora de notificación que sea en el futuro
- Si la notificación ya pasó, edita la suscripción y configura una nueva hora

### Problema 3: "Error al enviar notificación"

**Síntomas:**
- Log muestra: `❌ Error al enviar notificación a OneSignal`
- Hay una respuesta de error de OneSignal

**Solución:**
1. Revisa los "Errores de OneSignal" en el log
2. Errores comunes:
   - **"Invalid player_id"**: El Player ID no es válido
   - **"Invalid app_id"**: El App ID no es correcto
   - **"Invalid date"**: El formato de fecha es incorrecto
   - **"Unauthorized"**: El REST API Key es incorrecto

### Problema 4: Notificación programada pero no llega

**Síntomas:**
- Log muestra: `✅ Notificación programada enviada a OneSignal`
- Hay un ID de notificación en la respuesta
- Pero la notificación no llega

**Posibles causas:**

1. **La fecha está muy lejana**: OneSignal puede tener límites
   - Solución: Configura una hora más cercana (dentro de 24 horas)

2. **El dispositivo no está suscrito**: Aunque el Player ID existe, el dispositivo puede no estar suscrito
   - Solución: Verifica en Configuración que estés suscrito

3. **Permisos de notificación deshabilitados**: El navegador bloquea las notificaciones
   - Solución: Habilita las notificaciones en la configuración del navegador

4. **La app está en modo "Do Not Disturb"**: iOS/Android puede estar bloqueando notificaciones
   - Solución: Desactiva "Do Not Disturb" o "No molestar"

## 📝 Información para Compartir

Si el problema persiste, comparte:

1. **Los logs completos** de la consola después de guardar una suscripción
2. **Screenshot del Dashboard de OneSignal** (Messages > History)
3. **El ID de notificación** que aparece en el log (si hay)
4. **La fecha y hora** que configuraste para la notificación
5. **Tu zona horaria**

## ✅ Verificación Rápida

Ejecuta esto en la consola después de guardar una suscripción:

```javascript
// Verificar REST API Key
console.log('REST API Key:', ONESIGNAL_CONFIG?.restApiKey ? '✅ Configurado' : '❌ No configurado');

// Verificar Player ID
if (typeof OneSignal !== 'undefined' && OneSignal.User) {
  OneSignal.User.PushSubscription.id.then(id => {
    console.log('✅ Player ID:', id);
  }).catch(e => {
    console.error('❌ Error obteniendo Player ID:', e);
  });
}

// Verificar notificaciones programadas
const scheduled = JSON.parse(localStorage.getItem('onesignalScheduled') || '[]');
console.log('Notificaciones programadas:', scheduled.length);
scheduled.forEach(n => {
  console.log(`  - ${n.subscriptionName}: ${n.notificationDate} (enviada: ${n.sent})`);
});
```

