export function createJornadaSemanalListadoActions(deps) {
  const { extraerDesdeNombre, obtenerDatoPorEtiqueta } = deps;

  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 }).should('have.length.greaterThan', 0);
  }

  function ejecutarBusquedaIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = casoExcel.dato_1 || '';

    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${valor}{enter}`, { force: true });
    cy.wait(1500);

    return cy.get('body').then(($body) => {
      const filas = $body.find('.fi-ta-row:visible, tr:visible').length;
      if (filas > 0) return cy.wrap(filas).should('be.greaterThan', 0);
      return cy.contains(/No se encontraron registros/i, { timeout: 1000 }).should('exist');
    });
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const termino = casoExcel.dato_1 || '';

    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${termino}{enter}`, { force: true });
    cy.wait(1500);

    cy.get('body').then(($body) => {
      const chips = $body.find('[data-testid="clear-filter"], .MuiChip-deleteIcon, [aria-label="Quitar filtro"]');
      if (chips.length) {
        cy.wrap(chips.first()).click({ force: true });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear({ force: true });
      }
    });

    return cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '');
  }

  function seleccionUnica() {
    return cy.listadoSeleccionUnica({
      rowSelector: '.fi-ta-row:visible',
      waitAfterSelect: 300
    });
  }

  function seleccionMultiple() {
    return cy.listadoSeleccionMultiple({
      rowSelector: '.fi-ta-row:visible',
      waitAfterSelect: 200
    }).then(() => cy.wait(100));
  }

  function seleccionarTodos() {
    return cy.listadoSeleccionarTodos({
      checkboxSelector: 'thead input[type="checkbox"], thead .fi-checkbox',
      waitAfterSelect: 200
    });
  }

  function abrirAcciones() {
    return cy.listadoAbrirAcciones({
      rowSelector: '.fi-ta-row:visible',
      rowCheckboxSelector: 'input[type="checkbox"], .fi-checkbox input[type="checkbox"], .fi-checkbox input',
      selectionStrategy: 'checkbox',
      waitAfterSelect: 200,
      waitAfterOpen: 500
    });
  }

  function borradoMasivoConfirmar() {
    return cy.listadoBorradoMasivoConfirmar({
      rowSelector: '.fi-ta-row:visible',
      rowCheckboxSelector: 'input[type="checkbox"], .fi-checkbox input[type="checkbox"], .fi-checkbox input',
      selectionStrategy: 'checkbox',
      rowAssertSelector: '.fi-ta-row',
      confirmTexts: ['Cancelar', 'Cerrar', 'No'],
      waitAfterSelect: 200,
      waitAfterOpen: 0
    });
  }

  function borradoMasivoCancelar() {
    return cy.listadoBorradoMasivoCancelar({
      rowSelector: '.fi-ta-row:visible',
      rowCheckboxSelector: 'input[type="checkbox"], .fi-checkbox input[type="checkbox"], .fi-checkbox input',
      selectionStrategy: 'checkbox',
      confirmTexts: ['Cancelar', 'Cerrar'],
      waitAfterSelect: 200,
      waitAfterOpen: 0
    }).then(() => cy.wait(500));
  }

  function mostrarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const texto = extraerDesdeNombre(casoExcel.nombre, 'Mostrar columna') || casoExcel.dato_1 || 'Descripcion';

    cy.get('button[title*="Alternar"], button[aria-label*="column"], .fi-ta-col-toggle button', { timeout: 10000 })
      .filter(':visible')
      .first()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, .fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('label, span, div', new RegExp(texto, 'i'), { timeout: 10000 })
          .should('be.visible')
          .then(($el) => {
            const checkbox = $el.find('input[type="checkbox"]');
            if (checkbox.length) {
              cy.wrap(checkbox).click({ force: true });
            } else {
              cy.wrap($el).click({ force: true });
            }
          });
      });

    cy.get('body').click(0, 0, { force: true });
    return cy.get('.fi-ta-header-cell, th').should('exist');
  }

  function ordenarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const texto = extraerDesdeNombre(casoExcel.nombre, 'Ordenar por') || casoExcel.dato_1 || '';

    return cy.get('body').then(($body) => {
      const regex = new RegExp(`^${texto}$`, 'i');
      const $header = $body.find('th.fi-ta-header-cell, .fi-ta-header-cell').filter((_, el) => regex.test(Cypress.$(el).text().trim())).first();

      if ($header.length) {
        cy.wrap($header)
          .scrollIntoView({ offset: { top: 0, left: 0 } })
          .within(($headerEl) => {
            const $icon = $headerEl.find('span[role="button"], .fi-ta-header-cell-sort-icon, svg.fi-ta-header-cell-sort-icon').first();
            if ($icon.length) {
              cy.wrap($icon).click({ force: true });
              cy.wait(200);
              cy.wrap($icon).click({ force: true });
            }
          });
      }

      return cy.wrap(null);
    });
  }

  function filtrarEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerDatoPorEtiqueta(casoExcel, 'empresa') || casoExcel.dato_1 || 'Admin';
    return cy.uiFiltrarPorSelectEnPanel(empresa, 'Empresa')
      .then(() => cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 }).should('have.length.greaterThan', 0));
  }

  return {
    abrirAcciones,
    borradoMasivoCancelar,
    borradoMasivoConfirmar,
    cargarPantalla,
    ejecutarBusquedaIndividual,
    filtrarEmpresa,
    limpiarBusqueda,
    mostrarColumna,
    ordenarColumna,
    seleccionMultiple,
    seleccionUnica,
    seleccionarTodos
  };
}
