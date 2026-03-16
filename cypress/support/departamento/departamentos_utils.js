import {
  extraerDesdeNombre,
  obtenerDatoEnTexto,
  obtenerDatoPorEtiqueta
} from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createDepartamentosUtils(config) {
  const { DEPARTAMENTOS_URL_ABS, DEPARTAMENTOS_PATH, DASHBOARD_PATH } = config;
  let contadorPrueba = 1;

  function irADepartamentosLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: DEPARTAMENTOS_URL_ABS,
      path: DEPARTAMENTOS_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Departamentos'
    });
  }

  function verificarUrlDepartamentos() {
    return verificarUrlRecurso({
      urlAbs: DEPARTAMENTOS_URL_ABS,
      path: DEPARTAMENTOS_PATH
    });
  }

  function obtenerTextoBusqueda(casoExcel) {
    return casoExcel.dato_1 ||
      obtenerDatoPorEtiqueta(casoExcel, 'search') ||
      obtenerDatoEnTexto(casoExcel, 'search') ||
      'Admin';
  }

  function abrirFormularioCrearDepartamento() {
    return verificarUrlDepartamentos()
      .then(() =>
        cy.contains('button, a', /Crear departamento|Crear/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.url({ timeout: 10000 }).should('include', `${DEPARTAMENTOS_PATH}/create`));
  }

  function obtenerValorEmpresa(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'empresa') ||
      obtenerDatoEnTexto(casoExcel, 'Empresa') ||
      casoExcel.dato_1 ||
      'Admin';
  }

  function obtenerValorNombreDepartamento(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.name') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre del Departamento') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre') ||
      casoExcel.dato_2 ||
      '';
  }

  function obtenerValorDescripcion(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.description') ||
      obtenerDatoEnTexto(casoExcel, 'descripcion') ||
      obtenerDatoEnTexto(casoExcel, 'Descripcion') ||
      casoExcel.dato_3 ||
      '';
  }

  function procesarNombreDepartamento(nombreBase, numeroCaso) {
    let nombre = nombreBase || '';

    if (nombre.includes('pruebaXXX')) {
      const numerosAleatorios = Math.floor(100 + Math.random() * 900);
      nombre = nombre.replace('pruebaXXX', `prueba${numerosAleatorios}`);
      cy.log(`Nombre con numeros aleatorios: "${nombre}"`);
    }

    if (nombre.includes('prueba1+') && numeroCaso !== 18) {
      nombre = nombre.replace('prueba1+', `prueba${contadorPrueba}`);
      contadorPrueba += 1;
    } else if (nombre.includes('prueba1+') && numeroCaso === 18) {
      nombre = nombre.replace('prueba1+', 'prueba1');
    }

    return nombre;
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

  function esperarToastExito() {
    return cy.uiEsperarToastExito();
  }

  function filtrarEmpresaEnListado(valor) {
    return cy.uiFiltrarPorSelectEnPanel(valor, 'Empresa');
  }

  return {
    abrirFormularioCrearDepartamento,
    escribirCampo,
    esperarToastExito,
    extraerDesdeNombre,
    filtrarEmpresaEnListado,
    encontrarBotonAlFinal,
    irADepartamentosLimpio,
    limpiarCampo,
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerTextoBusqueda,
    obtenerValorDescripcion,
    obtenerValorEmpresa,
    obtenerValorNombreDepartamento,
    procesarNombreDepartamento,
    seleccionarEmpresa,
    verificarUrlDepartamentos
  };
}
