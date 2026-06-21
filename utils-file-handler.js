/**
 * ════════════════════════════════════════════════════════════════
 * UTILITIES: File Handler & Deduplication System
 * ════════════════════════════════════════════════════════════════
 * Maneja:
 * - Validación de archivos (PDF/EPUB)
 * - Deduplicación inteligente (PDF + EPUB con mismo nombre)
 * - Detección de duplicados en IndexedDB
 * - Limpieza profunda de datos
 * - Error handling robusto
 */

const FileHandlerUtils = {
  // ── VALIDACIÓN ──
  validarArchivo(file) {
    const tiposValidos = ['application/pdf', 'application/epub+zip', 'application/x-epub+zip'];
    const tamañoMaxMB = 500;
    const tamañoBytes = file.size;
    const tamañoMB = tamañoBytes / (1024 * 1024);
    const extension = file.name.split('.').pop().toLowerCase();

    const errores = [];

    if (!tiposValidos.includes(file.type) && !['pdf', 'epub'].includes(extension)) {
      errores.push(`Tipo de archivo no soportado: ${file.type || 'desconocido'}`);
    }
    if (tamañoMB > tamañoMaxMB) {
      errores.push(`Archivo muy grande: ${tamañoMB.toFixed(2)}MB (máx: ${tamañoMaxMB}MB)`);
    }
    if (tamañoBytes === 0) {
      errores.push('Archivo vacío');
    }

    return { valido: errores.length === 0, errores };
  },

  // ── OBTENER NOMBRE BASE (sin extensión) ──
  obtenerNombreBase(nombreArchivo) {
    return nombreArchivo.replace(/\.[^/.]+$/, '').toLowerCase().trim();
  },

  // ── DETECTAR TIPO ──
  detectarTipo(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    return ext === 'pdf' ? 'pdf' : ext === 'epub' ? 'epub' : 'desconocido';
  },

  // ── BUSCAR DUPLICADOS EN INDEXEDDB ──
  async buscarDuplicadosPorNombre(nombreBase, db) {
    try {
      if (!db) return null;
      const tx = db.transaction(['books'], 'readonly');
      const store = tx.objectStore('books');
      const allBooks = await store.getAll();

      return allBooks.find(book => {
        const bookNameBase = this.obtenerNombreBase(book.filename || book.title || '');
        return bookNameBase === nombreBase;
      });
    } catch (error) {
      console.error('Error buscando duplicados:', error);
      return null;
    }
  },

  // ── LÓGICA DE DEDUPLICACIÓN PDF + EPUB ──
  async manejarPdfEpubDuplicados(archivos, db) {
    const agrupados = {};
    const archivosFinales = [];

    // Agrupar por nombre base
    for (const file of archivos) {
      const nombreBase = this.obtenerNombreBase(file.name);
      if (!agrupados[nombreBase]) {
        agrupados[nombreBase] = [];
      }
      agrupados[nombreBase].push(file);
    }

    // Procesar grupos
    for (const [nombreBase, archivosGrupo] of Object.entries(agrupados)) {
      const tienePdf = archivosGrupo.some(f => this.detectarTipo(f) === 'pdf');
      const tieneEpub = archivosGrupo.some(f => this.detectarTipo(f) === 'epub');

      if (tienePdf && tieneEpub) {
        // Preferir PDF si ambos existen
        const pdf = archivosGrupo.find(f => this.detectarTipo(f) === 'pdf');
        archivosFinales.push(pdf);
      } else if (archivosGrupo.length === 1) {
        // Si solo hay uno, usar ese
        archivosFinales.push(archivosGrupo[0]);
      } else {
        // Si hay múltiples del mismo tipo, usar el primero (o implementar otra lógica)
        archivosFinales.push(archivosGrupo[0]);
      }
    }

    return archivosFinales;
  },

  // ── HASH SIMPLE PARA DETECTAR DUPLICADOS DE CONTENIDO ──
  async calcularHashArchivo(file) {
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      console.error('Error calculando hash:', error);
      return null;
    }
  },

  // ── BUSCAR DUPLICADO POR CONTENIDO ──
  async buscarDuplicadoPorHash(hash, db) {
    try {
      if (!db) return null;
      const tx = db.transaction(['books'], 'readonly');
      const store = tx.objectStore('books');
      const allBooks = await store.getAll();
      return allBooks.find(book => book.contentHash === hash);
    } catch (error) {
      console.error('Error buscando por hash:', error);
      return null;
    }
  },
};

