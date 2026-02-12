// Servicio para manejar Push Notifications con OneSignal
// OneSignal es 100% gratuito hasta 10,000 suscriptores

class OneSignalService {
  constructor() {
    this.initialized = false;
    this.subscribed = false;
    this.safariWebId = null;
  }

  // Esperar a que OneSignal SDK esté cargado usando OneSignalDeferred
  async waitForOneSignal() {
    // Verificar si OneSignalDeferred está disponible (método recomendado por OneSignal)
    if (typeof window !== 'undefined' && window.OneSignalDeferred) {
      return true;
    }

    // Verificar si OneSignal ya está disponible directamente
    if (typeof OneSignal !== 'undefined' && OneSignal.init) {
      return true;
    }

    if (typeof window !== 'undefined' && window.OneSignal) {
      return true;
    }

    // En PWA, esperar más tiempo (hasta 30 segundos)
    const isPWA = typeof window !== 'undefined' && (
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone || 
      document.referrer.includes('android-app://')
    );
    const maxWait = isPWA ? 30000 : 15000; // 30 segundos en PWA, 15 en web
    const checkInterval = 500; // Verificar cada 500ms (más lento para no sobrecargar)
    let elapsed = 0;

    while (elapsed < maxWait) {
      // Verificar OneSignalDeferred (método recomendado)
      if (typeof window !== 'undefined' && window.OneSignalDeferred) {
        // Si OneSignalDeferred está disponible, esperar un momento más
        // para que el SDK se inicialice desde OneSignalDeferred
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Verificar si OneSignal está disponible ahora
        if (typeof OneSignal !== 'undefined' && OneSignal.init) {
          return true;
        }
        
        // Si OneSignalDeferred tiene elementos, esperar más
        if (window.OneSignalDeferred.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Verificar OneSignal directamente
      if (typeof OneSignal !== 'undefined' && OneSignal.init) {
        return true;
      }
      
      if (typeof window !== 'undefined' && window.OneSignal) {
        return true;
      }

      await new Promise(resolve => setTimeout(resolve, checkInterval));
      elapsed += checkInterval;
    }

    console.error('OneSignal SDK no disponible después de esperar. Verificando script...');
    
    // Verificar si el script está en el DOM
    const scripts = document.querySelectorAll('script[src*="onesignal"]');
    if (scripts.length === 0) {
      console.error('❌ No se encontró el script de OneSignal en el DOM. Verifica que esté incluido en el HTML.');
    } else {
      console.log('✅ Script de OneSignal encontrado en el DOM:', scripts[0].src);
      console.log('⚠️ Pero OneSignal aún no está disponible.');
      console.log('💡 Posibles causas:');
      console.log('   1. Bloqueador de anuncios está bloqueando OneSignal');
      console.log('   2. Error de red al cargar el script');
      console.log('   3. El script se está cargando muy lento');
    }

    return false;
  }

  // Inicializar OneSignal
  async initialize(appId) {
    if (this.initialized) {
      return true;
    }

    // Verificar si OneSignal ya está inicializado por otro código
    if (typeof OneSignal !== 'undefined' && OneSignal.SDK_VERSION) {
      // Verificar si ya está inicializado intentando acceder a una propiedad que solo existe después de init
      try {
        // Si OneSignal ya está inicializado, no intentar inicializarlo de nuevo
        if (OneSignal.User && OneSignal.User.PushSubscription) {
          console.log('✅ OneSignal ya está inicializado, usando la instancia existente');
          this.initialized = true;
          return true;
        }
      } catch (e) {
        // Si hay error, probablemente no está inicializado, continuar
      }
    }

    // Esperar a que OneSignal SDK esté cargado
    const sdkLoaded = await this.waitForOneSignal();
    if (!sdkLoaded) {
      console.error('❌ OneSignal SDK no se cargó después de 10 segundos. Verifica que el script esté incluido correctamente.');
      return false;
    }

    if (typeof OneSignal === 'undefined') {
      console.error('❌ OneSignal SDK no está disponible.');
      return false;
    }

    // Validar App ID
    if (!appId || appId === 'TU_ONESIGNAL_APP_ID' || appId.trim() === '') {
      console.error('❌ App ID de OneSignal no configurado. Configura tu App ID en onesignal-config.js');
      return false;
    }

    // OneSignal SDK v16 solo permite HTTPS (no HTTP)
    if (typeof location !== 'undefined' && location.protocol !== 'https:') {
      console.warn('⚠️ OneSignal requiere HTTPS. Abre la app con https:// (ej. https://' + (location.hostname || 'tudominio.com') + ')');
      return false;
    }

    try {
      // Verificar si OneSignal ya está inicializado
      if (OneSignal.SDK_VERSION) {
        console.log('OneSignal SDK versión:', OneSignal.SDK_VERSION);
      }

      // Verificar si OneSignal ya está inicializado antes de intentar inicializarlo
      // Esto puede pasar si OneSignalDeferred.push() se ejecutó antes
      if (typeof OneSignal !== 'undefined' && OneSignal.SDK_VERSION) {
        try {
          // Intentar acceder a una propiedad que solo existe después de init
          // Si no lanza error, significa que ya está inicializado
          const test = OneSignal.User;
          if (test) {
            console.log('✅ OneSignal ya está inicializado (probablemente por OneSignalDeferred), usando la instancia existente');
            this.initialized = true;
            return true;
          }
        } catch (e) {
          // Si hay error, probablemente no está completamente inicializado, continuar
        }
        
        // También verificar si OneSignal ya está inicializado intentando acceder a una propiedad interna
        // Si OneSignal está inicializado, no deberíamos intentar inicializarlo de nuevo
        try {
          // Verificar si OneSignal tiene alguna propiedad que indique que está inicializado
          if (OneSignal.init && typeof OneSignal.init === 'function') {
            // Intentar verificar el estado de inicialización de otra manera
            // Si OneSignal ya está inicializado, intentar inicializarlo lanzará "SDK already initialized"
            // Pero es mejor verificar antes para evitar el error
          }
        } catch (e) {
          // Continuar con la inicialización
        }
      }

      // Inicializar OneSignal
      // Según la documentación de OneSignal v16, si no especificamos serviceWorkerPath,
      // OneSignal intentará usar OneSignalSDKWorker.js automáticamente
      // Si ya tenemos un Service Worker personalizado (sw.js), OneSignal puede tener conflictos
      // Por eso, dejamos que OneSignal maneje su Service Worker automáticamente
      try {
        const initOptions = {
          appId: appId,
          notifyButton: {
            enable: false, // No mostrar el botón de notificación por defecto
          },
          allowLocalhostAsSecureOrigin: true, // Permitir localhost para desarrollo
        };
        
        // Agregar Safari Web ID si está configurado (necesario para iOS)
        if (ONESIGNAL_CONFIG.safariWebId) {
          initOptions.safari_web_id = ONESIGNAL_CONFIG.safariWebId;
        }
        
        // No especificar serviceWorkerPath - dejar que OneSignal use su propio Service Worker
        // OneSignal buscará OneSignalSDKWorker.js en la raíz automáticamente
        // Nuestro sw.js manejará el caché, OneSignalSDKWorker.js manejará las notificaciones
        // Esto evita problemas con importScripts desde CDN en Service Workers personalizados
        
        await OneSignal.init(initOptions);
        console.log('✅ OneSignal inicializado correctamente');
        console.log('💡 OneSignal está usando su Service Worker automáticamente');
      } catch (initError) {
        // Si el error es "SDK already initialized", significa que ya está inicializado
        if (initError.message && initError.message.includes('already initialized')) {
          console.log('✅ OneSignal ya estaba inicializado, usando la instancia existente');
          this.initialized = true;
          return true;
        }
        
        // Si el error es del Service Worker, es normal si ya hay un SW registrado
        // OneSignal puede funcionar parcialmente sin su propio SW
        if (initError.message && (initError.message.includes('Service Worker') || initError.message.includes('serviceWorker'))) {
          console.log('ℹ️ OneSignal detectó un Service Worker existente');
          console.log('💡 OneSignal funcionará, pero puede usar el Service Worker existente en lugar del suyo');
          console.log('💡 Esto es normal si ya tienes un Service Worker personalizado (sw.js)');
          // Marcar como inicializado de todas formas - OneSignal puede funcionar parcialmente
          this.initialized = true;
          return true;
        }
        
        // Si es otro error, mostrarlo
        throw initError;
      }

      // Esperar un momento para asegurar que la inicialización se complete
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Marcar como inicializado
      this.initialized = true;
      return true;
    } catch (error) {
      // Si el error es "SDK already initialized", significa que ya está inicializado
      // Esto puede pasar si OneSignalDeferred.push() se ejecutó antes
      if (error.message && error.message.includes('already initialized')) {
        console.log('✅ OneSignal ya estaba inicializado, usando la instancia existente');
        this.initialized = true;
        return true;
      }
      
      // Si el error es del Service Worker, ignorarlo y continuar
      // OneSignal puede funcionar parcialmente sin su Service Worker
      if (error.message && error.message.includes('Service Worker')) {
        console.warn('⚠️ OneSignal no pudo registrar su Service Worker (esto es esperado)');
        console.warn('💡 OneSignal funcionará parcialmente - las notificaciones cuando la app está cerrada');
        console.warn('   usarán nuestro Service Worker local en lugar del de OneSignal');
        // Marcar como inicializado de todas formas
        this.initialized = true;
        return true;
      }
      
      // Si es otro error, mostrarlo
      console.error('❌ Error al inicializar OneSignal:', error);
      console.error('Detalles del error:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      return false;
    }
  }

  // Suscribirse a notificaciones push
  async subscribe() {
    if (!this.initialized) {
      console.error('❌ OneSignal no está inicializado');
      return false;
    }

    try {
      console.log('🔔 Iniciando proceso de suscripción a OneSignal...');
      
      // Verificar permisos actuales
      let permission = await OneSignal.Notifications.permissionNative;
      console.log('📋 Permiso actual:', permission);
      
      // Si no están concedidos, solicitarlos
      if (permission !== 'granted') {
        console.log('📢 Solicitando permisos de notificación...');
        permission = await OneSignal.Notifications.requestPermission();
        console.log('📋 Permiso después de solicitar:', permission);
      }
      
      if (permission === 'granted') {
        console.log('✅ Permisos concedidos, esperando a que OneSignal registre al usuario...');
        
        // OneSignal necesita tiempo para registrar al usuario después de conceder permisos
        // Intentar múltiples métodos para obtener el Player ID
        let playerId = null;
        let attempts = 0;
        const maxAttempts = 20; // Aumentado a 20 intentos (20 segundos)
        
        while (!playerId && attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Esperar 1 segundo entre intentos
          attempts++;
          
          try {
            // Método 1: OneSignal v16 (método principal)
            if (OneSignal.User && OneSignal.User.PushSubscription) {
              try {
                playerId = await OneSignal.User.PushSubscription.id;
                if (playerId) {
                  console.log(`✅ Player ID obtenido después de ${attempts} segundos:`, playerId.substring(0, 8) + '...');
                  break;
                }
              } catch (e) {
                // Continuar intentando
              }
            }
            
            // Método 2: Verificar si hay suscripción activa
            if (!playerId && OneSignal.User && OneSignal.User.PushSubscription) {
              try {
                const optedIn = await OneSignal.User.PushSubscription.optedIn;
                if (optedIn) {
                  // Si está optedIn, intentar obtener el ID de nuevo
                  playerId = await OneSignal.User.PushSubscription.id;
                  if (playerId) {
                    console.log(`✅ Player ID obtenido (optedIn=true) después de ${attempts} segundos:`, playerId.substring(0, 8) + '...');
                    break;
                  }
                }
              } catch (e) {
                // Continuar intentando
              }
            }
            
            // Método 3: Verificar estado de la suscripción
            if (!playerId && attempts % 5 === 0) {
              // Cada 5 intentos, mostrar progreso
              console.log(`⏳ Intento ${attempts}/${maxAttempts}: Esperando a que OneSignal registre al usuario...`);
              console.log('💡 Esto puede tomar hasta 20 segundos. OneSignal está creando el registro del usuario.');
            }
          } catch (e) {
            // Continuar intentando
            if (attempts % 5 === 0) {
              console.log(`⏳ Intento ${attempts}/${maxAttempts}: ${e.message || 'Esperando...'}`);
            }
          }
        }
        
        if (playerId) {
          console.log('✅ Player ID registrado:', playerId.substring(0, 8) + '...');
          console.log('✅ Suscrito a OneSignal correctamente');
          console.log('💡 El usuario debería aparecer en el dashboard de OneSignal en 30-60 segundos');
          console.log('💡 Ve a OneSignal Dashboard → Audience → Subscribers para verificar');
          this.subscribed = true;
          
          // Verificar también el estado de la suscripción
          try {
            const isOptedIn = await OneSignal.User.PushSubscription.optedIn;
            console.log('📋 Estado de suscripción (optedIn):', isOptedIn);
          } catch (e) {
            console.log('⚠️ No se pudo verificar optedIn:', e.message);
          }
          
          return true;
        } else {
          console.warn('⚠️ Permisos concedidos pero no se obtuvo Player ID después de', maxAttempts, 'segundos');
          console.warn('💡 Esto puede indicar un problema con la conexión o la configuración de OneSignal');
          console.warn('💡 Verifica:');
          console.warn('   1. Que el App ID sea correcto en onesignal-config.js');
          console.warn('   2. Que el sitio esté servido por HTTPS (requerido)');
          console.warn('   3. Que no haya bloqueadores de anuncios activos');
          console.warn('   4. Que el Service Worker de OneSignal esté funcionando');
          console.warn('   5. Que OneSignalSDKWorker.js sea accesible en la raíz del sitio');
          console.warn('');
          console.warn('💡 El usuario puede aparecer en OneSignal Dashboard después de unos minutos');
          console.warn('💡 Intenta verificar en OneSignal Dashboard → Audience → Subscribers en 2-3 minutos');
          this.subscribed = true; // Marcar como suscrito de todas formas
          return true;
        }
      } else {
        console.warn('⚠️ Permisos de notificación denegados:', permission);
        return false;
      }
    } catch (error) {
      console.error('❌ Error al suscribirse a OneSignal:', error);
      console.error('Detalles:', error.message, error.stack);
      return false;
    }
  }

  // Verificar si está suscrito
  async isSubscribed() {
    if (!this.initialized) {
      return false;
    }

    const OneSignalInstance = window.OneSignal || OneSignal;
    
    if (!OneSignalInstance) {
      return false;
    }

    try {
      // Verificar permisos
      const permission = await OneSignalInstance.Notifications.permissionNative;
      if (permission !== 'granted') {
        return false;
      }
      
      // Verificar si hay un player ID (indica que está suscrito)
      const userId = await OneSignalInstance.User.PushSubscription.id;
      return userId !== null && userId !== undefined;
    } catch (error) {
      console.error('Error verificando suscripción:', error);
      // Si falla, verificar al menos los permisos
      try {
        const permission = await OneSignalInstance.Notifications.permissionNative;
        return permission === 'granted';
      } catch (e) {
        return false;
      }
    }
  }
  
  // Obtener información del usuario
  async getUserInfo() {
    if (!this.initialized) {
      return null;
    }

    const OneSignalInstance = window.OneSignal || OneSignal;
    
    if (!OneSignalInstance) {
      return null;
    }

    try {
      const userId = await OneSignalInstance.User.PushSubscription.id;
      const permission = await OneSignalInstance.Notifications.permissionNative;
      return {
        userId: userId,
        permission: permission,
        subscribed: permission === 'granted' && userId !== null
      };
    } catch (error) {
      console.error('Error obteniendo info del usuario:', error);
      return null;
    }
  }

}

// Crear instancia global
let oneSignalService = null;
if (typeof OneSignalService !== 'undefined') {
  oneSignalService = new OneSignalService();
}

