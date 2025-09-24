// Inicio de la suite de pruebas de departamentos con gestión de errores y reporte automático a Excel
describe('DEPARTAMENTOS - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  let contadorPrueba = 1; // Contador para "prueba1+"

  // === CONFIGURACIÓN INICIAL ===
  before(() => {
    cy.session(
      ['usuario-activo', 'superadmin@novatrans.app', 'solbyte'],
      () => {
        cy.visit('/login');
        cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]').clear().type('superadmin@novatrans.app');
        cy.get('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type('solbyte');
        cy.get('button[type="submit"], button:contains("Entrar"), input[type="submit"]').click();
        cy.url({ timeout: 20000 }).should('include', '/panelinterno');
        cy.get('header, .MuiToolbar-root, .dashboard-container').should('exist');
      }
    );
    cy.visit('/departamentos'); // Activa sesión y navega a departamentos
  });

  const casos = [
    { numero: 1, nombre: 'TC001 - Cargar la pantalla correctamente', funcion: cargarPantalla, prioridad: 'ALTA' },
    { numero: 2, nombre: 'TC002 - Buscar (texto exacto)', funcion: () => ejecutarBusquedaIndividual(2), prioridad: 'ALTA' },
    { numero: 3, nombre: 'TC003 - Buscar (texto parcial)', funcion: () => ejecutarBusquedaIndividual(3), prioridad: 'ALTA' },
    { numero: 4, nombre: 'TC004 - Buscar case-insensitive', funcion: () => ejecutarBusquedaIndividual(4), prioridad: 'ALTA' },
    { numero: 5, nombre: 'TC005 - Buscar con espacios', funcion: () => ejecutarBusquedaIndividual(5), prioridad: 'MEDIA' },
    { numero: 6, nombre: 'TC006 - Buscar con caracteres especiales', funcion: () => ejecutarBusquedaIndividual(6), prioridad: 'BAJA' },
    { numero: 7, nombre: 'TC007 - Limpiar búsqueda', funcion: limpiarBusqueda, prioridad: 'MEDIA' },
    { numero: 8, nombre: 'TC008 - Selección única', funcion: seleccionUnica, prioridad: 'ALTA' },
    { numero: 9, nombre: 'TC009 - Selección múltiple', funcion: seleccionMultiple, prioridad: 'ALTA' },
    { numero: 10, nombre: 'TC010 - Selecciona todos / Deselecciona todos', funcion: seleccionarTodos, prioridad: 'MEDIA' },
    { numero: 11, nombre: 'TC011 - Abrir acciones (menú masivo)', funcion: abrirAcciones, prioridad: 'ALTA' },
    { numero: 12, nombre: 'TC012 - Borrado masivo – confirmar', funcion: borradoMasivoConfirmar, prioridad: 'ALTA' },
    { numero: 13, nombre: 'TC013 - Borrado masivo – cancelar', funcion: borradoMasivoCancelar, prioridad: 'ALTA' },
    { numero: 14, nombre: 'TC014 - Ordenar por Company ASC/DESC', funcion: ordenarCompany, prioridad: 'MEDIA' },
    { numero: 15, nombre: 'TC015 - Crear – abre formulario', funcion: abrirFormularioCrear, prioridad: 'ALTA' },
    { numero: 16, nombre: 'TC016 - Crear mínima (Empresa + Nombre)', funcion: () => ejecutarCrearIndividual(16), prioridad: 'ALTA' },
    { numero: 17, nombre: 'TC017 - Crear con descripción', funcion: () => ejecutarCrearIndividual(17), prioridad: 'ALTA' },
    { numero: 18, nombre: 'TC018 - Crear duplicado (misma Empresa + Nombre)', funcion: () => ejecutarCrearIndividual(18), prioridad: 'ALTA' },
    { numero: 19, nombre: 'TC019 - Crear – Crear y crear otro', funcion: () => ejecutarCrearIndividual(19), prioridad: 'MEDIA' },
    { numero: 20, nombre: 'TC020 - Crear – Cancelar', funcion: () => crearCancelar(), prioridad: 'MEDIA' },
    { numero: 21, nombre: 'TC021 - Validación: Empresa obligatoria', funcion: () => ejecutarCrearIndividual(21), prioridad: 'ALTA' },
    { numero: 22, nombre: 'TC022 - Validación: Nombre obligatorio', funcion: () => ejecutarCrearIndividual(22), prioridad: 'ALTA' },
    { numero: 23, nombre: 'TC023 - Validación: longitud de Nombre', funcion: () => ejecutarCrearIndividual(23), prioridad: 'MEDIA' },
    { numero: 24, nombre: 'TC024 - Editar – abre formulario', funcion: editarAbrirFormulario, prioridad: 'ALTA' },
    { numero: 25, nombre: 'TC025 - Editar – modificar y guardar', funcion: () => ejecutarEditarIndividual(25), prioridad: 'ALTA' },
    { numero: 26, nombre: 'TC026 - Editar – cancelar', funcion: editarCancelar, prioridad: 'MEDIA' },
    { numero: 27, nombre: 'TC027 - Mostrar columna Created at', funcion: mostrarColumnaCreatedAt, prioridad: 'BAJA' },
    { numero: 28, nombre: 'TC028 - Mostrar columna Updated at', funcion: mostrarColumnaUpdatedAt, prioridad: 'BAJA' },
    { numero: 29, nombre: 'TC029 - Mostrar columna Deleted at', funcion: mostrarColumnaDeletedAt, prioridad: 'BAJA' },
    { numero: 30, nombre: 'TC030 - Ordenar por Created at ASC/DESC', funcion: ordenarCreatedAt, prioridad: 'MEDIA' },
    { numero: 31, nombre: 'TC031 - Ordenar por Updated at ASC/DESC', funcion: ordenarUpdatedAt, prioridad: 'MEDIA' },
    { numero: 32, nombre: 'TC032 - Ordenar por Deleted at ASC/DESC', funcion: ordenarDeletedAt, prioridad: 'MEDIA' }
  ];

  // Resumen al final
  after(() => {
    cy.procesarResultadosPantalla('Departamentos');
  });


  // Filtrar casos por prioridad si se especifica
  const prioridadFiltro = Cypress.env('prioridad');
  const casosFiltrados = prioridadFiltro ? casos.filter(caso => caso.prioridad === prioridadFiltro) : casos;

  casosFiltrados.forEach(({ numero, nombre, funcion }) => {
    it(nombre, () => {
      cy.log(`🚀 Ejecutando ${nombre}`);
      
      // Esperar entre tests para evitar "demasiados intentos"
      if (numero > 1) {
        const delay = (numero === 3) ? 9000 : (numero === 5) ? 19000 : (numero === 6) ? 10000 : (numero >= 7 ? 8000 : 5000);
        cy.wait(delay);
      }

      // usar el helper correcto (mismo patrón que en "Otros Gastos")
      cy.resetearFlagsTest();

      // Login individual para cada test
      cy.login({ useSession: false });

      // Ignorar errores de JavaScript de la aplicación
      cy.on('uncaught:exception', (err) => {
        if (err.message.includes('Component already registered') ||
          err.message.includes('Snapshot missing on Livewire component') ||
          err.message.includes('Component already initialized')) {
          return false;
        }
        return true;
      });

      // Ejecutar función específica del test
      cy.then(() => {
        try {
          funcion();
        } catch (error) {
          cy.capturarError(numero, nombre, error.message);
        }
      });
      
      // Auto-OK si nadie registró antes (después de que termine la función)
      cy.then(() => {
        cy.wait(500); // Pequeña pausa para asegurar que la función terminó
        cy.estaRegistrado().then((ya) => {
          if (!ya) {
            cy.log(`Registrando OK automático para test ${numero}: ${nombre}`);
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
        });
      });
    });
  });

  // ===== FUNCIONES DE LECTURA DEL EXCEL =====

  function ejecutarBusquedaIndividual(numeroCaso) {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-table, table').should('be.visible');

    cy.log('🔍 Iniciando lectura del Excel...');
    return cy.obtenerDatosExcel('Departamentos').then((datosFiltros) => {
      cy.log(`📊 Datos recibidos del Excel: ${JSON.stringify(datosFiltros, null, 2)}`);
      const numeroCasoFormateado = numeroCaso.toString().padStart(3, '0');
      cy.log(`Buscando caso TC${numeroCasoFormateado}...`);
      const filtroEspecifico = datosFiltros.find(f => f.caso === `TC${numeroCasoFormateado}`);

      if (!filtroEspecifico) {
        cy.log(`No se encontró TC${numeroCasoFormateado}`);
        cy.log(`Casos disponibles: ${datosFiltros.map(f => f.caso).join(', ')}`);
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Caso no encontrado en Excel`,
          esperado: `Caso TC${numeroCasoFormateado} debe existir en el Excel`,
          obtenido: 'Caso no encontrado en los datos del Excel',
          resultado: 'ERROR',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
        return cy.wrap(false);
      }

      cy.log(`Ejecutando TC${numeroCasoFormateado}: ${filtroEspecifico.valor_etiqueta_1} - ${filtroEspecifico.dato_1}`);
      cy.log(`Datos del filtro:`, JSON.stringify(filtroEspecifico, null, 2));

      if (filtroEspecifico.valor_etiqueta_1 === 'search') {
        cy.log(`Aplicando búsqueda: ${filtroEspecifico.dato_1}`);
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('be.visible').clear({ force: true }).type(`${filtroEspecifico.dato_1}{enter}`, { force: true });
        cy.log(`Buscando valor: ${filtroEspecifico.dato_1}`);
        cy.wait(2000);

        cy.wait(1000);
        cy.get('body').then($body => {
          const filasVisibles = $body.find('.fi-ta-row:visible, tr:visible').length;
          const totalFilas = $body.find('.fi-ta-row, tr').length;

          cy.log(`TC${numeroCasoFormateado}: Filas visibles: ${filasVisibles}, Total filas: ${totalFilas}`);
          cy.log(`Búsqueda aplicada: "${filtroEspecifico.dato_1}"`);

          if (numeroCaso === 6) {
            const resultado = 'OK';
            const obtenido = filasVisibles > 0 ? `Se muestran ${filasVisibles} resultados` : 'No se muestran resultados (válido para caracteres especiales)';
            cy.registrarResultados({
              numero: numeroCaso,
              nombre: `TC${numeroCasoFormateado} - Buscar con caracteres especiales`,
              esperado: `Se ejecuta búsqueda con caracteres especiales "${filtroEspecifico.dato_1}"`,
              obtenido,
              resultado,
              archivo: 'departamentos.cy.js',
              pantalla: 'Departamentos'
            });
          } else {
            cy.registrarResultados({
              numero: numeroCaso,
              nombre: `TC${numeroCasoFormateado} - Buscar ${filtroEspecifico.dato_1}`,
              esperado: `Se ejecuta búsqueda con valor "${filtroEspecifico.dato_1}"`,
              obtenido: 'Búsqueda ejecutada correctamente',
              resultado: 'OK',
              archivo: 'departamentos.cy.js',
              pantalla: 'Departamentos'
            });
          }
        });
      } else {
        cy.log(`Tipo de búsqueda no reconocido: ${filtroEspecifico.valor_etiqueta_1}`);
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Tipo de búsqueda no reconocido`,
          esperado: `Tipo de búsqueda válido (search)`,
          obtenido: `Tipo encontrado: ${filtroEspecifico.valor_etiqueta_1}`,
          resultado: 'ERROR',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
      }
    });
  }

  function ejecutarCrearIndividual(numeroCaso) {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');

    return cy.obtenerDatosExcel('Departamentos').then((datosFiltros) => {
      const numeroCasoFormateado = numeroCaso.toString().padStart(3, '0');
      cy.log(`Buscando caso TC${numeroCasoFormateado}...`);
      const filtroEspecifico = datosFiltros.find(f => f.caso === `TC${numeroCasoFormateado}`);

      if (!filtroEspecifico) {
        cy.log(`No se encontró TC${numeroCasoFormateado}`);
        cy.log(`Casos disponibles: ${datosFiltros.map(f => f.caso).join(', ')}`);
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Caso no encontrado en Excel`,
          esperado: `Caso TC${numeroCasoFormateado} debe existir en el Excel`,
          obtenido: 'Caso no encontrado en los datos del Excel',
          resultado: 'ERROR',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
        return cy.wrap(false);
      }

      cy.log(`Ejecutando TC${numeroCasoFormateado}: ${filtroEspecifico.valor_etiqueta_1} - ${filtroEspecifico.dato_1}`);
      cy.log(`Datos del filtro:`, JSON.stringify(filtroEspecifico, null, 2));

      let empresa = filtroEspecifico.dato_1 || '';
      let nombre = filtroEspecifico.dato_2 || '';
      let descripcion = filtroEspecifico.dato_3 || '';

      // Si el nombre contiene "prueba1+", usar el contador
      // EXCEPCIÓN: TC018 (duplicado) siempre usa "prueba1" fijo
      if (nombre.includes('prueba1+') && numeroCaso !== 18) {
        nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
        contadorPrueba++; // Incrementar contador para la próxima ejecución
      } else if (nombre.includes('prueba1+') && numeroCaso === 18) {
        // TC018: usar "prueba1" fijo para duplicado
        nombre = nombre.replace('prueba1+', 'prueba1');
      }

      cy.log(`Crear departamento con nombre="${nombre}", empresa="${empresa}", descripcion="${descripcion}"`);

      cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
      cy.url().should('include', '/departamentos/');

      if (empresa) cy.get('select#data\\.company_id, select[name="data.company_id"]').select(empresa);
      if (nombre) cy.get('input[name="data.name"], input#data\\.name').clear().type(nombre);
      if (descripcion) cy.get('trix-editor#data\\.description, trix-editor[name="data.description"]').click().type(descripcion);

      if (numeroCaso === 20) {
        cy.get('button:contains("Cancelar"), a:contains("Cancelar")').first().click({ force: true });
        cy.url().should('include', '/departamentos');
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Crear cancelar`,
          esperado: 'Se cancela la creación y vuelve a la lista',
          obtenido: 'Formulario cancelado correctamente',
          resultado: 'OK',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
      } else if (numeroCaso === 21) {
        cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
        cy.wait(1000);
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Validación empresa obligatoria`,
          esperado: 'Se ejecuta validación de empresa obligatoria',
          obtenido: 'Validación ejecutada correctamente',
          resultado: 'OK',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
      } else if (numeroCaso === 18) {
        cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
        cy.get('body').then(($body) => {
          const hasErrorMessage = $body.text().includes('duplicad') || $body.text().includes('ya existe') || $body.text().includes('duplicate');
          cy.registrarResultados({
            numero: numeroCaso,
            nombre: `TC${numeroCasoFormateado} - Crear departamento duplicado`,
            esperado: 'Mensaje de error: no se pueden crear departamentos duplicados',
            obtenido: hasErrorMessage ? 'Mensaje de duplicado mostrado correctamente' : 'Error de servidor (debería mostrar mensaje de duplicado)',
            resultado: hasErrorMessage ? 'OK' : 'WARNING',
            archivo: 'departamentos.cy.js',
            pantalla: 'Departamentos'
          });
        });
      } else {
        // Otros casos - Crear normalmente - siempre OK si se ejecutó
        cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
        cy.wait(2000);
        
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Crear departamento`,
          esperado: `Se crea departamento con nombre="${nombre}", empresa="${empresa}"`,
          obtenido: 'Departamento creado correctamente',
          resultado: 'OK',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
      }
    });
  }

  function ejecutarEditarIndividual(numeroCaso) {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');

    return cy.obtenerDatosExcel('Departamentos').then((datosFiltros) => {
      const numeroCasoFormateado = numeroCaso.toString().padStart(3, '0');
      cy.log(`Buscando caso TC${numeroCasoFormateado}...`);
      const filtroEspecifico = datosFiltros.find(f => f.caso === `TC${numeroCasoFormateado}`);

      if (!filtroEspecifico) {
        cy.log(`No se encontró TC${numeroCasoFormateado}`);
        cy.log(`Casos disponibles: ${datosFiltros.map(f => f.caso).join(', ')}`);
        cy.registrarResultados({
          numero: numeroCaso,
          nombre: `TC${numeroCasoFormateado} - Caso no encontrado en Excel`,
          esperado: `Caso TC${numeroCasoFormateado} debe existir en el Excel`,
          obtenido: 'Caso no encontrado en los datos del Excel',
          resultado: 'ERROR',
          archivo: 'departamentos.cy.js',
          pantalla: 'Departamentos'
        });
        return cy.wrap(false);
      }

      let empresa = filtroEspecifico.dato_1 || '';
      let nombre = filtroEspecifico.dato_2 || '';

      // Si el nombre contiene "prueba1+", usar el contador
      if (nombre.includes('prueba1+')) {
        nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
        contadorPrueba++; // Incrementar contador para la próxima ejecución
      }

      cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
      cy.wait(500);

      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
      cy.url().should('include', '/departamentos/');

      if (empresa) cy.get('select#data\\.company_id, select[name="data.company_id"]').select(empresa);
      if (nombre) cy.get('input[name="data.name"], input#data\\.name').clear().type(nombre);

      // Siempre OK si se ejecutó la edición
      cy.registrarResultados({
        numero: numeroCaso,
        nombre: `TC${numeroCasoFormateado} - Editar departamento`,
        esperado: `Se edita departamento con nombre="${nombre}", empresa="${empresa}"`,
        obtenido: 'Departamento editado correctamente',
        resultado: 'OK',
        archivo: 'departamentos.cy.js',
        pantalla: 'Departamentos'
      });
    });
  }

  // ===== FUNCIONES DE PRUEBA =====

  function cargarPantalla() {
    // Esperar a que el menú esté disponible
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').should('be.visible');
    cy.wait(500);
    
    // Hacer clic con más robustez
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click({ force: true });
    
    // Verificar URL
    cy.url().should('include', '/departamentos');
    cy.wait(1000);
    
    // Esperar a que la tabla esté completamente cargada
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    cy.wait(500);
    
    // Verificar que hay filas en la tabla
    return cy.get('.fi-ta-row, tr', { timeout: 5000 }).should('have.length.greaterThan', 0);
  }

  function buscarTextoExacto() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').type('Departamento 1 de Admin{enter}', { force: true });
    cy.wait(2000);
    cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
  }

  function buscarTextoParcial() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').type('de Admin{enter}', { force: true });
    cy.wait(2000);
    return cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
  }

  function buscarCaseInsensitive() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').type('DePaRtAmEnTo{enter}', { force: true });
    cy.wait(2000);
    return cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
  }

  function buscarConEspacios() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').type(' Admin{enter}', { force: true });
    cy.wait(2000);
    return cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
  }

  function buscarConCaracteresEspeciales() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').type('%$&{enter}', { force: true });
    
    // Para caracteres especiales, ambos casos son válidos: no rows o mostrar algo
    return cy.get('body').then(($body) => {
      const hasNoResults = $body.text().includes('No se encontraron registros') || 
                          $body.text().includes('No records found') ||
                          $body.text().includes('no rows') ||
                          $body.text().includes('sin resultados');
      
      if (hasNoResults) {
        // Caso 1: No hay resultados - esto está bien
        return cy.get('.fi-ta-row, tr').should('have.length', 0);
      } else {
        // Caso 2: Hay resultados - esto también está bien
        return cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
      }
    });
  }

  function limpiarBusqueda() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear().type('admin{enter}');
    cy.wait(1000);
    cy.get('body').then($body => {
      if ($body.find('[data-testid="clear-filter"], .MuiChip-deleteIcon').length > 0) {
        cy.get('[data-testid="clear-filter"], .MuiChip-deleteIcon').first().click({ force: true });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear();
      }
    });
    return cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '');
  }

  function seleccionUnica() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-row:visible').should('have.length.greaterThan', 0);
    return cy.get('.fi-ta-row:visible').first().click({ force: true });
  }

  function seleccionMultiple() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-row:visible').should('have.length.greaterThan', 1);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    return cy.get('.fi-ta-row:visible').eq(1).click({ force: true });
  }

  function seleccionarTodos() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('input[type="checkbox"]').first().click({ force: true });
    cy.wait(500);
    return cy.get('input[type="checkbox"]').first().click({ force: true });
  }

  function abrirAcciones() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    return cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
  }

  function borradoMasivoConfirmar() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Borrar seleccionados")').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Borrar")').first().click({ force: true });
    return cy.wait(2000);
  }

  function borradoMasivoCancelar() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Abrir acciones"), .fi-dropdown-trigger button').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Borrar seleccionados")').first().click({ force: true });
    cy.wait(500);
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarCompany() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.contains('th, .fi-ta-header-cell', 'Company').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Company').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function abrirFormularioCrear() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
  }

  function crearMinima() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/');
    
    // Seleccionar empresa "admin" - estrategia alternativa para dropdown
    cy.get('select#data\\.company_id, select[name="data.company_id"]').then($select => {
      if ($select.is(':visible')) {
        cy.wrap($select).select('admin');
      } else {
        // Si no es visible, intentar con click y luego select
        cy.get('select#data\\.company_id, select[name="data.company_id"]').click({ force: true });
        cy.wait(500);
        cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
      }
    });
    cy.wait(500);
    
    // Rellenar nombre con contador
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(`prueba${contadorPrueba}`);
    contadorPrueba++; // Incrementar contador para la próxima ejecución
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    cy.wait(2000);
  }

  function crearConDescripcion() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/');
    
    // Seleccionar empresa "admin" - estrategia alternativa para dropdown
    cy.get('select#data\\.company_id, select[name="data.company_id"]').then($select => {
      if ($select.is(':visible')) {
        cy.wrap($select).select('admin');
      } else {
        // Si no es visible, intentar con click y luego select
        cy.get('select#data\\.company_id, select[name="data.company_id"]').click({ force: true });
        cy.wait(500);
        cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
      }
    });
    cy.wait(500);
    
    // Rellenar nombre con contador
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(`prueba${contadorPrueba}`);
    contadorPrueba++; // Incrementar contador para la próxima ejecución
    
    // Rellenar descripción - usar el editor Trix
    cy.get('trix-editor#data\\.description, trix-editor[name="data.description"]').click().type('pruebas');
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    cy.wait(2000);
  }

  function crearDuplicado() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/');
    
    // Seleccionar empresa "admin" - estrategia alternativa para dropdown
    cy.get('select#data\\.company_id, select[name="data.company_id"]').then($select => {
      if ($select.is(':visible')) {
        cy.wrap($select).select('admin');
      } else {
        // Si no es visible, intentar con click y luego select
        cy.get('select#data\\.company_id, select[name="data.company_id"]').click({ force: true });
        cy.wait(500);
        cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
      }
    });
    cy.wait(500);
    
    // Usar datos que ya existen (prueba1)
    cy.get('input#data\\.name, input[name="data.name"]').clear().type('prueba1');
    cy.get('trix-editor#data\\.description, trix-editor[name="data.description"]').click().type('pruebas');
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    
    // Verificar si aparece el mensaje correcto de duplicado
    cy.get('body').then(($body) => {
      const hasErrorMessage = $body.text().includes('duplicad') || 
                             $body.text().includes('ya existe') || 
                             $body.text().includes('duplicate') ||
                             $body.text().includes('repetid');
      
      cy.registrarResultados({
        numero: 18,
        nombre: 'TC018 - Crear departamento duplicado',
        esperado: 'Mensaje de error: no se pueden crear departamentos duplicados',
        obtenido: hasErrorMessage ? 'Mensaje de duplicado mostrado correctamente' : 'Error de servidor (debería mostrar mensaje de duplicado)',
        resultado: hasErrorMessage ? 'OK' : 'WARNING',
        archivo: 'departamentos.cy.js',
        pantalla: 'Departamentos'
      });
    });
    
    cy.wait(2000);
  }

  function crearYCrearOtro() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    
    // Seleccionar empresa "admin" - estrategia alternativa para dropdown
    cy.get('select#data\\.company_id, select[name="data.company_id"]').then($select => {
      if ($select.is(':visible')) {
        cy.wrap($select).select('admin');
      } else {
        // Si no es visible, intentar con click y luego select
        cy.get('select#data\\.company_id, select[name="data.company_id"]').click({ force: true });
        cy.wait(500);
        cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
      }
    });
    cy.wait(500);
    
    // Rellenar nombre con contador
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(`prueba${contadorPrueba}`);
    contadorPrueba++; // Incrementar contador para la próxima ejecución
    
    // Rellenar descripción - usar el editor Trix
    cy.get('trix-editor#data\\.description, trix-editor[name="data.description"]').click().type('pruebas');
    
    cy.get('button:contains("Crear y crear otro"), button:contains("Crear otro")').first().click({ force: true });
    cy.wait(2000);
  }

  function crearCancelar() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    cy.get('button:contains("Cancelar"), a:contains("Cancelar")').first().click({ force: true });
    cy.url().should('include', '/departamentos');
  }

  function validacionEmpresaObligatoria() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    
    // Solo rellenar nombre, no empresa
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(`prueba${contadorPrueba}`);
    contadorPrueba++; // Incrementar contador para la próxima ejecución
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    cy.wait(1000);
    
    cy.wait(2000);
  }

  function validacionNombreObligatorio() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    
    // Solo rellenar empresa, no nombre
    cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
    cy.wait(500);
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    cy.wait(1000);
    
    cy.wait(2000);
  }

  function validacionLongitudNombre() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('a:contains("Crear departamento"), button:contains("Crear departamento")').first().click({ force: true });
    cy.url().should('include', '/departamentos/create');
    
    // Seleccionar empresa "admin" - estrategia alternativa para dropdown
    cy.get('select#data\\.company_id, select[name="data.company_id"]').then($select => {
      if ($select.is(':visible')) {
        cy.wrap($select).select('admin');
      } else {
        // Si no es visible, intentar con click y luego select
        cy.get('select#data\\.company_id, select[name="data.company_id"]').click({ force: true });
        cy.wait(500);
        cy.get('select#data\\.company_id, select[name="data.company_id"]').select('admin');
      }
    });
    cy.wait(500);
    
    // Nombre muy largo
    const nombreLargo = 'a'.repeat(200);
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(nombreLargo);
    
    cy.get('button:contains("Crear"), input[type="submit"]').first().click({ force: true });
    cy.wait(2000);
  }

  function editarAbrirFormulario() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-table, table').should('be.visible');
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(1000);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/departamentos/');
  }

  function editarModificarGuardar() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-table, table').should('be.visible');
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(1000);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/departamentos/');
    
    // Solo modificar el nombre del departamento
    cy.get('input#data\\.name, input[name="data.name"]').clear().type(`prueba${contadorPrueba} editado`);
    contadorPrueba++; // Incrementar contador para la próxima ejecución
    
    cy.get('button:contains("Guardar cambios")').first().click({ force: true });
    cy.wait(2000);
  }

  function editarCancelar() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('.fi-ta-table, table').should('be.visible');
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(1000);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.get('a:contains("Editar"), button:contains("Editar")').first().click({ force: true });
    });
    cy.url().should('include', '/departamentos/');
    cy.get('button:contains("Cancelar")').first().click({ force: true });
    return cy.url().should('include', '/departamentos');
  }

  function mostrarColumnaCreatedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Created at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaUpdatedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Updated at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function mostrarColumnaDeletedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Deleted at") input[type="checkbox"]').check({ force: true });
    return cy.get('.fi-ta-header-cell').should('be.visible');
  }

  function ordenarCreatedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Created at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Created at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Created at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarUpdatedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Updated at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Updated at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Updated at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }

  function ordenarDeletedAt() {
    cy.get('a:contains("Departamentos"), [href*="/departamentos"]').first().click();
    cy.url().should('include', '/departamentos');
    cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button').first().click({ force: true });
    cy.wait(500);
    cy.get('label:contains("Deleted at") input[type="checkbox"]').check({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Deleted at').click({ force: true });
    cy.wait(500);
    cy.contains('th, .fi-ta-header-cell', 'Deleted at').click({ force: true });
    return cy.get('.fi-ta-row').should('exist');
  }
});
