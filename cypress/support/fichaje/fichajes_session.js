export function createFichajesSessionUtils(config) {
  const {
    FICHAJES_URL_ABS,
    LOGIN_PATH,
    LOGIN_URL_ABS,
    obtenerDatoPorEtiqueta,
    normalizarMensajesEsperados,
    generarTextoAleatorio
  } = config;

  function verificarUrlFichar() {
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (currentUrl !== FICHAJES_URL_ABS) {
        cy.visit(FICHAJES_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
      } else {
        cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
      }
    });
  }

  function establecerValorInput(selector, valor) {
    if (valor === null || valor === undefined || valor === '') return cy.wrap(null);

    return cy.get(selector, { timeout: 10000 })
      .should('be.visible')
      .should('not.be.disabled')
      .then(($input) => {
        const tipo = ($input.attr('type') || '').toLowerCase();
        if (tipo === 'date' || tipo === 'time') {
          cy.wrap($input)
            .invoke('val', valor)
            .then(() => {
              cy.wrap($input)
                .trigger('input', { force: true })
                .trigger('change', { force: true })
                .trigger('blur', { force: true });
            });
        } else {
          cy.wrap($input)
            .clear({ force: true })
            .type(String(valor), { force: true });
        }
      });
  }

  function aceptarAdvertenciaSiExiste(opciones = {}) {
    const {
      timeout = 4000,
      mensajeEsperado,
      accion = 'omitir'
    } = opciones;

    const mensajesEsperados = normalizarMensajesEsperados(mensajeEsperado);
    const accionNormalizada = (accion || '').toLowerCase();

    return cy.get('body').then(($body) => {
      const hayModal =
        $body.text().includes('Entrada incorrecta') ||
        $body.text().includes('Salida incorrecta') ||
        $body.text().includes('Validaciones pendientes') ||
        $body.text().includes('Está entrando fuera del horario permitido') ||
        $body.text().includes('Está saliendo fuera del horario permitido') ||
        $body.find('textarea.notification-textarea').length > 0;

      if (!hayModal) {
        return cy.wrap(null);
      }

      let accionFinal = accionNormalizada;
      if (accionFinal === 'omitir') accionFinal = 'aceptar';

      const esAceptar = accionFinal === 'aceptar';
      const esCancelar = accionFinal === 'cancelar' || accionFinal === 'rechazar';
      let chain = cy.wrap(null);

      if (mensajesEsperados.length) {
        chain = chain.then(() =>
          cy.get('.notification-content', { timeout })
            .first()
            .invoke('text')
            .then((texto) => {
              const textoNormalizado = texto.replace(/\s+/g, ' ').toLowerCase();
              const faltantes = mensajesEsperados.filter(
                (m) => !textoNormalizado.includes(m.toLowerCase())
              );

              expect(
                faltantes.length,
                `El mensaje de alerta debe contener: ${mensajesEsperados.join(' | ')}`
              ).to.eq(0);
            })
        );
      }

      if (!esAceptar && !esCancelar) return chain;

      if (esAceptar) {
        chain = chain.then(() => {
          const textoMotivo = generarTextoAleatorio(20);
          return cy.get('textarea.notification-textarea', { timeout })
            .first()
            .should('be.visible')
            .clear({ force: true })
            .type(textoMotivo, { force: true });
        });
      }

      chain = chain.then(() => {
        let selectorBoton = '';

        if (esAceptar) {
          selectorBoton =
            '.notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.notification-buttons .btn-notification.btn-primary';
        } else if (esCancelar) {
          selectorBoton =
            '.notification-buttons .btn-notification.btn-secondary[data-action="reject"], ' +
            '.notification-buttons .btn-notification.btn-secondary';
        }

        if (!selectorBoton) return cy.wrap(null);

        return cy.get(selectorBoton, { timeout })
          .first()
          .click({ force: true });
      })
        .then(() => cy.wait(400));

      return chain;
    });
  }

  function obtenerBotonFichaje(tipo) {
    const legacySelector = tipo === 'entrada' ? '#btn-registrar-entrada' : '#btn-registrar-salida';
    const textoRegex = tipo === 'entrada' ? /\bEntrada\b/i : /\bSalida\b/i;

    return cy.get('body', { timeout: 10000 }).then(($body) => {
      if ($body.find(legacySelector).length) {
        return cy.get(legacySelector, { timeout: 10000 });
      }

      const candidatos = $body
        .find('button, a, [role="button"]')
        .filter((_, el) => textoRegex.test(el.innerText || el.textContent || ''));

      if (candidatos.length) {
        return cy.wrap(candidatos.eq(0));
      }

      return cy.contains('button, a, [role="button"]', textoRegex, { timeout: 10000 });
    });
  }

  function clickBotonFichaje(tipo) {
    return cy.get('body', { timeout: 2000 }).then(($body) => {
      if (!$body || $body.length === 0) {
        return cy.wrap(null);
      }

      const texto = $body.text ? $body.text() : '';
      const textoNormalizado = texto.toLowerCase();
      const tieneError500 = textoNormalizado.includes('500') ||
        textoNormalizado.includes('internal server error') ||
        textoNormalizado.includes('error interno del servidor') ||
        textoNormalizado.includes('server error') ||
        textoNormalizado.includes('500 server error') ||
        textoNormalizado.includes('error de servidor') ||
        ($body.find && $body.find('[class*="error-500"], [class*="error500"], [id*="error-500"], [class*="server-error"]').length > 0);

      const tieneModalError = texto.includes('Error en hora de inicio') ||
        texto.includes('se solapa') ||
        texto.includes('solapamiento') ||
        texto.includes('Error de servidor') ||
        ($body.find && $body.find('[role="dialog"]:visible, .fi-modal:visible, [class*="modal"]:visible').filter((i, el) => {
          try {
            const textoModal = Cypress.$(el).text();
            return textoModal.includes('Error') || textoModal.includes('error');
          } catch (_) {
            return false;
          }
        }).length > 0);

      if (tieneError500 || tieneModalError) {
        cy.log(`Error detectado antes de hacer clic en botón ${tipo} - no se intentará hacer clic`);
        throw new Error('ERROR_DETECTADO_ANTES_DE_CLIC');
      }

      return cy.wrap(null);
    }, () => cy.wrap(null))
      .then(() =>
        obtenerBotonFichaje(tipo)
          .should('be.visible')
          .should('not.be.disabled')
          .scrollIntoView()
          .click({ force: true })
      );
  }

  function asegurarBotonFichajeVisible(tipo) {
    return obtenerBotonFichaje(tipo)
      .should('exist')
      .should('be.visible');
  }

  function asegurarBotonFichajeNoVisible(tipo) {
    const legacySelector = tipo === 'entrada' ? '#btn-registrar-entrada' : '#btn-registrar-salida';
    const textoRegex = tipo === 'entrada' ? /\bEntrada\b/i : /\bSalida\b/i;

    return cy.get('body').then(($body) => {
      if ($body.find(legacySelector).length) {
        return cy.get(legacySelector).should('not.be.visible');
      }

      return cy.contains('button, a, [role="button"]', textoRegex).should('not.exist');
    });
  }

  function asegurarSesionFichar(casoExcel) {
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes(LOGIN_PATH)) {
        const usuario = obtenerDatoPorEtiqueta(casoExcel, 'usuario') || Cypress.env('SUPERADMIN_EMAIL') || 'superadmin@novatrans.app';
        const claveExcel = obtenerDatoPorEtiqueta(casoExcel, 'clave') || '';
        const clave = (claveExcel && claveExcel !== 'solbyte')
          ? claveExcel
          : (Cypress.env('SUPERADMIN_PASSWORD') || 'novatranshorario@2025');

        cy.log(`Iniciando sesión manualmente como ${usuario}`);

        return cy.get('input#usuario', { timeout: 10000 })
          .should('be.visible')
          .clear()
          .type(usuario, { delay: 10 })
          .then(() =>
            cy.get('input#clave', { timeout: 10000 })
              .should('be.visible')
              .clear()
              .type(clave, { log: false })
          )
          .then(() =>
            cy.get('input.button, button[type="submit"], button:contains("Acceder")', { timeout: 10000 })
              .first()
              .click({ force: true })
          )
          .then(() => cy.wait(800))
          .then(() => verificarUrlFichar());
      }

      return verificarUrlFichar();
    });
  }

  function irAFichajesLimpio(numeroCaso) {
    if (numeroCaso <= 3) {
      cy.clearCookies({ log: false });
      cy.clearLocalStorage({ log: false });
      cy.window({ log: false }).then((w) => {
        try { w.sessionStorage?.clear(); } catch (_) {}
      });

      cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
      cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
      return cy.get('input#usuario', { timeout: 10000 }).should('exist');
    }

    return cy.url().then((currentUrl) => {
      if (currentUrl !== FICHAJES_URL_ABS) {
        cy.visit(FICHAJES_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('eq', FICHAJES_URL_ABS);
      }
      return cy.get('body', { timeout: 10000 }).should('exist');
    });
  }

  function rellenarCamposEntrada(paso) {
    let chain = cy.wrap(null);
    const fechaEntrada = (paso.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);

    chain = chain
      .then(() => {
        cy.log(`Rellenando fecha de entrada: ${fechaEntrada}`);
        return establecerValorInput('#input_fecha_entrada', fechaEntrada);
      })
      .then(() => cy.wait(300));

    if (paso.hora) {
      chain = chain
        .then(() => {
          const horaEntrada = paso.hora || '08:00';
          cy.log(`Rellenando hora de entrada: ${horaEntrada}`);
          return establecerValorInput('#input_hora_entrada', horaEntrada);
        })
        .then(() => cy.wait(300));
    }

    return chain;
  }

  function rellenarCamposSalida(paso) {
    let chain = cy.wrap(null);
    const fechaSalida = (paso.fecha || new Date().toISOString().slice(0, 10)).slice(0, 10);

    chain = chain
      .then(() => {
        cy.log(`Rellenando fecha de salida: ${fechaSalida}`);
        return establecerValorInput('#input_fecha_salida', fechaSalida);
      })
      .then(() => cy.wait(300));

    if (paso.hora) {
      chain = chain
        .then(() => {
          const horaSalida = paso.hora || '17:00';
          cy.log(`Rellenando hora de salida: ${horaSalida}`);
          return establecerValorInput('#input_hora_salida', horaSalida);
        })
        .then(() => cy.wait(300));
    }

    return chain;
  }

  return {
    verificarUrlFichar,
    establecerValorInput,
    aceptarAdvertenciaSiExiste,
    obtenerBotonFichaje,
    clickBotonFichaje,
    asegurarBotonFichajeVisible,
    asegurarBotonFichajeNoVisible,
    asegurarSesionFichar,
    irAFichajesLimpio,
    rellenarCamposEntrada,
    rellenarCamposSalida
  };
}
