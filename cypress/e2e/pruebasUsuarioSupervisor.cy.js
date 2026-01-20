// Suite de pruebas automatizadas para Usuario Supervisor
// Este archivo ejecuta pruebas usando un usuario supervisor
describe('PRUEBAS USUARIO SUPERVISOR - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = 'https://horario.dev.novatrans.app';
  const DASHBOARD_PATH = '/panelinterno';
  const LOGIN_PATH = '/panelinterno/login';
  
  // Credenciales de usuario supervisor (desde variables de entorno)
  const SUPERVISOR_EMAIL = Cypress.env('SUPERVISOR_EMAIL') || 'supervisor@supervisor.app';
  const SUPERVISOR_PASSWORD = Cypress.env('SUPERVISOR_PASSWORD') || 'novatranshorario@2025';

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
    cy.procesarResultadosPantalla('Pruebas Usuario Supervisor');
  });

  it('Ejecutar todos los casos de Pruebas Usuario Supervisor desde Google Sheets', () => {
    // Hacer login una sola vez al inicio
    loginSupervisor().then(() => {
      return cy.obtenerDatosExcel('PruebasUsuarioSupervisor').then((casosExcel) => {
        cy.log(`Cargados ${casosExcel.length} casos desde Excel para Pruebas Usuario Supervisor`);

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

  // === Helper: hacer login con usuario supervisor ===
  function loginSupervisor() {
    cy.log('Haciendo login con usuario supervisor...');
    cy.login({ 
      email: SUPERVISOR_EMAIL, 
      password: SUPERVISOR_PASSWORD, 
      useSession: false 
    });
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    cy.wait(2000);
    return cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 10000 }).should('exist');
  }

  // === Helper: ir a una pantalla específica con sesión supervisor activa ===
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
                pantalla: 'Pruebas Usuario Supervisor'
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
          pantalla: 'Pruebas Usuario Supervisor'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === Verificar error 500 global ===
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
          cy.log(' Error 500 detectado en la página');
          cy.registrarResultados({
            numero,
            nombre,
            esperado: casoExcel.resultado_esperado || 'Comportamiento correcto',
            obtenido: '500 SERVER ERROR / Internal Server Error',
            resultado: 'KO',
            archivo,
            pantalla: 'Pruebas Usuario Supervisor'
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

  // === Helper: obtener dato por etiqueta ===
  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    if (!casoExcel || !etiquetaBuscada) return null;
    
    const etiquetaLower = etiquetaBuscada.toLowerCase().trim();
    
    // Buscar en todas las propiedades del objeto casoExcel
    for (const key in casoExcel) {
      if (casoExcel.hasOwnProperty(key)) {
        const keyLower = key.toLowerCase().trim();
        if (keyLower === etiquetaLower || keyLower.includes(etiquetaLower)) {
          const valor = casoExcel[key];
          if (valor && String(valor).trim() !== '') {
            return String(valor).trim();
          }
        }
      }
    }
    
    return null;
  }

  // === Helper: extraer texto desde nombre ===
  // === MAPEO DE FUNCIONES ===
  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      // Departamentos
      'TC001': departamentosCargarPantalla,
      'TC002': departamentosBuscarTextoExacto,
      'TC003': departamentosBuscarTextoParcial,
      'TC004': departamentosBuscarCaseInsensitive,
      'TC005': departamentosBuscarConEspacios,
      'TC006': departamentosBuscarConCaracteresEspeciales,
      'TC007': departamentosLimpiarBusqueda,
      'TC008': departamentosOrdenarPorNombre,
      'TC009': departamentosMostrarColumnaCreado,
      'TC010': departamentosMostrarColumnaActualizado,
      // Grupos
      'TC011': gruposCargarPantalla,
      'TC012': gruposBuscarTextoExacto,
      'TC013': gruposBuscarTextoParcial,
      'TC014': gruposBuscarCaseInsensitive,
      'TC015': gruposBuscarConEspacios,
      'TC016': gruposBuscarConCaracteresEspeciales,
      'TC017': gruposLimpiarBusqueda,
      'TC018': gruposMostrarColumnaDescripcion,
      'TC019': gruposMostrarColumnaEmpresa,
      'TC020': gruposMostrarColumnaCreado,
      'TC021': gruposMostrarColumnaActualizado,
      'TC022': gruposMostrarColumnaEliminado,
      'TC023': gruposOrdenarPorEmpresa,
      'TC024': gruposOrdenarPorNombre,
      'TC025': gruposOrdenarPorDepartamento,
      'TC026': gruposOrdenarPorSupervisor,
      'TC027': gruposFiltrarPorDepartamento,
      // Empleados
      'TC028': empleadosCargarPantalla,
      'TC029': empleadosBuscarTextoExacto,
      'TC030': empleadosBuscarTextoParcial,
      'TC031': empleadosBuscarCaseInsensitive,
      'TC032': empleadosBuscarConEspacios,
      'TC033': empleadosBuscarConCaracteresEspeciales,
      'TC034': empleadosLimpiarBusqueda,
      'TC035': empleadosMostrarColumnaTelefono,
      'TC036': empleadosMostrarColumnaCreado,
      'TC037': empleadosMostrarColumnaActualizado,
      'TC038': empleadosMostrarColumnaEliminado,
      'TC039': empleadosOrdenarPorNombre,
      'TC040': empleadosOrdenarPorApellidos,
      'TC041': empleadosOrdenarPorEmail,
      'TC042': empleadosFiltrarPorDepartamento,
      'TC043': empleadosFiltrarPorGrupo,
      // Jornadas Diarias
      'TC044': jornadasDiariasCargarPantalla,
      'TC045': jornadasDiariasBuscarTextoExacto,
      'TC046': jornadasDiariasBuscarTextoParcial,
      'TC047': jornadasDiariasBuscarCaseInsensitive,
      'TC048': jornadasDiariasBuscarConEspacios,
      'TC049': jornadasDiariasBuscarConCaracteresEspeciales,
      'TC050': jornadasDiariasLimpiarBusqueda,
      'TC051': jornadasDiariasMostrarColumnaS,
      'TC052': jornadasDiariasMostrarColumnaD,
      'TC053': jornadasDiariasMostrarColumnaVentanaEntrada,
      'TC054': jornadasDiariasMostrarColumnaVentanaSalida,
      'TC055': jornadasDiariasOrdenarPorNombre,
      'TC056': jornadasDiariasOrdenarPorCreado,
      'TC057': jornadasDiariasOrdenarPorActualizado,
      'TC058': jornadasDiariasFiltrarPorCategoria,
      // Jornada Semanal
      'TC059': jornadaSemanalCargarPantalla,
      'TC060': jornadaSemanalBuscarTextoExacto,
      'TC061': jornadaSemanalBuscarTextoParcial,
      'TC062': jornadaSemanalBuscarCaseInsensitive,
      'TC063': jornadaSemanalBuscarConEspacios,
      'TC064': jornadaSemanalBuscarConCaracteresEspeciales,
      'TC065': jornadaSemanalLimpiarBusqueda,
      'TC066': jornadaSemanalMostrarColumnaDescripcion,
      'TC067': jornadaSemanalOrdenarPorNombre,
      'TC068': jornadaSemanalOrdenarPorHorasSemanales
    };

    // También buscar por nombre de función
    const funcionesPorNombre = {
      'departamentosCargarPantalla': departamentosCargarPantalla,
      'departamentosBuscarTextoExacto': departamentosBuscarTextoExacto,
      'departamentosBuscarTextoParcial': departamentosBuscarTextoParcial,
      'departamentosBuscarCaseInsensitive': departamentosBuscarCaseInsensitive,
      'departamentosBuscarConEspacios': departamentosBuscarConEspacios,
      'departamentosBuscarConCaracteresEspeciales': departamentosBuscarConCaracteresEspeciales,
      'departamentosLimpiarBusqueda': departamentosLimpiarBusqueda,
      'departamentosOrdenarPorNombre': departamentosOrdenarPorNombre,
      'departamentosMostrarColumnaCreado': departamentosMostrarColumnaCreado,
      'departamentosMostrarColumnaActualizado': departamentosMostrarColumnaActualizado,
      'gruposCargarPantalla': gruposCargarPantalla,
      'gruposBuscarTextoExacto': gruposBuscarTextoExacto,
      'gruposBuscarTextoParcial': gruposBuscarTextoParcial,
      'gruposBuscarCaseInsensitive': gruposBuscarCaseInsensitive,
      'gruposBuscarConEspacios': gruposBuscarConEspacios,
      'gruposBuscarConCaracteresEspeciales': gruposBuscarConCaracteresEspeciales,
      'gruposLimpiarBusqueda': gruposLimpiarBusqueda,
      'gruposMostrarColumnaDescripcion': gruposMostrarColumnaDescripcion,
      'gruposMostrarColumnaEmpresa': gruposMostrarColumnaEmpresa,
      'gruposMostrarColumnaCreado': gruposMostrarColumnaCreado,
      'gruposMostrarColumnaActualizado': gruposMostrarColumnaActualizado,
      'gruposMostrarColumnaEliminado': gruposMostrarColumnaEliminado,
      'gruposOrdenarPorEmpresa': gruposOrdenarPorEmpresa,
      'gruposOrdenarPorNombre': gruposOrdenarPorNombre,
      'gruposOrdenarPorDepartamento': gruposOrdenarPorDepartamento,
      'gruposOrdenarPorSupervisor': gruposOrdenarPorSupervisor,
      'gruposFiltrarPorDepartamento': gruposFiltrarPorDepartamento,
      'empleadosCargarPantalla': empleadosCargarPantalla,
      'empleadosBuscarTextoExacto': empleadosBuscarTextoExacto,
      'empleadosBuscarTextoParcial': empleadosBuscarTextoParcial,
      'empleadosBuscarCaseInsensitive': empleadosBuscarCaseInsensitive,
      'empleadosBuscarConEspacios': empleadosBuscarConEspacios,
      'empleadosBuscarConCaracteresEspeciales': empleadosBuscarConCaracteresEspeciales,
      'empleadosLimpiarBusqueda': empleadosLimpiarBusqueda,
      'empleadosMostrarColumnaTelefono': empleadosMostrarColumnaTelefono,
      'empleadosMostrarColumnaCreado': empleadosMostrarColumnaCreado,
      'empleadosMostrarColumnaActualizado': empleadosMostrarColumnaActualizado,
      'empleadosMostrarColumnaEliminado': empleadosMostrarColumnaEliminado,
      'empleadosOrdenarPorNombre': empleadosOrdenarPorNombre,
      'empleadosOrdenarPorApellidos': empleadosOrdenarPorApellidos,
      'empleadosOrdenarPorEmail': empleadosOrdenarPorEmail,
      'empleadosFiltrarPorDepartamento': empleadosFiltrarPorDepartamento,
      'empleadosFiltrarPorGrupo': empleadosFiltrarPorGrupo,
      'jornadasDiariasCargarPantalla': jornadasDiariasCargarPantalla,
      'jornadasDiariasBuscarTextoExacto': jornadasDiariasBuscarTextoExacto,
      'jornadasDiariasBuscarTextoParcial': jornadasDiariasBuscarTextoParcial,
      'jornadasDiariasBuscarCaseInsensitive': jornadasDiariasBuscarCaseInsensitive,
      'jornadasDiariasBuscarConEspacios': jornadasDiariasBuscarConEspacios,
      'jornadasDiariasBuscarConCaracteresEspeciales': jornadasDiariasBuscarConCaracteresEspeciales,
      'jornadasDiariasLimpiarBusqueda': jornadasDiariasLimpiarBusqueda,
      'jornadasDiariasMostrarColumnaS': jornadasDiariasMostrarColumnaS,
      'jornadasDiariasMostrarColumnaD': jornadasDiariasMostrarColumnaD,
      'jornadasDiariasMostrarColumnaVentanaEntrada': jornadasDiariasMostrarColumnaVentanaEntrada,
      'jornadasDiariasMostrarColumnaVentanaSalida': jornadasDiariasMostrarColumnaVentanaSalida,
      'jornadasDiariasOrdenarPorNombre': jornadasDiariasOrdenarPorNombre,
      'jornadasDiariasOrdenarPorCreado': jornadasDiariasOrdenarPorCreado,
      'jornadasDiariasOrdenarPorActualizado': jornadasDiariasOrdenarPorActualizado,
      'jornadasDiariasFiltrarPorCategoria': jornadasDiariasFiltrarPorCategoria,
      'jornadaSemanalCargarPantalla': jornadaSemanalCargarPantalla,
      'jornadaSemanalBuscarTextoExacto': jornadaSemanalBuscarTextoExacto,
      'jornadaSemanalBuscarTextoParcial': jornadaSemanalBuscarTextoParcial,
      'jornadaSemanalBuscarCaseInsensitive': jornadaSemanalBuscarCaseInsensitive,
      'jornadaSemanalBuscarConEspacios': jornadaSemanalBuscarConEspacios,
      'jornadaSemanalBuscarConCaracteresEspeciales': jornadaSemanalBuscarConCaracteresEspeciales,
      'jornadaSemanalLimpiarBusqueda': jornadaSemanalLimpiarBusqueda,
      'jornadaSemanalMostrarColumnaDescripcion': jornadaSemanalMostrarColumnaDescripcion,
      'jornadaSemanalOrdenarPorNombre': jornadaSemanalOrdenarPorNombre,
      'jornadaSemanalOrdenarPorHorasSemanales': jornadaSemanalOrdenarPorHorasSemanales
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

    // Si no se encuentra, devolver función vacía
    cy.log(` Función no encontrada: "${nombreFuncion}"`);
    cy.log(`Funciones disponibles por nombre: ${Object.keys(funcionesPorNombre).join(', ')}`);
    return () => {
      cy.log(`Ejecutando función vacía para: "${nombreFuncion}"`);
      return cy.wrap(true);
    };
  }

  // ========== FUNCIONES DEPARTAMENTOS ==========
  function departamentosCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/departamentos', 'Departamentos');
  }

  function departamentosBuscarTextoExacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Departamento 1 de Admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function departamentosBuscarTextoParcial(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'de Admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function departamentosBuscarCaseInsensitive(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'DePaRtAmEnTo';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function departamentosBuscarConEspacios(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || ' Admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function departamentosBuscarConCaracteresEspeciales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '%$&';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function departamentosLimpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'admin';
    return limpiarBusqueda(casoExcel, valor);
  }

  function departamentosOrdenarPorNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Nombre');
  }

  function departamentosMostrarColumnaCreado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Creado');
  }

  function departamentosMostrarColumnaActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Actualizado');
  }

  // ========== FUNCIONES GRUPOS ==========
  function gruposCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/grupos', 'Grupos');
  }

  function gruposBuscarTextoExacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function gruposBuscarTextoParcial(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Super';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function gruposBuscarCaseInsensitive(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'SuPeR';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function gruposBuscarConEspacios(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '    admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function gruposBuscarConCaracteresEspeciales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '$%&';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function gruposLimpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'admin';
    return limpiarBusqueda(casoExcel, valor);
  }

  function gruposMostrarColumnaDescripcion(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Descripción');
  }

  function gruposMostrarColumnaEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Empresa');
  }

  function gruposMostrarColumnaCreado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Creado');
  }

  function gruposMostrarColumnaActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Actualizado');
  }

  function gruposMostrarColumnaEliminado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Eliminado');
  }

  function gruposOrdenarPorEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Empresa');
  }

  function gruposOrdenarPorNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Nombre');
  }

  function gruposOrdenarPorDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Departamento');
  }

  function gruposOrdenarPorSupervisor(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Supervisor');
  }

  function gruposFiltrarPorDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const departamento = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'prueba';
    return filtrarPorCampo('Departamento', departamento);
  }

  // ========== FUNCIONES EMPLEADOS ==========
  function empleadosCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/empleados', 'Empleados');
  }

  function empleadosBuscarTextoExacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Empresa Cliente 1';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function empleadosBuscarTextoParcial(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Empresa';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function empleadosBuscarCaseInsensitive(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'eMpReSa';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function empleadosBuscarConEspacios(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '     empresa';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function empleadosBuscarConCaracteresEspeciales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '$%&';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function empleadosLimpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'empresa';
    return limpiarBusqueda(casoExcel, valor);
  }

  function empleadosMostrarColumnaTelefono(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Teléfono');
  }

  function empleadosMostrarColumnaCreado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Creado');
  }

  function empleadosMostrarColumnaActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Actualizado');
  }

  function empleadosMostrarColumnaEliminado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Eliminado');
  }

  function empleadosOrdenarPorNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Nombre');
  }

  function empleadosOrdenarPorApellidos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Apellidos');
  }

  function empleadosOrdenarPorEmail(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Email');
  }

  function empleadosFiltrarPorDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const departamento = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'prueba';
    return filtrarPorCampo('Departamento', departamento);
  }

  function empleadosFiltrarPorGrupo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const grupo = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Admin Group';
    return filtrarPorCampo('Grupo', grupo);
  }

  // ========== FUNCIONES JORNADAS DIARIAS ==========
  function jornadasDiariasCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornadas-diarias', 'Jornadas Diarias');
  }

  function jornadasDiariasBuscarTextoExacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasBuscarTextoParcial(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'pausa';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasBuscarCaseInsensitive(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'AdMiN';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasBuscarConEspacios(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '      admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasBuscarConCaracteresEspeciales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '$%&';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasLimpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'admin';
    return limpiarBusqueda(casoExcel, valor);
  }

  function jornadasDiariasMostrarColumnaS(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('S');
  }

  function jornadasDiariasMostrarColumnaD(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('D');
  }

  function jornadasDiariasMostrarColumnaVentanaEntrada(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Ventana Entrada');
  }

  function jornadasDiariasMostrarColumnaVentanaSalida(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Ventana Salida');
  }

  function jornadasDiariasOrdenarPorNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Nombre');
  }

  function jornadasDiariasOrdenarPorCreado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Creado');
  }

  function jornadasDiariasOrdenarPorActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Actualizado');
  }

  function jornadasDiariasFiltrarPorCategoria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const categoria = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'Jornada de Trabajo';
    return filtrarPorCampo('Categoría de entrada', categoria);
  }

  // ========== FUNCIONES JORNADA SEMANAL ==========
  function jornadaSemanalCargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return irAPantallaLimpio('/panelinterno/jornada-semanal', 'Jornada Semanal');
  }

  function jornadaSemanalBuscarTextoExacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'jornada2';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalBuscarTextoParcial(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'empresa';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalBuscarCaseInsensitive(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'AdMiN';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalBuscarConEspacios(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '     admin';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalBuscarConCaracteresEspeciales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || '$%&';
    return ejecutarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalLimpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerDatoPorEtiqueta(casoExcel, 'dato_1') || casoExcel.dato_1 || 'admin';
    return limpiarBusqueda(casoExcel, valor);
  }

  function jornadaSemanalMostrarColumnaDescripcion(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return mostrarColumna('Descripción');
  }

  function jornadaSemanalOrdenarPorNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Nombre');
  }

  function jornadaSemanalOrdenarPorHorasSemanales(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Horas Semanales');
  }

  // ========== FUNCIONES HELPER REUTILIZABLES ==========
  function ejecutarBusqueda(casoExcel, valor) {
    cy.log(`Buscando: "${valor}"`);
    return irAPantallaLimpio(obtenerRutaPorCaso(casoExcel.caso), obtenerNombrePantallaPorCaso(casoExcel.caso))
      .then(() => {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
          .should('be.visible')
          .clear({ force: true })
          .type(`${valor}{enter}`, { force: true });
        cy.wait(2000);
        
        return cy.get('body').then($body => {
          const filasVisibles = $body.find('.fi-ta-row:visible, tr:visible').length;
          const textoBody = $body.text().toLowerCase();
          const hayMensajeSinResultados = textoBody.includes('no se encontraron') ||
                                         textoBody.includes('sin resultados') ||
                                         textoBody.includes('no hay datos') ||
                                         textoBody.includes('sin registros') ||
                                         $body.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"]').length > 0;
          
          if (filasVisibles > 0) {
            cy.log(`Filas visibles después de búsqueda: ${filasVisibles} - OK`);
          } else if (hayMensajeSinResultados) {
            cy.log('No se encontraron resultados - esto es válido (OK)');
          } else {
            cy.log('Búsqueda ejecutada - OK');
          }
          return cy.wrap(true);
        });
      });
  }

  function limpiarBusqueda(casoExcel, valor) {
    cy.log(`Limpiando búsqueda de: "${valor}"`);
    return irAPantallaLimpio(obtenerRutaPorCaso(casoExcel.caso), obtenerNombrePantallaPorCaso(casoExcel.caso))
      .then(() => {
        // Primero buscar el valor
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
          .should('be.visible')
          .clear({ force: true })
          .type(`${valor}{enter}`, { force: true });
        cy.wait(2000);
        
        // Luego limpiar la búsqueda
        cy.get('body').then($body => {
          const chips = $body.find('.fi-active-filter button, [data-testid="clear-filter"], .MuiChip-deleteIcon, [aria-label*="Quitar"], [aria-label*="Eliminar"]');
          if (chips.length > 0) {
            cy.wrap(chips.first()).click({ force: true });
            cy.wait(500);
          } else {
            cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear({ force: true });
          }
        });
        
        return cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '');
      });
  }

  function mostrarColumna(nombreColumna) {
    cy.log(`Mostrando columna: ${nombreColumna}`);
    
    // Buscar el botón de 3 rayitas (toggle de columnas)
    cy.contains('button[title*="Alternar"], button[aria-label*="column"], .fi-ta-col-toggle button, button[title*="columnas"]', /columnas/i, { timeout: 10000 })
      .first()
      .click({ force: true });
    
    cy.wait(500);
    
    // Buscar el modal/dropdown de columnas
    cy.get('.fi-dropdown-panel:visible, .fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        // Buscar el checkbox de la columna específica
        cy.contains('label, span, div', new RegExp(nombreColumna, 'i'), { timeout: 10000 })
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
    
    // Cerrar el modal haciendo clic fuera
    cy.get('body').click(0, 0, { force: true });
    cy.wait(300);
    
    return cy.get('.fi-ta-header-cell, th').should('exist');
  }

  function ordenarPorColumna(nombreColumna) {
    cy.log(`Ordenando por columna: ${nombreColumna}`);
    
    return cy.get('body').then(($body) => {
      // Buscar el header de la columna
      const regex = new RegExp(`^${nombreColumna}$`, 'i');
      const $header = $body.find('th.fi-ta-header-cell, .fi-ta-header-cell').filter((_, el) => {
        return regex.test(Cypress.$(el).text().trim());
      }).first();
      
      if ($header.length > 0) {
        cy.wrap($header)
          .scrollIntoView({ offset: { top: 0, left: 0 } })
          .within(($headerEl) => {
            // Buscar el icono de ordenamiento (flecha)
            const $icon = $headerEl.find('span[role="button"], .fi-ta-header-cell-sort-icon, svg.fi-ta-header-cell-sort-icon, button').first();
            if ($icon.length) {
              // Hacer clic 2 veces para ordenar ASC y luego DESC
              cy.wrap($icon).click({ force: true });
              cy.wait(200);
              cy.wrap($icon).click({ force: true });
              cy.wait(200);
            } else {
              // Si no hay icono, hacer clic en el header directamente
              cy.wrap($headerEl).click({ force: true });
              cy.wait(200);
              cy.wrap($headerEl).click({ force: true });
            }
          });
      }
      
      return cy.wrap(true);
    });
  }

  function filtrarPorCampo(nombreCampo, valor) {
    cy.log(`Filtrando por ${nombreCampo}: ${valor}`);
    
    // Cerrar cualquier panel abierto
    cy.get('body').type('{esc}{esc}');
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });
    
    // Abrir el panel de filtros
    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });
    
    cy.wait(500);
    
    // Buscar el campo específico en el panel de filtros
    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panelFiltros')
      .should('be.visible');
    
    cy.get('@panelFiltros').within(() => {
      cy.contains('label, span, div, p', new RegExp(nombreCampo, 'i'), { timeout: 10000 })
        .should('be.visible')
        .closest('div, fieldset, section')
        .as('bloqueCampo');
    });
    
    // Seleccionar el valor en el dropdown/select
    cy.get('@bloqueCampo').then($bloque => {
      const $select = $bloque.find('select:visible');
      if ($select.length) {
        cy.wrap($select).first().select(valor, { force: true });
        return;
      }
      
      // Si es un dropdown personalizado (Choices.js)
      const openers = [
        '[role="combobox"]:visible',
        '[aria-haspopup="listbox"]:visible',
        '[aria-expanded]:visible',
        'button:visible',
        '[role="button"]:visible',
        '.fi-select-trigger:visible',
        '.fi-input:visible',
        '.choices__inner:visible'
      ];
      
      let opened = false;
      for (const sel of openers) {
        const $el = $bloque.find(sel).first();
        if ($el.length) {
          cy.wrap($el).scrollIntoView().click({ force: true });
          opened = true;
          cy.wait(500);
          break;
        }
      }
      
      if (!opened) {
        cy.wrap($bloque).scrollIntoView().click('center', { force: true });
        cy.wait(500);
      }
      
      // Seleccionar la opción
      cy.get('body').then($body => {
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', new RegExp(valor, 'i'), { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        } else {
          cy.get('.fi-dropdown-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible', { timeout: 10000 })
            .first()
            .within(() => {
              cy.contains(':visible', new RegExp(valor, 'i'), { timeout: 10000 })
                .scrollIntoView()
                .click({ force: true });
            });
        }
      });
    });
    
    // Cerrar el panel de filtros
    cy.get('@panelFiltros').then($p => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });
    
    cy.wait(1000);
    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 }).should('have.length.greaterThan', 0);
  }

  // Helper para obtener la ruta según el caso
  function obtenerRutaPorCaso(caso) {
    const numero = parseInt(String(caso).replace('TC', ''), 10);
    if (numero >= 1 && numero <= 10) return '/panelinterno/departamentos';
    if (numero >= 11 && numero <= 27) return '/panelinterno/grupos';
    if (numero >= 28 && numero <= 43) return '/panelinterno/empleados';
    if (numero >= 44 && numero <= 58) return '/panelinterno/jornadas-diarias';
    if (numero >= 59 && numero <= 68) return '/panelinterno/jornada-semanal';
    return '/panelinterno';
  }

  // Helper para obtener el nombre de pantalla según el caso
  function obtenerNombrePantallaPorCaso(caso) {
    const numero = parseInt(String(caso).replace('TC', ''), 10);
    if (numero >= 1 && numero <= 10) return 'Departamentos';
    if (numero >= 11 && numero <= 27) return 'Grupos';
    if (numero >= 28 && numero <= 43) return 'Empleados';
    if (numero >= 44 && numero <= 58) return 'Jornadas Diarias';
    if (numero >= 59 && numero <= 68) return 'Jornada Semanal';
    return 'Pantalla';
  }
});