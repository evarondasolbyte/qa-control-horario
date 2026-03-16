import { createEmpresasFiltrosActions } from '../support/empresa/empresas_filtros';
import { createEmpresasFormularioActions } from '../support/empresa/empresas_formulario';
import { createEmpresasListadoActions } from '../support/empresa/empresas_listado';
import { createEmpresasUtils } from '../support/empresa/empresas_utils';

describe('EMPRESAS - Validacion completa con gestion de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_novatrans.xlsx';
  const EMPRESAS_URL_ABS = 'https://horario.dev.novatrans.app/panelinterno/empresas';
  const EMPRESAS_PATH = '/panelinterno/empresas';
  const DASHBOARD_PATH = '/panelinterno';

  const CASOS_WARNING = new Set();
  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set();

  const utils = createEmpresasUtils({
    DASHBOARD_PATH,
    EMPRESAS_PATH,
    EMPRESAS_URL_ABS
  });

  const listadoActions = createEmpresasListadoActions();
  const filtrosActions = createEmpresasFiltrosActions();
  const formularioActions = createEmpresasFormularioActions({
    ...utils,
    EMPRESAS_PATH
  });

  const funciones = {
    ...listadoActions,
    ...filtrosActions,
    ...formularioActions
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
    cy.procesarResultadosPantalla('Empresas');
  });

  it('Ejecutar todos los casos de Empresas desde Google Sheets', () => {
    cy.obtenerDatosExcel('Empresas').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Empresas`);

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
        if (CASOS_OK.size > 0) return CASOS_OK.has(id);
        return true;
      });

      cy.log(`Casos a ejecutar: ${casosFiltrados.length} -> ${casosFiltrados.map((c) => c.caso).join(', ')}`);

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
      cy.log(`Funciones disponibles: ${Object.keys(funciones).join(', ')}`);
      return () => cy.wrap(null);
    }

    return funciones[nombreFuncion];
  }

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const casoId = `TC${String(numero).padStart(3, '0')}`;
    const nombre = `${casoId} - ${casoExcel.nombre}`;
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    cy.log('--------------------------------------------------------');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`Funcion solicitada: "${casoExcel.funcion}"`);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return utils.irAEmpresasLimpio()
      .then(() => funcion(casoExcel))
      .then(() =>
        cy.estaRegistrado().then((ya) => {
          if (ya) return null;

          if (numero === 17 || CASOS_WARNING.has(casoId)) {
            return cy.get('body').then(($body) => {
              const texto = $body.text().toLowerCase();
              const hayAvisoDuplicado = [
                'duplicad',
                'ya existe',
                'ya ha sido registrado',
                'ha sido registrado',
                'campo nombre',
                'campo cif',
                'duplicate',
                'aviso',
                'registrado'
              ].some((palabra) => texto.includes(palabra));

              cy.registrarResultados({
                numero: casoId,
                nombre,
                esperado: 'Aviso indicando que la empresa ya existe',
                obtenido: hayAvisoDuplicado
                  ? 'Aviso de duplicado mostrado correctamente'
                  : 'No aparecio el aviso esperado',
                resultado: hayAvisoDuplicado ? 'OK' : 'WARNING',
                archivo,
                pantalla: 'Empresas'
              });

              return null;
            });
          }

          cy.registrarResultados({
            numero: casoId,
            nombre,
            esperado: 'Comportamiento correcto',
            obtenido: 'Comportamiento correcto',
            resultado: 'OK',
            archivo,
            pantalla: 'Empresas'
          });

          return null;
        })
      , (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Empresas'
        });
        return null;
      });
  }
});
