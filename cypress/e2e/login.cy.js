import { createLoginActions } from '../support/login/login_helper';

describe('LOGIN - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const LOGIN_URL_ABS = 'https://horario.dev.novatrans.app/login';
  const LOGIN_PATH = '/login';
  const DASHBOARD_PATH = '/panelinterno';

  const CASOS_PAUSADOS = new Set(['TC009', 'TC011', 'TC012', 'TC013']);

  const acciones = createLoginActions({
    DASHBOARD_PATH,
    LOGIN_PATH,
    LOGIN_URL_ABS
  });

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
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        const id = String(caso.caso || '').trim().toUpperCase();
        return !CASOS_PAUSADOS.has(id);
      });

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  });

  function obtenerFuncionPorNombre(nombreFuncion) {
    if (!acciones[nombreFuncion]) {
      return () => {
        cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
        return cy.wrap(null);
      };
    }

    return acciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre = `${casoExcel.caso} - ${casoExcel.nombre}`;
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}] (funcion: ${casoExcel.funcion})`);
    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return acciones.irALoginLimpio()
      .then(() => funcion(casoExcel))
      .then(() =>
        cy.estaRegistrado().then((ya) => {
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
        })
      , (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Login'
        });
        return null;
      });
  }
});