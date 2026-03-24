export function createJornadaSemanalFormularioActions(deps) {
  const {
    incrementarContadorPrueba,
    generarNombreUnico,
    JORNADA_SEMANAL_PATH,
    obtenerCamposDesdeExcel,
    obtenerDatoPorEtiqueta,
    seleccionarEmpresaFormulario,
    verificarError500DespuesCrear
  } = deps;

  function abrirFormularioCrear() {
    cy.contains('a, button', /Crear Jornada Semanal/i, { timeout: 10000 }).first().click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornada-semanal/create');
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    const campos = obtenerCamposDesdeExcel(casoExcel);
    let empresa = campos['data.company_id'] || casoExcel.dato_1 || 'Admin';
    let nombre = campos['data.name'] || casoExcel.dato_2 || generarNombreUnico('jornada');
    let horas = campos['data.weekly_hours_hours'] || casoExcel.dato_3 || '40';
    let minutos = campos['data.weekly_hours_minutes'] || casoExcel.dato_4 || '0';
    const descripcion = campos['data.description'] || casoExcel.dato_5 || '';

    if (nombre.includes('prueba1+')) {
      if (numero === 16) {
        nombre = nombre.replace('prueba1+', 'prueba1');
      } else {
        nombre = nombre.replace('prueba1+', `prueba${incrementarContadorPrueba()}`);
      }
    }

    if (horas && typeof horas === 'number') horas = String(horas);
    if (minutos && typeof minutos === 'number') minutos = String(minutos);

    return cy.url().then((urlActual) => {
      if (!urlActual.includes('/jornada-semanal/create')) {
        return abrirFormularioCrear().then(() => cy.wait(800));
      }
      return cy.wrap(null);
    }).then(() => {
      if (numero !== 19) {
        seleccionarEmpresaFormulario(empresa);
      }

      if (numero === 20) {
        cy.uiLimpiarCampo('input[name="data.name"], input#data\\.name');
      } else if (nombre) {
        cy.uiEscribirCampo('input[name="data.name"], input#data\\.name', nombre);
      }

      if (numero === 21) {
        cy.uiLimpiarCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours');
      } else if (horas) {
        cy.uiEscribirCampo('input[name="data.weekly_hours_hours"], input#data\\.weekly_hours_hours', horas);
      }

      if (minutos !== undefined) {
        cy.uiEscribirCampo('input[name="data.weekly_hours_minutes"], input#data\\.weekly_hours_minutes', minutos);
      }

      if (descripcion) {
        cy.uiEscribirCampo('textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description', descripcion);
      }

      if (numero === 18) {
        return cy.uiEncontrarBotonAlFinal('Cancelar')
          .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
      }

      if (numero === 17) {
        return cy.uiEncontrarBotonAlFinal('Crear y crear otro')
          .then(() => cy.wait(2000))
          .then(() => verificarError500DespuesCrear(casoExcel, numero));
      }

      if ([36, 37].includes(numero)) {
        return cy.uiEncontrarBotonAlFinal('Crear')
          .then(() => cy.wait(1500))
          .then(() => verificarError500DespuesCrear(casoExcel, numero))
          .then((huboError) => {
            if (huboError) return cy.wrap(null);
            cy.get('body').should(($body) => {
              const texto = $body.text().toLowerCase();
              expect(texto).to.include('minut');
            });
            return cy.url().should('include', '/jornada-semanal/create');
          });
      }

      return cy.uiEncontrarBotonAlFinal('Crear')
        .then(() => cy.wait(2000))
        .then(() => verificarError500DespuesCrear(casoExcel, numero));
    });
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrear()
      .then(() => cy.uiEncontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
  }

  function editarAbrirFormulario() {
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(300);
    cy.contains('.fi-ta-row:visible a, .fi-ta-row:visible button', /Editar/i, { timeout: 10000 })
      .first()
      .click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornada-semanal/');
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const numero = parseInt(String(casoExcel.caso || '').replace(/[^0-9]/g, ''), 10);
    const nombre = obtenerDatoPorEtiqueta(casoExcel, 'data.name') || casoExcel.dato_1 || generarNombreUnico('jornada-edit');

    if (numero === 27) {
      return editarAbrirFormulario()
        .then(() => cy.uiEncontrarBotonAlFinal('Cancelar'))
        .then(() => cy.get('body').then(($body) => {
          if ($body.find('.fi-modal:visible, [role="dialog"]:visible, .swal2-container:visible').length) {
            return cy.uiConfirmarModal(['Si', 'Sí', 'Salir', 'Descartar', 'Aceptar', 'Confirmar', 'Cancelar', 'Cerrar', 'No']);
          }
          return cy.wrap(null);
        }))
        .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
    }

    return editarAbrirFormulario()
      .then(() => cy.uiEscribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => cy.uiEncontrarBotonAlFinal('Guardar cambios'))
      .then(() => cy.uiEsperarToastExito());
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario()
      .then(() => cy.uiEncontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', JORNADA_SEMANAL_PATH));
  }

  return {
    abrirFormularioCrear,
    crearCancelar,
    crearCancelarCaso: crearCancelar,
    crearConTodo: ejecutarCrearIndividual,
    crearDuplicado: ejecutarCrearIndividual,
    crearMinima: ejecutarCrearIndividual,
    crearYCrearOtro: ejecutarCrearIndividual,
    editarAbrirFormulario,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual,
    validarEmpresaObligatoria: ejecutarCrearIndividual,
    validarHorasObligatorias: ejecutarCrearIndividual,
    validarLongitudNombre: ejecutarCrearIndividual,
    validarNombreObligatorio: ejecutarCrearIndividual
  };
}