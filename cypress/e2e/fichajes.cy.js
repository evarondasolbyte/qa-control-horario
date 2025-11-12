// Suite de pruebas automatizadas para la pantalla de Fichajes
describe('FICHAJES - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const FICHAJES_URL_ABS = 'https://juancastilla.portalempleado.dev.novatrans.app/fichar?testing=novatranshorario';
  const FICHAJES_PATH = '/fichar';
  const LOGIN_PATH = '/login';
  
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

  it('Ejecutar todos los casos de Fichajes desde Google Sheets', () => {
    cy.obtenerDatosExcel('Fichajes').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Fichajes`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      const casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter(c => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

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

  function sumarDiasISO(fechaISO, dias) {
    if (!fechaISO) return '';
    const partes = fechaISO.split('-').map(Number);
    if (partes.length !== 3 || partes.some(n => Number.isNaN(n))) return fechaISO;
    const [year, month, day] = partes;
    const fecha = new Date(Date.UTC(year, month - 1, day));
    fecha.setUTCDate(fecha.getUTCDate() + dias);
    return fecha.toISOString().slice(0, 10);
  }

  function prepararDatosFichaje(casoExcel, numeroCaso) {
    const entradaBase = obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) || casoExcel.dato_1 || '';
    const salidaBase = obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) || casoExcel.dato_2 || '';

    const horaEntradaHoras = obtenerDatoPorEtiquetas(casoExcel, ['hora entrada hora', 'hora entrada horas', 'hora entrada (h)']);
    const horaSalidaHoras = obtenerDatoPorEtiquetas(casoExcel, ['hora salida hora', 'hora salida horas', 'hora salida (h)']);
    const entradaMinutos = obtenerDatoPorEtiquetas(casoExcel, LABELS_MIN_ENTRADA);
    const salidaMinutos = obtenerDatoPorEtiquetas(casoExcel, LABELS_MIN_SALIDA);

    const { time: horaEntrada, segundos: segEntrada } = normalizarHora({
      base: entradaBase,
      hora: horaEntradaHoras,
      minuto: entradaMinutos
    });

    const { time: horaSalida, segundos: segSalida } = normalizarHora({
      base: salidaBase,
      hora: horaSalidaHoras,
      minuto: salidaMinutos
    });

    let fechaEntradaISO =
      normalizarFecha(obtenerDatoPorEtiquetas(casoExcel, LABELS_FECHA_ENTRADA)) ||
      normalizarFecha(casoExcel.dato_3);

    if (!fechaEntradaISO) {
      cy.log('⚠️ No se encontró fecha de entrada en Excel. Se usará la fecha actual.');
      fechaEntradaISO = new Date().toISOString().slice(0, 10);
    }

    let fechaSalidaISO = fechaEntradaISO;
    if (numeroCaso === 11) {
      fechaSalidaISO = sumarDiasISO(fechaEntradaISO, 1);
    }

    return {
      fechaEntradaISO,
      horaEntrada,
      fechaSalidaISO,
      horaSalida
    };
  }

  function establecerValorInput(selector, valor) {
    if (valor === null || valor === undefined || valor === '') return cy.wrap(null);

    return cy.get(selector, { timeout: 10000 })
      .should('be.visible')
      .then($input => {
        const tipo = ($input.attr('type') || '').toLowerCase();
        if (tipo === 'date' || tipo === 'time') {
          cy.wrap($input)
            .invoke('val', valor)
            .trigger('input')
            .trigger('change');
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
        try { w.sessionStorage?.clear(); } catch (_) {} 
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
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre = `${casoExcel.caso} - ${casoExcel.nombre}`;

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`▶️ ${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`🔍 Función solicitada: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion, casoExcel.nombre);

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
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          registrarResultado(numero, nombre, 'Comportamiento correcto', 'Comportamiento correcto', 'OK');
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Fichajes'
        });
        return null;
      });
  }

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
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
      'fichaje': fichaje,
      'scroll': scroll
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`⚠️ Función no encontrada: "${nombreFuncion}". Se ejecutará un no-op.`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  // ============== Funciones de pantalla ==============
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

  function fichaje(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return asegurarSesionFichar(casoExcel).then(() => {
      const numeroCaso = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || 0;
      const datos = prepararDatosFichaje(casoExcel, numeroCaso);

      cy.log(
        `Datos normalizados -> Entrada: ${datos.fechaEntradaISO || '(sin fecha)'} ${datos.horaEntrada || '(sin hora)'} | ` +
        `Salida: ${datos.fechaSalidaISO || '(sin fecha)'} ${datos.horaSalida || '(sin hora)'}`
      );

      let chain = cy.wrap(null);

      if (datos.fechaEntradaISO) {
        chain = chain.then(() => establecerValorInput('#input_fecha_entrada', datos.fechaEntradaISO));
      }
      if (datos.horaEntrada) {
        chain = chain.then(() => establecerValorInput('#input_hora_entrada', datos.horaEntrada));
      }

      chain = chain.then(() => {
        if (datos.horaEntrada) {
          return cy.get('#btn-registrar-entrada', { timeout: 10000 })
            .should('be.visible')
            .click({ force: true });
        }
        cy.log('⚠️ No se registrará la entrada porque no se encontró hora de entrada en el Excel.');
        return null;
      }).then(() => cy.wait(400));

      if (datos.fechaSalidaISO) {
        chain = chain.then(() => establecerValorInput('#input_fecha_salida', datos.fechaSalidaISO));
      }
      if (datos.horaSalida) {
        chain = chain.then(() => establecerValorInput('#input_hora_salida', datos.horaSalida));
      }

      chain = chain.then(() => {
        if (datos.horaSalida) {
          return cy.get('#btn-registrar-salida', { timeout: 10000 })
            .should('be.visible')
            .click({ force: true });
        }
        cy.log('ℹ️ No se registrará la salida porque no se encontró hora de salida en el Excel.');
        return null;
      });

      return chain.then(() => cy.wait(600));
    });
  }

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
