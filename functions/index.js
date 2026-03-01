/**
 * Cloud Functions para la app de suscripciones.
 * sendOneSignalTestNotification: proxy para enviar notificación de prueba desde el navegador (evita CORS).
 *
 * Configuración requerida:
 *   firebase functions:config:set onesignal.app_id="TU_APP_ID" onesignal.rest_key="Key TU_REST_API_KEY"
 */
const functions = require('firebase-functions');

const ONESIGNAL_API = 'https://api.onesignal.com/notifications';

/**
 * Envía una notificación de prueba programada para 1 minuto.
 * Llamada desde el cliente (notificaciones.html) para evitar CORS al llamar a OneSignal desde el navegador.
 *
 * Datos esperados: { subscriptionId: string }
 */
exports.sendOneSignalTestNotification = functions.https.onCall(async (data, context) => {
  const subscriptionId = data && data.subscriptionId;
  if (!subscriptionId || typeof subscriptionId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'Falta subscriptionId');
  }

  const config = functions.config().onesignal || {};
  const appId = config.app_id;
  const restKey = config.rest_key;
  if (!appId || !restKey) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Configura en Firebase: firebase functions:config:set onesignal.app_id="..." onesignal.rest_key="Key ..."'
    );
  }

  const in1Min = new Date(Date.now() + 60 * 1000);
  const body = {
    app_id: appId,
    target_channel: 'push',
    include_subscription_ids: [subscriptionId],
    contents: { en: 'Si ves esto, las notificaciones push funcionan correctamente.' },
    headings: { en: 'Prueba de notificación' },
    send_after: in1Min.toISOString(),
    data: { test: true }
  };

  const res = await fetch(ONESIGNAL_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': restKey.startsWith('Key ') ? restKey : 'Key ' + restKey
    },
    body: JSON.stringify(body)
  });

  const json = await res.json().catch(() => ({}));
  if (res.ok && json.id) {
    return { ok: true, notificationId: json.id };
  }
  const errMsg = (json.errors && Array.isArray(json.errors)) ? json.errors.join(', ') : (json.errors ? JSON.stringify(json.errors) : 'HTTP ' + res.status);
  throw new functions.https.HttpsError('internal', errMsg);
});
