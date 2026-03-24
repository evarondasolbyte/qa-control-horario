import {
  CASOS_FICHAJE_RECARGAR,
  CASOS_FICHAJE_TRABAJO,
  ESPERA_SALIDA_MS,
  LABELS_ALERTA_ENTRADA,
  LABELS_ALERTA_SALIDA,
  LABELS_HORA_ENTRADA,
  LABELS_HORA_SALIDA,
  normalizarHora,
  normalizarMensajesEsperados,
  obtenerConfiguracionCasoFichaje,
  obtenerDatoPorEtiqueta,
  obtenerDatoPorEtiquetas,
  prepararDatosFichaje
} from './fichajes_data';
import { createFichajesSessionUtils } from './fichajes_session';
import { createFichajesActions } from './fichajes_actions';
import { createFichajesTrabajoUtils } from './fichajes_trabajo';
import { buildUrlFromBase, getAppBaseUrl, getScopedBaseUrl } from '../appUrls';

export function createFichajesModule() {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const fichajesBaseUrl = getScopedBaseUrl('FICHAJES_BASE_URL', getAppBaseUrl());
  const FICHAJES_URL_ABS = buildUrlFromBase(fichajesBaseUrl, '/fichar?testing=novatranshorario');
  const FICHAJES_PATH = '/fichar';
  const LOGIN_PATH = '/login';
  const LOGIN_URL_ABS = buildUrlFromBase(fichajesBaseUrl, '/login');

  const sessionUtils = createFichajesSessionUtils({
    FICHAJES_URL_ABS,
    LOGIN_PATH,
    LOGIN_URL_ABS,
    obtenerDatoPorEtiqueta,
    normalizarMensajesEsperados,
    generarTextoAleatorio: () => Cypress._.sampleSize('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 20).join('')
  });

  const {
    verificarUrlFichar,
    aceptarAdvertenciaSiExiste,
    clickBotonFichaje,
    asegurarBotonFichajeVisible,
    asegurarBotonFichajeNoVisible,
    asegurarSesionFichar,
    irAFichajesLimpio,
    rellenarCamposEntrada,
    rellenarCamposSalida
  } = sessionUtils;

  function beforeSuite() {
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
  }

  function afterSuite() {
    cy.procesarResultadosPantalla('Fichajes');
  }

  function registrarResultado(casoId, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero: casoId,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Fichajes'
    });
  }

  const trabajoUtils = createFichajesTrabajoUtils({
    LABELS_HORA_ENTRADA,
    LABELS_HORA_SALIDA,
    normalizarHora,
    obtenerDatoPorEtiqueta,
    obtenerDatoPorEtiquetas,
    verificarUrlFichar,
    aceptarAdvertenciaSiExiste,
    clickBotonFichaje,
    asegurarSesionFichar,
    rellenarCamposEntrada,
    rellenarCamposSalida,
    registrarResultado
  });

  const {
    obtenerCantidadFilasTrabajo,
    prepararSegundoRegistroTrabajoSiExiste,
    editarTramoTrabajoCaso,
    fichajeTrabajo
  } = trabajoUtils;

  const actions = createFichajesActions({
    FICHAJES_PATH,
    LOGIN_PATH,
    LOGIN_URL_ABS,
    CASOS_FICHAJE_RECARGAR,
    ESPERA_SALIDA_MS,
    LABELS_ALERTA_ENTRADA,
    LABELS_ALERTA_SALIDA,
    normalizarMensajesEsperados,
    obtenerConfiguracionCasoFichaje,
    obtenerDatoPorEtiqueta,
    obtenerDatoPorEtiquetas,
    prepararDatosFichaje,
    verificarUrlFichar,
    aceptarAdvertenciaSiExiste,
    clickBotonFichaje,
    asegurarBotonFichajeVisible,
    asegurarBotonFichajeNoVisible,
    asegurarSesionFichar,
    rellenarCamposEntrada,
    rellenarCamposSalida,
    obtenerCantidadFilasTrabajo,
    prepararSegundoRegistroTrabajoSiExiste,
    editarTramoTrabajoCaso,
    registrarResultado
  });

  const {
    login,
    loginIncorrecto,
    loginRecuerdame,
    vistaDiaria,
    vistaSemanal,
    semanalDiaria,
    vistaSemanalAnterior,
    vistaSemanalProxima,
    fichaje,
    scroll
  } = actions;

  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      login,
      loginIncorrecto,
      loginRecuerdame,
      vistaDiaria,
      vistaSemanal,
      semanalDiaria,
      vistaSemanalAnterior,
      vistaSemanalProxima,
      vistaSemanalSiguiente: vistaSemanalProxima,
      semanalAnterior: vistaSemanalAnterior,
      semanalProxima: vistaSemanalProxima,
      fichaje,
      fichajeTrabajo,
      eliminar: fichajeTrabajo,
      eliminarTramoTrabajoCaso: fichajeTrabajo,
      scroll
    };

    if (!funciones[nombreFuncion]) {
      cy.log(` Funcion no encontrada: "${nombreFuncion}". Se ejecutara un no-op.`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    let casoIdRaw = String(casoExcel.caso || '').trim().toUpperCase();

    if (!casoIdRaw || !casoIdRaw.startsWith('TC')) {
      casoIdRaw = `TC${String(idx + 1).padStart(3, '0')}`;
    } else {
      const numeroCaso = casoIdRaw.replace(/^TC/i, '');
      casoIdRaw = `TC${String(numeroCaso).padStart(3, '0')}`;
    }

    const casoId = casoIdRaw;
    const nombre = `${casoId} - ${casoExcel.nombre}`;
    const funcionNombre = CASOS_FICHAJE_TRABAJO.has(casoId) ? 'fichajeTrabajo' : casoExcel.funcion;
    const requiereRecargaPostCaso = CASOS_FICHAJE_RECARGAR.has(casoId);

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${funcionNombre}"`);

    const funcion = obtenerFuncionPorNombre(funcionNombre);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

      return irAFichajesLimpio(numero)
        .then(() => {
          if (numero <= 6) {
            cy.log('Casos TC001-TC006: se omite la preparacion del bloque Trabajo');
            return cy.wrap(null);
          }

          if (CASOS_FICHAJE_TRABAJO.has(casoId) || ['TC028', 'TC029'].includes(casoId)) {
            cy.log(`${casoId}: se omite la preparacion del 2o registro en Trabajo`);
            return cy.wrap(null);
          }

          return prepararSegundoRegistroTrabajoSiExiste();
        })
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion.then((resultadoFunc) => {
            if (resultadoFunc && resultadoFunc.huboError === true) {
              cy.log('Error detectado en la funcion - deteniendo ejecucion del caso');
              return cy.wrap(null);
            }
            return cy.wrap(null);
          });
        }
        return cy.wrap(null);
      })
      .then(() => {
        if (requiereRecargaPostCaso) {
          cy.log(' Reestableciendo estado de Fichajes tras el caso');
          return cy.reload(true).then(() => verificarUrlFichar());
        }
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
          pantalla: 'Fichajes'
        });
        return cy.wrap(null);
      });
  }

  function ejecutarSuite(casosOk = new Set(), casosPausados = new Set()) {
    cy.obtenerDatosExcel('Fichajes').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Fichajes`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        const id = String(caso.caso || '').trim().toUpperCase();
        if (casosPausados.has(id)) return false;
        if (casosOk.size === 0) return true;
        return casosOk.has(id);
      });

      cy.log(`Casos OK a ejecutar: ${casosFiltrados.length} -> ${casosFiltrados.map((c) => c.caso).join(', ')}`);

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  }

  return {
    beforeSuite,
    afterSuite,
    ejecutarSuite
  };
}