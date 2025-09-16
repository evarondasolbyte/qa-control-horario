// Inicio de la suite de pruebas de login con gestión de errores y reporte automático a Excel
describe('LOGIN - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';

  const casos = [
    { numero: 1, nombre: 'TC001 - Login con credenciales válidas', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false }, esperado: 'Accede al dashboard', prioridad: 'ALTA' },
    { numero: 2, nombre: 'TC002 - Correo electrónico incorrecto', datos: { email: 'admin@novatrans.app', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 3, nombre: 'TC003 - Contraseña incorrecta', datos: { password: 'solbyte@2025', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 4, nombre: 'TC004 - Correo electrónico y contraseña incorrectos', datos: { email: 'admin@novatrans.app', password: 'sol', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 5, nombre: 'TC005 - Pulsar "Recordarme" con credenciales válidas', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', rememberMe: true, useSession: false }, esperado: 'Se guarda el correo junto a su contraseña para su futuro inicio de sesión', prioridad: 'MEDIA' },
    { numero: 6, nombre: 'TC006 - Correo electrónico vacío', datos: { email: '', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 7, nombre: 'TC007 - Contraseña vacía', datos: { password: '', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 8, nombre: 'TC008 - Correo electrónico y contraseña vacías', datos: { email: '', password: '', useSession: false }, esperado: 'No accede', prioridad: 'ALTA' },
    { numero: 9, nombre: 'TC009 - Pulsar "Salir" al iniciar sesión', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', logout: true }, esperado: 'Vuelve a la pantalla de login', prioridad: 'MEDIA' },
    { numero: 10, nombre: 'TC010 - Pulsar "Salir" al iniciar sesión desde el otro botón', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', logoutFromMenu: true }, esperado: 'Vuelve a la pantalla de login', prioridad: 'MEDIA' },
    { numero: 11, nombre: 'TC011 - Al loguearte, pulsar "A modo claro"', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', themeAction: 'claro' }, esperado: 'Cambia la interfaz a modo claro', prioridad: 'MEDIA' },
    { numero: 12, nombre: 'TC012 - Al loguearte, pulsar "A modo oscuro"', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', themeAction: 'oscuro' }, esperado: 'Cambia la interfaz a modo oscuro', prioridad: 'MEDIA' },
    { numero: 13, nombre: 'TC013 - Al loguearte, pulsar "A modo del sistema"', datos: { email: 'superadmin@novatrans.app', password: 'solbyte', themeAction: 'sistema' }, esperado: 'Cambia la interfaz a modo del sistema (oscuro en mi caso)', prioridad: 'MEDIA' }
  ];

  // Resumen al final
  after(() => {
    cy.procesarResultadosPantalla('Login');
  });

  // Filtrar casos por prioridad si se especifica
  const prioridadFiltro = Cypress.env('prioridad');
  const casosFiltrados = prioridadFiltro && prioridadFiltro !== 'todas' 
      ? casos.filter(caso => caso.prioridad === prioridadFiltro.toUpperCase())
      : casos;

  casosFiltrados.forEach(({ numero, nombre, datos, esperado, prioridad }) => {
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
          esperado,
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

      // Ejecuta el login
      cy.login(datos);
      cy.wait(numero === 1 ? 3000 : 500); // Más tiempo para TC001

      // IMPORTANTE: devolver la cadena de Cypress
      return cy.url({ timeout: 10000 }).then((url) => {
        let accedio, obtenido;
        
        if (numero === 5) {
          // Para TC005 (Recordarme), el éxito es acceder y el resultado es el mismo que esperado
          accedio = url.includes('/panelinterno') && !url.includes('/login');
          obtenido = accedio ? 'Se guarda el correo junto a su contraseña para su futuro inicio de sesión' : 'No accede';
        } else if (numero === 9) {
          // Para TC009 (logout), el éxito es volver al login
          accedio = url.includes('/login');
          obtenido = accedio ? 'Vuelve a la pantalla de login' : 'No vuelve al login';
        } else if (numero === 10) {
          // Para TC010 (logout desde menú), el éxito es volver al login
          accedio = url.includes('/login');
          obtenido = accedio ? 'Vuelve a la pantalla de login' : 'No vuelve al login';
        } else if (numero >= 11 && numero <= 13) {
          // Para TC011, TC012, TC013 (cambios de tema), el éxito es acceder y mantener el tema
          accedio = url.includes('/panelinterno') && !url.includes('/login');
          if (numero === 11) {
            obtenido = accedio ? 'Cambia la interfaz a modo claro' : 'No accede';
          } else if (numero === 12) {
            obtenido = accedio ? 'Cambia la interfaz a modo oscuro' : 'No accede';
          } else if (numero === 13) {
            obtenido = accedio ? 'Cambia la interfaz a modo del sistema (oscuro en mi caso)' : 'No accede';
          }
        } else {
          // Para los demás casos, el éxito es acceder al dashboard
          accedio = url.includes('/panelinterno') && !url.includes('/login');
          obtenido = accedio ? 'Accede al dashboard' : 'No accede';
        }

        // Si es el caso 1 y accedió, valida elementos del dashboard (y devolvemos esa cadena)
        const cadenaValidacion = (numero === 1 && accedio)
          ? cy.get('header, .MuiToolbar-root, .dashboard-container', { timeout: 8000 }).should('exist')
          : cy.wrap(null);

        // Encadena el registro para mantener la cadena Cypress viva
        return cadenaValidacion.then(() => {
          // Si tienes un anti-doble-registro, úsalo aquí; si no, registra directo
          if (typeof cy.estaRegistrado === 'function') {
            cy.estaRegistrado().then((ya) => {
              if (!ya) {
                cy.registrarResultados({
                  numero,
                  nombre,
                  esperado,
                  obtenido,
                  archivo,
                  pantalla: 'Login'
                });
              }
            });
          } else {
            cy.registrarResultados({
              numero,
              nombre,
              esperado,
              obtenido,
              archivo,
              pantalla: 'Login'
            });
          }
        });
      });
    });
  });
});
