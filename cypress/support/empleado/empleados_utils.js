import {
  extraerDesdeNombre,
  generarNombreUnico,
  obtenerDatoEnTexto,
  obtenerDatoPorEtiqueta
} from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createEmpleadosUtils(config) {
  const { EMPLEADOS_URL_ABS, EMPLEADOS_PATH, DASHBOARD_PATH } = config;

  function irAEmpleadosLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: EMPLEADOS_URL_ABS,
      path: EMPLEADOS_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Empleados'
    });
  }

  function verificarUrlEmpleados() {
    return verificarUrlRecurso({
      urlAbs: EMPLEADOS_URL_ABS,
      path: EMPLEADOS_PATH
    });
  }

  function obtenerDatoPorEtiquetaParcial(casoExcel, etiquetaBuscada) {
    if (!etiquetaBuscada) return '';
    const patron = etiquetaBuscada.toLowerCase().trim();

    for (let i = 1; i <= 11; i += 1) {
      const etiqueta = (casoExcel[`etiqueta_${i}`] || '').toLowerCase().trim();
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      const dato = (casoExcel[`dato_${i}`] || '').trim();

      if (!dato) continue;
      if (etiqueta.includes(patron) || valorEtiqueta.includes(patron)) return dato;
    }

    return '';
  }

  function obtenerChoicesPorOrden(casoExcel) {
    const valores = [];

    for (let i = 1; i <= 11; i += 1) {
      const etiqueta = (casoExcel[`etiqueta_${i}`] || '').toLowerCase().trim();
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      const dato = (casoExcel[`dato_${i}`] || '').trim();

      if (!dato) continue;

      const esChoice =
        valorEtiqueta.includes('choices') ||
        valorEtiqueta.includes('select') ||
        etiqueta.includes('choices') ||
        valorEtiqueta.includes('current_group_id') ||
        valorEtiqueta.includes('department') ||
        valorEtiqueta.includes('role');

      if (esChoice) valores.push(dato);
    }

    return valores;
  }

  function obtenerTextoBusqueda(casoExcel) {
    return casoExcel.dato_1 ||
      obtenerDatoPorEtiqueta(casoExcel, 'search') ||
      obtenerDatoEnTexto(casoExcel, 'search') ||
      'Admin';
  }

  function obtenerFormularioEmpleadoVisible() {
    return cy.get('body', { timeout: 10000 }).then(($body) => {
      const $formulario = $body.find('form:visible').filter((_, el) => {
        const $el = Cypress.$(el);
        const texto = ($el.text() || '').toLowerCase();
        return texto.includes('nombre') ||
          texto.includes('email') ||
          texto.includes('empresa') ||
          $el.find('input[name="data.name"], input[name="data.email"], textarea[name="data.notes"], trix-editor#data\\.notes').length > 0;
      }).first();

      if ($formulario.length) return cy.wrap($formulario);

      const $contenedor = $body.find('.fi-page:visible, main:visible, .fi-main:visible, [role="dialog"]:visible').filter((_, el) => {
        const $el = Cypress.$(el);
        return $el.find('input[name="data.name"], input[name="data.email"], textarea[name="data.notes"], trix-editor#data\\.notes').length > 0;
      }).first();

      if ($contenedor.length) return cy.wrap($contenedor);

      throw new Error('No se encontro el formulario visible de creacion de empleados');
    });
  }

  function abrirFormularioCrearEmpleado() {
    return verificarUrlEmpleados()
      .then(() => cy.get('body').type('{esc}', { force: true }))
      .then(() =>
        cy.contains('button, a', /Crear empleado/i, { timeout: 10000 })
          .should('be.visible')
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => {
        cy.wait(1500);
        return cy.location('pathname', { timeout: 15000 }).then((pathname) => {
          if (!pathname.includes(`${EMPLEADOS_PATH}/create`)) {
            cy.log('URL incorrecta - registrando en Excel');
            return cy.wrap({
              error: 'ERROR_FORMULARIO_NO_ABIERTO',
              mensaje: 'ERROR: No se pudo abrir el formulario correctamente. URL incorrecta.'
            });
          }

          return cy.document({ timeout: 15000 }).then((doc) => {
            const textoDocumento = doc?.body ? (doc.body.textContent || '').toLowerCase() : '';
            const tieneError500 = textoDocumento.includes('500') ||
              textoDocumento.includes('internal server error') ||
              textoDocumento.includes('error interno del servidor') ||
              textoDocumento.includes('server error') ||
              textoDocumento.includes('500 server error');

            if (tieneError500) {
              cy.log('ERROR 500 detectado - registrando en Excel');
              throw new Error('ERROR_500_DETECTADO: Error interno del servidor detectado en la pagina');
            }

            return obtenerFormularioEmpleadoVisible()
              .within(() => {
                cy.get('input[name="data.name"], input#data\\.name', { timeout: 15000 })
                  .filter(':visible')
                  .first()
                  .should('be.visible');
                cy.get('input[name="data.email"], input#data\\.email', { timeout: 15000 })
                  .filter(':visible')
                  .first()
                  .should('be.visible');
              })
              .then(() => cy.wrap({ error: null }));
          });
        });
      });
  }

  function normalizarTextoComparacion(texto) {
    return (texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\*/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function limpiarTextoSeleccionChoices(texto) {
    return (texto || '')
      .replace(/\s+/g, ' ')
      .replace(/×/g, '')
      .trim();
  }

  function obtenerSelectoresCampoPorLabel(label) {
    const normalizado = normalizarTextoComparacion(label);
    const mapa = {
      empresa: ['#data\\.company_id'],
      grupo: ['#data\\.current_group_id'],
      departamento: ['#data\\.department_id'],
      roles: ['#data\\.roles'],
      rol: ['#data\\.roles']
    };

    return mapa[normalizado] || [];
  }

  function obtenerInputSelectorsCampoPorLabel(label) {
    const normalizado = normalizarTextoComparacion(label);
    const mapa = {
      empresa: ['#data\\.company_id', 'select[name="data.company_id"]', 'input[name="data.company_id"]'],
      grupo: ['#data\\.current_group_id', 'select[name="data.current_group_id"]', 'input[name="data.current_group_id"]'],
      departamento: ['#data\\.department_id', 'select[name="data.department_id"]', 'input[name="data.department_id"]'],
      roles: ['#data\\.roles', 'select[name="data.roles"]', 'input[name="data.roles"]'],
      rol: ['#data\\.roles', 'select[name="data.roles"]', 'input[name="data.roles"]']
    };

    return mapa[normalizado] || [];
  }

  function encontrarTriggerChoicesEnContenedor($scope, label, openersSelector) {
    const selectoresDirectos = obtenerSelectoresCampoPorLabel(label);
    const inputSelectors = obtenerInputSelectorsCampoPorLabel(label);
    let $objetivo = Cypress.$();

    for (const selector of inputSelectors) {
      const $input = $scope.find(selector).first();
      if (!$input.length) continue;

      const $choices = $input.closest('.choices');
      if ($choices.length) return $choices;

      const $wrapper = $input.closest('.fi-fo-select, .fi-input-wrp, [data-field-wrapper], .fi-fo-field-wrp');
      if ($wrapper.length) {
        $objetivo = $wrapper.find(openersSelector).filter(':visible').first();
        if ($objetivo.length) return $objetivo;
      }
    }

    for (const selector of selectoresDirectos) {
      const $wrapper = $scope.find(selector).first();
      if (!$wrapper.length) continue;

      $objetivo = $wrapper.is(openersSelector)
        ? $wrapper.first()
        : $wrapper.find(openersSelector).filter(':visible').first();

      if ($objetivo.length) return $objetivo;
    }

    const labelNormalizado = normalizarTextoComparacion(label);
    const candidatos = $scope.find('label, legend, span, div')
      .filter((_, el) => {
        const texto = normalizarTextoComparacion(Cypress.$(el).text());
        return texto === labelNormalizado || texto.startsWith(`${labelNormalizado} `);
      })
      .get();

    for (const candidato of candidatos) {
      const $label = Cypress.$(candidato);
      const wrappers = [
        $label.closest('[data-field-wrapper]'),
        $label.closest('.fi-field'),
        $label.closest('.fi-fo-field-wrp'),
        $label.closest('.fi-fo-field'),
        $label.closest('[wire\\:key]'),
        $label.parent()
      ].filter(($el) => $el && $el.length);

      for (const $wrapper of wrappers) {
        $objetivo = $wrapper.is(openersSelector)
          ? $wrapper.first()
          : $wrapper.find(openersSelector).filter(':visible').first();
        if ($objetivo.length) return $objetivo;
      }
    }

    return $scope.find(openersSelector).filter(':visible').first();
  }

  function encontrarChoicesPorInputSelectors($scope, inputSelectors = []) {
    for (const selector of inputSelectors) {
      const $input = $scope.find(selector).first();
      if (!$input.length) continue;

      const $choices = $input.closest('.choices');
      if ($choices.length) return $choices.first();

      const $wrapper = $input.closest('.fi-fo-select, .fi-input-wrp, [data-field-wrapper], .fi-fo-field-wrp');
      if ($wrapper.length) {
        const $objetivo = $wrapper.find('.choices, [role="combobox"], select, .fi-select-trigger').filter(':visible').first();
        if ($objetivo.length) return $objetivo;
      }
    }

    return Cypress.$();
  }

  function seleccionarChoiceFormularioPorCampo(texto, { sectionSelector = '', inputSelector, label = '' } = {}) {
    if (!texto || !inputSelector) return cy.wrap(null);
    const regex = new RegExp(`^\\s*${texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i');

    function obtenerChoicesDesdeFormulario($formulario) {
      const $scope = Cypress.$($formulario);
      const $seccion = sectionSelector ? $scope.find(sectionSelector).first() : $scope;
      const $input = $seccion.find(inputSelector).first();
      if (!$input.length) return Cypress.$();
      return $input.closest('.choices').first();
    }

    return obtenerFormularioEmpleadoVisible()
      .then(($formulario) => {
        const $choices = obtenerChoicesDesdeFormulario($formulario);
        if (!$choices.length) return cy.wrap({ huboError: true });

        const $trigger = $choices.find('.choices__inner, [role="combobox"]').filter(':visible').first();
        if (!$trigger.length) return cy.wrap({ huboError: true });

        return cy.get('body')
          .type('{esc}', { force: true })
          .then(() => cy.wrap($trigger).scrollIntoView().click({ force: true }));
      })
      .then((resultado) => {
        if (resultado && resultado.huboError === true) return cy.wrap({ huboError: true });

        return cy.wait(300)
          .then(() => obtenerFormularioEmpleadoVisible())
          .then(($formularioActualizado) => {
            const $choices = obtenerChoicesDesdeFormulario($formularioActualizado);
            if (!$choices.length) return cy.wrap({ huboError: true });

            const $dropdown = $choices.find('.choices__list--dropdown:visible').first();
            if (!$dropdown.length) return cy.wrap({ huboError: true });

            const $inputBusqueda = $dropdown.find('.choices__input, .choices__input--cloned, input[type="search"]').filter(':visible').first();
            if ($inputBusqueda.length) {
              cy.wrap($inputBusqueda)
                .type('{selectall}{backspace}', { force: true })
                .type(texto, { force: true, delay: 20 });
            }

            return cy.contains('.choices__item--choice:visible, [role="option"]:visible', regex, { timeout: 15000 })
              .scrollIntoView({ duration: 200 })
              .click({ force: true })
              .then(() => cy.wait(700))
              .then(() => cy.get('body').type('{esc}', { force: true }))
              .then(() => cy.wrap(null));
          });
      });
  }

  function seleccionarEmpresa(nombre) {
    return seleccionarChoiceFormularioPorCampo(nombre, {
      sectionSelector: '#data\\.estado-y-empresa',
      inputSelector: '#data\\.company_id',
      label: 'Empresa'
    });
  }

  function seleccionarGrupo(nombre) {
    return seleccionarChoiceFormularioPorCampo(nombre, {
      sectionSelector: '#data\\.organizacion',
      inputSelector: '#data\\.current_group_id',
      label: 'Grupo'
    });
  }

  function escribirCampo(selector, valor) {
    return cy.uiEscribirCampo(selector, valor);
  }

  function escribirCampoFormulario(selector, valor) {
    if (!valor) return cy.wrap(null);

    return obtenerFormularioEmpleadoVisible().within(() => {
      cy.get(selector, { timeout: 10000 })
        .filter(':visible')
        .first()
        .scrollIntoView()
        .then(($campo) => {
          const tagName = ($campo.prop('tagName') || '').toLowerCase();
          if (tagName === 'trix-editor') {
            cy.wrap($campo).type('{selectall}{backspace}', { force: true });
            cy.wrap($campo).type(valor, { force: true, delay: 20 });
            return;
          }

          cy.wrap($campo).clear({ force: true }).type(valor, { force: true, delay: 20 });
        });
    });
  }

  function seleccionarOpcionChoicesFormulario(texto, label) {
    if (!texto) return cy.wrap(null);

    const regex = new RegExp(texto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const openersSelector = '.choices__inner, .choices, [role="combobox"], [aria-haspopup="listbox"], select, .fi-select-trigger';

    return obtenerFormularioEmpleadoVisible().then(($formulario) => {
      const $scope = Cypress.$($formulario);
      let $objetivo = label
        ? encontrarTriggerChoicesEnContenedor($scope, label, openersSelector)
        : Cypress.$();

      if (!$objetivo.length) {
        $objetivo = $scope.find(openersSelector).filter(':visible').first();
      }

      if (!$objetivo.length) {
        return cy.wrap({ huboError: true });
      }

      if ($objetivo.is('select')) {
        const $opcion = $objetivo.find('option').filter((_, option) => {
          return regex.test((Cypress.$(option).text() || '').trim());
        }).first();

        if ($opcion.length) {
          cy.wrap($objetivo).select($opcion.text().trim(), { force: true });
          return cy.wrap(null);
        }
      }

      return cy.wrap($objetivo)
        .scrollIntoView()
        .click({ force: true })
        .then(() => cy.wait(300))
        .then(() => cy.get('.choices.is-open, .choices[aria-expanded="true"], .choices.is-focused', { timeout: 10000 }).filter(':visible').last())
        .then(($choicesAbierto) => {
          const $dropdown = Cypress.$($choicesAbierto)
            .find('.choices__list--dropdown, .fi-select-panel, [role="listbox"]')
            .filter(':visible')
            .first();

          if (!$dropdown.length) {
            return cy.wrap({ huboError: true });
          }

          const $input = $dropdown.find('.choices__input, .choices__input--cloned, input[placeholder*="Teclee"], input[placeholder*="Buscar"], input[type="search"]')
            .filter(':visible')
            .first();

          if ($input.length) {
            cy.wrap($input)
              .clear({ force: true })
              .type(texto, { force: true, delay: 20 });
          }

          return cy.wrap($dropdown).then(($dd) => {
            const $opciones = Cypress.$($dd)
              .find('.choices__item--choice:visible, [role="option"]:visible')
              .filter((_, el) => {
                const textoOpcion = (Cypress.$(el).text() || '').trim();
                const ariaDisabled = Cypress.$(el).attr('aria-disabled');
                return textoOpcion.length > 0 &&
                  ariaDisabled !== 'true' &&
                  !/seleccione una opcion/i.test(textoOpcion);
              });

            const $coincidencia = $opciones.filter((_, el) => regex.test((Cypress.$(el).text() || '').trim())).first();
            const $objetivoOpcion = $coincidencia.length ? $coincidencia : $opciones.first();

            if (!$objetivoOpcion.length) {
              return cy.wrap({ huboError: true });
            }

            return cy.wrap($objetivoOpcion)
              .scrollIntoView({ duration: 200 })
              .click({ force: true });
          });
        })
        .then(() => cy.wait(200));
    });
  }

  function encontrarBotonAlFinal(textoBoton) {
    return cy.uiEncontrarBotonAlFinal(textoBoton);
  }

  function enviarFormularioCrear() {
    return obtenerFormularioEmpleadoVisible().then(($formulario) => {
      const $scope = Cypress.$($formulario);
      const patrones = [/^\s*Guardar\s*$/i, /^\s*Crear\s*$/i, /Guardar|Crear|Enviar/i];
      const selectoresBoton = 'button, input[type="submit"], a, .fi-ac-btn-action';

      for (const patron of patrones) {
        const $btn = $scope.find(`${selectoresBoton}:visible`).filter((_, el) => {
          const $el = Cypress.$(el);
          const texto = ($el.text() || $el.val() || '').trim();
          return patron.test(texto);
        }).first();

        if ($btn.length) {
          return cy.wrap($btn).scrollIntoView({ duration: 300 }).should('be.visible').click({ force: true });
        }
      }

      return encontrarBotonAlFinal('Guardar');
    });
  }

  function esperarToastExito() {
    return cy.uiEsperarToastExito();
  }

  function confirmarModal(textos = []) {
    return cy.uiConfirmarModal(textos);
  }

  function verificarErrorEsperado(palabrasClave = []) {
    return cy.uiVerificarErrorEsperado(palabrasClave);
  }

  function obtenerValorEmpresa(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'empresa') ||
      obtenerDatoEnTexto(casoExcel, 'Empresa') ||
      obtenerChoicesPorOrden(casoExcel)[0] ||
      casoExcel.dato_1 ||
      '';
  }

  function obtenerValorNombre(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.name') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre') ||
      casoExcel.dato_2 ||
      '';
  }

  function obtenerValorApellidos(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.surname') ||
      obtenerDatoEnTexto(casoExcel, 'Apellidos') ||
      '';
  }

  function obtenerValorEmail(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.email') ||
      obtenerDatoEnTexto(casoExcel, 'Email') ||
      casoExcel.dato_3 ||
      '';
  }

  function obtenerValorTelefono(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.phone') ||
      obtenerDatoEnTexto(casoExcel, 'Telefono') ||
      obtenerDatoEnTexto(casoExcel, 'Teléfono') ||
      '';
  }

  function obtenerValorGrupo(casoExcel) {
    return obtenerDatoEnTexto(casoExcel, 'Grupo') ||
      obtenerDatoPorEtiquetaParcial(casoExcel, 'current_group_id') ||
      obtenerDatoPorEtiqueta(casoExcel, 'choices_item') ||
      obtenerChoicesPorOrden(casoExcel)[1] ||
      casoExcel.dato_4 ||
      '';
  }

  function obtenerValorDepartamento(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'choices_item') ||
      obtenerDatoPorEtiquetaParcial(casoExcel, 'department') ||
      obtenerDatoEnTexto(casoExcel, 'Departamento') ||
      obtenerChoicesPorOrden(casoExcel)[1] ||
      '';
  }

  function obtenerValorRoles(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'choices_inner') ||
      obtenerDatoPorEtiquetaParcial(casoExcel, 'role') ||
      obtenerDatoEnTexto(casoExcel, 'Roles') ||
      obtenerDatoEnTexto(casoExcel, 'Rol') ||
      obtenerChoicesPorOrden(casoExcel)[2] ||
      '';
  }

  function obtenerValorNotas(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.notes') ||
      obtenerDatoEnTexto(casoExcel, 'Notas') ||
      obtenerDatoEnTexto(casoExcel, 'Notas visibles') ||
      '';
  }

  return {
    abrirFormularioCrearEmpleado,
    confirmarModal,
    escribirCampo,
    escribirCampoFormulario,
    enviarFormularioCrear,
    encontrarBotonAlFinal,
    esperarToastExito,
    extraerDesdeNombre,
    generarNombreUnico,
    irAEmpleadosLimpio,
    obtenerChoicesPorOrden,
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerDatoPorEtiquetaParcial,
    obtenerFormularioEmpleadoVisible,
    obtenerTextoBusqueda,
    obtenerValorApellidos,
    obtenerValorDepartamento,
    obtenerValorEmail,
    obtenerValorEmpresa,
    obtenerValorGrupo,
    obtenerValorNombre,
    obtenerValorNotas,
    obtenerValorRoles,
    obtenerValorTelefono,
    seleccionarEmpresa,
    seleccionarGrupo,
    seleccionarOpcionChoicesFormulario,
    verificarErrorEsperado,
    verificarUrlEmpleados
  };
}
