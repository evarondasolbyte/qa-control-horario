export function createJornadasDiariasFormularioActions(deps) {
  const {
    hacerClickAccion,
    JORNADAS_PATH,
    normalizarValor,
    obtenerCamposDesdeExcel,
    pulsarEscape,
    scrollHastaAcciones,
    seleccionarOpcionSelect,
    siguienteContadorPrueba,
    tieneValor,
    valorCampo,
    escribirCampoNumero,
    escribirCampoTiempo
  } = deps;

  function abrirFormularioCrear() {
    cy.contains('a, button', /Crear Jornada Diaria/i, { timeout: 10000 }).first().click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias/create');
  }

  function crearCancelar() {
    return abrirFormularioCrear()
      .then(() => cy.contains('button, a', /Cancelar/i, { timeout: 10000 }).click({ force: true }))
      .then(() => cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias'));
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const campos = obtenerCamposDesdeExcel(casoExcel);
    try {
      const keys = Object.keys(campos || {});
      const entryKeys = keys.filter((k) => /data\.entry_/i.test(k));
      const exitKeys = keys.filter((k) => /data\.exit_/i.test(k));
      cy.log(`Campos (entry): ${entryKeys.join(', ') || '(ninguno)'}`);
      cy.log(`Campos (exit): ${exitKeys.join(', ') || '(ninguno)'}`);
    } catch (e) {
      // noop
    }
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    cy.url().then((current) => {
      if (!current.includes('/jornadas-diarias/create')) {
        abrirFormularioCrear();
        cy.wait(800);
      }
    });

    if (tieneValor(valorCampo(campos, 'data.company_id'))) {
      seleccionarOpcionSelect('.choices[data-type="select-one"], select#data\\.company_id', 'Empresa', valorCampo(campos, 'data.company_id'));
    } else if (numero !== 20) {
      seleccionarOpcionSelect('.choices[data-type="select-one"], select#data\\.company_id', 'Empresa', 'Admin');
    }

    if (tieneValor(valorCampo(campos, 'data.entry_category'))) {
      seleccionarOpcionSelect(null, 'Tipo', normalizarValor(valorCampo(campos, 'data.entry_category')));
    } else if (![23].includes(numero)) {
      seleccionarOpcionSelect(null, 'Tipo', 'Jornada de trabajo');
    }

    if (tieneValor(valorCampo(campos, 'data.name')) && numero !== 21) {
      let nombre = valorCampo(campos, 'data.name');
      if (nombre.trim().endsWith('+')) {
        const base = nombre.trim().slice(0, -1);
        nombre = `${base}${siguienteContadorPrueba()}`;
      }
      if (nombre.includes('XXX')) {
        const randomNum = Math.floor(Math.random() * 900) + 100;
        nombre = nombre.replace('XXX', randomNum.toString());
      }
      cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
        .first()
        .scrollIntoView()
        .clear({ force: true })
        .type(nombre, { force: true });
    } else if (numero === 21) {
      cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
        .first()
        .scrollIntoView()
        .clear({ force: true });
    }

    if (tieneValor(valorCampo(campos, 'data.description'))) {
      cy.get('textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description', { timeout: 10000 })
        .first()
        .scrollIntoView()
        .clear({ force: true })
        .type(valorCampo(campos, 'data.description'), { force: true });
    }

    const nombreCaso = String(casoExcel?.nombre || '');
    const casoEsFinalizar = numero === 25 || /finalizar/i.test(nombreCaso);

    const entryStart0 = valorCampo(campos, 'data.entry_start_window', 0);
    const entryEnd0 = valorCampo(campos, 'data.entry_end_window', 0);
    const entryStart1 = valorCampo(campos, 'data.entry_start_window', 1);
    const entryEnd1 = valorCampo(campos, 'data.entry_end_window', 1);
    const exitStart0 = valorCampo(campos, 'data.exit_start_window', 0);
    const exitEnd0 = valorCampo(campos, 'data.exit_end_window', 0);

    if (!casoEsFinalizar && (tieneValor(entryStart0) || tieneValor(entryEnd0))) {
      deps.activarSwitchRangoHorario({
        legendRe: /rango\s+horario\s+para\s+iniciar/i,
        labelRe: /activar\s+rango\s+de\s+inicio/i,
        toggleId: 'data.entry_window_active'
      });
      cy.wait(200);
      if (tieneValor(entryStart0)) escribirCampoTiempo('input[name="data.entry_start_window"], input#data\\.entry_start_window', entryStart0);
      if (tieneValor(entryEnd0)) escribirCampoTiempo('input[name="data.entry_end_window"], input#data\\.entry_end_window', entryEnd0);
    }

    const finStart = tieneValor(exitStart0) ? exitStart0 : (tieneValor(entryStart1) ? entryStart1 : (casoEsFinalizar ? entryStart0 : undefined));
    const finEnd = tieneValor(exitEnd0) ? exitEnd0 : (tieneValor(entryEnd1) ? entryEnd1 : (casoEsFinalizar ? entryEnd0 : undefined));

    if (tieneValor(finStart) || tieneValor(finEnd)) {
      deps.activarSwitchRangoHorario({
        legendRe: /rango\s+horario\s+para\s+finalizar/i,
        labelRe: /activar\s+rango\s+de\s+fin/i,
        toggleId: 'data.exit_window_active'
      });
      cy.wait(200);
      if (tieneValor(finStart)) escribirCampoTiempo('input[name="data.exit_start_window"], input#data\\.exit_start_window', finStart);
      if (tieneValor(finEnd)) escribirCampoTiempo('input[name="data.exit_end_window"], input#data\\.exit_end_window', finEnd);
    }

    if (campos['data.duration_min'] || campos['data.duration_max']) {
      cy.get('button#data\\.duration_window_active[role="switch"]', { timeout: 10000 }).then(($toggle) => {
        if ($toggle.length && $toggle.attr('aria-checked') !== 'true') {
          cy.wrap($toggle).scrollIntoView().click({ force: true });
          cy.wait(300);
        }
      });
    }
    if (campos['data.duration_min']) escribirCampoTiempo('input[name="data.duration_min"], input#data\\.duration_min', campos['data.duration_min']);
    if (campos['data.duration_max']) escribirCampoTiempo('input[name="data.duration_max"], input#data\\.duration_max', campos['data.duration_max']);

    if (campos['data.daily_min_entries']) {
      cy.get('button#data\\.daily_min_entries_active[role="switch"]', { timeout: 10000 }).then(($toggle) => {
        if ($toggle.length && $toggle.attr('aria-checked') !== 'true') {
          cy.wrap($toggle).scrollIntoView().click({ force: true });
          cy.wait(300);
        }
      });
      escribirCampoNumero('input[name="data.daily_min_entries"], input#data\\.daily_min_entries', campos['data.daily_min_entries']);
    }

    if (campos['data.daily_max_entries']) {
      cy.get('button#data\\.daily_max_entries_active[role="switch"]', { timeout: 10000 }).then(($toggle) => {
        if ($toggle.length && $toggle.attr('aria-checked') !== 'true') {
          cy.wrap($toggle).scrollIntoView().click({ force: true });
          cy.wait(300);
        }
      });
      escribirCampoNumero('input[name="data.daily_max_entries"], input#data\\.daily_max_entries', campos['data.daily_max_entries']);
    }

    if (campos['data.session_reset_time']) {
      cy.get('body').then(($body) => {
        const $campo = $body.find('input[name="data.session_reset_time"], input#data\\.session_reset_time');
        if ($campo.length > 0) {
          escribirCampoTiempo('input[name="data.session_reset_time"], input#data\\.session_reset_time', campos['data.session_reset_time']);
        } else {
          cy.log('Campo session_reset_time no encontrado en el formulario - saltando');
        }
      });
    }

    if (numero === 19) {
      cy.contains('button, a', /Cancelar/i, { timeout: 10000 }).click({ force: true });
      return cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias');
    }

    if ([20, 21, 22, 23].includes(numero)) {
      return hacerClickAccion(/^\s*Crear\s*$/i).then(() => cy.wait(1500)).then(() => cy.wrap(null));
    }

    if (numero === 18) {
      scrollHastaAcciones();
      return hacerClickAccion(/crear y crear otro/i).then(() => cy.wait(2000));
    }

    return hacerClickAccion(/^\s*Crear\s*$/i).then(() => cy.wait(2000));
  }

  function editarAbrirFormulario() {
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(300);
    cy.contains('.fi-ta-row:visible a, .fi-ta-row:visible button', /Editar/i, { timeout: 10000 })
      .first()
      .click({ force: true });
    return cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias/');
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const campos = obtenerCamposDesdeExcel(casoExcel);

    return editarAbrirFormulario()
      .then(() => {
        if (campos['data.company_id']) {
          seleccionarOpcionSelect('.choices[data-type="select-one"], select#data\\.company_id', 'Empresa', campos['data.company_id']);
        }

        if (campos['data.name']) {
          cy.get('input[name="data.name"], input#data\\.name', { timeout: 10000 })
            .first()
            .scrollIntoView()
            .clear({ force: true })
            .type(campos['data.name'], { force: true });
        }
      })
      .then(() =>
        cy.contains('button, input[type="submit"], a', /Guardar/i, { timeout: 10000 })
          .first()
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.wait(1500));
  }

  function editarCancelar() {
    return editarAbrirFormulario()
      .then(() => cy.contains('button, a', /Cancelar/i, { timeout: 10000 }).click({ force: true }))
      .then(() => cy.url({ timeout: 10000 }).should('include', '/jornadas-diarias'));
  }

  return {
    abrirFormularioCrear,
    crearCancelar,
    editarAbrirFormulario,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual
  };
}
