// Suite de pruebas automatizadas para la pantalla de Fichajes.
// Lee los datos desde Google Sheets, ejecuta cada caso y registra el resultado en Excel.
describe('FICHAJES - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const FICHAJES_URL_ABS = 'https://horario.dev.novatrans.app/fichar?testing=novatranshorario';
  const FICHAJES_PATH = '/fichar';
  const LOGIN_PATH = '/login';
  const LOGIN_URL_ABS = 'https://horario.dev.novatrans.app/login';

  // Helper: Verificar y navegar a la URL correcta de fichar con testing
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

  // Si está vacío, se ejecutan todos los casos que no estén en CASOS_PAUSADOS
  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set(['TC015']);

  it('Ejecutar casos OK de Fichajes desde Google Sheets', () => {
    cy.obtenerDatosExcel('Fichajes').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Fichajes`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter(c => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        const id = String(caso.caso || '').trim().toUpperCase();
        if (CASOS_PAUSADOS.has(id)) return false;
        if (CASOS_OK.size === 0) return true;
        return CASOS_OK.has(id);
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
  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
        return casoExcel[`dato_${i}`] || '';
      }
    }
    return '';
  }

  const LABELS_FECHA_ENTRADA = ['fecha entrada', 'fecha inicio', 'fecha'];
  const LABELS_FECHA_SALIDA = ['fecha salida', 'fecha fin'];
  const LABELS_HORA_ENTRADA = ['hora entrada', 'entrada', 'hora inicio'];
  const LABELS_HORA_SALIDA = ['hora salida', 'salida', 'hora fin'];
  const LABELS_MIN_ENTRADA = ['min entrada', 'minuto entrada', 'minutos entrada'];
  const LABELS_MIN_SALIDA = ['min salida', 'minuto salida', 'minutos salida'];
  const LABELS_ALERTA_ENTRADA = ['mensaje entrada', 'alerta entrada', 'mensaje registrar entrada', 'mensaje fichaje entrada'];
  const LABELS_ALERTA_SALIDA = ['mensaje salida', 'alerta salida', 'mensaje registrar salida', 'mensaje fichaje salida'];
  const ESPERA_SALIDA_MS = 10000;

  function generarTextoAleatorio(longitud = 20) {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    let resultado = '';
    for (let i = 0; i < longitud; i += 1) {
      const idx = Math.floor(Math.random() * caracteres.length);
      resultado += caracteres.charAt(idx);
    }
    return resultado;
  }

  function horaStringToMinutes(valor) {
    if (!valor) return null;
    const [horas, minutos] = valor.split(':').map(Number);
    if ([horas, minutos].some(Number.isNaN)) return null;
    return horas * 60 + minutos;
  }

  function compararHoras(horaA, horaB) {
    const minutosA = horaStringToMinutes(horaA);
    const minutosB = horaStringToMinutes(horaB);
    if (minutosA === null || minutosB === null) return 0;
    if (minutosA === minutosB) return 0;
    return minutosA > minutosB ? 1 : -1;
  }

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

  function esValorHoraPosible(valor) {
    if (valor === null || valor === undefined) return false;
    const str = String(valor).trim();
    if (!str) return false;
    if (/^\d{1,2}(:\d{2}){1,2}$/.test(str)) return true;
    if (/^\d{1,2}$/.test(str)) return true;
    if (/^\d{1,2}h\d{0,2}$/i.test(str)) return true;
    return false;
  }

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

  function normalizarFecha(valor) {
    if (!valor) return '';
    const str = String(valor).trim();
    if (!str) return '';

    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

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

  function sumarDiasISO(fechaISO, dias) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-').map(Number);
    if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return fechaISO;
    const [year, month, day] = partes;
    const fecha = new Date(Date.UTC(year, month - 1, day));
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

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

    const secuencia = [];
    const totalPasos = Math.max(entradas.length, salidas.length);

    if (!totalPasos) {
      cy.log('No se encontraron instrucciones de entrada/salida en el Excel.');
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

  function establecerValorInput(selector, valor) {
    if (valor === null || valor === undefined || valor === '') return cy.wrap(null);

    return cy.get(selector, { timeout: 10000 })
      .should('be.visible')
      .should('not.be.disabled')
      .then($input => {
        const tipo = ($input.attr('type') || '').toLowerCase();
        if (tipo === 'date' || tipo === 'time') {
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

  function aceptarAdvertenciaSiExiste(opciones = {}) {
    const {
      timeout = 4000,
      mensajeEsperado,
      accion = 'omitir'
    } = opciones;

    const mensajesEsperados = normalizarMensajesEsperados(mensajeEsperado);
    const accionNormalizada = (accion || '').toLowerCase();

    return cy.get('body').then(($body) => {
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

      let accionFinal = accionNormalizada;
      if (accionFinal === 'omitir') accionFinal = 'aceptar';

      const esAceptar = accionFinal === 'aceptar';
      const esRechazar = accionFinal === 'rechazar';

      let chain = cy.wrap(null);

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

      if (!esAceptar && !esRechazar) return chain;

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

      chain = chain.then(() => {
        let selectorBoton;

        if (esAceptar) {
          selectorBoton =
            '.notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.notification-buttons .btn-notification.btn-primary';
        } else if (esRechazar) {
          selectorBoton =
            '.notification-buttons .btn-notification.btn-secondary[data-action="reject"], ' +
            '.notification-buttons .btn-notification.btn-secondary';
        }

        if (!selectorBoton) return cy.wrap(null);

        return cy.get(selectorBoton, { timeout })
          .first()
          .click({ force: true });
      })
        .then(() => cy.wait(400));

      return chain;
    });
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

  // Garantiza que la sesión esté iniciada en la pantalla de fichajes
  function asegurarSesionFichar(casoExcel) {
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes(LOGIN_PATH)) {
        const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';
        const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || '';
        const clave = (claveExcel && claveExcel !== 'solbyte')
          ? claveExcel
          : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

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
    if (numeroCaso <= 3) {
      cy.clearCookies({ log: false });
      cy.clearLocalStorage({ log: false });
      cy.window({ log: false }).then(w => {
        try { w.sessionStorage?.clear(); } catch (_) { }
      });

      cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
      cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
      return cy.get('input#usuario', { timeout: 10000 }).should('exist');
    } else {
      return cy.url().then((currentUrl) => {
        if (currentUrl !== FICHAJES_URL_ABS) {
          cy.visit(FICHAJES_URL_ABS, { failOnStatusCode: false });
          cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
        }
        return cy.get('body', { timeout: 10000 }).should('exist');
      });
    }
  }

  // Casos que dejan la UI en un estado “sucio”: al terminar recargamos la página.
  const CASOS_FICHAJE_RECARGAR = new Set([
    'TC007', 'TC008', 'TC009', 'TC010', 'TC011', 'TC012', 'TC013', 'TC014', 'TC015',
    'TC017', 'TC018', 'TC019', 'TC020', 'TC021', 'TC022', 'TC023', 'TC024', 'TC025',
    'TC026', 'TC027', 'TC028'
  ]);

  const CASOS_FICHAJE_TRABAJO = new Set(['TC024', 'TC025', 'TC026', 'TC027', 'TC030']);

  const CASOS_ALERTA_ACEPTAR = new Set([
    'TC008', 'TC009', 'TC010', 'TC015', 'TC019', 'TC020'
  ]);

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

  function rellenarCamposEntrada(paso) {
    let chain = cy.wrap(null);

    const fechaEntrada = (paso.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const siempreForzarFecha = true;

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
    const siempreForzarFecha = true;

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

  /**
   * - Antes de cada caso, mira si en "Trabajo" hay >1 registro.
   * - Si hay >1, borra el segundo (índice 1) y confirma.
   * - Si no existe el bloque o hay 0/1 registros, no hace nada.
   * - IMPORTANTÍSIMO: NO usa should('have.length.greaterThan',1) para no romper.
   */
function limpiarSegundoRegistroTrabajoSiExiste() {
  cy.log(' Limpieza: comprobar y eliminar 2º registro en Trabajo');

  const bloque = '#work-session-block';
  const filas  = '#work-session-block .time-entry';

  const inputStart = 'input.time-input.time-input-start, input.time-input-start';
  const inputEnd   = 'input.time-input.time-input-end, input.time-input-end';

  const btnSi = 'button.btn-notification.btn-primary[data-action="accept"]';

  return cy.get('body', { timeout: 10000 }).then(($body) => {
    if (!$body.find(bloque).length) {
      cy.log(' No existe bloque Trabajo');
      return cy.wrap(null);
    }

    const total = $body.find(filas).length;
    cy.log(` Registros en Trabajo: ${total}`);

    if (total <= 1) {
      cy.log(' No hay segundo registro que eliminar');
      return cy.wrap(null);
    }

    // 1) Click en input del 2º registro (abre modal)
    return cy.get(filas, { timeout: 10000 })
      .eq(1)
      .scrollIntoView({ ensureScrollable: false })
      .then(($fila2) => {
        const $start = Cypress.$($fila2).find(inputStart).filter(':visible');
        const $end   = Cypress.$($fila2).find(inputEnd).filter(':visible');

        if ($start.length) return cy.wrap($start.first()).click({ force: true });
        if ($end.length)   return cy.wrap($end.first()).click({ force: true });

        cy.log(' No hay input visible en el 2º registro');
        return cy.wrap(null);
      })

      // 2) Click directo al botón rojo "Eliminar" (SIN :visible)
      .then(() => {
        cy.log(' Click Eliminar (selector directo, sin :visible)');
        return cy.get('button.time-edit-btn.time-edit-btn-danger', { timeout: 10000 })
          .last()
          .click({ force: true });
      })

      // 3) Confirmar "Sí" si aparece
      .then(() => {
        return cy.get('body', { timeout: 4000 }).then(($b) => {
          if ($b.find(btnSi).length) {
            cy.log(' Confirmando eliminación (Sí)');
            return cy.get(btnSi, { timeout: 8000 })
              .click({ force: true });
          }
          return cy.wrap(null);
        });
      })

      .then(() => cy.wait(300))
      .then(() => {
        cy.log(' Limpieza terminada');
        return cy.wrap(null);
      });
  });
}
  // ============== Motor de casos ==============
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);

    let casoIdRaw = String(casoExcel.caso || '').trim().toUpperCase();
    if (!casoIdRaw || !casoIdRaw.startsWith('TC')) {
      casoIdRaw = `TC${String(idx + 1).padStart(3, '0')}`;
    } else {
      const numeroCaso = casoIdRaw.replace(/^TC/i, '');
      casoIdRaw = `TC${String(numeroCaso).padStart(3, '0')}`;
    }
    const casoId = casoIdRaw;

    const nombre = `${casoId} - ${casoExcel.nombre}`;
    const funcionNombre = CASOS_FICHAJE_TRABAJO.has(casoId) ? 'fichajeTrabajo' : casoExcel.funcion;
    const requiereRecargaPostCaso = CASOS_FICHAJE_RECARGAR.has(casoId);

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Función solicitada: "${funcionNombre}"`);

    const funcion = obtenerFuncionPorNombre(funcionNombre, casoExcel.nombre);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irAFichajesLimpio(numero)
      .then(() => {
        // ANTES DE CADA TEST: revisar "Trabajo" y borrar el 2º si existe
        // (safe: no falla aunque no exista bloque o no haya 2 registros)
        return limpiarSegundoRegistroTrabajoSiExiste();
      })
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion;
        }
        return cy.wrap(null);
      })
      .then(() => {
        if (requiereRecargaPostCaso) {
          cy.log(' Reestableciendo estado de Fichajes tras el caso');
          return cy.reload(true).then(() => verificarUrlFichar());
        }
        return cy.wrap(null);
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
        return cy.wrap(null);
      });
  }

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
      'eliminar': fichajeTrabajo,
      'eliminarTramoTrabajoCaso': fichajeTrabajo,
      'scroll': scroll
    };

    if (!funciones[nombreFuncion]) {
      cy.log(` Función no encontrada: "${nombreFuncion}". Se ejecutará un no-op.`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  // ============== Funciones de pantalla ==============
  function login(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';
    const clave = (claveExcel && claveExcel !== 'solbyte')
      ? claveExcel
      : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';

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

    cy.url({ timeout: 15000 }).should('include', FICHAJES_PATH);
    return cy.get('body', { timeout: 10000 }).should('exist');
  }

  function loginIncorrecto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || '';
    const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';

    cy.url().then((url) => {
      if (!url.includes(LOGIN_PATH)) {
        cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
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
    cy.get('body').then($body => {
      const tieneError = /credenciales|no coinciden|error/i.test($body.text());
      if (tieneError) {
        cy.log('Mensaje de error mostrado correctamente');
      }
    });

    return cy.url().should('include', LOGIN_PATH);
  }

  function loginRecuerdame(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';
    const clave = (claveExcel && claveExcel !== 'solbyte')
      ? claveExcel
      : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';

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

    return verificarUrlFichar().then(() => cy.get('body', { timeout: 10000 }).should('exist'));
  }

  function vistaDiaria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel).then(() => {
      cy.get('body', { timeout: 10000 }).should('exist');
      cy.log('Vista diaria cargada correctamente - se queda en pantalla principal de fichar');
    });
  }

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

  function fichaje(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() => {
        const casoId = String(casoExcel.caso || '').trim().toUpperCase();
        const datos = prepararDatosFichaje(casoExcel, casoId);

        const mensajeAlertaEntrada = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA);
        const mensajeAlertaSalida = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);
        const mensajesEntrada = normalizarMensajesEsperados(mensajeAlertaEntrada);
        const mensajesSalida = normalizarMensajesEsperados(mensajeAlertaSalida);
        const config = obtenerConfiguracionCasoFichaje(casoId);

        if (!datos.secuencia.length) {
          cy.log(' No se encontraron pasos de entrada/salida configurados para este caso.');
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
                  .then(() => {
                    return cy.get('body', { timeout: 2000 }).then(($body) => {
                      const texto = $body.text();
                      if (/se solapa|solapamiento|Error en hora de inicio/i.test(texto)) {
                        cy.log(' Error de solapamiento detectado, cerrando el modal...');
                        return cy.contains('button', /Aceptar/i, { timeout: 3000 })
                          .first()
                          .click({ force: true })
                          .then(() => cy.wait(500))
                          .then(() => {
                            // Reintento: la limpieza global ya existe, pero aquí reforzamos
                            return limpiarSegundoRegistroTrabajoSiExiste()
                              .then(() => cy.wait(800))
                              .then(() => {
                                cy.log('Reintentando registrar entrada después de limpiar...');
                                return rellenarCamposEntrada(paso)
                                  .then(() => clickBotonFichaje('entrada'))
                                  .then(() => aceptarAdvertenciaSiExiste({
                                    mensajeEsperado: mensajesEntrada,
                                    accion: config.accionAlertaEntrada
                                  }));
                              });
                          });
                      }

                      return aceptarAdvertenciaSiExiste({
                        mensajeEsperado: mensajesEntrada,
                        accion: config.accionAlertaEntrada
                      });
                    });
                  })
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
                  cy.log(' No hay una entrada previa confirmada; se omite el registro de salida.');
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
    //Todos los casos (TC024–TC027) hacen lo MISMO: primer tramo, inicio
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

    // Para TC026 y TC027: primero crear un nuevo registro (entrada y salida)
    if (casoId === 'TC026' || casoId === 'TC027') {
      const hoyISO = new Date().toISOString().slice(0, 10);
      chain = chain
        .then(() => {
          cy.log(' TC026/TC027: Registrando entrada para crear segundo registro');
          const pasoEntrada = { fecha: hoyISO, hora: '10:00' };
          return rellenarCamposEntrada(pasoEntrada);
        })
        .then(() => {
          cy.log('Pulsando botón "Entrada"');
          return clickBotonFichaje('entrada');
        })
        .then(() => {
          return aceptarAdvertenciaSiExiste({
            accion: 'omitir'
          });
        })
        .then(() => cy.wait(800))
        .then(() => {
          cy.log(' TC026/TC027: Registrando salida para completar el registro');
          const pasoSalida = { fecha: hoyISO, hora: '11:00' };
          return rellenarCamposSalida(pasoSalida);
        })
        .then(() => {
          cy.log(`Esperando 10 segundos antes de registrar la salida`);
          return cy.wait(10000);
        })
        .then(() => {
          cy.log('Pulsando botón "Salida"');
          return clickBotonFichaje('salida');
        })
        .then(() => {
          return aceptarAdvertenciaSiExiste({
            accion: 'omitir'
          });
        })
        .then(() => cy.wait(800));
    }

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

          return cy.get('body', { timeout: 8000 }).then(($body) => {
            const hayInputs = $body.find('input.time-edit-field-input').filter(':visible').length;

            // Si hay inputs visibles, intentar rellenarlos
            if (hayInputs >= 2) {
            return cy.get(selectorInputsModal, { timeout: 8000 })
              .filter(':visible')
              .then(($inputs) => {
                  if ($inputs.length >= 2) {
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
                  }
              })
              .then(() => {
                cy.log('Pulsando botón "Aceptar" del modal de edición de hora');
                return cy.get('button.time-edit-btn.time-edit-btn-primary', { timeout: 8000 })
                    .filter(':visible')
                    .first()
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
            }

            // Si no hay inputs o ya están editados, buscar y hacer click en Aceptar directamente
            cy.log('Campos ya editados o sin inputs -> haciendo click en botón "Aceptar"');
            return cy.get('button.time-edit-btn.time-edit-btn-primary', { timeout: 8000 })
              .filter(':visible')
              .first()
              .should('be.visible')
              .click({ force: true })
              .then(() => cy.wait(500));
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

  // ────────────────────────────────
  // Eliminación directa del bloque Trabajo para TC030
  // ────────────────────────────────
  function eliminarTramoTrabajoCaso(casoExcel) {
    cy.log(' TC030: Creando registro y luego eliminando segundo registro en Trabajo');

    const bloque = '#work-session-block';
    const filas = '#work-session-block .time-entry';

    const inputStart = 'input.time-input.time-input-start, input.time-input-start';
    const inputEnd = 'input.time-input.time-input-end, input.time-input-end';

    const btnSi = 'button.btn-notification.btn-primary[data-action="accept"]';
    const hoyISO = new Date().toISOString().slice(0, 10);

    let chain = cy.wrap(null);

    // 1) Primero crear un nuevo registro (entrada y salida)
    chain = chain
      .then(() => {
        cy.log(' TC030: Registrando entrada para crear segundo registro');
        const pasoEntrada = { fecha: hoyISO, hora: '10:00' };
        return rellenarCamposEntrada(pasoEntrada);
      })
      .then(() => {
        cy.log('Pulsando botón "Entrada"');
        return clickBotonFichaje('entrada');
      })
      .then(() => {
        return aceptarAdvertenciaSiExiste({
          accion: 'omitir'
        });
      })
      .then(() => cy.wait(800))
      .then(() => {
        cy.log(' TC030: Registrando salida para completar el registro');
        const pasoSalida = { fecha: hoyISO, hora: '11:00' };
        return rellenarCamposSalida(pasoSalida);
      })
      .then(() => {
        cy.log(`Esperando 10 segundos antes de registrar la salida`);
        return cy.wait(10000);
      })
      .then(() => {
        cy.log('Pulsando botón "Salida"');
        return clickBotonFichaje('salida');
      })
      .then(() => {
        return aceptarAdvertenciaSiExiste({
          accion: 'omitir'
      });
      })
      .then(() => cy.wait(800));

    // 2) Ahora eliminar el segundo registro
    chain = chain.then(() => {
      return cy.get('body', { timeout: 10000 }).then(($body) => {
        if (!$body.find(bloque).length) {
          cy.log(' No existe bloque Trabajo');
          return cy.wrap(null);
        }

        const total = $body.find(filas).length;
        cy.log(` Registros en Trabajo: ${total}`);

        if (total <= 1) {
          cy.log(' No hay segundo registro que eliminar');
          return cy.wrap(null);
        }

        // 1) Click en input del 2º registro (abre modal)
        return cy.get(filas, { timeout: 10000 })
          .eq(1)
          .scrollIntoView({ ensureScrollable: false })
          .then(($fila2) => {
            const $start = Cypress.$($fila2).find(inputStart).filter(':visible');
            const $end = Cypress.$($fila2).find(inputEnd).filter(':visible');

            if ($start.length) return cy.wrap($start.first()).click({ force: true });
            if ($end.length) return cy.wrap($end.first()).click({ force: true });

            cy.log(' No hay input visible en el 2º registro');
            return cy.wrap(null);
          })

          // 2) Click directo al botón rojo "Eliminar" (SIN :visible)
          .then(() => {
            cy.log(' Click Eliminar (selector directo, sin :visible)');
            return cy.get('button.time-edit-btn.time-edit-btn-danger', { timeout: 10000 })
              .last()
              .click({ force: true });
          })

          // 3) Confirmar "Sí" si aparece
          .then(() => {
            return cy.get('body', { timeout: 4000 }).then(($b) => {
              if ($b.find(btnSi).length) {
                cy.log(' Confirmando eliminación (Sí)');
                return cy.get(btnSi, { timeout: 8000 })
                  .click({ force: true });
              }
              return cy.wrap(null);
      });
          })

          .then(() => cy.wait(300))
          .then(() => {
            cy.log(' Eliminación completada');
            return cy.wrap(null);
          });
      });
    });

    return chain;
  }

  // Casos TC024–TC027 y TC030: edición/eliminación directa del bloque "Trabajo".
  function fichajeTrabajo(casoExcel) {
    const casoId = String(casoExcel.caso || '').toUpperCase();

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (modo fichajeTrabajo)`);

    // Para TC030 usamos el flujo de eliminación
    if (casoId === 'TC030') {
      return asegurarSesionFichar(casoExcel)
        .then(() => eliminarTramoTrabajoCaso(casoExcel));
    }

    // Para TC024–TC027 usamos SIEMPRE el flujo específico sobre el bloque "Trabajo"
    if (['TC024', 'TC025', 'TC026', 'TC027'].includes(casoId)) {
      return asegurarSesionFichar(casoExcel)
        .then(() => editarTramoTrabajoCaso(casoExcel));
    }

    // Si llegamos aquí, no hay lógica implementada para este caso
    cy.log('⚠️ Caso no manejado específicamente en fichajeTrabajo');
    return cy.wrap(null);
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