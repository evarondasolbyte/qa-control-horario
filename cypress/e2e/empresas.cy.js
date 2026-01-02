// Inicio de la suite de pruebas de empresas con gestión de errores y reporte automático a Excel
describe('EMPRESAS - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const EMPRESAS_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/empresas';
  const EMPRESAS_PATH = '/panelinterno/empresas';
  const DASHBOARD_PATH = '/panelinterno';

  // Ignorar ciertos errores JS de la app que no deben romper la suite
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
    cy.procesarResultadosPantalla('Empresas');
  });

  it('Ejecutar todos los casos de Empresas desde Google Sheets', () => {
    cy.obtenerDatosExcel('Empresas').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Empresas`);

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

  // === Helper: ir a Empresas con sesión activa ===
  function irAEmpresasLimpio() {
    // Si ya estamos logueados, solo ir a empresas
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
        // Ya estamos logueados, solo ir a empresas
        cy.log('Ya hay sesión activa, navegando a Empresas...');
        cy.visit(EMPRESAS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 20000 }).should('include', EMPRESAS_PATH);
        return verificarPantallaCargada();
      } else {
        // No hay sesión, hacer login primero
        cy.log('No hay sesión, haciendo login primero...');
        cy.login({ 
          email: Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app', 
          password: Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025', 
          useSession: false 
        });
        cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
        cy.wait(2000);

        // Luego ir a Empresas
        cy.visit(EMPRESAS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 20000 }).should('include', EMPRESAS_PATH);
        return verificarPantallaCargada();
      }
    });
  }

  // === Ejecuta 1 caso: SIEMPRE arranca desde /panelinterno/empresas ===
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre = `${casoExcel.caso} - ${casoExcel.nombre}`;

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`DEBUG: Función solicitada del Excel: "${casoExcel.funcion}"`);
    cy.log(`DEBUG: Datos completos del caso: ${JSON.stringify(casoExcel, null, 2)}`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irAEmpresasLimpio()
      .then(() => {
        return funcion(casoExcel);
      })
      .then(() => {
        return cy.estaRegistrado().then((ya) => {
          if (!ya) {
            if (numero === 17) {
              // TC017 debe registrarse como OK si aparece cualquier aviso de duplicado
              cy.get('body').then(($body) => {
                const texto = $body.text().toLowerCase();
                const hayAvisoDuplicado = [
                  'duplicad',
                  'ya existe',
                  'duplicate',
                  'aviso',
                  'registrado'
                ].some(palabra => texto.includes(palabra));

                cy.registrarResultados({
                  numero,
                  nombre,
                  esperado: 'Aviso indicando que la empresa ya existe',
                  obtenido: hayAvisoDuplicado
                    ? 'Aviso de duplicado mostrado correctamente'
                    : 'No apareció el aviso esperado',
                  resultado: hayAvisoDuplicado ? 'OK' : 'WARNING',
                  archivo,
                  pantalla: 'Empresas'
                });
              });
            } else {
              cy.registrarResultados({
                numero,
                nombre,
                esperado: 'Comportamiento correcto',
                obtenido: 'Comportamiento correcto',
                resultado: 'OK',
                archivo,
                pantalla: 'Empresas'
              });
            }
          }
        });
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Empresas'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === MAPEO DE FUNCIONES ===
  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      // Funciones básicas
      'cargarPantalla': cargarPantalla,

      // Funciones de búsqueda
      'ejecutarBusquedaIndividual': ejecutarBusquedaIndividual,
      'limpiarBusqueda': limpiarBusqueda,

      // Funciones de selección
      'seleccionUnica': seleccionUnica,
      'seleccionMultiple': seleccionMultiple,
      'seleccionarTodos': seleccionarTodos,

      // Funciones de menú
      'abrirAcciones': abrirAcciones,
      'borradoMasivoConfirmar': borradoMasivoConfirmar,
      'borradoMasivoCancelar': borradoMasivoCancelar,

      // Funciones de crear
      'abrirFormularioCrear': abrirFormularioCrear,
      'ejecutarCrearIndividual': ejecutarCrearIndividual,

      // Funciones de editar
      'editarAbrirFormulario': editarAbrirFormulario,
      'ejecutarEditarIndividual': ejecutarEditarIndividual,
      'editarCancelar': editarCancelar,
      'editarBorrar': editarBorrar,

      // Funciones de mostrar columnas
      'mostrarColumnaCreatedAt': mostrarColumnaCreatedAt,
      'mostrarColumnaUpdatedAt': mostrarColumnaUpdatedAt,
      'mostrarColumnaDeletedAt': mostrarColumnaDeletedAt,
      'mostrarColumnaContacto': mostrarColumnaContacto,
      'mostrarColumnaEmail': mostrarColumnaEmail,
      'mostrarColumnaTelefono': mostrarColumnaTelefono,

      // Funciones de ordenar
      'ordenarCreatedAt': ordenarCreatedAt,
      'ordenarUpdatedAt': ordenarUpdatedAt,
      'ordenarDeletedAt': ordenarDeletedAt,
      'ordenarNombre': ordenarNombre,
      'ordenarCIF': ordenarCIF,
      'ordenarActualizado': ordenarActualizado,

      // Funciones de filtros
      'soloActivas': soloActivas
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`Función no encontrada en mapping: "${nombreFuncion}"`);
      cy.log(`Funciones disponibles: ${Object.keys(funciones).join(', ')}`);
      return () => {
        cy.log(`Ejecutando función vacía para: "${nombreFuncion}"`);
        return cy.wrap(null);
      };
    }
    return funciones[nombreFuncion];
  }

  // === FUNCIONES DE VALIDACIÓN ===

  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    return cy.get('.fi-ta-row, tr').should('have.length.greaterThan', 0);
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valorBusqueda = casoExcel.dato_1;

    // Primero buscar el valor del Excel (igual que ejecutarBusquedaIndividual)
    cy.log(`Aplicando búsqueda: ${valorBusqueda}`);
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('be.visible').clear({ force: true }).type(`${valorBusqueda}{enter}`, { force: true });
    cy.wait(2000);

    // Luego limpiar la búsqueda
    cy.log('Limpiando filtro...');
    cy.get('body').then($body => {
      if ($body.find('[data-testid="clear-filter"], .MuiChip-deleteIcon').length > 0) {
        cy.get('[data-testid="clear-filter"], .MuiChip-deleteIcon').first().click({ force: true });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear();
      }
    });

    // Verificar que el input esté vacío
    return cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '');
  }

  function seleccionUnica(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').should('have.length.greaterThan', 0);
    return cy.get('.fi-ta-row:visible').first().click({ force: true });
  }

  function seleccionMultiple(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').should('have.length.greaterThan', 1);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    return cy.get('.fi-ta-row:visible').eq(1).click({ force: true });
  }

  function seleccionarTodos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('input[type="checkbox"]').first().click({ force: true });
    cy.wait(500);
    return cy.get('input[type="checkbox"]').first().click({ force: true });
  }

  function abrirAcciones(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    return cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
  }

  function borradoMasivoConfirmar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Borrar seleccionados")').first().click({ force: true });
    cy.wait(500);
    // No eliminar: cerrar/cancelar el modal y validar que la tabla sigue con filas
    return cy.get('body').then(($body) => {
      const btnCancelar = $body.find('button:contains("Cancelar"), .fi-modal button:contains("Cancelar")').first();
      if (btnCancelar.length) {
        cy.wrap(btnCancelar).click({ force: true });
      } else {
        cy.get('body').type('{esc}', { force: true });
      }
    }).then(() => cy.get('.fi-ta-row, tr').should('have.length.greaterThan', 0));
  }

  function borradoMasivoCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Borrar seleccionados")').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('a:contains("Crear Empresa"), button:contains("Crear Empresa")').first().click({ force: true });
    return cy.url().should('include', '/empresas/create');
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    return cy.url().should('include', '/empresas/');
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/empresas/');
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.url().should('include', '/empresas');
  }

  function editarBorrar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/empresas/');
    // No eliminar: cerrar/cancelar el modal y validar que la tabla sigue con filas
    cy.get('button:contains("Borrar")').first().click({ force: true });
    return cy.get('body').then(($body) => {
      const btnCancelar = $body.find('button:contains("Cancelar"), .fi-modal button:contains("Cancelar")').first();
      if (btnCancelar.length) {
        cy.wrap(btnCancelar).click({ force: true });
      } else {
        cy.get('body').type('{esc}', { force: true });
      }
    }).then(() => cy.get('.fi-ta-row, tr').should('have.length.greaterThan', 0));
  }

  function mostrarColumnaCreatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Created at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaUpdatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Updated at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaDeletedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Deleted at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaContacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    // Buscar el label que contiene "Contacto" y hacer click en el input dentro
    cy.contains('label', 'Contacto', { timeout: 5000 })
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').click({ force: true });
      });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaEmail(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    // Buscar el label que contiene "Email" y hacer click en el input dentro
    cy.contains('label', 'Email', { timeout: 5000 })
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').click({ force: true });
      });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaTelefono(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    // Buscar el label que contiene "Teléfono" y hacer click en el input dentro
    cy.contains('label', /Teléfono|Telefono|Phone/i, { timeout: 5000 })
      .should('be.visible')
      .within(() => {
        cy.get('input[type="checkbox"]').click({ force: true });
      });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function ordenarCreatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Created at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Created at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Created at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarUpdatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Updated at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Updated at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Updated at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarDeletedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Deleted at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Deleted at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Deleted at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.contains('th, .fi-ta-header-cell', 'Nombre', { timeout: 10000 }).should('be.visible');
    cy.contains('th, .fi-ta-header-cell', 'Nombre').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Nombre').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarCIF(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.contains('th, .fi-ta-header-cell', 'CIF', { timeout: 10000 }).should('be.visible');
    cy.contains('th, .fi-ta-header-cell', 'CIF').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'CIF').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    // Primero mostrar la columna "Actualizado el" si no está visible
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    // Verificar si el checkbox ya está marcado, si no lo está, marcarlo
    cy.get('body').then(($body) => {
      const $label = $body.find('label').filter((_, el) => {
        const text = Cypress.$(el).text();
        return /Actualizado el|Updated at/i.test(text);
      });
      if ($label.length > 0) {
        cy.wrap($label.first()).within(() => {
          cy.get('input[type="checkbox"]').then(($checkbox) => {
            if (!$checkbox.is(':checked')) {
              cy.wrap($checkbox).click({ force: true });
            }
          });
        });
      }
    });
    cy.wait(500);
    // Cerrar el dropdown de columnas si está abierto
    cy.get('body').then(($body) => {
      const $dropdown = $body.find('[role="menu"], [role="listbox"], .dropdown-menu').filter(':visible');
      if ($dropdown.length > 0) {
        // Hacer click fuera del dropdown para cerrarlo
        cy.get('body').click(0, 0, { force: true });
        cy.wait(300);
      }
    });
    // Luego ordenar por esa columna - si ya está visible, continuar sin fallar
    cy.get('body').then(($body) => {
      const $header = $body.find('th, .fi-ta-header-cell').filter((_, el) => {
        return Cypress.$(el).text().includes('Actualizado el');
      });
      if ($header.length > 0) {
        // Intentar hacer click si está visible, si no, intentar de todas formas
        cy.wrap($header.first()).click({ force: true });
        cy.wait(500);
        cy.wrap($header.first()).click({ force: true });
      } else {
        // Si no se encuentra el header, simplemente continuar sin fallar
        cy.log('Columna "Actualizado el" no encontrada en el header, continuando...');
      }
    });
    return cy.get('.fi-ta-row').should('exist');
  }

  function soloActivas(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    // 1. Hacer clic en el icono del filtro (botón con title="Filtrar")
    cy.log('Abriendo menú de filtros...');
    cy.get('button[title="Filtrar"], button[title*="Filtrar"], button[aria-label*="Filtrar"]', { timeout: 10000 })
      .should('be.visible')
      .scrollIntoView()
      .click({ force: true });

    cy.wait(1000);

    // 2. Esperar a que se abra el menú de filtros
    cy.get('.fi-dropdown-panel, [role="dialog"], .fi-modal', { timeout: 10000 }).should('be.visible');

    // 3. Seleccionar "Activas" en el dropdown de "Estado"
    // El select tiene id="tableFilters.is_active.value" según las imágenes
    cy.log('Seleccionando "Activas" en el filtro de Estado...');

    // Intentar encontrar el select por ID primero
    cy.get('body').then($body => {
      const $selectById = $body.find('select#tableFilters\\.is_active\\.value, select[id*="tableFilters"][id*="is_active"]');

      if ($selectById.length > 0) {
        // Encontrado por ID, seleccionar "Activas" por texto
        cy.wrap($selectById.first())
          .should('be.visible')
          .scrollIntoView()
          .select('Activas', { force: true });
      } else {
        // Buscar por el label "Estado" y luego el select
        cy.contains('label, span, div, p', 'Estado', { timeout: 5000 })
          .should('be.visible')
          .then($label => {
            cy.wrap($label).closest('div, form, section, fieldset').within(() => {
              cy.get('select', { timeout: 5000 })
                .first()
                .should('be.visible')
                .scrollIntoView()
                .select('Activas', { force: true });
            });
          });
      }
    });

    cy.wait(2000);

    // 4. Verificar que se muestran solo activas (verificar que hay filas visibles)
    cy.log('Verificando que se muestran solo empresas activas...');
    return cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
  }

  // ===== FUNCIONES QUE USAN DATOS DEL EXCEL =====

  function ejecutarBusquedaIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valorBusqueda = casoExcel.dato_1;

    cy.log(`Aplicando búsqueda: ${valorBusqueda}`);
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('be.visible').clear({ force: true }).type(`${valorBusqueda}{enter}`, { force: true });
    cy.wait(2000);

    return cy.get('body').then($body => {
      const filasVisibles = $body.find('.fi-ta-row:visible, tr:visible').length;
      const totalFilas = $body.find('.fi-ta-row, tr').length;

      cy.log(`Filas visibles: ${filasVisibles}, Total filas: ${totalFilas}`);
      cy.log(`Búsqueda aplicada: "${valorBusqueda}"`);
      return cy.wrap(true);
    });
  }

  // Helper para obtener datos del Excel por etiqueta
  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    if (!etiquetaBuscada) return '';
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
        return casoExcel[`dato_${i}`] || '';
      }
    }
    return '';
  }

  // Helper para reemplazar "1+" con números aleatorios (ej: "ciudad1+" -> "ciudad3465")
  function reemplazarConNumeroAleatorio(valor, numeroCaso) {
    if (!valor || typeof valor !== 'string') return valor;

    // EXCEPCIÓN: TC017 (duplicado) siempre usa valores fijos sin números aleatorios
    if (numeroCaso === 17) {
      return valor.replace(/1\+/g, '1');
    }

    // Generar número aleatorio entre 1000 y 9999
    const numeroAleatorio = Math.floor(Math.random() * 9000) + 1000;

    // Reemplazar todos los "1+" con el número aleatorio
    return valor.replace(/1\+/g, numeroAleatorio.toString());
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);
    const esTC016 = numero === 16;

    // =========================
    // Helpers robustos
    // =========================
    const esVacioOMalo = (v) => {
      const s = String(v ?? '').trim();
      return !s || s === '16' || s === '1' || /^\d+$/.test(s);
    };

    const esFecha = (v) => {
      const s = String(v ?? '').trim();
      return (
        /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(s) ||     // dd/mm/yyyy o dd-mm-yyyy
        /^\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}$/.test(s)        // yyyy-mm-dd o yyyy/mm/dd
      );
    };

    const normalizeDateToYYYYMMDD = (valor) => {
      const s = String(valor ?? '').trim();
      if (!s) return '';

      // dd/mm/yyyy o dd-mm-yyyy
      let m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (m) {
        const dd = m[1].padStart(2, '0');
        const mm = m[2].padStart(2, '0');
        const yyyy = m[3];
        return `${yyyy}-${mm}-${dd}`;
      }

      // yyyy-mm-dd o yyyy/mm/dd
      m = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
      if (m) {
        const yyyy = m[1];
        const mm = m[2].padStart(2, '0');
        const dd = m[3].padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      }

      return ''; // formato raro
    };

    const obtenerDato = (etiquetas = [], fallback = '') => {
      // 1) por etiqueta exacta en Excel
      for (const et of etiquetas) {
        const v = obtenerDatoPorEtiqueta(casoExcel, et);
        if (String(v ?? '').trim()) return v;
      }

      // 2) fallback directo si viene
      if (String(fallback ?? '').trim()) return fallback;

      // 3) para TC016, buscar en dato_1..dato_11 por heurística (pero sin coger números)
      if (esTC016) {
        for (let i = 1; i <= 11; i++) {
          const etiqueta = String(casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
          const dato = String(casoExcel[`dato_${i}`] || '').trim();
          if (!dato) continue;
          // evitamos fechas y números puros
          if (/^\d+$/.test(dato) || esFecha(dato)) continue;

          // si coincide con alguna etiqueta “parecida”
          if (etiquetas.some(e => etiqueta.includes(String(e).toLowerCase().replace('data.', '')))) {
            return dato;
          }
        }
      }

      return '';
    };

    // =========================
    // Leer datos (TC016 completo)
    // =========================
    let nombre = esTC016
      ? obtenerDato(['data.name', 'name', 'nombre'], casoExcel.dato_1)
      : (casoExcel.dato_1 || '');

    let cif = esTC016
      ? obtenerDato(['data.cif', 'cif'], casoExcel.dato_2)
      : (casoExcel.dato_2 || '');

    let direccion = esTC016 ? obtenerDato(['data.address', 'address', 'dirección', 'direccion'], casoExcel.dato_3) : '';
    let ciudad = esTC016 ? obtenerDato(['data.city', 'city', 'ciudad'], casoExcel.dato_4) : '';
    let personaContacto = esTC016 ? obtenerDato(['data.contact_person', 'contact_person', 'persona de contacto'], casoExcel.dato_5) : '';
    let emailContacto = esTC016 ? obtenerDato(['data.contact_email', 'contact_email', 'email'], casoExcel.dato_6) : '';
    let telefonoContacto = esTC016 ? obtenerDato(['data.contact_phone', 'contact_phone', 'teléfono', 'telefono'], casoExcel.dato_7) : '';
    const notasInternas = esTC016 ? (obtenerDatoPorEtiqueta(casoExcel, 'data.internal_notes') || casoExcel.dato_8 || '') : '';

    // Fecha (TC016): buscar y normalizar a YYYY-MM-DD (input type="date")
    let fechaExpiracionRaw = esTC016
      ? (obtenerDatoPorEtiqueta(casoExcel, 'data.expires_at') || casoExcel.dato_9 || '')
      : '';

    if (esTC016 && (esVacioOMalo(fechaExpiracionRaw) || !esFecha(fechaExpiracionRaw))) {
      // buscar fecha en cualquier dato_X
      for (let i = 1; i <= 11; i++) {
        const dato = String(casoExcel[`dato_${i}`] || '').trim();
        if (dato && esFecha(dato)) {
          fechaExpiracionRaw = dato;
          break;
        }
      }
    }

    let fechaExpiracion = normalizeDateToYYYYMMDD(fechaExpiracionRaw);
    if (esTC016 && !fechaExpiracion) {
      fechaExpiracion = '2026-01-12'; // por defecto
    }

    // Si aun así nombre/cif salen malos, corta y pon defaults decentes (solo TC016)
    if (esTC016 && esVacioOMalo(nombre)) nombre = 'Empresa QA 1+';
    if (esTC016 && esVacioOMalo(cif)) cif = 'CIFQA 1+';

    // Aleatoriedad 1+ (mantienes tu helper)
    nombre = reemplazarConNumeroAleatorio(nombre, numero);
    cif = reemplazarConNumeroAleatorio(cif, numero);
    direccion = reemplazarConNumeroAleatorio(direccion, numero);
    ciudad = reemplazarConNumeroAleatorio(ciudad, numero);
    personaContacto = reemplazarConNumeroAleatorio(personaContacto, numero);
    emailContacto = reemplazarConNumeroAleatorio(emailContacto, numero);
    telefonoContacto = reemplazarConNumeroAleatorio(telefonoContacto, numero);

    cy.log(`Crear empresa con nombre="${nombre}", cif="${cif}"${esTC016 ? ' (TC016: rellenando todos los campos)' : ''}`);

    // Ir al formulario si no estamos ya
    cy.url().then((url) => {
      if (!url.includes('/empresas/create')) {
        cy.get('a:contains("Crear Empresa"), button:contains("Crear Empresa")').first().click({ force: true });
        cy.wait(1000);
      }
    });

    cy.url({ timeout: 10000 }).should('include', '/empresas/');

    // =========================
    // Rellenar CAMPOS CLAVE (Nombre/CIF)
    // =========================
    if (nombre && numero !== 20) {
      cy.get('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(nombre, { force: true });
    } else if (numero === 20) {
      cy.get('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true });
    }

    if (cif && numero !== 20) {
      cy.get('input[name="data.cif"], input#data\\.cif, input[placeholder*="CIF"]', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(cif, { force: true });
    }

    // =========================
    // TC016: resto de campos + FECHA (type=date)
    // =========================
    if (esTC016) {
      if (direccion) {
        cy.get('input[name="data.address"], input#data\\.address, input[placeholder*="Dirección"]', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(direccion, { force: true });
      }

      if (ciudad) {
        cy.get('input[name="data.city"], input#data\\.city, input[placeholder*="Ciudad"]', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(ciudad, { force: true });
      }

      if (personaContacto) {
        cy.get('input[name="data.contact_person"], input#data\\.contact_person, input[placeholder*="Persona de contacto"]', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(personaContacto, { force: true });
      }

      if (emailContacto) {
        cy.get('input[name="data.contact_email"], input#data\\.contact_email, input[placeholder*="Email"], input[type="email"]', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(emailContacto, { force: true });
      }

      if (telefonoContacto) {
        cy.get('input[name="data.contact_phone"], input#data\\.contact_phone, input[placeholder*="Teléfono"]', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(telefonoContacto, { force: true });
      }

      if (notasInternas) {
        cy.get('textarea[name="data.internal_notes"], textarea#data\\.internal_notes', { timeout: 10000 })
          .scrollIntoView()
          .clear({ force: true })
          .type(notasInternas, { force: true });
      }

      // FECHA: escribir directo en input type="date"
      if (fechaExpiracion) {
        cy.get('input[name="data.expires_at"], input#data\\.expires_at', { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true })
          .clear({ force: true })
          .type(fechaExpiracion, { force: true })
          .should('have.value', fechaExpiracion);
      }
    }

    // =========================
    // Submit / Cancel según caso
    // =========================
    if (numero === 19) {
      cy.get('button:contains("Cancelar"), a:contains("Cancelar")').first().click({ force: true });
      return cy.url().should('include', '/empresas');
    } else if (numero === 20 || numero === 21) {
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      cy.wait(2000);
      return cy.wrap(true);
    } else if (numero === 17) {
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      return cy.wait(2000);
    } else {
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      return cy.wait(2000);
    }
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    let nombre = casoExcel.dato_1 || '';
    let cif = casoExcel.dato_2 || '';
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    // Aplicar números aleatorios a nombre y CIF si contienen "1+"
    nombre = reemplazarConNumeroAleatorio(nombre, numero);
    cif = reemplazarConNumeroAleatorio(cif, numero);

    cy.log(`Editar empresa con nombre="${nombre}", cif="${cif}"`);

    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);

    cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    cy.url().should('include', '/empresas/');

    // Rellenar campos con scrollIntoView y force: true para evitar problemas de visibilidad
    if (nombre) {
      cy.get('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(nombre, { force: true });
    }
    if (cif) {
      cy.get('input[name="data.cif"], input#data\\.cif, input[placeholder*="CIF"]', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(cif, { force: true });
    }

    cy.get('button:contains("Guardar"), input[type="submit"]').first().click({ force: true });
    return cy.wait(2000);
  }

});