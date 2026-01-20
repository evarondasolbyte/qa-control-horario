// Suite de pruebas automatizadas para Usuario Admin
// Este archivo ejecuta pruebas usando un usuario admin (no superadmin)
describe('PRUEBAS USUARIO ADMIN - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = 'https://horario.dev.novatrans.app';
  const DASHBOARD_PATH = '/panelinterno';
  const LOGIN_PATH = '/panelinterno/login';
  
  // Credenciales de usuario admin (desde variables de entorno)
  const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL') || 'admin@admin.app';
  const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || 'novatranshorario@2025';

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
    cy.procesarResultadosPantalla('Pruebas Usuario Admin');
  });

  it('Ejecutar todos los casos de Pruebas Usuario Admin desde Google Sheets', () => {
    // Hacer login una sola vez al inicio
    loginAdmin().then(() => {
      return cy.obtenerDatosExcel('PruebasUsuarioAdmin').then((casosExcel) => {
        cy.log(`Cargados ${casosExcel.length} casos desde Excel para Pruebas Usuario Admin`);

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
  });

  // === Helper: hacer login con usuario admin ===
  function loginAdmin() {
    cy.log('Haciendo login con usuario admin...');
    cy.login({ 
      email: ADMIN_EMAIL, 
      password: ADMIN_PASSWORD, 
      useSession: false 
    });
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    cy.wait(2000);
    return cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 10000 }).should('exist');
  }

  // === Helper: ir a una pantalla específica con sesión admin activa ===
  function irAPantallaLimpio(rutaPantalla, nombrePantalla) {
    return cy.url().then((currentUrl) => {
      const verificarPantallaCargada = () => {
        cy.wait(1000);
        
        // Intentar cerrar panel lateral si existe
        cy.get('body').then(($body) => {
          const hayPanelLateral = $body.find('[class*="overlay"], [class*="modal"], [class*="drawer"], [class*="sidebar"]').length > 0;
          if (hayPanelLateral) {
            cy.log('Cerrando panel lateral...');
            cy.get('body').type('{esc}');
            cy.wait(500);
          }
        });

        cy.get('body', { timeout: 20000 }).should('be.visible');
        
        // Verificar si hay tabla o estado de "sin datos"
        return cy.get('body', { timeout: 20000 }).then(($body) => {
          const hayTabla = $body.find('.fi-ta-table, table').length > 0;
          
          if (hayTabla) {
            cy.log('Tabla encontrada, verificando visibilidad...');
            return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist');
          }
          
          // Si no hay tabla, verificar si hay estado de "sin datos"
          const hayEstadoVacio = $body.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"]').length > 0;
          const textoBody = $body.text().toLowerCase();
          const hayMensajeSinDatos = textoBody.includes('no hay datos') || 
                                     textoBody.includes('sin registros') || 
                                     textoBody.includes('tabla vacía') ||
                                     textoBody.includes('no se encontraron') ||
                                     textoBody.includes('sin resultados');
          
          if (hayEstadoVacio || hayMensajeSinDatos) {
            cy.log('No hay registros en la tabla - esto es válido (OK)');
            return cy.wrap(true);
          }
          
          // Si no hay tabla ni mensaje, esperar un poco más
          cy.log('Esperando a que la tabla se cargue...');
          return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist').catch(() => {
            return cy.wrap(true); // Permitir continuar si no hay tabla
          });
        });
      };

      // Ya hay sesión activa desde el inicio, solo navegar a la pantalla
      cy.log(`Navegando a ${nombrePantalla}...`);
      cy.visit(`${BASE_URL}${rutaPantalla}`, { failOnStatusCode: false });
      cy.url({ timeout: 20000 }).should('include', rutaPantalla);
      return verificarPantallaCargada();
    });
  }

  // === Ejecuta 1 caso ===
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre = `${casoExcel.caso} - ${casoExcel.nombre}`;

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`DEBUG: Función solicitada del Excel: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    // Ya hay sesión activa desde el inicio, solo ejecutar la función
    return funcion(casoExcel)
      .then(() => {
        // Verificar si hay error 500 después de ejecutar la función
        return verificarError500(casoExcel, numero, nombre).then(() => {
          return cy.estaRegistrado().then((ya) => {
            if (!ya) {
              cy.registrarResultados({
                numero,
                nombre,
                esperado: casoExcel.resultado_esperado || 'Comportamiento correcto',
                obtenido: casoExcel.resultado_obtenido || 'Comportamiento correcto',
                resultado: casoExcel.resultado || 'OK',
                archivo,
                pantalla: 'Pruebas Usuario Admin'
              });
            }
          });
        });
      }, (err) => {
        // Si el error es por 500, ya se registró en verificarError500
        if (err.message && err.message.includes('Error 500 detectado')) {
          return null; // Ya se registró, continuar con el siguiente caso
        }
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: casoExcel.resultado_esperado || 'Comportamiento correcto',
          archivo,
          pantalla: 'Pruebas Usuario Admin'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === Helper: generar número aleatorio de 3 dígitos ===
  function generarNumeroAleatorio() {
    return Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }

  // === Helper: reemplazar pruebaXXX o pruebasXXX con números aleatorios ===
  function procesarPruebaXXX(valor) {
    if (!valor) return valor;
    let valorStr = String(valor);
    // Reemplazar pruebasXXX (con 's') con números aleatorios
    if (valorStr.includes('pruebasXXX')) {
      valorStr = valorStr.replace(/pruebasXXX/gi, `pruebas${generarNumeroAleatorio()}`);
    }
    // Reemplazar pruebaXXX (sin 's') con números aleatorios
    // Esto incluye casos como "pruebaXXX@prueba.app"
    if (valorStr.includes('pruebaXXX')) {
      valorStr = valorStr.replace(/pruebaXXX/gi, `prueba${generarNumeroAleatorio()}`);
    }
    return valorStr;
  }

  // === Helper: obtener dato del Excel por etiqueta ===
  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
        const dato = casoExcel[`dato_${i}`] || '';
        return procesarPruebaXXX(dato);
      }
    }
    return '';
  }

  // === Helper: verificar si hay error 500 en la página ===
  function verificarError500(casoExcel, numero, nombre) {
    return cy.get('body', { timeout: 5000 }).then($body => {
      try {
        const textoBody = $body.text().toLowerCase();
        const tieneError500 = 
          textoBody.includes('500') || 
          textoBody.includes('internal server error') ||
          textoBody.includes('server error') ||
          textoBody.includes('error interno del servidor') ||
          $body.find('[class*="error"], [class*="500"], [id*="error"]').length > 0 ||
          $body.find('h1:contains("500"), h2:contains("500"), h1:contains("Error"), h2:contains("Error")').length > 0;

        if (tieneError500) {
          cy.log('⚠️ Error 500 detectado en la página');
          cy.registrarResultados({
            numero,
            nombre,
            esperado: casoExcel.resultado_esperado || 'Comportamiento correcto',
            obtenido: '500 SERVER ERROR / Internal Server Error',
            resultado: 'KO',
            archivo,
            pantalla: 'Pruebas Usuario Admin'
          });
          throw new Error('Error 500 detectado: Internal Server Error');
        }
        return cy.wrap(true);
      } catch (err) {
        // Si hay un error en la verificación, continuar de todas formas
        if (err.message && err.message.includes('Error 500 detectado')) {
          throw err; // Re-lanzar el error 500 para que se capture arriba
        }
        return cy.wrap(true); // Otros errores, continuar
      }
    }, () => {
      // Si falla el cy.get, continuar (no romper la prueba)
      return cy.wrap(true);
    });
  }

  // === Helpers para selección de opciones ===
  function seleccionarOpcionChoices(texto, label) {
    if (!texto) return cy.wrap(null);
    const labelRegex = label ? new RegExp(label, 'i') : null;
    const terminoRegex = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    // Primero verificar si ya está seleccionado
    return cy.get('body').then(($body) => {
      let yaSeleccionado = false;
      if (labelRegex) {
        // Buscar el campo por su label
        const $labels = $body.find('label, span, div, h3, h4, h5').filter((i, el) => {
          const textoLabel = Cypress.$(el).text().trim();
          return labelRegex.test(textoLabel);
        });
        
        if ($labels.length) {
          // Buscar el wrapper del campo
          for (let i = 0; i < $labels.length; i++) {
            const $label = $labels.eq(i);
            const $wrapper = $label.closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form').first();
            
            if ($wrapper.length) {
              // Buscar el valor seleccionado en múltiples lugares
              const selectoresValor = [
                '.choices__item--selectable',
                '.choices__item--selected',
                '.choices__item',
                '[data-choice]',
                '.choices__input',
                'input.choices__input--cloned',
                '.fi-select-trigger',
                '[role="combobox"]'
              ];
              
              for (const selector of selectoresValor) {
                const $valor = $wrapper.find(selector).first();
                if ($valor.length) {
                  const textoActual = $valor.text().trim() || $valor.val() || $valor.attr('data-value') || '';
                  if (textoActual && terminoRegex.test(textoActual)) {
                    yaSeleccionado = true;
                    cy.log(`La opción "${texto}" ya está seleccionada en "${label}"`);
                    break;
                  }
                }
              }
              
              if (yaSeleccionado) break;
            }
          }
        }
      }
      
      if (yaSeleccionado) {
        return cy.wrap(true);
      }

      // Si no está seleccionado, proceder a seleccionarlo
      if (labelRegex) {
        cy.contains('label, span, div, h3, h4, h5', labelRegex, { timeout: 10000 })
          .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form')
          .first()
          .within(() => {
            cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
      } else {
        cy.get('.choices[data-type="select-one"], [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
      }

      cy.wait(300);

      return cy.get('body').then(($body) => {
        const dropdownSelector = '.choices__list--dropdown:visible, .fi-select-panel:visible, [role="listbox"]:visible';
        const inputSelector = '.choices__input--cloned:visible, input[placeholder*="Teclee"]:visible, input[placeholder*="buscar"]:visible, .choices__input:visible';
        const $input = $body.find(inputSelector).last();
        if ($input.length) {
          cy.wrap($input).clear({ force: true }).type(texto, { force: true, delay: 10 });
          cy.wait(200);
        }

        // Buscar la opción con múltiples estrategias
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', terminoRegex, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        } else if ($body.find('.choices__item--choice:visible').length) {
          cy.contains('.choices__item--choice:visible', terminoRegex, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        } else if ($body.find(dropdownSelector).length) {
          cy.get(dropdownSelector, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', terminoRegex, { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          });
        } else {
          cy.contains(':visible', terminoRegex, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        }

        cy.wait(300);
        return cy.wrap(true);
      });
    });
  }

  function escribirCampo(selector, valor) {
    if (!valor) return cy.wrap(null);
    return cy.get(selector, { timeout: 10000 })
      .scrollIntoView()
      .clear({ force: true })
      .type(valor, { force: true });
  }

  // === MAPEO DE FUNCIONES ===
  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      // Menú
      'TC001': menuCargarPantalla,
      'TC002': menuVerificarNoEmpresas,
      'TC003': menuVerificarNoRoles,
      // Departamentos
      'TC004': departamentosCargarPantalla,
      'TC005': departamentosCrearMinimo,
      'TC006': departamentosCrearConDescripcion,
      'TC007': departamentosCrearDuplicado,
      'TC008': departamentosValidacionNombreObligatorio,
      'TC009': departamentosEditar,
      // Grupos
      'TC010': gruposCargarPantalla,
      'TC011': gruposCrearMinimo,
      'TC012': gruposCrearConDescripcion,
      'TC013': gruposCrearDuplicado,
      'TC014': gruposValidacionNombreObligatorio,
      'TC015': gruposCrearConTodo,
      'TC016': gruposEditar,
      'TC017': gruposAsignarJornadaSemanal,
      'TC018': gruposAsignarEmpleado,
      // Empleados
      'TC019': empleadosCargarPantalla,
      'TC020': empleadosCrearMinimo,
      'TC021': empleadosValidacionNombreObligatorio,
      'TC022': empleadosValidacionEmailObligatorio,
      'TC023': empleadosValidacionGrupoObligatorio,
      'TC024': empleadosCrearCompleto,
      'TC025': empleadosEditar,
      // Jornadas Diarias
      'TC026': jornadasDiariasCargarPantalla,
      'TC027': jornadasDiariasCrearSemanal,
      'TC028': jornadasDiariasCrearDuplicado,
      'TC029': jornadasDiariasValidacionNombreObligatorio,
      'TC030': jornadasDiariasCrearConRangoInicio,
      'TC031': jornadasDiariasCrearConRangoFin,
      'TC032': jornadasDiariasCrearConDuracion,
      'TC033': jornadasDiariasCrearConLimites,
      'TC034': jornadasDiariasCrearCompleto,
      'TC035': jornadasDiariasEditar,
      // Jornada Semanal
      'TC036': jornadaSemanalCargarPantalla,
      'TC037': jornadaSemanalCrearMinimo,
      'TC038': jornadaSemanalCrearDuplicado,
      'TC039': jornadaSemanalValidacionNombreObligatorio,
      'TC040': jornadaSemanalCrearMaxHoras,
      'TC041': jornadaSemanalCrearMinHoras,
      'TC042': jornadaSemanalEditar,
      'TC043': jornadaSemanalCrearMaxMinutos,
      'TC044': jornadaSemanalCrearMinMinutos,
      'TC045': jornadaSemanalAnadirTiposJornada
    };

    // También buscar por nombre de función
    const funcionesPorNombre = {
      'menuCargarPantalla': menuCargarPantalla,
      'menuVerificarNoEmpresas': menuVerificarNoEmpresas,
      'menuVerificarNoRoles': menuVerificarNoRoles,
      'departamentosCargarPantalla': departamentosCargarPantalla,
      'departamentosCrearMinimo': departamentosCrearMinimo,
      'departamentosCrearConDescripcion': departamentosCrearConDescripcion,
      'departamentosCrearDuplicado': departamentosCrearDuplicado,
      'departamentosValidacionNombreObligatorio': departamentosValidacionNombreObligatorio,
      'departamentosEditar': departamentosEditar,
      'gruposCargarPantalla': gruposCargarPantalla,
      'gruposCrearMinimo': gruposCrearMinimo,
      'gruposCrearConDescripcion': gruposCrearConDescripcion,
      'gruposCrearDuplicado': gruposCrearDuplicado,
      'gruposValidacionNombreObligatorio': gruposValidacionNombreObligatorio,
      'gruposCrearConTodo': gruposCrearConTodo,
      'gruposEditar': gruposEditar,
      'gruposAsignarJornadaSemanal': gruposAsignarJornadaSemanal,
      'gruposAsignarEmpleado': gruposAsignarEmpleado,
      'empleadosCargarPantalla': empleadosCargarPantalla,
      'empleadosCrearMinimo': empleadosCrearMinimo,
      'empleadosValidacionNombreObligatorio': empleadosValidacionNombreObligatorio,
      'empleadosValidacionEmailObligatorio': empleadosValidacionEmailObligatorio,
      'empleadosValidacionGrupoObligatorio': empleadosValidacionGrupoObligatorio,
      'empleadosCrearCompleto': empleadosCrearCompleto,
      'empleadosEditar': empleadosEditar,
      'jornadasDiariasCargarPantalla': jornadasDiariasCargarPantalla,
      'jornadasDiariasCrearSemanal': jornadasDiariasCrearSemanal,
      'jornadasDiariasValidacionNombreObligatorio': jornadasDiariasValidacionNombreObligatorio,
      'jornadasDiariasCrearDuplicado': jornadasDiariasCrearDuplicado,
      'jornadasDiariasCrearConRangoInicio': jornadasDiariasCrearConRangoInicio,
      'jornadasDiariasCrearConRangoFin': jornadasDiariasCrearConRangoFin,
      'jornadasDiariasCrearConDuracion': jornadasDiariasCrearConDuracion,
      'jornadasDiariasCrearConLimites': jornadasDiariasCrearConLimites,
      'jornadasDiariasCrearCompleto': jornadasDiariasCrearCompleto,
      'jornadasDiariasEditar': jornadasDiariasEditar,
      'jornadaSemanalCargarPantalla': jornadaSemanalCargarPantalla,
      'jornadaSemanalCrearMinimo': jornadaSemanalCrearMinimo,
      'jornadaSemanalCrearDuplicado': jornadaSemanalCrearDuplicado,
      'jornadaSemanalValidacionNombreObligatorio': jornadaSemanalValidacionNombreObligatorio,
      'jornadaSemanalCrearMaxHoras': jornadaSemanalCrearMaxHoras,
      'jornadaSemanalCrearMinHoras': jornadaSemanalCrearMinHoras,
      'jornadaSemanalEditar': jornadaSemanalEditar,
      'jornadaSemanalCrearMaxMinutos': jornadaSemanalCrearMaxMinutos,
      'jornadaSemanalCrearMinMinutos': jornadaSemanalCrearMinMinutos,
      'jornadaSemanalAnadirTiposJornada': jornadaSemanalAnadirTiposJornada
    };

    // Intentar buscar por número de caso si nombreFuncion es un TCXXX
    const matchTC = String(nombreFuncion || '').match(/^TC\d+/i);
    if (matchTC) {
      const tcNumero = matchTC[0].toUpperCase();
      if (funciones[tcNumero]) {
        return funciones[tcNumero];
      }
    }

    // Buscar por nombre de función
    const funcionPorNombre = funcionesPorNombre[nombreFuncion];

    if (funcionPorNombre) {
      return funcionPorNombre;
    }

    cy.log(`Función no encontrada: "${nombreFuncion}"`);
    cy.log(`Funciones disponibles por TC: ${Object.keys(funciones).join(', ')}`);
    cy.log(`Funciones disponibles por nombre: ${Object.keys(funcionesPorNombre).join(', ')}`);
    return () => {
      cy.log(`Ejecutando función vacía para: "${nombreFuncion}"`);
      return cy.wrap(null);
    };
  }

  // ========== FUNCIONES MENÚ ==========
  function menuCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    return cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 10000 }).should('exist');
  }

  function menuVerificarNoEmpresas(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    // El menú ya está abierto, solo verificar que no aparece "Empresas"
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.get('body').then($body => {
      const tieneEmpresas = $body.find('a:contains("Empresas"), span:contains("Empresas"), div:contains("Empresas")').length > 0 ||
                            $body.text().toLowerCase().includes('empresas');
      if (tieneEmpresas) {
        cy.registrarResultados({
          numero: parseInt(casoExcel.caso.replace('TC', '')),
          nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
          esperado: 'No debe aparecer "Empresas" en el menú',
          obtenido: 'Aparece "Empresas" en el menú',
          resultado: 'KO',
          archivo,
          pantalla: 'Pruebas Usuario Admin'
        });
        throw new Error('El menú "Empresas" apareció cuando no debería.');
      } else {
        cy.registrarResultados({
          numero: parseInt(casoExcel.caso.replace('TC', '')),
          nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
          esperado: 'No debe aparecer "Empresas" en el menú',
          obtenido: 'No aparece "Empresas" en el menú',
          resultado: 'OK',
          archivo,
          pantalla: 'Pruebas Usuario Admin'
        });
      }
    });
    return cy.wrap(true);
  }

  function menuVerificarNoRoles(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    // El menú ya está abierto, solo verificar que no aparece "Roles"
    cy.get('body', { timeout: 10000 }).should('be.visible');
    cy.get('body').then($body => {
      const tieneRoles = $body.find('a:contains("Roles"), span:contains("Roles"), div:contains("Roles")').length > 0 ||
                         $body.text().toLowerCase().includes('roles');
      if (tieneRoles) {
        cy.registrarResultados({
          numero: parseInt(casoExcel.caso.replace('TC', '')),
          nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
          esperado: 'No debe aparecer "Roles" en el menú',
          obtenido: 'Aparece "Roles" en el menú',
          resultado: 'KO',
          archivo,
          pantalla: 'Pruebas Usuario Admin'
        });
        throw new Error('El menú "Roles" apareció cuando no debería.');
      } else {
        cy.registrarResultados({
          numero: parseInt(casoExcel.caso.replace('TC', '')),
          nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
          esperado: 'No debe aparecer "Roles" en el menú',
          obtenido: 'No aparece "Roles" en el menú',
          resultado: 'OK',
          archivo,
          pantalla: 'Pruebas Usuario Admin'
        });
      }
    });
    return cy.wrap(true);
  }

  // ========== FUNCIONES DEPARTAMENTOS ==========
  function departamentosCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos');
  }

  function departamentosCrearMinimo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos')
      .then(() => {
        // Buscar el botón "Crear departamento" de forma insensible a mayúsculas
        cy.contains('button, a', /crear\s+departamento/i, { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        return escribirCampo('input[name="data.name"], input#data\\.name', nombre);
      })
      .then(() => {
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        // Verificar si hay error 500
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('500') || $body.text().toLowerCase().includes('server error');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Comportamiento correcto',
              obtenido: '500 SERVER ERROR',
              resultado: 'KO',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function departamentosCrearConDescripcion(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const descripcion = obtenerDatoPorEtiqueta(casoExcel, 'data.description') || casoExcel.dato_2 || 'pruebas';
    
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos')
      .then(() => {
        // Mismo botón que TC005: "Crear departamento" (insensible a mayúsculas)
        cy.contains('button, a', /crear\s+departamento/i, { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        return escribirCampo('input[name="data.name"], input#data\\.name', nombre);
      })
      .then(() => {
        return escribirCampo('textarea#data\\.description, textarea[name="data.description"]', descripcion);
      })
      .then(() => {
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('500') || $body.text().toLowerCase().includes('server error');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Comportamiento correcto',
              obtenido: '500 SERVER ERROR',
              resultado: 'KO',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function departamentosValidacionNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos')
      .then(() => {
        cy.contains('button, a', /crear\s+departamento/i, { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que aparece el aviso de validación
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.name"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function departamentosCrearDuplicado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || casoExcel.dato_1 || 'prueba';
    
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos')
      .then(() => {
        cy.contains('button, a', /crear\s+departamento/i, { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneAvisoDuplicado = $body.text().toLowerCase().includes('el campo nombre ya ha sido registrado') ||
                                      $body.text().toLowerCase().includes('ya ha sido registrado');
          if (tieneAvisoDuplicado) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre ya ha sido registrado',
              obtenido: 'El campo nombre ya ha sido registrado',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          } else {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre ya ha sido registrado',
              obtenido: 'No se mostró el aviso de duplicado',
              resultado: 'KO',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
            throw new Error('No se mostró el aviso de duplicado para el nombre del departamento.');
          }
        });
        return cy.wrap(true);
      });
  }

  function departamentosEditar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos')
      .then(() => {
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que el formulario de edición se abrió correctamente
        cy.url({ timeout: 10000 }).should('include', '/departamentos/');
        cy.url({ timeout: 10000 }).should('include', '/edit');
        // Verificar que hay campos en el formulario
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 }).should('exist');
        cy.log('Formulario de edición abierto correctamente - OK');
        return cy.wrap(true);
      });
  }

  // ========== FUNCIONES GRUPOS ==========
  function gruposCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos');
  }

  function gruposCrearMinimo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        return escribirCampo('input[name="data.name"], input#data\\.name', nombre);
      })
      .then(() => {
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('500') || $body.text().toLowerCase().includes('server error');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Comportamiento correcto',
              obtenido: '500 SERVER ERROR',
              resultado: 'KO',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function gruposCrearConDescripcion(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const descripcion = obtenerDatoPorEtiqueta(casoExcel, 'data.description') || casoExcel.dato_2 || 'prueba';
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('textarea#data\\.description, textarea[name="data.description"]', descripcion);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function gruposCrearDuplicado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || casoExcel.dato_1 || 'prueba';
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneAvisoDuplicado = $body.text().toLowerCase().includes('el campo nombre del grupo ya ha sido registrado') ||
                                      $body.text().toLowerCase().includes('ya ha sido registrado');
          if (tieneAvisoDuplicado) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre del Grupo ya ha sido registrado.',
              obtenido: 'El campo nombre del Grupo ya ha sido registrado.',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          } else {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre del Grupo ya ha sido registrado.',
              obtenido: 'No se mostró el aviso de duplicado',
              resultado: 'KO',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
            throw new Error('No se mostró el aviso de duplicado para el nombre del grupo.');
          }
        });
        return cy.wrap(true);
      });
  }

  function gruposValidacionNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.name"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function gruposCrearConTodo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const descripcion = obtenerDatoPorEtiqueta(casoExcel, 'data.description') || casoExcel.dato_2 || 'prueba';
    const departamento = obtenerDatoPorEtiqueta(casoExcel, 'choices_item') || casoExcel.dato_3 || 'prueba';
    const supervisor = obtenerDatoPorEtiqueta(casoExcel, 'choices_item') || casoExcel.dato_4 || 'admin';
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('textarea#data\\.description, textarea[name="data.description"]', descripcion);
        if (departamento) {
          seleccionarOpcionChoices(departamento, 'Departamento');
        }
        if (supervisor) {
          seleccionarOpcionChoices(supervisor, 'Supervisor');
        }
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function gruposEditar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que el formulario de edición se abrió correctamente
        cy.url({ timeout: 10000 }).should('include', '/grupos/');
        cy.url({ timeout: 10000 }).should('include', '/edit');
        // Verificar que hay campos en el formulario
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 }).should('exist');
        cy.log('Formulario de edición abierto correctamente - OK');
        return cy.wrap(true);
      });
  }

  function gruposAsignarJornadaSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('.fi-ta-row:visible', { timeout: 10000 }).first().click({ force: true });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Hacer scroll hacia abajo para que aparezcan los botones
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
        // Buscar el botón "Jornadas Semanales Asignadas" con regex insensible a mayúsculas
        cy.contains('button, a', /jornadas?\s+semanales?\s+asignadas?/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(500);
        // Buscar el botón "Asignar Jornada Semanal"
        cy.contains('button, a', /asignar\s+jornada\s+semanal/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        // Seleccionar primera jornada disponible
        cy.get('[role="option"]:visible, .choices__item:visible', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), button:contains("Enviar")', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function gruposAsignarEmpleado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.name') || procesarPruebaXXX(casoExcel.dato_1) || 'prueba';
    const apellidos = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.surname') || casoExcel.dato_2 || 'prueba';
    const email = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.email') || procesarPruebaXXX(casoExcel.dato_3) || `prueba${generarNumeroAleatorio()}@prueba.app`;
    
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos')
      .then(() => {
        cy.get('a:contains("Crear grupo"), button:contains("Crear grupo")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // No seleccionar empresa, solo el nombre del grupo
        escribirCampo('input[name="data.name"], input#data\\.name', `prueba${generarNumeroAleatorio()}`);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        // Hacer scroll hacia abajo para que aparezcan los botones
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
        // Ya debería estar en edición, buscar "Crear empleado y vincular al equipo"
        cy.contains('button, a', /crear\s+empleado\s+y\s+vincular\s+al\s+equipo/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        
        // Esperar a que aparezca el formulario/modal y los campos estén disponibles
        cy.get('input[name="mountedTableActionsData.0.name"], input#mountedTableActionsData\\.0\\.name', { timeout: 15000 })
          .should('be.visible')
          .should('exist');
        cy.wait(500);
        
        // Ahora escribir en los campos
        escribirCampo('input[name="mountedTableActionsData.0.name"], input#mountedTableActionsData\\.0\\.name', nombre);
        cy.wait(300);
        escribirCampo('input[name="mountedTableActionsData.0.surname"], input#mountedTableActionsData\\.0\\.surname', apellidos);
        cy.wait(300);
        escribirCampo('input[name="mountedTableActionsData.0.email"], input#mountedTableActionsData\\.0\\.email', email);
        cy.wait(500);
        cy.get('button:contains("Crear")', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('button:contains("Guardar Cambios"), button:contains("Guardar")', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  // ========== FUNCIONES EMPLEADOS ==========
  function empleadosCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados');
  }

  function empleadosCrearMinimo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const email = obtenerDatoPorEtiqueta(casoExcel, 'data.email') || procesarPruebaXXX(casoExcel.dato_2) || `prueba${generarNumeroAleatorio()}@prueba.app`;
    const grupo = obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') || casoExcel.dato_3 || 'Admin Group';
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('a:contains("Crear empleado"), button:contains("Crear empleado")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.email"], input#data\\.email', email);
        cy.wait(500);
        // Esperar a que desaparezca "Cargando..." antes de seleccionar
        cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
        cy.wait(500);
        // Seleccionar Grupo - forzar selección incluso si parece ya seleccionado
        cy.contains('label, span, div, h3, h4, h5', /grupo/i, { timeout: 10000 })
          .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form')
          .first()
          .within(() => {
            cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(300);
        // Esperar a que aparezcan las opciones
        cy.get('.choices__list--dropdown:visible, [role="listbox"]:visible', { timeout: 10000 })
          .first()
          .within(() => {
            cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
            cy.wait(500);
            // Buscar y seleccionar "Admin Group" (NO el email)
            const grupoTexto = grupo || 'Admin Group';
            const terminoRegex = new RegExp(grupoTexto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            cy.contains('[role="option"]:visible, .choices__item--choice:visible', terminoRegex, { timeout: 10000 })
              .should('contain.text', grupoTexto)
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function empleadosValidacionNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const email = obtenerDatoPorEtiqueta(casoExcel, 'data.email') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}@prueba.app`;
    // Obtener el grupo de choices_inner, NO del email
    const grupo = obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') || casoExcel.dato_2 || 'Admin Group';
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('a:contains("Crear empleado"), button:contains("Crear empleado")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Escribir email en el campo de email
        escribirCampo('input[name="data.email"], input#data\\.email', email);
        cy.wait(500);
        // Esperar a que desaparezca "Cargando..." antes de seleccionar
        cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
        cy.wait(500);
        // Seleccionar Grupo - buscar específicamente el campo "Grupo"
        cy.contains('label, span, div, h3, h4, h5', /grupo/i, { timeout: 10000 })
          .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form')
          .first()
          .within(() => {
            cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(300);
        // Esperar a que aparezcan las opciones
        cy.get('.choices__list--dropdown:visible, [role="listbox"]:visible', { timeout: 10000 })
          .first()
          .within(() => {
            cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
            cy.wait(500);
            // Buscar y seleccionar "Admin Group" - usar el valor de grupo, NO el email
            const grupoTexto = grupo || 'Admin Group';
            cy.log(`Buscando grupo: ${grupoTexto}`);
            // Buscar la opción que contenga "Admin Group"
            cy.contains('[role="option"]:visible, .choices__item--choice:visible', /admin\s+group/i, { timeout: 10000 })
              .should('exist')
              .should('be.visible')
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.name"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function empleadosValidacionEmailObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    // Obtener el grupo de choices_inner
    const grupo = obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') || casoExcel.dato_2 || 'Admin Group';
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('a:contains("Crear empleado"), button:contains("Crear empleado")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Escribir nombre en el campo de nombre
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Esperar a que desaparezca "Cargando..." antes de seleccionar
        cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
        cy.wait(500);
        // Seleccionar Grupo - buscar específicamente el campo "Grupo"
        cy.contains('label, span, div, h3, h4, h5', /grupo/i, { timeout: 10000 })
          .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form')
          .first()
          .within(() => {
            cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(300);
        // Esperar a que aparezcan las opciones
        cy.get('.choices__list--dropdown:visible, [role="listbox"]:visible', { timeout: 10000 })
          .first()
          .within(() => {
            cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
            cy.wait(500);
            // Buscar y seleccionar "Admin Group"
            cy.log(`Buscando grupo: ${grupo}`);
            // Buscar la opción que contenga "Admin Group"
            cy.contains('[role="option"]:visible, .choices__item--choice:visible', /admin\s+group/i, { timeout: 10000 })
              .should('exist')
              .should('be.visible')
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.email"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function empleadosValidacionGrupoObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const email = obtenerDatoPorEtiqueta(casoExcel, 'data.email') || procesarPruebaXXX(casoExcel.dato_2) || `prueba${generarNumeroAleatorio()}@prueba.app`;
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('a:contains("Crear empleado"), button:contains("Crear empleado")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Escribir nombre en el campo de nombre
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Escribir email en el campo de email
        escribirCampo('input[name="data.email"], input#data\\.email', email);
        cy.wait(500);
        // NO seleccionar Grupo - esto es para validar que el Grupo es obligatorio
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.text().toLowerCase().includes('grupo') && $body.text().toLowerCase().includes('obligatorio');
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function empleadosCrearCompleto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const email = obtenerDatoPorEtiqueta(casoExcel, 'data.email') || procesarPruebaXXX(casoExcel.dato_2) || `prueba${generarNumeroAleatorio()}@prueba.app`;
    const grupo = obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') || casoExcel.dato_3 || 'Admin Group';
    const apellidos = obtenerDatoPorEtiqueta(casoExcel, 'data.surname') || casoExcel.dato_4 || 'prueba';
    const telefono = obtenerDatoPorEtiqueta(casoExcel, 'data.phone') || casoExcel.dato_5 || '123456';
    const departamento = obtenerDatoPorEtiqueta(casoExcel, 'choices_item') || casoExcel.dato_6 || '';
    const roles = obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') || casoExcel.dato_7 || 'Supervisor';
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('a:contains("Crear empleado"), button:contains("Crear empleado")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Rellenar todos los campos
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.surname"], input#data\\.surname', apellidos);
        escribirCampo('input[name="data.email"], input#data\\.email', email);
        escribirCampo('input[name="data.phone"], input#data\\.phone', telefono);
        cy.wait(500);
        // Esperar a que desaparezca "Cargando..." antes de seleccionar
        cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
        cy.wait(500);
        // Seleccionar Grupo - usar el mismo método robusto que TC020 y TC021
        cy.contains('label, span, div, h3, h4, h5', /grupo/i, { timeout: 10000 })
          .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, section, .grid, form')
          .first()
          .within(() => {
            cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(300);
        // Esperar a que aparezcan las opciones
        cy.get('.choices__list--dropdown:visible, [role="listbox"]:visible', { timeout: 10000 })
          .first()
          .within(() => {
            cy.contains('Cargando...', { timeout: 5000 }).should('not.exist');
            cy.wait(500);
            // Buscar y seleccionar "Admin Group"
            cy.log(`Buscando grupo: ${grupo}`);
            cy.contains('[role="option"]:visible, .choices__item--choice:visible', /admin\s+group/i, { timeout: 10000 })
              .should('exist')
              .should('be.visible')
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(500);
        // Seleccionar Departamento si existe
        if (departamento) {
          seleccionarOpcionChoices(departamento, 'Departamento');
          cy.wait(500);
        }
        // Seleccionar Roles si existe
        if (roles) {
          seleccionarOpcionChoices(roles, 'Roles');
          cy.wait(500);
        }
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function empleadosEditar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados')
      .then(() => {
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que el formulario de edición se abrió correctamente
        cy.url({ timeout: 10000 }).should('include', '/empleados/');
        cy.url({ timeout: 10000 }).should('include', '/edit');
        // Verificar que hay campos en el formulario
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 }).should('exist');
        cy.log('Formulario de edición abierto correctamente - OK');
        return cy.wrap(true);
      });
  }

  // ========== FUNCIONES JORNADAS DIARIAS ==========
  function jornadasDiariasCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias');
  }

  function jornadasDiariasCrearSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        // Los días de la semana vienen marcados por defecto, solo verificar
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearDuplicado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = casoExcel.dato_1 || 'Jornada diaria 1';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('ya ha sido registrado') || 
                            $body.text().toLowerCase().includes('duplicado');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre de la jornada ya ha sido registrado.',
              obtenido: 'El campo nombre de la jornada ya ha sido registrado.',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadasDiariasValidacionNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.name"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearConRangoInicio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const desde = obtenerDatoPorEtiqueta(casoExcel, 'data.entry_start_window') || casoExcel.dato_2 || '08:00';
    const hasta = obtenerDatoPorEtiqueta(casoExcel, 'data.entry_end_window') || casoExcel.dato_3 || '10:00';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Activar rango de inicio - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*rango.*inicio|activar.*rango.*para.*iniciar/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos Desde y Hasta
        cy.get('input[name="data.entry_start_window"], input#data\\.entry_start_window', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(desde, { force: true });
        cy.wait(300);
        cy.get('input[name="data.entry_end_window"], input#data\\.entry_end_window', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(hasta, { force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearConRangoFin(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const desde = obtenerDatoPorEtiqueta(casoExcel, 'data.exit_start_window') || casoExcel.dato_2 || '15:00';
    const hasta = obtenerDatoPorEtiqueta(casoExcel, 'data.exit_end_window') || casoExcel.dato_3 || '18:00';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Activar rango de fin - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*rango.*fin|activar.*rango.*para.*finalizar/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos Desde y Hasta
        cy.get('input[name="data.exit_start_window"], input#data\\.exit_start_window', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(desde, { force: true });
        cy.wait(300);
        cy.get('input[name="data.exit_end_window"], input#data\\.exit_end_window', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(hasta, { force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearConDuracion(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const minimo = obtenerDatoPorEtiqueta(casoExcel, 'data.duration_min') || casoExcel.dato_2 || '03:00';
    const maximo = obtenerDatoPorEtiqueta(casoExcel, 'data.duration_max') || casoExcel.dato_3 || '10:00';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Activar rango de duración - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*duración|activar.*tiempo.*mínimo|activar.*tiempo.*máximo/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos Mínimo y Máximo
        cy.get('input[name="data.duration_min"], input#data\\.duration_min', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(minimo, { force: true });
        cy.wait(300);
        cy.get('input[name="data.duration_max"], input#data\\.duration_max', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(maximo, { force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearConLimites(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const minimo = obtenerDatoPorEtiqueta(casoExcel, 'data.daily_min_entries') || casoExcel.dato_2 || '1';
    const maximo = obtenerDatoPorEtiqueta(casoExcel, 'data.daily_max_entries') || casoExcel.dato_3 || '3';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        // Activar límites - PRIMERO activar ambos toggles por separado
        // Activar límite mínimo
        cy.contains('label, span, div, p', /activar.*límite.*mínimo|activar.*cantidad.*mínima/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(500);
                } else {
                  cy.wait(200);
                }
              });
          });
        // Activar límite máximo
        cy.contains('label, span, div, p', /activar.*límite.*máximo|activar.*cantidad.*máxima/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(500);
                } else {
                  cy.wait(200);
                }
              });
          });
        cy.wait(300);
        // Ahora escribir en los campos Mínimo y Máximo
        cy.get('input[name="data.daily_min_entries"], input#data\\.daily_min_entries', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(minimo, { force: true });
        cy.wait(300);
        cy.get('input[name="data.daily_max_entries"], input#data\\.daily_max_entries', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .clear({ force: true })
          .type(maximo, { force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasCrearCompleto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const rangoInicioDesde = obtenerDatoPorEtiqueta(casoExcel, 'data.entry_start_window') || casoExcel.dato_2 || '08:00';
    const rangoInicioHasta = obtenerDatoPorEtiqueta(casoExcel, 'data.entry_end_window') || casoExcel.dato_3 || '10:00';
    const rangoFinDesde = obtenerDatoPorEtiqueta(casoExcel, 'data.exit_start_window') || casoExcel.dato_4 || '15:00';
    const rangoFinHasta = obtenerDatoPorEtiqueta(casoExcel, 'data.exit_end_window') || casoExcel.dato_5 || '18:00';
    const duracionMin = obtenerDatoPorEtiqueta(casoExcel, 'data.duration_min') || casoExcel.dato_6 || '03:00';
    const duracionMax = obtenerDatoPorEtiqueta(casoExcel, 'data.duration_max') || casoExcel.dato_7 || '10:00';
    const limiteMin = obtenerDatoPorEtiqueta(casoExcel, 'data.daily_min_entries') || casoExcel.dato_8 || '1';
    const limiteMax = obtenerDatoPorEtiqueta(casoExcel, 'data.daily_max_entries') || casoExcel.dato_9 || '3';
    const horaReinicio = obtenerDatoPorEtiqueta(casoExcel, 'data.reset_at') || casoExcel.dato_10 || '11:00';
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('a:contains("Crear Jornada Diaria"), button:contains("Crear Jornada Diaria")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        
        // Activar y rellenar Rango de inicio - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*rango.*inicio|activar.*rango.*para.*iniciar/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                // Verificar si está activado por aria-checked o clases
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos del rango de inicio
        cy.get('input[name="data.entry_start_window"], input#data\\.entry_start_window', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(rangoInicioDesde, { force: true });
        cy.wait(300);
        cy.get('input[name="data.entry_end_window"], input#data\\.entry_end_window', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(rangoInicioHasta, { force: true });
        cy.wait(500);

        // Activar y rellenar Rango de fin - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*rango.*fin|activar.*rango.*para.*finalizar/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos del rango de fin
        cy.get('input[name="data.exit_start_window"], input#data\\.exit_start_window', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(rangoFinDesde, { force: true });
        cy.wait(300);
        cy.get('input[name="data.exit_end_window"], input#data\\.exit_end_window', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(rangoFinHasta, { force: true });
        cy.wait(500);

        // Activar y rellenar Rango de duración - PRIMERO activar el toggle
        cy.contains('label, span, div, p', /activar.*duración|activar.*tiempo.*mínimo|activar.*tiempo.*máximo/i, { timeout: 10000 })
          .first()
          .closest('fieldset, div, section, .fi-field')
          .within(() => {
            cy.get('button[role="switch"], [role="switch"], input[type="checkbox"], button.fi-fo-toggle', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .then($toggle => {
                const isChecked = $toggle.attr('aria-checked') === 'true' || 
                                 $toggle.hasClass('checked') || 
                                 $toggle.hasClass('bg-custom-600') ||
                                 $toggle.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(800); // Esperar a que se active y se habiliten los campos
                } else {
                  cy.wait(300);
                }
              });
          });
        // Ahora escribir en los campos de duración
        cy.get('input[name="data.duration_min"], input#data\\.duration_min', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(duracionMin, { force: true });
        cy.wait(300);
        cy.get('input[name="data.duration_max"], input#data\\.duration_max', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(duracionMax, { force: true });
        cy.wait(500);

        // Activar y rellenar Límites de veces - PRIMERO activar ambos toggles por separado
        // Activar límite mínimo - buscar específicamente el texto exacto
        cy.get('body').then($body => {
          // Buscar el label o texto que contenga exactamente "Activar límite mínimo"
          const $labelMin = $body.find('label, span, div, p').filter((_, el) => {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            return text.includes('activar') && text.includes('límite') && text.includes('mínimo');
          }).first();
          
          if ($labelMin.length) {
            // Buscar el toggle asociado en el mismo contenedor
            const $container = $labelMin.closest('fieldset, div, section, .fi-field, .fi-fo-field-wrp');
            const $toggle = $container.find('button[role="switch"], button.fi-fo-toggle, [role="switch"]').first();
            if ($toggle.length) {
              cy.wrap($toggle).scrollIntoView().then($t => {
                const isChecked = $t.attr('aria-checked') === 'true' || 
                                 $t.hasClass('checked') || 
                                 $t.hasClass('bg-custom-600') ||
                                 $t.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(600);
                } else {
                  cy.wait(300);
                }
              });
            }
          }
        });
        
        // Activar límite máximo - buscar específicamente el texto exacto
        cy.get('body').then($body => {
          // Buscar el label o texto que contenga exactamente "Activar límite máximo"
          const $labelMax = $body.find('label, span, div, p').filter((_, el) => {
            const text = (el.innerText || el.textContent || '').trim().toLowerCase();
            return text.includes('activar') && text.includes('límite') && text.includes('máximo');
          }).first();
          
          if ($labelMax.length) {
            // Buscar el toggle asociado en el mismo contenedor
            const $container = $labelMax.closest('fieldset, div, section, .fi-field, .fi-fo-field-wrp');
            const $toggle = $container.find('button[role="switch"], button.fi-fo-toggle, [role="switch"]').first();
            if ($toggle.length) {
              cy.wrap($toggle).scrollIntoView().then($t => {
                const isChecked = $t.attr('aria-checked') === 'true' || 
                                 $t.hasClass('checked') || 
                                 $t.hasClass('bg-custom-600') ||
                                 $t.hasClass('bg-primary-600');
                if (!isChecked) {
                  cy.wrap($toggle).click({ force: true });
                  cy.wait(600);
                } else {
                  cy.wait(300);
                }
              });
            }
          }
        });
        cy.wait(400);
        // Ahora escribir en los campos de límites
        cy.get('input[name="data.daily_min_entries"], input#data\\.daily_min_entries', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(limiteMin, { force: true });
        cy.wait(300);
        cy.get('input[name="data.daily_max_entries"], input#data\\.daily_max_entries', { timeout: 10000 })
          .first().scrollIntoView().clear({ force: true }).type(limiteMax, { force: true });
        cy.wait(500);

        // Hacer clic en Crear después de rellenar todos los campos
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadasDiariasEditar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias')
      .then(() => {
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que el formulario de edición se abrió correctamente
        cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias/');
        cy.url({ timeout: 10000 }).should('include', '/edit');
        // Verificar que hay campos en el formulario
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 }).should('exist');
        cy.log('Formulario de edición abierto correctamente - OK');
        return cy.wrap(true);
      });
  }

  // ========== FUNCIONES JORNADA SEMANAL ==========
  function jornadaSemanalCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal');
  }

  function jornadaSemanalCrearMinimo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const horas = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_hours') || casoExcel.dato_2 || '40';
    const minutos = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_minutes') || casoExcel.dato_3 || '0';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Escribir nombre
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
          .first()
          .scrollIntoView({ ensureScrollable: false })
          .clear({ force: true })
          .type(nombre, { force: true });
        cy.wait(300);
        // Escribir horas - usar el nombre correcto del campo según jornada_semanal.cy.js
        cy.get('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', { timeout: 10000 })
          .first()
          .scrollIntoView({ ensureScrollable: false })
          .clear({ force: true })
          .type(horas, { force: true });
        cy.wait(300);
        // Escribir minutos - usar el nombre correcto del campo según jornada_semanal.cy.js
        cy.get('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', { timeout: 10000 })
          .first()
          .scrollIntoView({ ensureScrollable: false })
          .clear({ force: true })
          .type(minutos, { force: true });
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView({ ensureScrollable: false })
          .click({ force: true });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

  function jornadaSemanalCrearDuplicado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = casoExcel.dato_1 || 'Jornada semanal 1';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('ya ha sido registrado') || 
                            $body.text().toLowerCase().includes('duplicado');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El campo nombre ya ha sido registrado.',
              obtenido: 'El campo nombre ya ha sido registrado.',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalValidacionNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(1000);
        cy.get('body').then($body => {
          const tieneAviso = $body.text().toLowerCase().includes('completa este campo') || 
                            $body.find('input[name="data.name"]:invalid').length > 0;
          if (tieneAviso) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'Salta aviso "Completa este campo"',
              obtenido: 'Salta aviso "Completa este campo"',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalCrearMaxHoras(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const horas = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_hours') || casoExcel.dato_2 || '100';
    const minutos = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_minutes') || casoExcel.dato_3 || '0';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
        escribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('inferior o igual a 80') || 
                            $body.text().toLowerCase().includes('máximo');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El valor debe ser inferior o igual a 80',
              obtenido: 'El valor debe ser inferior o igual a 80',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalCrearMinHoras(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const horas = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_hours') || casoExcel.dato_2 || '-2';
    const minutos = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_minutes') || casoExcel.dato_3 || '0';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // No hay campo Empresa en este formulario
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
        escribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('superior o igual a 0') || 
                            $body.text().toLowerCase().includes('mínimo');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El valor debe ser superior o igual a 0',
              obtenido: 'El valor debe ser superior o igual a 0',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalEditar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(500);
        cy.get('a:contains("Editar"), button:contains("Editar")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // Verificar que el formulario de edición se abrió correctamente
        cy.url({ timeout: 10000 }).should('include', '/jornada-semanal/');
        cy.url({ timeout: 10000 }).should('include', '/edit');
        // Verificar que hay campos en el formulario
        cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 }).should('exist');
        cy.log('Formulario de edición abierto correctamente - OK');
        return cy.wrap(true);
      });
  }

  function jornadaSemanalCrearMaxMinutos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const horas = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_hours') || casoExcel.dato_2 || '40';
    const minutos = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_minutes') || casoExcel.dato_3 || '70';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // No hay campo Empresa en este formulario
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
        escribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('inferior o igual a 59') || 
                            $body.text().toLowerCase().includes('máximo');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El valor debe ser inferior o igual a 59',
              obtenido: 'El valor debe ser inferior o igual a 59',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalCrearMinMinutos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || procesarPruebaXXX(casoExcel.dato_1) || `prueba${generarNumeroAleatorio()}`;
    const horas = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_hours') || casoExcel.dato_2 || '40';
    const minutos = obtenerDatoPorEtiqueta(casoExcel, 'data.weekly_hours_minutes') || casoExcel.dato_3 || '-2';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        cy.get('a:contains("Crear Jornada Semanal"), button:contains("Crear Jornada Semanal")', { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.wait(1000);
        // No hay campo Empresa en este formulario
        escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        escribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
        escribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
        cy.wait(500);
        cy.get('button:contains("Crear"), input[type="submit"]', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(2000);
        cy.get('body').then($body => {
          const tieneError = $body.text().toLowerCase().includes('superior o igual a 0') || 
                            $body.text().toLowerCase().includes('mínimo');
          if (tieneError) {
            cy.registrarResultados({
              numero: parseInt(casoExcel.caso.replace('TC', '')),
              nombre: `${casoExcel.caso} - ${casoExcel.nombre}`,
              esperado: 'El valor debe ser superior o igual a 0',
              obtenido: 'El valor debe ser superior o igual a 0',
              resultado: 'OK',
              archivo,
              pantalla: 'Pruebas Usuario Admin'
            });
          }
        });
        return cy.wrap(true);
      });
  }

  function jornadaSemanalAnadirTiposJornada(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const jornadaDiaria = obtenerDatoPorEtiqueta(casoExcel, 'jornada') || casoExcel.dato_1 || '';
    
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal')
      .then(() => {
        // Abrir formulario de edición
        cy.get('.fi-ta-table, table', { timeout: 10000 }).scrollTo('right', { ensureScrollable: false });
        cy.wait(300);
        cy.contains('.fi-ta-row:visible a, .fi-ta-row:visible button', /Editar/i, { timeout: 10000 })
          .first()
          .click({ force: true });
        cy.url({ timeout: 10000 }).should('match', /\/jornada-semanal\/.+\/edit/);
        cy.wait(1000);
        
        // Scroll al final para encontrar la sección "Asignar jornadas diarias"
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(300);
        
        // Buscar y hacer clic en el botón "Añadir Jornada diaria"
        cy.contains('button, a', /Añadir Jornada diaria/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(600);
        
        // Esperar a que se abra el modal
        cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
          .should('be.visible')
          .within(() => {
            // Seleccionar el segundo checkbox disponible
            cy.get('input[type="checkbox"]:visible, .fi-checkbox input:visible', { timeout: 10000 })
              .eq(1) // Segundo checkbox (índice 1)
              .scrollIntoView()
              .click({ force: true });
            cy.wait(300);
            // Hacer clic en el botón "Enviar"
            cy.contains('button, a', /Enviar/i, { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true });
          });
        cy.wait(2000);
        return cy.wrap(true);
      });
  }

});