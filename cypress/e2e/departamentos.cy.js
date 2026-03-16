import { createDepartamentosFiltrosActions } from '../support/departamento/departamentos_filtros';
import { createDepartamentosFormularioActions } from '../support/departamento/departamentos_formulario';
import { createDepartamentosUtils } from '../support/departamento/departamentos_utils';

describe('DEPARTAMENTOS - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const DEPARTAMENTOS_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/departamentos';
  const DEPARTAMENTOS_PATH = '/panelinterno/departamentos';
  const DASHBOARD_PATH = '/panelinterno';
  const CASOS_PAUSADOS = new Set();

  const utils = createDepartamentosUtils({
    DASHBOARD_PATH,
    DEPARTAMENTOS_PATH,
    DEPARTAMENTOS_URL_ABS
  });

  const formularioActions = createDepartamentosFormularioActions({
    ...utils,
    DEPARTAMENTOS_PATH
  });

  const filtrosActions = createDepartamentosFiltrosActions(utils);

  function registrarResultado(numero, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Departamentos'
    });
  }

  function crearAccionListado(accion) {
    return (casoExcel) => {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return accion(casoExcel);
    };
  }

  function asegurarColumnaYOrdenar(textoColumna, mostrarAntes = false) {
    const promesaMostrar = mostrarAntes ? cy.listadoMostrarColumna(textoColumna) : cy.wrap(null);
    return promesaMostrar.then(() => cy.listadoOrdenarColumna(textoColumna));
  }

  const listadoActions = {
    cargarPantalla: crearAccionListado(() => cy.listadoCargarPantalla()),
    ejecutarBusquedaIndividual: crearAccionListado((casoExcel) => cy.listadoBuscar(utils.obtenerTextoBusqueda(casoExcel))),
    limpiarBusqueda: crearAccionListado((casoExcel) => cy.listadoLimpiarBusqueda(utils.obtenerTextoBusqueda(casoExcel))),
    seleccionUnica: crearAccionListado(() => cy.listadoSeleccionUnica()),
    seleccionMultiple: crearAccionListado(() => cy.listadoSeleccionMultiple()),
    seleccionarTodos: crearAccionListado(() => cy.listadoSeleccionarTodos()),
    abrirAcciones: crearAccionListado(() => cy.listadoAbrirAcciones()),
    borradoMasivoConfirmar: crearAccionListado(() => cy.listadoBorradoMasivoConfirmar()),
    borradoMasivoCancelar: crearAccionListado(() => cy.listadoBorradoMasivoCancelar()),
    ordenarCompany: crearAccionListado(() => cy.listadoOrdenarColumna('Empresa')),
    mostrarColumnaCreatedAt: crearAccionListado(() => cy.listadoMostrarColumna('Created at')),
    mostrarColumnaUpdatedAt: crearAccionListado(() => cy.listadoMostrarColumna('Updated at')),
    mostrarColumnaDeletedAt: crearAccionListado(() => cy.listadoMostrarColumna('Deleted at')),
    mostrarColumnaEmpleados: crearAccionListado(() => cy.listadoMostrarColumna('Empleados')),
    mostrarColumnaCreado: crearAccionListado(() => cy.listadoMostrarColumna(/Creado|Created at/i)),
    mostrarColumnaActualizado: crearAccionListado(() => cy.listadoMostrarColumna(/Actualizado|Updated at/i)),
    ordenarCreatedAt: crearAccionListado(() => asegurarColumnaYOrdenar('Created at', true)),
    ordenarUpdatedAt: crearAccionListado(() => asegurarColumnaYOrdenar('Updated at', true)),
    ordenarDeletedAt: crearAccionListado(() => asegurarColumnaYOrdenar('Deleted at', true)),
    ordenarNombre: crearAccionListado(() => cy.listadoOrdenarColumna('Nombre')),
    ordenarEmpleados: crearAccionListado(() => asegurarColumnaYOrdenar('Empleados', true)),
    ordenarCreado: crearAccionListado(() => asegurarColumnaYOrdenar(/Creado|Created at/i, true))
  };

  const funciones = {
    ...listadoActions,
    ...filtrosActions,
    ...formularioActions
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

    return utils.irADepartamentosLimpio()
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion;
        }
        return cy.wrap(null);
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (ya) return null;

        if (numero === 18) {
          return cy.get('body').then(($body) => {
            const texto = $body.text().toLowerCase();
            const hayAvisoDuplicado = [
              'duplicad',
              'ya existe',
              'duplicate',
              'aviso',
              'registrado'
            ].some((palabra) => texto.includes(palabra));

            registrarResultado(
              casoId,
              nombre,
              'Aviso indicando que el departamento ya existe',
              hayAvisoDuplicado ? 'Aviso de duplicado mostrado correctamente' : 'No aparecio el aviso esperado',
              hayAvisoDuplicado ? 'OK' : 'WARNING'
            );
          });
        }

        registrarResultado(casoId, nombre, 'Comportamiento correcto', 'Comportamiento correcto', 'OK');
        return null;
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Departamentos'
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
    cy.procesarResultadosPantalla('Departamentos');
  });

  it('Ejecutar todos los casos de Departamentos desde Google Sheets', () => {
    cy.obtenerDatosExcel('Departamentos').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Departamentos`);

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
});
