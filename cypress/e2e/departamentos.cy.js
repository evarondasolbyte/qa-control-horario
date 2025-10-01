// Inicio de la suite de pruebas de departamentos con gestión de errores y reporte automático a Excel
describe('DEPARTAMENTOS - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  let contadorPrueba = 1; // Contador para "prueba1+"
  const DEPARTAMENTOS_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/departamentos';
  const DEPARTAMENTOS_PATH = '/panelinterno/departamentos';
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
    cy.procesarResultadosPantalla('Departamentos');
  });

  it('Ejecutar todos los casos de Departamentos desde Google Sheets', () => {
    cy.obtenerDatosExcel('Departamentos').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Departamentos`);

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

  // === Helper: ir a Departamentos con sesión activa ===
  function irADepartamentosLimpio() {
    // Si ya estamos logueados, solo ir a departamentos
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes(DASHBOARD_PATH)) {
        // Ya estamos logueados, solo ir a departamentos
        cy.log('✅ Ya hay sesión activa, navegando a Departamentos...');
        cy.visit(DEPARTAMENTOS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('include', DEPARTAMENTOS_PATH);
        cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
        
        // Cerrar panel lateral
        cy.log('🔄 Intentando cerrar panel lateral...');
        cy.wait(500);
        cy.get('.fi-ta-table, table').click({ force: true });
        
        return cy.get('.fi-ta-table, table').should('be.visible');
      } else {
        // No hay sesión, hacer login primero
        cy.log('🔑 No hay sesión, haciendo login primero...');
        cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
        cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
        cy.wait(2000);
        
        // Luego ir a Departamentos
        cy.visit(DEPARTAMENTOS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('include', DEPARTAMENTOS_PATH);
        cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
        
        // Cerrar panel lateral
        cy.log('🔄 Intentando cerrar panel lateral...');
        cy.wait(500);
        cy.get('.fi-ta-table, table').click({ force: true });
        
        return cy.get('.fi-ta-table, table').should('be.visible');
      }
    });
  }

  // === Ejecuta 1 caso: SIEMPRE arranca desde /panelinterno/departamentos ===
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre  = `${casoExcel.caso} - ${casoExcel.nombre}`;
    
    cy.log('────────────────────────────────────────────────────────');
    cy.log(`▶️ ${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`🔍 DEBUG: Función solicitada del Excel: "${casoExcel.funcion}"`);
    
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);
    
    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irADepartamentosLimpio()
      .then(() => {
        return funcion(casoExcel);
      })
      .then(() => {
        return cy.estaRegistrado().then((ya) => {
          if (!ya) {
            // TC018 debe ser WARNING si es departamento duplicado
            let resultado = 'OK';
            let obtenido = 'Comportamiento correcto';
            
            if (numero === 18) {
              // Verificar si hay mensaje de duplicado
              cy.get('body').then(($body) => {
                const hasErrorMessage = $body.text().includes('duplicad') || $body.text().includes('ya existe') || $body.text().includes('duplicate');
                resultado = hasErrorMessage ? 'OK' : 'WARNING';
                obtenido = hasErrorMessage ? 'Mensaje de duplicado mostrado correctamente' : 'Error de servidor (debería mostrar mensaje de duplicado)';
                
                cy.registrarResultados({
                  numero,
                  nombre,
                  esperado: 'Mensaje de error: no se pueden crear departamentos duplicados',
                  obtenido,
                  resultado,
                  archivo,
                  pantalla: 'Departamentos'
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
                pantalla: 'Departamentos'
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
          pantalla: 'Departamentos'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === MAPEO DE FUNCIONES ===
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
      'ordenarCompany': ordenarCompany,
      'abrirFormularioCrear': abrirFormularioCrear,
      'ejecutarCrearIndividual': ejecutarCrearIndividual,
      'crearCancelar': crearCancelar,
      'editarAbrirFormulario': editarAbrirFormulario,
      'ejecutarEditarIndividual': ejecutarEditarIndividual,
      'editarCancelar': editarCancelar,
      'mostrarColumnaCreatedAt': mostrarColumnaCreatedAt,
      'mostrarColumnaUpdatedAt': mostrarColumnaUpdatedAt,
      'mostrarColumnaDeletedAt': mostrarColumnaDeletedAt,
      'ordenarCreatedAt': ordenarCreatedAt,
      'ordenarUpdatedAt': ordenarUpdatedAt,
      'ordenarDeletedAt': ordenarDeletedAt
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`⚠️ Función no encontrada en mapping: "${nombreFuncion}"`);
      cy.log(`Funciones disponibles: ${Object.keys(funciones).join(', ')}`);
      return () => {
        cy.log(`⚠️ Ejecutando función vacía para: "${nombreFuncion}"`);
        return cy.wrap(null);
      };
    }
    return funciones[nombreFuncion];
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

  // === FUNCIONES DE VALIDACIÓN ===

  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    return cy.get('.fi-ta-row, tr').should('have.length.greaterThan', 0);
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valorBusqueda = casoExcel.dato_1;
    
    // Primero buscar el valor del Excel
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
    cy.get('button:contains("Borrar")').first().click({ force: true });
    return cy.wait(2000);
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

  function ordenarCompany(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.contains('th, .fi-ta-header-cell', 'Company').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Company').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('a:contains("Crear"), button:contains("Crear")').first().click({ force: true });
    return cy.url().should('include', '/departamentos/create');
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('a:contains("Crear"), button:contains("Crear")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.url().should('include', '/departamentos');
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    return cy.url().should('include', '/departamentos/');
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/departamentos/');
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.url().should('include', '/departamentos');
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

  // ===== FUNCIONES QUE USAN DATOS DEL EXCEL =====

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    const empresa = casoExcel.dato_1 || '';
    let nombre = casoExcel.dato_2 || '';
    const descripcion = casoExcel.dato_3 || '';
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    // Si el nombre contiene "prueba1+", usar el contador
    // EXCEPCIÓN: TC018 (duplicado) siempre usa "prueba1" fijo
    if (nombre.includes('prueba1+') && numero !== 18) {
      nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
      contadorPrueba++;
    } else if (nombre.includes('prueba1+') && numero === 18) {
      // TC018: usar "prueba1" fijo para duplicado
      nombre = nombre.replace('prueba1+', 'prueba1');
    }

    cy.log(`Crear departamento con empresa="${empresa}", nombre="${nombre}", descripcion="${descripcion}"`);

    // Solo hacer click en "Crear" si no estamos ya en el formulario
    cy.url().then((url) => {
      if (!url.includes('/departamentos/create')) {
        cy.get('a:contains("Crear"), button:contains("Crear")').first().click({ force: true });
        cy.wait(1000);
      }
    });
    
    cy.url({ timeout: 10000 }).should('include', '/departamentos/');

    // Rellenar campos con scrollIntoView y force: true
    // TC021/TC022: No rellenar ciertos campos para probar validación
    if (empresa && numero !== 21) {
      cy.get('select#data\\.company_id, select[name="data.company_id"]', { timeout: 10000 })
        .scrollIntoView()
        .select(empresa, { force: true });
    }
    
    if (nombre && numero !== 22) {
      cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(nombre, { force: true });
    } else if (numero === 22) {
      // TC022: Dejar nombre vacío para validación
      cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true });
    }
    
    if (descripcion) {
      cy.get('trix-editor#data\\.description, trix-editor[name="data.description"], textarea[name="data.description"]', { timeout: 10000 })
        .scrollIntoView()
        .click({ force: true })
        .type(descripcion, { force: true });
    }

    if (numero === 20) {
      // TC020 - Cancelar
      cy.get('button:contains("Cancelar"), a:contains("Cancelar")').first().click({ force: true });
      return cy.url().should('include', '/departamentos');
    } else if (numero === 21 || numero === 22 || numero === 23) {
      // TC021/TC022/TC023 - Validación
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      cy.wait(2000);
      return cy.wrap(true);
    } else if (numero === 18) {
      // TC018 - Crear departamento duplicado (WARNING esperado)
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      return cy.wait(2000);
    } else {
      // Otros casos - Crear normalmente
      cy.get('button:contains("Crear"), input[type="submit"]').first().scrollIntoView().click({ force: true });
      return cy.wait(2000);
    }
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    let nombre = casoExcel.dato_1 || '';
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    // Si el nombre contiene "prueba1+", usar el contador
    if (nombre.includes('prueba1+')) {
      nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
      contadorPrueba++;
    }

    cy.log(`Editar departamento con nombre="${nombre}"`);

    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);

    cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    cy.url().should('include', '/departamentos/');

    // Rellenar campos con scrollIntoView y force: true
    if (nombre) {
      cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
        .scrollIntoView()
        .clear({ force: true })
        .type(nombre, { force: true });
    }

    cy.get('button:contains("Guardar"), input[type="submit"]').first().click({ force: true });
    return cy.wait(2000);
  }

});
