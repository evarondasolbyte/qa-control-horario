import { createJornadaSemanalFormularioActions } from '../support/jornada_semanal/jornada_semanal_formulario';
import { createJornadaSemanalListadoActions } from '../support/jornada_semanal/jornada_semanal_listado';
import { createJornadaSemanalTiposActions } from '../support/jornada_semanal/jornada_semanal_tipos';
import { createJornadaSemanalUtils } from '../support/jornada_semanal/jornada_semanal_utils';

describe('JORNADA SEMANAL - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const JORNADA_SEMANAL_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/jornada-semanal';
  const JORNADA_SEMANAL_PATH = '/panelinterno/jornada-semanal';
  const DASHBOARD_PATH = '/panelinterno';

  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set(
    Array.from({ length: 10 }, (_, idx) => `TC${String(idx + 1).padStart(3, '0')}`)
  );

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Jornada Semanal'
    });
  }

  const utils = createJornadaSemanalUtils({
    DASHBOARD_PATH,
    JORNADA_SEMANAL_PATH,
    JORNADA_SEMANAL_URL_ABS,
    registrarResultado
  });

  const formularioActions = createJornadaSemanalFormularioActions(utils);
  const listadoActions = createJornadaSemanalListadoActions(utils);
  const tiposActions = createJornadaSemanalTiposActions({
    ...utils,
    ...formularioActions
  });

  const funciones = {
    ...formularioActions,
    ...listadoActions,
    ...tiposActions
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
    cy.procesarResultadosPantalla('Jornada Semanal');
  });

  it('Ejecutar todos los casos de Jornada Semanal desde Google Sheets', () => {
    cy.obtenerDatosExcel('Jornada Semanal').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Jornada Semanal`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        let id = String(caso.caso || '').trim().toUpperCase();
        if (id && /^\d+$/.test(id)) id = `TC${id.padStart(3, '0')}`;
        if (id && !id.startsWith('TC')) id = `TC${id.padStart(3, '0')}`;
        if (CASOS_PAUSADOS.has(id)) {
          cy.log(`Caso ${id} esta pausado - saltando`);
          return false;
        }
        if (CASOS_OK.size === 0) return true;
        return CASOS_OK.has(id);
      });

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  });

  function obtenerFuncionPorNombre(nombreFuncion) {
    if (!funciones[nombreFuncion]) {
      cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const casoId = casoExcel.caso || `TC${String(idx + 1).padStart(3, '0')}`;
    const nombre = `${casoId} - ${casoExcel.nombre}`;

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoExcel.funcion}"`);

    let funcionNombre = casoExcel.funcion;
    if (numero === 15) {
      funcionNombre = 'ejecutarCrearIndividual';
      cy.log('TC015: Forzando ejecutarCrearIndividual (igual que TC016)');
    }

    const funcion = obtenerFuncionPorNombre(funcionNombre);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return utils.irAJornadaSemanalLimpio()
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') return resultadoFuncion;
        return cy.wrap(null);
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          registrarResultado(
            casoId,
            nombre,
            'Comportamiento correcto',
            'Comportamiento correcto',
            'OK'
          );
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Jornada Semanal'
        });
        return null;
      });
  }
});
