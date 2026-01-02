// ***********************************************
// Custom commands y helpers para Control Horario
// ***********************************************

// ===== VARIABLES GLOBALES =====
// Acumulo los resultados por pantalla para luego sacar un resumen.
// También uso flags para evitar duplicados de registro por test.
let resultadosPorPantalla = {};   // Acumulador por pantalla (para resumen)
let errorYaRegistrado = false;    // Si ya capturé un error en este test
let resultadoYaRegistrado = false; // Si ya registré (OK/ERROR/WARNING) en este test

// ===== RESETEO DE FLAGS POR TEST =====
// Llamo a esto al inicio de cada test para arrancar "limpio".
Cypress.Commands.add('resetearFlagsTest', () => {
  errorYaRegistrado = false;
  resultadoYaRegistrado = false; // Importante: así no duplico registros
});

// Me sirve para consultar desde un test si ya grabé el resultado.
Cypress.Commands.add('estaRegistrado', () => {
  return cy.wrap(resultadoYaRegistrado);
});

// ===== LOGIN =====
// Hago login con sesión cacheada por defecto (useSession = true).
// Dejo valores por defecto para no repetirlos en cada llamada.
Cypress.Commands.add('login', ({
  email = Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app',
  password = Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025',
  useSession = true,
  rememberMe = false
} = {}) => {

  // Encapsulo el flujo real de login para reutilizarlo dentro o fuera de cy.session.
  const performLogin = () => {
    // Voy directo al login (con timeout generoso por si tarda en cargar).
    cy.visit('/login', {
      timeout: 120000,
      waitUntil: 'domcontentloaded'
    });

    // Helper seguro: siempre limpio antes de escribir y respeto valores vacíos.
    const safeType = (selector, value) => {
      cy.get(selector).clear();
      if (value !== '') {
        cy.get(selector).type(value);
      }
    };

    // Relleno las credenciales/campos para Control Horario.
    // Buscar por placeholder o tipo de input para email
    safeType('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]', email);
    safeType('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', password);

    // Si se solicita "Recordarme", marcar el checkbox
    if (rememberMe) {
      cy.get('input[type="checkbox"], .checkbox, [data-testid="remember-me"]').check();
    }

    // Envío el formulario - buscar botón "Entrar" o submit
    cy.get('button[type="submit"], button:contains("Entrar"), input[type="submit"]').click();
  };

  if (useSession) {
    // Uso cy.session para cachear sesión por combinación de credenciales.
    cy.session(
      ['usuario-activo', email, password],
      () => {
        performLogin();
        // Valido que verdaderamente estoy dentro.
        cy.url({ timeout: 20000 }).should('include', '/panelinterno');
        cy.get('header, .MuiToolbar-root, .dashboard-container').should('exist');
      }
    );
    // Siempre aterrizo en /panelinterno para empezar los tests en una pantalla conocida.
    cy.visit('/panelinterno');
  } else {
    // Si no quiero sesión cacheada, hago el login "a pelo".
    performLogin();
  }
});

// ===== NAVEGACIÓN MENÚ =====
// Abro el drawer y navego por texto de menú y submenú.
// Me apoyo en scrollIntoView y expects explícitos para estabilidad.
Cypress.Commands.add('navegarAMenu', (textoMenu, textoSubmenu) => {
  cy.get('button[aria-label="open drawer"]', { timeout: 10000 }).should('exist').click();
  cy.get('.MuiDrawer-root', { timeout: 10000 }).should('exist');

  cy.get('.MuiDrawer-root')
    .contains('span', textoMenu, { timeout: 10000 })
    .scrollIntoView()
    .should('exist')
    .closest('div[role="button"]')
    .click();

  cy.get('.MuiDrawer-root')
    .contains('span', textoSubmenu, { timeout: 10000 })
    .scrollIntoView()
    .should('exist')
    .click();
});

// ===== ACUMULADOR POR PANTALLA =====
// Durante un describe/grupo de casos de una misma pantalla, voy guardando
// cada resultado en memoria. Luego, al final, genero un resumen "global".
Cypress.Commands.add('agregarResultadoPantalla', (params) => {
  const {
    numero, nombre, esperado, obtenido, resultado, pantalla,
    fechaHora = new Date().toLocaleString('sv-SE').replace('T', ' '),
    observacion
  } = params;

  if (!resultadosPorPantalla[pantalla]) {
    resultadosPorPantalla[pantalla] = { resultados: [], fechaHora };
  }

  resultadosPorPantalla[pantalla].resultados.push({
    numero, nombre, esperado, obtenido, resultado, fechaHora, observacion
  });
});

