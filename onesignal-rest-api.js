// Servicio para enviar notificaciones programadas usando OneSignal REST API
// Esto permite que las notificaciones funcionen cuando la app está cerrada

class OneSignalRESTService {
  constructor() {
    // Obtener estas credenciales desde el dashboard de OneSignal
    // Settings > Keys & IDs > REST API Key
    this.appId = ONESIGNAL_CONFIG?.appId || 'c9a462f2-6b41-40f2-80c3-d173c255c469';
    // El REST API Key se carga desde onesignal-config-local.js (no se sube a GitHub)
    // Si no existe, intentar leer desde ONESIGNAL_CONFIG (para desarrollo)
    this.restApiKey = ONESIGNAL_CONFIG?.restApiKey || null;
    // API actual de OneSignal (Messages); fallback a v1 legacy por compatibilidad
    this.apiUrlNew = 'https://api.onesignal.com/notifications?c=push';
    this.apiUrlLegacy = 'https://onesignal.com/api/v1/notifications';
    
    // Log para diagnóstico
    if (this.restApiKey) {
      console.log('✅ OneSignal REST API Key cargado:', this.restApiKey.substring(0, 8) + '...');
    } else {
      console.warn('⚠️ OneSignal REST API Key no encontrado. Verifica que esté en GitHub Secrets o onesignal-config-local.js');
    }
  }
  
  // Método para actualizar el REST API Key (por si se carga después)
  updateRestApiKey() {
    const newKey = ONESIGNAL_CONFIG?.restApiKey || null;
    if (newKey && newKey !== this.restApiKey) {
      this.restApiKey = newKey;
      console.log('✅ OneSignal REST API Key actualizado:', this.restApiKey.substring(0, 8) + '...');
    }
    return this.restApiKey;
  }

