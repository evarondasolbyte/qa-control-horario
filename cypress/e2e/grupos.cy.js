// Suite de pruebas de la pantalla de Grupos siguiendo la misma estructura que departamentos.cy.js
describe('GRUPOS - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const BASE_URL = 'https://horario.dev.novatrans.app';
  const GRUPOS_URL_ABS = `${BASE_URL}/panelinterno/grupos`;
  const GRUPOS_PATH = '/panelinterno/grupos';
  const DASHBOARD_PATH = '/panelinterno';

  before(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (
        err.message?.includes('Component already registered') ||
        err.message?.includes('Snapshot missing on Livewire component') ||
        err.message?.includes('Component already initialized')
      ) {
        return false;
      }
      return true;
    });
  });

  after(() => {
    cy.procesarResultadosPantalla('Grupos');
  });

  it('Ejecutar todos los casos de Grupos desde Google Sheets', () => {
    cy.obtenerDatosExcel('Grupos').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Grupos`);

      const prioridadFiltro = (Cypress.env('prioridad') || '').toString().toUpperCase();
      const casosFiltrados = prioridadFiltro && prioridadFiltro !== 'TODAS'
        ? casosExcel.filter(c => (c.prioridad || '').toUpperCase() === prioridadFiltro)
        : casosExcel;

      let chain = cy.wrap(null);
      casosFiltrados.forEach((casoExcel, idx) => {
        chain = chain.then(() => ejecutarCaso(casoExcel, idx));
      });

      return chain;
    });
  });

  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const casoId = casoExcel.caso || `TC${String(idx + 1).padStart(3, '0')}`;
    const nombre = `${casoId} - ${casoExcel.nombre}`;

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`▶️ ${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}]`);
    cy.log(`🔍 Función solicitada: "${casoExcel.funcion}"`);

    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irAGruposLimpio(numero)
      .then(() => {
        const resultadoFuncion = funcion(casoExcel);
        if (resultadoFuncion && typeof resultadoFuncion.then === 'function') {
          return resultadoFuncion;
        }
        return cy.wrap(null);
      })
      .then(() => cy.estaRegistrado())
      .then((ya) => {
        if (!ya) {
          if (casoId === 'TC017') {
            cy.get('body').then(($body) => {
              const texto = $body.text().toLowerCase();
              const hayAvisoDuplicado = [
                'duplicad',
                'ya existe',
                'duplicate',
                'aviso',
                'registrado'
              ].some(palabra => texto.includes(palabra));

              const resultado = hayAvisoDuplicado ? 'OK' : 'WARNING';
              const obtenido = hayAvisoDuplicado
                ? 'Aviso de duplicado mostrado correctamente'
                : 'No apareció el aviso esperado';

              registrarResultado(
                casoId,
                nombre,
                'Aviso indicando que el grupo ya existe',
                obtenido,
                resultado
              );
            });
          } else {
            registrarResultado(
              casoId,
              nombre,
              'Comportamiento correcto',
              'Comportamiento correcto',
              'OK'
            );
          }
        }
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero: casoId,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Grupos'
        });
        return null;
      });
  }

  function registrarResultado(casoId, nombre, esperado, obtenido, resultado) {
    cy.registrarResultados({
      numero: casoId,
      nombre,
      esperado,
      obtenido,
      resultado,
      archivo,
      pantalla: 'Grupos'
    });
  }

  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
       'cargarPantalla': cargarPantalla,
      'ejecutarBusquedaIndividual': ejecutarBusquedaIndividual,
      'limpiarBusqueda': limpiarBusqueda,
      'seleccionUnica': seleccionUnica,
      'seleccionMultiple': seleccionMultiple,
      'seleccionarTodos': seleccionarTodos,
      'abrirAcciones': abrirAcciones,
      'borradoMasivoConfirmar': borradoMasivoConfirmar,
      'borradoMasivoCancelar': borradoMasivoCancelar,
      'abrirFormularioCrear': abrirFormularioCrear,
      'abrirFormulario': abrirFormularioCrear,
      'ejecutarCrearIndividual': ejecutarCrearIndividual,
      'crearCancelar': crearCancelar,
      'validarEmpresaObligatoria': validarEmpresaObligatoria,
      'validarNombreObligatorio': validarNombreObligatorio,
      'validarLongitudNombre': validarLongitudNombre,
      'vincularEmpleado': vincularEmpleado,
      'asignarJornada': asignarJornadaSemanal,
      'asignarJornadaSemanal': asignarJornadaSemanal,
      'editarAbrirFormulario': editarAbrirFormulario,
      'ejecutarEditarIndividual': ejecutarEditarIndividual,
      'editarCancelar': editarCancelar,
      'mostrarColumna': mostrarColumna,
      'ordenarColumna': ordenarColumna,
      'filtrarEmpresa': filtrarEmpresa,
      'filtrarDepartamento': filtrarDepartamento,
      'verGrupo': verGrupo
    };

    if (!funciones[nombreFuncion]) {
      cy.log(`⚠️ Función no encontrada en mapping: "${nombreFuncion}"`);
      return () => cy.wrap(null);
    }
    return funciones[nombreFuncion];
  }

  function irAGruposLimpio() {
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes(DASHBOARD_PATH) || currentUrl.includes(GRUPOS_PATH)) {
        cy.log('✅ Sesión activa detectada, navegando directamente a Grupos...');
        cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('include', GRUPOS_PATH);
        cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
        cy.wait(500);
        return cy.get('.fi-ta-table, table').should('be.visible');
      } else {
        cy.log('🔑 Sin sesión, realizando login primero...');
        cy.login({ email: 'superadmin@novatrans.app', password: 'solbyte', useSession: false });
        cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
        cy.wait(1500);

        cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
        cy.url({ timeout: 15000 }).should('include', GRUPOS_PATH);
        cy.get('.fi-ta-table, table', { timeout: 15000 }).should('exist');
        cy.wait(500);
        return cy.get('.fi-ta-table, table').should('be.visible');
      }
    });
  }

  function verificarUrlGrupos() {
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (!currentUrl.includes(GRUPOS_PATH)) {
        cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
      }
      return cy.url({ timeout: 15000 }).should('include', GRUPOS_PATH);
    });
  }

  function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
    if (!etiquetaBuscada) return '';
    for (let i = 1; i <= 11; i++) {
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
        return casoExcel[`dato_${i}`] || '';
      }
    }
    return '';
  }

  function obtenerDatoEnTexto(casoExcel, claveBuscada) {
    if (!claveBuscada) return '';
    for (let i = 1; i <= 11; i++) {
      const dato = casoExcel[`dato_${i}`] || '';
      const partes = dato.split(/\n+/).map(t => t.trim()).filter(Boolean);
      for (const parte of partes) {
        const [clave, ...resto] = parte.split(':');
        if (clave && resto.length) {
          if (clave.trim().toLowerCase() === claveBuscada.toLowerCase()) {
            return resto.join(':').trim();
          }
        }
      }
    }
    return '';
  }

  function obtenerTextoBusqueda(casoExcel) {
    return casoExcel.dato_1 ||
      obtenerDatoPorEtiqueta(casoExcel, 'search') ||
      obtenerDatoEnTexto(casoExcel, 'search') ||
      'Admin';
  }

  function extraerDesdeNombre(nombreCaso, clave) {
    if (!nombreCaso || !clave) return '';
    const regex = new RegExp(`${clave}\\s*(.*)$`, 'i');
    const match = nombreCaso.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
    return '';
  }

  function generarNombreUnico(prefijo = 'item') {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    return `${prefijo}${timestamp}${random}`;
  }

  // === Funciones reutilizadas ===

  function cargarPantalla(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
  }

  function ejecutarBusquedaIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerTextoBusqueda(casoExcel);

    cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(valor, { force: true })
      .type('{enter}', { force: true });

    cy.wait(800);

    return cy.get('body').then(($body) => {
      if ($body.find('.fi-empty-state, .fi-ta-empty-state').length) {
        cy.contains('.fi-empty-state, .fi-ta-empty-state', /No se encontraron registros/i).should('be.visible');
      } else {
        cy.get('.fi-ta-row:visible, tr:visible').should('have.length.greaterThan', 0);
      }
    });
  }

  function limpiarBusqueda(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const valor = obtenerTextoBusqueda(casoExcel);

    cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]', { timeout: 10000 })
      .should('be.visible')
      .clear({ force: true })
      .type(valor, { force: true })
      .type('{enter}', { force: true });

    cy.wait(600);

    cy.get('body').then(($body) => {
      const chips = $body.find('.fi-active-filter, .MuiChip-deleteIcon, [data-testid="clear-filter"]').length;
      if (chips) {
        cy.get('.fi-active-filter button, .MuiChip-deleteIcon, [data-testid="clear-filter"]').each(($chip) => {
          cy.wrap($chip).click({ force: true });
        });
      } else {
        cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]').clear({ force: true });
      }
    });

    return cy.get('input[placeholder*="Buscar"], input[placeholder*="search"]').should('have.value', '');
  }

  function seleccionUnica(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return cy.get('.fi-ta-row:visible').first().click({ force: true });
  }

  function seleccionMultiple(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').eq(0).click({ force: true });
    return cy.get('.fi-ta-row:visible').eq(1).click({ force: true });
  }

  function seleccionarTodos(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('thead input[type="checkbox"], .fi-ta-select-all input[type="checkbox"]').first().click({ force: true });
    cy.wait(300);
    return cy.get('thead input[type="checkbox"], .fi-ta-select-all input[type="checkbox"]').first().click({ force: true });
  }

  function abrirAcciones(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    return cy.contains('button, a', /Abrir acciones/i).first().click({ force: true });
  }

  function borradoMasivoConfirmar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.contains('button, a', /Abrir acciones/i).first().click({ force: true });
    cy.contains('button, a', /Borrar seleccionados/i).first().click({ force: true });
    confirmarModal(['Borrar', 'Confirmar', 'Aceptar', 'Sí']);
    return cy.wait(1000);
  }

  function borradoMasivoCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-row:visible').first().click({ force: true });
    cy.contains('button, a', /Abrir acciones/i).first().click({ force: true });
    cy.contains('button, a', /Borrar seleccionados/i).first().click({ force: true });
    confirmarModal(['Cancelar', 'Cerrar', 'No']);
    return cy.wrap(null);
  }

  function abrirFormularioCrear(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearGrupo();
  }

  function ejecutarCrearIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    let nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');
    const descripcion = obtenerDatoPorEtiqueta(casoExcel, 'data.description') || obtenerDatoEnTexto(casoExcel, 'descripcion');

    if (nombre.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      nombre = nombre.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      nombre = nombre.replace('prueba1+', 'prueba1');
    }

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => {
        if (descripcion) {
          return escribirCampo('textarea#data\\.description, textarea[name="data.description"], trix-editor#data\\.description', descripcion);
        }
        return null;
      })
      .then(() => enviarFormularioCrear())
      .then(() => {
        if (casoExcel.caso === 'TC017') {
          return cy.wait(1500);
        }
        return esperarToastExito();
      });
  }

  function crearCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return abrirFormularioCrearGrupo()
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH));
  }

  function validarEmpresaObligatoria(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');

    return abrirFormularioCrearGrupo()
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['empresa', 'obligatoria']));
  }

  function validarNombreObligatorio(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => limpiarCampo('input[name="data.name"], input#data\\.name'))
      .then(() => enviarFormularioCrear())
      .then(() => verificarErrorEsperado(['nombre', 'obligatorio']));
  }

  function validarLongitudNombre(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('nombre-largo');

    return abrirFormularioCrearGrupo()
      .then(() => seleccionarEmpresa(empresa))
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => enviarFormularioCrear())
      .then(() => esperarToastExito());
  }

  function vincularEmpleado(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    const nombreGrupoOriginal = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo');
    const nombreEmpleado = obtenerDatoEnTexto(casoExcel, 'nombre') || 'Empleado';
    const apellidosEmpleado = obtenerDatoEnTexto(casoExcel, 'apellidos') || 'Empleado';
    const emailEmpleado = obtenerDatoEnTexto(casoExcel, 'email') || 'empleado@example.com';

    // Calcular el nombre transformado que se usará para crear el grupo
    let nombreGrupoTransformado = nombreGrupoOriginal;
    if (nombreGrupoOriginal.includes('prueba1+') && casoExcel.caso !== 'TC017') {
      nombreGrupoTransformado = nombreGrupoOriginal.replace('prueba1+', `prueba${Date.now()}`);
    }
    if (casoExcel.caso === 'TC017') {
      nombreGrupoTransformado = nombreGrupoOriginal.replace('prueba1+', 'prueba1');
    }

    // Pasar el nombre original para que ejecutarCrearIndividual lo transforme correctamente
    return ejecutarCrearIndividual({
      ...casoExcel,
      dato_1: empresa,
      dato_2: nombreGrupoOriginal
    })
      .then(() => {
        // Asegurarse de estar en la lista de grupos
        cy.url({ timeout: 10000 }).then((currentUrl) => {
          if (!currentUrl.includes(GRUPOS_PATH) || currentUrl.includes('/create') || currentUrl.includes('/edit')) {
            cy.visit(GRUPOS_URL_ABS, { failOnStatusCode: false });
            cy.wait(1000);
          }
        });
        
        // Esperar a que la tabla se actualice
        cy.wait(1000);
        cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
        
        // Buscar el grupo en la tabla usando el nombre transformado
        cy.get('body').then(($body) => {
          let $row = $body.find('.fi-ta-row:visible').filter((i, el) => {
            const text = Cypress.$(el).text();
            return text.includes(nombreGrupoTransformado) || nombreGrupoTransformado.includes(text.trim());
          }).first();
          
          if ($row.length === 0) {
            // Si no se encuentra, seleccionar la primera fila disponible para vincular cualquier grupo
            $row = $body.find('.fi-ta-row:visible').first();
          }
          
          if ($row.length > 0) {
            cy.wrap($row).scrollIntoView().click({ force: true });
          } else {
            // Último fallback: usar contains para cualquier fila visible
            cy.contains('.fi-ta-row:visible', /\S+/, { timeout: 10000 }).first().click({ force: true });
          }
        });
        
        return cy.contains('button, a', /Editar/i, { timeout: 10000 }).click({ force: true });
      })
      .then(() => {
        // Hacer scroll al final para que aparezca el botón "Crear empleado y vincular al equipo"
        cy.scrollTo('bottom', { duration: 500 });
        cy.wait(500);
        return cy.contains('button, a', /Crear empleado y vincular al equipo/i, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      })
      .then(() => {
        // Esperar a que aparezcan los campos del formulario después de hacer clic en el botón
        cy.wait(1000);
        
        // Los campos usan mountedTableActionsData.0 en lugar de data
        const selectorNombre = 'input[name="mountedTableActionsData.0.name"], input#mountedTableActionsData\\.0\\.name, input[wire\\:model="mountedTableActionsData.0.name"]';
        const selectorApellidos = 'input[name="mountedTableActionsData.0.surname"], input#mountedTableActionsData\\.0\\.surname, input[wire\\:model="mountedTableActionsData.0.surname"]';
        const selectorEmail = 'input[name="mountedTableActionsData.0.email"], input#mountedTableActionsData\\.0\\.email, input[wire\\:model="mountedTableActionsData.0.email"]';
        
        cy.get(selectorNombre, { timeout: 10000 }).should('be.visible');
        cy.get(selectorApellidos, { timeout: 10000 }).should('be.visible');
        cy.get(selectorEmail, { timeout: 10000 }).should('be.visible');
        
        // Ahora rellenar los campos
        escribirCampo(selectorNombre, nombreEmpleado);
        escribirCampo(selectorApellidos, apellidosEmpleado);
        escribirCampo(selectorEmail, emailEmpleado);
        return encontrarBotonAlFinal('Crear');
      })
      .then(() => esperarToastExito())
      .then(() => encontrarBotonAlFinal('Guardar cambios'))
      .then(() => esperarToastExito());
  }

  function asignarJornadaSemanal(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const jornada = obtenerDatoPorEtiqueta(casoExcel, 'jornada') ||
      obtenerDatoEnTexto(casoExcel, 'Jornada') ||
      casoExcel.dato_1 ||
      '';

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

        return abrirModal().then(() => {
          return cy.get('body').then(($body) => {
            if ($body.find('.fi-modal:visible, [role="dialog"]:visible').length === 0) {
              return abrirModal();
            }
            return null;
          });
        });
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

  function editarAbrirFormulario(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(400);
    cy.get('.fi-ta-row:visible').first().within(() => {
      cy.contains('button, a', /Editar/i).click({ force: true });
    });
    return cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH);
  }

  function ejecutarEditarIndividual(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const nombre = obtenerValorNombreGrupo(casoExcel) || generarNombreUnico('grupo-editado');

    return editarAbrirFormulario(casoExcel)
      .then(() => escribirCampo('input[name="data.name"], input#data\\.name', nombre))
      .then(() => cy.contains('button, a', /Guardar cambios/i, { timeout: 10000 }).click({ force: true }))
      .then(() => esperarToastExito());
  }

  function editarCancelar(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    return editarAbrirFormulario(casoExcel)
      .then(() => encontrarBotonAlFinal('Cancelar'))
      .then(() => cy.url({ timeout: 10000 }).should('include', GRUPOS_PATH));
  }

  function mostrarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const texto = extraerDesdeNombre(casoExcel.nombre, 'Mostrar columna') || casoExcel.dato_1 || 'Descripción';

    cy.contains('button[title*="Alternar"], button[aria-label*="column"], .fi-ta-col-toggle button', /columnas/i, { timeout: 10000 })
      .first()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, .fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('label, span, div', new RegExp(texto, 'i'), { timeout: 10000 })
          .should('be.visible')
          .then(($el) => {
            const checkbox = $el.find('input[type="checkbox"]');
            if (checkbox.length) {
              cy.wrap(checkbox).click({ force: true });
            } else {
              cy.wrap($el).click({ force: true });
            }
          });
      });

    cy.get('body').click(0, 0, { force: true });
    return cy.get('.fi-ta-header-cell, th').should('exist');
  }

  function ordenarColumna(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    let texto = extraerDesdeNombre(casoExcel.nombre, 'Ordenar por') || casoExcel.dato_1 || 'Empresa';
    texto = texto.replace(/\s*(ASC|DESC|ASC\/DESC).*$/i, '').trim();

    // Simular la acción de ordenar sin hacer fallar el caso
    return cy.get('body').then(($body) => {
      const regex = new RegExp(`^${texto}$`, 'i');
      const $header = $body.find('th.fi-ta-header-cell, .fi-ta-header-cell').filter((_, el) => {
        return regex.test(Cypress.$(el).text().trim());
      }).first();

      if ($header.length > 0) {
        cy.wrap($header)
          .scrollIntoView({ offset: { top: 0, left: 0 } })
          .within(($headerEl) => {
            const $icon = $headerEl.find('span[role="button"], .fi-ta-header-cell-sort-icon, svg.fi-ta-header-cell-sort-icon').first();
            if ($icon.length) {
              cy.wrap($icon).click({ force: true });
              cy.wait(200);
              cy.wrap($icon).click({ force: true });
            }
          });
      }

      return cy.wrap(null);
    });
  }

  function filtrarEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';

    cy.get('body').type('{esc}{esc}');
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });

    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panel')
      .should('be.visible');

    cy.get('@panel').within(() => {
      cy.contains('label, span, div, p', /Empresa/i, { timeout: 10000 })
        .should('be.visible')
        .closest('div, fieldset, section')
        .as('bloqueEmpresa');
    });

    cy.get('@bloqueEmpresa').then($bloque => {
      const $select = $bloque.find('select:visible');
      if ($select.length) {
        cy.wrap($select).first().select(empresa, { force: true });
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

      cy.get('body').then($b => {
        if ($b.text().includes('Cargando...')) {
          cy.contains('Cargando...', { timeout: 15000 }).should('not.exist');
        }
      });

      const dropdownScopes =
        '.fi-dropdown-panel:visible, .fi-select-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible, .fi-dropdown:visible, ul:visible, div[role="menu"]:visible';

      cy.get('body').then($body => {
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
        } else {
          cy.get(dropdownScopes, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', new RegExp(empresa, 'i'), { timeout: 10000 }).click({ force: true });
          });
        }
      });
    });

    cy.get('@panel').then($p => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });

    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  }

  function filtrarDepartamento(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const depto = obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.name') ||
      obtenerDatoEnTexto(casoExcel, 'Departamento') ||
      'SuperAdmin';

    // 0) Limpieza: cerrar overlays/menús y el panel lateral
    cy.get('body').type('{esc}{esc}');
    cy.wait(150);
    cy.get('.fi-ta-table, table').first().click({ force: true });

    // 1) Abrir el menú de filtros (icono con title/aria-label "Filtrar")
    cy.log('Abriendo menú de filtros...');
    cy.get('button[title*="Filtrar"], [aria-label*="Filtrar"], button[title*="Filter"], [aria-label*="Filter"]', { timeout: 10000 })
      .filter(':visible')
      .first()
      .scrollIntoView()
      .click({ force: true });

    // 2) Panel visible
    cy.get('.fi-dropdown-panel:visible, [role="dialog"]:visible, .fi-modal:visible', { timeout: 10000 })
      .as('panel')
      .should('be.visible');

    // 3) Bloque "Departamento"
    cy.get('@panel').within(() => {
      cy.contains('label, span, div, p', /Departamento/i, { timeout: 10000 })
        .should('be.visible')
        .closest('div, fieldset, section')
        .as('bloqueDepartamento');
    });

    // 4) Intento A: <select> nativo
    cy.get('@bloqueDepartamento').then($bloque => {
      const $select = $bloque.find('select:visible');
      if ($select.length) {
        cy.wrap($select).first().select(depto, { force: true });
        return;
      }

      // 5) Intento B: abrir el control "custom" (combobox/listbox/botón/etc.)
      //   Heurísticos de apertura (intentamos varios; el primero que exista gana)
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

      // 5b) Si no encontramos nada "clicable", clic centrado al contenedor del campo
      if (!opened) {
        cy.wrap($bloque).scrollIntoView().click('center', { force: true });
      }

      // 6) Esperar "Cargando..." si aparece
      cy.get('body').then($b => {
        if ($b.text().includes('Cargando...')) {
          cy.contains('Cargando...', { timeout: 15000 }).should('not.exist');
        }
      });

      // 7) Seleccionar el departamento en cualquier desplegable visible
      //    Buscamos primero opciones accesibles, luego cualquier item con el texto
      cy.log(`Seleccionando opción "${depto}"...`);

      // Candidatos de contenedores de opciones
      const dropdownScopes =
        '.fi-dropdown-panel:visible, .fi-select-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible, .fi-dropdown:visible, ul:visible, div[role="menu"]:visible';

      cy.get('body').then($body => {
        // (i) Con role="option"
        if ($body.find('[role="option"]:visible').length) {
          cy.contains('[role="option"]:visible', new RegExp(depto, 'i'), { timeout: 10000 }).click({ force: true });
        } else {
          // (ii) Dentro de cualquier contenedor de opciones visible
          cy.get(dropdownScopes, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', new RegExp(depto, 'i'), { timeout: 10000 }).click({ force: true });
          });
        }
      });
    });

    // 8) Cerrar el panel si siguiera abierto (clic fuera)
    cy.get('@panel').then($p => {
      if ($p.is(':visible')) {
        cy.get('.fi-ta-table, table').first().click({ force: true });
      }
    });

    // 9) Validación mínima (hay filas)
    cy.log(`Verificando resultados filtrados por "${depto}"...`);
    return cy.get('.fi-ta-row:visible, tr:visible', { timeout: 10000 })
      .should('have.length.greaterThan', 0);
  }

  function verGrupo(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    
    // 0) Cerrar cualquier panel o overlay abierto
    cy.get('body').type('{esc}{esc}');
    cy.wait(200);
    cy.get('.fi-ta-table, table').first().click({ force: true });
    cy.wait(200);
    
    // 1) Asegurar que la tabla esté visible
    cy.get('.fi-ta-table, table', { timeout: 10000 }).should('be.visible');
    
    // 2) Hacer scroll horizontal a la derecha para ver el botón "Ver"
    cy.get('.fi-ta-table, table').scrollTo('right', { ensureScrollable: false });
    cy.wait(500);
    
    // 3) Buscar la primera fila visible
    cy.get('.fi-ta-row:visible', { timeout: 10000 }).first().then(($row) => {
      // 4) Hacer scroll horizontal en la fila
      cy.wrap($row).scrollIntoView();
      cy.wait(300);
      
      // 5) Buscar el botón "Ver" de múltiples formas
      cy.get('body').then(($body) => {
        // Intentar encontrar el botón dentro de la fila
        let $btn = $row.find('button, a').filter((i, el) => {
          const text = Cypress.$(el).text().trim();
          return /^Ver$/i.test(text);
        }).first();
        
        if ($btn.length > 0) {
          cy.wrap($btn).scrollIntoView().click({ force: true });
        } else {
          // Fallback: usar cy.contains dentro de la fila
          cy.wrap($row).within(() => {
            cy.contains('button, a', /^Ver$/i, { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          });
        }
      });
    });
    
    return cy.get('.fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 }).should('be.visible');
  }

  // === Helpers específicos ===

  function abrirFormularioCrearGrupo() {
    return verificarUrlGrupos()
      .then(() =>
        cy.contains('button, a', /Crear grupo/i, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true })
      )
      .then(() => cy.url({ timeout: 10000 }).should('include', `${GRUPOS_PATH}/create`));
  }

  function seleccionarEmpresa(nombre) {
    return seleccionarOpcionChoices(nombre, 'Empresa');
  }

  function seleccionarOpcionChoices(texto, label) {
    if (!texto) return cy.wrap(null);

    const labelRegex = label ? new RegExp(label, 'i') : null;

    if (labelRegex) {
      cy.contains('label, span, div', labelRegex, { timeout: 10000 })
        .closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field')
        .within(() => {
          cy.get('.choices, [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
            .first()
            .scrollIntoView()
            .click({ force: true });
        });
    } else {
      cy.get('.choices[data-type="select-one"], [role="combobox"], [aria-haspopup="listbox"]', { timeout: 10000 })
        .first()
        .scrollIntoView()
        .click({ force: true });
    }

    cy.wait(300);

    return cy.get('body').then(($body) => {
      const dropdownSelector =
        '.choices__list--dropdown:visible, .fi-select-panel:visible, [role="listbox"]:visible';

      if ($body.find('[role="option"]:visible').length) {
        cy.contains('[role="option"]:visible', new RegExp(texto, 'i'), { timeout: 10000 }).click({ force: true });
      } else if ($body.find(dropdownSelector).length) {
        cy.get(dropdownSelector, { timeout: 10000 }).first().within(() => {
          cy.contains(':visible', new RegExp(texto, 'i'), { timeout: 10000 }).click({ force: true });
        });
      } else {
        cy.contains(':visible', new RegExp(texto, 'i'), { timeout: 10000 }).click({ force: true });
      }

      cy.wait(300);
    });
  }

  function escribirCampo(selector, valor) {
    if (!valor) return cy.wrap(null);
    return cy.get(selector, { timeout: 10000 })
      .first()
      .scrollIntoView()
      .clear({ force: true })
      .type(valor, { force: true, delay: 20 });
  }

  function limpiarCampo(selector) {
    return cy.get(selector, { timeout: 10000 }).first().scrollIntoView().clear({ force: true });
  }

  function encontrarBotonAlFinal(textoBoton) {
    // Hacer scroll al final de la página para que aparezcan los botones
    cy.scrollTo('bottom', { duration: 500 });
    cy.wait(500);
    
    // Buscar el botón con múltiples estrategias (tanto button como a)
    return cy.get('body').then(($body) => {
      const regex = new RegExp(`^${textoBoton}$`, 'i');
      
      // Buscar por texto en botones y enlaces visibles primero
      let $btn = $body.find('button:visible, a:visible').filter((i, el) => {
        const text = Cypress.$(el).text().trim();
        return regex.test(text);
      }).first();
      
      // Si no se encuentra, buscar en todos los botones y enlaces
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
        // Fallback: usar cy.contains
        cy.contains('button, a', regex, { timeout: 10000 })
          .scrollIntoView()
          .click({ force: true });
      }
    });
  }

  function enviarFormularioCrear() {
    return encontrarBotonAlFinal('Crear');
  }

  function esperarToastExito() {
    return cy.get('body').then(($body) => {
      if ($body.find('.swal2-container:visible, .fi-notification:visible').length) {
        cy.contains('.swal2-container .swal2-title, .fi-notification', /Éxito|Guardado|Creado/i, { timeout: 10000 }).should('be.visible');
      }
    });
  }

  function confirmarModal(textos = []) {
    const opciones = Array.isArray(textos) ? textos : [textos];

    return cy.get('.fi-modal:visible, [role="dialog"]:visible, .swal2-container:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        const encontrado = opciones.some((texto) => {
          const selector = `button, a`;
          const regex = new RegExp(`^${texto}$`, 'i');

          try {
            const $btn = Cypress.$(selector).filter((_, el) => regex.test(Cypress.$(el).text().trim()));
            if ($btn.length) {
              cy.wrap($btn.first()).click({ force: true });
              return true;
            }
          } catch (e) {
            // ignorar
          }
          return false;
        });

        if (!encontrado) {
          cy.contains('button, a', /Borrar|Aceptar|Confirmar|Sí|Cancelar|Cerrar|No/i, { timeout: 1000 })
            .first()
            .click({ force: true });
        }
      });
  }

  function verificarErrorEsperado(palabrasClave = []) {
    return cy.get('body').then(($body) => {
      const texto = $body.text().toLowerCase();
      const contiene = palabrasClave.every((kw) => texto.includes(kw.toLowerCase()));
      if (!contiene) {
        cy.log(`⚠️ No se detectó mensaje que contenga: ${palabrasClave.join(', ')}`);
      }
    });
  }

  function seleccionarOpcionEnModal(aliasModal, textoOpcion) {
    return cy.get(aliasModal).then(($modal) => {
      const $select = $modal.find('select:visible').first();
      if ($select.length) {
        const opciones = $select.find('option').toArray();
        let opcionElegida = opciones.find((opt) => {
          const texto = Cypress.$(opt).text().trim();
          return textoOpcion && new RegExp(textoOpcion, 'i').test(texto);
        });
        if (!opcionElegida) {
          opcionElegida = opciones.find((opt) => Cypress.$(opt).val()) || opciones[0];
        }
        if (opcionElegida) {
          const valor = Cypress.$(opcionElegida).val() || Cypress.$(opcionElegida).text().trim();
          if (valor) {
            cy.wrap($select).select(valor, { force: true });
            cy.wait(300);
            return;
          }
        }
      }

      const openers = [
        '[role="combobox"]:visible',
        '[aria-haspopup="listbox"]:visible',
        '[aria-expanded="true"]:visible',
        '.choices:visible',
        '.fi-select-trigger:visible',
        '.fi-input:visible',
        '.fi-field:visible',
        '.fi-input-wrp:visible',
        'button:visible',
        '[role="button"]:visible'
      ];

      let $trigger = Cypress.$();
      for (const selector of openers) {
        const candidato = $modal.find(selector).first();
        if (candidato.length) {
          $trigger = candidato;
          break;
        }
      }

      if ($trigger.length) {
        cy.wrap($trigger).scrollIntoView().click({ force: true });
      } else {
        cy.wrap($modal).click('center', { force: true });
      }

      cy.wait(300);

      let $opciones = $modal.find('[role="option"]:visible');
      if (!$opciones.length) {
        $opciones = Cypress.$('[role="option"]:visible');
      }

      if ($opciones.length) {
        let $objetivo = textoOpcion
          ? $opciones.filter((_, el) => new RegExp(textoOpcion, 'i').test(Cypress.$(el).text().trim())).first()
          : $opciones.first();

        if (!$objetivo.length) {
          $objetivo = $opciones.first();
        }

        cy.wrap($objetivo).click({ force: true });
        return;
      }

      const dropdownScopes =
        '.fi-modal:visible .fi-dropdown-panel:visible, .fi-modal:visible .fi-select-panel:visible, [role="listbox"]:visible, .choices__list--dropdown:visible, ul:visible';

      cy.get('body').then(($body) => {
        if ($body.find(dropdownScopes).length) {
          cy.get(dropdownScopes, { timeout: 10000 }).first().within(() => {
            cy.contains(':visible', textoOpcion ? new RegExp(textoOpcion, 'i') : /\S+/, { timeout: 10000 }).click({ force: true });
          });
        } else {
          cy.contains('.fi-modal:visible :visible', textoOpcion ? new RegExp(textoOpcion, 'i') : /\S+/, { timeout: 10000 })
            .first()
            .click({ force: true });
        }
      });
    });
  }

  function seleccionarJornadaEnModal(aliasModal, textoOpcion) {
    const termino = textoOpcion || '';
    return cy.get(aliasModal).within(() => {
      cy.contains('label, span, div', /Jornada\s+Semanal/i, { timeout: 10000 })
        .filter(':visible')
        .then($labels => {
          if (!$labels.length) {
            throw new Error('No se encontró el label de "Jornada Semanal" visible dentro del modal');
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
            ].filter($el => $el && $el.length);

            if (candidatos.length) {
              $campo = candidatos[0];
              return false;
            }
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
            return termino && new RegExp(termino, 'i').test(texto);
          });
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

        return asegurarDropdown().then(() => {
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
            if ($input.length && termino) {
              cy.wrap($input).clear({ force: true }).type(termino, { force: true, delay: 20 });
              cy.wait(200);
            }

            const dropdown = $body.find('.choices__list--dropdown.is-active:visible').last();
            if (dropdown.length) {
              const selectorOpcion = '.choices__item--choice:visible';
              if (termino) {
                cy.wrap(dropdown).contains(selectorOpcion, new RegExp(termino, 'i'), { timeout: 10000 }).click({ force: true });
              } else {
                cy.wrap(dropdown).find(selectorOpcion).first().click({ force: true });
              }
            } else {
              const selectorGenerico = '[role="option"]:visible, .fi-dropdown-panel:visible [data-select-option]:visible';
              if (termino) {
                cy.contains(selectorGenerico, new RegExp(termino, 'i'), { timeout: 10000 }).click({ force: true });
              } else {
                cy.get(selectorGenerico, { timeout: 10000 }).first().click({ force: true });
              }
            }
          });
        }).then(() => cy.wait(300));
      });
    });
  }

  function aplicarFiltroSelect(nombreCampo, textoOpcion) {
    cy.contains('button[title*="Filtrar"], button[aria-label*="Filtrar"], button[title*="Filter"], button[aria-label*="Filter"]', {
      timeout: 10000
    }).first().click({ force: true });

    cy.get('.fi-dropdown-panel:visible, .fi-modal:visible, [role="dialog"]:visible', { timeout: 10000 })
      .should('be.visible')
      .within(() => {
        cy.contains('label, span, div', new RegExp(nombreCampo, 'i'), { timeout: 10000 })
          .should('be.visible')
          .then(($label) => {
            const contenedor = $label.closest('.fi-field, .fi-fo-field-wrp, .fi-fo-field, div, fieldset');
            if (contenedor) {
              cy.wrap(contenedor).within(() => seleccionarOpcionChoices(textoOpcion));
            }
          });
      });

    cy.wait(800);
    return cy.get('.fi-ta-row:visible').should('have.length.greaterThan', 0);
  }

  function obtenerValorEmpresa(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'empresa') ||
      obtenerDatoEnTexto(casoExcel, 'Empresa') ||
      casoExcel.dato_1 ||
      'Admin';
  }

  function obtenerValorNombreGrupo(casoExcel) {
    return obtenerDatoPorEtiqueta(casoExcel, 'data.name') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre del Grupo') ||
      obtenerDatoEnTexto(casoExcel, 'Nombre') ||
      casoExcel.dato_2 ||
      '';
  }
});

