import { createDepartamentosUtils } from '../departamento/departamentos_utils';
import { createEmpleadosUtils } from '../empleado/empleados_utils';
import { createGruposUtils } from '../grupo/grupos_utils';
import { createJornadaSemanalUtils } from '../jornada_semanal/jornada_semanal_utils';
import { createJornadasDiariasUtils } from '../jornada_diaria/jornadas_diarias_utils';

export function createPruebasUsuarioSupervisorActions(config) {
  const {
    SUPERVISOR_EMAIL,
    SUPERVISOR_PASSWORD,
    BASE_URL,
    DASHBOARD_PATH,
    LOGIN_PATH,
    registrarResultado
  } = config;

  const DEPARTAMENTOS_PATH = '/panelinterno/departamentos';
  const GRUPOS_PATH = '/panelinterno/grupos';
  const EMPLEADOS_PATH = '/panelinterno/empleados';
  const JORNADAS_DIARIAS_PATH = '/panelinterno/jornadas-diarias';
  const JORNADA_SEMANAL_PATH = '/panelinterno/jornada-semanal';

  const departamentosUtils = createDepartamentosUtils({
    DASHBOARD_PATH,
    DEPARTAMENTOS_PATH,
    DEPARTAMENTOS_URL_ABS: `${BASE_URL}${DEPARTAMENTOS_PATH}`
  });

  const gruposUtils = createGruposUtils({
    DASHBOARD_PATH,
    GRUPOS_PATH,
    GRUPOS_URL_ABS: `${BASE_URL}${GRUPOS_PATH}`
  });

  const empleadosUtils = createEmpleadosUtils({
    DASHBOARD_PATH,
    EMPLEADOS_PATH,
    EMPLEADOS_URL_ABS: `${BASE_URL}${EMPLEADOS_PATH}`
  });

  const jornadasDiariasUtils = createJornadasDiariasUtils({
    DASHBOARD_PATH,
    JORNADAS_PATH: JORNADAS_DIARIAS_PATH,
    JORNADAS_URL_ABS: `${BASE_URL}${JORNADAS_DIARIAS_PATH}`
  });

  const jornadaSemanalUtils = createJornadaSemanalUtils({
    DASHBOARD_PATH,
    JORNADA_SEMANAL_PATH,
    JORNADA_SEMANAL_URL_ABS: `${BASE_URL}${JORNADA_SEMANAL_PATH}`,
    registrarResultado
  });

  function conLog(fn) {
    return (casoExcel) => {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return fn(casoExcel);
    };
  }

  function nombreCompletoCaso(casoExcel) {
    return `${casoExcel.caso} - ${casoExcel.nombre}`;
  }

  function abrirDashboard() {
    cy.visit(`${BASE_URL}${DASHBOARD_PATH}`, { failOnStatusCode: false });
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    cy.wait(1000);
    return cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist');
  }

  function loginSupervisor() {
    cy.log('Haciendo login con usuario supervisor...');
    cy.login({
      email: SUPERVISOR_EMAIL,
      password: SUPERVISOR_PASSWORD,
      useSession: false
    });

    cy.url({ timeout: 15000 }).should((url) => {
      expect(url).to.satisfy((value) => value.includes(DASHBOARD_PATH) || value.includes('/fichar') || value.includes(LOGIN_PATH));
    });

    return abrirDashboard();
  }

  function verificarError500(casoExcel, numero, nombre) {
    const detectarEnTexto = (texto = '') => {
      const valor = String(texto || '').toLowerCase().replace(/\s+/g, ' ').trim();
      return valor.includes('internal server error') ||
        valor.includes('server error') ||
        valor.includes('error interno del servidor') ||
        valor.includes('500 server error') ||
        /\berror\s*500\b/.test(valor);
    };

    const registrarYFallar = () => {
      registrarResultado(
        casoExcel.caso || numero,
        nombre,
        casoExcel.resultado_esperado || 'Comportamiento correcto',
        '500 SERVER ERROR / Internal Server Error',
        'ERROR'
      );

      throw new Error('Error 500 detectado: Internal Server Error');
    };

    return cy.get('body', { timeout: 5000 }).then(($body) => {
      const $safeBody = ($body && $body.length) ? $body : Cypress.$('body');
      const texto = (($safeBody && typeof $safeBody.text === 'function' ? $safeBody.text() : '') || '').toLowerCase();
      const encabezadoVisible = $safeBody.find('h1:visible, h2:visible, h3:visible, [role="heading"]:visible')
        .filter((_, el) => detectarEnTexto(Cypress.$(el).text()))
        .length > 0;
      const urlActual = (window.location?.pathname || '').toLowerCase();
      const tieneError500 =
        detectarEnTexto(texto) ||
        encabezadoVisible ||
        urlActual.includes('/500') ||
        urlActual.includes('/error');

      if (!tieneError500) return cy.wrap(true);
      return registrarYFallar();
    }, () =>
      cy.document().then((doc) => {
        const texto = (doc?.body?.textContent || '').toLowerCase();
        if (!detectarEnTexto(texto)) return cy.wrap(true);
        return registrarYFallar();
      }, () => cy.wrap(true))
    );
  }

  function buscarEnListado(valor) {
    return cy.listadoBuscar(valor);
  }

  function limpiarBusquedaListado(valor) {
    return cy.listadoLimpiarBusqueda(valor);
  }

  function mostrarColumna(columna) {
    return cy.listadoMostrarColumna(columna);
  }

  function ordenarPorColumna(columna) {
    return cy.listadoOrdenarColumna(columna);
  }

  function filtrarPorCampo(nombreCampo, valor) {
    return cy.uiFiltrarPorSelectEnPanel(valor, nombreCampo);
  }

  const actions = {
    departamentosCargarPantalla: conLog(() => departamentosUtils.irADepartamentosLimpio().then(() => cy.listadoCargarPantalla())),
    departamentosBuscarTextoExacto: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Departamento 1 de Admin'))),
    departamentosBuscarTextoParcial: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'de Admin'))),
    departamentosBuscarCaseInsensitive: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'DePaRtAmEnTo'))),
    departamentosBuscarConEspacios: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || ' Admin'))),
    departamentosBuscarConCaracteresEspeciales: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '%$&'))),
    departamentosLimpiarBusqueda: conLog((casoExcel) => departamentosUtils.irADepartamentosLimpio().then(() => limpiarBusquedaListado(casoExcel.dato_1 || 'admin'))),
    departamentosOrdenarPorNombre: conLog(() => departamentosUtils.irADepartamentosLimpio().then(() => ordenarPorColumna('Nombre'))),
    departamentosMostrarColumnaCreado: conLog(() => departamentosUtils.irADepartamentosLimpio().then(() => mostrarColumna(/Creado|Created at/i))),
    departamentosMostrarColumnaActualizado: conLog(() => departamentosUtils.irADepartamentosLimpio().then(() => mostrarColumna(/Actualizado|Updated at/i))),

    gruposCargarPantalla: conLog(() => gruposUtils.irAGruposLimpio().then(() => cy.listadoCargarPantalla())),
    gruposBuscarTextoExacto: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Admin'))),
    gruposBuscarTextoParcial: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Super'))),
    gruposBuscarCaseInsensitive: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'SuPeR'))),
    gruposBuscarConEspacios: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '    admin'))),
    gruposBuscarConCaracteresEspeciales: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '$%&'))),
    gruposLimpiarBusqueda: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => limpiarBusquedaListado(casoExcel.dato_1 || 'admin'))),
    gruposMostrarColumnaDescripcion: conLog(() => gruposUtils.irAGruposLimpio().then(() => mostrarColumna(/Descripcion|Descripci[oó]n/i))),
    gruposMostrarColumnaEmpresa: conLog(() => gruposUtils.irAGruposLimpio().then(() => mostrarColumna('Empresa'))),
    gruposMostrarColumnaCreado: conLog(() => gruposUtils.irAGruposLimpio().then(() => mostrarColumna(/Creado|Created at/i))),
    gruposMostrarColumnaActualizado: conLog(() => gruposUtils.irAGruposLimpio().then(() => mostrarColumna(/Actualizado|Updated at/i))),
    gruposMostrarColumnaEliminado: conLog(() => gruposUtils.irAGruposLimpio().then(() => mostrarColumna(/Eliminado|Deleted at/i))),
    gruposOrdenarPorEmpresa: conLog(() => gruposUtils.irAGruposLimpio().then(() => ordenarPorColumna('Empresa'))),
    gruposOrdenarPorNombre: conLog(() => gruposUtils.irAGruposLimpio().then(() => ordenarPorColumna('Nombre'))),
    gruposOrdenarPorDepartamento: conLog(() => gruposUtils.irAGruposLimpio().then(() => ordenarPorColumna('Departamento'))),
    gruposOrdenarPorSupervisor: conLog(() => gruposUtils.irAGruposLimpio().then(() => ordenarPorColumna('Supervisor'))),
    gruposFiltrarPorDepartamento: conLog((casoExcel) => gruposUtils.irAGruposLimpio().then(() => filtrarPorCampo('Departamento', casoExcel.dato_1 || 'prueba'))),

    empleadosCargarPantalla: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => cy.listadoCargarPantalla())),
    empleadosBuscarTextoExacto: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Empresa Cliente 1'))),
    empleadosBuscarTextoParcial: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Empresa'))),
    empleadosBuscarCaseInsensitive: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'eMpReSa'))),
    empleadosBuscarConEspacios: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '     empresa'))),
    empleadosBuscarConCaracteresEspeciales: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '$%&'))),
    empleadosLimpiarBusqueda: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => limpiarBusquedaListado(casoExcel.dato_1 || 'empresa'))),
    empleadosMostrarColumnaTelefono: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => mostrarColumna(/Telefono|Tel[eé]fono/i))),
    empleadosMostrarColumnaCreado: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => mostrarColumna(/Creado|Created at/i))),
    empleadosMostrarColumnaActualizado: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => mostrarColumna(/Actualizado|Updated at/i))),
    empleadosMostrarColumnaEliminado: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => mostrarColumna(/Eliminado|Deleted at/i))),
    empleadosOrdenarPorNombre: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => ordenarPorColumna('Nombre'))),
    empleadosOrdenarPorApellidos: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => ordenarPorColumna('Apellidos'))),
    empleadosOrdenarPorEmail: conLog(() => empleadosUtils.irAEmpleadosLimpio().then(() => ordenarPorColumna('Email'))),
    empleadosFiltrarPorDepartamento: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => filtrarPorCampo('Departamento', casoExcel.dato_1 || 'Departamento 1 de Admin'))),
    empleadosFiltrarPorGrupo: conLog((casoExcel) => empleadosUtils.irAEmpleadosLimpio().then(() => filtrarPorCampo('Grupo', casoExcel.dato_1 || 'admin'))),

    jornadasDiariasCargarPantalla: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => cy.listadoCargarPantalla())),
    jornadasDiariasBuscarTextoExacto: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'Admin'))),
    jornadasDiariasBuscarTextoParcial: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'pausa'))),
    jornadasDiariasBuscarCaseInsensitive: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'AdMiN'))),
    jornadasDiariasBuscarConEspacios: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '      admin'))),
    jornadasDiariasBuscarConCaracteresEspeciales: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '$%&'))),
    jornadasDiariasLimpiarBusqueda: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => limpiarBusquedaListado(casoExcel.dato_1 || 'admin'))),
    jornadasDiariasMostrarColumnaS: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => mostrarColumna('S'))),
    jornadasDiariasMostrarColumnaD: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => mostrarColumna('D'))),
    jornadasDiariasMostrarColumnaVentanaEntrada: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => mostrarColumna(/Ventana Entrada/i))),
    jornadasDiariasMostrarColumnaVentanaSalida: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => mostrarColumna(/Ventana Salida/i))),
    jornadasDiariasOrdenarPorNombre: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => ordenarPorColumna('Nombre'))),
    jornadasDiariasOrdenarPorCreado: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => ordenarPorColumna(/Creado|Created at/i))),
    jornadasDiariasOrdenarPorActualizado: conLog(() => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => ordenarPorColumna(/Actualizado|Updated at/i))),
    jornadasDiariasFiltrarPorCategoria: conLog((casoExcel) => jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => filtrarPorCampo('Categoria de Entrada', casoExcel.dato_1 || 'Jornada de trabajo'))),

    jornadaSemanalCargarPantalla: conLog(() => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => cy.listadoCargarPantalla())),
    jornadaSemanalBuscarTextoExacto: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'jornada2'))),
    jornadaSemanalBuscarTextoParcial: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'empresa'))),
    jornadaSemanalBuscarCaseInsensitive: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => buscarEnListado(casoExcel.dato_1 || 'AdMiN'))),
    jornadaSemanalBuscarConEspacios: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '     admin'))),
    jornadaSemanalBuscarConCaracteresEspeciales: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => buscarEnListado(casoExcel.dato_1 || '$%&'))),
    jornadaSemanalLimpiarBusqueda: conLog((casoExcel) => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => limpiarBusquedaListado(casoExcel.dato_1 || 'admin'))),
    jornadaSemanalMostrarColumnaDescripcion: conLog(() => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => mostrarColumna(/Descripcion|Descripci[oó]n/i))),
    jornadaSemanalOrdenarPorNombre: conLog(() => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => ordenarPorColumna('Nombre'))),
    jornadaSemanalOrdenarPorHorasSemanales: conLog(() => jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => ordenarPorColumna(/Horas Semanales/i)))
  };

  const tcMap = {
    TC001: 'departamentosCargarPantalla',
    TC002: 'departamentosBuscarTextoExacto',
    TC003: 'departamentosBuscarTextoParcial',
    TC004: 'departamentosBuscarCaseInsensitive',
    TC005: 'departamentosBuscarConEspacios',
    TC006: 'departamentosBuscarConCaracteresEspeciales',
    TC007: 'departamentosLimpiarBusqueda',
    TC008: 'departamentosOrdenarPorNombre',
    TC009: 'departamentosMostrarColumnaCreado',
    TC010: 'departamentosMostrarColumnaActualizado',
    TC011: 'gruposCargarPantalla',
    TC012: 'gruposBuscarTextoExacto',
    TC013: 'gruposBuscarTextoParcial',
    TC014: 'gruposBuscarCaseInsensitive',
    TC015: 'gruposBuscarConEspacios',
    TC016: 'gruposBuscarConCaracteresEspeciales',
    TC017: 'gruposLimpiarBusqueda',
    TC018: 'gruposMostrarColumnaDescripcion',
    TC019: 'gruposMostrarColumnaEmpresa',
    TC020: 'gruposMostrarColumnaCreado',
    TC021: 'gruposMostrarColumnaActualizado',
    TC022: 'gruposMostrarColumnaEliminado',
    TC023: 'gruposOrdenarPorEmpresa',
    TC024: 'gruposOrdenarPorNombre',
    TC025: 'gruposOrdenarPorDepartamento',
    TC026: 'gruposOrdenarPorSupervisor',
    TC027: 'gruposFiltrarPorDepartamento',
    TC028: 'empleadosCargarPantalla',
    TC029: 'empleadosBuscarTextoExacto',
    TC030: 'empleadosBuscarTextoParcial',
    TC031: 'empleadosBuscarCaseInsensitive',
    TC032: 'empleadosBuscarConEspacios',
    TC033: 'empleadosBuscarConCaracteresEspeciales',
    TC034: 'empleadosLimpiarBusqueda',
    TC035: 'empleadosMostrarColumnaTelefono',
    TC036: 'empleadosMostrarColumnaCreado',
    TC037: 'empleadosMostrarColumnaActualizado',
    TC038: 'empleadosMostrarColumnaEliminado',
    TC039: 'empleadosOrdenarPorNombre',
    TC040: 'empleadosOrdenarPorApellidos',
    TC041: 'empleadosOrdenarPorEmail',
    TC042: 'empleadosFiltrarPorDepartamento',
    TC043: 'empleadosFiltrarPorGrupo',
    TC044: 'jornadasDiariasCargarPantalla',
    TC045: 'jornadasDiariasBuscarTextoExacto',
    TC046: 'jornadasDiariasBuscarTextoParcial',
    TC047: 'jornadasDiariasBuscarCaseInsensitive',
    TC048: 'jornadasDiariasBuscarConEspacios',
    TC049: 'jornadasDiariasBuscarConCaracteresEspeciales',
    TC050: 'jornadasDiariasLimpiarBusqueda',
    TC051: 'jornadasDiariasMostrarColumnaS',
    TC052: 'jornadasDiariasMostrarColumnaD',
    TC053: 'jornadasDiariasMostrarColumnaVentanaEntrada',
    TC054: 'jornadasDiariasMostrarColumnaVentanaSalida',
    TC055: 'jornadasDiariasOrdenarPorNombre',
    TC056: 'jornadasDiariasOrdenarPorCreado',
    TC057: 'jornadasDiariasOrdenarPorActualizado',
    TC058: 'jornadasDiariasFiltrarPorCategoria',
    TC059: 'jornadaSemanalCargarPantalla',
    TC060: 'jornadaSemanalBuscarTextoExacto',
    TC061: 'jornadaSemanalBuscarTextoParcial',
    TC062: 'jornadaSemanalBuscarCaseInsensitive',
    TC063: 'jornadaSemanalBuscarConEspacios',
    TC064: 'jornadaSemanalBuscarConCaracteresEspeciales',
    TC065: 'jornadaSemanalLimpiarBusqueda',
    TC066: 'jornadaSemanalMostrarColumnaDescripcion',
    TC067: 'jornadaSemanalOrdenarPorNombre',
    TC068: 'jornadaSemanalOrdenarPorHorasSemanales'
  };

  function obtenerFuncionPorNombre(nombreFuncion) {
    const clave = String(nombreFuncion || '').trim();
    if (actions[clave]) return actions[clave];

    const matchTc = clave.match(/^TC\d+/i);
    if (matchTc) {
      const nombreMapeado = tcMap[matchTc[0].toUpperCase()];
      if (nombreMapeado && actions[nombreMapeado]) return actions[nombreMapeado];
    }

    cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
    return () => cy.wrap(null);
  }

  return {
    loginSupervisor,
    obtenerFuncionPorNombre,
    verificarError500
  };
}
