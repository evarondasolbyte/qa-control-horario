export function verificarPantallaListadoCargada() {
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
      textoBody.includes('vacio') ||
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
}

export function verificarUrlRecurso({ urlAbs, path }) {
  return cy.url({ timeout: 15000 }).then((currentUrl) => {
    if (!currentUrl.includes(path)) {
      cy.visit(urlAbs, { failOnStatusCode: false });
    }
    return cy.url({ timeout: 15000 }).should('include', path);
  });
}

export function irAListadoRecursoLimpio({
  urlAbs,
  path,
  dashboardPath,
  nombrePantalla
}) {
  return cy.url().then((currentUrl) => {
    if (currentUrl.includes(dashboardPath) || currentUrl.includes(path)) {
      cy.log(`Sesion activa detectada, navegando directamente a ${nombrePantalla}...`);
      cy.visit(urlAbs, { failOnStatusCode: false });
      cy.url({ timeout: 20000 }).should('include', path);
      return verificarPantallaListadoCargada();
    }

    cy.log(`Sin sesion, realizando login antes de entrar en ${nombrePantalla}...`);
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

    cy.url({ timeout: 20000 }).should('include', dashboardPath);
    cy.wait(1500);
    cy.visit(urlAbs, { failOnStatusCode: false });
    cy.url({ timeout: 20000 }).should('include', path);
    return verificarPantallaListadoCargada();
  });
}