// ===== PROCESAR RESUMEN DE UNA PANTALLA =====
// Al terminar los casos de una pantalla, llamo a esto para:
// 1) Volcar logs detallados (OK/ERROR/WARNING por TC)
// 2) Escribir un resumen final de la pantalla en el Excel principal
Cypress.Commands.add('procesarResultadosPantalla', (pantalla) => {
  if (!resultadosPorPantalla[pantalla] || resultadosPorPantalla[pantalla].resultados.length === 0) return;

  const { resultados } = resultadosPorPantalla[pantalla];
  const errores = resultados.filter(r => r.resultado === 'ERROR');
  const warnings = resultados.filter(r => r.resultado === 'WARNING');
  const oks = resultados.filter(r => r.resultado === 'OK');

  // Genero un ID único con timestamp para identificar esta ejecución-resumen.
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0') +
    now.getHours().toString().padStart(2, '0') +
    now.getMinutes().toString().padStart(2, '0') +
    now.getSeconds().toString().padStart(2, '0') +
    now.getMilliseconds().toString().padStart(3, '0');

  // Quito acentos/ñ y dejo un slug ASCII cómodo para el ID.
  const slugifyAscii = (str) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/ñ/gi, 'n').replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-').replace(/-$/g, '').replace(/^-/, '');

  const testId = `${slugifyAscii(pantalla)}_${timestamp}`;

  // Formateo fecha/hora legible (YYYY-MM-DD HH:mm:ss).
  const fechaHoraFormateada =
    now.getFullYear() + '-' +
    String(now.getMonth() + 1).padStart(2, '0') + '-' +
    String(now.getDate()).padStart(2, '0') + ' ' +
    String(now.getHours()).padStart(2, '0') + ':' +
    String(now.getMinutes()).padStart(2, '0') + ':' +
    String(now.getSeconds()).padStart(2, '0');

  // --- LOG DETALLADO POR CASO ---
  // Para cada resultado (OK/ERROR/WARNING), dejo una traza en el log.
  // IMPORTANTE: Ejecutamos secuencialmente con delay para evitar exceder límites de API
  const todosLosResultados = [...oks, ...errores, ...warnings];
  
  let chain = cy.wrap(null);
  todosLosResultados.forEach((resultado, index) => {
    chain = chain.then(() => {
      return cy.task('guardarEnLog', {
        testId: testId,
        test: pantalla,
        paso: `TC${String(resultado.numero).padStart(3, '0')}`,
        fechaHora: fechaHoraFormateada,
        resultado: resultado.resultado,
        nombre: resultado.nombre,
        esperado: resultado.esperado,
        obtenido: resultado.obtenido,
        observacion: resultado.observacion || ''
      }).then(() => {
        // Delay de 1.5 segundos entre cada llamada para respetar límite de API (1 req/min)
        if (index < todosLosResultados.length - 1) {
          return cy.wait(1500);
        }
      });
    });
  });

  // --- RESULTADO FINAL DE LA PANTALLA ---
  // Si hay algún ERROR, mando ERROR; si no, WARNING si hubo avisos; si no, OK.
  const resultadoFinal = errores.length > 0 ? 'ERROR' : (warnings.length > 0 ? 'WARNING' : 'OK');

  // --- RESUMEN EN EXCEL PRINCIPAL ---
  // Escribo una fila en "Resultados Pruebas" con los totales por pantalla.
  cy.task('guardarEnExcel', {
    numero: testId,
    nombre: fechaHoraFormateada,
    esperado: pantalla,
    obtenido: `Pruebas de ${pantalla}`,
    resultado: resultadoFinal,
    fechaHora: fechaHoraFormateada,
    archivo: 'reportes_pruebas_control_horario.xlsx',
    pantalla: 'Resultados Pruebas',
    ok: oks.length.toString(),
    warning: warnings.length.toString(),
    error: errores.length.toString()
  });

  // Limpio el acumulador de esta pantalla (ya procesado).
  delete resultadosPorPantalla[pantalla];
});

