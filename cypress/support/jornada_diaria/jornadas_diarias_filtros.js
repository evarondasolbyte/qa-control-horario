export function createJornadasDiariasFiltrosActions() {
  function filtrarEstado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = String(casoExcel.dato_1 || '').trim() || 'Activa';
    const valorNormalizado = /^activa$/i.test(valor) ? 'Activas' : valor;

    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panelFiltrosEstado')
      .should('be.visible');

    return cy.get('@panelFiltrosEstado')
      .then(($panel) => {
        const $select = $panel.find('select:visible').first();
        if ($select.length) {
          cy.wrap($select).select(valorNormalizado, { force: true });
          return null;
        }

        const $trigger = $panel.find('[role="combobox"]:visible, [aria-haspopup="listbox"]:visible, button:visible, .fi-select-trigger:visible').first();
        if ($trigger.length) {
          cy.wrap($trigger).click({ force: true });
        } else {
          cy.wrap($panel).click('center', { force: true });
        }

        return cy.contains('[role="option"]:visible, .choices__item--choice:visible, .fi-dropdown-panel :visible', new RegExp(`^\\s*${valorNormalizado}\\s*$`, 'i'), { timeout: 10000 })
          .click({ force: true });
      })
      .then(() =>
        cy.get('@panelFiltrosEstado').then(($panel) => {
          if ($panel.is(':visible')) {
            cy.get('.fi-ta-table, table').first().click({ force: true });
          }
        })
      )
      .then(() =>
        cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
          .should('have.length.greaterThan', 0)
      );
  }

  return {
    filtrarEstado
  };
}
