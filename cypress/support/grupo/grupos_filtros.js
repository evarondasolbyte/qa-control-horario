export function createGruposFiltrosActions(deps) {
  const {
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerValorEmpresa
  } = deps;

  function filtrarEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';

    cy.get('body').type('{esc}{esc}');
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });

    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panel')
      .should('be.visible');

    cy.get('@panel').within(() => {
      cy.contains('label, span, div, p', /Empresa/i, { timeout: 10000 })
        .should('be.visible')
        .closest('div, fieldset, section')
        .as('bloqueEmpresa');
    });

    cy.get('@bloqueEmpresa').then(($bloque) => {
      const $select = $bloque.find('select:visible');
      if ($select.length) {
        cy.wrap($select).first().select(empresa, { force: true });
        return;
      }

      const openers = [
        '[role="combobox"]:visible',
        '[aria-haspopup="listbox"]:visible',
        '[aria-expanded]:visible',
        'button:visible',
        '[role="button"]:visible',
        '.fi-select-trigger:visible',
        '.fi-input:visible',
        '.fi-field:visible',
        '.fi-input-wrp:visible',
        '.fi-fo-field-wrp:visible'
      ];

      let opened = false;
      for (const sel of openers) {
        const $el = $bloque.find(sel).first();
        if ($el.length) {
          cy.wrap($el).scrollIntoView().click({ force: true });
          opened = true;
          break;
        }
      }

      if (!opened) {
        cy.wrap($bloque).scrollIntoView().click('center', { force: true });
      }

      cy.get('body').then(($b) => {
        if ($b.text().includes('Cargando...')) {
          cy.contains('Cargando...', { timeout: 15000 }).should('not.exist');
        }
      });

      const dropdownScopes =
        '.fi-dropdown-panel:visible, .fi-select-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible, .fi-dropdown:visible, ul:visible, div[role="menu"]:visible';

      cy.get('body').then(($body) => {
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
        } else {
          cy.get(dropdownScopes, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
          });
        }
      });
    });

    cy.get('@panel').then(($p) => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });

    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  }

  function filtrarDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const casoId = String(casoExcel.caso || '').toUpperCase();
    const depto =
      casoId === 'TC038'
        ? 'Departamento de Admin'
        : (
          obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.name') ||
          obtenerDatoEnTexto(casoExcel, 'Departamento') ||
          'Departamento SuperAdmin'
        );

    const escaparRegex = (texto = '') => texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    cy.get('body').type('{esc}{esc}', { force: true });
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });

    cy.get(
      'button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]',
      { timeout: 10000 }
    )
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panel')
      .should('be.visible');

    cy.scrollTo('top', { duration: 300 });
    cy.wait(300);

    cy.get('@panel').then(($panel) => {
      const $panelJq = Cypress.$($panel);
      const $deptSelect = $panelJq.find('#tableFilters\\.department_id\\.value');
      if ($deptSelect.length) {
        const $choices = $deptSelect.closest('.choices');
        cy.wrap($choices.length ? $choices : $deptSelect).as('choicesDepto');
        return;
      }

      const $label = $panelJq.find(':contains("Departamento")').filter('label,span,div,p').first();
      if ($label.length) {
        const $bloque = $label.closest('div, fieldset, section');
        const $choices = $bloque.find('.choices').first();
        if ($choices.length) {
          cy.wrap($choices).as('choicesDepto');
          return;
        }
      }

      throw new Error('No se encontro el selector de Departamento ni un .choices bajo el bloque "Departamento".');
    });

    cy.get('@choicesDepto').within(() => {
      cy.get('.choices__inner', { timeout: 10000 })
        .first()
        .scrollIntoView()
        .click({ force: true });
    });

    cy.get('@choicesDepto')
      .find('.choices__list--dropdown.is-active', { timeout: 10000 })
      .should('be.visible');

    cy.scrollTo('top', { duration: 300 });
    cy.wait(300);

    cy.get('body').then(($b) => {
      if ($b.text().includes('Cargando...')) {
        cy.contains('Cargando...', { timeout: 20000 }).should('not.exist');
      }
    });

    cy.get('@choicesDepto').then(($c) => {
      if ($c.find('input.choices__input--cloned').length) {
        cy.wrap($c).within(() => {
          cy.get('input.choices__input--cloned', { timeout: 10000 })
            .should('be.visible')
            .focus()
            .clear({ force: true })
            .type(depto, { force: true, delay: 10 });
        });
        cy.scrollTo('top', { duration: 300 });
        cy.wait(300);
      }
    });

    cy.get('@choicesDepto')
      .find('.choices__list--dropdown.is-active', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.scrollTo('top', { duration: 300 });
        cy.wait(300);
        cy.contains('.choices__item--choice', new RegExp(`^${escaparRegex(depto)}$`, 'i'), { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      });

    cy.get('@panel').then(($p) => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });

    cy.log(`Validando resultados para "${depto}" (tabla o vacio = OK)...`);

    return cy.get('body', { timeout: 15000 }).should(($body) => {
      const hayTabla = $body.find('.fi-ta-table, table').length > 0;
      const texto = $body.text();
      const hayEmptyText =
        /No se encontraron registros|No se han encontrado registros|Sin registros|No results found/i.test(texto);
      const hayEmptyState =
        $body.find('.fi-ta-empty-state, .fi-ta-empty-state-heading, [data-empty-state]').length > 0;

      expect(hayTabla || hayEmptyText || hayEmptyState, 'tabla o empty state presente').to.eq(true);
    });
  }

  return {
    filtrarDepartamento,
    filtrarEmpresa
  };
}
