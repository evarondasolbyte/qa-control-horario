import {
  extraerDesdeNombre,
  generarNombreUnico,
  obtenerCamposDesdeExcel,
  obtenerDatoPorEtiqueta
} from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createJornadaSemanalUtils(config) {
  const { DASHBOARD_PATH, JORNADA_SEMANAL_PATH, JORNADA_SEMANAL_URL_ABS, registrarResultado } = config;
  let contadorPrueba = 1;

  function irAJornadaSemanalLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: JORNADA_SEMANAL_URL_ABS,
      path: JORNADA_SEMANAL_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Jornada Semanal'
    });
  }

  function verificarUrlJornadaSemanal() {
    return verificarUrlRecurso({
      urlAbs: JORNADA_SEMANAL_URL_ABS,
      path: JORNADA_SEMANAL_PATH
    });
  }

  function incrementarContadorPrueba() {
    const actual = contadorPrueba;
    contadorPrueba += 1;
    return actual;
  }

  function seleccionarEmpresaFormulario(valor) {
    const opcion = valor || 'Admin';
    return cy.get('body').then(($body) => {
      const selector = 'select#data\\.company_id:visible, select[name="data.company_id"]:visible';
      if ($body.find(selector).length) {
        return cy.get(selector)
          .first()
          .scrollIntoView()
          .then(($select) => {
            const opciones = Array.from($select[0].options || []);
            const match = opciones.find(
              (opt) => (opt.text || '').trim().toLowerCase() === opcion.toLowerCase()
                || (opt.value || '').trim().toLowerCase() === opcion.toLowerCase()
            ) || opciones.find((opt) => (opt.value || '').trim() === opcion) || opciones[0];

            const valorSeleccion = match ? (match.value || match.text) : opcion;
            cy.wrap($select).select(valorSeleccion, { force: true });
          });
      }

      return cy.uiSeleccionarOpcionChoices(opcion, 'Empresa');
    });
  }

  function verificarError500DespuesCrear(casoExcel, numero) {
    const registrar = () => {
      const casoId = casoExcel.caso || `TC${String(numero).padStart(3, '0')}`;
      const nombre = `${casoId} - ${casoExcel.nombre}`;
      registrarResultado(
        casoId,
        nombre,
        casoExcel.resultado_esperado || 'Comportamiento correcto',
        'ERROR 500: Error interno del servidor detectado al crear',
        'ERROR'
      );
    };

    const detectarEnTexto = (texto = '') =>
      texto.includes('500') ||
      texto.includes('internal server error') ||
      texto.includes('error interno del servidor') ||
      texto.includes('server error') ||
      texto.includes('500 server error');

    return cy.get('body', { timeout: 5000 }).then(($body) => {
      if (!$body || !$body.length) {
        return cy.document().then((doc) => {
          if (!doc || !doc.body) {
            cy.log('No se pudo obtener el documento - asumiendo que no hay error 500');
            return cy.wrap(false);
          }

          const docText = (doc.body.textContent || '').toLowerCase();
          if (detectarEnTexto(docText)) {
            cy.log('ERROR 500 detectado despues de crear - registrando en Excel');
            registrar();
            return cy.wrap(true);
          }

          return cy.wrap(false);
        }, () => {
          cy.log('Error al obtener el documento - asumiendo que no hay error 500');
          return cy.wrap(false);
        });
      }

      const texto = ($body.text() || '').toLowerCase();
      const tieneError500 = detectarEnTexto(texto) ||
        $body.find('[class*="error-500"], [class*="error500"], [id*="error-500"]').length > 0;

      if (tieneError500) {
        cy.log('ERROR 500 detectado despues de crear - registrando en Excel');
        registrar();
        return cy.wrap(true);
      }

      return cy.wrap(false);
    }, () =>
      cy.document().then((doc) => {
        if (!doc || !doc.body) {
          cy.log('No se pudo obtener el documento - asumiendo que no hay error 500');
          return cy.wrap(false);
        }

        const docText = (doc.body.textContent || '').toLowerCase();
        if (detectarEnTexto(docText)) {
          cy.log('ERROR 500 detectado en el documento despues de crear - registrando en Excel');
          registrar();
          return cy.wrap(true);
        }

        return cy.wrap(false);
      }, () => {
        cy.log('Error al obtener el documento - asumiendo que no hay error 500');
        return cy.wrap(false);
      })
    );
  }

  return {
    JORNADA_SEMANAL_PATH,
    JORNADA_SEMANAL_URL_ABS,
    extraerDesdeNombre,
    generarNombreUnico,
    incrementarContadorPrueba,
    irAJornadaSemanalLimpio,
    obtenerCamposDesdeExcel,
    obtenerDatoPorEtiqueta,
    seleccionarEmpresaFormulario,
    verificarError500DespuesCrear,
    verificarUrlJornadaSemanal
  };
}