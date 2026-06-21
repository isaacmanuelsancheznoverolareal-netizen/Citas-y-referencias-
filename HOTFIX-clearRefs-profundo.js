/**
 * ════════════════════════════════════════════════════════════════
 * HOTFIX: clearRefs() con borrado profundo (IRREVERSIBLE)
 * ════════════════════════════════════════════════════════════════
 * Este código REEMPLAZA la función clearRefs() existente
 * con una versión que borra TODO de manera profunda:
 * - IndexedDB: todos los stores
 * - LocalStorage
 * - SessionStorage
 * - Cookies
 * - DOM: limpia la UI
 */

// REEMPLAZAR la función existente clearRefs() con esta:
async function clearRefs() {
  // Confirmación adicional de seguridad
  const confirmaciones = [
    '⚠️ ADVERTENCIA: Esta acción es IRREVERSIBLE',
    '¿Está completamente seguro?',
    'Se eliminarán:',
    '  • Todas las referencias guardadas',
    '  • Todos los libros',
    '  • Todo el historial de búsqueda',
    '  • Todas las configuraciones',
    '  • Todos los datos locales',
    '',
    'Escriba: "BORRAR TODO" para confirmar'
  ];

  const confirmacion = prompt(confirmaciones.join('\n'));

  if (confirmacion !== 'BORRAR TODO') {
    toast('Cancelado: Datos protegidos', 'warn');
    return;
  }

  try {
    // 1. Mostrar spinner
    const spinWrap = document.getElementById('search-spin');
    if (spinWrap) {
      spinWrap.style.display = 'flex';
      spinWrap.innerHTML = `
        <div class="spinner"></div>
        <h3 style="font-family:'Orbitron',sans-serif;color:#ff3131;">🗑️ BORRANDO TODO...</h3>
        <p style="color:var(--err);font-size:.85rem;">Esta acción no se puede deshacer</p>
      `;
    }

    // 2. Borrar IndexedDB - PROFUNDO
    console.log('🗑️ Iniciando borrado profundo...');

    if (window.db) {
      const resultado = await IndexedDBUtils.borrarTodo(window.db);
      console.log('✓ IndexedDB borrado:', resultado);
    } else {
      // Si no hay db abierta, borrar la BD entera
      const dbRequest = indexedDB.deleteDatabase('AbraxasDB');
      await new Promise((resolve, reject) => {
        dbRequest.onsuccess = resolve;
        dbRequest.onerror = reject;
      });
      console.log('✓ Base de datos AbraxasDB eliminada');
    }

    // 3. Limpiar LocalStorage
    const keysLocales = [
      'abraxas_books',
      'abraxas_chunks',
      'abraxas_refs',
      'abraxas_search_hist',
      'abraxas_settings',
      'abraxas_backup',
      'abraxas_theme',
      'abraxas_activeAI',
      'theme',
      'activeAI'
    ];
    keysLocales.forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('✓ LocalStorage limpiado');

    // 4. Limpiar SessionStorage
    sessionStorage.clear();
    console.log('✓ SessionStorage limpiado');

    // 5. Limpiar Cookies
    document.cookie.split(';').forEach(c => {
      const nombreCookie = c.split('=')[0].trim();
      document.cookie = `${nombreCookie}=;expires=${new Date(0).toUTCString()};path=/;`;
    });
    console.log('✓ Cookies eliminadas');

    // 6. Limpiar DOM
    const elementsToEmpty = [
      'refs-list',
      'books-list',
      'search-results',
      'batch-queue-list'
    ];
    elementsToEmpty.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.innerHTML = '';
    });

    // 7. Limpiar contadores
    ['lib-count-nav', 'ref-count-nav', 'batch-queue-count', 'batch-done-count'].forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.textContent = '0';
    });

    // 8. Mostrar pantallas vacías
    const emptyScreens = ['refs-empty', 'books-empty', 'search-empty-lib'];
    emptyScreens.forEach(id => {
      const elem = document.getElementById(id);
      if (elem) elem.style.display = 'flex';
    });

    // 9. Esperar 2 segundos
    await new Promise(r => setTimeout(r, 2000));

    // 10. Mostrar confirmación
    toast('✓ TODO BORRADO DE MANERA PROFUNDA - Recargando aplicación...', 'ok');

    // 11. Recargar página después de 3 segundos
    setTimeout(() => {
      window.location.reload();
    }, 3000);

    console.log('✅ BORRADO PROFUNDO COMPLETADO - Aplicación se recargará');
  } catch (error) {
    console.error('❌ Error en borrado profundo:', error);
    toast('Error al borrar datos: ' + error.message, 'err');
    // Re-lanzar para debugging
    if (window.spinWrap) window.spinWrap.style.display = 'none';
  }
}

// Alias para otros nombres que puedan existir
const clearAllData = clearRefs;
const borrarTodo = clearRefs;
const deleteAllData = clearRefs;
