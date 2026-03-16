export function createEmpresasFiltrosActions() {
  function soloActivas(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.uiFiltrarPorSelectEnPanel('Activas', 'Estado')
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
          .should('have.length.greaterThan', 0)
      );
  }

  return {
    soloActivas
  };
}