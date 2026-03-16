import {
  extraerDesdeNombre,
  generarNombreUnico,
  obtenerDatoEnTexto,
  obtenerDatoPorEtiqueta,
  reemplazarConNumeroAleatorio
} from '../dataHelpers';

export function createGruposUtils(config) {
  const { GRUPOS_URL_ABS, GRUPOS_PATH, DASHBOARD_PATH } = config;

  function irAGruposLimpio() {
    return cy.url().then((currentUrl) => {
      const verificarPantallaCargada = () => {
        cy.wait(1000);

        cy.get('body').then(($body) => {
          const hayPanelLateral = $body.find('[class*="overlay"], [class*="modal"], [class*="drawer"], [class*="sidebar"]').length > 0;
          if (hayPanelLateral) {
            cy.log('Cerrando panel lateral...');
            cy.get('body').type('{esc}');
            cy.wait(500);
          }
        });

        cy.get('body', { timeout: 20000 }).should('be.visible');

        return cy.get('body', { timeout: 20000 }).then(($body) => {
          const hayTabla = $body.find('.fi-ta-table, table').length > 0;

          if (hayTabla) {
            cy.log('Tabla encontrada, verificando visibilidad...');
            return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist');
          }

          const hayEstadoVacio = $body.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"], [class*="sin datos"], [class*="no hay"]').length > 0;
          const textoBody = $body.text().toLowerCase();
          const hayMensajeSinDatos = textoBody.includes('no hay datos') ||
            textoBody.includes('sin registros') ||
            textoBody.includes('tabla vacia') ||
            textoBody.includes('tabla vacía') ||
            textoBody.includes('no se encontraron') ||
            textoBody.includes('no se encontraron registros') ||
            textoBody.includes('sin resultados') ||
            textoBody.includes('no existen registros');

          if (hayEstadoVacio || hayMensajeSinDatos) {
            cy.log('No hay registros en la tabla - esto es valido (OK)');
            return cy.wrap(true);
          }

          cy.log('Esperando a que la tabla se cargue...');
          return cy.get('.fi-ta-table, table', { timeout: 20000 }).should('exist').catch(() => {
            return cy.get('body', { timeout: 2000 }).then(($body2) => {
              const textoBody2 = $body2.text().toLowerCase();
              const hayMensaje = textoBody2.includes('no hay') ||
                textoBody2.includes('sin datos') ||
                textoBody2.includes('vacio') ||
                textoBody2.includes('vacío') ||
                textoBody2.includes('sin registros') ||
                textoBody2.includes('sin resultados') ||
                textoBody2.includes('no se encontraron') ||
                textoBody2.includes('no se encontraron registros') ||
                textoBody2.includes('no existen registros');
              const hayEstado = $body2.find('.fi-empty-state, .fi-ta-empty-state, [class*="empty"]').length > 0;

              if (hayMensaje || hayEstado) {
                cy.log('No hay registros - esto es valido (OK)');
                return cy.wrap(true);
              }

              throw new Error('No se encontro la tabla ni mensaje de sin datos');
            });
          });
        });
      };

      if (currentUrl.includes(DASHBOARD_PATH) || currentUrl.includes(GRUPOS_PATH)) {
        cy.log('Sesion activa detectada, navegando directamente a Grupos...');
        cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 20000 }).should('include', GRUPOS_PATH);
        return verificarPantallaCargada();
      }

      cy.log('Sin sesion, realizando login primero...');
      cy.login({
        email: Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app',
        password: Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025',
        useSession: false
      });

      cy.url({ timeout: 15000 }).then((loginUrl) => {
        if (loginUrl.includes('/fichar')) {
          cy.log('Redirigido a fichajes, navegando a Panel interno...');
          cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
            .first()
            .scrollIntoView()
            .should('be.visible')
            .click({ force: true });
          cy.wait(800);
          return cy.contains('button, a, [role="menuitem"], .dropdown-item', /Panel interno/i, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        }
        return cy.wrap(null);
      });

      cy.url({ timeout: 20000 }).should('include', DASHBOARD_PATH);
      cy.wait(1500);
      cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
      cy.url({ timeout: 20000 }).should('include', GRUPOS_PATH);
      return verificarPantallaCargada();
    });
  }

  function verificarUrlGrupos() {
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (!currentUrl.includes(GRUPOS_PATH)) {
        cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
      }
      return cy.url({ timeout: 15000 }).should('include', GRUPOS_PATH);
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
