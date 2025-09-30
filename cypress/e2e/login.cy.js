// Inicio de la suite de pruebas de login con gestión de errores y reporte automático a Excel
describe('LOGIN - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const LOGIN_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/login';
  const LOGIN_PATH = '/panelinterno/login';
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
    cy.procesarResultadosPantalla('Login');
  });

  it('Ejecutar todos los casos de Login desde Google Sheets', () => {
    cy.obtenerDatosExcel('Login').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Login`);

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

  // === Helper: siempre dejar el estado en la pantalla de login absoluta y estable ===
  function irALoginLimpio() {
    cy.clearCookies({ log: false });
    cy.clearLocalStorage({ log: false });
    cy.window({ log: false }).then(w => { try { w.sessionStorage?.clear(); } catch (_) {} });

    cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
    // Validamos por URL (no pathname estricto) y esperamos a que aparezca el input de email
    cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
    return cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]', { timeout: 15000 })
      .should('exist');
  }

  // === Helper: click robusto del botón "Salir" en dashboard (varios selectores) ===
  function clickBotonSalir() {
    return cy.get('body').then($body => {
      // 1) Botón de un form /logout
      const selForm = 'form[action*="/logout"] button[type="submit"]';
      if ($body.find(selForm).length) {
        cy.log('🔎 Encontrado botón Salir vía form[action*="/logout"]');
        return cy.get(selForm).scrollIntoView().click({ force: true });
      }

      // 2) Cualquier button/a/[role=button] cuyo texto contenga "Salir"
      const textoSalir = /Salir/i;
      const $btnText = $body.find('button, a, [role="button"]').filter((_, el) => textoSalir.test(el.innerText || ''));
      if ($btnText.length) {
        cy.log('🔎 Encontrado botón Salir por texto visible');
        return cy.wrap($btnText.eq(0)).scrollIntoView().click({ force: true });
      }

      // 3) Fallback: en algunos temas el botón está en un header lateral
      cy.log('⚠️ Botón Salir no visible directo, intento alternativo por contains');
      return cy.contains('button, a, [role="button"]', textoSalir, { timeout: 3000 })
        .scrollIntoView()
        .click({ force: true });
    });
  }

  // === Ejecuta 1 caso: SIEMPRE arranca desde /panelinterno/login ===
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre  = `${casoExcel.caso} - ${casoExcel.nombre}`;
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`▶️ ${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}] (función: ${casoExcel.funcion})`);
    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irALoginLimpio()
      .then(() => {
        return funcion(casoExcel);
      })
      .then(() => {
        return cy.estaRegistrado().then((ya) => {
          if (!ya) {
            cy.registrarResultados({
              numero,
              nombre,
              esperado: 'Comportamiento correcto',
              obtenido: 'Comportamiento correcto',
              resultado: 'OK',
              archivo,
              pantalla: 'Login'
            });
          }
        });
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Login'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === MAPEO DE FUNCIONES ===
  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      'loginGenerico': loginGenerico,
      'loginCredencialesValidas': loginGenerico,
      'loginEmailIncorrecto': loginGenerico,
      'loginPasswordIncorrecto': loginGenerico,
      'loginCredencialesIncorrectas': loginGenerico,
      'loginConRecordarme': loginConRecordarme,
      'loginEmailVacio': loginGenerico,
      'loginPasswordVacia': loginGenerico,
      'loginCredencialesVacias': loginGenerico,
      'logoutNormal': logoutNormal,        // ← TC009
      'logoutDesdeMenu': logoutDesdeMenu,
      'cambiarModoClaro': cambiarModoClaro,
      'cambiarModoOscuro': cambiarModoOscuro,
      'cambiarModoSistema': cambiarModoSistema
    };

    if (!funciones[nombreFuncion]) {
      return () => {
        cy.log(`⚠️ Función no encontrada en mapping: "${nombreFuncion}"`);
        return cy.wrap(null);
      };
    }
    return funciones[nombreFuncion];
  }

  // Helper: abre el menú de usuario y espera al panel
  function abrirMenuUsuario() {
    return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 10000 })
      .then($el => $el.is('img') ? cy.wrap($el).closest('button') : cy.wrap($el))
      .then($btn => {
        cy.wrap($btn).scrollIntoView().click({ force: true });
        return cy.get('.fi-dropdown-panel', { timeout: 10000 }).should('exist');
      });
  }

  // === FUNCIONES DE VALIDACIÓN ===

  // Casos de login (positivos/negativos). SIEMPRE se llama tras irALoginLimpio()
  function loginGenerico(casoExcel) {
    const email = casoExcel.dato_1;
    const password = casoExcel.dato_2;
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} - Email: ${email}`);

    // Escribimos solo si hay valor (para los casos de vacío, no llamamos .type(''))
    if (email) {
      cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]', { timeout: 10000 })
        .clear().type(email);
    } else {
      cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]', { timeout: 10000 })
        .clear();
    }

    if (password) {
      cy.get('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
        .clear().type(password);
    } else {
      cy.get('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
        .clear();
    }

    cy.get('button[type="submit"], input[type="submit"]').click();

    if (numero === 1 || /credenciales válidas/i.test(casoExcel.nombre || '')) {
      cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
      return cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 10000 }).should('exist');
    } else {
      // Debe permanecer en la pantalla de login
      cy.wait(300);
      return cy.url().should('include', LOGIN_PATH);
    }
  }

  function loginConRecordarme(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]', { timeout: 10000 })
      .clear().type(email);
    cy.get('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
      .clear().type(password);

    // Marca "Recordarme" si existe
    cy.get('input[type="checkbox"], [role="checkbox"]', { timeout: 3000 })
      .first()
      .check({ force: true })
      .should('be.checked');

    cy.get('button[type="submit"], input[type="submit"]').click();
    return cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
  }

  // TC009 — Espera 30s antes de loguear y luego pulsa "Salir"
  function logoutNormal(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (con espera de 30s antes del login)`);

    // ⏳ Requisito de la app: esperar 30 segundos antes de introducir credenciales
    cy.wait(40000);

    // Autenticación
    cy.get('input[type="email"]', { timeout: 10000 }).clear().type(email);
    cy.get('input[type="password"]', { timeout: 10000 }).clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();

    // Asegurar que estamos en el dashboard
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 10000 }).should('exist');

    // Pulsar botón Salir (robusto)
    return clickBotonSalir()
      .then(() => cy.url({ timeout: 20000 }).should('include', LOGIN_PATH));
  }

  function logoutDesdeMenu(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    cy.get('input[type="email"]').clear().type(email);
    cy.get('input[type="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);

    return abrirMenuUsuario()
      .within(() => {
        cy.get('form[action*="/logout"] button[type="submit"]', { timeout: 10000 })
          .should('exist')
          .click({ force: true });
      })
      .then(() => cy.url({ timeout: 15000 }).should('include', LOGIN_PATH));
  }

  function cambiarModoClaro(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input[type="email"]').clear().type(email);
    cy.get('input[type="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo claro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('light');
      return cy.url().should('include', DASHBOARD_PATH);
    });
  }

  function cambiarModoOscuro(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input[type="email"]').clear().type(email);
    cy.get('input[type="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo oscuro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('dark');
      return cy.url().should('include', DASHBOARD_PATH);
    });
  }

  function cambiarModoSistema(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input[type="email"]').clear().type(email);
    cy.get('input[type="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo del sistema"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('system');
      return cy.url().should('include', DASHBOARD_PATH);
    });
  }
});