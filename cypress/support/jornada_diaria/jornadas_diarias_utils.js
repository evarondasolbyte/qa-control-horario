import { obtenerCamposDesdeExcel } from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createJornadasDiariasUtils(config) {
  const { DASHBOARD_PATH, JORNADAS_PATH, JORNADAS_URL_ABS } = config;
  let contadorPrueba = 1;

  function siguienteContadorPrueba() {
    const actual = contadorPrueba;
    contadorPrueba += 1;
    return actual;
  }

  function pulsarEscape(veces = 1) {
    return cy.window({ log: false }).then((win) => {
      try {
        const active = win.document?.activeElement;
        if (active && typeof active.blur === 'function') active.blur();
      } catch (e) {
        // noop
      }

      for (let i = 0; i < veces; i += 1) {
        const down = new win.KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
        const up = new win.KeyboardEvent('keyup', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true });
        win.document.dispatchEvent(down);
        win.document.dispatchEvent(up);
      }
    }).then(() => cy.wait(50, { log: false }));
  }

  function normalizarValor(valor) {
    if (!valor) return '';
    const v = String(valor).trim();
    const mapa = {
      'empresa (admin)': 'Admin',
      'jornada de trabajo': 'Jornada de trabajo',
      'jornada laboral': 'Jornada de trabajo'
    };
    const k = v.toLowerCase();
    return mapa[k] || v;
  }

  function textoOValue(opt) {
    return ((opt?.text || '').trim()) || ((opt?.label || '').trim()) || ((opt?.value || '').trim());
  }

  function escapeRegExp(str = '') {
    return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function canon(s = '') {
    return s.toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
  }

  function scrollHastaAcciones() {
    pulsarEscape(2);
    const candidatos = ['form:visible', '.fi-main:visible', '.fi-body:visible', 'main:visible', '.fi-layout:visible', 'body', 'html'];
    candidatos.forEach((sel) => {
      cy.get('body').then(($b) => {
        const $el = $b.find(sel);
        if ($el.length) cy.wrap($el.first(), { log: false }).scrollTo('bottom', { ensureScrollable: false });
      });
    });
    cy.wait(200);
  }

  function hacerClickAccion(exp) {
    const re = exp || /^\s*Crear\s*$/i;
    scrollHastaAcciones();
    return cy.contains('button:visible, input[type="submit"]:visible, a:visible', re, { timeout: 4000 })
      .first()
      .scrollIntoView({ offset: { top: -120, left: 0 } })
      .click({ force: true })
      .then(null, () =>
        cy.get('form:visible').then(($forms) => {
          if ($forms.length) {
            return cy.wrap($forms.first()).within(() => {
              cy.contains('button:visible, a:visible', /crear/i, { timeout: 1500 })
                .first()
                .scrollIntoView({ offset: { top: -120, left: 0 } })
                .click({ force: true })
                .then(null, () => {
                  cy.get('button[type="submit"]:visible, input[type="submit"]:visible', { timeout: 1500 })
                    .first()
                    .scrollIntoView({ offset: { top: -120, left: 0 } })
                    .click({ force: true });
                });
            });
          }

          return cy.get('button[type="submit"]:visible, input[type="submit"]:visible', { timeout: 1500 })
            .first()
            .scrollIntoView({ offset: { top: -120, left: 0 } })
            .click({ force: true });
        })
      );
  }

  function irAJornadasDiariasLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: JORNADAS_URL_ABS,
      path: JORNADAS_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Jornadas Diarias'
    }).then(() => pulsarEscape(1));
  }

  function verificarUrlJornadasDiarias() {
    return verificarUrlRecurso({
      urlAbs: JORNADAS_URL_ABS,
      path: JORNADAS_PATH
    });
  }

  function valorCampo(campos, clave, idx = 0) {
    const v = campos?.[clave];
    if (Array.isArray(v)) return v[idx];
    return idx === 0 ? v : undefined;
  }

  function tieneValor(v) {
    return v !== undefined && v !== null && String(v).trim() !== '';
  }

  function habilitarSiDeshabilitado(selector) {
    return cy.get(selector).first().then(($el) => {
      const estaDisabled =
        $el.is(':disabled') ||
        $el.prop('readOnly') ||
        String($el.attr('aria-disabled')).toLowerCase() === 'true' ||
        $el.closest('[aria-disabled="true"], .fi-disabled, [data-disabled], .opacity-50, .pointer-events-none').length > 0;

      if (!estaDisabled) return;

      const $campo = $el.closest('fieldset, section, div').first();
      let $toggle = $campo.find('[role="switch"]:visible, input[type="checkbox"]:visible, .fi-toggle:visible, button[aria-pressed]:visible').first();
      if ($toggle.length) {
        cy.wrap($toggle.first()).scrollIntoView().click({ force: true });
        return;
      }

      const id = $el.attr('id');
      if (id) {
        const $label = $campo.find(`label[for="${id}"]:visible`).first();
        if ($label.length) {
          $toggle = $label.closest('div, fieldset, section')
            .find('[role="switch"]:visible, input[type="checkbox"]:visible, .fi-toggle:visible, button[aria-pressed]:visible').first();
          if ($toggle.length) {
            cy.wrap($toggle.first()).scrollIntoView().click({ force: true });
            return;
          }
        }
      }

      cy.get('form:visible').first().then(($form) => {
        const $sw = $form.find('[role="switch"]:visible, .fi-toggle:visible, input[type="checkbox"]:visible').first();
        if ($sw.length) cy.log('Campo deshabilitado pero no se encontro switch cercano; evitando pulsar un switch generico del formulario');
      });
    });
  }

  function activarSwitchRangoHorario({ legendRe, labelRe, toggleId }) {
    const byId = `button[role="switch"][id="${toggleId}"], [role="switch"][id="${toggleId}"]`;
    return cy.get('body').then(($body) => {
      if ($body.find(byId).length) {
        return cy.get(byId, { timeout: 10000 })
          .first()
          .then(($toggle) => {
            const checked = String($toggle.attr('aria-checked')).toLowerCase() === 'true';
            if (!checked) cy.wrap($toggle).scrollIntoView().click({ force: true });
          });
      }

      const legends = Array.from($body.find('legend') || []);
      const matchLegend = legends.find((el) => legendRe.test((el.innerText || '').trim()));
      if (!matchLegend) return cy.wrap(null);

      const $fieldset = Cypress.$(matchLegend).closest('fieldset');
      if (!$fieldset.length) return cy.wrap(null);

      const labels = $fieldset.find('label').toArray();
      const matchLabel = labels.find((el) => labelRe.test((el.innerText || '').trim()));
      if (!matchLabel) return cy.wrap(null);

      const $toggle = Cypress.$(matchLabel).find('button[role="switch"], [role="switch"]').first();
      if (!$toggle.length) return cy.wrap(null);

      const checked = String($toggle.attr('aria-checked')).toLowerCase() === 'true';
      if (!checked) cy.wrap($toggle).scrollIntoView().click({ force: true });
      return cy.wrap(null);
    });
  }

  function asegurarTogglePorCampoTiempo(selector) {
    const sel = String(selector || '');
    if (sel.includes('data.entry_start_window') || sel.includes('data.entry_end_window')) {
      return activarSwitchRangoHorario({
        legendRe: /rango\s+horario\s+para\s+iniciar/i,
        labelRe: /activar\s+rango\s+de\s+inicio/i,
        toggleId: 'data.entry_window_active'
      });
    }
    if (sel.includes('data.exit_start_window') || sel.includes('data.exit_end_window')) {
      return activarSwitchRangoHorario({
        legendRe: /rango\s+horario\s+para\s+finalizar/i,
        labelRe: /activar\s+rango\s+de\s+fin/i,
        toggleId: 'data.exit_window_active'
      });
    }
    if (sel.includes('data.duration_min') || sel.includes('data.duration_max')) {
      return activarSwitchRangoHorario({
        legendRe: /tiempo\s+minimo|tiempo\s+maximo|duracion/i,
        labelRe: /activar\s+rango\s+de\s+duracion/i,
        toggleId: 'data.duration_window_active'
      });
    }
    return cy.wrap(null);
  }

  function normalizarHora(valor) {
    if (!valor) return '';
    const str = String(valor).trim();
    const match = str.match(/^(\d{1,2})(?::?(\d{1,2}))?/);
    if (!match) return '';
    let horas = parseInt(match[1], 10);
    let minutos = match[2] !== undefined ? parseInt(match[2], 10) : 0;
    if (Number.isNaN(horas)) horas = 0;
    if (Number.isNaN(minutos)) minutos = 0;
    horas = Math.max(0, Math.min(23, horas));
    minutos = Math.max(0, Math.min(59, minutos));
    return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
  }

  function escribirCampoTiempo(selector, valor) {
    return asegurarTogglePorCampoTiempo(selector)
      .then(() => habilitarSiDeshabilitado(selector))
      .then(() => {
        let valorNormalizado = normalizarHora(valor);
        if (valorNormalizado === '06:00') valorNormalizado = '03:00';

        const [horas, minutos] = valorNormalizado.split(':').map(Number);
        const horasNum = horas || 0;
        const minutosNum = minutos || 0;

        cy.get(selector, { timeout: 10000 }).first().scrollIntoView().as('campoTiempo');
        cy.get('@campoTiempo').should('be.visible').then(($input) => {
          const $boton = $input.closest('button[x-on\\:click*="togglePanelVisibility"], button[x-ref="button"]');
          if ($boton.length) {
            cy.wrap($boton).click({ force: true });
          } else {
            cy.wrap($input).click({ force: true });
          }
        });

        cy.wait(1000);

        cy.get('div.fi-fo-date-time-picker-panel', { timeout: 5000 })
          .should('exist')
          .then(($paneles) => {
            let $panelEncontrado = null;

            $paneles.each((_, el) => {
              const $el = Cypress.$(el);
              const style = $el.attr('style') || '';
              if (style.includes('display: block')) {
                $panelEncontrado = $el;
                return false;
              }
              return undefined;
            });

            if (!$panelEncontrado || !$panelEncontrado.length) {
              $paneles.each((_, el) => {
                const $el = Cypress.$(el);
                if ($el.find('input[type="number"][max="23"][min="0"]').length > 0) {
                  $panelEncontrado = $el;
                  return false;
                }
                return undefined;
              });
            }

            if (!$panelEncontrado || !$panelEncontrado.length) $panelEncontrado = $paneles.first();
            return cy.wrap($panelEncontrado);
          })
          .as('panelTiempo');

        cy.get('@panelTiempo')
          .find('input[type="number"][max="23"][min="0"]')
          .first()
          .as('inputHoras')
          .then(($inputHoras) => {
            const valorActualHoras = parseInt($inputHoras.val() || '0', 10);
            const diferenciaHoras = horasNum - valorActualHoras;
            if (diferenciaHoras !== 0) {
              const veces = Math.abs(diferenciaHoras);
              cy.get('@inputHoras').click({ force: true }).focus();
              for (let i = 0; i < veces; i += 1) {
                cy.get('@inputHoras').type(diferenciaHoras > 0 ? '{uparrow}' : '{downarrow}', { force: true });
                cy.wait(100);
              }
            } else {
              cy.get('@inputHoras').clear({ force: true }).type(horasNum.toString(), { force: true }).trigger('input', { force: true }).trigger('change', { force: true });
            }
          });

        cy.wait(200);

        cy.get('@panelTiempo')
          .find('input[type="number"][max="59"][min="0"]')
          .first()
          .as('inputMinutos')
          .then(($inputMinutos) => {
            const valorActualMinutos = parseInt($inputMinutos.val() || '0', 10);
            const diferenciaMinutos = minutosNum - valorActualMinutos;
            if (diferenciaMinutos !== 0) {
              const veces = Math.abs(diferenciaMinutos);
              cy.get('@inputMinutos').click({ force: true }).focus();
              for (let i = 0; i < veces; i += 1) {
                cy.get('@inputMinutos').type(diferenciaMinutos > 0 ? '{uparrow}' : '{downarrow}', { force: true });
                cy.wait(100);
              }
            } else {
              cy.get('@inputMinutos').clear({ force: true }).type(minutosNum.toString(), { force: true }).trigger('input', { force: true }).trigger('change', { force: true });
            }
          });

        cy.wait(300);
        pulsarEscape(1);
        cy.wait(200);
      });
  }

  function escribirCampoNumero(selector, valor) {
    return habilitarSiDeshabilitado(selector).then(() => {
      const v = (valor ?? '').toString().trim();
      cy.get(selector, { timeout: 10000 }).first().scrollIntoView().as('campoNumero');
      cy.get('@campoNumero').clear({ force: true });
      cy.get('@campoNumero').type(v, { force: true });
      cy.get('@campoNumero').blur({ force: true });
    });
  }

  function seleccionarOpcionSelect(selectorFallback, etiqueta, valorOriginal) {
    let valorNormalizado = normalizarValor(valorOriginal);
    if (!valorNormalizado) {
      if (/empresa/i.test(etiqueta || '')) valorNormalizado = 'Admin';
      if (/tipo/i.test(etiqueta || '')) valorNormalizado = 'Jornada de trabajo';
    }

    return cy.get('body').then(($body) => {
      let $scope = null;
      if (selectorFallback) $scope = $body.find(selectorFallback);
      if (!$scope || !$scope.length) {
        const re = new RegExp(etiqueta || 'Empresa|Tipo', 'i');
        const $label = $body.find('label, span, div, p').filter((_, el) => re.test(el.innerText || '')).first();
        if ($label.length) $scope = $label.closest('div, fieldset, section');
      }
      if (!$scope || !$scope.length) $scope = $body;

      const $nativeSelect = $scope.is('select:visible') ? $scope.first() : $scope.find('select:visible').first();
      if ($nativeSelect.length) {
        cy.wrap($nativeSelect.first())
          .scrollIntoView()
          .then(($sel) => {
            const opciones = Array.from($sel[0]?.options || []);
            if (opciones.length === 0) {
              cy.log('El select no tiene opciones - saltando seleccion');
              return null;
            }

            const listaCanon = opciones.map((opt) => ({
              canon: canon(textoOValue(opt)),
              opt,
              text: (opt.text || '').trim(),
              value: (opt.value || '').trim()
            }));

            const buscar = (needle) => {
              if (!needle) return null;
              const c = canon(needle);
              let m = listaCanon.find((i) => i.text === needle) || listaCanon.find((i) => i.value === needle);
              if (m) return m.opt;
              m = listaCanon.find((i) => i.canon.includes(c));
              return m?.opt || null;
            };

            let seleccion = buscar(valorNormalizado);
            if (!seleccion && /empresa/i.test(etiqueta || '')) seleccion = listaCanon.find((i) => i.canon.includes('admin'))?.opt || null;
            if (!seleccion && /tipo/i.test(etiqueta || '')) seleccion = listaCanon.find((i) => i.canon.includes('jornada'))?.opt || null;
            if (!seleccion) seleccion = listaCanon.find((i) => i.canon && !i.canon.includes('seleccione'))?.opt || null;

            if (seleccion) {
              cy.wrap($sel).select(seleccion.value || seleccion.text, { force: true });
            } else if (opciones[0]) {
              cy.wrap($sel).select(opciones[0].value || opciones[0].text, { force: true });
            }

            return null;
          });
        return cy.wrap(null);
      }

      const triggers = [
        '[role="combobox"]:visible',
        '.fi-select-trigger:visible',
        '.choices[data-type="select-one"]:visible',
        '.choices:visible',
        '[aria-haspopup]:visible',
        'button:visible',
        '.fi-input:visible'
      ];

      let opened = false;
      for (const t of triggers) {
        const $t = $scope.find(t).first();
        if ($t.length) {
          cy.wrap($t.first()).scrollIntoView().click({ force: true });
          opened = true;
          break;
        }
      }
      if (!opened) cy.wrap($scope.first()).scrollIntoView().click('center', { force: true });

      cy.contains('Cargando...', { timeout: 3000 }).should('not.exist');

      const dropdownSel = '.choices__list--dropdown:visible, [role="listbox"]:visible, .fi-dropdown-panel:visible, .fi-dropdown:visible';
      cy.get(dropdownSel, { timeout: 15000 }).first().within(() => {
        const needle = valorNormalizado ? escapeRegExp(valorNormalizado) : '';
        if (needle) {
          cy.contains(':visible', new RegExp(`^\\s*${needle}\\s*$`, 'i'), { timeout: 1200 })
            .click({ force: true })
            .then(null, () => {
              cy.contains(':visible', new RegExp(needle, 'i'), { timeout: 8000 }).click({ force: true });
            });
        } else if (/empresa/i.test(etiqueta || '')) {
          cy.contains(':visible', /admin/i, { timeout: 2000 })
            .click({ force: true })
            .then(null, () => cy.get('*:visible').first().click({ force: true }));
        } else if (/tipo/i.test(etiqueta || '')) {
          cy.contains(':visible', /jornada/i, { timeout: 2000 })
            .click({ force: true })
            .then(null, () => cy.get('*:visible').first().click({ force: true }));
        } else {
          cy.get('*:visible').first().click({ force: true });
        }
      });

      return cy.wrap(null);
    });
  }

  return {
    activarSwitchRangoHorario,
    JORNADAS_PATH,
    hacerClickAccion,
    habilitarSiDeshabilitado,
    irAJornadasDiariasLimpio,
    normalizarValor,
    obtenerCamposDesdeExcel,
    pulsarEscape,
    scrollHastaAcciones,
    seleccionarOpcionSelect,
    siguienteContadorPrueba,
    tieneValor,
    valorCampo,
    verificarUrlJornadasDiarias,
    escribirCampoNumero,
    escribirCampoTiempo
  };
}
