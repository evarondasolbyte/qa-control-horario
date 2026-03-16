export function createEmpresasFormularioActions(deps) {
  const {
    EMPRESAS_PATH,
    esFecha,
    esVacioOMalo,
    normalizarFechaInput,
    obtenerDatoEmpresa,
    obtenerNumeroCaso,
    reemplazarConNumeroAleatorio,
    verificarUrlEmpresas
  } = deps;

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return verificarUrlEmpresas()
      .then(() => cy.get('body').type('{esc}', { force: true }))
      .then(() =>
        cy.contains('button, a', /Crear Empresa/i, { timeout: 10000 })
          .should('be.visible')
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.url({ timeout: 10000 }).should('include', `${EMPRESAS_PATH}/create`));
  }

  function abrirPrimeraEdicion() {
    return cy.get('.fi-ta-table, table', { timeout: 10000 })
      .scrollTo('right', { ensureScrollable: false })
      .then(() => cy.wait(400))
      .then(() =>
        cy.get('body').then(($body) => {
          if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length > 0) {
            cy.get('body').type('{esc}', { force: true });
            cy.wait(400);
          }
        })
      )
      .then(() =>
        cy.get('.fi-ta-row:visible, tbody tr:visible', { timeout: 10000 })
          .first()
          .within(() => {
            cy.contains('button, a', /Editar/i, { timeout: 10000 }).click({ force: true });
          })
      )
      .then(() => cy.url({ timeout: 10000 }).should('include', '/empresas/'));
  }

  function rellenarCampoSiHay(selector, valor) {
    if (!valor) return cy.wrap(null);
    return cy.uiEscribirCampo(selector, valor);
  }

  function resolverDatosCreacion(casoExcel) {
    const numero = obtenerNumeroCaso(casoExcel);
    const esTC016 = numero === 16;

    let nombre = esTC016
      ? obtenerDatoEmpresa(casoExcel, ['data.name', 'name', 'nombre'], casoExcel.dato_1)
      : (casoExcel.dato_1 || '');

    let cif = esTC016
      ? obtenerDatoEmpresa(casoExcel, ['data.cif', 'cif'], casoExcel.dato_2)
      : (casoExcel.dato_2 || '');

    let direccion = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.address', 'address', 'direccion'], casoExcel.dato_3) : '';
    let ciudad = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.city', 'city', 'ciudad'], casoExcel.dato_4) : '';
    let personaContacto = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.contact_person', 'contact_person', 'persona de contacto'], casoExcel.dato_5) : '';
    let emailContacto = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.contact_email', 'contact_email', 'email'], casoExcel.dato_6) : '';
    let telefonoContacto = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.contact_phone', 'contact_phone', 'telefono'], casoExcel.dato_7) : '';
    const notasInternas = esTC016 ? obtenerDatoEmpresa(casoExcel, ['data.internal_notes', 'internal_notes'], casoExcel.dato_8) : '';

    let fechaExpiracionRaw = esTC016
      ? obtenerDatoEmpresa(casoExcel, ['data.expires_at', 'expires_at'], casoExcel.dato_9)
      : '';

    if (esTC016 && (esVacioOMalo(fechaExpiracionRaw) || !esFecha(fechaExpiracionRaw))) {
      for (let i = 1; i <= 11; i += 1) {
        const dato = String(casoExcel[`dato_${i}`] || '').trim();
        if (dato && esFecha(dato)) {
          fechaExpiracionRaw = dato;
          break;
        }
      }
    }

    let fechaExpiracion = normalizarFechaInput(fechaExpiracionRaw);
    if (esTC016 && !fechaExpiracion) fechaExpiracion = '2026-01-12';

    if (esTC016 && esVacioOMalo(nombre)) nombre = 'Empresa QA 1+';
    if (esTC016 && esVacioOMalo(cif)) cif = 'CIFQA 1+';

    nombre = reemplazarConNumeroAleatorio(nombre, numero);
    cif = reemplazarConNumeroAleatorio(cif, numero);
    direccion = reemplazarConNumeroAleatorio(direccion, numero);
    ciudad = reemplazarConNumeroAleatorio(ciudad, numero);
    personaContacto = reemplazarConNumeroAleatorio(personaContacto, numero);
    emailContacto = reemplazarConNumeroAleatorio(emailContacto, numero);
    telefonoContacto = reemplazarConNumeroAleatorio(telefonoContacto, numero);

    return {
      cif,
      ciudad,
      direccion,
      emailContacto,
      esTC016,
      fechaExpiracion,
      nombre,
      notasInternas,
      numero,
      personaContacto,
      telefonoContacto
    };
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const datos = resolverDatosCreacion(casoExcel);

    cy.log(`Crear empresa con nombre="${datos.nombre}", cif="${datos.cif}"`);

    return abrirFormularioCrear(casoExcel)
      .then(() => {
        if (datos.nombre && datos.numero !== 20) {
          return cy.uiEscribirCampo('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]', datos.nombre);
        }
        if (datos.numero === 20) {
          return cy.uiLimpiarCampo('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]');
        }
        return null;
      })
      .then(() => rellenarCampoSiHay('input[name="data.cif"], input#data\\.cif, input[placeholder*="CIF"]', datos.numero !== 20 ? datos.cif : ''))
      .then(() => {
        if (!datos.esTC016) return null;

        return rellenarCampoSiHay('input[name="data.address"], input#data\\.address, input[placeholder*="Dire"]', datos.direccion)
          .then(() => rellenarCampoSiHay('input[name="data.city"], input#data\\.city, input[placeholder*="Ciudad"]', datos.ciudad))
          .then(() => rellenarCampoSiHay('input[name="data.contact_person"], input#data\\.contact_person, input[placeholder*="Persona de contacto"]', datos.personaContacto))
          .then(() => rellenarCampoSiHay('input[name="data.contact_email"], input#data\\.contact_email, input[placeholder*="Email"], input[type="email"]', datos.emailContacto))
          .then(() => rellenarCampoSiHay('input[name="data.contact_phone"], input#data\\.contact_phone, input[placeholder*="Tel"], input[type="tel"]', datos.telefonoContacto))
          .then(() => rellenarCampoSiHay('textarea[name="data.internal_notes"], textarea#data\\.internal_notes', datos.notasInternas))
          .then(() => {
            if (!datos.fechaExpiracion) return null;
            return cy.get('input[name="data.expires_at"], input#data\\.expires_at', { timeout: 10000 })
              .first()
              .scrollIntoView()
              .click({ force: true })
              .clear({ force: true })
              .type(datos.fechaExpiracion, { force: true })
              .should('have.value', datos.fechaExpiracion);
          });
      })
      .then(() => {
        if (datos.numero === 19) {
          return cy.uiEncontrarBotonAlFinal('Cancelar')
            .then(() => cy.url({ timeout: 10000 }).should('include', EMPRESAS_PATH));
        }

        return cy.contains('button, input[type="submit"], a', /Crear/i, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true })
          .then(() => cy.wait(2000));
      });
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirPrimeraEdicion();
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirPrimeraEdicion()
      .then(() => cy.uiEncontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', EMPRESAS_PATH));
  }

  function editarBorrar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirPrimeraEdicion()
      .then(() =>
        cy.get('button:visible, a:visible', { timeout: 10000 })
          .filter((_, el) => /borrar/i.test((Cypress.$(el).text() || '').trim()))
          .first()
          .should('be.visible')
          .click({ force: true })
      )
      .then(() => cy.uiConfirmarModal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', EMPRESAS_PATH));
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const numero = obtenerNumeroCaso(casoExcel);
    const nombre = reemplazarConNumeroAleatorio(casoExcel.dato_1 || '', numero);
    const cif = reemplazarConNumeroAleatorio(casoExcel.dato_2 || '', numero);

    cy.log(`Editar empresa con nombre="${nombre}", cif="${cif}"`);

    return abrirPrimeraEdicion()
      .then(() => rellenarCampoSiHay('input[name="data.name"], input#data\\.name, input[placeholder*="Nombre"]', nombre))
      .then(() => rellenarCampoSiHay('input[name="data.cif"], input#data\\.cif, input[placeholder*="CIF"]', cif))
      .then(() =>
        cy.contains('button, input[type="submit"], a', /Guardar cambios|Guardar/i, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.wait(2000));
  }

  return {
    abrirFormularioCrear,
    editarAbrirFormulario,
    editarBorrar,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual
  };
}
