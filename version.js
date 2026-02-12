// Sistema centralizado de versiones
// Este archivo maneja la versión de la aplicación en todas las páginas

// Versión base del código (actualizar cuando haya cambios importantes)
const APP_VERSION = '1.2.35';

// Función para comparar versiones (retorna 1 si v1 > v2, -1 si v1 < v2, 0 si iguales)
function compareVersions(v1, v2) {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

// Función para cargar y actualizar la versión
function cargarVersion() {
  const versionElement = document.getElementById('app-version') || document.getElementById('versionNumber');
  if (!versionElement) return;
  
  const versionHTML = APP_VERSION;
  const savedVersion = localStorage.getItem('appVersion');
  
  // SIEMPRE usar la versión del código como fuente de verdad
  // Actualizar el elemento y localStorage con la versión del código
  versionElement.textContent = `v${versionHTML}`;
  
  // Si hay una versión guardada diferente, mostrar mensaje
  if (savedVersion && savedVersion !== versionHTML) {
    const comparacion = compareVersions(versionHTML, savedVersion);
    if (comparacion > 0) {
      console.log(`🆕 Nueva versión detectada: ${savedVersion} → ${versionHTML}`);
    } else if (comparacion < 0) {
      console.warn(`⚠️ Versión guardada (${savedVersion}) es mayor que la del código (${versionHTML}). Usando versión del código.`);
    }
  }
  
  // Siempre actualizar localStorage con la versión del código
  localStorage.setItem('appVersion', versionHTML);
}

// Función para obtener la versión actual (siempre del código, no de localStorage)
function getCurrentVersion() {
  // Siempre devolver la versión del código, que es la fuente de verdad
  return APP_VERSION;
}

// Función para verificar si hay una nueva versión disponible
function checkForNewVersion() {
  const savedVersion = localStorage.getItem('appVersion') || APP_VERSION;
  const comparacion = compareVersions(APP_VERSION, savedVersion);
  
  if (comparacion > 0) {
    console.log(`🆕 Nueva versión disponible: ${savedVersion} → ${APP_VERSION}`);
    return true;
  }
  
  return false;
}

