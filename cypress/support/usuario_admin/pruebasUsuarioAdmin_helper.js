import { createDepartamentosFormularioActions } from '../departamento/departamentos_formulario';
import { createDepartamentosUtils } from '../departamento/departamentos_utils';
import { createEmpleadosFormularioActions } from '../empleado/empleados_formulario';
import { createEmpleadosUtils } from '../empleado/empleados_utils';
import { createGruposFormularioActions } from '../grupo/grupos_formulario';
import { createGruposJornadasActions } from '../grupo/grupos_jornadas';
import { createGruposUtils } from '../grupo/grupos_utils';
import { createJornadaSemanalFormularioActions } from '../jornada_semanal/jornada_semanal_formulario';
import { createJornadaSemanalTiposActions } from '../jornada_semanal/jornada_semanal_tipos';
import { createJornadaSemanalUtils } from '../jornada_semanal/jornada_semanal_utils';
import { createJornadasDiariasFormularioActions } from '../jornada_diaria/jornadas_diarias_formulario';
import { createJornadasDiariasUtils } from '../jornada_diaria/jornadas_diarias_utils';

export function createPruebasUsuarioAdminActions(config) {
  const {
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
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

  const departamentosForm = createDepartamentosFormularioActions({
    ...departamentosUtils,
    DEPARTAMENTOS_PATH
  });

  const gruposUtils = createGruposUtils({
    DASHBOARD_PATH,
    GRUPOS_PATH,
    GRUPOS_URL_ABS: `${BASE_URL}${GRUPOS_PATH}`
  });

  const gruposForm = createGruposFormularioActions({
    ...gruposUtils,
    GRUPOS_PATH,
    GRUPOS_URL_ABS: `${BASE_URL}${GRUPOS_PATH}`
  });
  const gruposFormAdmin = createGruposFormularioActions({
    ...gruposUtils,
    GRUPOS_PATH,
    GRUPOS_URL_ABS: `${BASE_URL}${GRUPOS_PATH}`,
    seleccionarEmpresa: () => cy.wrap(null)
  });

  const gruposJornadas = createGruposJornadasActions({
    ...gruposUtils,
    editarAbrirFormulario: gruposFormAdmin.editarAbrirFormulario,
    registrarResultado
  });

  const empleadosUtils = createEmpleadosUtils({
    DASHBOARD_PATH,
    EMPLEADOS_PATH,
    EMPLEADOS_URL_ABS: `${BASE_URL}${EMPLEADOS_PATH}`
  });

  const empleadosForm = createEmpleadosFormularioActions({
    ...empleadosUtils,
    EMPLEADOS_PATH,
    registrarResultado
  });
  const empleadosFormAdmin = createEmpleadosFormularioActions({
    ...empleadosUtils,
    EMPLEADOS_PATH,
    registrarResultado,
    seleccionarEmpresa: () => cy.wrap(null)
  });

  const jornadasDiariasUtils = createJornadasDiariasUtils({
    DASHBOARD_PATH,
    JORNADAS_PATH: JORNADAS_DIARIAS_PATH,
    JORNADAS_URL_ABS: `${BASE_URL}${JORNADAS_DIARIAS_PATH}`
  });

  const jornadasDiariasForm = createJornadasDiariasFormularioActions(jornadasDiariasUtils);
  const jornadasDiariasFormAdmin = createJornadasDiariasFormularioActions({
    ...jornadasDiariasUtils,
    seleccionarOpcionSelect(selectorFallback, etiqueta, valorOriginal) {
      if (/empresa/i.test(String(etiqueta || ''))) return cy.wrap(null);
      return jornadasDiariasUtils.seleccionarOpcionSelect(selectorFallback, etiqueta, valorOriginal);
    }
  });

  const jornadaSemanalUtils = createJornadaSemanalUtils({
    DASHBOARD_PATH,
    JORNADA_SEMANAL_PATH,
    JORNADA_SEMANAL_URL_ABS: `${BASE_URL}${JORNADA_SEMANAL_PATH}`,
    registrarResultado
  });

  const jornadaSemanalForm = createJornadaSemanalFormularioActions(jornadaSemanalUtils);
  const jornadaSemanalFormAdmin = createJornadaSemanalFormularioActions({
    ...jornadaSemanalUtils,
    seleccionarEmpresaFormulario: () => cy.wrap(null)
  });
  const jornadaSemanalTipos = createJornadaSemanalTiposActions({
    ...jornadaSemanalUtils,
    ...jornadaSemanalFormAdmin
  });

  function nombreCompletoCaso(casoExcel) {
    return `${casoExcel.caso} - ${casoExcel.nombre}`;
  }

  function clonarCaso(casoExcel, overrides = {}) {
    return {
      ...casoExcel,
      ...overrides
    };
  }

  function conLog(fn) {
    return (casoExcel) => {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return fn(casoExcel);
    };
  }

  function abrirDashboard() {
    cy.visit(`${BASE_URL}${DASHBOARD_PATH}`, { failOnStatusCode: false });
    cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
    cy.wait(1000);
    return cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist');
  }

  function navegarYEjecutar(irAPantalla, accion, transformCaso = null) {
    return (casoExcel) => {
      const casoPreparado = transformCaso ? transformCaso(casoExcel) : casoExcel;
      return irAPantalla().then(() => accion(casoPreparado));
    };
  }

  function reemplazarXxxAdmin(valor) {
    const texto = String(valor || '');
    if (!texto) return texto;
    const random3 = Math.floor(100 + Math.random() * 900).toString();
    return texto.replace(/XXX/gi, random3);
  }

  function normalizarCasoExcelAdmin(casoExcel) {
    const casoNormalizado = { ...casoExcel };

    Object.keys(casoNormalizado).forEach((key) => {
      if (key === 'caso' || key === 'funcion' || key === 'prioridad') return;
      if (typeof casoNormalizado[key] !== 'string') return;
      if (!/XXX/i.test(casoNormalizado[key])) return;

      casoNormalizado[key] = reemplazarXxxAdmin(casoNormalizado[key]);
    });

    return casoNormalizado;
  }

  function ejecutarCrearDepartamentoAdmin(casoExcel) {
    const numero = parseInt(String(casoExcel.caso || '').replace(/[^0-9]/g, ''), 10);
    const nombreBase = departamentosUtils.procesarNombreDepartamento(
      departamentosUtils.obtenerValorNombreDepartamento(casoExcel),
      numero
    );
    const nombre = reemplazarXxxAdmin(nombreBase);
    const descripcion = reemplazarXxxAdmin(departamentosUtils.obtenerValorDescripcion(casoExcel));

    return departamentosUtils.abrirFormularioCrearDepartamento()
      .then(() => {
        const selectorNombre = 'input[name="data.name"], input#data\\.name';
        if (nombre && numero !== 22) {
          return departamentosUtils.escribirCampo(selectorNombre, nombre);
        }
        if (numero === 22) {
          return departamentosUtils.limpiarCampo(selectorNombre);
        }
        return null;
      })
      .then(() => {
        if (descripcion) {
          return departamentosUtils.escribirCampo(
            'textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description, trix-editor[name="data.description"]',
            descripcion
          );
        }
        return null;
      })
      .then(() => {
        if (numero === 20) {
          return departamentosUtils.encontrarBotonAlFinal('Cancelar')
            .then(() => cy.url({ timeout: 10000 }).should('include', DEPARTAMENTOS_PATH));
        }

        return cy.contains('button, a, input[type="submit"]', /^\s*Crear\s*$/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .click({ force: true })
          .then(() => {
          if ([18, 21, 22, 23].includes(numero)) {
            return cy.wait(2000);
          }
          return departamentosUtils.esperarToastExito();
        });
      });
  }

  function obtenerNombreGrupoAdmin(casoExcel) {
    const nombreBase =
      gruposUtils.obtenerDatoPorEtiqueta(casoExcel, 'data.name') ||
      gruposUtils.obtenerDatoEnTexto(casoExcel, 'Nombre del Grupo') ||
      gruposUtils.obtenerDatoEnTexto(casoExcel, 'Nombre') ||
      casoExcel.dato_1 ||
      '';

    return reemplazarXxxAdmin(nombreBase) || gruposUtils.generarNombreUnico('grupo');
  }

  function ejecutarCrearGrupoAdmin(casoExcel) {
    const nombre = obtenerNombreGrupoAdmin(casoExcel);
    const descripcion = reemplazarXxxAdmin(
      gruposUtils.obtenerDatoPorEtiqueta(casoExcel, 'data.description') ||
      gruposUtils.obtenerDatoEnTexto(casoExcel, 'descripcion')
    );

    return gruposUtils.abrirFormularioCrearGrupo()
      .then(() => gruposUtils.escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => {
        if (!descripcion) return null;
        return gruposUtils.escribirCampo(
          'textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description',
          descripcion
        );
      })
      .then(() => gruposUtils.enviarFormularioCrear())
      .then(() => {
        if (casoExcel.caso === 'TC017') return cy.wait(1500);
        return gruposUtils.esperarToastExito();
      });
  }

  function verificarQueNoApareceEnMenu(casoExcel, textoMenu) {
    const esperado = `No debe aparecer "${textoMenu}" en el menu`;
    const nombre = nombreCompletoCaso(casoExcel);
    const regex = new RegExp(`^\\s*${textoMenu}\\s*$`, 'i');

    return abrirDashboard().then(() =>
      cy.get('body').then(($body) => {
        const $contenedores = $body.find('aside:visible, nav:visible, header:visible, [role="navigation"]:visible');
        const $coincidencias = $contenedores.find('a, button, span, div').filter((_, el) => {
          const $el = Cypress.$(el);
          const texto = ($el.text() || '').replace(/\s+/g, ' ').trim();
          return texto.length > 0 && regex.test(texto) && $el.is(':visible');
        });

        if ($coincidencias.length > 0) {
          registrarResultado(casoExcel.caso, nombre, esperado, `Aparece "${textoMenu}" en el menu`, 'KO');
          throw new Error(`El menu "${textoMenu}" aparecio cuando no deberia.`);
        }

        registrarResultado(casoExcel.caso, nombre, esperado, `No aparece "${textoMenu}" en el menu`, 'OK');
        return cy.wrap(true);
      })
    );
  }

  function loginAdmin() {
    cy.log('Haciendo login con usuario admin...');
    cy.login({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
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

  const menuCargarPantalla = conLog(() => abrirDashboard());
  const menuVerificarNoEmpresas = conLog((casoExcel) => verificarQueNoApareceEnMenu(casoExcel, 'Empresas'));
  const menuVerificarNoRoles = conLog((casoExcel) => verificarQueNoApareceEnMenu(casoExcel, 'Roles'));

  const departamentosCargarPantalla = conLog(() =>
    departamentosUtils.irADepartamentosLimpio().then(() => cy.listadoCargarPantalla())
  );
  const departamentosCrearMinimo = conLog(navegarYEjecutar(departamentosUtils.irADepartamentosLimpio, ejecutarCrearDepartamentoAdmin));
  const departamentosCrearConDescripcion = conLog(navegarYEjecutar(departamentosUtils.irADepartamentosLimpio, ejecutarCrearDepartamentoAdmin));
  const departamentosCrearDuplicado = conLog(
    navegarYEjecutar(departamentosUtils.irADepartamentosLimpio, ejecutarCrearDepartamentoAdmin, (casoExcel) =>
      clonarCaso(casoExcel, { caso: 'TC023' })
    )
  );
  const departamentosValidacionNombreObligatorio = conLog(
    navegarYEjecutar(departamentosUtils.irADepartamentosLimpio, ejecutarCrearDepartamentoAdmin, (casoExcel) =>
      clonarCaso(casoExcel, { caso: 'TC022' })
    )
  );
  const departamentosEditar = conLog(navegarYEjecutar(departamentosUtils.irADepartamentosLimpio, departamentosForm.editarAbrirFormulario));

  const gruposCargarPantalla = conLog(() =>
    gruposUtils.irAGruposLimpio().then(() => cy.listadoCargarPantalla())
  );
  const gruposCrearMinimo = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, ejecutarCrearGrupoAdmin));
  const gruposCrearConDescripcion = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, ejecutarCrearGrupoAdmin));
  const gruposCrearDuplicado = conLog(
    navegarYEjecutar(gruposUtils.irAGruposLimpio, ejecutarCrearGrupoAdmin, (casoExcel) =>
      clonarCaso(casoExcel, { caso: 'TC017' })
    )
  );
  const gruposValidacionNombreObligatorio = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, gruposFormAdmin.validarNombreObligatorio));
  const gruposCrearConTodo = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, ejecutarCrearGrupoAdmin));
  const gruposEditar = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, gruposForm.editarAbrirFormulario));
  const gruposAsignarJornadaSemanal = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, gruposJornadas.asignarJornadaSemanal));
  const gruposAsignarEmpleado = conLog(navegarYEjecutar(gruposUtils.irAGruposLimpio, gruposFormAdmin.vincularEmpleado));

  const empleadosCargarPantalla = conLog(() =>
    empleadosUtils.irAEmpleadosLimpio().then(() => cy.listadoCargarPantalla())
  );
  const empleadosCrearMinimo = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosFormAdmin.ejecutarCrearIndividual));
  const empleadosValidacionNombreObligatorio = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosFormAdmin.validarNombreObligatorio));
  const empleadosValidacionEmailObligatorio = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosFormAdmin.validarEmailObligatorio));
  const empleadosValidacionGrupoObligatorio = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosFormAdmin.validarGrupoObligatorio));
  const empleadosCrearCompleto = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosFormAdmin.ejecutarCrearIndividual));
  const empleadosEditar = conLog(navegarYEjecutar(empleadosUtils.irAEmpleadosLimpio, empleadosForm.editarAbrirFormulario));

  const jornadasDiariasCargarPantalla = conLog(() =>
    jornadasDiariasUtils.irAJornadasDiariasLimpio().then(() => cy.listadoCargarPantalla())
  );
  const jornadasDiariasCrearSemanal = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasCrearDuplicado = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasValidacionNombreObligatorio = conLog(
    navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual, (casoExcel) =>
      clonarCaso(casoExcel, { caso: 'TC021' })
    )
  );
  const jornadasDiariasCrearConRangoInicio = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasCrearConRangoFin = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasCrearConDuracion = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasCrearConLimites = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasCrearCompleto = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasFormAdmin.ejecutarCrearIndividual));
  const jornadasDiariasEditar = conLog(navegarYEjecutar(jornadasDiariasUtils.irAJornadasDiariasLimpio, jornadasDiariasForm.editarAbrirFormulario));

  const jornadaSemanalCargarPantalla = conLog(() =>
    jornadaSemanalUtils.irAJornadaSemanalLimpio().then(() => cy.listadoCargarPantalla())
  );
  const jornadaSemanalCrearMinimo = conLog(
      navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual, (casoExcel) =>
        clonarCaso(casoExcel, { caso: 'TC030' })
      )
  );
  const jornadaSemanalCrearDuplicado = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual));
  const jornadaSemanalValidacionNombreObligatorio = conLog(
    navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual, (casoExcel) =>
      clonarCaso(casoExcel, { caso: 'TC020' })
    )
  );
  const jornadaSemanalCrearMaxHoras = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual));
  const jornadaSemanalCrearMinHoras = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual));
  const jornadaSemanalEditar = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalForm.editarAbrirFormulario));
  const jornadaSemanalCrearMaxMinutos = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual));
  const jornadaSemanalCrearMinMinutos = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalFormAdmin.ejecutarCrearIndividual));
  const jornadaSemanalAnadirTiposJornada = conLog(navegarYEjecutar(jornadaSemanalUtils.irAJornadaSemanalLimpio, jornadaSemanalTipos.anadirTiposJornada));

  const funciones = {
    TC001: menuCargarPantalla,
    TC002: menuVerificarNoEmpresas,
    TC003: menuVerificarNoRoles,
    TC004: departamentosCargarPantalla,
    TC005: departamentosCrearMinimo,
    TC006: departamentosCrearConDescripcion,
    TC007: departamentosCrearDuplicado,
    TC008: departamentosValidacionNombreObligatorio,
    TC009: departamentosEditar,
    TC010: gruposCargarPantalla,
    TC011: gruposCrearMinimo,
    TC012: gruposCrearConDescripcion,
    TC013: gruposCrearDuplicado,
    TC014: gruposValidacionNombreObligatorio,
    TC015: gruposCrearConTodo,
    TC016: gruposEditar,
    TC017: gruposAsignarJornadaSemanal,
    TC018: gruposAsignarEmpleado,
    TC019: empleadosCargarPantalla,
    TC020: empleadosCrearMinimo,
    TC021: empleadosValidacionNombreObligatorio,
    TC022: empleadosValidacionEmailObligatorio,
    TC023: empleadosValidacionGrupoObligatorio,
    TC024: empleadosCrearCompleto,
    TC025: empleadosEditar,
    TC026: jornadasDiariasCargarPantalla,
    TC027: jornadasDiariasCrearSemanal,
    TC028: jornadasDiariasCrearDuplicado,
    TC029: jornadasDiariasValidacionNombreObligatorio,
    TC030: jornadasDiariasCrearConRangoInicio,
    TC031: jornadasDiariasCrearConRangoFin,
    TC032: jornadasDiariasCrearConDuracion,
    TC033: jornadasDiariasCrearConLimites,
    TC034: jornadasDiariasCrearCompleto,
    TC035: jornadasDiariasEditar,
    TC036: jornadaSemanalCargarPantalla,
    TC037: jornadaSemanalCrearMinimo,
    TC038: jornadaSemanalCrearDuplicado,
    TC039: jornadaSemanalValidacionNombreObligatorio,
    TC040: jornadaSemanalCrearMaxHoras,
    TC041: jornadaSemanalCrearMinHoras,
    TC042: jornadaSemanalEditar,
    TC043: jornadaSemanalCrearMaxMinutos,
    TC044: jornadaSemanalCrearMinMinutos,
    TC045: jornadaSemanalAnadirTiposJornada,
    menuCargarPantalla,
    menuVerificarNoEmpresas,
    menuVerificarNoRoles,
    departamentosCargarPantalla,
    departamentosCrearMinimo,
    departamentosCrearConDescripcion,
    departamentosCrearDuplicado,
    departamentosValidacionNombreObligatorio,
    departamentosEditar,
    gruposCargarPantalla,
    gruposCrearMinimo,
    gruposCrearConDescripcion,
    gruposCrearDuplicado,
    gruposValidacionNombreObligatorio,
    gruposCrearConTodo,
    gruposEditar,
    gruposAsignarJornadaSemanal,
    gruposAsignarEmpleado,
    empleadosCargarPantalla,
    empleadosCrearMinimo,
    empleadosValidacionNombreObligatorio,
    empleadosValidacionEmailObligatorio,
    empleadosValidacionGrupoObligatorio,
    empleadosCrearCompleto,
    empleadosEditar,
    jornadasDiariasCargarPantalla,
    jornadasDiariasCrearSemanal,
    jornadasDiariasCrearDuplicado,
    jornadasDiariasValidacionNombreObligatorio,
    jornadasDiariasCrearConRangoInicio,
    jornadasDiariasCrearConRangoFin,
    jornadasDiariasCrearConDuracion,
    jornadasDiariasCrearConLimites,
    jornadasDiariasCrearCompleto,
    jornadasDiariasEditar,
    jornadaSemanalCargarPantalla,
    jornadaSemanalCrearMinimo,
    jornadaSemanalCrearDuplicado,
    jornadaSemanalValidacionNombreObligatorio,
    jornadaSemanalCrearMaxHoras,
    jornadaSemanalCrearMinHoras,
    jornadaSemanalEditar,
    jornadaSemanalCrearMaxMinutos,
    jornadaSemanalCrearMinMinutos,
    jornadaSemanalAnadirTiposJornada
  };

  function obtenerFuncionPorNombre(nombreFuncion) {
    const clave = String(nombreFuncion || '').trim();
    if (funciones[clave]) return funciones[clave];

    const matchTc = clave.match(/^TC\d+/i);
    if (matchTc && funciones[matchTc[0].toUpperCase()]) {
      return funciones[matchTc[0].toUpperCase()];
    }

    cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
    return () => cy.wrap(null);
  }

  return {
    loginAdmin,
    normalizarCasoExcelAdmin,
    obtenerFuncionPorNombre,
    verificarError500
  };
}
