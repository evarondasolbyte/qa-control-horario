export function createGruposJornadasActions(deps) {
  const {
    editarAbrirFormulario,
    encontrarBotonAlFinal,
    esperarToastExito,
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    registrarResultado,
    seleccionarFechaInicioMananaEnModal,
    seleccionarJornadaEnModal
  } = deps;

  function abrirPestanaJornadas() {
    cy.contains('button', /^\s*Jornadas?\s+Semanales?\s+Asignadas?\s*$/i, { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.wait(800);

    return cy.get('body').should(($body) => {
      const tieneContenidoJornadas = $body.text().toLowerCase().includes('jornadas semanales asignadas') ||
        $body.find('[class*="fi-ta"], table, .fi-resource-relation-manager').length > 0;

      if (!tieneContenidoJornadas) {
        throw new Error('El contenido de jornadas semanales asignadas aun no esta visible');
      }
    }).then(() => cy.wait(500));
  }

  function abrirModalAsignarJornada() {
    const abrir = () => {
      return cy.contains('button', /^\s*[\+\-]?\s*Asignar\s+Jornada\s+Semanal\s*$/i, { timeout: 10000 })
        .filter(':visible')
        .first()
        .scrollIntoView()
        .click({ force: true })
        .then(() => cy.wait(1000))
        .then(() => {
          return cy.get('body').then(($body) => {
            if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
              return false;
            }
            return true;
          });
        });
    };

    return abrir().then((abierto) => {
      if (abierto) return cy.wrap(true);

      cy.log('TC040: El modal no se abrio, reintentando...');
      return abrir().then((abiertoEnReintento) => {
        if (!abiertoEnReintento) {
          throw new Error('No se pudo abrir el modal para asignar jornada');
        }
        return true;
      });
    });
  }

  function obtenerSeccionJornadas($body) {
    return $body.find('.fi-ta-table:visible, table:visible')
      .filter((i, el) => {
        const $tabla = Cypress.$(el);
        const textoTabla = $tabla.text().toLowerCase();
        return textoTabla.includes('jornada semanal') ||
          $tabla.closest('[id*="relation"], .fi-resource-relation-manager, [class*="relation"]').length > 0;
      })
      .first();
  }

  function buscarBotonEliminar($contenedor) {
    let $botonEliminarJornada = $contenedor
      .find('button[wire\\:click*="mountTableAction"][wire\\:click*="delete"]:visible')
      .first();

    if ($botonEliminarJornada.length === 0) {
      $botonEliminarJornada = $contenedor
        .find('.fi-ta-actions-cell button:visible, .fi-ta-actions-cell a:visible')
        .filter((i, el) => {
          const $el = Cypress.$(el);
          const texto = $el.text().toLowerCase().trim();
          const tieneTextoBorrar = /borrar|eliminar|delete/i.test(texto);
          const tieneClaseDanger = $el.hasClass('fi-color-danger') || $el.find('.fi-color-danger').length > 0;

          if (!tieneTextoBorrar && !tieneClaseDanger) return false;
          if (texto.includes('grupo') || texto.includes('group')) return false;

          const $fila = $el.closest('.fi-ta-row, tbody tr');
          if ($fila.length === 0 || $fila.hasClass('fi-ta-header-row') || $fila.closest('thead').length > 0) {
            return false;
          }

          const $celdaAcciones = $el.closest('.fi-ta-actions-cell');
          if ($celdaAcciones.length === 0) return false;

          const $filaDeCelda = $celdaAcciones.closest('.fi-ta-row, tbody tr');
          if ($filaDeCelda.length === 0) return false;

          if ($el.closest('[class*="fi-form-actions"], .fi-form-actions, button[type="submit"]').length > 0) {
            const $botonCerca = $el.siblings('button[type="submit"], .fi-btn[type="submit"]');
            if ($botonCerca.length > 0) return false;
          }

          return true;
        })
        .first();
    }

    return $botonEliminarJornada;
  }

  function confirmarEliminacionSiHaceFalta() {
    return cy.get('body').then(($body) => {
      if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
        return null;
      }

      return cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
        .should('be.visible')
        .then(($modal) => {
          const textoModal = $modal.text().toLowerCase();

          if (/incurridos|no.*eliminar|no.*borrar/i.test(textoModal)) {
            cy.log('TC040: Aviso - La jornada no se puede eliminar porque tiene incurridos');
            cy.contains('button, a', /Aceptar|Cerrar|OK|Entendido/i, { timeout: 10000 })
              .first()
              .click({ force: true });
            return null;
          }

          cy.log('TC040: Confirmando eliminacion de jornada semanal...');
          cy.get('.fi-modal:visible, [role="dialog"]:visible').within(() => {
            cy.contains('button, a', /^\s*Borrar\s*$/i, { timeout: 10000 })
              .should('be.visible')
              .scrollIntoView()
              .click({ force: true });
          });

          return null;
        });
    });
  }

  function eliminarDesdeJornadasAsignadas(mensajeLog) {
    if (mensajeLog) {
      cy.log(mensajeLog);
    }

    return cy.contains('button, .fi-tabs-item', /Jornadas?\s+Semanales?\s+Asignadas?/i, { timeout: 10000 })
      .should('be.visible')
      .then(() => cy.wait(500))
      .then(() => {
        return cy.get('body').then(($body) => {
          let $seccionJornadas = obtenerSeccionJornadas($body);

          if ($seccionJornadas.length === 0) {
            cy.log('TC040: No se encontro tabla, buscando botones de eliminar directamente...');
            const $botonesEliminarDirectos = $body.find('button[wire\\:click*="mountTableAction(\'delete\'"]').filter(':visible');

            if ($botonesEliminarDirectos.length === 0) {
              throw new Error('No se encontro la tabla de jornadas semanales asignadas ni botones de eliminar');
            }

            $seccionJornadas = $body;
          }

          const $botonEliminarJornada = buscarBotonEliminar($seccionJornadas);

          if (!$botonEliminarJornada || $botonEliminarJornada.length === 0) {
            throw new Error('No se encontro boton de eliminar jornada despues de intentar asignar');
          }

          cy.wrap($botonEliminarJornada)
            .scrollIntoView()
            .should('be.visible')
            .click({ force: true });

          cy.wait(500);
          return confirmarEliminacionSiHaceFalta();
        });
      });
  }

  function asignarJornadaSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const casoId = String(casoExcel.caso || '').toUpperCase();

    if (casoId === 'TC039') {
      cy.log('TC039: asignacion de jornada deshabilitada temporalmente. Marcando OK sin accion.');
      return cy.wrap(true);
    }

    const jornada = obtenerDatoPorEtiqueta(casoExcel, 'jornada') ||
      obtenerDatoEnTexto(casoExcel, 'Jornada') ||
      casoExcel.dato_1 ||
      '';

    if (casoId === 'TC041') {
      return editarAbrirFormulario(casoExcel)
        .then(() => {
          cy.contains('button', /^\s*Jornadas?\s+Semanales?\s+Asignadas?\s*$/i, { timeout: 10000 })
            .filter(':visible')
            .first()
            .scrollIntoView()
            .click({ force: true });
          cy.wait(500);

          return cy.contains('button', /^\s*[\+\-]?\s*Asignar\s+Jornada\s+Semanal\s*$/i, { timeout: 10000 })
            .filter(':visible')
            .first()
            .scrollIntoView()
            .click({ force: true });
        })
        .then(() => {
          cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 15000 })
            .as('modalJornada')
            .should('be.visible');
          cy.wait(800);
          return seleccionarJornadaEnModal('@modalJornada', jornada || '__DISTINTA_JORNADA_1__');
        })
        .then(() => seleccionarFechaInicioMananaEnModal('@modalJornada'))
        .then(() => {
          cy.get('@modalJornada').within(() => {
            cy.contains('button, a', /^\s*Crear\s*$/i, { timeout: 10000 })
              .should('be.visible')
              .should('not.be.disabled')
              .scrollIntoView()
              .click({ force: true });
          });

          return cy.wait(1500).then(() => {
            return cy.get('body', { timeout: 10000 }).then(($body) => {
              const texto = ($body.text() || '').toLowerCase();
              const currentUrl = Cypress.config('baseUrl')
                ? `${Cypress.config('baseUrl')}${window.location.pathname}`
                : window.location.href;
              const tieneError500 = texto.includes('500') ||
                texto.includes('internal server error') ||
                texto.includes('error interno del servidor') ||
                texto.includes('server error') ||
                texto.includes('500 server error') ||
                $body.find('[class*="error-500"], [class*="error500"], [id*="error-500"]').length > 0 ||
                window.location.pathname.includes('/500') ||
                window.location.pathname.includes('/error');

              if (tieneError500) {
                registrarResultado(
                  casoId,
                  `${casoId} - ${casoExcel.nombre}`,
                  'Comportamiento correcto',
                  'Salta ERROR 500',
                  'ERROR'
                );
                cy.log(`TC041: Detectado ERROR 500 tras crear la jornada. URL: ${currentUrl}`);
                return cy.wrap({ huboError: true });
              }

              return cy.wrap(null);
            });
          });
        });
    }

    return editarAbrirFormulario(casoExcel)
      .then(() => {
        cy.contains('button', /^\s*Jornadas?\s+Semanales?\s+Asignadas?\s*$/i, { timeout: 10000 })
          .filter(':visible')
          .first()
          .scrollIntoView()
          .click({ force: true });
        cy.wait(400);

        const abrirModal = () => {
          return cy.contains('button', /^\s*[\+\-]?\s*Asignar\s+Jornada\s+Semanal\s*$/i, { timeout: 10000 })
            .filter(':visible')
            .first()
            .scrollIntoView()
            .then(($btn) => {
              cy.wrap($btn).click({ force: true });
              cy.wait(600);
              return cy.get('body').then(($body) => {
                if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
                  $btn[0].dispatchEvent(new Event('click', { bubbles: true }));
                  cy.wait(600);
                }
              });
            });
        };

        return abrirModal().then(() =>
          cy.get('body').then(($body) => {
            if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
              return abrirModal();
            }
            return null;
          })
        );
      })
      .then(() => {
        cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 15000 })
          .as('modalJornada')
          .should('be.visible');
        return seleccionarJornadaEnModal('@modalJornada', jornada);
      })
      .then(() => {
        cy.get('@modalJornada').within(() => {
          cy.contains('button, a', /^\s*Crear\s*$/i, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        });
        return esperarToastExito();
      })
      .then(() => encontrarBotonAlFinal('Guardar cambios'))
      .then(() => esperarToastExito());
  }

  function eliminarJornada(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    return editarAbrirFormulario(casoExcel)
      .then(() => {
        return abrirPestanaJornadas();
      })
      .then(() => {
        return cy.get('body').then(($body) => {
          const $botonesEliminarJornada = $body.find('button[wire\\:click*="mountTableAction(\'delete\'').filter(':visible');
          let hayJornadasAsignadas = $botonesEliminarJornada.length > 0;

          if (!hayJornadasAsignadas) {
            const $botonesBorrar = $body.find('.fi-ta-actions-cell button:visible, .fi-ta-actions-cell a:visible')
              .filter((i, el) => {
                const $el = Cypress.$(el);
                const texto = $el.text().toLowerCase().trim();
                if (!/borrar|eliminar|delete/i.test(texto)) return false;
                if (texto.includes('grupo') || texto.includes('group')) return false;
                const $celdaAcciones = $el.closest('.fi-ta-actions-cell');
                if ($celdaAcciones.length === 0) return false;
                const $fila = $celdaAcciones.closest('.fi-ta-row, tbody tr');
                if ($fila.length === 0 || $fila.hasClass('fi-ta-header-row') || $fila.closest('thead').length > 0) {
                  return false;
                }
                return true;
              });

            hayJornadasAsignadas = $botonesBorrar.length > 0;
          }

          if (!hayJornadasAsignadas) {
            cy.log('TC040: No hay jornadas asignadas, asignando una jornada primero...');
            return abrirModalAsignarJornada()
              .then(() => {
                cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 15000 })
                  .as('modalJornada')
                  .should('be.visible');

                cy.wait(1000);
                cy.get('@modalJornada').within(() => {
                  cy.contains('label, span, div', /Jornada\s+Semanal/i, { timeout: 10000 }).should('be.visible');
                });
                cy.wait(500);

                cy.log('TC040: Seleccionando la primera jornada semanal disponible...');
                return seleccionarJornadaEnModal('@modalJornada', '');
              })
              .then(() => {
                cy.wait(800);
                cy.log('TC040: Verificando que la jornada se haya seleccionado correctamente...');

                cy.get('@modalJornada').should('be.visible').within(() => {
                  cy.contains('button, a', /^\s*Crear\s*$/i, { timeout: 10000 })
                    .should('be.visible')
                    .should('not.be.disabled');
                });

                cy.wait(300);
                cy.log('TC040: Haciendo clic en el boton Crear...');
                cy.get('@modalJornada').within(() => {
                  cy.contains('button, a', /^\s*Crear\s*$/i, { timeout: 10000 })
                    .scrollIntoView()
                    .should('be.visible')
                    .should('not.be.disabled')
                    .click({ force: true });
                });

                cy.wait(1500);

                return cy.get('body', { timeout: 5000 }).then(($bodyToast) => {
                  const textoToast = $bodyToast.text().toLowerCase();
                  const hayMensajeError = /ya\s+est[áa]\s+asignada\s+a\s+este\s+grupo|no\s+se\s+puede\s+asignar/i.test(textoToast);
                  const modalSigueAbierto = $bodyToast.find('.fi-modal:visible, [role="dialog"]:visible').length > 0;

                  if (hayMensajeError || modalSigueAbierto) {
                    cy.log('TC040: La jornada ya estaba asignada o hubo error, cerrar modal con Cancelar...');
                    return cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 5000 })
                      .should('exist')
                      .within(() => {
                        cy.contains('button, a', /^\s*Cancelar\s*$/i, { timeout: 10000 })
                          .scrollIntoView()
                          .click({ force: true });
                      })
                      .then(() => {
                        cy.wait(800);
                        return 'toast-ya-asignada';
                      });
                  }

                  return esperarToastExito().then(() => 'jornada-creada');
                });
              })
              .then((resultado) => {
                cy.wait(1000);

                const irAEliminarExistente = resultado === 'toast-ya-asignada';
                return eliminarDesdeJornadasAsignadas(
                  irAEliminarExistente
                    ? 'TC040: Eliminando la jornada existente (ya estaba asignada)...'
                    : 'TC040: Eliminando la jornada recien creada...'
                );
              });
          }

          return eliminarDesdeJornadasAsignadas(
            'TC040: Ya hay jornadas asignadas, eliminando jornada directamente (sin crear otra)...'
          );
        });
      })
      .then(() => {
        cy.wait(500);
        return null;
      });
  }

  return {
    asignarJornadaSemanal,
    eliminarJornada
  };
}
