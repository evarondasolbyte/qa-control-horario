export function createFichajesTrabajoUtils(deps) {
  const {
    LABELS_HORA_ENTRADA,
    LABELS_HORA_SALIDA,
    normalizarHora,
    obtenerDatoPorEtiqueta,
    obtenerDatoPorEtiquetas,
    verificarUrlFichar,
    aceptarAdvertenciaSiExiste,
    clickBotonFichaje,
    asegurarSesionFichar,
    rellenarCamposEntrada,
    rellenarCamposSalida,
    registrarResultado
  } = deps;
  const SELECTOR_FILAS_TRABAJO =
    '#work-session-block .time-block-body .time-block-resume .time-entry';
  const SELECTOR_BLOQUE_TRABAJO = '#work-session-block';
  const SELECTOR_WRAPPER_INPUTS = '#work-session-block .wrapper-inputs[data-time-entry]';
  const SELECTOR_INPUTS_TRABAJO_VISIBLES =
    '#work-session-block .wrapper-inputs[data-time-entry] input.time-input.time-input-start, ' +
    '#work-session-block .wrapper-inputs[data-time-entry] input.time-input.time-input-end';
  const SELECTOR_INPUT_TIEMPO =
    '.wrapper-inputs-inner input.time-input.time-input-start, ' +
    '.wrapper-inputs-inner input.time-input.time-input-end, ' +
    'input.time-input.time-input-start, ' +
    'input.time-input.time-input-end';

  function obtenerFilasTrabajoNormalizadas($contenedor = null) {
    const $inputsVisibles = Cypress.$(SELECTOR_INPUTS_TRABAJO_VISIBLES).filter(':visible');

    if ($inputsVisibles.length) {
      const filasUnicas = [];
      $inputsVisibles.each((_, el) => {
        const fila = Cypress.$(el).closest('.time-entry')[0];
        if (fila && !filasUnicas.includes(fila)) {
          filasUnicas.push(fila);
        }
      });

      if (filasUnicas.length) {
        return Cypress.$(filasUnicas);
      }
    }

    const $scope = $contenedor || Cypress.$(SELECTOR_BLOQUE_TRABAJO);
    let $candidatos = $scope.find(SELECTOR_FILAS_TRABAJO).filter((_, el) => {
      const $el = Cypress.$(el);
      return $el.is(':visible') && $el.find(SELECTOR_INPUT_TIEMPO).length > 0;
    });

    if (!$candidatos.length) {
      $candidatos = $scope.find(SELECTOR_WRAPPER_INPUTS).filter((_, el) => {
        const $el = Cypress.$(el);
        return $el.is(':visible') && $el.find(SELECTOR_INPUT_TIEMPO).length > 0;
      }).map((_, el) => Cypress.$(el).closest('.time-entry')[0]).get();
      $candidatos = Cypress.$($candidatos);
    }

    if (!$candidatos.length) {
      return $candidatos;
    }

    const $topLevel = $candidatos.filter((_, el) => {
      return Cypress.$(el).parents().filter(SELECTOR_FILAS_TRABAJO).length === 0;
    });

    return $topLevel.length ? $topLevel : $candidatos;
  }

  function asegurarBloqueTrabajoVisible() {
    return cy.get(SELECTOR_BLOQUE_TRABAJO, { timeout: 10000 })
      .scrollIntoView({ offset: { top: -120, left: 0 } })
      .should('exist')
      .then(() => cy.wait(300));
  }

  function obtenerCantidadFilasTrabajo() {
    return asegurarBloqueTrabajoVisible().then(() => {
      const $bloqueTrabajo = Cypress.$(SELECTOR_BLOQUE_TRABAJO);
      if (!$bloqueTrabajo.length) {
        return 0;
      }

      return obtenerFilasTrabajoNormalizadas($bloqueTrabajo).length;
    });
  }

  function abrirEditorEnFilaTrabajo($fila, tipoCampo) {
    cy.log(`Trabajo: editando directamente el campo ${tipoCampo === 'end' ? 'time-input-end' : 'time-input-start'}`);
    const $inputs = $fila.find(SELECTOR_INPUT_TIEMPO).filter((_, el) => Cypress.$(el).is(':visible'));

    if ($inputs.length) {
      const indexInput = (tipoCampo === 'end' && $inputs.length > 1) ? $inputs.length - 1 : 0;
      return cy.wrap($inputs.eq(indexInput))
        .scrollIntoView()
        .should('be.visible')
        .click({ force: true });
    }

    throw new Error('No se encontraron inputs time-input-start/time-input-end en el registro existente de Trabajo');
  }

  function establecerValorInputModal($input, valor) {
    return cy.wrap($input)
      .scrollIntoView()
      .should('be.visible')
      .then(($el) => {
        const input = $el[0];
        const valorFinal = String(valor ?? '');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;

        if (input && nativeSetter) {
          input.focus();
          nativeSetter.call(input, valorFinal);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }

        return cy.wrap($el)
          .click({ force: true })
          .clear({ force: true })
          .type(`{selectall}${valorFinal}`, { force: true, delay: 10 })
          .should(($inputActualizado) => {
            const valorActual = String($inputActualizado.val() ?? '');
            if (valorFinal === '24') {
              expect(['23', '24']).to.include(valorActual);
              return;
            }
            expect(valorActual).to.equal(valorFinal);
          })
          .then(($inputActualizado) => {
            $inputActualizado[0].dispatchEvent(new Event('blur', { bubbles: true }));
          });
      });
  }

  function confirmarEditorModalConEnter() {
    return cy.document().then((doc) => {
      const activeElement = doc.activeElement;
      const $active = Cypress.$(activeElement);

      if (!$active.length || $active.is('body')) {
        return cy.wrap(null);
      }

      return cy.wrap($active)
        .type('{enter}', { force: true })
        .then(() => cy.wait(300), () => cy.wait(300));
    });
  }

  function esperarConfirmacionOEditor() {
    const selectorBotonSiConfirmacion =
      '.modal-body .notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
      '.notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
      'button.btn-notification.btn-primary[data-action="accept"]';
    const selectorInputsEditor = 'input.time-edit-field-input:visible';

    return cy.get('body', { timeout: 10000 }).then(($body) => {
      const hayBotonSi = $body.find(selectorBotonSiConfirmacion).filter(':visible').length > 0;
      const hayInputsEditor = $body.find(selectorInputsEditor).length > 0;

      if (!hayBotonSi && !hayInputsEditor) {
        return cy.wrap(null);
      }

      if (!hayBotonSi) {
        return cy.wrap(null);
      }

      return cy.get(selectorBotonSiConfirmacion, { timeout: 8000 })
        .filter(':visible')
        .first()
        .should('be.visible')
        .click({ force: true })
        .then(() => cy.wait(400));
    });
  }

  function escribirValorEnCampoActivo(valor) {
    const valorFinal = String(valor ?? '');
    return cy.focused()
      .click({ force: true })
      .type(`{selectall}${valorFinal}`, { force: true, delay: 10 })
      .then(() => cy.wait(150));
  }

  function establecerHoraEnEditorActivo(horaTexto) {
    const [horas = '00', minutos = '00', segundos = '00'] = String(horaTexto || '00:00:00').split(':');

    return cy.get('body', { timeout: 8000 }).then(($body) => {
      const $scope =
        $body.find('[role="dialog"]:visible, .fi-modal:visible, .modal-body:visible')
          .filter((_, el) => {
            const $el = Cypress.$(el);
            return $el.find('input.time-edit-field-input:visible').length > 0;
          })
          .last();

      const $inputs = ($scope.length ? $scope : $body)
        .find('input.time-edit-field-input:visible');

      if ($inputs.length >= 3) {
        return establecerValorInputModal($inputs.eq(0), horas)
          .then(() => cy.wait(150))
          .then(() => establecerValorInputModal($inputs.eq(1), minutos))
          .then(() => cy.wait(150))
          .then(() => establecerValorInputModal($inputs.eq(2), segundos));
      }

      if ($inputs.length >= 2) {
        return establecerValorInputModal($inputs.eq(0), horas)
          .then(() => cy.wait(150))
          .then(() => establecerValorInputModal($inputs.eq(1), minutos));
      }

      const $inputTrabajoVisible = $body.find(
        '#work-session-block input.time-input.time-input-end:visible, ' +
        '#work-session-block input.time-input.time-input-start:visible'
      ).last();

      if ($inputTrabajoVisible.length) {
        return establecerValorInputModal($inputTrabajoVisible, `${horas}:${minutos}`);
      }

      return cy.document().then((doc) => {
        const focused = doc.activeElement;
        const $inputFoco = Cypress.$(focused).filter('input:visible').first();

        if ($inputFoco.length) {
          return establecerValorInputModal($inputFoco, `${horas}:${minutos}`);
        }

        return escribirValorEnCampoActivo(horas);
      });
    });
  }

  function cerrarModalTrasEdicion(tipoCampo) {
    return cy.get('body', { timeout: 3000 }).then(($bodyActual) => {
      const sigueAbierto = /Editar entrada|Editar salida/i.test($bodyActual.text());
      if (!sigueAbierto) {
        return cy.wrap(null);
      }

      const $botones = $bodyActual.find(
        'button.time-edit-btn.time-edit-btn-primary, ' +
        '[role="dialog"] button:visible, ' +
        '.fi-modal button:visible, ' +
        '.modal-body button:visible, ' +
        '.notification-content button:visible'
      ).filter(':visible');

      const normalizar = (el) => Cypress.$(el).text().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const $aceptar = $botones.filter((_, el) => /aceptar/i.test(normalizar(el))).first();
      const $no = $botones.filter((_, el) => /^no$/i.test(normalizar(el))).first();
      const $si = $botones.filter((_, el) => /^si$/i.test(normalizar(el))).first();

      if (tipoCampo === 'start' && $no.length) {
        return cy.wrap($no).click({ force: true });
      }

      if ($aceptar.length) {
        return cy.wrap($aceptar).click({ force: true });
      }

      if ($si.length) {
        return cy.wrap($si).click({ force: true });
      }

      return cy.wrap(null);
    });
  }

  function verificarError500DespuesEditar(casoExcel, numero) {
    return cy.get('body', { timeout: 3000 }).then(() => {
      const $body = Cypress.$('body');
      const textoVisible = $body.find(':visible').toArray()
        .map((el) => Cypress.$(el).text())
        .join(' ')
        .toLowerCase();
      const modalErrorVisible = $body.find('[role="dialog"]:visible, .fi-modal:visible, .notification-content:visible, .swal2-popup:visible')
        .filter((_, el) => {
          const texto = Cypress.$(el).text().toLowerCase();
          return texto.includes('500') ||
            texto.includes('internal server error') ||
            texto.includes('error interno del servidor') ||
            texto.includes('500 server error') ||
            texto.includes('server error');
        }).length > 0;
      const paginaErrorVisible =
        $body.find('[class*="error-500"]:visible, [class*="error500"]:visible, [id*="error-500"]:visible, [class*="server-error"]:visible').length > 0;
      const tieneError500 = modalErrorVisible || paginaErrorVisible;

      if (!tieneError500) {
        return cy.wrap(false);
      }

      const casoId = casoExcel.caso || `TC${String(numero).padStart(3, '0')}`;
      const nombre = `${casoId} - ${casoExcel.nombre}`;
      registrarResultado(
        casoId,
        nombre,
        casoExcel.resultado_esperado || 'Comportamiento correcto',
        'ERROR 500: Error interno del servidor detectado al editar tramo de trabajo',
        'ERROR'
      );
      return cy.wrap(true);
    }, () => cy.wrap(false));
  }

  function verificarError500DespuesEliminar(casoExcel, numero) {
    return cy.get('body', { timeout: 3000 }).then(() => {
      const $body = Cypress.$('body');
      const textoVisible = $body.find(':visible').toArray()
        .map((el) => Cypress.$(el).text())
        .join(' ')
        .toLowerCase();
      const modalErrorVisible = $body.find('[role="dialog"]:visible, .fi-modal:visible, .notification-content:visible, .swal2-popup:visible')
        .filter((_, el) => {
          const texto = Cypress.$(el).text().toLowerCase();
          return texto.includes('500') ||
            texto.includes('internal server error') ||
            texto.includes('error interno del servidor') ||
            texto.includes('500 server error') ||
            texto.includes('server error');
        }).length > 0;
      const paginaErrorVisible =
        $body.find('[class*="error-500"]:visible, [class*="error500"]:visible, [id*="error-500"]:visible, [class*="server-error"]:visible').length > 0;
      const tieneError500 = modalErrorVisible || paginaErrorVisible;

      if (!tieneError500) {
        return cy.wrap(false);
      }

      const casoId = casoExcel.caso || `TC${String(numero).padStart(3, '0')}`;
      const nombre = `${casoId} - ${casoExcel.nombre}`;
      registrarResultado(
        casoId,
        nombre,
        casoExcel.resultado_esperado || 'Comportamiento correcto',
        'ERROR 500: Error interno del servidor detectado al eliminar fichaje',
        'ERROR'
      );
      return cy.wrap(true);
    }, () => cy.wrap(false));
  }

  function editarTramoTrabajoCaso(casoExcel) {
    const casoId = String(casoExcel.caso || '').toUpperCase();
    const numero = parseInt(casoId.replace('TC', ''), 10) || 0;

    let indexEntrada = ['TC026', 'TC027', 'TC030'].includes(casoId) ? 1 : 0;
    let tipoCampo = 'start';

    if (typeof casoExcel._indexEntradaOverride === 'number') {
      indexEntrada = casoExcel._indexEntradaOverride;
    }

    if (casoExcel._tipoCampoOverride === 'start' || casoExcel._tipoCampoOverride === 'end') {
      tipoCampo = casoExcel._tipoCampoOverride;
    }

    const horaCruda = casoExcel._horaOverride || (
      tipoCampo === 'end'
        ? (obtenerDatoPorEtiqueta(casoExcel, 'hora_salida') || obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) || casoExcel.dato_2)
        : (obtenerDatoPorEtiqueta(casoExcel, 'hora') || obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) || casoExcel.dato_1)
    ) || '10:00';

    const { time: horaNueva } = normalizarHora({ base: horaCruda }) || {};
    const horaFinal = horaNueva || '10:00';
    cy.log(`Trabajo: ${casoId} ${tipoCampo} horaCruda=${horaCruda || '(vacia)'} -> horaFinal=${horaFinal}`);
    let indexEntradaReal = indexEntrada;

    const resolverIndiceEntrada = ($filas) => {
      if (!$filas.length) {
        throw new Error('No se encontro ningun tramo de trabajo para editar');
      }

      indexEntradaReal = casoExcel._usarUltimaFila === true
        ? $filas.length - 1
        : Math.min(indexEntrada, $filas.length - 1);

      if (casoExcel._usarUltimaFila === true) {
        cy.log(`Se reutiliza la ultima fila disponible: tramo ${indexEntradaReal + 1}`);
      } else if (indexEntradaReal !== indexEntrada) {
        cy.log(`No existe el tramo ${indexEntrada + 1}; se reutiliza el tramo ${indexEntradaReal + 1}`);
      }

      return indexEntradaReal;
    };

    let chain = cy.wrap(null);

    if (casoExcel._forzarCrearRegistro === true) {
      const hoyISO = new Date().toISOString().slice(0, 10);

      chain = chain
        .then(() => rellenarCamposEntrada({ fecha: hoyISO, hora: '10:00' }))
        .then(() => verificarError500DespuesEditar(casoExcel, numero))
        .then((huboError) => {
          if (huboError) return cy.wrap({ huboError: true });
          return clickBotonFichaje('entrada')
            .then(() => cy.wait(1000))
            .then(() => verificarError500DespuesEditar(casoExcel, numero))
            .then((errorEntrada) => errorEntrada ? cy.wrap({ huboError: true }) : cy.wrap(null));
        })
        .then((resultadoAnterior) => {
          if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });
          return aceptarAdvertenciaSiExiste({ accion: 'omitir' });
        })
        .then((resultadoAnterior) => {
          if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });
          return rellenarCamposSalida({ fecha: hoyISO, hora: '11:00' });
        })
        .then((resultadoAnterior) => {
          if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });
          return cy.wait(10000);
        })
        .then((resultadoAnterior) => {
          if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });
          return clickBotonFichaje('salida')
            .then(() => cy.wait(1000))
            .then(() => verificarError500DespuesEditar(casoExcel, numero))
            .then((errorSalida) => errorSalida ? cy.wrap({ huboError: true }) : cy.wrap(null));
        })
        .then((resultadoAnterior) => {
          if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });
          return aceptarAdvertenciaSiExiste({ accion: 'omitir' });
        });
    }

    chain = chain
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });

        return asegurarBloqueTrabajoVisible().then(() => {
          const $filas = obtenerFilasTrabajoNormalizadas();
          const indiceObjetivo = resolverIndiceEntrada($filas);
          const $filaObjetivo = $filas.eq(indiceObjetivo);

          return abrirEditorEnFilaTrabajo($filaObjetivo, tipoCampo);
        }).then(() => cy.wait(300));
      })
      .then(() => esperarConfirmacionOEditor())
      .then(() => {
        return cy.get('body', { timeout: 8000 }).then(($body) => {
          const textoVisible = $body.find(':visible').toArray()
            .map((el) => Cypress.$(el).text())
            .join(' ');
          const hayConfirm = /modificar la hora de (entrada|salida)|informara a tu supervisor|se le informara a tu supervisor/i.test(textoVisible);
          const hayModalEdicion = $body.find('input.time-edit-field-input:visible, button.time-edit-btn:visible').length > 0;
          const hayInputsEditor =
            $body.find('[role="dialog"] input:visible, .fi-modal input:visible, .notification-content input:visible').length >= 2;
          const hayBotonesEditor =
            $body.find('[role="dialog"] button:visible, .fi-modal button:visible, .notification-content button:visible')
              .filter((_, el) => /aceptar|cancelar/i.test(Cypress.$(el).text().trim()))
              .length >= 2;
          const hayEditorConTitulo = /Editar entrada|Editar salida/i.test(textoVisible);

          if (!hayConfirm && !hayModalEdicion && !hayEditorConTitulo) {
            cy.log('No se detecta el editor con los selectores actuales, pero se continua con la edicion');
          }

          return cy.wrap(null);
        });
      })
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });

        return cy.get('body', { timeout: 10000 }).then(($body) => {
          const textoVisible = $body.find(':visible').toArray()
            .map((el) => Cypress.$(el).text())
            .join(' ');
          const hayConfirm = /modificar la hora de (entrada|salida)|informara a tu supervisor|se le informara a tu supervisor/i.test(textoVisible);
          const $botonesVisibles =
            $body.find('[role="dialog"] button:visible, .fi-modal button:visible, .notification-content button:visible');
          const hayInputsEditor =
            $body.find('[role="dialog"] input:visible, .fi-modal input:visible, .notification-content input:visible').length >= 2;
          const hayBotonesEditor =
            $botonesVisibles
              .filter((_, el) => /aceptar|cancelar/i.test(Cypress.$(el).text().trim()))
              .length >= 2;
          const hayConfirmSiNo =
            $botonesVisibles
              .filter((_, el) => {
                const textoBoton = Cypress.$(el).text().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return /^(si|no)$/i.test(textoBoton);
              })
              .length >= 2;
          const hayEditorConTitulo = /Editar entrada|Editar salida/i.test(textoVisible) && (hayInputsEditor || hayBotonesEditor);

          if (!hayConfirmSiNo && (hayEditorConTitulo || !hayConfirm)) {
            return cy.wrap(null);
          }

          if (hayConfirmSiNo) {
            const selectorBotonSiExacto =
              '.modal-body .notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
              '.notification-content.notification-warning .btn-notification.btn-primary[data-action="accept"], ' +
              '.notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
              '.btn-notification.btn-primary[data-action="accept"]';

            return cy.get(selectorBotonSiExacto, { timeout: 8000 })
              .filter(':visible')
              .first()
              .should('be.visible')
              .click({ force: true })
              .then(() => cy.wait(400))
              .then(() => cy.wrap(null));
          }

          return cy.contains('button, a', /^s[ií]$/i, { timeout: 8000 })
            .click({ force: true })
            .then(() => cy.wait(1000))
            .then(() => verificarError500DespuesEditar(casoExcel, numero))
            .then((huboError) => huboError ? cy.wrap({ huboError: true }) : cy.wrap(null));
        });
      })
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });

        const [horasStr, minutosStr] = horaFinal.split(':');
        const horaCompletaEditor = `${horasStr || '00'}:${minutosStr || '00'}:00`;
        const selectorInputsModal =
          'input.time-edit-field-input:visible, ' +
          '[role="dialog"] input.time-edit-field-input:visible, ' +
          '.fi-modal input.time-edit-field-input:visible, ' +
          '.modal-body input.time-edit-field-input:visible';

        return cy.get('body', { timeout: 8000 }).then(($body) => {
          const $inputsVisibles = $body.find(selectorInputsModal).filter(':visible');
          const hayInputs = $inputsVisibles.length;

          if (hayInputs >= 2) {
            return cy.wrap($inputsVisibles)
              .then(($inputs) => {
                return establecerValorInputModal($inputs.eq(0), horasStr || '00')
                  .then(() => cy.wait(300))
                  .then(() => establecerValorInputModal($inputs.eq(1), minutosStr || '00'))
                  .then(() => cy.wait(300))
                  .then(() => {
                    if ($inputs.length >= 3) {
                      return establecerValorInputModal($inputs.eq(2), '00')
                        .then(() => cy.wait(300));
                    }

                    return cy.wrap(null);
                  });
              })
              .then(() => confirmarEditorModalConEnter())
              .then(() => cerrarModalTrasEdicion(tipoCampo));
          }

          return establecerHoraEnEditorActivo(horaCompletaEditor)
            .then(() => confirmarEditorModalConEnter())
            .then(() => cerrarModalTrasEdicion(tipoCampo));
        })
          .then(() => cy.wait(1000))
          .then(() => verificarError500DespuesEditar(casoExcel, numero))
          .then((huboError) => huboError ? cy.wrap({ huboError: true }) : cy.wrap(null));
      })
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });

        return cy.get('body', { timeout: 8000 }).then(($body) => {
          const selectorBotonSi =
            '.modal-body .notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.notification-content .notification-buttons .btn-notification.btn-primary[data-action="accept"], ' +
            '.btn-notification.btn-primary[data-action="accept"]';
          const selectorBotonNo =
            '.modal-body .notification-content .notification-buttons .btn-notification.btn-secondary[data-action="reject"], ' +
            '.notification-content .notification-buttons .btn-notification.btn-secondary[data-action="reject"], ' +
            '.btn-notification.btn-secondary[data-action="reject"]';
          const selectorBotonAceptar =
            'button.time-edit-btn.time-edit-btn-primary, ' +
            '[role="dialog"] button, ' +
            '.fi-modal button';

          const $botonNo = $body.find(selectorBotonNo).filter(':visible').first();
          if (tipoCampo === 'start' && $botonNo.length) {
            return cy.wrap($botonNo)
              .click({ force: true })
              .then(() => cy.wait(500))
              .then(() => cy.wrap(null));
          }

          const $botonSi = $body.find(selectorBotonSi).filter(':visible').first();
          if ($botonSi.length) {
            return cy.wrap($botonSi)
              .click({ force: true })
              .then(() => cy.wait(500))
              .then(() => verificarError500DespuesEditar(casoExcel, numero))
              .then((huboError) => huboError ? cy.wrap({ huboError: true }) : cy.wrap(null));
          }

          const $aceptar = $body.find(selectorBotonAceptar).filter(':visible')
            .filter((_, el) => /aceptar/i.test(Cypress.$(el).text().trim()))
            .first();

          if ($aceptar.length) {
            return cy.wrap($aceptar)
              .click({ force: true })
              .then(() => cy.wait(500))
              .then(() => verificarError500DespuesEditar(casoExcel, numero))
              .then((huboError) => huboError ? cy.wrap({ huboError: true }) : cy.wrap(null));
          }

          return cy.wrap(null);
        });
      })
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) return cy.wrap({ huboError: true });

        return cy.wrap(null);
      })
      .then((resultadoAnterior) => {
        if (resultadoAnterior?.huboError) {
          cy.log('ERROR 500 detectado - no se recarga la pagina');
          return cy.wrap({ huboError: true });
        }

        if (casoExcel._skipReloadFinal === true) {
          cy.log('Edicion completada sin recargar la pantalla');
          return cy.wrap(null);
        }

        cy.wait(500);
        return cy.reload(true).then(() => verificarUrlFichar());
      });

    return chain;
  }

  function prepararSegundoRegistroTrabajoSiExiste() {
    cy.log(' Limpieza: comprobar y reutilizar 2o registro en Trabajo');

    return asegurarBloqueTrabajoVisible().then(() => {
      const $bloqueTrabajo = Cypress.$(SELECTOR_BLOQUE_TRABAJO);
      if (!$bloqueTrabajo.length) {
        cy.log(' No existe bloque Trabajo');
        return cy.wrap(null);
      }

      const total = obtenerFilasTrabajoNormalizadas($bloqueTrabajo).length;
      cy.log(` Registros en Trabajo: ${total}`);

      if (total <= 1) {
        cy.log(' No hay segundo registro que reutilizar');
        return cy.wrap(null);
      }

      const casoLimpiezaBase = {
        caso: 'TC_LIMPIEZA',
        nombre: 'Preparar segundo registro de Trabajo',
        dato_1: '10:00',
        dato_2: '11:00',
        _indexEntradaOverride: 1,
        _skipReloadFinal: true,
        _tipoCampoOverride: 'start'
      };

      return editarTramoTrabajoCaso(casoLimpiezaBase)
        .then((resultado) => {
          if (resultado?.huboError) {
            return cy.wrap({ huboError: true });
          }

          return editarTramoTrabajoCaso({
            ...casoLimpiezaBase,
            _tipoCampoOverride: 'end'
          });
        })
        .then((resultado) => {
          if (resultado?.huboError) {
            cy.log(' Limpieza terminada con ERROR 500');
            return cy.wrap({ huboError: true });
          }

          cy.log(' Limpieza terminada reutilizando el 2o registro');
          return cy.wrap(null);
        });
    });
  }

  function fichajeTrabajo(casoExcel) {
    const casoId = String(casoExcel.caso || '').toUpperCase();

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (modo fichajeTrabajo)`);

    const obtenerDatoPorValorEtiqueta = (matcher) => {
      for (let i = 1; i <= 11; i += 1) {
        const valorEtiqueta = String(casoExcel[`valor_etiqueta_${i}`] || '').trim().toLowerCase();
        if (!valorEtiqueta) continue;
        if (matcher(valorEtiqueta)) {
          return String(casoExcel[`dato_${i}`] || '').trim();
        }
      }
      return '';
    };

    const obtenerPrimeraHoraValidaDelCaso = () => {
      for (let i = 1; i <= 11; i += 1) {
        const valor = casoExcel[`dato_${i}`];
        const { time } = normalizarHora({ base: valor }) || {};
        if (time) {
          return time;
        }
      }
      return '';
    };

    if (casoId === 'TC024') {
      const horaEntrada =
        obtenerDatoPorValorEtiqueta((valorEtiqueta) => valorEtiqueta.includes('entry-start')) ||
        obtenerDatoPorEtiqueta(casoExcel, 'hora') ||
        obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) ||
        obtenerPrimeraHoraValidaDelCaso() ||
        casoExcel.dato_2;

      cy.log(`TC024 hora entrada resuelta: ${horaEntrada || '(vacia)'}`);

      return asegurarSesionFichar(casoExcel)
        .then(() => editarTramoTrabajoCaso({
          ...casoExcel,
          _tipoCampoOverride: 'start',
          _horaOverride: horaEntrada
        }))
        .then((resultado) => {
          if (resultado?.huboError) {
            return cy.wrap({ huboError: true });
          }
          return cy.wrap(null);
        });
    }

    if (casoId === 'TC025') {
      const horaSalida =
        obtenerDatoPorValorEtiqueta((valorEtiqueta) => valorEtiqueta.includes('entry-end')) ||
        obtenerDatoPorEtiqueta(casoExcel, 'hora_salida') ||
        obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) ||
        obtenerPrimeraHoraValidaDelCaso() ||
        casoExcel.dato_2;

      cy.log(`TC025 hora salida resuelta: ${horaSalida || '(vacia)'}`);

      return asegurarSesionFichar(casoExcel)
        .then(() => editarTramoTrabajoCaso({
          ...casoExcel,
          _tipoCampoOverride: 'end',
          _horaOverride: horaSalida
        }))
        .then((resultado) => {
          if (resultado?.huboError) {
            return cy.wrap({ huboError: true });
          }
          return cy.wrap(null);
        });
    }

    if (['TC026', 'TC027', 'TC030'].includes(casoId)) {
      return asegurarSesionFichar(casoExcel)
        .then(() => editarTramoTrabajoCaso(casoExcel))
        .then((resultado) => {
          if (resultado?.huboError) {
            return cy.wrap({ huboError: true });
          }
          return cy.wrap(null);
        });
    }

    cy.log('Caso no manejado especificamente en fichajeTrabajo');
    return cy.wrap(null);
  }

  return {
    obtenerCantidadFilasTrabajo,
    prepararSegundoRegistroTrabajoSiExiste,
    verificarError500DespuesEditar,
    verificarError500DespuesEliminar,
    editarTramoTrabajoCaso,
    fichajeTrabajo
  };
}