  // Enviar notificación programada a un usuario específico
  async sendScheduledNotification(notificationData, playerId) {
    if (!this.restApiKey) {
      console.error('❌ REST API Key no configurado. Ve a OneSignal Dashboard > Settings > Keys & IDs');
      return false;
    }

    if (!playerId) {
      console.error('❌ Player ID no proporcionado');
      return false;
    }

    // Asegurar que la fecha esté en formato ISO 8601 correcto
    // OneSignal requiere el formato: "YYYY-MM-DD HH:MM:SS GMT" o ISO 8601
    let sendAfterDate = notificationData.notificationDate;
    if (typeof sendAfterDate === 'string') {
      // Convertir a Date y luego a ISO string para asegurar formato correcto
      const date = new Date(sendAfterDate);
      if (!isNaN(date.getTime())) {
        // OneSignal acepta ISO 8601, que es lo que toISOString() produce
        sendAfterDate = date.toISOString();
        console.log('📅 Fecha convertida:', {
          original: notificationData.notificationDate,
          iso: sendAfterDate,
          local: date.toLocaleString('es-ES', { timeZone: 'America/Guatemala' })
        });
      } else {
        console.error('❌ Fecha inválida:', sendAfterDate);
        return false;
      }
    } else if (sendAfterDate instanceof Date) {
      sendAfterDate = sendAfterDate.toISOString();
    } else {
      console.error('❌ Tipo de fecha no válido:', typeof sendAfterDate);
      return false;
    }
    
    // Verificar que la fecha no esté en el pasado (OneSignal puede rechazarla)
    const notificationDate = new Date(sendAfterDate);
    const now = new Date();
    if (notificationDate < now) {
      console.warn('⚠️ La fecha está en el pasado. OneSignal puede rechazar notificaciones pasadas.');
      console.warn('   Fecha notificación:', notificationDate.toISOString());
      console.warn('   Fecha actual:', now.toISOString());
      console.warn('   Diferencia:', Math.round((now - notificationDate) / 1000), 'segundos');
    }

    // Nombre interno para ver la notificación en el dashboard de OneSignal (Messages)
    const messageName = `Recordatorio: ${(notificationData.subscriptionName || 'Suscripción').substring(0, 30)} - ${new Date(sendAfterDate).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}`;

    // Intentar primero API actual (api.onesignal.com) con Authorization: Key
    const authHeader = this.restApiKey.startsWith('Key ') ? this.restApiKey : `Key ${this.restApiKey}`;
    const payloadNew = {
      app_id: this.appId,
      target_channel: 'push',
      include_subscription_ids: [playerId],
      headings: { en: notificationData.title || 'Recordatorio de Suscripción' },
      contents: { en: notificationData.body || 'Tu suscripción vence pronto' },
      send_after: sendAfterDate,
      name: messageName,
      data: {
        subscriptionId: notificationData.subscriptionId,
        subscriptionName: notificationData.subscriptionName,
        nextPayment: notificationData.nextPayment
      }
    };

    const payloadLegacy = {
      app_id: this.appId,
      include_player_ids: [playerId],
      headings: { en: notificationData.title || 'Recordatorio de Suscripción' },
      contents: { en: notificationData.body || 'Tu suscripción vence pronto' },
      send_after: sendAfterDate,
      data: {
        subscriptionId: notificationData.subscriptionId,
        subscriptionName: notificationData.subscriptionName,
        nextPayment: notificationData.nextPayment
      }
    };

    console.log('📤 Enviando a OneSignal:', {
      app_id: this.appId,
      subscription_id: playerId.substring(0, 8) + '...',
      send_after: sendAfterDate,
      title: payloadNew.headings.en,
      name: messageName
    });

    try {
      // 1) Probar API actual (Authorization: Key)
      let response = await fetch(this.apiUrlNew, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify(payloadNew)
      });

      let result = await response.json();

      // Si la API nueva falla por targeting (400/invalid), probar API legacy
      if (!response.ok && (response.status === 400 || response.status === 401)) {
        console.log('🔄 Probando API legacy (v1)...');
        response = await fetch(this.apiUrlLegacy, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.restApiKey}`
          },
          body: JSON.stringify(payloadLegacy)
        });
        result = await response.json();
      }

      
      // Verificar si la respuesta es exitosa
      if (response.ok && response.status >= 200 && response.status < 300) {
        // Verificar que la respuesta tenga un ID (indica que se programó correctamente)
        if (result.id) {
          console.log('✅ Notificación programada enviada a OneSignal');
          console.log('📋 ID de notificación OneSignal:', result.id);
          console.log('📅 Fecha programada:', sendAfterDate);
          console.log('👤 Player ID:', playerId.substring(0, 8) + '...');
          console.log('💡 La notificación se enviará en:', sendAfterDate);
          console.log('📋 Respuesta completa:', JSON.stringify(result, null, 2));
          return true;
        } else {
          // Respuesta OK pero sin ID - puede ser un error
          console.error('❌ OneSignal respondió OK pero sin ID de notificación');
          console.error('📋 Respuesta completa:', JSON.stringify(result, null, 2));
          console.error('⚠️ Esto puede indicar que la notificación no se programó correctamente');
          
          // Verificar si hay errores en la respuesta
          if (result.errors && result.errors.length > 0) {
            console.error('❌ Errores en la respuesta:', result.errors);
          }
          
          return false;
        }
      } else {
        console.error('❌ Error al enviar notificación a OneSignal');
        console.error('📋 Respuesta de error:', JSON.stringify(result, null, 2));
        console.error('📤 Payload enviado:', JSON.stringify(payloadNew, null, 2));
        console.error('🔑 Status HTTP:', response.status);
        
        // Mostrar mensajes de error específicos
        if (result.errors) {
          console.error('❌ Errores de OneSignal:');
          result.errors.forEach((error, index) => {
            console.error(`   ${index + 1}. ${error}`);
          });
        }
        
        return false;
      }
    } catch (error) {
      console.error('❌ Error al enviar notificación:', error);
      return false;
    }
  }

  // Enviar notificación a todos los suscriptores (para pruebas)
  async sendToAll(notificationData) {
    if (!this.restApiKey) {
      console.error('❌ REST API Key no configurado');
      return false;
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.restApiKey}`
        },
        body: JSON.stringify({
          app_id: this.appId,
          included_segments: ['All'], // Enviar a todos
          headings: { en: notificationData.title || 'Recordatorio de Suscripción' },
          contents: { en: notificationData.body || 'Tu suscripción vence pronto' },
          send_after: notificationData.notificationDate,
          data: {
            subscriptionId: notificationData.subscriptionId,
            subscriptionName: notificationData.subscriptionName
          }
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        console.log('✅ Notificación programada enviada a todos:', result);
        return true;
      } else {
        console.error('❌ Error al enviar notificación:', result);
        return false;
      }
    } catch (error) {
      console.error('❌ Error al enviar notificación:', error);
      return false;
    }
  }

