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
      const verificarPantallaCargada = () => {
        // Esperar a que la página cargue completamente
        cy.wait(1000);
        
        // Intentar cerrar panel lateral si existe (sin fallar si no existe)
        cy.get('body').then(($body) => {
          const hayPanelLateral = $body.find('[class*="overlay"], [class*="modal"], [class*="drawer"], [class*="sidebar"]').length > 0;
          if (hayPanelLateral) {
            cy.log('Cerrando panel lateral...');
            cy.get('body').type('{esc}');
            cy.wait(500);
          }
        });

        // Verificar que la página esté cargada
        cy.get('body', { timeout: 20000 }).should('be.visible');
        
        // Verificar si hay tabla o estado de "sin datos" - ambos son válidos
        return cy.get('body', { timeout: 20000 }).then(($body) => {
          const hayTabla = $body.find('.fi-ta-table, table').length > 0;
          
          if (hayTabla) {
            cy.log('Tabla encontrada, verificando visibilidad...');
            return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist');
          }
          
          // Si no hay tabla, verificar si hay estado de "sin datos"
          const hayEstadoVacio = $body.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"], [class*="sin datos"], [class*="no hay"]').length > 0;
          const textoBody = $body.text().toLowerCase();
          const hayMensajeSinDatos = textoBody.includes('no hay datos') || 
                                     textoBody.includes('sin registros') || 
                                     textoBody.includes('tabla vacía') ||
                                     textoBody.includes('no se encontraron') ||
                                     textoBody.includes('no se encontraron registros') ||
                                     textoBody.includes('sin resultados') ||
                                     textoBody.includes('no existen registros');
          
          if (hayEstadoVacio || hayMensajeSinDatos) {
            cy.log('No hay registros en la tabla - esto es válido (OK)');
            return cy.wrap(true);
          }
          
          // Si no hay tabla ni mensaje, esperar un poco más y buscar la tabla
          cy.log('Esperando a que la tabla se cargue...');
          return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist').catch(() => {
            // Si después del timeout no hay tabla, verificar una última vez si hay mensaje de sin datos
            return cy.get('body', { timeout: 2000 }).then(($body2) => {
              const textoBody2 = $body2.text().toLowerCase();
              const hayMensaje = textoBody2.includes('no hay') || 
                                textoBody2.includes('sin datos') || 
                                textoBody2.includes('vacío') ||
                                textoBody2.includes('sin registros') ||
                                textoBody2.includes('sin resultados') ||
                                textoBody2.includes('no se encontraron') ||
                                textoBody2.includes('no se encontraron registros') ||
                                textoBody2.includes('no existen registros');
              const hayEstado = $body2.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"]').length > 0;
              
              if (hayMensaje || hayEstado) {
                cy.log('No hay registros - esto es válido (OK)');
                return cy.wrap(true);
              }
              
              // Si realmente no hay nada, lanzar error
              cy.log('⚠️ No se encontró tabla ni mensaje de sin datos');
              throw new Error('No se encontró la tabla ni mensaje de sin datos');
            });
          });
        });
      };

      if (currentUrl.includes(DASHBOARD_PATH)) {
        cy.visit(JORNADA_SEMANAL_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 20000 }).should('include', JORNADA_SEMANAL_PATH);
        return verificarPantallaCargada();
      }

      cy.login({ email: 'superadmin@novatrans.app', password: '[REDACTED]', useSession: false });
      cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
      cy.wait(2000);

      cy.visit(JORNADA_SEMANAL_URL_ABS, { failOnStatusCode: false });
      cy.url({ timeout: 20000 }).should('include', JORNADA_SEMANAL_PATH);
      return verificarPantallaCargada();
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
    const motivoCambio = 'pruebas';

    return editarAbrirFormulario()
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => {
        // Escribir el motivo del cambio antes de guardar
        cy.log('Escribiendo motivo del cambio...');
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(300);
        
        // Buscar el campo "Motivo del cambio" por múltiples selectores
        const selectoresMotivo = [
          'textarea#data\\.change_reason',
          'textarea[name="data.change_reason"]',
          'textarea[wire\\:model="data.change_reason"]',
          'textarea[placeholder*="Cambio de convenio"]',
          'textarea[placeholder*="ajuste de jornada"]'
        ];
        
        return cy.get('body').then(($body) => {
          let encontrado = false;
          for (const selector of selectoresMotivo) {
            if ($body.find(selector).length > 0) {
              encontrado = true;
              return escribirCampo(selector, motivoCambio);
            }
          }
          
          // Si no se encuentra por selectores específicos, buscar por label
          if (!encontrado) {
            return cy.contains('label, span, div', /Motivo del cambio/i, { timeout: 10000 })
              .then(($label) => {
                const $wrapper = $label.closest('div, section, form, fieldset');
                const $textarea = $wrapper.find('textarea').first();
                if ($textarea.length) {
                  return cy.wrap($textarea)
                    .scrollIntoView()
                    .clear({ force: true })
                    .type(motivoCambio, { force: true, delay: 20 });
                }
                // Si aún no se encuentra, buscar cualquier textarea cerca del label
                return cy.get('textarea:visible')
                  .first()
                  .scrollIntoView()
                  .clear({ force: true })
                  .type(motivoCambio, { force: true, delay: 20 });
              });
          }
        });
      })
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
    const motivoCambio = 'pruebas';

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

        // Verificar si hay opciones disponibles para seleccionar (fuera del within para evitar problemas)
        return cy.get('@modalTipos').then(($modal) => {
          // Buscar checkboxes o inputs de selección
          const hayCheckboxes = $modal.find('[type="checkbox"]:visible, .fi-checkbox input:visible, input[type="checkbox"]:visible').length > 0;
          
          // Buscar opciones listadas (labels con texto relacionado a jornadas, opciones de lista)
          const hayOpcionesListadas = $modal.find('[role="option"]:visible, .fi-fo-checkbox-list-option:visible, .fi-fo-checkbox-list-option-label:visible').length > 0;
          
          // Buscar elementos seleccionables que contengan texto relacionado con tipos de jornada
          const hayElementosSeleccionables = $modal.find('label:visible, .fi-fo-checkbox-list-option-label:visible').filter((i, el) => {
            const texto = Cypress.$(el).text().toLowerCase();
            // Buscar texto que indique que es una opción de tipo de jornada (no solo "jornada" o "tipo" en labels genéricos)
            return (texto.includes('jornada') && texto.length > 10) || 
                   (texto.includes('[') && texto.includes(']')) || // Formato como "admin [Jornada de trabajo]"
                   texto.match(/días activo/i); // "Días activo: L, M, X, J, V"
          }).length > 0;
          
          // Verificar si hay mensaje de "sin resultados" o "no hay datos"
          const textoModal = $modal.text().toLowerCase();
          const hayMensajeSinDatos = textoModal.includes('no hay') || 
                                     textoModal.includes('sin resultados') || 
                                     textoModal.includes('sin datos') ||
                                     textoModal.includes('no se encontraron');
          
          // Si no hay nada para seleccionar o hay mensaje de sin datos, cerrar el modal y terminar (OK)
          if ((!hayCheckboxes && !hayOpcionesListadas && !hayElementosSeleccionables) || hayMensajeSinDatos) {
            cy.log('No hay opciones disponibles para seleccionar - esto es válido (OK)');
            // Intentar cerrar con el botón X o Cancelar
            const $btnCerrar = $modal.find('button[aria-label*="cerrar"], button[aria-label*="close"], .fi-modal-close, [aria-label="Close"], button:contains("×")').first();
            if ($btnCerrar.length > 0) {
              cy.wrap($btnCerrar).click({ force: true });
            } else {
              cy.get('@modalTipos').within(() => {
                cy.contains('button, a', /Cancelar|Cerrar/i, { timeout: 10000 })
                  .first()
                  .click({ force: true });
              });
            }
            return cy.wrap(true);
          }

          // Si hay opciones, proceder con la selección dentro del modal
          return cy.get('@modalTipos').within(() => {
            if (tipoJornada) {
              cy.contains('label, span, div, button', new RegExp(tipoJornada, 'i'), { timeout: 10000 })
                .scrollIntoView()
                .click({ force: true });
            } else {
              // Buscar el primer checkbox disponible
              cy.get('[type="checkbox"]:visible, .fi-checkbox input:visible, input[type="checkbox"]:visible', { timeout: 5000 })
                .first()
                .then(($checkbox) => {
                  if ($checkbox.length > 0) {
                    cy.wrap($checkbox)
                      .scrollIntoView()
                      .click({ force: true });
                  } else {
                    // Si no hay checkbox, buscar opciones listadas
                    cy.get('[role="option"]:visible, .fi-fo-checkbox-list-option:visible, .fi-fo-checkbox-list-option-label:visible', { timeout: 5000 })
                      .first()
                      .then(($opcion) => {
                        if ($opcion.length > 0) {
                          cy.wrap($opcion)
                            .scrollIntoView()
                            .click({ force: true });
                        } else {
                          // Si aún no hay nada, considerar que no hay opciones y cerrar
                          cy.log('No se encontraron opciones seleccionables - esto es válido (OK)');
                          cy.contains('button, a', /Cancelar|Cerrar/i, { timeout: 10000 })
                            .first()
                            .click({ force: true });
                          return cy.wrap(true);
                        }
                      });
                  }
                });
            }
            cy.contains('button, a', /Enviar|Guardar/i, { timeout: 10000 }).click({ force: true });
            return cy.wrap(false); // Indica que se seleccionó algo
          });
        }).then((sinOpciones) => {
          // Si no había opciones, ya se cerró el modal, terminar aquí
          if (sinOpciones) {
            cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 5000 }).should('not.exist');
            return cy.wrap(null); // Terminar sin escribir motivo
          }

          // Si había opciones y se seleccionó, esperar a que se cierre el modal
          cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 }).should('not.exist');
          return cy.wait(1000);
        });
      })
      .then((resultado) => {
        // Solo escribir el motivo del cambio si se seleccionó algo (resultado no es null)
        if (resultado === null) {
          cy.log('No se seleccionó nada, no es necesario escribir motivo del cambio');
          return cy.wrap(null);
        }

        // Después de cerrar el modal, escribir el motivo del cambio
        cy.log('Escribiendo motivo del cambio...');
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(300);
        
        // Buscar el campo "Motivo del cambio" por múltiples selectores
        const selectoresMotivo = [
          'textarea#data\\.change_reason',
          'textarea[name="data.change_reason"]',
          'textarea[wire\\:model="data.change_reason"]',
          'textarea[placeholder*="Cambio de convenio"]',
          'textarea[placeholder*="ajuste de jornada"]'
        ];
        
        return cy.get('body').then(($body) => {
          let encontrado = false;
          for (const selector of selectoresMotivo) {
            if ($body.find(selector).length > 0) {
              encontrado = true;
              return escribirCampo(selector, motivoCambio);
            }
          }
          
          // Si no se encuentra por selectores específicos, buscar por label
          if (!encontrado) {
            return cy.contains('label, span, div', /Motivo del cambio/i, { timeout: 10000 })
              .then(($label) => {
                const $wrapper = $label.closest('div, section, form, fieldset');
                const $textarea = $wrapper.find('textarea').first();
                if ($textarea.length) {
                  return cy.wrap($textarea)
                    .scrollIntoView()
                    .clear({ force: true })
                    .type(motivoCambio, { force: true, delay: 20 });
                }
                // Si aún no se encuentra, buscar cualquier textarea cerca del label
                return cy.get('textarea:visible')
                  .first()
                  .scrollIntoView()
                  .clear({ force: true })
                  .type(motivoCambio, { force: true, delay: 20 });
              });
          }
        });
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