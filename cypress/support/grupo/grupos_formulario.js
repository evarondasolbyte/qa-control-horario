export function createGruposFormularioActions(deps) {
  const {
    GRUPOS_PATH,
    GRUPOS_URL_ABS,
    abrirFormularioCrearGrupo,
    encontrarBotonAlFinal,
    enviarFormularioCrear,
    escribirCampo,
    esperarToastExito,
    generarNombreUnico,
    limpiarCampo,
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerValorEmpresa,
    obtenerValorNombreGrupo,
    reemplazarConNumeroAleatorio,
    seleccionarEmpresa,
    verificarErrorEsperado
  } = deps;

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearGrupo();
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    let nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');
    const descripcion = obtenerDatoPorEtiqueta(casoExcel, 'data.description') || obtenerDatoEnTexto(casoExcel, 'descripcion');

    if (nombre.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      nombre = nombre.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      nombre = nombre.replace('prueba1+', 'prueba1');
    }

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => {
        if (descripcion) {
          return escribirCampo('textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description', descripcion);
        }
        return null;
      })
      .then(() => enviarFormularioCrear())
      .then(() => {
        if (casoExcel.caso === 'TC017') {
          return cy.wait(1500);
        }
        return esperarToastExito();
      });
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearGrupo()
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH));
  }

  function validarEmpresaObligatoria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');

    return abrirFormularioCrearGrupo()
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['empresa', 'obligatoria']));
  }

  function validarNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => limpiarCampo('input[name="data.name"], input#data\\.name'))
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['nombre', 'obligatorio']));
  }

  function validarLongitudNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('nombre-largo');

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => enviarFormularioCrear())
      .then(() => esperarToastExito());
  }

  function vincularEmpleado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    const nombreGrupoOriginal = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');

    let nombreEmpleado = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.name') ||
      obtenerDatoEnTexto(casoExcel, 'nombre') ||
      casoExcel.dato_1 ||
      'Empleado';

    let apellidosEmpleado = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.surname') ||
      obtenerDatoEnTexto(casoExcel, 'apellidos') ||
      casoExcel.dato_2 ||
      'Empleado';

    let emailEmpleado = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.email') ||
      obtenerDatoEnTexto(casoExcel, 'email') ||
      casoExcel.dato_3 ||
      'empleado@example.com';

    nombreEmpleado = reemplazarConNumeroAleatorio(nombreEmpleado, numero);
    apellidosEmpleado = reemplazarConNumeroAleatorio(apellidosEmpleado, numero);
    emailEmpleado = reemplazarConNumeroAleatorio(emailEmpleado, numero);

    let nombreGrupoTransformado = nombreGrupoOriginal;
    if (nombreGrupoOriginal.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      nombreGrupoTransformado = nombreGrupoOriginal.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      nombreGrupoTransformado = nombreGrupoOriginal.replace('prueba1+', 'prueba1');
    }

    return ejecutarCrearIndividual({
      ...casoExcel,
      dato_1: empresa,
      dato_2: nombreGrupoOriginal
    })
      .then(() => {
        cy.url({ timeout: 10000 }).then((currentUrl) => {
          if (!currentUrl.includes(GRUPOS_PATH) || currentUrl.includes('/create') || currentUrl.includes('/edit')) {
            cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
            cy.wait(1000);
          }
        });

        cy.wait(1000);
        cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
        cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
        cy.wait(400);

        cy.get('body').then(($body) => {
          let $row = $body.find('.fi-ta-row:visible').filter((i, el) => {
            const text = Cypress.$(el).text();
            return text.includes(nombreGrupoTransformado) || nombreGrupoTransformado.includes(text.trim());
          }).first();

          if ($row.length === 0) {
            $row = $body.find('.fi-ta-row:visible').first();
          }

          if ($row.length > 0) {
            cy.wrap($row)
              .scrollIntoView()
              .within(() => {
                cy.contains('button, a', /Editar/i, { timeout: 10000 })
                  .should('be.visible')
                  .click({ force: true });
              });
          } else {
            cy.contains('.fi-ta-row:visible', /\S+/, { timeout: 10000 })
              .first()
              .within(() => {
                cy.contains('button, a', /Editar/i, { timeout: 10000 })
                  .should('be.visible')
                  .click({ force: true });
              });
          }
        });

        return cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH);
      })
      .then(() => {
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);

        cy.contains('button, a', /Crear empleado y vincular al equipo/i, { timeout: 10000 })
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });

        cy.wait(2000);

        const selectorNombre = 'input[name="mountedTableActionsData.0.name"], input#mountedTableActionsData\\.0\\.name, input[wire\\:model="mountedTableActionsData.0.name"], input[placeholder*="nombre" i], input[placeholder*="name" i]';
        const selectorApellidos = 'input[name="mountedTableActionsData.0.surname"], input#mountedTableActionsData\\.0\\.surname, input[wire\\:model="mountedTableActionsData.0.surname"], input[placeholder*="apellidos" i], input[placeholder*="surname" i]';
        const selectorEmail = 'input[name="mountedTableActionsData.0.email"], input#mountedTableActionsData\\.0\\.email, input[wire\\:model="mountedTableActionsData.0.email"], input[type="email"][placeholder*="email" i]';

        cy.scrollTo('bottom', { duration: 300 });
        cy.wait(1000);

        cy.get(selectorNombre, { timeout: 25000 })
          .should('exist')
          .should('be.visible')
          .scrollIntoView({ duration: 300 });

        cy.wait(300);
        cy.get(selectorApellidos, { timeout: 25000 }).should('exist').should('be.visible');
        cy.get(selectorEmail, { timeout: 25000 }).should('exist').should('be.visible');

        escribirCampo(selectorNombre, nombreEmpleado);
        cy.wait(300);
        escribirCampo(selectorApellidos, apellidosEmpleado);
        cy.wait(300);
        escribirCampo(selectorEmail, emailEmpleado);
        cy.wait(300);

        return encontrarBotonAlFinal('Crear');
      })
      .then(() => esperarToastExito())
      .then(() => encontrarBotonAlFinal('Guardar cambios'))
      .then(() => esperarToastExito());
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const casoId = String(casoExcel.caso || '').toUpperCase();

    if (casoId === 'TC041') {
      return cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]', { timeout: 10000 })
        .filter(':visible')
        .first()
        .clear({ force: true })
        .type('SuperAdmin Company', { force: true })
        .type('{enter}', { force: true })
        .then(() => cy.wait(1000))
        .then(() => {
          cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
          cy.wait(400);
          return cy.get('body').then(($body) => {
            const $filaEncontrada = $body.find('.fi-ta-row:visible, tbody tr:visible').filter((i, fila) => {
              const textoFila = Cypress.$(fila).text().toLowerCase();
              return textoFila.includes('superadmin company');
            }).first();

            if ($filaEncontrada.length) {
              cy.wrap($filaEncontrada)
                .scrollIntoView()
                .within(() => {
                  cy.contains('button, a', /Editar/i, { timeout: 10000 }).click({ force: true });
                });
            } else {
              throw new Error('TC041: No se encontro la fila de "SuperAdmin Company" para editar');
            }

            return cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH);
          });
        });
    }

    if (casoId === 'TC040') {
      return cy.get('body').then(($body) => {
        const $filas = $body.find('.fi-ta-row:visible, tr:visible');
        let $filaEncontrada = null;

        $filas.each((i, fila) => {
          const textoFila = Cypress.$(fila).text().toLowerCase();
          if (textoFila.includes('superadmin company')) {
            $filaEncontrada = Cypress.$(fila);
            return false;
          }
          return undefined;
        });

        if ($filaEncontrada && $filaEncontrada.length > 0) {
          cy.wrap($filaEncontrada)
            .scrollIntoView()
            .within(() => {
              cy.contains('button, a', /Editar/i).click({ force: true });
            });
        } else {
          cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
          cy.wait(400);
          cy.get('.fi-ta-row:visible').first().within(() => {
            cy.contains('button, a', /Editar/i).click({ force: true });
          });
        }

        return cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH);
      });
    }

    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(400);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.contains('button, a', /Editar/i).click({ force: true });
    });
    return cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH);
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo-editado');

    return editarAbrirFormulario(casoExcel)
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => cy.contains('button, a', /Guardar cambios/i, { timeout: 10000 }).click({ force: true }))
      .then(() => esperarToastExito());
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario(casoExcel)
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH));
  }

  return {
    abrirFormularioCrear,
    crearCancelar,
    editarAbrirFormulario,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual,
    validarEmpresaObligatoria,
    validarLongitudNombre,
    validarNombreObligatorio,
    vincularEmpleado
  };
}
