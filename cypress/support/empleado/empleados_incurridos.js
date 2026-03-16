export function createEmpleadosIncurridosActions(deps) {
  const {
    EMPLEADOS_PATH,
    abrirFormularioCrearEmpleado,
    enviarFormularioCrear,
    escribirCampo,
    escribirCampoFormulario,
    esperarToastExito,
    obtenerValorEmail,
    obtenerValorEmpresa,
    obtenerValorGrupo,
    obtenerValorNombre,
    registrarResultado,
    seleccionarEmpresa,
    seleccionarGrupo
  } = deps;

  function verificarMensajeFichajes() {
    cy.log('TC044: Verificando que aparezca el mensaje sobre fichajes...');
    cy.wait(1000);
    return cy.contains('div, span, p', /El usuario tiene fichajes hoy\. El cambio debe aplicarse a partir de mañana\./i, { timeout: 10000 })
      .should('be.visible')
      .then(() => {
        cy.log('TC044: Se encontro el mensaje sobre fichajes correctamente');
      });
  }

  function empleadoSinIncurridos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel);
    let nombre = obtenerValorNombre(casoExcel) || 'SinIncurridosXXX';
    if (nombre.includes('XXX')) {
      const randomNum = Math.floor(Math.random() * 900) + 100;
      nombre = nombre.replace(/XXX/g, randomNum.toString());
    }

    let email = obtenerValorEmail(casoExcel) || 'prueba@pruebasinincurridosXXX';
    if (email.includes('XXX')) {
      const randomNum = Math.floor(Math.random() * 900) + 100;
      email = email.replace(/XXX/g, randomNum.toString());
    }

    const grupo = obtenerValorGrupo(casoExcel) || 'Grupo sin incurridos';

    return abrirFormularioCrearEmpleado()
      .then((resultado) => {
        if (resultado && resultado.error) {
          const casoId = casoExcel.caso || 'TC000';
          const nombreCaso = `${casoId} - ${casoExcel.nombre}`;
          registrarResultado(casoId, nombreCaso, 'Comportamiento correcto', resultado.mensaje || `ERROR: ${resultado.error}`, 'ERROR');
          return cy.wrap({ huboError: true });
        }
        return seleccionarEmpresa(empresa);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return escribirCampo('input[name="data.name"], input#data\\.name', nombre);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return escribirCampoFormulario('input[name="data.email"], input#data\\.email', email);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return seleccionarGrupo(grupo);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return enviarFormularioCrear();
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return esperarToastExito();
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        cy.log('TC043: Verificando que el empleado se creo correctamente y el grupo se asigno desde hoy');
        cy.wait(1000);
        return null;
      });
  }

  function empleadoConincurridos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type('superadmin', { force: true })
      .type('{enter}', { force: true })
      .then(() => cy.wait(800))
      .then(() => {
        return cy.get('body', { timeout: 5000 }).then(($body) => {
          const tieneListado = $body.find('.fi-ta-table, table, .fi-ta-row, tr, .fi-empty-state, .fi-ta-empty-state').length > 0;
          const texto = $body.text() ? $body.text().toLowerCase() : '';
          const tieneError500 = texto.includes('500') ||
            texto.includes('internal server error') ||
            texto.includes('error interno del servidor') ||
            texto.includes('server error') ||
            texto.includes('500 server error');

          if ((!$body || !$body.length) || (tieneError500 && !tieneListado)) {
            const casoId = casoExcel.caso || 'TC000';
            const nombreCaso = `${casoId} - ${casoExcel.nombre}`;
            registrarResultado(casoId, nombreCaso, 'Comportamiento correcto', 'ERROR 500: Error interno del servidor detectado despues de buscar', 'ERROR');
            return cy.wrap({ huboError: true });
          }

          if ($body.find('.fi-empty-state, .fi-ta-empty-state').length) {
            cy.contains('.fi-empty-state, .fi-ta-empty-state', /No se encontraron registros/i).should('be.visible');
          } else {
            cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
          }

          cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
          cy.wait(400);
          cy.get('.fi-ta-row:visible').first().within(() => {
            cy.contains('button, a', /Editar/i).click({ force: true });
          });

          return null;
        });
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return cy.url({ timeout: 10000 }).should('include', `${EMPLEADOS_PATH}/`).and('include', '/edit');
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return cy.wait(500);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return cy.get('body', { timeout: 5000 }).then(($body) => {
          const tieneFormularioEdicion = $body.find('input[name="data.name"], input#data\\.name, input[name="data.email"], input#data\\.email, #data\\.current_group_id').length > 0;
          const texto = $body.text() ? $body.text().toLowerCase() : '';
          const tieneError500 = texto.includes('500') ||
            texto.includes('internal server error') ||
            texto.includes('error interno del servidor') ||
            texto.includes('server error') ||
            texto.includes('500 server error');

          if ((!$body || !$body.length) || (tieneError500 && !tieneFormularioEdicion)) {
            const casoId = casoExcel.caso || 'TC000';
            const nombreCaso = `${casoId} - ${casoExcel.nombre}`;
            registrarResultado(casoId, nombreCaso, 'Comportamiento correcto', 'ERROR 500: Error interno del servidor detectado en el formulario de edicion', 'ERROR');
            return cy.wrap({ huboError: true });
          }

          cy.scrollTo('bottom', { duration: 500, ensureScrollable: false });
          cy.wait(300);

          return cy.contains('label, span, div', /Grupo/i, { timeout: 10000 })
            .scrollIntoView({ duration: 300 })
            .then(($label) => {
              const wrappers = [
                $label.closest('[data-field-wrapper]'),
                $label.closest('.fi-field'),
                $label.closest('.fi-fo-field-wrp'),
                $label.closest('.fi-fo-field'),
                $label.closest('.grid'),
                $label.closest('section'),
                $label.closest('form'),
                $label.parent()
              ].filter(($el) => $el && $el.length);

              const openersSelector = '.choices, .choices[data-type="select-one"], [role="combobox"], [aria-haspopup="listbox"], select, .fi-select-trigger';
              let encontrado = false;

              for (const $wrapper of wrappers) {
                const $objetivo = $wrapper.find(openersSelector).filter(':visible').first();
                if ($objetivo.length) {
                  cy.wrap($objetivo).scrollIntoView().click({ force: true });
                  cy.wait(500);
                  encontrado = true;
                  break;
                }
              }

              if (!encontrado) {
                cy.get(openersSelector, { timeout: 10000 })
                  .filter(':visible')
                  .first()
                  .scrollIntoView()
                  .click({ force: true });
                cy.wait(500);
              }

              return cy.wait(500)
                .then(() => cy.get('body'))
                .then(($bodySeleccion) => {
                  const $dropdown = $bodySeleccion.find('.choices__list--dropdown.is-active:visible, [role="listbox"]:visible').first();
                  if ($dropdown.length === 0) return cy.wrap({ huboError: true });

                  const $opciones = $dropdown.find('.choices__item--choice:visible, [role="option"]:visible');
                  if ($opciones.length === 0) return cy.wrap({ huboError: true });

                  const grupoActual = $bodySeleccion.find('.choices__item--selectable.is-selected, .choices__item--selected').text().trim().toLowerCase();
                  const $opcionesDiferentes = $opciones.filter((i, el) => {
                    const textoOpcion = Cypress.$(el).text().trim().toLowerCase();
                    return textoOpcion !== grupoActual && textoOpcion.length > 0;
                  });

                  if ($opcionesDiferentes.length > 0) {
                    cy.wrap($opcionesDiferentes).first().scrollIntoView().click({ force: true });
                  } else if ($opciones.length > 1) {
                    cy.wrap($opciones).eq(1).scrollIntoView().click({ force: true });
                  } else {
                    return cy.wrap({ huboError: true });
                  }

                  return cy.wait(1000)
                    .then(() => cy.get('body', { timeout: 10000 }))
                    .then(($bodyFinal) => {
                      const textoFinal = $bodyFinal.text() ? $bodyFinal.text().toLowerCase() : '';
                      const tieneFormularioEdicionFinal = $bodyFinal.find('input[name="data.name"], input#data\\.name, input[name="data.email"], input#data\\.email, #data\\.current_group_id').length > 0;
                      const tieneMensajeFichajes = /el usuario tiene fichajes hoy\. el cambio debe aplicarse a partir de mañana\./i.test(textoFinal);
                      const tieneError500Final = textoFinal.includes('500') ||
                        textoFinal.includes('internal server error') ||
                        textoFinal.includes('error interno del servidor') ||
                        textoFinal.includes('server error') ||
                        textoFinal.includes('500 server error') ||
                        $bodyFinal.find('[class*="error-500"], [class*="error500"], [id*="error-500"]').length > 0;

                      if (tieneMensajeFichajes) return verificarMensajeFichajes();

                      if (tieneError500Final && !tieneFormularioEdicionFinal) {
                        const casoId = casoExcel.caso || 'TC000';
                        const nombreCaso = `${casoId} - ${casoExcel.nombre}`;
                        registrarResultado(casoId, nombreCaso, 'Comportamiento correcto', 'ERROR 500: Error interno del servidor detectado al cambiar el grupo', 'ERROR');
                        return cy.wrap({ huboError: true });
                      }

                      return verificarMensajeFichajes();
                    });
                });
            });
        });
      });
  }

  return {
    empleadoConIncurridos: empleadoConincurridos,
    empleadoConincurridos,
    empleadoSinIncurridos
  };
}
