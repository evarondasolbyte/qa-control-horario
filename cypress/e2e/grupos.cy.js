import { createGruposFiltrosActions } from '../support/grupo/grupos_filtros';
import { createGruposFormularioActions } from '../support/grupo/grupos_formulario';
import { createGruposJornadasActions } from '../support/grupo/grupos_jornadas';
import { createGruposUtils } from '../support/grupo/grupos_utils';
import { buildAppUrl, getAppBaseUrl } from '../support/appUrls';

describe('GRUPOS - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = getAppBaseUrl();
  const GRUPOS_URL_ABS = buildAppUrl('/panelinterno/grupos');
  const GRUPOS_PATH = '/panelinterno/grupos';
  const DASHBOARD_PATH = '/panelinterno';
  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set(['TC038']);

  const utils = createGruposUtils({
    DASHBOARD_PATH,
    GRUPOS_PATH,
    GRUPOS_URL_ABS
  });

  function registrarResultado(casoId, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero: casoId,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Grupos'
    });
  }

  const formularioActions = createGruposFormularioActions({
    ...utils,
    GRUPOS_PATH,
    GRUPOS_URL_ABS
  });

  const filtrosActions = createGruposFiltrosActions(utils);
  const jornadasActions = createGruposJornadasActions({
    ...utils,
    editarAbrirFormulario: formularioActions.editarAbrirFormulario,
    registrarResultado
  });

  const listadoActions = {
    cargarPantalla(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoCargarPantalla();
    },
    ejecutarBusquedaIndividual(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoBuscar(utils.obtenerTextoBusqueda(casoExcel));
    },
    limpiarBusqueda(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoLimpiarBusqueda(utils.obtenerTextoBusqueda(casoExcel));
    },
    seleccionUnica(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoSeleccionUnica();
    },
    seleccionMultiple(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoSeleccionMultiple();
    },
    seleccionarTodos(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoSeleccionarTodos();
    },
    abrirAcciones(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoAbrirAcciones();
    },
    borradoMasivoConfirmar(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoBorradoMasivoConfirmar();
    },
    borradoMasivoCancelar(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return cy.listadoBorradoMasivoCancelar();
    },
    mostrarColumna(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      const texto = utils.extraerDesdeNombre(casoExcel.nombre, 'Mostrar columna') || casoExcel.dato_1 || 'Descripcion';
      return cy.listadoMostrarColumna(texto);
    },
    ordenarColumna(casoExcel) {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      const texto = utils.extraerDesdeNombre(casoExcel.nombre, 'Ordenar por') || casoExcel.dato_1 || 'Empresa';
      return cy.listadoOrdenarColumna(texto);
    }
  };

  const funciones = {
    ...listadoActions,
    ...filtrosActions,
    ...formularioActions,
    ...jornadasActions,
    abrirFormulario: formularioActions.abrirFormularioCrear,
    asignarEmpleado: formularioActions.vincularEmpleado,
    asignarJornada: jornadasActions.asignarJornadaSemanal
  };

  function obtenerFuncionPorNombre(nombreFuncion) {
    if (!funciones[nombreFuncion]) {
      cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
      return () => cy.wrap(null);
    }
    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const matchNum = String(casoExcel.caso || '').match(/(\d+)/);
    const numero = matchNum ? parseInt(matchNum[1], 10) : (idx + 1);
    const casoId = `TC${String(numero).padStart(3, '0')}`;
    casoExcel.caso = casoId;
    const nombre = `${casoId} - ${casoExcel.nombre}`;

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return utils.irAGruposLimpio()
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion;
        }
        return cy.wrap(null);
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          registrarResultado(casoId, nombre, 'Comportamiento correcto', 'Comportamiento correcto', 'OK');
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Grupos'
        });
        return null;
      });
  }

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
    cy.procesarResultadosPantalla('Grupos');
  });

  it('Ejecutar todos los casos de Grupos desde Google Sheets', () => {
    cy.obtenerDatosExcel('Grupos').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Grupos`);

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
});
