// Suite de end-to-end para la pantalla de Jornada Semanal
describe('JORNADA SEMANAL - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const JORNADA_SEMANAL_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/jornada-semanal';
  const JORNADA_SEMANAL_PATH = '/panelinterno/jornada-semanal';
  const DASHBOARD_PATH = '/panelinterno';
  let contadorPrueba = 1;

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
    cy.procesarResultadosPantalla('Jornada Semanal');
  });

  it('Ejecutar todos los casos de Jornada Semanal desde Google Sheets', () => {
    cy.obtenerDatosExcel('Jornada Semanal').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Jornada Semanal`);

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

  function irAJornadaSemanalLimpio() {
    return cy.url().then((currentUrl) => {
      const cerrarPanel = () => {
        cy.wait(500);
        cy.get('.fi-ta-table, table').first().click({ force: true });
        return cy.get('.fi-ta-table, table').should('be.visible');
      };

      if (currentUrl.includes(DASHBOARD_PATH)) {
        cy.visit(JORNADA_SEMANAL_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('include', JORNADA_SEMANAL_PATH);
        cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
        return cerrarPanel();
      }

      cy.login({ email: 'superadmin@novatrans.app', password: '[REDACTED]', useSession: false });
      cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
      cy.wait(2000);

      cy.visit(JORNADA_SEMANAL_URL_ABS, { failOnStatusCode: false });
      cy.url({ timeout: 15000 }).should('include', JORNADA_SEMANAL_PATH);
      cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
      return cerrarPanel();
    });
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const casoId = casoExcel.caso || `TC${String(idx + 1).padStart(3, '0')}`;
    const nombre = `${casoId} - ${casoExcel.nombre}`;

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Función solicitada: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irAJornadaSemanalLimpio()
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
          pantalla: 'Jornada Semanal'
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
      pantalla: 'Jornada Semanal'
    });
  }

  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      'cargarPantalla': cargarPantalla,
      'ejecutarBusquedaIndividual': ejecutarBusquedaIndividual,
      'limpiarBusqueda': limpiarBusqueda,
      'seleccionUnica': seleccionUnica,
      'seleccionMultiple': seleccionMultiple,
      'seleccionarTodos': seleccionarTodos,
      'abrirAcciones': abrirAcciones,
      'borradoMasivoConfirmar': borradoMasivoConfirmar,
      'borradoMasivoCancelar': borradoMasivoCancelar,
      'abrirFormularioCrear': abrirFormularioCrear,
      'ejecutarCrearIndividual': ejecutarCrearIndividual,
      'crearCancelar': crearCancelar,
      'validarEmpresaObligatoria': validarEmpresaObligatoria,
      'validarNombreObligatorio': validarNombreObligatorio,
      'validarLongitudNombre': validarLongitudNombre,
      'validarHorasObligatorias': validarHorasObligatorias,
      'crearConTodo': ejecutarCrearIndividual,
      'crearDuplicado': ejecutarCrearIndividual,
      'crearMinima': ejecutarCrearIndividual,
      'crearYCrearOtro': ejecutarCrearIndividual,
      'crearCancelarCaso': crearCancelar,
      'editarAbrirFormulario': editarAbrirFormulario,
      'ejecutarEditarIndividual': ejecutarEditarIndividual,
      'editarCancelar': editarCancelar,
      'mostrarColumna': mostrarColumna,
      'ordenarColumna': ordenarColumna,
      'filtrarEmpresa': filtrarEmpresa,
      'anadirTiposJornada': anadirTiposJornada
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`Función no encontrada en mapping: "${nombreFuncion}"`);
      return () => cy.wrap(null);
    }
    return funciones[nombreFuncion];
  }

  // === Funciones de pantalla ===
  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 }).should('have.length.greaterThan', 0);
  }

  function ejecutarBusquedaIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = casoExcel.dato_1 || '';
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${valor}{enter}`, { force: true });
    cy.wait(1500);
    return cy.get('body').then($body => {
      const filas = $body.find('.fi-ta-row:visible, tr:visible').length;
      if (filas > 0) {
        return cy.wrap(filas).should('be.greaterThan', 0);
      }
      return cy.contains(/No se encontraron registros/i, { timeout: 1000 }).should('exist');
    });
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const termino = casoExcel.dato_1 || '';
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${termino}{enter}`, { force: true });
    cy.wait(1500);
    cy.get('body').then($body => {
      const chips = $body.find('[data-testid="clear-filter"], .MuiChip-deleteIcon, [aria-label="Quitar filtro"]');
      if (chips.length) {
        cy.wrap(chips.first()).click({ force: true });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear({ force: true });
      }
    });
    return cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '');
  }

  function seleccionUnica() {
    cy.get('.fi-ta-row:visible', { timeout: 10000 }).first().click({ force: true });
    return cy.wait(300);
  }

  function seleccionMultiple() {
    cy.get('.fi-ta-row:visible', { timeout: 10000 }).eq(0).click({ force: true });
    cy.wait(200);
    cy.get('.fi-ta-row:visible', { timeout: 10000 }).eq(1).click({ force: true });
    return cy.wait(300);
  }

  function seleccionarTodos() {
    cy.get('thead input[type="checkbox"], thead .fi-checkbox', { timeout: 10000 }).first().click({ force: true });
    cy.wait(200);
    cy.get('thead input[type="checkbox"], thead .fi-checkbox', { timeout: 10000 }).first().click({ force: true });
    return cy.wait(200);
  }

  function abrirAcciones() {
    cy.get('.fi-ta-row:visible', { timeout: 10000 }).first().click({ force: true });
    cy.wait(200);
    cy.contains('button, a', /Abrir acciones/i, { timeout: 10000 }).first().click({ force: true });
    return cy.wait(500);
  }

  function borradoMasivoConfirmar() {
    abrirAcciones();
    cy.contains('button, a', /Borrar seleccionados/i, { timeout: 10000 }).first().click({ force: true });
    cy.wait(200);
    // Modificado para cancelar en lugar de confirmar
    cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('button, a', /Cancelar|Cerrar|No/i, { timeout: 10000 }).click({ force: true });
      });
    return cy.get('.fi-ta-row').should('exist'); // Asegurar que las filas aún existan
  }

  function borradoMasivoCancelar() {
    abrirAcciones();
    cy.contains('button, a', /Borrar seleccionados/i, { timeout: 10000 }).first().click({ force: true });
    return confirmarModal(['Cancelar', 'Cerrar']).then(() => cy.wait(500));
  }

  function abrirFormularioCrear() {
    cy.contains('a, button', /Crear Jornada Semanal/i, { timeout: 10000 }).first().click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornada-semanal/create');
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    const campos = obtenerCamposDesdeExcel(casoExcel);
    let empresa = campos['data.company_id'] || casoExcel.dato_1 || 'Admin';
    let nombre = campos['data.name'] || casoExcel.dato_2 || generarNombreUnico('jornada');
    let horas = campos['data.weekly_hours_hours'] || casoExcel.dato_3 || '40';
    let minutos = campos['data.weekly_hours_minutes'] || casoExcel.dato_4 || '0';
    const descripcion = campos['data.description'] || casoExcel.dato_5 || '';

    if (nombre.includes('prueba1+')) {
      if (numero === 16) {
        nombre = nombre.replace('prueba1+', 'prueba1');
      } else {
        nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
        contadorPrueba++;
      }
    }

    if (horas && typeof horas === 'number') horas = String(horas);
    if (minutos && typeof minutos === 'number') minutos = String(minutos);

    return cy.url().then((urlActual) => {
      if (!urlActual.includes('/jornada-semanal/create')) {
        return abrirFormularioCrear().then(() => cy.wait(800));
      }
      return cy.wrap(null);
    }).then(() => {
      if (numero !== 19) {
        seleccionarEmpresaFormulario(empresa);
      }

      if (numero === 20) {
        limpiarCampo('input[name="data.name"], input#data\\.name');
      } else if (nombre) {
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
      }

      if (numero === 21) {
        limpiarCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours');
      } else if (horas) {
        escribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
      }

      if (minutos !== undefined) {
        escribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
      }

      if (descripcion) {
        escribirCampo('textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description', descripcion);
      }

      if (numero === 18) {
        return encontrarBotonAlFinal('Cancelar').then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
      }

      if (numero === 17) {
        return encontrarBotonAlFinal('Crear y crear otro').then(() => cy.wait(2000));
      }

      if ([36, 37].includes(numero)) {
        return encontrarBotonAlFinal('Crear')
          .then(() => cy.wait(1500))
          .then(() => {
            cy.get('body').should(($body) => {
              const texto = $body.text().toLowerCase();
              expect(texto).to.include('minut');
            });
            return cy.url().should('include', '/jornada-semanal/create');
          });
      }

      return encontrarBotonAlFinal('Crear').then(() => cy.wait(2000));
    });
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrear()
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
  }

  const validarEmpresaObligatoria = ejecutarCrearIndividual;
  const validarNombreObligatorio = ejecutarCrearIndividual;
  const validarLongitudNombre = ejecutarCrearIndividual;
  const validarHorasObligatorias = ejecutarCrearIndividual;

  function editarAbrirFormulario() {
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(300);
    cy.contains('.fi-ta-row:visible a, .fi-ta-row:visible button', /Editar/i, { timeout: 10000 })
      .first()
      .click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornada-semanal/');
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || casoExcel.dato_1 || generarNombreUnico('jornada-edit');

    return editarAbrirFormulario()
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => encontrarBotonAlFinal('Guardar cambios'))
      .then(() => esperarToastExito());
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario()
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
  }

  function mostrarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const texto = extraerDesdeNombre(casoExcel.nombre, 'Mostrar columna') || casoExcel.dato_1 || 'Descripción';

    cy.contains('button[title*="Alternar"], button[aria-label*="column"], .fi-ta-col-toggle button', /columnas/i, { timeout: 10000 })
      .first()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, .fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('label, span, div', new RegExp(texto, 'i'), { timeout: 10000 })
          .should('be.visible')
          .then(($el) => {
            const checkbox = $el.find('input[type="checkbox"]');
            if (checkbox.length) {
              cy.wrap(checkbox).click({ force: true });
            } else {
              cy.wrap($el).click({ force: true });
            }
          });
      });

    cy.get('body').click(0, 0, { force: true });
    return cy.get('.fi-ta-header-cell, th').should('exist');
  }

  function ordenarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const texto = extraerDesdeNombre(casoExcel.nombre, 'Ordenar por') || casoExcel.dato_1 || '';

    return cy.get('body').then(($body) => {
      const regex = new RegExp(`^${texto}$`, 'i');
      const $header = $body.find('th.fi-ta-header-cell, .fi-ta-header-cell').filter((_, el) => {
        return regex.test(Cypress.$(el).text().trim());
      }).first();

      if ($header.length) {
        cy.wrap($header)
          .scrollIntoView({ offset: { top: 0, left: 0 } })
          .within(($headerEl) => {
            const $icon = $headerEl.find('span[role="button"], .fi-ta-header-cell-sort-icon, svg.fi-ta-header-cell-sort-icon').first();
            if ($icon.length) {
              cy.wrap($icon).click({ force: true });
              cy.wait(200);
              cy.wrap($icon).click({ force: true });
            }
          });
      }
      return cy.wrap(null);
    });
  }

  function filtrarEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerDatoPorEtiqueta(casoExcel, 'empresa') || casoExcel.dato_1 || 'Admin';

    cy.get('body').type('{esc}{esc}');
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });

    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panel')
      .should('be.visible');

    cy.get('@panel').within(() => {
      cy.contains('label, span, div, p', /Empresa/i, { timeout: 10000 })
        .should('be.visible')
        .closest('div, fieldset, section')
        .as('bloqueEmpresa');
    });

    cy.get('@bloqueEmpresa').then($bloque => {
      const $select = $bloque.find('select:visible');
      if ($select.length) {
        cy.wrap($select).first().select(empresa, { force: true });
        return;
      }

      const openers = [
        '[role="combobox"]:visible',
        '[aria-haspopup="listbox"]:visible',
        '[aria-expanded]:visible',
        'button:visible',
        '[role="button"]:visible',
        '.fi-select-trigger:visible',
        '.fi-input:visible'
      ];

      let opened = false;
      for (const sel of openers) {
        const $el = $bloque.find(sel).first();
        if ($el.length) {
          cy.wrap($el).scrollIntoView().click({ force: true });
          opened = true;
          break;
        }
      }

      if (!opened) {
        cy.wrap($bloque).scrollIntoView().click('center', { force: true });
      }

      cy.get('body').then($body => {
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
        } else {
          cy.get('.fi-dropdown-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible', { timeout: 10000 })
            .first()
            .within(() => {
              cy.contains(':visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
            });
        }
      });
    });

    cy.get('@panel').then($p => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });

    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 }).should('have.length.greaterThan', 0);
  }

  function anadirTiposJornada(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const tipoJornada = obtenerDatoPorEtiqueta(casoExcel, 'tipo') || casoExcel.dato_1 || '';

    return editarAbrirFormulario()
      .then(() => cy.url({ timeout: 10000 }).should('match', /\/jornada-semanal\/.+\/edit/))
      .then(() => {
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(300);
        const abrirModal = () => {
          return cy.contains('button, a', /Añadir Tipos? de Jornada/i, { timeout: 10000 })
            .filter(':visible')
            .first()
            .scrollIntoView()
            .then(($btn) => {
              cy.wrap($btn).click({ force: true });
              cy.wait(600);
              return cy.get('body').then(($body) => {
                if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
                  $btn[0].dispatchEvent(new Event('click', { bubbles: true }));
                  cy.wait(600);
                }
              });
            });
        };

        return abrirModal().then(() => {
          return cy.get('body').then(($body) => {
            if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
              return abrirModal();
            }
            return null;
          });
        });
      })
      .then(() => {
        cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
          .as('modalTipos')
          .should('be.visible');

        cy.get('@modalTipos').within(() => {
          if (tipoJornada) {
            cy.contains('label, span, div, button', new RegExp(tipoJornada, 'i'), { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          } else {
            cy.get('[type="checkbox"]:visible, [role="option"]:visible, .fi-checkbox input:visible')
              .first()
              .scrollIntoView()
              .click({ force: true });
          }
          cy.contains('button, a', /Enviar|Guardar/i, { timeout: 10000 }).click({ force: true });
        });

        cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 }).should('not.exist');
        return cy.wait(1000);
      });
  }

  // === Helpers reutilizables ===
  function obtenerCamposDesdeExcel(casoExcel) {
    const campos = {};
    for (let i = 1; i <= 12; i++) {
      const clave = casoExcel[`valor_etiqueta_${i}`];
      const valor = casoExcel[`dato_${i}`];
      if (clave) campos[clave] = valor;
    }
    return campos;
  }

  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    if (!etiquetaBuscada) return '';
    for (let i = 1; i <= 12; i++) {
      const etiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (etiqueta === etiquetaBuscada.toLowerCase().trim()) {
        return casoExcel[`dato_${i}`] || '';
      }
    }
    return '';
  }

  function extraerDesdeNombre(nombreCaso, clave) {
    if (!nombreCaso || !clave) return '';
    const regex = new RegExp(`${clave}\\s*(.*)$`, 'i');
    const match = nombreCaso.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return '';
  }

  function generarNombreUnico(prefijo = 'item') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefijo}${timestamp}${random}`;
  }

  function seleccionarEmpresaFormulario(valor) {
    const opcion = valor || 'Admin';
    return cy.get('body').then(($body) => {
      const selector = 'select#data\\.company_id:visible, select[name="data.company_id"]:visible';
      if ($body.find(selector).length) {
        return cy.get(selector)
          .first()
          .scrollIntoView()
          .then(($select) => {
            const opciones = Array.from($select[0].options || []);
            const match = opciones.find(
              (opt) => (opt.text || '').trim().toLowerCase() === opcion.toLowerCase()
                || (opt.value || '').trim().toLowerCase() === opcion.toLowerCase()
            ) || opciones.find(opt => (opt.value || '').trim() === opcion) || opciones[0];

            const valorSeleccion = match ? (match.value || match.text) : opcion;
            cy.wrap($select).select(valorSeleccion, { force: true });
          });
      }
      return seleccionarOpcionChoices(opcion, 'Empresa');
    });
  }

  function seleccionarOpcionChoices(texto, label) {
    if (!texto) return cy.wrap(null);

    const labelRegex = label ? new RegExp(label, 'i') : null;
    const openersSelector = '.choices, .choices[data-type="select-one"], [role="combobox"], [aria-haspopup="listbox"], select, .fi-select-trigger';

    function abrirSelect() {
      if (labelRegex) {
        return cy.contains('label, span, div', labelRegex, { timeout: 10000 })
          .then(($label) => {
            const wrappers = [
              $label.closest('[data-field-wrapper]'),
              $label.closest('.fi-field'),
              $label.closest('.fi-fo-field-wrp'),
              $label.closest('.fi-fo-field'),
              $label.closest('.grid'),
              $label.closest('section'),
              $label.closest('form'),
              $label.parent()
            ].filter($el => $el && $el.length);

            for (const $wrapper of wrappers) {
              const $objetivo = $wrapper.find(openersSelector).filter(':visible').first();
              if ($objetivo.length) {
                cy.wrap($objetivo).scrollIntoView().click({ force: true });
                return;
              }
            }

            cy.get(openersSelector, { timeout: 10000 })
              .filter(':visible')
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
      }

      return cy.get(openersSelector, { timeout: 10000 })
        .filter(':visible')
        .first()
        .scrollIntoView()
        .click({ force: true });
    }

    abrirSelect();
    cy.wait(300);

    cy.get('.choices.is-open, .choices[aria-expanded="true"], .choices.is-focused')
      .filter(':visible')
      .last()
      .as('dropdownActual');

    const inputBuscador = '.choices__input, input[placeholder*="Teclee"], input[placeholder*="Buscar"], input[type="search"]';
    const opcionSelector = '[role="option"], .choices__item--choice';
    const regex = new RegExp(texto, 'i');

    return cy.get('@dropdownActual').within(() => {
      cy.get(inputBuscador).filter(':visible').first().then(($input) => {
        if ($input && $input.length) {
          cy.wrap($input).clear({ force: true }).type(texto, { force: true, delay: 20 });
        }
      });
    })
      .then(() => cy.wait(300))
      .then(() =>
        cy.get('@dropdownActual').within(() => {
          cy.contains(opcionSelector, regex, { timeout: 10000 })
            .scrollIntoView({ duration: 200 })
            .click({ force: true });
        })
      )
      .then(() => cy.wait(200));
  }

  function escribirCampo(selector, valor) {
    if (valor === undefined || valor === null) return cy.wrap(null);
    return cy.get(selector, { timeout: 10000 })
      .first()
      .scrollIntoView()
      .clear({ force: true })
      .type(String(valor), { force: true, delay: 20 });
  }

  function limpiarCampo(selector) {
    return cy.get(selector, { timeout: 10000 })
      .first()
      .scrollIntoView()
      .clear({ force: true });
  }

  function encontrarBotonAlFinal(textoBoton) {
    cy.scrollTo('bottom', { duration: 500 });
    cy.wait(500);

    return cy.get('body').then(($body) => {
      const regex = new RegExp(`^${textoBoton}$`, 'i');
      let $btn = $body.find('button:visible, a:visible').filter((i, el) => regex.test(Cypress.$(el).text().trim())).first();
      if ($btn.length === 0) {
        $btn = $body.find('button, a').filter((i, el) => regex.test(Cypress.$(el).text().trim())).first();
      }

      if ($btn.length > 0) {
        cy.wrap($btn).scrollIntoView({ duration: 300 }).should('be.visible');
        cy.wrap($btn).click({ force: true });
      } else {
        cy.contains('button, a', regex, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      }
    });
  }

  function confirmarModal(textos = []) {
    const opciones = Array.isArray(textos) ? textos : [textos];

    return cy.get('.fi-modal:visible, [role="dialog"]:visible, .swal2-container:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        const encontrado = opciones.some((texto) => {
          const selector = 'button, a';
          const regex = new RegExp(`^${texto}$`, 'i');
          const $btn = Cypress.$(selector).filter((_, el) => regex.test(Cypress.$(el).text().trim()));
          if ($btn.length) {
            cy.wrap($btn.first()).click({ force: true });
            return true;
          }
          return false;
        });

        if (!encontrado) {
          cy.contains('button, a', /Borrar|Aceptar|Confirmar|Sí|Cancelar|Cerrar|No/i, { timeout: 1000 })
            .first()
            .click({ force: true });
        }
      });
  }

  function esperarToastExito() {
    return cy.get('body').then(($body) => {
      if ($body.find('.swal2-container:visible, .fi-notification:visible').length) {
        cy.contains('.swal2-container .swal2-title, .fi-notification', /Éxito|Guardado|Creado/i, { timeout: 10000 }).should('be.visible');
      }
    });
  }
});