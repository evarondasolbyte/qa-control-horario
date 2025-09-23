// Inicio de la suite de pruebas de login con gestión de errores y reporte automático a Excel
describe('LOGIN - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';

  const casos = [
    { numero: 1, nombre: 'TC001 - Login con credenciales válidas', funcion: loginCredencialesValidas, prioridad: 'ALTA' },
    { numero: 2, nombre: 'TC002 - Correo electrónico incorrecto', funcion: loginEmailIncorrecto, prioridad: 'ALTA' },
    { numero: 3, nombre: 'TC003 - Contraseña incorrecta', funcion: loginPasswordIncorrecta, prioridad: 'ALTA' },
    { numero: 4, nombre: 'TC004 - Correo electrónico y contraseña incorrectos', funcion: loginCredencialesIncorrectas, prioridad: 'ALTA' },
    { numero: 5, nombre: 'TC005 - Pulsar "Recordarme" con credenciales válidas', funcion: loginConRecordarme, prioridad: 'MEDIA' },
    { numero: 6, nombre: 'TC006 - Correo electrónico vacío', funcion: loginEmailVacio, prioridad: 'ALTA' },
    { numero: 7, nombre: 'TC007 - Contraseña vacía', funcion: loginPasswordVacia, prioridad: 'ALTA' },
    { numero: 8, nombre: 'TC008 - Correo electrónico y contraseña vacías', funcion: loginCredencialesVacias, prioridad: 'ALTA' },
    { numero: 9, nombre: 'TC009 - Pulsar "Salir" al iniciar sesión', funcion: logoutNormal, prioridad: 'MEDIA' },
    { numero: 10, nombre: 'TC010 - Pulsar "Salir" al iniciar sesión desde el otro botón', funcion: logoutDesdeMenu, prioridad: 'MEDIA' },
    { numero: 11, nombre: 'TC011 - Al loguearte, pulsar "A modo claro"', funcion: cambiarModoClaro, prioridad: 'MEDIA' },
    { numero: 12, nombre: 'TC012 - Al loguearte, pulsar "A modo oscuro"', funcion: cambiarModoOscuro, prioridad: 'MEDIA' },
    { numero: 13, nombre: 'TC013 - Al loguearte, pulsar "A modo del sistema"', funcion: cambiarModoSistema, prioridad: 'MEDIA' }
  ];

  // Filtrar casos por prioridad si se especifica
  const prioridadFiltro = Cypress.env('prioridad');
  const casosFiltrados = prioridadFiltro && prioridadFiltro !== 'todas'
    ? casos.filter(caso => caso.prioridad === prioridadFiltro.toUpperCase())
    : casos;

  casosFiltrados.forEach(({ numero, nombre, funcion, prioridad }) => {
    it(`${nombre} [${prioridad}]`, () => {
      // Esperar entre tests para evitar "demasiados intentos"
      if (numero > 1) {
        cy.wait(2000);
      }
      //usar el helper correcto (mismo patrón que en "Otros Gastos")
      cy.resetearFlagsTest();

      // Captura de errores y registro
      cy.on('fail', (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Login'
        });
        return false;
      });

      // Ignorar errores de JavaScript de la aplicación
      cy.on('uncaught:exception', (err, runnable) => {
        // Ignorar errores de Livewire que interfieren con el guardado
        if (err.message.includes('Component already registered') ||
          err.message.includes('Snapshot missing on Livewire component') ||
          err.message.includes('Component already initialized')) {
          return false;
        }
        // Para otros errores, permitir que falle
        return true;
      });

      // Ejecuta el caso y sólo auto-OK si nadie registró antes
      return funcion().then(() => {
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
              pantalla: 'Login'
            });
          }
        });
      });
    });
  });


  // Helper: abre el menú de usuario y espera al panel
  function abrirMenuUsuario() {
    // El botón real tiene aria-label="Menú del Usuario" y dentro un <img.fi-user-avatar>
    return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 10000 })
      .then($el => $el.is('img') ? cy.wrap($el).closest('button') : cy.wrap($el))
      .then($btn => {
        cy.wrap($btn).scrollIntoView().click({ force: true });
        // El panel se teletransporta al body; esperamos a que SE MONTE (existir), no a que sea visible.
        return cy.get('.fi-dropdown-panel', { timeout: 10000 }).should('exist');
      });
  }

  // === FUNCIONES DE VALIDACIÓN ===

  function loginCredencialesValidas() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
    cy.wait(3000);
    cy.url().should('include', '/panelinterno');
    return cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 8000 }).should('exist');
  }

  function loginEmailIncorrecto() {
    cy.login({ email: 'admin@novatrans.app', password: 'solbyte', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function loginPasswordIncorrecta() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte@2025', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function loginCredencialesIncorrectas() {
    cy.login({ email: 'admin@novatrans.app', password: 'sol', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function loginConRecordarme() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', rememberMe: true, useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/panelinterno');
  }

  function loginEmailVacio() {
    cy.login({ email: '', password: 'solbyte', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function loginPasswordVacia() {
    cy.login({ email: 'superadmin@novatrans.app', password: '', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function loginCredencialesVacias() {
    cy.login({ email: '', password: '', useSession: false });
    cy.wait(500);
    return cy.url().should('include', '/login');
  }

  function logoutNormal() {
    cy.wait(30000); // Esperar 30 segundos antes de introducir credenciales
    cy.visit('/login');
    cy.get('input[type="email"], input[placeholder*="Correo"], input[placeholder*="email"]').clear().type('superadmin@novatrans.app');
    cy.get('input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type('solbyte');
    cy.get('button[type="submit"], button:contains("Entrar"), input[type="submit"]').click();
    cy.wait(5000); // Tiempo para que cargue completamente
    // Buscar botón de logout/salir con manejo de errores
    cy.get('button:contains("Salir")').first().click({ force: true });
    cy.wait(2000); // Más tiempo para el logout
    return cy.url().should('include', '/login');
  }

  function logoutDesdeMenu() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
    cy.url().should('include', '/panelinterno');

    return abrirMenuUsuario()
      .within(() => {
        cy.get('form[action*="/logout"] button[type="submit"]', { timeout: 10000 })
          .should('exist')
          .click({ force: true });
      })
      .then(() => cy.url({ timeout: 15000 }).should('include', '/login'));
  }

  function cambiarModoClaro() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
    cy.url().should('include', '/panelinterno');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo claro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('light');
      return cy.url().should('include', '/panelinterno');
    });
  }

  function cambiarModoOscuro() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
    cy.url().should('include', '/panelinterno');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo oscuro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('dark');
      return cy.url().should('include', '/panelinterno');
    });
  }

  function cambiarModoSistema() {
    cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
    cy.url().should('include', '/panelinterno');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo del sistema"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('system');
      return cy.url().should('include', '/panelinterno');
    });
  }
});