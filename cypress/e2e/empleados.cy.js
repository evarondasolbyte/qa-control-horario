import { createEmpleadosFiltrosActions } from '../support/empleado/empleados_filtros';
import { createEmpleadosFormularioActions } from '../support/empleado/empleados_formulario';
import { createEmpleadosIncurridosActions } from '../support/empleado/empleados_incurridos';
import { createEmpleadosListadoActions } from '../support/empleado/empleados_listado';
import { createEmpleadosUtils } from '../support/empleado/empleados_utils';
import { buildAppUrl, getAppBaseUrl } from '../support/appUrls';

describe('EMPLEADOS - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = getAppBaseUrl();
  const EMPLEADOS_URL_ABS = buildAppUrl('/panelinterno/empleados');
  const EMPLEADOS_PATH = '/panelinterno/empleados';
  const DASHBOARD_PATH = '/panelinterno';

  const CASOS_WARNING = new Set();
  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set();

  const utils = createEmpleadosUtils({
    DASHBOARD_PATH,
    EMPLEADOS_PATH,
    EMPLEADOS_URL_ABS
  });

  function registrarResultado(casoId, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero: casoId,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Empleados'
    });
  }

  const listadoActions = createEmpleadosListadoActions({
    ...utils,
    EMPLEADOS_PATH
  });

  const filtrosActions = createEmpleadosFiltrosActions(utils);
  const formularioActions = createEmpleadosFormularioActions({
    ...utils,
    EMPLEADOS_PATH,
    registrarResultado
  });
  const incurridosActions = createEmpleadosIncurridosActions({
    ...utils,
    EMPLEADOS_PATH,
    registrarResultado
  });

  const funciones = {
    ...listadoActions,
    ...filtrosActions,
    ...formularioActions,
    ...incurridosActions,
    abrirFormulario: formularioActions.abrirFormularioCrear
  };

  before(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (
        err.message?.includes('Component already registered') ||
        err.message?.includes('Snapshot missing on Livewire component') ||
        err.message?.includes('Component already initialized') ||
        err.message?.includes('Cannot read properties of null') ||
        err.message?.includes("reading 'destroy'") ||
        err.message?.includes('Expected one of the following types text|select-one|select-multiple') ||
        err.message?.includes("reading 'document'") ||
        err.message?.includes('Socket closed') ||
        err.message?.includes('network error occurred') ||
        err.message?.includes('upstream response')
      ) {
        return false;
      }
      return true;
    });
  });

  after(() => {
    cy.procesarResultadosPantalla('Empleados');
  });

  it('Ejecutar todos los casos de Empleados desde Google Sheets', () => {
    cy.obtenerDatosExcel('Empleados').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Empleados`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      let casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter((c) => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      casosFiltrados = casosFiltrados.filter((caso) => {
        let id = String(caso.caso || '').trim().toUpperCase().replace(/\s+/g, '');
        if (!id.startsWith('TC')) {
          const match = id.match(/(\d+)/);
          if (match) id = `TC${match[1].padStart(3, '0')}`;
        }
        const match = id.match(/^TC(\d+)$/i);
        if (match) id = `TC${match[1].padStart(3, '0')}`;
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

  function obtenerFuncionPorNombre(nombreFuncion) {
    if (!funciones[nombreFuncion]) {
      cy.log(`Funcion no encontrada en mapping: "${nombreFuncion}"`);
      return () => cy.wrap(null);
    }
    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const casoId = String(casoExcel.caso || '').trim().toUpperCase();
    if (!casoId || !casoId.startsWith('TC')) {
      cy.log(`Caso invalido en Excel: ${casoExcel.caso}, saltando...`);
      return cy.wrap(null);
    }

    const nombre = `${casoId} - ${casoExcel.nombre}`;
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoExcel.funcion}"`);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    let error500Detectado = false;
    let errorYaRegistrado = false;

    const esError500 = (err) => {
      if (!err) return false;
      return err.status === 500 ||
        err.statusCode === 500 ||
        err.message?.includes('500') ||
        err.message?.includes('Internal Server Error') ||
        err.message?.includes('ERROR_500_DETECTADO') ||
        err.message?.includes('ERROR_FORMULARIO_NO_ABIERTO') ||
        err.response?.status === 500 ||
        String(err).includes('500') ||
        (err.name && err.name.includes('500'));
    };

    const manejarError500 = (err, url = null) => {
      error500Detectado = true;
      errorYaRegistrado = true;

      const mensajeNormalizado = String(err?.message || err || '')
        .replace(/^ERROR_500_DETECTADO:\s*/i, '')
        .replace(/^ERROR_FORMULARIO_NO_ABIERTO:\s*/i, '')
        .trim();

      const mensajeError = err?.message?.includes('ERROR_FORMULARIO_NO_ABIERTO')
        ? 'ERROR: No se pudo abrir el formulario correctamente. La pagina no muestra el formulario esperado.'
        : (url ? `ERROR 500: Error interno del servidor en ${url}` : `ERROR 500: ${mensajeNormalizado || 'Error interno del servidor'}`);

      cy.log(`ERROR detectado en ${casoId}: ${mensajeError}`);
      registrarResultado(casoId, nombre, 'Comportamiento correcto', mensajeError, 'ERROR');
      return cy.wrap(true);
    };

    const verificarError500Temprano = () => {
      return cy.url({ timeout: 2000 }).then((currentUrl) => {
        const urlTieneError = currentUrl.includes('error') || currentUrl.includes('500');

        return cy.get('body', { timeout: 2000 }).then(($body) => {
          if (!$body || $body.length === 0) {
            if (urlTieneError && !error500Detectado) {
              manejarError500(null, currentUrl);
              error500Detectado = true;
            }
            return cy.wrap(error500Detectado);
          }

          const texto = $body.text().toLowerCase();
          const tieneError500 = texto.includes('500') ||
            texto.includes('internal server error') ||
            texto.includes('error interno del servidor') ||
            texto.includes('server error') ||
            texto.includes('500 server error') ||
            $body.find('[class*="error-500"], [class*="error500"], [id*="error-500"]').length > 0 ||
            urlTieneError;

          if (tieneError500 && !error500Detectado) {
            manejarError500(null, currentUrl);
            error500Detectado = true;
          }

          return cy.wrap(error500Detectado);
        }, () => {
          return cy.url().then((url) => {
            if ((url.includes('error') || url.includes('500')) && !error500Detectado) {
              manejarError500(null, url);
              error500Detectado = true;
            }
            return cy.wrap(error500Detectado);
          });
        });
      });
    };

    return cy.wrap(null)
      .then(() => utils.irAEmpleadosLimpio())
      .then(() => verificarError500Temprano())
      .then((huboError500) => {
        if (huboError500) return cy.wrap(null);

        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion
            .then((resultado) => {
              if (resultado && resultado.huboError === true) {
                errorYaRegistrado = true;
                return cy.wrap(true);
              }
              return verificarError500Temprano();
            }, (err) => {
              if (esError500(err)) return manejarError500(err);
              throw err;
            })
            .then((resultado) => {
              if (resultado === true) {
                errorYaRegistrado = true;
                return cy.wrap(true);
              }
              if (resultado && resultado.huboError === true) {
                errorYaRegistrado = true;
                return cy.wrap(true);
              }
              return resultado;
            }, (err) => {
              if (esError500(err)) return manejarError500(err);
              throw err;
            });
        }

        return verificarError500Temprano();
      }, (err) => {
        if (esError500(err)) return manejarError500(err);
        throw err;
      })
      .then((huboError500) => {
        if (huboError500 === true) {
          errorYaRegistrado = true;
          return null;
        }

        return cy.estaRegistrado().then((ya) => {
          if (!ya && !errorYaRegistrado) {
            const resultado = CASOS_WARNING.has(casoId) ? 'WARNING' : 'OK';
            registrarResultado(casoId, nombre, 'Comportamiento correcto', 'Comportamiento correcto', resultado);
          }
          return null;
        });
      }, (err) => {
        if (esError500(err)) return manejarError500(err);

        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Empleados'
        });
        return null;
      });
  }
});