/**
 * ════════════════════════════════════════════════════════════════
 * INDEXEDDB UTILITIES: Limpieza profunda
 * ════════════════════════════════════════════════════════════════
 */
const IndexedDBUtils = {
  // ── ELIMINAR TODO DE MANERA PROFUNDA ──
  async borrarTodo(db) {
    if (!db) throw new Error('Base de datos no inicializada');

    try {
      const objetosStore = ['books', 'chunks', 'references', 'search_history', 'backups', 'settings'];
      const tx = db.transaction(objetosStore, 'readwrite');

      for (const store of objetosStore) {
        try {
          const objectStore = tx.objectStore(store);
          await objectStore.clear();
          console.log(`✓ ${store} limpiado`);
        } catch (e) {
          console.warn(`⚠ No se pudo limpiar ${store}:`, e);
        }
      }

      // Esperar a que termine la transacción
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = reject;
      });

      // Limpiar LocalStorage
      const keysLocales = [
        'abraxas_books',
        'abraxas_chunks',
        'abraxas_refs',
        'abraxas_search_hist',
        'abraxas_settings',
        'abraxas_backup',
        'theme',
        'activeAI'
      ];
      keysLocales.forEach(key => localStorage.removeItem(key));

      // Limpiar SessionStorage
      sessionStorage.clear();

      // Limpiar cookies de sesión (si existen)
      document.cookie.split(';').forEach(c => {
        document.cookie = c.replace(/^ +/, '').replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
      });

      console.log('✓ Borrado profundo completado: BD + LocalStorage + SessionStorage + Cookies');
      return { exito: true, mensaje: 'Borrado profundo completado' };
    } catch (error) {
      console.error('Error en borrado profundo:', error);
      throw error;
    }
  },

  // ── ELIMINAR DUPLICADOS DE CHUNKS ──
  async eliminarChunksDuplicados(db, bookId) {
    if (!db) return false;

    try {
      const tx = db.transaction(['chunks'], 'readwrite');
      const store = tx.objectStore('chunks');
      const allChunks = await store.getAll();
      const filterChunks = allChunks.filter(c => c.bookId === bookId);
      const hashes = new Set();
      const aEliminar = [];

      for (const chunk of filterChunks) {
        const hash = chunk.hash || this._hashChunk(chunk.text);
        if (hashes.has(hash)) {
          aEliminar.push(chunk.id);
        } else {
          hashes.add(hash);
        }
      }

      for (const id of aEliminar) {
        await store.delete(id);
      }

      console.log(`✓ ${aEliminar.length} chunks duplicados eliminados`);
      return true;
    } catch (error) {
      console.error('Error eliminando chunks duplicados:', error);
      return false;
    }
  },

  // ── ELIMINAR REFERENCIAS HUÉRFANAS ──
  async eliminarRefHuerfanas(db) {
    try {
      const txBooks = db.transaction(['books'], 'readonly');
      const storeBooks = txBooks.objectStore('books');
      const libros = await storeBooks.getAll();
      const idLibrosValidos = new Set(libros.map(b => b.id));

      const txRefs = db.transaction(['references'], 'readwrite');
      const storeRefs = txRefs.objectStore('references');
      const allRefs = await storeRefs.getAll();
      const aEliminar = [];

      for (const ref of allRefs) {
        if (ref.bookId && !idLibrosValidos.has(ref.bookId)) {
          aEliminar.push(ref.id);
        }
      }

      for (const id of aEliminar) {
        await storeRefs.delete(id);
      }

      console.log(`✓ ${aEliminar.length} referencias huérfanas eliminadas`);
      return true;
    } catch (error) {
      console.error('Error eliminando refs huérfanas:', error);
      return false;
    }
  },

  // ── HASH SIMPLE ──
  _hashChunk(text) {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  },
};

// Exportar para uso global
if (typeof window !== 'undefined') {
  window.FileHandlerUtils = FileHandlerUtils;
  window.IndexedDBUtils = IndexedDBUtils;
}