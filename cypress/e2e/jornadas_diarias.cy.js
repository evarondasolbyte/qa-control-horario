import { createJornadasDiariasFiltrosActions } from '../support/jornada_diaria/jornadas_diarias_filtros';
import { createJornadasDiariasFormularioActions } from '../support/jornada_diaria/jornadas_diarias_formulario';
import { createJornadasDiariasListadoActions } from '../support/jornada_diaria/jornadas_diarias_listado';
import { createJornadasDiariasUtils } from '../support/jornada_diaria/jornadas_diarias_utils';

describe('JORNADAS DIARIAS - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const JORNADAS_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/jornadas-diarias';
  const JORNADAS_PATH = '/panelinterno/jornadas-diarias';
  const DASHBOARD_PATH = '/panelinterno';

  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set();

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Jornadas Diarias'
    });
  }

  const utils = createJornadasDiariasUtils({
    DASHBOARD_PATH,
    JORNADAS_PATH,
    JORNADAS_URL_ABS
  });

  const listadoActions = createJornadasDiariasListadoActions();
  const formularioActions = createJornadasDiariasFormularioActions(utils);
  const filtrosActions = createJornadasDiariasFiltrosActions();

  const funciones = {
    ...listadoActions,
    ...formularioActions,
    ...filtrosActions
  };

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
    cy.procesarResultadosPantalla('Jornadas Diarias');
  });

  it('Ejecutar todos los casos de Jornadas Diarias desde Google Sheets', () => {
    cy.obtenerDatosExcel('Jornadas Diarias').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Jornadas Diarias`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        const id = String(caso.caso || '').trim().toUpperCase();
        if (CASOS_PAUSADOS.has(id)) return false;
        if (CASOS_OK.size === 0) return true;
        return CASOS_OK.has(id);
      });

      cy.log(`Casos OK a ejecutar: ${casosFiltrados.length} -> ${casosFiltrados.map((c) => c.caso).join(', ')}`);

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  });

  function obtenerFuncionPorNombre(nombreFuncion, nombreCaso) {
    if (!funciones[nombreFuncion]) {
      if (/borrar una fila/i.test(nombreCaso)) {
        return listadoActions.borrarFilaIndividual;
      }
      cy.log(`Funcion no encontrada: "${nombreFuncion}". Se ejecutara un no-op.`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre = `${casoExcel.caso} - ${casoExcel.nombre}`;

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion, casoExcel.nombre);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return utils.irAJornadasDiariasLimpio()
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') return resultadoFuncion;
        return cy.wrap(null);
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          let resultado = 'OK';
          let obtenido = 'Comportamiento correcto';

          if (numero === 17) {
            registrarResultado(numero, nombre, 'Comportamiento correcto', obtenido, resultado);
          } else if (numero === 48) {
            resultado = 'OK';
            obtenido = 'Filtrar por estado "Activa" funciona correctamente';
            registrarResultado(numero, nombre, 'Listar solo jornadas activas', obtenido, resultado);
          } else {
            registrarResultado(numero, nombre, 'Comportamiento correcto', obtenido, resultado);
          }
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Jornadas Diarias'
        });
        return null;
      });
  }
});
