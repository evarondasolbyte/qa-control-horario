export function createEmpleadosFormularioActions(deps) {
  const {
    EMPLEADOS_PATH,
    abrirFormularioCrearEmpleado,
    escribirCampo,
    escribirCampoFormulario,
    enviarFormularioCrear,
    encontrarBotonAlFinal,
    esperarToastExito,
    generarNombreUnico,
    obtenerValorApellidos,
    obtenerValorDepartamento,
    obtenerValorEmail,
    obtenerValorEmpresa,
    obtenerValorGrupo,
    obtenerValorNombre,
    obtenerValorNotas,
    obtenerValorRoles,
    obtenerValorTelefono,
    registrarResultado,
    seleccionarEmpresa,
    seleccionarGrupo,
    seleccionarOpcionChoicesFormulario,
    verificarErrorEsperado
  } = deps;

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearEmpleado()
      .then((resultado) => {
        if (resultado && resultado.error) {
          const casoId = casoExcel.caso || 'TC000';
          const nombre = `${casoId} - ${casoExcel.nombre}`;
          cy.log(`Error detectado: ${resultado.error} - registrando en Excel`);
          registrarResultado(
            casoId,
            nombre,
            'Comportamiento correcto',
            resultado.mensaje || `ERROR: ${resultado.error}`,
            'ERROR'
          );
          return cy.wrap({ huboError: true });
        }
        return cy.wrap(null);
      });
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const esSinEmpresa = casoExcel.caso === 'TC020';
    const empresa = esSinEmpresa ? '' : obtenerValorEmpresa(casoExcel);
    let nombre = obtenerValorNombre(casoExcel) || generarNombreUnico('empleado');
    const apellidos = obtenerValorApellidos(casoExcel);
    const email = obtenerValorEmail(casoExcel) || `${generarNombreUnico('email')}@gmail.com`;
    const telefono = obtenerValorTelefono(casoExcel);
    const grupo = esSinEmpresa ? '' : obtenerValorGrupo(casoExcel);
    const departamento = esSinEmpresa ? '' : obtenerValorDepartamento(casoExcel);
    const roles = esSinEmpresa ? '' : obtenerValorRoles(casoExcel);
    const notas = obtenerValorNotas(casoExcel);

    if (nombre.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      nombre = nombre.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      nombre = nombre.replace('prueba1+', 'prueba1');
    }

    let emailFinal = email;
    if (email.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      emailFinal = email.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      emailFinal = email.replace('prueba1+', 'prueba1');
    }

    return abrirFormularioCrear(casoExcel)
      .then((resultado) => {
        if (resultado && resultado.huboError === true) return cy.wrap({ huboError: true });
        if (!esSinEmpresa) return seleccionarEmpresa(empresa);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (nombre) return escribirCampoFormulario('input[name="data.name"], input#data\\.name', nombre);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (apellidos) return escribirCampoFormulario('input[name="data.surname"], input#data\\.surname', apellidos);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (emailFinal) return escribirCampoFormulario('input[name="data.email"], input#data\\.email', emailFinal);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (telefono) return escribirCampoFormulario('input[name="data.phone"], input#data\\.phone', telefono);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (grupo) return cy.wait(600).then(() => seleccionarGrupo(grupo));
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (departamento) return seleccionarOpcionChoicesFormulario(departamento, 'Departamento');
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (roles) return seleccionarOpcionChoicesFormulario(roles, 'Roles');
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (notas) return escribirCampoFormulario('textarea[name="data.notes"], textarea#data\\.notes, trix-editor#data\\.notes', notas);
        return null;
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });

        if (esSinEmpresa) {
          return enviarFormularioCrear()
            .then((envio) => {
              if (envio && envio.huboError === true) return cy.wrap({ huboError: true });
              return verificarErrorEsperado(['empresa', 'obligatoria']);
            });
        }

        if (casoExcel.caso === 'TC018') {
          return encontrarBotonAlFinal('Crear y crear otro')
            .then((boton) => {
              if (boton && boton.huboError === true) return cy.wrap({ huboError: true });
              return null;
            });
        }

        return enviarFormularioCrear()
          .then((envio) => {
            if (envio && envio.huboError === true) return cy.wrap({ huboError: true });
            return null;
          });
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        if (esSinEmpresa) return null;
        if (casoExcel.caso === 'TC017') return cy.wait(1500);
        return esperarToastExito();
      });
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrear(casoExcel)
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return encontrarBotonAlFinal('Cancelar');
      })
      .then((boton) => {
        if (boton && boton.huboError === true) return cy.wrap({ huboError: true });
        return cy.url({ timeout: 10000 }).should('include', EMPLEADOS_PATH);
      });
  }

  function validarEmpresaObligatoria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombre(casoExcel) || generarNombreUnico('empleado');
    const email = obtenerValorEmail(casoExcel) || `${generarNombreUnico('email')}@gmail.com`;

    return abrirFormularioCrearEmpleado()
      .then(() => {
        if (nombre) escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        if (email) escribirCampo('input[name="data.email"], input#data\\.email', email);
      })
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['empresa', 'obligatoria']));
  }

  function validarNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel);
    const email = obtenerValorEmail(casoExcel) || `${generarNombreUnico('email')}@gmail.com`;
    const grupo = obtenerValorGrupo(casoExcel);

    return abrirFormularioCrearEmpleado()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => {
        if (email) escribirCampo('input[name="data.email"], input#data\\.email', email);
        if (grupo) seleccionarOpcionChoicesFormulario(grupo, 'Grupo');
      })
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['nombre', 'obligatorio']));
  }

  function validarEmailObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel);
    const nombre = obtenerValorNombre(casoExcel) || generarNombreUnico('empleado');
    const grupo = obtenerValorGrupo(casoExcel);

    return abrirFormularioCrearEmpleado()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => {
        if (nombre) escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        if (grupo) seleccionarOpcionChoicesFormulario(grupo, 'Grupo');
      })
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['email', 'obligatorio']));
  }

  function validarGrupoObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel);
    const nombre = obtenerValorNombre(casoExcel) || generarNombreUnico('empleado');
    const email = obtenerValorEmail(casoExcel) || `${generarNombreUnico('email')}@gmail.com`;

    return abrirFormularioCrearEmpleado()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => {
        if (nombre) escribirCampo('input[name="data.name"], input#data\\.name', nombre);
        if (email) escribirCampo('input[name="data.email"], input#data\\.email', email);
      })
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['grupo', 'obligatorio']));
  }

  function validarLongitudNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel);
    const nombre = obtenerValorNombre(casoExcel) || generarNombreUnico('nombre-largo');
    const email = obtenerValorEmail(casoExcel) || `${generarNombreUnico('email')}@gmail.com`;
    const grupo = obtenerValorGrupo(casoExcel);

    return abrirFormularioCrearEmpleado()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => {
        if (email) escribirCampo('input[name="data.email"], input#data\\.email', email);
        if (grupo) seleccionarOpcionChoicesFormulario(grupo, 'Grupo');
      })
      .then(() => enviarFormularioCrear())
      .then(() => esperarToastExito());
  }

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(400);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.contains('button, a', /Editar/i).click({ force: true });
    });
    return cy.url({ timeout: 10000 }).should('include', `${EMPLEADOS_PATH}/`).and('include', '/edit');
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombre(casoExcel) || 'empleado';

    return editarAbrirFormulario(casoExcel)
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return escribirCampoFormulario('input[name="data.name"], input#data\\.name', nombre);
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return encontrarBotonAlFinal('Guardar cambios');
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return esperarToastExito();
      });
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario(casoExcel)
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return encontrarBotonAlFinal('Cancelar');
      })
      .then((r) => {
        if (r && r.huboError === true) return cy.wrap({ huboError: true });
        return cy.url({ timeout: 10000 }).should('include', EMPLEADOS_PATH);
      });
  }

  return {
    abrirFormularioCrear,
    crearCancelar,
    editarAbrirFormulario,
    editarCancelar,
    ejecutarCrearIndividual,
    ejecutarEditarIndividual,
    validarEmailObligatorio,
    validarEmpresaObligatoria,
    validarGrupoObligatorio,
    validarLongitudNombre,
    validarNombreObligatorio
  };
}
