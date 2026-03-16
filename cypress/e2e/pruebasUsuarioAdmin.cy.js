import { createPruebasUsuarioAdminActions } from '../support/usuario_admin/pruebasUsuarioAdmin_helper';

describe('PRUEBAS USUARIO ADMIN - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = 'https://horario.dev.novatrans.app';
  const DASHBOARD_PATH = '/panelinterno';
  const LOGIN_PATH = '/login';

  const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL') || 'admin@admin.app';
  const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD') || 'novatranshorario@2025';

  const CASOS_PAUSADOS = new Set([
    'TC001',
    'TC002',
    'TC003',
    'TC004',
    'TC005',
    'TC006',
    'TC007',
    'TC008',
    'TC009',
    'TC010',
    'TC011',
    'TC012',
    'TC013',
    'TC014',
    'TC015',
    'TC016',
    'TC017',
    'TC018'
  ]);

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Pruebas Usuario Admin'
    });
  }

  const adminActions = createPruebasUsuarioAdminActions({
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
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
    cy.procesarResultadosPantalla('Pruebas Usuario Admin');
  });

  it('Ejecutar todos los casos de Pruebas Usuario Admin desde Google Sheets', () => {
    adminActions.loginAdmin().then(() =>
      cy.obtenerDatosExcel('PruebasUsuarioAdmin').then((casosExcel) => {
        cy.log(`Cargados ${casosExcel.length} casos desde Excel para Pruebas Usuario Admin`);

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
    const casoPreparado = adminActions.normalizarCasoExcelAdmin({
      ...casoExcel,
      caso: casoId
    });

    const nombre = `${casoId} - ${casoPreparado.nombre}`;
    const funcion = adminActions.obtenerFuncionPorNombre(casoPreparado.funcion || casoId);

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
      .then(() => adminActions.verificarError500(casoPreparado, numero, nombre))
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
          pantalla: 'Pruebas Usuario Admin'
        });

        return null;
      });
  }
});
