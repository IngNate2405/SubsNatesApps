/**
 * OneSignal: programar recordatorios desde la app.
 * Una sola responsabilidad: al guardar una suscripción, enviar cada recordatorio a la API de OneSignal (send_after).
 * Requiere: HTTPS, REST API Key (Configuración o GitHub Secrets), y usuario suscrito a push.
 */
(function() {
  'use strict';

  const APP_ID = (typeof ONESIGNAL_CONFIG !== 'undefined' && ONESIGNAL_CONFIG.appId) ? ONESIGNAL_CONFIG.appId : 'c9a462f2-6b41-40f2-80c3-d173c255c469';
  const API_URL = 'https://api.onesignal.com/notifications';

  function getRestApiKey() {
    const fromConfig = typeof ONESIGNAL_CONFIG !== 'undefined' && ONESIGNAL_CONFIG.restApiKey;
    const fromStorage = typeof localStorage !== 'undefined' && localStorage.getItem('onesignal_rest_api_key');
    const key = (fromConfig && ONESIGNAL_CONFIG.restApiKey) || (fromStorage && fromStorage.trim()) || null;
    return key ? (key.startsWith('Key ') ? key : 'Key ' + key) : null;
  }

  async function getSubscriptionId() {
    if (typeof OneSignal === 'undefined') return null;
    try {
      if (OneSignal.User && OneSignal.User.PushSubscription) {
        const id = await OneSignal.User.PushSubscription.id;
        if (id) return id;
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 1500));
    try {
      if (OneSignal.User && OneSignal.User.PushSubscription)
        return await OneSignal.User.PushSubscription.id || null;
    } catch (e) {}
    return null;
  }

  function calculateNotificationDate(nextPayment, notificationType) {
    if (!notificationType || typeof notificationType !== 'string') return null;
    notificationType = notificationType.replace(/^trial_/, ''); // prueba gratuita
    const date = new Date(nextPayment);
    if (notificationType.startsWith('1day_')) {
      const time = (notificationType.split('_')[1] || '09:00').split(':');
      date.setDate(date.getDate() - 1);
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    if (notificationType.startsWith('2days_')) {
      const time = (notificationType.split('_')[1] || '09:00').split(':');
      date.setDate(date.getDate() - 2);
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    if (notificationType.startsWith('3days_')) {
      const time = (notificationType.split('_')[1] || '09:00').split(':');
      date.setDate(date.getDate() - 3);
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    if (notificationType.startsWith('7days_')) {
      const time = (notificationType.split('_')[1] || '09:00').split(':');
      date.setDate(date.getDate() - 7);
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    if (notificationType.startsWith('custom_')) {
      const parts = notificationType.split('_');
      const days = parseInt(parts[1], 10);
      const time = (parts[2] || '09:00').split(':');
      date.setDate(date.getDate() - (isNaN(days) ? 0 : days));
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    if (notificationType.startsWith('customdate_')) {
      const parts = notificationType.split('_');
      if (parts.length >= 5) {
        const y = parseInt(parts[1], 10), m = parseInt(parts[2], 10) - 1, d = parseInt(parts[3], 10);
        const t = (parts[4] || '09:00').split(':');
        return new Date(y, m, d, parseInt(t[0]) || 9, parseInt(t[1]) || 0, 0, 0);
      }
    }
    if (notificationType === 'sameday' || notificationType.startsWith('sameday_')) {
      const time = (notificationType.split('_')[1] || '09:00').split(':');
      date.setHours(parseInt(time[0]) || 9, parseInt(time[1]) || 0, 0, 0);
      return date;
    }
    return null;
  }

  async function sendOneToOneSignal(subscriptionId, payload) {
    const key = getRestApiKey();
    if (!key) return { ok: false, error: 'Falta la Clave REST API. Configuración → Push Notifications → pega la clave (OneSignal → Keys & IDs) y Guardar clave.' };

    const body = {
      app_id: APP_ID,
      target_channel: 'push',
      include_subscription_ids: [subscriptionId],
      contents: { en: payload.body || 'Tu suscripción vence pronto' },
      headings: { en: payload.title || 'Recordatorio' },
      send_after: payload.sendAfterIso,
      data: payload.data || {}
    };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': key },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.id) {
      console.log('✅ OneSignal: recordatorio programado', data.id);
      return { ok: true };
    }
    const errMsg = (data.errors && Array.isArray(data.errors)) ? data.errors.join(', ') : (data.errors ? JSON.stringify(data.errors) : 'HTTP ' + res.status);
    return { ok: false, error: errMsg };
  }

  /**
   * Programar en OneSignal todos los recordatorios de una suscripción.
   * @param {Object} subscription - { id, name, nextPayment, notifications[] }
   * @returns {Promise<{ sent: number, failed: number, error: string | null }>}
   */
  async function scheduleRemindersForSubscription(subscription) {
    const result = { sent: 0, failed: 0, error: null };
    if (!subscription || !subscription.notifications || subscription.notifications.length === 0 || !subscription.nextPayment) {
      return result;
    }

    const key = getRestApiKey();
    if (!key) {
      result.error = 'Falta la Clave REST API. Ve a Configuración → Push Notifications → pega tu Clave REST (OneSignal → Keys & IDs) y Guardar clave.';
      return result;
    }

    const subscriptionId = await getSubscriptionId();
    if (!subscriptionId) {
      result.error = 'No se detectó este dispositivo en OneSignal. Abre la app con https://, ve a Configuración → Notificaciones y pulsa Suscribirse.';
      return result;
    }

    const now = new Date();
    const nextPayment = new Date(subscription.nextPayment);
    const title = 'Recordatorio: ' + (subscription.name || 'Suscripción');
    const body = 'Tu suscripción "' + (subscription.name || '') + '" vence pronto';

    for (const notifType of subscription.notifications) {
      const date = calculateNotificationDate(nextPayment, notifType);
      if (!date || isNaN(date.getTime())) continue;
      if (date.getTime() <= now.getTime() + 5000) continue; // solo omitir si ya pasó o es en menos de 5 segundos

      const sendAfterIso = date.toISOString();
      const apiResult = await sendOneToOneSignal(subscriptionId, {
        title,
        body,
        sendAfterIso,
        data: { subscriptionId: subscription.id, subscriptionName: subscription.name, nextPayment: subscription.nextPayment }
      });

      if (apiResult.ok) result.sent++;
      else {
        result.failed++;
        if (!result.error) result.error = apiResult.error;
      }
    }

    return result;
  }

  /**
   * Envía una notificación de prueba que llegará en 1 minuto (para verificar que push funciona).
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  async function sendTestNotificationIn1Min() {
    const subscriptionId = await getSubscriptionId();
    if (!subscriptionId) {
      return { ok: false, error: 'No se detectó este dispositivo. Pulsa "Suscribirse a notificaciones push" primero.' };
    }
    const key = getRestApiKey();
    if (!key) {
      return { ok: false, error: 'Falta la Clave REST API. Pégala abajo y guarda.' };
    }
    const in1Min = new Date(Date.now() + 60 * 1000);
    const sendAfterIso = in1Min.toISOString();
    return await sendOneToOneSignal(subscriptionId, {
      title: 'Prueba de notificación',
      body: 'Si ves esto, las notificaciones push funcionan correctamente.',
      sendAfterIso,
      data: { test: true }
    });
  }

  window.OneSignalNotifications = {
    getRestApiKey,
    getSubscriptionId,
    scheduleRemindersForSubscription,
    sendTestNotificationIn1Min
  };
})();
