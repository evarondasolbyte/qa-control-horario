import { confirmarModal } from './uiHelpers';

function normalizarConfig(config = {}) {
  return {
    actionsLabel: config.actionsLabel || /Abrir acciones/i,
    checkboxSelector: config.checkboxSelector || 'thead input[type="checkbox"], thead .fi-checkbox, .fi-ta-select-all input[type="checkbox"]',
    confirmTexts: config.confirmTexts || ['Cancelar', 'Cerrar', 'No'],
    deleteLabel: config.deleteLabel || /Borrar seleccionados/i,
    rowCheckboxSelector: config.rowCheckboxSelector || 'input[type="checkbox"], .fi-checkbox input[type="checkbox"], .fi-checkbox input',
    rowAssertSelector: config.rowAssertSelector || '.fi-ta-row, tbody tr',
    rowSelector: config.rowSelector || '.fi-ta-row:visible, tbody tr:visible',
    selectionStrategy: config.selectionStrategy || 'row',
    waitAfterOpen: config.waitAfterOpen ?? 500,
    waitAfterSelect: config.waitAfterSelect ?? 200
  };
}

function obtenerMatcher(label) {
  if (label instanceof RegExp) return (texto) => label.test(texto);
  const textoEsperado = String(label || '').trim().toLowerCase();
  return (texto) => texto.includes(textoEsperado);
}

function existeBotonAccionesVisible(label) {
  const match = obtenerMatcher(label);
  return cy.get('body').then(($body) => {
    const hay = $body.find('button:visible, a:visible').toArray()
      .some((el) => match((Cypress.$(el).text() || '').trim()));
    return cy.wrap(hay, { log: false });
  });
}

function clickPrimerElementoVisiblePorTexto(label) {
  const match = obtenerMatcher(label);
  return cy.get('body').then(($body) => {
    const $objetivo = $body.find('button:visible, a:visible').filter((_, el) => {
      const texto = (Cypress.$(el).text() || '').trim();
      return match(texto);
    }).first();

    if ($objetivo.length) {
      return cy.wrap($objetivo).click({ force: true });
    }

    return cy.contains('button, a', label, { timeout: 10000 })
      .first()
      .click({ force: true });
  });
}

function seleccionarPrimeraFila(options) {
  return cy.get(options.rowSelector, { timeout: 10000 })
    .should('have.length.greaterThan', 0)
    .first()
    .then(($row) => {
      const clickFila = () => cy.wrap($row).click({ force: true });

      if (options.selectionStrategy === 'checkbox') {
        const $checkbox = $row.find(options.rowCheckboxSelector).filter(':visible').first();
        if ($checkbox.length) {
          return cy.wrap($checkbox).click({ force: true });
        }
      }

      return clickFila()
        .then(() => existeBotonAccionesVisible(options.actionsLabel))
        .then((hayAcciones) => {
          if (hayAcciones) return cy.wrap(null);

          const $checkbox = $row.find(options.rowCheckboxSelector).filter(':visible').first();
          if ($checkbox.length) {
            return cy.wrap($checkbox).click({ force: true });
          }

          return cy.wrap(null);
        });
    });
}

export function listadoSeleccionUnica(config = {}) {
  const options = normalizarConfig(config);
  return cy.get(options.rowSelector, { timeout: 10000 })
    .should('have.length.greaterThan', 0)
    .first()
    .click({ force: true })
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)));
}

export function listadoSeleccionMultiple(config = {}) {
  const options = normalizarConfig(config);
  return cy.get(options.rowSelector, { timeout: 10000 })
    .should('have.length.greaterThan', 1)
    .then(() => cy.get(options.rowSelector, { timeout: 10000 }).eq(0).click({ force: true }))
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)))
    .then(() => cy.get(options.rowSelector, { timeout: 10000 }).eq(1).click({ force: true }))
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)));
}

export function listadoSeleccionarTodos(config = {}) {
  const options = normalizarConfig(config);
  return cy.get(options.checkboxSelector, { timeout: 10000 })
    .filter(':visible')
    .first()
    .click({ force: true })
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)))
    .then(() =>
      cy.get(options.checkboxSelector, { timeout: 10000 })
        .filter(':visible')
        .first()
        .click({ force: true })
    )
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)));
}

export function listadoAbrirAcciones(config = {}) {
  const options = normalizarConfig(config);
  return seleccionarPrimeraFila(options)
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)))
    .then(() => clickPrimerElementoVisiblePorTexto(options.actionsLabel))
    .then(() => (options.waitAfterOpen ? cy.wait(options.waitAfterOpen) : cy.wrap(null)));
}

export function listadoBorradoMasivoCancelar(config = {}) {
  const options = normalizarConfig(config);
  return listadoAbrirAcciones(options)
    .then(() => clickPrimerElementoVisiblePorTexto(options.deleteLabel))
    .then(() => (options.waitAfterSelect ? cy.wait(options.waitAfterSelect) : cy.wrap(null)))
    .then(() => confirmarModal(options.confirmTexts));
}

export function listadoBorradoMasivoConfirmar(config = {}) {
  const options = normalizarConfig(config);
  return listadoBorradoMasivoCancelar(options)
    .then(() => cy.get(options.rowAssertSelector, { timeout: 10000 }).should('exist'));
}
