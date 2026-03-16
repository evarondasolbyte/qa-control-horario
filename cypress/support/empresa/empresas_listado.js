export function createEmpresasListadoActions() {
  function obtenerFilasTabla() {
    return cy.get('.fi-ta-row, tbody tr', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  }

  function abrirSelectorColumnas() {
    return cy.get('button[title*="Alternar columnas"], button[aria-label*="columns"], .fi-ta-col-toggle button', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true })
      .then(() => cy.wait(300));
  }

  function marcarColumna(labelRegex) {
    return abrirSelectorColumnas()
      .then(() =>
        cy.contains('label', labelRegex, { timeout: 5000 })
          .should('be.visible')
          .within(() => {
            cy.get('input[type="checkbox"]').then(($checkbox) => {
              if (!$checkbox.is(':checked')) {
                cy.wrap($checkbox).click({ force: true });
              }
            });
          })
      )
      .then(() => cy.get('body').click(0, 0, { force: true }))
      .then(() => cy.wait(300));
  }

  function ordenarPorColumna(labelHeader, labelColumna = null) {
    const patronColumna = labelColumna || labelHeader;
    return marcarColumna(patronColumna)
      .then(() =>
        cy.contains('th, .fi-ta-header-cell', labelHeader, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(300))
      .then(() =>
        cy.contains('th, .fi-ta-header-cell', labelHeader, { timeout: 10000 })
          .click({ force: true })
      )
      .then(() => obtenerFilasTabla());
  }

  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    return obtenerFilasTabla();
  }

  function ejecutarBusquedaIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valorBusqueda = casoExcel.dato_1;

    cy.log(`Aplicando busqueda: ${valorBusqueda}`);
    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${valorBusqueda}{enter}`, { force: true });

    cy.wait(1500);

    return cy.get('body').then(($body) => {
      const filasVisibles = $body.find('.fi-ta-row:visible, tr:visible').length;
      const totalFilas = $body.find('.fi-ta-row, tr').length;
      cy.log(`Filas visibles: ${filasVisibles}, Total filas: ${totalFilas}`);
      return cy.wrap(true);
    });
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valorBusqueda = casoExcel.dato_1;

    cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(`${valorBusqueda}{enter}`, { force: true });

    cy.wait(1500);

    return cy.get('body').then(($body) => {
      if ($body.find('[data-testid="clear-filter"], .MuiChip-deleteIcon').length > 0) {
        cy.get('[data-testid="clear-filter"], .MuiChip-deleteIcon').first().click({ force: true });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').clear({ force: true });
      }
    }).then(() =>
      cy.get('input[placeholder*="Buscar"], input[placeholder*="Search"]').should('have.value', '')
    );
  }

  function seleccionUnica(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoSeleccionUnica({
      rowSelector: '.fi-ta-row:visible, tbody tr:visible',
      waitAfterSelect: 0
    });
  }

  function seleccionMultiple(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoSeleccionMultiple({
      rowSelector: '.fi-ta-row:visible, tbody tr:visible',
      waitAfterSelect: 300
    });
  }

  function seleccionarTodos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoSeleccionarTodos({
      checkboxSelector: 'thead input[type="checkbox"], thead .fi-checkbox, .fi-ta-select-all input[type="checkbox"]',
      waitAfterSelect: 300
    });
  }

  function abrirAcciones(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoAbrirAcciones({
      rowSelector: '.fi-ta-row:visible, tbody tr:visible',
      waitAfterSelect: 400,
      waitAfterOpen: 0
    });
  }

  function borradoMasivoConfirmar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoBorradoMasivoConfirmar({
      rowSelector: '.fi-ta-row:visible, tbody tr:visible',
      rowAssertSelector: '.fi-ta-row, tbody tr',
      confirmTexts: ['Cancelar'],
      waitAfterSelect: 300,
      waitAfterOpen: 0
    }).then(() => obtenerFilasTabla());
  }

  function borradoMasivoCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.listadoBorradoMasivoCancelar({
      rowSelector: '.fi-ta-row:visible, tbody tr:visible',
      confirmTexts: ['Cancelar'],
      waitAfterSelect: 300,
      waitAfterOpen: 0
    }).then(() => obtenerFilasTabla());
  }

  function mostrarColumnaCreatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Created at/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function mostrarColumnaUpdatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Updated at/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function mostrarColumnaDeletedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Deleted at/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function mostrarColumnaContacto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Contacto/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function mostrarColumnaEmail(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Email/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function mostrarColumnaTelefono(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return marcarColumna(/Tel.fono|Phone/i).then(() => cy.get('.fi-ta-header-cell, th').should('be.visible'));
  }

  function ordenarCreatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Created at', /Created at/i);
  }

  function ordenarUpdatedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Updated at', /Updated at/i);
  }

  function ordenarDeletedAt(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna('Deleted at', /Deleted at/i);
  }

  function ordenarNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.contains('th, .fi-ta-header-cell', 'Nombre', { timeout: 10000 })
      .should('be.visible')
      .click({ force: true })
      .then(() => cy.wait(300))
      .then(() => cy.contains('th, .fi-ta-header-cell', 'Nombre').click({ force: true }))
      .then(() => obtenerFilasTabla());
  }

  function ordenarCIF(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.contains('th, .fi-ta-header-cell', 'CIF', { timeout: 10000 })
      .should('be.visible')
      .click({ force: true })
      .then(() => cy.wait(300))
      .then(() => cy.contains('th, .fi-ta-header-cell', 'CIF').click({ force: true }))
      .then(() => obtenerFilasTabla());
  }

  function ordenarActualizado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return ordenarPorColumna(/Actualizado el|Updated at/i, /Actualizado el|Updated at/i);
  }

  return {
    abrirAcciones,
    borradoMasivoCancelar,
    borradoMasivoConfirmar,
    cargarPantalla,
    ejecutarBusquedaIndividual,
    limpiarBusqueda,
    mostrarColumnaContacto,
    mostrarColumnaCreatedAt,
    mostrarColumnaDeletedAt,
    mostrarColumnaEmail,
    mostrarColumnaTelefono,
    mostrarColumnaUpdatedAt,
    ordenarActualizado,
    ordenarCIF,
    ordenarCreatedAt,
    ordenarDeletedAt,
    ordenarNombre,
    ordenarUpdatedAt,
    seleccionMultiple,
    seleccionUnica,
    seleccionarTodos
  };
}
