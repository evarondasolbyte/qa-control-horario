export function createDepartamentosFormularioActions(deps) {
  const {
    DEPARTAMENTOS_PATH,
    abrirFormularioCrearDepartamento,
    escribirCampo,
    encontrarBotonAlFinal,
    esperarToastExito,
    limpiarCampo,
    obtenerValorDescripcion,
    obtenerValorEmpresa,
    obtenerValorNombreDepartamento,
    procesarNombreDepartamento,
    seleccionarEmpresa
  } = deps;

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearDepartamento();
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearDepartamento()
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', DEPARTAMENTOS_PATH));
  }

  function abrirPrimeraFilaAccion(textoAccion) {
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);

    return cy.get('body').then(($body) => {
      if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length > 0) {
        cy.log('Cerrando modal abierto antes de continuar...');
        cy.get('body').type('{esc}');
        cy.wait(500);
      }
    }).then(() => {
      cy.get('.fi-ta-row:visible').first().within(() => {
        cy.contains('button, a', new RegExp(textoAccion, 'i'), { timeout: 10000 })
          .first()
          .click({ force: true });
      });
      return cy.wrap(null);
    });
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirPrimeraFilaAccion('Editar')
      .then(() => cy.url({ timeout: 10000 }).should('include', `${DEPARTAMENTOS_PATH}/`));
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario(casoExcel)
      .then(() => {
        return cy.contains('button, a', /^\s*Cancelar\s*$/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .click({ force: true });
      })
      .then(() => cy.url({ timeout: 10000 }).should('include', DEPARTAMENTOS_PATH));
  }

  function verDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirPrimeraFilaAccion('Ver')
      .then(() => cy.contains(/Vista de departamento/i, { timeout: 10000 }).should('be.visible'))
      .then(() => cy.get('.fi-modal, [role="dialog"]', { timeout: 10000 }).should('be.visible'));
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);
    const empresa = obtenerValorEmpresa(casoExcel);
    const nombre = procesarNombreDepartamento(obtenerValorNombreDepartamento(casoExcel), numero);
    const descripcion = obtenerValorDescripcion(casoExcel);

    cy.log(`Crear departamento con empresa="${empresa}", nombre="${nombre}", descripcion="${descripcion}"`);

    return abrirFormularioCrearDepartamento()
      .then(() => {
        if (empresa && numero !== 21) {
          return seleccionarEmpresa(empresa);
        }
        return null;
      })
      .then(() => {
        const selectorNombre = 'input[name="data.name"], input#data\\.name';
        if (nombre && numero !== 22) {
          return escribirCampo(selectorNombre, nombre);
        }
        if (numero === 22) {
          return limpiarCampo(selectorNombre);
        }
        return null;
      })
      .then(() => {
        if (descripcion) {
          return escribirCampo(
            'textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description, trix-editor[name="data.description"]',
            descripcion
          );
        }
        return null;
      })
      .then(() => {
        if (numero === 20) {
          return encontrarBotonAlFinal('Cancelar')
            .then(() => cy.url({ timeout: 10000 }).should('include', DEPARTAMENTOS_PATH));
        }

        return encontrarBotonAlFinal('Crear').then(() => {
          if (numero === 18 || numero === 21 || numero === 22 || numero === 23) {
            return cy.wait(2000);
          }
          return esperarToastExito();
        });
      });
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);
    const empresa = numero === 25 ? '' : obtenerValorEmpresa(casoExcel);
    const nombreBase = obtenerValorNombreDepartamento(casoExcel);
    const nombre = numero === 25 && nombreBase ? `${nombreBase}23` : nombreBase;

    cy.log(`Editar departamento con empresa="${empresa}", nombre="${nombre}"`);

    return editarAbrirFormulario(casoExcel)
      .then(() => {
        if (numero === 26) {
          return cy.contains('button, a', /^\s*Cancelar\s*$/i, { timeout: 10000 })
            .filter(':visible')
            .first()
            .click({ force: true })
            .then(() => cy.url({ timeout: 10000 }).should('include', DEPARTAMENTOS_PATH));
        }
        return null;
      })
      .then(() => {
        if (numero === 26) return null;
        if (empresa) {
          return seleccionarEmpresa(empresa);
        }
        return null;
      })
      .then(() => {
        if (numero === 26) return null;
        if (nombre) {
          return escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        }
        return null;
      })
      .then(() => {
        if (numero === 26) return null;
        return cy.contains('button, a, input[type="submit"]', /Guardar cambios|Guardar/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
      })
      .then(() => cy.wait(2000));
  }

  return {
    abrirFormularioCrear,
    crearCancelar,
    editarAbrirFormulario,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual,
    verDepartamento
  };
}
