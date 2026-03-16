export function createEmpleadosListadoActions(deps) {
  const {
    extraerDesdeNombre,
    obtenerTextoBusqueda
  } = deps;

  function withLog(fn) {
    return (casoExcel) => {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return fn(casoExcel);
    };
  }

  function verEmpleado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    cy.get('body').type('{esc}{esc}');
    cy.wait(200);
    cy.get('.fi-ta-table, table').first().click({ force: true });
    cy.wait(200);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);

    cy.get('.fi-ta-row:visible', { timeout: 10000 }).first().then(($row) => {
      cy.wrap($row).scrollIntoView();
      cy.wait(300);

      cy.get('body').then(() => {
        const candidatos = [
          () => $row.find('button, a').filter((i, el) => /^Ver$/i.test(Cypress.$(el).text().trim())).first(),
          () => $row.find('a[href*="/edit"]').first(),
          () => $row.find('button[aria-label*="Ver"], a[aria-label*="Ver"]').first(),
          () => $row.find('button[data-action*="view"], a[data-action*="view"]').first()
        ];

        let $btn = Cypress.$();
        for (const fn of candidatos) {
          const found = fn();
          if (found && found.length) {
            $btn = found;
            break;
          }
        }

        if ($btn.length > 0) {
          cy.wrap($btn).scrollIntoView().click({ force: true });
        } else {
          cy.wrap($row).within(() => {
            cy.contains('button, a', /^Ver$/i, { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          });
        }
      });
    });

    return cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 }).should('be.visible');
  }

  return {
    cargarPantalla: withLog(() => cy.listadoCargarPantalla()),
    ejecutarBusquedaIndividual: withLog((casoExcel) => cy.listadoBuscar(obtenerTextoBusqueda(casoExcel))),
    limpiarBusqueda: withLog((casoExcel) => cy.listadoLimpiarBusqueda(obtenerTextoBusqueda(casoExcel))),
    seleccionUnica: withLog(() => cy.listadoSeleccionUnica()),
    seleccionMultiple: withLog(() => cy.listadoSeleccionMultiple()),
    seleccionarTodos: withLog(() => cy.listadoSeleccionarTodos()),
    abrirAcciones: withLog(() => cy.listadoAbrirAcciones()),
    borradoMasivoConfirmar: withLog(() => cy.listadoBorradoMasivoConfirmar()),
    borradoMasivoCancelar: withLog(() => cy.listadoBorradoMasivoCancelar()),
    mostrarColumna: withLog((casoExcel) => {
      const texto = extraerDesdeNombre(casoExcel.nombre, 'Mostrar columna') || casoExcel.dato_1 || 'Telefono';
      return cy.listadoMostrarColumna(texto);
    }),
    ordenarColumna: withLog((casoExcel) => {
      const texto = extraerDesdeNombre(casoExcel.nombre, 'Ordenar por') || casoExcel.dato_1 || 'Empresa';
      return cy.listadoOrdenarColumna(texto);
    }),
    verEmpleado: withLog(verEmpleado)
  };
}
