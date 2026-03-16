import {
  extraerDesdeNombre,
  generarNombreUnico,
  obtenerDatoEnTexto,
  obtenerDatoPorEtiqueta,
  reemplazarConNumeroAleatorio
} from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createGruposUtils(config) {
  const { GRUPOS_URL_ABS, GRUPOS_PATH, DASHBOARD_PATH } = config;

  function irAGruposLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: GRUPOS_URL_ABS,
      path: GRUPOS_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Grupos'
    });
  }

  function verificarUrlGrupos() {
    return verificarUrlRecurso({
      urlAbs: GRUPOS_URL_ABS,
      path: GRUPOS_PATH
    });
  }

  function obtenerTextoBusqueda(casoExcel) {
    return casoExcel.dato_1 ||
      obtenerDatoPorEtiqueta(casoExcel, 'search') ||
      obtenerDatoEnTexto(casoExcel, 'search') ||
      'Admin';
  }

  function abrirFormularioCrearGrupo() {
    return verificarUrlGrupos()
      .then(() =>
        cy.contains('button, a', /Crear grupo/i, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.url({ timeout: 10000 }).should('include', `${GRUPOS_PATH}/create`));
  }

  function seleccionarEmpresa(nombre) {
    return cy.uiSeleccionarOpcionChoices(nombre, 'Empresa');
  }

  function escribirCampo(selector, valor) {
    return cy.uiEscribirCampo(selector, valor);
  }

  function limpiarCampo(selector) {
    return cy.uiLimpiarCampo(selector);
  }

  function encontrarBotonAlFinal(textoBoton) {
    return cy.uiEncontrarBotonAlFinal(textoBoton);
  }

  function enviarFormularioCrear() {
    return encontrarBotonAlFinal('Crear');
  }

  function esperarToastExito() {
    return cy.uiEsperarToastExito();
  }

  function confirmarModal(textos = []) {
    return cy.uiConfirmarModal(textos);
  }

  function verificarErrorEsperado(palabrasClave = []) {
    return cy.uiVerificarErrorEsperado(palabrasClave);
  }

  function seleccionarJornadaEnModal(aliasModal, textoOpcion) {
    return cy.uiSeleccionarJornadaEnModal(aliasModal, textoOpcion);
  }

  function seleccionarFechaInicioMananaEnModal(modalAlias) {
    return cy.uiSeleccionarFechaInicioMananaEnModal(modalAlias);
  }

  function obtenerValorEmpresa(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'empresa') ||
      obtenerDatoEnTexto(casoExcel, 'Empresa') ||
      casoExcel.dato_1 ||
      'Admin';
  }

  function obtenerValorNombreGrupo(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.name') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre del Grupo') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre') ||
      casoExcel.dato_2 ||
      '';
  }

  return {
    abrirFormularioCrearGrupo,
    confirmarModal,
    encontrarBotonAlFinal,
    enviarFormularioCrear,
    escribirCampo,
    esperarToastExito,
    extraerDesdeNombre,
    generarNombreUnico,
    irAGruposLimpio,
    limpiarCampo,
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerTextoBusqueda,
    obtenerValorEmpresa,
    obtenerValorNombreGrupo,
    reemplazarConNumeroAleatorio,
    seleccionarEmpresa,
    seleccionarFechaInicioMananaEnModal,
    seleccionarJornadaEnModal,
    verificarErrorEsperado,
    verificarUrlGrupos
  };
}
