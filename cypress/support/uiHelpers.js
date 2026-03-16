function escaparRegex(texto = '') {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function seleccionarOpcionChoices(texto, label) {
  if (!texto) return cy.wrap(null);

  const labelRegex = label ? new RegExp(label, 'i') : null;
  const terminoRegex = new RegExp(escaparRegex(texto), 'i');
  const openersSelector = '.choices, .choices[data-type="select-one"], [role="combobox"], [aria-haspopup="listbox"], select, .fi-select-trigger';
  const dropdownSelector = '.choices__list--dropdown:visible, .fi-select-panel:visible, [role="listbox"]:visible';
  const inputSelector = '.choices__input--cloned:visible, .choices__input:visible, input[placeholder*="Teclee"]:visible, input[placeholder*="buscar"]:visible, input[placeholder*="Buscar"]:visible, input[type="search"]:visible';

  const abrirSelect = () => {
    if (labelRegex) {
      return cy.contains('label, span, div, h3, h4, h5', labelRegex, { timeout: 10000 })
        .then(($label) => {
          const wrappers = [
            $label.closest('[data-field-wrapper]'),
            $label.closest('.fi-field'),
            $label.closest('.fi-fo-field-wrp'),
            $label.closest('.fi-fo-field'),
            $label.closest('section'),
            $label.closest('.grid'),
            $label.closest('form'),
            $label.parent()
          ].filter(($el) => $el && $el.length);

          for (const $wrapper of wrappers) {
            const $objetivo = $wrapper.find(openersSelector).filter(':visible').first();
            if ($objetivo.length) {
              cy.wrap($objetivo).scrollIntoView().click({ force: true });
              return;
            }
          }

          return cy.get(openersSelector, { timeout: 10000 })
            .filter(':visible')
            .first()
            .scrollIntoView()
            .click({ force: true });
        });
    }

    return cy.get(openersSelector, { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });
  };

  return abrirSelect()
    .then(() => cy.wait(300))
    .then(() => {
      return cy.get('body').then(($body) => {
        const $input = $body.find(inputSelector).last();
        if ($input.length) {
          cy.wrap($input).clear({ force: true }).type(texto, { force: true, delay: 10 });
          cy.wait(200);
        }

        if ($body.find('[role="option"]:visible').length) {
          return cy.contains('[role="option"]:visible', terminoRegex, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        }

        if ($body.find('.choices__item--choice:visible').length) {
          return cy.contains('.choices__item--choice:visible', terminoRegex, { timeout: 10000 })
            .scrollIntoView()
            .click({ force: true });
        }

        if ($body.find(dropdownSelector).length) {
          return cy.get(dropdownSelector, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', terminoRegex, { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          });
        }

        return cy.contains(':visible', terminoRegex, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      });
    })
    .then(() => cy.wait(300));
}

export function escribirCampo(selector, valor) {
  if (!valor) return cy.wrap(null);

  return cy.get(selector, { timeout: 10000 })
    .first()
    .scrollIntoView()
    .clear({ force: true })
    .type(valor, { force: true, delay: 20 });
}

export function limpiarCampo(selector) {
  return cy.get(selector, { timeout: 10000 })
    .first()
    .scrollIntoView()
    .clear({ force: true });
}

export function encontrarBotonAlFinal(textoBoton) {
  cy.scrollTo('bottom', { duration: 500 });
  cy.wait(500);

  return cy.get('body').then(($body) => {
    const regex = new RegExp(`^${escaparRegex(textoBoton)}$`, 'i');

    let $btn = $body.find('button:visible, a:visible').filter((i, el) => {
      const text = Cypress.$(el).text().trim();
      return regex.test(text);
    }).first();

    if ($btn.length === 0) {
      $btn = $body.find('button, a').filter((i, el) => {
        const text = Cypress.$(el).text().trim();
        return regex.test(text);
      }).first();
    }

    if ($btn.length > 0) {
      cy.wrap($btn).scrollIntoView({ duration: 300 }).should('be.visible');
      cy.wrap($btn).click({ force: true });
    } else {
      cy.contains('button, a', regex, { timeout: 10000 })
        .scrollIntoView()
        .click({ force: true });
    }
  });
}

export function esperarToastExito() {
  return cy.get('body').then(($body) => {
    if ($body.find('.swal2-container:visible, .fi-notification:visible').length) {
      cy.contains('.swal2-container .swal2-title, .fi-notification', /\u00c9xito|Exito|Guardado|Creado/i, { timeout: 10000 })
        .should('be.visible');
    }
  });
}

export function confirmarModal(textos = []) {
  const opciones = Array.isArray(textos) ? textos : [textos];

  return cy.get('.fi-modal:visible, [role="dialog"]:visible, .swal2-container:visible', { timeout: 10000 })
    .should('be.visible')
    .within(() => {
      const encontrado = opciones.some((texto) => {
        const selector = 'button, a';
        const regex = new RegExp(`^${escaparRegex(texto)}$`, 'i');

        try {
          const $btn = Cypress.$(selector).filter((_, el) => regex.test(Cypress.$(el).text().trim()));
          if ($btn.length) {
            cy.wrap($btn.first()).click({ force: true });
            return true;
          }
        } catch (e) {
          return false;
        }

        return false;
      });

      if (!encontrado) {
        cy.contains('button, a', /Borrar|Aceptar|Confirmar|S[i\u00ed]|Cancelar|Cerrar|No/i, { timeout: 1000 })
          .first()
          .click({ force: true });
      }
    });
}

export function verificarErrorEsperado(palabrasClave = []) {
  return cy.get('body').then(($body) => {
    const texto = $body.text().toLowerCase();
    const contiene = palabrasClave.every((kw) => texto.includes(kw.toLowerCase()));

    if (!contiene) {
      cy.log(`No se detecto mensaje que contenga: ${palabrasClave.join(', ')}`);
    }
  });
}

export function filtrarPorSelectEnPanel(valor, label = 'Empresa') {
  if (!valor) return cy.wrap(null);

  cy.get('body').type('{esc}{esc}');
  cy.wait(150);
  cy.get('.fi-ta-table, table').first().click({ force: true });

  cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
    .filter(':visible')
    .first()
    .scrollIntoView()
    .click({ force: true });

  cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
    .as('panelFiltroSelect')
    .should('be.visible');

  cy.get('@panelFiltroSelect').within(() => {
    cy.contains('label, span, div, p', new RegExp(label, 'i'), { timeout: 10000 })
      .should('be.visible')
      .closest('div, fieldset, section')
      .as('bloqueFiltroSelect');
  });

  cy.get('@bloqueFiltroSelect').then(($bloque) => {
    const $select = $bloque.find('select:visible');
    if ($select.length) {
      cy.wrap($select).first().select(valor, { force: true });
      return;
    }

    const openers = [
      '[role="combobox"]:visible',
      '[aria-haspopup="listbox"]:visible',
      '[aria-expanded]:visible',
      'button:visible',
      '[role="button"]:visible',
      '.fi-select-trigger:visible',
      '.fi-input:visible',
      '.fi-field:visible',
      '.fi-input-wrp:visible',
      '.fi-fo-field-wrp:visible'
    ];

    let opened = false;
    for (const sel of openers) {
      const $el = $bloque.find(sel).first();
      if ($el.length) {
        cy.wrap($el).scrollIntoView().click({ force: true });
        opened = true;
        break;
      }
    }

    if (!opened) {
      cy.wrap($bloque).scrollIntoView().click('center', { force: true });
    }

    cy.get('body').then(($b) => {
      if ($b.text().includes('Cargando...')) {
        cy.contains('Cargando...', { timeout: 15000 }).should('not.exist');
      }
    });

    const dropdownScopes =
      '.fi-dropdown-panel:visible, .fi-select-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible, .fi-dropdown:visible, ul:visible, div[role="menu"]:visible';

    cy.get('body').then(($body) => {
      if ($body.find('[role="option"]:visible').length) {
        cy.contains('[role="option"]:visible', new RegExp(escaparRegex(valor), 'i'), { timeout: 10000 }).click({ force: true });
      } else {
        cy.get(dropdownScopes, { timeout: 10000 }).first().within(() => {
          cy.contains(':visible', new RegExp(escaparRegex(valor), 'i'), { timeout: 10000 }).click({ force: true });
        });
      }
    });
  });

  cy.get('@panelFiltroSelect').then(($p) => {
    if ($p.is(':visible')) {
      cy.get('.fi-ta-table, table').first().click({ force: true });
    }
  });

  return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
    .should('have.length.greaterThan', 0);
}

export function seleccionarJornadaEnModal(aliasModal, textoOpcion) {
  const termino = textoOpcion || '';
  const elegirDistintaDeJornada1 = termino === '__DISTINTA_JORNADA_1__';

  return cy.get(aliasModal).within(() => {
    cy.contains('label, span, div', /Jornada\s+Semanal/i, { timeout: 10000 })
      .filter(':visible')
      .then(($labels) => {
        if (!$labels.length) {
          throw new Error('No se encontro el label de "Jornada Semanal" visible dentro del modal');
        }

        let $campo = null;
        $labels.each((_, el) => {
          const $label = Cypress.$(el);
          const candidatos = [
            $label.closest('.fi-field'),
            $label.closest('.fi-fo-field'),
            $label.closest('.fi-input-wrp'),
            $label.closest('.fi-input'),
            $label.closest('.fi-select'),
            $label.closest('[data-field]'),
            $label.closest('.fi-fo-component'),
            $label.closest('[data-field-wrapper]'),
            $label.closest('.grid'),
            $label.closest('section'),
            $label.closest('form'),
            $label.parent()
          ].filter(($el) => $el && $el.length);

          if (candidatos.length) {
            $campo = candidatos[0];
            return false;
          }

          return undefined;
        });

        if (!$campo || !$campo.length) {
          throw new Error('No se pudo localizar el contenedor de "Jornada Semanal"');
        }

        cy.wrap($campo).scrollIntoView();
        cy.wrap($campo).as('campoJornada');
      });
  }).then(() => {
    cy.get('@campoJornada').then(($campo) => {
      const $select = $campo.find('select:visible').first();
      if ($select.length) {
        const opciones = $select.find('option').toArray();
        let opcionElegida = opciones.find((opt) => {
          const texto = Cypress.$(opt).text().trim();
          return !elegirDistintaDeJornada1 && termino && new RegExp(escaparRegex(termino), 'i').test(texto);
        });

        if (!opcionElegida && elegirDistintaDeJornada1) {
          opcionElegida = opciones.find((opt) => {
            const $opt = Cypress.$(opt);
            const texto = $opt.text().trim();
            return $opt.val() && !/^jornada\s+semanal\s+1$/i.test(texto);
          });
        }

        if (!opcionElegida) {
          opcionElegida = opciones.find((opt) => Cypress.$(opt).val()) || opciones[0];
        }

        if (opcionElegida) {
          const valor = Cypress.$(opcionElegida).val() || Cypress.$(opcionElegida).text().trim();
          cy.wrap($select).select(valor, { force: true });
          cy.wait(300);
          return;
        }
      }

      cy.wrap($campo).then(($el) => {
        const $choices = $el.find('.choices:visible').first();
        if ($choices.length) {
          cy.wrap($choices).as('triggerChoices');
        } else {
          const $combobox = $el.find('[role="combobox"]:visible, [aria-haspopup="listbox"]:visible').first();
          if ($combobox.length) {
            cy.wrap($combobox).as('triggerChoices');
          } else {
            cy.wrap($el).as('triggerChoices');
          }
        }
      });

      const abrirDropdown = () => {
        return cy.get('@triggerChoices')
          .scrollIntoView({ duration: 200 })
          .within(() => {
            cy.get('.choices__inner').click('center', { force: true });
          })
          .wait(150)
          .then(($trigger) => {
            return cy.get('body').then(($body) => {
              if ($body.find('.choices__list--dropdown.is-active:visible').length === 0) {
                ['pointerdown', 'mousedown', 'mouseup', 'click'].forEach((evento) => {
                  $trigger[0].dispatchEvent(new MouseEvent(evento, { bubbles: true, cancelable: true }));
                });
              }
            });
          })
          .then(() => cy.wait(150));
      };

      const asegurarDropdown = () => {
        return abrirDropdown().then(() =>
          cy.get('body').then(($body) => {
            if ($body.find('.choices__list--dropdown.is-active:visible').length === 0) {
              return abrirDropdown();
            }
            return null;
          })
        );
      };

      return asegurarDropdown()
        .then(() => {
          cy.get('body').then(($body) => {
            const panel = $body.find('.choices__list--dropdown.is-active:visible').last();
            if (panel.length) {
              const rect = panel[0].getBoundingClientRect();
              cy.wrap(panel).scrollIntoView({ duration: 200 });
              cy.get('@triggerChoices').then(($trigger) => {
                $trigger[0].dispatchEvent(new MouseEvent('mousemove', {
                  bubbles: true,
                  cancelable: true,
                  clientX: rect.left + 10,
                  clientY: rect.top + 10
                }));
              });
            }
          });

          cy.get('body').then(($body) => {
            const inputSelector = '.choices__input--cloned:visible, input[placeholder*="Teclee"]:visible, input[placeholder*="buscar"]:visible';
            const $input = $body.find(inputSelector).last();
            if ($input.length && termino && !elegirDistintaDeJornada1) {
              cy.wrap($input).clear({ force: true }).type(termino, { force: true, delay: 20 });
              cy.wait(200);
            }

            cy.wait(300);
            return cy.get('body').then(($body2) => {
              const dropdown = $body2.find('.choices__list--dropdown.is-active:visible').last();
              if (dropdown.length) {
                cy.wrap(dropdown).should('be.visible');
                cy.log(`Esperando a que las opciones terminen de cargar. Termino: "${termino}"`);

                cy.wait(500);
                return cy.get('body', { timeout: 15000 }).should(($body3) => {
                  const $dropdownActivo = $body3.find('.choices__list--dropdown.is-active:visible').last();
                  const textoDropdown = $dropdownActivo.text().toLowerCase();
                  const tieneCargando = /cargando|loading/i.test(textoDropdown);
                  const tieneOpciones = $dropdownActivo.find('.choices__item--choice:visible').length > 0;

                  if (tieneCargando && !tieneOpciones) {
                    throw new Error('El dropdown aun esta cargando opciones');
                  }
                }).then(() => {
                  return cy.get('body').then(($body4) => {
                    const $dropdownFinal = $body4.find('.choices__list--dropdown.is-active:visible').last();
                    const selectorOpcion = '.choices__item--choice:visible';

                    if (elegirDistintaDeJornada1) {
                      return cy.wrap($dropdownFinal).find(selectorOpcion)
                        .filter((i, el) => {
                          const texto = Cypress.$(el).text().trim();
                          return texto.length > 0 && !/^jornada\s+semanal\s+1$/i.test(texto);
                        })
                        .should('have.length.at.least', 1)
                        .first()
                        .should('be.visible')
                        .scrollIntoView()
                        .click({ force: true });
                    }

                    if (termino) {
                      return cy.wrap($dropdownFinal).contains(selectorOpcion, new RegExp(escaparRegex(termino), 'i'), { timeout: 10000 })
                        .should('be.visible')
                        .scrollIntoView()
                        .click({ force: true });
                    }

                    cy.log('Seleccionando la primera opcion disponible del dropdown');
                    return cy.wrap($dropdownFinal).find(selectorOpcion)
                      .should('have.length.at.least', 1)
                      .first()
                      .should('be.visible')
                      .scrollIntoView()
                      .click({ force: true });
                  });
                });
              }

              cy.log('Dropdown Choices no encontrado, buscando opciones genericas');
              const selectorGenerico = '[role="option"]:visible, .fi-dropdown-panel:visible [data-select-option]:visible';
              if (termino) {
                return cy.contains(selectorGenerico, new RegExp(escaparRegex(termino), 'i'), { timeout: 10000 })
                  .should('be.visible')
                  .scrollIntoView()
                  .click({ force: true });
              }

              return cy.get(selectorGenerico, { timeout: 10000 })
                .should('have.length.at.least', 1)
                .first()
                .should('be.visible')
                .scrollIntoView()
                .click({ force: true });
            });
          });
        })
        .then(() => {
          cy.wait(800);
          cy.get('body').then(($body) => {
            const dropdownAbierto = $body.find('.choices__list--dropdown.is-active:visible').length > 0;
            if (dropdownAbierto) {
              cy.log('El dropdown aun esta abierto, esperando un poco mas...');
              cy.wait(500);
            }
          });
          cy.wait(300);
        });
    });
  });
}

export function seleccionarFechaInicioMananaEnModal(modalAlias) {
  return cy.then(() => {
    const manana = new Date();
    manana.setDate(manana.getDate() + 1);
    const dia = String(manana.getDate());

    cy.get(modalAlias).within(() => {
      cy.get('input#mountedTableActionsData\\.0\\.start_date', { timeout: 10000 })
        .should('be.visible')
        .click({ force: true });
    });

    cy.get('.fi-fo-date-time-picker-panel:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('[role="option"]:not(.pointer-events-none), [role="option"].cursor-pointer', new RegExp(`^${dia}$`), { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      });

    cy.get('body').click(5, 5, { force: true });
    cy.wait(300);

    return cy.get(modalAlias).within(() => {
      cy.get('input#mountedTableActionsData\\.0\\.start_date', { timeout: 10000 })
        .invoke('val')
        .should('not.be.empty');
    });
  });
}
