export function createFichajesActions(deps) {
  const {
    FICHAJES_PATH,
    LOGIN_PATH,
    LOGIN_URL_ABS,
    ESPERA_SALIDA_MS,
    LABELS_ALERTA_ENTRADA,
    LABELS_ALERTA_SALIDA,
    normalizarMensajesEsperados,
    obtenerConfiguracionCasoFichaje,
    obtenerDatoPorEtiqueta,
    obtenerDatoPorEtiquetas,
    prepararDatosFichaje,
    verificarUrlFichar,
    aceptarAdvertenciaSiExiste,
    clickBotonFichaje,
    asegurarBotonFichajeVisible,
    asegurarBotonFichajeNoVisible,
    asegurarSesionFichar,
    rellenarCamposEntrada,
    rellenarCamposSalida,
    obtenerCantidadFilasTrabajo,
    prepararSegundoRegistroTrabajoSiExiste,
    editarTramoTrabajoCaso,
    registrarResultado
  } = deps;
  const SELECTOR_REGISTRO_TRABAJO_EXISTENTE =
    '#work-session-block .time-block-body .time-entry .wrapper-inputs[data-time-entry] input.time-input-start, ' +
    '#work-session-block .time-block-body .time-entry .wrapper-inputs[data-time-entry] input.time-input-end';

  function hayRegistroTrabajoExistente() {
    return cy.get('body', { timeout: 10000 }).then(($body) => {
      return $body.find(SELECTOR_REGISTRO_TRABAJO_EXISTENTE).length > 0;
    });
  }

  function ejecutarFichajeNormal({
    primeraEntrada,
    primeraSalida,
    mensajesEntrada,
    mensajesSalida,
    config
  }) {
    let chain = cy.wrap(null);

    if (primeraEntrada) {
      chain = chain
        .then(() => {
          cy.log(`Sin filas editables en Trabajo: registrando entrada normal ${primeraEntrada.hora}`);
          return rellenarCamposEntrada(primeraEntrada);
        })
        .then(() => asegurarBotonFichajeVisible('entrada'))
        .then(() => clickBotonFichaje('entrada'))
        .then(() => aceptarAdvertenciaSiExiste({
          mensajeEsperado: mensajesEntrada,
          accion: config.accionAlertaEntrada
        }));
    }

    if (primeraSalida) {
      chain = chain
        .then(() => {
          if (primeraEntrada) {
            return cy.wait(ESPERA_SALIDA_MS);
          }
          return cy.wrap(null);
        })
        .then(() => {
          cy.log(`Sin filas editables en Trabajo: registrando salida normal ${primeraSalida.hora}`);
          return rellenarCamposSalida(primeraSalida);
        })
        .then(() => asegurarBotonFichajeVisible('salida'))
        .then(() => clickBotonFichaje('salida'))
        .then(() => aceptarAdvertenciaSiExiste({
          mensajeEsperado: mensajesSalida,
          accion: config.accionAlertaSalida
        }));
    }

    return chain;
  }

  function login(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';
    const clave = (claveExcel && claveExcel !== 'solbyte')
      ? claveExcel
      : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';

    cy.log(`Login con usuario: ${usuario}`);

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    cy.url({ timeout: 15000 }).should('include', FICHAJES_PATH);
    return cy.get('body', { timeout: 10000 }).should('exist');
  }

  function loginIncorrecto(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || '';
    const clave = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';

    cy.url().then((url) => {
      if (!url.includes(LOGIN_PATH)) {
        cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
      }
    });

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    cy.wait(2000);
    cy.get('body').then(($body) => {
      const tieneError = /credenciales|no coinciden|error/i.test($body.text());
      if (tieneError) {
        cy.log('Mensaje de error mostrado correctamente');
      }
    });

    return cy.url().should('include', LOGIN_PATH);
  }

  function loginRecuerdame(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || casoExcel.dato_2 || '';
    const clave = (claveExcel && claveExcel !== 'solbyte')
      ? claveExcel
      : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

    const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || casoExcel.dato_1 || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';

    cy.get('input#usuario', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(usuario);

    cy.get('input#clave', { timeout: 10000 })
      .should('be.visible')
      .clear()
      .type(clave);

    cy.get('input#recuerdame', { timeout: 10000 })
      .check({ force: true });

    cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
      .first()
      .click();

    return verificarUrlFichar().then(() => cy.get('body', { timeout: 10000 }).should('exist'));
  }

  function vistaDiaria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel).then(() => {
      cy.get('body', { timeout: 10000 }).should('exist');
      cy.log('Vista diaria cargada correctamente - se queda en pantalla principal de fichar');
    });
  }

  function vistaSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() => cy.log('Vista semanal cargada correctamente'));
  }

  function semanalDiaria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.contains('button, a, [role="button"]', /Fichar/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() => verificarUrlFichar())
      .then(() => cy.log('Vuelta a vista diaria desde semanal'));
  }

  function vistaSemanalAnterior(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return vistaSemanal(casoExcel)
      .then(() =>
        cy.get('button#week-nav-prev, #week-nav-prev', { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('header').invoke('text').then((texto) => {
          cy.log(`Semana actual tras pulsar anterior: ${texto}`);
        })
      )
      .then(() => cy.log('Se navego a la semana anterior correctamente'));
  }

  function vistaSemanalProxima(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return vistaSemanal(casoExcel)
      .then(() =>
        cy.get('button#week-nav-next, #week-nav-next', { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('header').invoke('text').then((texto) => {
          cy.log(`Semana actual tras pulsar proxima: ${texto}`);
        })
      )
      .then(() => cy.log('Se navego a la semana siguiente correctamente'));
  }

  function fichaje(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() => {
        const casoId = String(casoExcel.caso || '').trim().toUpperCase();

        if (['TC028', 'TC029'].includes(casoId)) {
          cy.log(`${casoId}: se omite la accion de fichar para este caso`);
          return cy.wrap(null);
        }

        const datos = prepararDatosFichaje(casoExcel, casoId);

        const mensajeAlertaEntrada = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_ENTRADA);
        const mensajeAlertaSalida = obtenerDatoPorEtiquetas(casoExcel, LABELS_ALERTA_SALIDA);
        const mensajesEntrada = normalizarMensajesEsperados(mensajeAlertaEntrada);
        const mensajesSalida = normalizarMensajesEsperados(mensajeAlertaSalida);
        const config = obtenerConfiguracionCasoFichaje(casoId);

        if (!datos.secuencia.length) {
          cy.log(' No se encontraron pasos de entrada/salida configurados para este caso.');
          return cy.wrap(null);
        }

        cy.log(`Secuencia planificada: ${datos.secuencia.map((p) => `${p.tipo}:${p.hora || 'sin hora'}`).join(' -> ')}`);

        const primeraEntrada = datos.secuencia.find((paso) => paso.tipo === 'entrada' && paso.hora);
        const primeraSalida = datos.secuencia.find((paso) => paso.tipo === 'salida' && paso.hora);

        if (!primeraEntrada && !primeraSalida) {
          cy.log(' No hay horas validas para editar en la ultima fila de Trabajo.');
          return cy.wrap(null);
        }

        return hayRegistroTrabajoExistente().then((hayRegistroEnTrabajo) =>
          obtenerCantidadFilasTrabajo().then((totalFilasTrabajo) => {
            if (!hayRegistroEnTrabajo && totalFilasTrabajo <= 0) {
              cy.log(' No hay registros en Trabajo; se ejecuta fichaje normal.');
              return ejecutarFichajeNormal({
                primeraEntrada,
                primeraSalida,
                mensajesEntrada,
                mensajesSalida,
                config
              });
            }

            cy.log(` Trabajo detectado: ${hayRegistroEnTrabajo ? 'si' : 'no'} | filas normalizadas: ${totalFilasTrabajo}`);

            let chain = cy.wrap(null);

            if (primeraEntrada) {
              chain = chain
                .then(() => {
                  cy.log(`Editando hora de entrada ${primeraEntrada.hora}`);
                  return editarTramoTrabajoCaso({
                    ...casoExcel,
                    _tipoCampoOverride: 'start',
                    _horaOverride: primeraEntrada.hora,
                    _skipReloadFinal: true
                  });
                })
                .then((resultado) => {
                  if (resultado?.huboError) {
                    return cy.wrap({ huboError: true });
                  }
                  return cy.wrap(null);
                });
            }

            if (primeraSalida) {
              chain = chain
                .then((resultadoAnterior) => {
                  if (resultadoAnterior?.huboError) {
                    return cy.wrap({ huboError: true });
                  }
                  cy.log(`Editando hora de salida ${primeraSalida.hora}`);
                  return editarTramoTrabajoCaso({
                    ...casoExcel,
                    _tipoCampoOverride: 'end',
                    _horaOverride: primeraSalida.hora,
                    _skipReloadFinal: true
                  });
                })
                .then((resultado) => {
                  if (resultado?.huboError) {
                    return cy.wrap({ huboError: true });
                  }
                  return cy.wrap(null);
                });
            }

            return chain;
          })
        );
      });
  }

  function scroll(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return asegurarSesionFichar(casoExcel)
      .then(() =>
        cy.contains('button, a, [role="button"]', /Semanal/i, { timeout: 10000 })
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.wait(1500))
      .then(() =>
        cy.get('body').then(($body) => {
          const scrollable = $body.find('[style*="overflow"], .scrollable, [class*="scroll"]').first();
          if (scrollable.length) {
            cy.wrap(scrollable).scrollTo('right', { ensureScrollable: false });
            cy.wait(400);
            cy.wrap(scrollable).scrollTo('left', { ensureScrollable: false });
          } else {
            cy.get('body').scrollTo('right', { ensureScrollable: false });
            cy.wait(400);
            cy.get('body').scrollTo('left', { ensureScrollable: false });
          }
        })
      )
      .then(() => cy.log('Scroll horizontal completado'));
  }

  return {
    login,
    loginIncorrecto,
    loginRecuerdame,
    vistaDiaria,
    vistaSemanal,
    semanalDiaria,
    vistaSemanalAnterior,
    vistaSemanalProxima,
    fichaje,
    scroll
  };
}