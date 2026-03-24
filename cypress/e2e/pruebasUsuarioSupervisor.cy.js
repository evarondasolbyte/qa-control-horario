import { createPruebasUsuarioSupervisorActions } from '../support/usuario_supervisor/pruebasUsuarioSupervisor_helper';
import { getAppBaseUrl } from '../support/appUrls';

describe('PRUEBAS USUARIO SUPERVISOR - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = getAppBaseUrl();
  const DASHBOARD_PATH = '/panelinterno';
  const LOGIN_PATH = '/login';

  const SUPERVISOR_EMAIL = Cypress.env('SUPERVISOR_EMAIL') || 'supervisor@supervisor.app';
  const SUPERVISOR_PASSWORD = Cypress.env('SUPERVISOR_PASSWORD') || 'novatranshorario@2025';

  const CASOS_PAUSADOS = new Set([
    'TC027' // *siempre comentado*
  ]);

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Pruebas Usuario Supervisor'
    });
  }

  const supervisorActions = createPruebasUsuarioSupervisorActions({
    SUPERVISOR_EMAIL,
    SUPERVISOR_PASSWORD,
    BASE_URL,
    DASHBOARD_PATH,
    LOGIN_PATH,
    registrarResultado
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
    cy.procesarResultadosPantalla('Pruebas Usuario Supervisor');
  });

  it('Ejecutar todos los casos de Pruebas Usuario Supervisor desde Google Sheets', () => {
    supervisorActions.loginSupervisor().then(() =>
      cy.obtenerDatosExcel('PruebasUsuarioSupervisor').then((casosExcel) => {
        cy.log(`Cargados ${casosExcel.length} casos desde Excel para Pruebas Usuario Supervisor`);

        const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
        let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
          ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
          : casosExcel;

        casosFiltrados = casosFiltrados.filter((casoExcel) => {
          let casoId = String(casoExcel.caso || '').trim().toUpperCase();
          const match = casoId.match(/(\d+)/);
          if (match) casoId = `TC${match[1].padStart(3, '0')}`;
          return !CASOS_PAUSADOS.has(casoId);
        });

        let chain = cy.wrap(null);
        casosFiltrados.forEach((casoExcel, idx) => {
          chain = chain.then(() => ejecutarCaso(casoExcel, idx));
        });

        return chain;
      })
    );
  });

  function ejecutarCaso(casoExcel, idx) {
    const matchNum = String(casoExcel.caso || '').match(/(\d+)/);
    const numero = matchNum ? parseInt(matchNum[1], 10) : (idx + 1);
    const casoId = `TC${String(numero).padStart(3, '0')}`;
    const casoPreparado = {
      ...casoExcel,
      caso: casoId
    };

    const nombre = `${casoId} - ${casoPreparado.nombre}`;
    const funcion = supervisorActions.obtenerFuncionPorNombre(casoPreparado.funcion || casoId);

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoPreparado.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoPreparado.funcion}"`);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return cy.wrap(null)
      .then(() => {
        const resultado = funcion(casoPreparado);
        if (resultado && typeof resultado.then === 'function') return resultado;
        return cy.wrap(null);
      })
      .then(() => supervisorActions.verificarError500(casoPreparado, numero, nombre))
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (ya) return null;

        registrarResultado(
          casoId,
          nombre,
          casoPreparado.resultado_esperado || 'Comportamiento correcto',
          casoPreparado.resultado_obtenido || 'Comportamiento correcto',
          casoPreparado.resultado || 'OK'
        );

        return null;
      }, (err) => {
        if (err?.message?.includes('Error 500 detectado')) return null;

        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: casoPreparado.resultado_esperado || 'Comportamiento correcto',
          archivo,
          pantalla: 'Pruebas Usuario Supervisor'
        });

        return null;
      });
  }
});