// ===== REGISTRAR RESULTADOS (único por test) =====
// Este es el registro "normal" por test. Solo grabo una vez por caso.
// Si me pasan 'pantalla', además lo acumulo para el resumen posterior.
Cypress.Commands.add('registrarResultados', (params) => {
  const {
    numero, nombre, esperado, obtenido, resultado: resultadoManual,
    archivo = 'reportes_pruebas_control_horario.xlsx',
    fechaHora = new Date().toLocaleString('sv-SE').replace('T', ' '),
    pantalla, observacion
  } = params;

  // Evito grabar dos veces en el mismo test.
  if (resultadoYaRegistrado) return;

  const obtenidoTexto = obtenido?.toString().toLowerCase();
  let resultadoFinal = resultadoManual;

  // Si no fuerzo el resultado, lo infiero:
  // - Igual a lo esperado => OK
  // - Mensajes típicos de "sin datos" => WARNING
  // - En otro caso => ERROR
  if (!resultadoFinal) {
    if (esperado === obtenido) {
      resultadoFinal = 'OK';
    } else if (
      obtenidoTexto?.includes('no hay datos') ||
      obtenidoTexto?.includes('tabla vacía') ||
      obtenidoTexto?.includes('sin resultados') ||
      obtenidoTexto?.includes('no se encontraron') ||
      obtenidoTexto?.includes('no existen') ||
      obtenidoTexto?.includes('vacío') ||
      obtenidoTexto?.includes('sin coincidencias')
    ) {
      resultadoFinal = 'WARNING';
    } else {
      resultadoFinal = 'ERROR';
    }
  }

  // Si estoy dentro de un bloque por pantalla, acumulo en memoria;
  // si no, escribo directo al Excel.
  if (pantalla) {
    cy.agregarResultadoPantalla({
      numero, nombre, esperado, obtenido, resultado: resultadoFinal,
      pantalla, fechaHora, observacion
    });
  } else {
    cy.task('guardarEnExcel', {
      numero, nombre, esperado, obtenido, resultado: resultadoFinal,
      fechaHora, archivo, pantalla, observacion
    });
  }

  // Marco que ya registré resultado para este test.
  resultadoYaRegistrado = true;
});

// ===== CAPTURA DE ERRORES =====
// Centralizo la forma de capturar errores: registro, screenshot,
// clasificación WARNING/ERROR (según "sin datos"), y re-lanzo si es ERROR.
Cypress.Commands.add('capturarError', (contexto, error, data = {}) => {
  const fechaHora = data.fechaHora || new Date().toLocaleString('sv-SE').replace('T', ' ');
  const mensaje = error.message || error;
  const obtenidoTexto = mensaje?.toString().toLowerCase();

  // Si el error es "sin datos", lo trato como WARNING; si no, ERROR.
  const resultadoFinal = (
    obtenidoTexto?.includes('no hay datos') ||
    obtenidoTexto?.includes('tabla vacía') ||
    obtenidoTexto?.includes('sin resultados') ||
    obtenidoTexto?.includes('no se encontraron') ||
    obtenidoTexto?.includes('no existen') ||
    obtenidoTexto?.includes('vacío') ||
    obtenidoTexto?.includes('sin coincidencias')
  ) ? 'WARNING' : 'ERROR';

  // Armo el payload estándar para el Excel/log.
  const registro = {
    numero: data.numero || '',
    nombre: data.nombre || contexto,
    esperado: data.esperado || '',
    obtenido: data.obtenido || mensaje,
    resultado: resultadoFinal,
    fechaHora,
    archivo: data.archivo || 'reportes_pruebas_control_horario.xlsx',
    pantalla: data.pantalla || '',
    observacion: data.observacion || ''
  };

  // Igual que en registrarResultados: si estoy en modo "pantalla", acumulo.
  if (data.pantalla) {
    cy.agregarResultadoPantalla(registro);
  } else {
    cy.task('guardarEnExcel', registro);
  }

  // Marco flags para que no se grabe un OK automático después.
  errorYaRegistrado = true;
  resultadoYaRegistrado = true;

  // Siempre dejo una captura con contexto y timestamp.
  cy.screenshot(`error-${contexto}-${fechaHora.replace(/[: ]/g, '-')}`);

  // Re-lanzo el error si es ERROR (para que el test falle).
  if (resultadoFinal === 'ERROR') {
    throw error;
  }
});