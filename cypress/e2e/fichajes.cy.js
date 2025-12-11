// Suite de pruebas automatizadas para la pantalla de Fichajes.
// Lee los datos desde Google Sheets, ejecuta cada caso y registra el resultado en Excel.
describe('FICHAJES - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const FICHAJES_URL_ABS = 'https://juancastilla.portalempleado.dev.novatrans.app/fichar?testing=novatranshorario';
  const FICHAJES_PATH = '/fichar';
  const LOGIN_PATH = '/login';

  // Helper: Verificar y navegar a la URL correcta de fichar con testing
  // (lo usamos para normalizar cualquier navegación previa entre casos)
  function verificarUrlFichar() {
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (currentUrl !== FICHAJES_URL_ABS) {
        cy.visit(FICHAJES_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
      } else {
        cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
      }
    });
  }

  // ================= Boot =================
  before(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (
        err.message?.includes('Component already registered') ||
        err.message?.includes('Snapshot missing on Livewire component') ||
        err.message?.includes('Component already initialized')
      ) {
        return false;
      }
      return true;
    });
  });

  after(() => {
    cy.procesarResultadosPantalla('Fichajes');
  });

  // Ejecutar ninguno (pausado temporalmente). Revertir a la lista completa cuando se desee.
  const CASOS_OK = new Set();

  // Casos temporalmente pausados (TC002 – TC037). Se pueden reactivar quitando este set.
  const CASOS_PAUSADOS = new Set(
    Array.from({ length: 36 }, (_, idx) => `TC${String(idx + 2).padStart(3, '0')}`)
  );

  it('Ejecutar casos OK de Fichajes desde Google Sheets', () => {
    cy.obtenerDatosExcel('Fichajes').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Fichajes`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter(c => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        const id = String(caso.caso || '').trim().toUpperCase();
        return CASOS_OK.has(id) && !CASOS_PAUSADOS.has(id);
      });

      cy.log(`Casos OK a ejecutar: ${casosFiltrados.length} -> ${casosFiltrados.map(c => c.caso).join(', ')}`);

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  });

  // ============== Helper: Extraer datos del Excel por etiqueta ==============
  // Busca dentro de los 11 pares valor/dato de la fila actual
  // y devuelve el primero que coincida con la etiqueta solicitada.
  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
        return casoExcel[`dato_${i}`] || '';
      }
    }
    return '';
  }

  // Conjuntos de etiquetas posibles tal como vienen desde Excel (permite flexibilidad)
  const LABELS_FECHA_ENTRADA = ['fecha entrada', 'fecha inicio', 'fecha'];
  const LABELS_FECHA_SALIDA = ['fecha salida', 'fecha fin'];
  const LABELS_HORA_ENTRADA = ['hora entrada', 'entrada', 'hora inicio'];
  const LABELS_HORA_SALIDA = ['hora salida', 'salida', 'hora fin'];
  const LABELS_MIN_ENTRADA = ['min entrada', 'minuto entrada', 'minutos entrada'];
  const LABELS_MIN_SALIDA = ['min salida', 'minuto salida', 'minutos salida'];
  const LABELS_ALERTA_ENTRADA = ['mensaje entrada', 'alerta entrada', 'mensaje registrar entrada', 'mensaje fichaje entrada'];
  const LABELS_ALERTA_SALIDA = ['mensaje salida', 'alerta salida', 'mensaje registrar salida', 'mensaje fichaje salida'];
  const ESPERA_SALIDA_MS = 10000;

  // Utilidad para rellenar los modales que piden “motivo” (mínimo 20 caracteres)
  // Genera una cadena aleatoria (se usa para rellenar los modales obligatorios).
  function generarTextoAleatorio(longitud = 20) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let resultado = '';
    for (let i = 0; i < longitud; i += 1) {
      const idx = Math.floor(Math.random() * caracteres.length);
      resultado += caracteres.charAt(idx);
    }
    return resultado;
  }

  // Convierte “HH:mm” a minutos para poder comparar horas fácilmente.
  function horaStringToMinutes(valor) {
    if (!valor) return null;
    const [horas, minutos] = valor.split(':').map(Number);
    if ([horas, minutos].some(Number.isNaN)) return null;
    return horas * 60 + minutos;
  }

  // Compara dos cadenas de hora. Devuelve 1, -1 o 0.
  function compararHoras(horaA, horaB) {
    const minutosA = horaStringToMinutes(horaA);
    const minutosB = horaStringToMinutes(horaB);
    if (minutosA === null || minutosB === null) return 0;
    if (minutosA === minutosB) return 0;
    return minutosA > minutosB ? 1 : -1;
  }

  // Variante flexible: acepta una lista de etiquetas y devuelve la primera que tenga valor.
  function obtenerDatoPorEtiquetas(casoExcel, etiquetas = []) {
    for (const etiqueta of etiquetas) {
      const valor = obtenerDatoPorEtiqueta(casoExcel, etiqueta);
      if (valor) return valor;
    }
    return '';
  }

  function pad2(valor) {
    if (valor === null || valor === undefined) return '';
    const str = String(valor).trim();
    if (!str) return '';
    return str.padStart(2, '0');
  }

  // Descompone entradas tipo “08:00”, “8h15”, “08 15”…
  function desglosarHora(valor) {
    if (!valor) return { h: '', m: '', s: '' };
    const str = String(valor).trim();
    if (!str) return { h: '', m: '', s: '' };
    const normalizada = str.replace(/[hHmMsS]/g, ':').replace(/\s+/g, '');
    const partes = normalizada.split(':').filter(p => p !== '');
    if (!partes.length) return { h: '', m: '', s: '' };

    const h = pad2(partes[0]);
    if (!h) return { h: '', m: '', s: '' };
    const m = pad2(partes[1] ?? '0') || '00';
    const s = pad2(partes[2] ?? '0') || '00';
    return { h, m, s };
  }

  // Normaliza horas a formato HH:mm y devuelve también los segundos (por si se necesitan).
  function normalizarHora({ base = '', hora = '', minuto = '', segundo = '', segundos = '' } = {}) {
    let { h, m, s } = desglosarHora(base);

    const horaNormalizada = pad2(hora);
    if (horaNormalizada) h = horaNormalizada;

    const minutoNormalizado = pad2(minuto);
    if (minutoNormalizado) m = minutoNormalizado;

    const segundoNormalizado = pad2(segundo || segundos);
    if (segundoNormalizado) s = segundoNormalizado;

    if (!h) return { time: '', segundos: '' };
    if (!m) m = '00';
    if (!s) s = '00';

    return { time: `${h}:${m}`, segundos: s };
  }

  // Determina si una cadena parece representar una hora válida.
  function esValorHoraPosible(valor) {
    if (valor === null || valor === undefined) return false;
    const str = String(valor).trim();
    if (!str) return false;
    if (/^\d{1,2}(:\d{2}){1,2}$/.test(str)) return true;
    if (/^\d{1,2}$/.test(str)) return true;
    if (/^\d{1,2}h\d{0,2}$/i.test(str)) return true;
    return false;
  }

  // Detecta etiquetas alternativas para “hora de entrada” (entry-start, reentrada, etc.).
  function esEtiquetaHoraEntradaGenerica(etiqueta) {
    const val = (etiqueta || '').toLowerCase();
    if (!val || val.includes('fecha')) return false;

    return (
      val.includes('hora_entrada') ||
      (val.includes('entrada') && val.includes('hora')) ||
      val.includes('entry-start') ||
      (val.includes('entrada') && /\d/.test(val)) ||
      val.includes('reentrada')
    );
  }

  // Idem para salidas (entry-end, exit, etc.).
  function esEtiquetaHoraSalidaGenerica(etiqueta) {
    const val = (etiqueta || '').toLowerCase();
    if (!val || val.includes('fecha')) return false;

    return (
      val.includes('hora_salida') ||
      (val.includes('salida') && val.includes('hora')) ||
      val.includes('entry-end') ||
      val.includes('exit') ||
      (val.includes('salida') && /\d/.test(val))
    );
  }

  function normalizarMensajesEsperados(mensaje) {
    if (!mensaje) return [];

    const convertir = (valor) =>
      String(valor || '')
        .split(/\r?\n+/)
        .flatMap(fragmento => fragmento.split(/[\|;]+/))
        .map(fragmento => fragmento.trim())
        .filter(Boolean);

    if (Array.isArray(mensaje)) {
      return mensaje.flatMap(convertir);
    }

    return convertir(mensaje);
  }

  // Acepta múltiples formatos (“dd/mm/aa”, “yyyy-mm-dd”, texto) y devuelve yyyy-mm-dd.
  function normalizarFecha(valor) {
    if (!valor) return '';
    const str = String(valor).trim();
    if (!str) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
    if (matchDMY) {
      let [, dia, mes, ano] = matchDMY;
      if (ano.length === 2) {
        ano = parseInt(ano, 10) > 50 ? `19${ano}` : `20${ano}`;
      }
      return `${ano.padStart(4, '0')}-${pad2(mes)}-${pad2(dia)}`;
    }

    const matchYMD = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (matchYMD) {
      const [, ano, mes, dia] = matchYMD;
      return `${ano}-${pad2(mes)}-${pad2(dia)}`;
    }

    const fecha = new Date(str);
    if (!Number.isNaN(fecha.getTime())) {
      return fecha.toISOString().slice(0, 10);
    }

    return str;
  }

  // Suma días a una fecha ISO (útil para cruces de medianoche).
  function sumarDiasISO(fechaISO, dias) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-').map(Number);
    if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return fechaISO;
    const [year, month, day] = partes;
    const fecha = new Date(Date.UTC(year, month - 1, day));
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  /**
   * Prepara la secuencia de pasos (entrada/salida) a partir del Excel.
   * Para TC021 se fuerza siempre a rellenar fecha en cada paso.
   */
  /**
   * Lee cada fila del Excel y arma la secuencia de pasos (entrada/salida) que
   * el caso debe ejecutar. El objetivo es desacoplar la lectura del Excel de la
   * interacción con la UI.
   */
  function prepararDatosFichaje(casoExcel, casoId) {
    const entradas = [];
    const salidas = [];
    const casoCruceDia = String(casoId || '').toUpperCase() === 'TC010';
    const hoyISO = new Date().toISOString().slice(0, 10);

    const fechaEntradaPreferente =
      normalizarFecha(obtenerDatoPorEtiquetas(casoExcel, LABELS_FECHA_ENTRADA)) ||
      normalizarFecha(casoExcel.dato_3);

    let fechaEntradaActual = fechaEntradaPreferente || hoyISO;
    let fechaEntradaExplicita = Boolean(fechaEntradaPreferente);

    const fechaSalidaPreferente =
      normalizarFecha(obtenerDatoPorEtiquetas(casoExcel, LABELS_FECHA_SALIDA)) ||
      normalizarFecha(casoExcel.dato_4);

    let fechaSalidaActual = fechaSalidaPreferente || fechaEntradaActual;
    let fechaSalidaExplicita = Boolean(fechaSalidaPreferente);

    // Cada fila del Excel puede definir hasta 11 pares etiqueta/dato. Recorremos todos.
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (!valorEtiqueta) continue;

      const dato = casoExcel[`dato_${i}`];
      if (dato === undefined || dato === null || dato === '') continue;

      if (valorEtiqueta.includes('fecha_entrada')) {
        const normalizada = normalizarFecha(dato);
        if (normalizada) {
          fechaEntradaActual = normalizada;
          fechaEntradaExplicita = true;
        } else {
          fechaEntradaActual = hoyISO;
          fechaEntradaExplicita = true;
        }
        if (String(casoId || '').toUpperCase() === 'TC023') {
          fechaEntradaActual = normalizarFecha('2025-11-29');
          fechaEntradaExplicita = true;
        }
        continue;
      }

      if (valorEtiqueta.includes('hora_entrada')) {
        const { time } = normalizarHora({ base: dato });
        if (time) {
          const fechaPaso = fechaEntradaActual || hoyISO;
          entradas.push({
            fecha: fechaPaso,
            hora: time,
            tocarFecha: fechaEntradaExplicita
          });
        }
        continue;
      }

      if (esEtiquetaHoraEntradaGenerica(valorEtiqueta) && esValorHoraPosible(dato)) {
        const { time } = normalizarHora({ base: dato });
        if (time) {
          const fechaPaso = fechaEntradaActual || hoyISO;
          entradas.push({
            fecha: fechaPaso,
            hora: time,
            tocarFecha: fechaEntradaExplicita
          });
        }
        continue;
      }

      if (valorEtiqueta.includes('fecha_salida')) {
        const normalizada = normalizarFecha(dato);
        if (normalizada) {
          fechaSalidaActual = normalizada;
          fechaSalidaExplicita = true;
        } else {
          fechaSalidaActual = fechaEntradaActual;
          fechaSalidaExplicita = true;
        }
        if (String(casoId || '').toUpperCase() === 'TC023') {
          fechaSalidaActual = normalizarFecha('2025-11-29');
          fechaSalidaExplicita = true;
        }
        continue;
      }

      if (valorEtiqueta.includes('hora_salida')) {
        const { time } = normalizarHora({ base: dato });
        if (time) {
          const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
          salidas.push({
            fecha: fechaPaso,
            hora: time,
            tocarFecha: fechaSalidaExplicita
          });
        }
        continue;
      }

      if (esEtiquetaHoraSalidaGenerica(valorEtiqueta) && esValorHoraPosible(dato)) {
        const { time } = normalizarHora({ base: dato });
        if (time) {
          const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
          salidas.push({
            fecha: fechaPaso,
            hora: time,
            tocarFecha: fechaSalidaExplicita
          });
        }
      }
    }

    const horaEntradaFallback = normalizarHora({
      base: obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) || casoExcel.dato_1
    }).time;

    if (!entradas.length && horaEntradaFallback) {
      const fechaPaso = fechaEntradaActual || hoyISO;
      entradas.push({
        fecha: fechaPaso,
        hora: horaEntradaFallback,
        tocarFecha: fechaEntradaExplicita
      });
    }

    const horaSalidaFallback = normalizarHora({
      base: obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) || casoExcel.dato_2
    }).time;

    if (!salidas.length && horaSalidaFallback) {
      const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
      salidas.push({
        fecha: fechaPaso,
        hora: horaSalidaFallback,
        tocarFecha: fechaSalidaExplicita
      });
    }

    // Resultado final: lista ordenada de pasos que usará la función `fichaje`
    const secuencia = [];
    const totalPasos = Math.max(entradas.length, salidas.length);

    if (!totalPasos) {
      cy.log('⚠️ No se encontraron instrucciones de entrada/salida en el Excel.');
      return { secuencia };
    }

    for (let i = 0; i < totalPasos; i++) {
      const entrada = entradas[i];
      if (entrada) {
        if (!entrada.fecha) entrada.fecha = fechaEntradaActual || hoyISO;

        secuencia.push({
          tipo: 'entrada',
          fecha: entrada.fecha,
          hora: entrada.hora,
          tocarFecha: Boolean(entrada.tocarFecha)
        });
      }

      const salida = salidas[i];
      if (salida) {
        if (!salida.fecha) salida.fecha = fechaSalidaActual || fechaEntradaActual || hoyISO;

        let fechaSalidaPaso =
          salida.fecha ||
          (entrada && entrada.fecha) ||
          fechaSalidaActual ||
          fechaEntradaActual ||
          hoyISO;
        let tocarFechaSalida =
          salida.fecha ? Boolean(salida.tocarFecha) : true;

        if (entrada && casoCruceDia) {
          fechaSalidaPaso = sumarDiasISO(entrada.fecha, 1);
          tocarFechaSalida = true;
        } else if (
          entrada &&
          entrada.fecha &&
          salida.hora &&
          compararHoras(salida.hora, entrada.hora) < 0 &&
          fechaSalidaPaso === entrada.fecha
        ) {
          fechaSalidaPaso = sumarDiasISO(entrada.fecha, 1);
          tocarFechaSalida = true;
        }

        secuencia.push({
          tipo: 'salida',
          fecha: fechaSalidaPaso,
          hora: salida.hora,
          tocarFecha: tocarFechaSalida
        });
      }

    }

    return { secuencia };
  }

  /**
   * Setea el valor de cualquier input (date, time, text, number, etc.) y dispara los eventos
   * necesarios para que la UI reaccione como si el usuario lo hubiese escrito manualmente.
   */
  function establecerValorInput(selector, valor) {
    if (valor === null || valor === undefined || valor === '') return cy.wrap(null);

    return cy.get(selector, { timeout: 10000 })
      .should('be.visible')
      .should('not.be.disabled')
      .then($input => {
        const tipo = ($input.attr('type') || '').toLowerCase();
        if (tipo === 'date' || tipo === 'time') {
          // Para campos date y time, usar invoke('val') y luego disparar eventos
          cy.wrap($input)
            .invoke('val', valor)
            .then(() => {
              cy.wrap($input)
                .trigger('input', { force: true })
                .trigger('change', { force: true })
                .trigger('blur', { force: true });
            });
        } else if (tipo === 'number') {
          cy.wrap($input)
            .clear({ force: true })
            .type(String(valor), { force: true });
        } else {
          cy.wrap($input)
            .clear({ force: true })
            .type(String(valor), { force: true });
        }
      });
  }

  /**
   * Acepta o rechaza una advertencia/modal, y en el caso de aceptar
   * rellena el motivo con 20 letras aleatorias en el textarea visible.
   */
  /**
   * Maneja los distintos modales de Filament: valida el texto, rellena el textarea si hace falta
   * y pulsa el botón correcto (Aceptar o Rechazar). Se usa en todos los casos con alertas.
   */
  function aceptarAdvertenciaSiExiste(opciones = {}) {
    const {
      timeout = 4000,
      mensajeEsperado,
      accion = 'omitir'
    } = opciones;

    const mensajesEsperados = normalizarMensajesEsperados(mensajeEsperado);
    const accionNormalizada = (accion || '').toLowerCase();

    return cy.get('body').then(($body) => {
      // ¿Hay modal / textarea visible?
      const hayModal =
        $body.text().includes('Entrada incorrecta') ||
        $body.text().includes('Salida incorrecta') ||
        $body.text().includes('Validaciones pendientes') ||
        $body.text().includes('Está entrando fuera del horario permitido') ||
        $body.text().includes('Está saliendo fuera del horario permitido') ||
        $body.find('textarea.notification-textarea').length > 0;

      if (!hayModal) {
        return cy.wrap(null);
      }

      // Si viene "omitir" pero hay que seguir, lo forzamos a aceptar
      let accionFinal = accionNormalizada;
      if (accionFinal === 'omitir') {
        accionFinal = 'aceptar';
      }

      const esAceptar = accionFinal === 'aceptar';
      const esRechazar = accionFinal === 'rechazar';

      let chain = cy.wrap(null);

      // Validar texto del modal si hay mensajes esperados
      if (mensajesEsperados.length) {
        chain = chain.then(() =>
          cy.get('.notification-content', { timeout })
            .first()
            .invoke('text')
            .then((texto) => {
              const textoNormalizado = texto.replace(/\s+/g, ' ').toLowerCase();
              const faltantes = mensajesEsperados.filter(
                (m) => !textoNormalizado.includes(m.toLowerCase())
              );

              expect(
                faltantes.length,
                `El mensaje de alerta debe contener: ${mensajesEsperados.join(' | ')}`
              ).to.eq(0);
            })
        );
      }

      // Si solo queremos validar el texto, salimos aquí
      if (!esAceptar && !esRechazar) {
        return chain;
      }

      // 👉 Si vamos a aceptar, rellenar el motivo con 20 letras aleatorias
      if (esAceptar) {
        chain = chain.then(() => {
          const textoMotivo = generarTextoAleatorio(20);
          return cy.get('textarea.notification-textarea', { timeout })
            .first()
            .should('be.visible')
            .clear({ force: true })
            .type(textoMotivo, { force: true });
        });
      }

      // 👉 Click en Aceptar / Rechazar dentro del bloque de botones del modal
      chain = chain.then(() => {
        let selectorBoton;

        if (esAceptar) {
          // Botón azul "Aceptar" del modal
          selectorBoton =
            '.notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.notification-buttons .btn-notification.btn-primary';
        } else if (esRechazar) {
          // Botón secundario (Rechazar / Cancelar) por si algún caso lo usa
          selectorBoton =
            '.notification-buttons .btn-notification.btn-secondary[data-action="reject"], ' +
            '.notification-buttons .btn-notification.btn-secondary';
        }

        if (!selectorBoton) {
          return cy.wrap(null);
        }

        return cy.get(selectorBoton, { timeout })
          .first()
          .click({ force: true });
      })
        .then(() => cy.wait(400));

      return chain;
    });
  }

  function asegurarBotonFichajeVisible(tipo) {
    return obtenerBotonFichaje(tipo)
      .should('exist')
      .should('be.visible');
  }

  function asegurarBotonFichajeNoVisible(tipo) {
    const legacySelector = tipo === 'entrada' ? '#btn-registrar-entrada' : '#btn-registrar-salida';
    const textoRegex = tipo === 'entrada' ? /\bEntrada\b/i : /\bSalida\b/i;

    return cy.get('body').then(($body) => {
      if ($body.find(legacySelector).length) {
        return cy.get(legacySelector).should('not.be.visible');
      }

      return cy.contains('button, a, [role="button"]', textoRegex).should('not.exist');
    });
  }

  /**
   * IMPORTANTE: aquí es donde forzamos la FECHA de entrada
   * si el paso viene con `forzarFecha = true` (solo TC021).
   */
  function rellenarCamposEntrada(paso) {
    let chain = cy.wrap(null);

    const fechaEntrada = (paso.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const siempreForzarFecha = true; // siempre sobrescribimos la fecha para evitar residuos de la UI

    if (siempreForzarFecha) {
      chain = chain
        .then(() => {
          cy.log(`Rellenando fecha de entrada: ${fechaEntrada}`);
          return establecerValorInput('#input_fecha_entrada', fechaEntrada);
        })
        .then(() => cy.wait(300));
    }

    if (paso.hora) {
      chain = chain
        .then(() => {
          const horaEntrada = paso.hora || '08:00';
          cy.log(`Rellenando hora de entrada: ${horaEntrada}`);
          return establecerValorInput('#input_hora_entrada', horaEntrada);
        })
        .then(() => cy.wait(300));
    }

    return chain;
  }

  function rellenarCamposSalida(paso) {
    let chain = cy.wrap(null);

    const fechaSalida = (paso.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const siempreForzarFecha = true; // mismo criterio para la salida

    if (siempreForzarFecha) {
      chain = chain
        .then(() => {
          cy.log(`Rellenando fecha de salida: ${fechaSalida}`);
          return establecerValorInput('#input_fecha_salida', fechaSalida);
        })
        .then(() => cy.wait(300));
    }

    if (paso.hora) {
      chain = chain
        .then(() => {
          const horaSalida = paso.hora || '17:00';
          cy.log(`Rellenando hora de salida: ${horaSalida}`);
          return establecerValorInput('#input_hora_salida', horaSalida);
        })
        .then(() => cy.wait(300));
    }

    return chain;
  }

  // Casos que dejan la UI en un estado “sucio”: al terminar recargamos la página.
  const CASOS_FICHAJE_RECARGAR = new Set([
    'TC007', 'TC008', 'TC009', 'TC010', 'TC011', 'TC012', 'TC013', 'TC014', 'TC015',
    'TC017', 'TC018', 'TC019', 'TC020', 'TC021', 'TC022', 'TC023', 'TC024', 'TC025',
    'TC026', 'TC027', 'TC028'
  ]);

  const CASOS_FICHAJE_TRABAJO = new Set(['TC024', 'TC025', 'TC026', 'TC027']);

  // Casos donde debemos aceptar la alerta (se pide un “motivo” y continuamos)
  const CASOS_ALERTA_ACEPTAR = new Set([
    'TC008', 'TC009', 'TC010', 'TC015', 'TC019', 'TC020'
  ]);
  const CASOS_ALERTA_WARNING = new Set();

  function obtenerConfiguracionCasoFichaje(casoId) {
    const base = {
      accionAlertaEntrada: 'omitir',
      accionAlertaSalida: 'omitir',
      validarEntradaDuplicada: false,
      salidaSinEntrada: false,
      verificarEntradaNoRegistradaTrasCancelar: true
    };

    if (CASOS_FICHAJE_RECARGAR.has(casoId)) {
      base.accionAlertaEntrada = 'omitir';
      base.accionAlertaSalida = 'omitir';
      base.verificarEntradaNoRegistradaTrasCancelar = false;
    }

    // Para estos casos queremos ACEPTAR la alerta (y escribir el motivo)
    if (CASOS_ALERTA_ACEPTAR.has(casoId)) {
      base.accionAlertaEntrada = 'aceptar';
      base.accionAlertaSalida = 'aceptar';
    }

    switch (casoId) {
      case 'TC014':
      case 'TC023':
        base.validarEntradaDuplicada = true;
        break;
      case 'TC022':
        base.salidaSinEntrada = true;
        break;
      default:
        break;
    }

    return base;
  }

  function construirSelectorDesdeEtiqueta(etiqueta, valor) {
    const attr = (etiqueta || '').toLowerCase().trim();
    if (!attr || !valor) return '';

    switch (attr) {
      case 'id':
        return `#${valor}`;
      case 'name':
        return `[name="${valor}"]`;
      case 'data-testid':
        return `[data-testid="${valor}"]`;
      case 'aria-label':
        return `[aria-label="${valor}"]`;
      case 'selector':
      case 'css':
        return valor;
      default:
        return valor;
    }
  }

  function recopilarInstruccionesFormulario(casoExcel) {
    const instrucciones = [];

    for (let i = 1; i <= 11; i++) {
      const atributo = (casoExcel[`etiqueta_${i}`] || '').toLowerCase().trim();
      const valorAtributo = (casoExcel[`valor_etiqueta_${i}`] || '').trim();
      const dato = casoExcel[`dato_${i}`];
      if (!atributo || !valorAtributo) continue;
      if (dato === undefined || dato === null || dato === '') continue;

      const selector = construirSelectorDesdeEtiqueta(atributo, valorAtributo);
      if (!selector) continue;

      instrucciones.push({ selector, valor: dato });
    }

    return instrucciones;
  }

  function aplicarInstruccionesTrabajo(casoExcel, opciones = {}) {
    const instrucciones = recopilarInstruccionesFormulario(casoExcel);
    if (!instrucciones.length) {
      cy.log('⚠️ No se definieron instrucciones en el Excel para este caso de edición.');
      return cy.wrap(null);
    }

    const {
      mensajeEsperado,
      accionAdvertencia = 'aceptar',
      botonConfirmar = /Aceptar/i,
      textoModalConfirm = /(Editar (entrada|salida)|¿Estás seguro)/i
    } = opciones;

    let chain = asegurarSesionFichar(casoExcel);

    // Hacer scroll hasta encontrar la sección "Trabajo"
    chain = chain
      .then(() => {
        cy.log('Buscando sección "Trabajo" y haciendo scroll...');
        // Intentar encontrar el elemento de Trabajo por diferentes selectores
        return cy.get('body', { timeout: 10000 }).then(($body) => {
          // Buscar el elemento que contiene "Trabajo" por ID, clase o texto
          const selectoresTrabajo = [
            '#work-session-block',
            '.time-block-work',
            '[class*="trabajo"]',
            '[id*="trabajo"]'
          ];

          let encontrado = false;
          for (const selector of selectoresTrabajo) {
            const elemento = $body.find(selector).first();
            if (elemento.length) {
              const elementTop = elemento.offset().top;
              cy.window().scrollTo(0, elementTop - 150);
              cy.wait(500);
              cy.log(`Scroll realizado hasta la sección Trabajo (selector: ${selector})`);
              encontrado = true;
              break;
            }
          }

          if (!encontrado) {
            // Si no se encuentra por selector, buscar por texto "Trabajo"
            const trabajoPorTexto = $body.find('*').filter((_, el) => {
              const texto = Cypress.$(el).text().toLowerCase();
              return texto.includes('trabajo') && !texto.includes('trabajos');
            }).first();

            if (trabajoPorTexto.length) {
              const elementTop = trabajoPorTexto.offset().top;
              cy.window().scrollTo(0, elementTop - 150);
              cy.wait(500);
              cy.log('Scroll realizado hasta "Trabajo" (por texto)');
            } else {
              // Scroll genérico hacia abajo para asegurar que se vea la sección
              cy.window().scrollTo(0, 800);
              cy.wait(500);
              cy.log('Scroll genérico realizado');
            }
          }
        });
      });

    instrucciones.forEach(({ selector, valor }) => {
      chain = chain
        .then(() => {
          cy.log(`Actualizando ${selector} -> ${valor}`);
          return establecerValorInput(selector, String(valor));
        })
        .then(() => {
          // Después de cambiar un campo, esperar un momento y verificar si aparece el modal
          cy.wait(500);

          // Verificar si aparece el modal de confirmación "Editar entrada" / "Editar salida"
          return cy.get('body', { timeout: 5000 }).then(($body) => {
            const textoBody = $body.text();
            const tieneModalEditar = textoBody.includes('Editar entrada') ||
              textoBody.includes('Editar salida') ||
              textoBody.includes('Estás seguro') ||
              textoBody.includes('deseas modificar');

            if (tieneModalEditar) {
              cy.log('Modal de confirmación detectado después de cambiar hora -> pulsando "Sí"');
              // Buscar el botón "Sí" directamente
              return cy.contains('button, a', /^s[íi]$/i, { timeout: 5000 })
                .should('be.visible')
                .click({ force: true })
                .then(() => {
                  // Esperar a que el modal desaparezca
                  cy.wait(500);
                  // Verificar que el modal ya no está visible
                  return cy.get('body').should(($b) => {
                    const texto = $b.text();
                    expect(texto.includes('Editar entrada') || texto.includes('Editar salida')).to.be.false;
                  }, { timeout: 3000 });
                });
            }
            return cy.wrap(null);
          });
        });
    });

    chain = chain
      .then(() => {
        // Esperar un momento adicional después de todas las instrucciones
        cy.wait(500);

        // Verificar una vez más si aparece el modal después de todos los cambios
        return cy.get('body', { timeout: 5000 }).then(($body) => {
          const textoBody = $body.text();
          const tieneModalEditar = textoBody.includes('Editar entrada') ||
            textoBody.includes('Editar salida') ||
            textoBody.includes('Estás seguro') ||
            textoBody.includes('deseas modificar');

          if (tieneModalEditar) {
            cy.log('Modal de confirmación detectado después de todos los cambios -> pulsando "Sí"');
            return cy.contains('button, a', /^s[íi]$/i, { timeout: 5000 })
              .should('be.visible')
              .click({ force: true })
              .then(() => {
                // Esperar a que el modal desaparezca completamente
                cy.wait(500);
                return cy.get('body').should(($b) => {
                  const texto = $b.text();
                  expect(texto.includes('Editar entrada') || texto.includes('Editar salida')).to.be.false;
                }, { timeout: 3000 });
              });
          }
          return cy.wrap(null);
        });
      })
      .then(() => {
        // Las acciones suelen estar al final del bloque "Trabajo": buscar y hacer scroll hasta el botón.
        // Primero obtener la posición actual del scroll ANTES de buscar el botón
        return cy.window().then((win) => {
          const currentScrollY = win.scrollY || win.pageYOffset || 0;
          cy.log(`Posición actual del scroll: ${currentScrollY}`);

          // Buscar el botón en el DOM sin hacer scroll
          return cy.get('body', { timeout: 10000 }).then(($body) => {
            // Intentar encontrar el botón por clase
            let $boton = $body.find('button.btn-time-action.btn-time-accept, button.btn-time-accept').first();

            // Si no se encuentra, buscar por texto
            if (!$boton.length) {
              $boton = $body.find('button, a').filter((_, el) => {
                const texto = Cypress.$(el).text().trim();
                return botonConfirmar.test(texto);
              }).first();
            }

            if ($boton.length) {
              const botonTop = $boton.offset().top;
              const viewportHeight = win.innerHeight;

              // Calcular si el botón está visible en el viewport actual
              const botonVisible = botonTop >= currentScrollY && botonTop <= (currentScrollY + viewportHeight - 200);

              cy.log(`Botón encontrado en posición: ${botonTop}, visible: ${botonVisible}`);

              if (!botonVisible) {
                // IMPORTANTE: Solo hacer scroll hacia abajo, NUNCA hacia arriba
                // Usar Math.max para asegurar que nunca bajemos de la posición actual
                const scrollPosition = Math.max(currentScrollY, botonTop - 200);
                cy.log(`Haciendo scroll hacia abajo a posición: ${scrollPosition} (desde ${currentScrollY})`);
                cy.window().scrollTo(0, scrollPosition, { ensureScrollable: false });
                cy.wait(600);
              } else {
                cy.log('Botón ya visible en viewport, NO se hace scroll');
              }

              // Esperar a que el botón se vuelva visible y hacer clic
              return cy.wrap($boton)
                .should('exist')
                .should(($el) => {
                  const display = Cypress.$($el).css('display');
                  expect(display).to.not.equal('none');
                }, { timeout: 5000 })
                .should('be.visible', { timeout: 5000 })
                .click({ force: true });
            } else {
              // Fallback: usar cy.contains (último recurso)
              cy.log('Botón no encontrado por clase/texto, usando cy.contains como fallback');
              return cy.contains('button, a', botonConfirmar, { timeout: 10000 })
                .then(($btn) => {
                  const botonTop = $btn.offset().top;
                  // Solo hacer scroll hacia abajo desde la posición actual
                  const scrollPosition = Math.max(currentScrollY, botonTop - 200);
                  cy.window().scrollTo(0, scrollPosition, { ensureScrollable: false });
                  cy.wait(600);
                  return cy.wrap($btn);
                })
                .should('be.visible', { timeout: 5000 })
                .click({ force: true });
            }
          });
        });
      })
      .then(() =>
        aceptarAdvertenciaSiExiste({
          timeout: 4000,
          mensajeEsperado,
          accion: accionAdvertencia
        })
      )
      .then(() => cy.wait(800));

    return chain;
  }

  function obtenerBotonFichaje(tipo) {
    const legacySelector = tipo === 'entrada' ? '#btn-registrar-entrada' : '#btn-registrar-salida';
    const textoRegex = tipo === 'entrada' ? /\bEntrada\b/i : /\bSalida\b/i;

    return cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find(legacySelector).length) {
        return cy.get(legacySelector, { timeout: 10000 });
      }

      const candidatos = $body
        .find('button, a, [role="button"]')
        .filter((_, el) => textoRegex.test(el.innerText || el.textContent || ''));

      if (candidatos.length) {
        return cy.wrap(candidatos.eq(0));
      }

      return cy.contains('button, a, [role="button"]', textoRegex, { timeout: 10000 });
    });
  }

  function clickBotonFichaje(tipo) {
    return obtenerBotonFichaje(tipo)
      .should('be.visible')
      .should('not.be.disabled')
      .scrollIntoView()
      .click({ force: true });
  }

  // Garantiza que la sesión esté iniciada en la pantalla de fichajes
  function asegurarSesionFichar(casoExcel) {
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes(LOGIN_PATH)) {
        const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || 'superadmin@novatrans.app';
        const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || 'solbyte';

        cy.log(`Iniciando sesión manualmente como ${usuario}`);

        return cy.get('input#usuario', { timeout: 10000 })
          .should('be.visible')
          .clear()
          .type(usuario, { delay: 10 })
          .then(() =>
            cy.get('input#clave', { timeout: 10000 })
              .should('be.visible')
              .clear()
              .type(clave, { log: false })
          )
          .then(() =>
            cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
              .first()
              .click({ force: true })
          )
          .then(() => cy.wait(800))
          .then(() => verificarUrlFichar());
      }

      return verificarUrlFichar();
    });
  }

  // ============== Navegación limpia ==============
  function irAFichajesLimpio(numeroCaso) {
    // Solo limpiar sesión y volver a login para los primeros casos (TC001-TC003)
    if (numeroCaso <= 3) {
      cy.clearCookies({ log: false });
      cy.clearLocalStorage({ log: false });
      cy.window({ log: false }).then(w => {
        try { w.sessionStorage?.clear(); } catch (_) { }
      });

      // Ir a login
      const loginUrl = FICHAJES_URL_ABS.replace('/fichar', '/login');
      cy.visit(loginUrl, { failOnStatusCode: false });
      cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
      return cy.get('input#usuario', { timeout: 10000 }).should('exist');
    } else {
      // A partir del TC004, quedarse en la URL de fichar con testing
      return cy.url().then((currentUrl) => {
        if (currentUrl !== FICHAJES_URL_ABS) {
          cy.visit(FICHAJES_URL_ABS, { failOnStatusCode: false });
          cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
        }
        return cy.get('body', { timeout: 10000 }).should('exist');
      });
    }
  }

  // ============== Motor de casos ==============
  /**
   * Motor principal: recibe una fila del Excel y orquesta el flujo completo
   * (limpieza de sesión, ejecución de la función solicitada, registro del resultado, etc.).
   */
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const casoId = casoExcel.caso || `TC${String(idx + 1).padStart(3, '0')}`;
    const nombre = `${casoId} - ${casoExcel.nombre}`;
    const funcionNombre = CASOS_FICHAJE_TRABAJO.has(casoId) ? 'fichajeTrabajo' : casoExcel.funcion;
    // Recargar si el caso está en la lista, independientemente de la función (fichaje o fichajeTrabajo)
    const requiereRecargaPostCaso = CASOS_FICHAJE_RECARGAR.has(casoId);

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`▶️ ${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`🔍 Función solicitada: "${funcionNombre}"`);

    const funcion = obtenerFuncionPorNombre(funcionNombre, casoExcel.nombre);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irAFichajesLimpio(numero)
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion;
        }
        return cy.wrap(null);
      })
      .then(() => {
        if (requiereRecargaPostCaso) {
          cy.log('♻️ Reestableciendo estado de Fichajes tras el caso');
          return cy.reload(true)
            .then(() => verificarUrlFichar());
        }
        return null;
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          registrarResultado(
            casoId,
            nombre,
            'Comportamiento correcto',
            'Comportamiento correcto',
            'OK'
          );
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Fichajes'
        });
        return null;
      });
  }

  // Envía el resultado del caso al registro centralizado (Excel).
  function registrarResultado(casoId, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero: casoId,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Fichajes'
    });
  }

  function obtenerFuncionPorNombre(nombreFuncion, nombreCaso) {
    const funciones = {
      'login': login,
      'loginIncorrecto': loginIncorrecto,
      'loginRecuerdame': loginRecuerdame,
      'vistaDiaria': vistaDiaria,
      'vistaSemanal': vistaSemanal,
      'semanalDiaria': semanalDiaria,
      'vistaSemanalAnterior': vistaSemanalAnterior,
      'vistaSemanalProxima': vistaSemanalProxima,
      'vistaSemanalSiguiente': vistaSemanalProxima,
      'semanalAnterior': vistaSemanalAnterior,
      'semanalProxima': vistaSemanalProxima,
      'fichaje': fichaje,
      'fichajeTrabajo': fichajeTrabajo,
      'editarHoraEntrada': editarHoraEntrada,
      'editarHoraSalida': editarHoraSalida,
      'validarHoraEntradaPosterior': validarHoraEntradaPosterior,
      'validarSegundaEntradaAnterior': validarSegundaEntradaAnterior,
      'validarSegundaEntrada': validarSegundaEntradaAnterior,
      'scroll': scroll
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`⚠️ Función no encontrada: "${nombreFuncion}". Se ejecutará un no-op.`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  // ============== Funciones de pantalla ==============
  // Login estándar: usa usuario/clave del Excel (o los defaults) y verifica que
  // termina en la pantalla diaria de fichajes.
  function login(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || '';
    const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';

    cy.log(`Login con usuario: ${usuario}`);

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    // Quedarse en la pantalla principal de fichar
    cy.url({ timeout: 15000 }).should('include', FICHAJES_PATH);
    return cy.get('body', { timeout: 10000 }).should('exist');
  }

  // Intenta un login con credenciales inválidas y comprueba que la app lo rechaza.
  function loginIncorrecto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || '';
    const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';

    cy.url().then((url) => {
      if (!url.includes(LOGIN_PATH)) {
        cy.visit(FICHAJES_URL_ABS.replace('/fichar', '/login'), { failOnStatusCode: false });
      }
    });

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    cy.wait(2000);
    // Debe permanecer en login o mostrar mensaje de error
    cy.get('body').then($body => {
      const tieneError = /credenciales|no coinciden|error/i.test($body.text());
      if (tieneError) {
        cy.log('Mensaje de error mostrado correctamente');
      }
    });

    return cy.url().should('include', LOGIN_PATH);
  }

  // Login marcando “Recuérdame” para validar que la sesión persista.
  function loginRecuerdame(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || '';
    const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input#recuerdame', { timeout: 10000 })
      .check({ force: true });

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    // Verificar que estamos en la URL exacta de fichar con testing
    return verificarUrlFichar().then(() => cy.get('body', { timeout: 10000 }).should('exist'));
  }

  // Simple smoke test: asegura que la vista diaria se carga correctamente.
  function vistaDiaria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel).then(() => {
      cy.get('body', { timeout: 10000 }).should('exist');
      cy.log('Vista diaria cargada correctamente - se queda en pantalla principal de fichar');
    });
  }

  // Abre la pestaña “Semanal” y se asegura de que la vista se cargue por completo.
  // Abre la pestaña semanal y espera a que se pinten las tarjetas de días.
  function vistaSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() => cy.log('Vista semanal cargada correctamente'));
  }

  // Cambia a Semanal y vuelve a fichar (Daily), asegurando que el switch funcione.
  function semanalDiaria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.contains('button, a, [role="button"]', /Fichar/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() => verificarUrlFichar())
      .then(() => cy.log('Vuelta a vista diaria desde semanal'));
  }

  // Pulsa el botón “Anterior semana” y registra la semana resultante.
  function vistaSemanalAnterior(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return vistaSemanal(casoExcel)
      .then(() =>
        cy.get('button#week-nav-prev, #week-nav-prev', { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('header').invoke('text').then((texto) => {
          cy.log(`Semana actual tras pulsar anterior: ${texto}`);
        })
      )
      .then(() => cy.log('Se navegó a la semana anterior correctamente'));
  }

  // Pulsa el botón “Próxima semana” y registra la semana resultante.
  function vistaSemanalProxima(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return vistaSemanal(casoExcel)
      .then(() =>
        cy.get('button#week-nav-next, #week-nav-next', { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('header').invoke('text').then((texto) => {
          cy.log(`Semana actual tras pulsar próxima: ${texto}`);
        })
      )
      .then(() => cy.log('Se navegó a la semana siguiente correctamente'));
  }

  /**
   * Flujo genérico de fichaje manual:
   * - lee la secuencia generada por `prepararDatosFichaje`
   * - rellena fecha/hora
   * - pulsa Entrada/Salida y gestiona las alertas
   */
  function fichaje(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel).then(() => {
      const numeroCaso = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || 0;
      const casoId = String(casoExcel.caso || '').trim().toUpperCase();
      const datos = prepararDatosFichaje(casoExcel, casoId);
      const mensajeAlertaEntrada = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA);
      const mensajeAlertaSalida = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);
      const mensajesEntrada = normalizarMensajesEsperados(mensajeAlertaEntrada);
      const mensajesSalida = normalizarMensajesEsperados(mensajeAlertaSalida);
      const config = obtenerConfiguracionCasoFichaje(casoId);

      if (!datos.secuencia.length) {
        cy.log('⚠️ No se encontraron pasos de entrada/salida configurados para este caso.');
        return cy.wrap(null);
      }

      cy.log(`Secuencia planificada: ${datos.secuencia.map(p => `${p.tipo}:${p.hora || 'sin hora'}`).join(' -> ')}`);

      let chain = cy.wrap(null);
      let entradaPendiente = false;

      datos.secuencia.forEach((paso) => {
        if (paso.tipo === 'entrada') {
          chain = chain
            .then(() => rellenarCamposEntrada(paso))
            .then(() => {
              cy.log('Pulsando botón "Entrada"');
              return clickBotonFichaje('entrada')
                .then(() => aceptarAdvertenciaSiExiste({
                  mensajeEsperado: mensajesEntrada,
                  accion: config.accionAlertaEntrada
                }))
                .then(() => {
                  if (config.accionAlertaEntrada === 'cancelar') {
                    entradaPendiente = false;
                    if (config.verificarEntradaNoRegistradaTrasCancelar) {
                      return asegurarBotonFichajeVisible('entrada');
                    }
                    return cy.wrap(null);
                  }

                  entradaPendiente = true;
                  return cy.wait(800).then(() => {
                    if (config.validarEntradaDuplicada) {
                      return asegurarBotonFichajeNoVisible('entrada');
                    }
                    return cy.wrap(null);
                  });
                });
            });
        } else if (paso.tipo === 'salida') {
          chain = chain
            .then(() => rellenarCamposSalida(paso))
            .then(() => {
              if (!entradaPendiente) {
                if (config.salidaSinEntrada) {
                  cy.log('Validando que no exista botón de "Salida" sin entrada previa.');
                  return asegurarBotonFichajeNoVisible('salida');
                }
                cy.log('ℹ️ No hay una entrada previa confirmada; se omite el registro de salida.');
                return cy.wrap(null);
              }

              cy.log(`Esperando ${ESPERA_SALIDA_MS / 1000} segundos antes de registrar la salida`);
              return cy.wait(ESPERA_SALIDA_MS)
                .then(() => {
                  cy.log('Pulsando botón "Salida"');
                  return clickBotonFichaje('salida');
                })
                .then(() => aceptarAdvertenciaSiExiste({
                  timeout: 4000,
                  mensajeEsperado: mensajesSalida,
                  accion: config.accionAlertaSalida
                }))
                .then(() => {
                  entradaPendiente = false;
                  return cy.wait(800);
                });
            });
        }
      });

      return chain;
    });
  }

  // ────────────────────────────────
  // Edición directa del bloque Trabajo para TC024–TC027
  // ────────────────────────────────
  function editarTramoTrabajoCaso(casoExcel) {
    const casoId = String(casoExcel.caso || '').toUpperCase();

    // 1) Elegir qué fila y qué campo editamos
    // 👉 Todos los casos (TC024–TC027) hacen lo MISMO: primer tramo, inicio
    let indexEntrada = 0;    // índice de la fila de trabajo (time-entry / work-entry)
    let tipoCampo = 'start'; // 'start' = hora inicio, 'end' = hora fin

    switch (casoId) {
      case 'TC024':
      case 'TC025':
      case 'TC026':
      case 'TC027':
      default:
        indexEntrada = 0;
        tipoCampo = 'start';
        break;
    }

    // 2) Hora nueva que queremos poner (normalizada HH:mm)
    const horaCruda = (
      tipoCampo === 'end'
        ? (
          obtenerDatoPorEtiqueta(casoExcel, 'hora_salida') ||
          obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) ||
          casoExcel.dato_2
        )
        : (
          obtenerDatoPorEtiqueta(casoExcel, 'hora') ||
          obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) ||
          casoExcel.dato_1
        )
    ) || '10:00';

    const { time: horaNueva } = normalizarHora({ base: horaCruda }) || {};
    const horaFinal = horaNueva || '10:00';

    let chain = cy.wrap(null);

    // 3) Asegurarnos de que el bloque "Trabajo" está visible en pantalla
    chain = chain.then(() => {
      cy.log('Buscando bloque "Trabajo" en la pantalla (TC024–TC027)...');

      return cy.get('body', { timeout: 10000 }).then(($body) => {
        // Prioridad 1: #work-session-block
        const bloqueWork = $body.find('#work-session-block').first();
        if (bloqueWork.length) {
          const top = bloqueWork.offset().top;
          cy.window().scrollTo(0, Math.max(0, top - 150));
          cy.wait(500);
          cy.log('Bloque "Trabajo" encontrado por #work-session-block');
          return;
        }

        // Prioridad 2: contenedor con clase relacionada
        const bloqueClase = $body
          .find('.time-block-work, .work-session-block, [class*="work-session"], [class*="time-block"]')
          .first();

        if (bloqueClase.length) {
          const top = bloqueClase.offset().top;
          cy.window().scrollTo(0, Math.max(0, top - 150));
          cy.wait(500);
          cy.log('Bloque "Trabajo" encontrado por clases genéricas');
          return;
        }

        // Prioridad 3: buscar por texto "Trabajo"
        const bloqueTexto = $body.find('*').filter((_, el) => {
          const texto = Cypress.$(el).text().toLowerCase();
          return texto.includes('trabajo');
        }).first();

        if (bloqueTexto.length) {
          const top = bloqueTexto.offset().top;
          cy.window().scrollTo(0, Math.max(0, top - 150));
          cy.wait(500);
          cy.log('Bloque "Trabajo" localizado por texto');
          return;
        }

        // Fallback: scroll genérico
        cy.window().scrollTo(0, 800);
        cy.wait(500);
        cy.log('No se encontró bloque "Trabajo" por selectores; se hizo scroll genérico');
      });
    });

    // 4) Editar la hora del tramo seleccionado:
    //    clic en input -> modal "Editar entrada/salida" (Sí) -> modal HH:mm (rellenar y Aceptar)
    chain = chain.then(() => {
      cy.log(`Editando tramo de trabajo índice ${indexEntrada} (${tipoCampo}) -> hora ${horaFinal}`);

      const selectorFila =
        '#work-session-block .time-entry, ' +
        '#work-session-block .work-entry, ' +
        '#work-session-block [data-role="work-entry"], ' +
        '#work-session-block [class*="time-entry"], ' +
        '#work-session-block [class*="work-entry"]';

      return cy.get(selectorFila, { timeout: 10000 })
        .should('have.length.greaterThan', indexEntrada)
        .eq(indexEntrada)
        .within(() => {
          const selectorInputBase =
            'input.time-input.time-input-start, ' +
            'input.time-input.time-input-end, ' +
            'input[type="time"], ' +
            'input[class*="time-input"], ' +
            'input[name*="hora"], ' +
            'input[aria-label*="hora"]';

          cy.get(selectorInputBase, { timeout: 8000 })
            .filter(':visible')
            .then(($inputs) => {
              if (!$inputs.length) {
                throw new Error('No se encontró ningún input de hora visible en el tramo de trabajo');
              }

              const indexInput = (tipoCampo === 'end' && $inputs.length > 1)
                ? $inputs.length - 1
                : 0;

              cy.wrap($inputs.eq(indexInput))
                .should('be.visible')
                .click({ force: true });
            });
        })
        // 4.1 Modal "Editar entrada/salida" (Sí)
        .then(() => {
          cy.wait(400);
          return cy.get('body', { timeout: 10000 }).then(($body) => {
            const texto = $body.text();
            const hayConfirm =
              /Editar entrada|Editar salida|¿Estás seguro que deseas modificar la hora de (entrada|salida)|se le informará a tu supervisor/i
                .test(texto);

            if (!hayConfirm) {
              return cy.wrap(null);
            }

            cy.log('Modal de confirmación "Editar entrada/salida" detectado -> pulsando botón azul "Sí"');

            const selectorBotonSi =
              '.notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
              '.btn-notification.btn-primary[data-action="accept"]';

            if ($body.find(selectorBotonSi).length) {
              return cy.get(selectorBotonSi, { timeout: 8000 })
                .first()
                .click({ force: true })
                .then(() => cy.wait(400));
            }

            return cy.contains('button, a', /^s[íi]$/i, { timeout: 8000 })
              .click({ force: true })
              .then(() => cy.wait(400));
          });
        })
        // 4.2 Modal HH:mm (rellenar y Aceptar)
        .then(() => {
          cy.log('Buscando modal de edición de hora (HH:mm), si existe...');

          const [hStr, mStr] = horaFinal.split(':');
          const horasStr = hStr || '00';
          const minutosStr = mStr || '00';

          const selectorInputsModal = 'input.time-edit-field-input';

          return cy.get('body').then(($body) => {
            const hayInputs = $body.find('input.time-edit-field-input').length;

            if (!hayInputs) {
              cy.log('No se ha abierto modal HH:mm; se asume que la edición se gestiona inline o ya está aplicada.');
              return cy.wrap(null);
            }

            return cy.get(selectorInputsModal, { timeout: 8000 })
              .filter(':visible')
              .then(($inputs) => {
                expect(
                  $inputs.length >= 2,
                  'Debe haber al menos 2 campos de hora/minuto en el modal de edición'
                ).to.be.true;

                cy.wrap($inputs.eq(0))
                  .should('be.visible')
                  .clear({ force: true })
                  .type(horasStr, { force: true });
                cy.wait(200);

                cy.wrap($inputs.eq(1))
                  .should('be.visible')
                  .clear({ force: true })
                  .type(minutosStr, { force: true });
                cy.wait(200);
              })
              .then(() => {
                cy.log('Pulsando botón "Aceptar" del modal de edición de hora');
                return cy.get('button.time-edit-btn.time-edit-btn-primary', { timeout: 8000 })
                  .should('be.visible')
                  .click({ force: true });
              })
              .then(() => {
                cy.wait(500);
                return cy.get('body', { timeout: 5000 }).should(($b) => {
                  const hayInputsVisibles = $b
                    .find('input.time-edit-field-input')
                    .filter(':visible').length;
                  expect(hayInputsVisibles, 'Modal de edición de hora cerrado').to.eq(0);
                });
              });
          });
        });
    });

    // 5) Pulsar el botón "Aceptar" del tramo editado
    chain = chain.then(() => {
      cy.log('Buscando y pulsando botón "Aceptar" del tramo editado en Trabajo...');

      const selectorFila =
        '#work-session-block .time-entry, ' +
        '#work-session-block .work-entry, ' +
        '#work-session-block [data-role="work-entry"], ' +
        '#work-session-block [class*="time-entry"], ' +
        '#work-session-block [class*="work-entry"]';

      return cy.get(selectorFila, { timeout: 10000 })
        .should('have.length.greaterThan', indexEntrada)
        .eq(indexEntrada)
        .within(() => {
          const selectorBotonAceptar =
            'button.btn-time-action.btn-time-accept[data-action="accept"], ' +
            'button.btn-time-accept, ' +
            'button[data-action="accept"], ' +
            'button[aria-label*="Aceptar"], ' +
            'button:contains("Aceptar")';

          cy.get(selectorBotonAceptar, { timeout: 8000 }).then($btns => {
            if (!$btns.length) {
              throw new Error('No se encontró el botón "Aceptar" del tramo de trabajo');
            }

            const $visibles = $btns.filter(':visible');
            const $target = $visibles.length ? $visibles.first() : $btns.first();

            cy.wrap($target).click({ force: true });
        });
    });
    })
      // 5.1 Si aparece otra vez el modal de "Editar entrada/salida" tras Aceptar, pulsar "Sí" y NO hacer más
      .then(() => {
        cy.wait(400);
        return cy.get('body', { timeout: 10000 }).then(($body) => {
          const texto = $body.text();
          const hayConfirm =
            /Editar entrada|Editar salida|¿Estás seguro que deseas modificar la hora de (entrada|salida)|se le informará a tu supervisor/i
              .test(texto);

          if (!hayConfirm) {
            return cy.wrap(null);
          }

          cy.log('Modal de confirmación "Editar entrada/salida" detectado después de Aceptar -> pulsando "Sí"');

          const selectorBotonSi =
            '.notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.btn-notification.btn-primary[data-action="accept"]';

          if ($body.find(selectorBotonSi).length) {
            return cy.get(selectorBotonSi, { timeout: 8000 })
              .first()
              .click({ force: true })
              .then(() => cy.wait(400));
          }

          return cy.contains('button, a', /^s[íi]$/i, { timeout: 8000 })
            .click({ force: true })
            .then(() => cy.wait(400));
        });
      });

    // 6) Nada de gestionar textarea ni advertencias: simplemente RECARGAR
    chain = chain.then(() => {
      cy.log('Ignorando alertas finales y reiniciando pantalla de fichajes después del caso...');
      cy.wait(500);
      return cy.reload(true).then(() => verificarUrlFichar());
    });

    return chain;
  }

  // Casos TC024–TC027: edición directa del bloque "Trabajo".
  function fichajeTrabajo(casoExcel) {
    const casoId = String(casoExcel.caso || '').toUpperCase();

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (modo fichajeTrabajo)`);

    // Para TC024–TC027 usamos SIEMPRE el flujo específico sobre el bloque "Trabajo"
    if (['TC024', 'TC025', 'TC026', 'TC027'].includes(casoId)) {
      return asegurarSesionFichar(casoExcel)
        .then(() => editarTramoTrabajoCaso(casoExcel));
    }

    // Para cualquier otro caso que reutilice "fichajeTrabajo", se mantiene el flujo genérico
    const mensaje =
      obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA) ||
      obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        aplicarInstruccionesTrabajo(casoExcel, {
          mensajeEsperado: mensaje,
          accionAdvertencia: 'aceptar',
          botonConfirmar: /Aceptar/i,
          textoModalConfirm: /(Editar (entrada|salida)|¿Estás seguro|Modificar horario|Modificar tramo)/i
        })
      );
  }

  // Casos de edición: reutilizan el helper genérico que abre el modal “Trabajo”.
  function editarHoraEntrada(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const mensaje = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA);
    return aplicarInstruccionesTrabajo(casoExcel, { mensajeEsperado: mensaje });
  }

  function editarHoraSalida(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const mensaje = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);
    return aplicarInstruccionesTrabajo(casoExcel, { mensajeEsperado: mensaje });
  }

  function validarHoraEntradaPosterior(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const mensaje = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA);
    return aplicarInstruccionesTrabajo(casoExcel, { mensajeEsperado: mensaje });
  }

  function validarSegundaEntradaAnterior(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const mensaje =
      obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA) ||
      obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);

    return aplicarInstruccionesTrabajo(casoExcel, { mensajeEsperado: mensaje });
  }

  // Recorre la tabla semanal hacia la derecha/izquierda para validar CSS/scrollbars.
  function scroll(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('body').then($body => {
          const scrollable = $body.find('[style*="overflow"], .scrollable, [class*="scroll"]').first();
          if (scrollable.length) {
            cy.wrap(scrollable).scrollTo('right', { ensureScrollable: false });
            cy.wait(400);
            cy.wrap(scrollable).scrollTo('left', { ensureScrollable: false });
          } else {
            cy.get('body').scrollTo('right', { ensureScrollable: false });
            cy.wait(400);
            cy.get('body').scrollTo('left', { ensureScrollable: false });
          }
        })
      )
      .then(() => cy.log('Scroll horizontal completado'));
  }
});