  // Programar todas las notificaciones pendientes
  async scheduleAllPendingNotifications() {
    console.log('📬 Iniciando programación de notificaciones con OneSignal REST API...');
    
    // Intentar actualizar el REST API Key por si se cargó después del constructor
    this.updateRestApiKey();
    
    // Verificar que el REST API Key esté disponible
    if (!this.restApiKey) {
      console.error('❌ REST API Key no configurado. Verifica que esté en GitHub Secrets o en onesignal-config-local.js');
      console.error('💡 Para verificar:');
      console.error('   1. Ve a GitHub → Settings → Secrets and variables → Actions');
      console.error('   2. Verifica que exista ONESIGNAL_REST_API_KEY');
      console.error('   3. Espera a que el workflow de deployment termine');
      console.error('   4. Recarga la página');
      return 0;
    }
    console.log('✅ REST API Key encontrado:', this.restApiKey.substring(0, 8) + '...');

    // Leer notificaciones programadas desde localStorage
    const scheduled = JSON.parse(localStorage.getItem('onesignalScheduled') || '[]');
    console.log(`📋 Notificaciones en localStorage: ${scheduled.length}`);
    
    const now = new Date();
    
    // Filtrar notificaciones que deben enviarse a OneSignal:
    // 1. Que no hayan sido enviadas ya (sent !== true)
    // 2. Que la fecha sea válida
    // 3. Que la fecha esté en el futuro (OneSignal programa con send_after y envía a la hora indicada)
    const toSend = scheduled.filter(notif => {
      // Omitir si ya fue enviada
      if (notif.sent === true) {
        return false;
      }
      
      if (!notif.notificationDate) {
        console.log(`⏭️ Notificación omitida (sin fecha): ${notif.id || 'sin ID'}`);
        return false;
      }
      
      const notifDate = new Date(notif.notificationDate);
      if (isNaN(notifDate.getTime())) {
        console.log(`⏭️ Notificación omitida (fecha inválida): ${notif.notificationDate}`);
        return false;
      }
      
      // Enviar a OneSignal todas las notificaciones futuras (OneSignal las programará con send_after)
      // Omitir solo si la fecha ya pasó (más de 1 minuto en el pasado para tolerancia)
      const timeDiff = notifDate.getTime() - now.getTime();
      const isFuture = timeDiff > -60000; // Permitir hasta 1 min en el pasado por desfase
      
      if (!isFuture) {
        console.log(`⏭️ Notificación omitida (ya pasó): ${notif.notificationDate}`);
      }
      
      return isFuture;
    });

    console.log(`📤 Notificaciones a enviar: ${toSend.length}`);

    if (toSend.length === 0) {
      console.log('ℹ️ No hay notificaciones programadas para enviar');
      return 0;
    }

    // Obtener el Player ID del usuario actual de OneSignal
    let playerId = null;
    try {
      if (typeof OneSignal === 'undefined') {
        console.warn('⚠️ OneSignal SDK no está disponible');
      } else {
        console.log('🔍 Intentando obtener Player ID...');
        
        // Método 1: OneSignal v16 (más reciente)
        if (OneSignal.User && OneSignal.User.PushSubscription) {
          try {
            playerId = await OneSignal.User.PushSubscription.id;
            console.log('✅ Player ID obtenido con OneSignal.User.PushSubscription.id');
          } catch (e) {
            console.log('⚠️ Error con OneSignal.User.PushSubscription.id:', e.message);
          }
        }
        
        // Método 2: Alternativo para versiones anteriores
        if (!playerId && OneSignal.getUserId) {
          try {
            playerId = await OneSignal.getUserId();
            console.log('✅ Player ID obtenido con OneSignal.getUserId()');
          } catch (e) {
            console.log('⚠️ Error con OneSignal.getUserId():', e.message);
          }
        }
        
        // Método 3: Verificar si hay suscripción activa
        if (!playerId && OneSignal.isPushNotificationsEnabled) {
          try {
            const isEnabled = await OneSignal.isPushNotificationsEnabled();
            if (isEnabled) {
              console.log('✅ Push notifications están habilitadas');
              // Intentar obtener de otra forma
              if (OneSignal.getSubscription) {
                const subscription = await OneSignal.getSubscription();
                if (subscription && subscription.id) {
                  playerId = subscription.id;
                  console.log('✅ Player ID obtenido con OneSignal.getSubscription()');
                }
              }
            } else {
              console.warn('⚠️ Push notifications no están habilitadas');
            }
          } catch (e) {
            console.log('⚠️ Error verificando push notifications:', e.message);
          }
        }
        
        if (playerId) {
          console.log(`✅ Player ID obtenido: ${playerId.substring(0, 8)}... (longitud: ${playerId.length})`);
          // Validar formato del Player ID (debe ser un UUID)
          if (playerId.length < 30) {
            console.warn('⚠️ Player ID parece tener un formato inusual');
          }
        } else {
          console.error('❌ No se pudo obtener Player ID con ningún método');
          console.error('💡 Asegúrate de estar suscrito a OneSignal en la página de configuración');
        }
      }
    } catch (e) {
      console.error('❌ Error al obtener Player ID:', e);
      console.error('Stack:', e.stack);
    }

    let sentCount = 0;
    const updatedScheduled = [...scheduled]; // Copia para actualizar
    
    for (const notif of toSend) {
      console.log(`📨 Programando notificación para: ${notif.subscriptionName} - ${notif.notificationDate}`);
      
      let sent = false;
      
      if (playerId) {
        // Enviar a usuario específico
        sent = await this.sendScheduledNotification(notif, playerId);
        if (sent) {
          sentCount++;
          console.log(`✅ Notificación programada exitosamente`);
        } else {
          console.error(`❌ Error al programar notificación para ${notif.subscriptionName}`);
        }
      } else {
        // Si no hay Player ID, enviar a todos (para pruebas)
        console.warn('⚠️ No hay Player ID, enviando a todos los suscriptores');
        sent = await this.sendToAll(notif);
        if (sent) {
          sentCount++;
          console.log(`✅ Notificación programada para todos`);
        }
      }
      
      // Marcar como enviada en la copia
      if (sent) {
        const index = updatedScheduled.findIndex(n => n.id === notif.id);
        if (index !== -1) {
          updatedScheduled[index].sent = true;
          updatedScheduled[index].sentAt = new Date().toISOString();
        }
      }
    }
    
    // Actualizar localStorage con las notificaciones marcadas como enviadas
    // Mantener las enviadas por un tiempo (30 días) para referencia, luego limpiar
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const cleanedScheduled = updatedScheduled.filter(notif => {
      // Mantener si no ha sido enviada
      if (!notif.sent) return true;
      // Mantener si fue enviada hace menos de 30 días
      if (notif.sentAt) {
        const sentDate = new Date(notif.sentAt);
        return sentDate > thirtyDaysAgo;
      }
      return true;
    });
    
    localStorage.setItem('onesignalScheduled', JSON.stringify(cleanedScheduled));
    console.log(`💾 localStorage actualizado: ${cleanedScheduled.length} notificaciones (${cleanedScheduled.filter(n => !n.sent).length} pendientes)`);

    console.log(`✅ Total de notificaciones programadas: ${sentCount}/${toSend.length}`);
    return sentCount;
  }
}

// Crear instancia global
const oneSignalRESTService = new OneSignalRESTService();

