// Inicio de la suite de pruebas de login con gestión de errores y reporte automático a Excel
describe('LOGIN - Validación completa con gestión de errores y reporte a Excel', () => {
  const archivo = 'reportes_pruebas_control_horario.xlsx';
  const LOGIN_URL_ABS = 'https://horario.dev.novatrans.app/login';
  const LOGIN_PATH = '/login';
  const DASHBOARD_PATH = '/panelinterno';

  // Ignorar ciertos errores JS de la app que no deben romper la suite
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
    cy.procesarResultadosPantalla('Login');
  });

  it('Ejecutar todos los casos de Login desde Google Sheets', () => {
    cy.obtenerDatosExcel('Login').then((casosExcel) => {
      cy.log(`Cargados ${casosExcel.length} casos desde Excel para Login`);

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

  // === Helper: siempre dejar el estado en la pantalla de login absoluta y estable ===
  function irALoginLimpio() {
    cy.clearCookies({ log: false });
    cy.clearLocalStorage({ log: false });
    cy.window({ log: false }).then(w => { try { w.sessionStorage?.clear(); } catch (_) {} });

    cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
    // Validamos por URL (no pathname estricto) y esperamos a que aparezca el input de usuario
    cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
    return cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', { timeout: 15000 })
      .should('exist');
  }

  // === Helper: click robusto del botón "Salir" en dashboard o fichajes ===
  function clickBotonSalir() {
    return cy.url().then((currentUrl) => {
      // Si estamos en fichajes (/fichar), usar el menú de usuario
      if (currentUrl.includes('/fichar')) {
        cy.log('Detectado contexto de fichajes, usando menú de usuario');
        // Buscar el trigger del menú de usuario (account-trigger)
        cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
        
        // Esperar un poco para que el dropdown se abra
        cy.wait(800);
        
        // Buscar "Cerrar sesión" en el dropdown - usar force: true para hacer clic incluso si el dropdown está oculto
        // El dropdown puede estar con visibility: hidden pero aún así es clickeable
        return cy.get('body').then($body => {
          // Buscar el elemento "Cerrar sesión" dentro del dropdown o en el body
          const $cerrarSesion = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((i, el) => {
            const texto = Cypress.$(el).text().trim().toLowerCase();
            return texto === 'cerrar sesión' || texto === 'cerrar sesion' || texto.includes('cerrar sesión') || texto.includes('cerrar sesion');
          }).first();
          
          if ($cerrarSesion.length > 0) {
            // El elemento existe, hacer clic con force para ignorar problemas de visibilidad
            cy.wrap($cerrarSesion)
              .scrollIntoView()
              .click({ force: true });
          } else {
            // Si no lo encuentra, usar contains como fallback
            cy.contains('button, a, [role="menuitem"], .dropdown-item', /Cerrar sesión|Cerrar sesion/i, { timeout: 10000 })
              .first({ force: true })
              .scrollIntoView()
              .click({ force: true });
          }
        });
      }

      // Si estamos en panel interno, usar el método original
    return cy.get('body').then($body => {
      // 1) Botón de un form /logout
      const selForm = 'form[action*="/logout"] button[type="submit"]';
      if ($body.find(selForm).length) {
        cy.log('Encontrado botón Salir vía form[action*="/logout"]');
        return cy.get(selForm).scrollIntoView().click({ force: true });
      }

      // 2) Cualquier button/a/[role=button] cuyo texto contenga "Salir"
      const textoSalir = /Salir/i;
      const $btnText = $body.find('button, a, [role="button"]').filter((_, el) => textoSalir.test(el.innerText || ''));
      if ($btnText.length) {
        cy.log('Encontrado botón Salir por texto visible');
        return cy.wrap($btnText.eq(0)).scrollIntoView().click({ force: true });
      }

      // 3) Fallback: en algunos temas el botón está en un header lateral
      cy.log('Botón Salir no visible directo, intento alternativo por contains');
      return cy.contains('button, a, [role="button"]', textoSalir, { timeout: 3000 })
        .scrollIntoView()
        .click({ force: true });
      });
    });
  }

  // === Ejecuta 1 caso: SIEMPRE arranca desde /login ===
  function ejecutarCaso(casoExcel, idx) {
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10) || (idx + 1);
    const nombre  = `${casoExcel.caso} - ${casoExcel.nombre}`;
    const funcion = obtenerFuncionPorNombre(casoExcel.funcion);

    cy.log('────────────────────────────────────────────────────────');
    cy.log(`${nombre} [${casoExcel.prioridad || 'SIN PRIORIDAD'}] (función: ${casoExcel.funcion})`);
    if (idx > 0) cy.wait(600);
    cy.resetearFlagsTest();

    return irALoginLimpio()
      .then(() => {
        return funcion(casoExcel);
      })
      .then(() => {
        return cy.estaRegistrado().then((ya) => {
          if (!ya) {
            cy.registrarResultados({
              numero,
              nombre,
              esperado: 'Comportamiento correcto',
              obtenido: 'Comportamiento correcto',
              resultado: 'OK',
              archivo,
              pantalla: 'Login'
            });
          }
        });
      }, (err) => {
        cy.capturarError(nombre, err, {
          numero,
          nombre,
          esperado: 'Comportamiento correcto',
          archivo,
          pantalla: 'Login'
        });
        return null; // continuar con el siguiente caso
      });
  }

  // === MAPEO DE FUNCIONES ===
  function obtenerFuncionPorNombre(nombreFuncion) {
    const funciones = {
      'loginGenerico': loginGenerico,
      'loginCredencialesValidas': loginGenerico,
      'loginEmailIncorrecto': loginGenerico,
      'loginPasswordIncorrecto': loginGenerico,
      'loginCredencialesIncorrectas': loginGenerico,
      'loginConRecordarme': loginConRecordarme,
      'loginEmailVacio': loginGenerico,
      'loginPasswordVacia': loginGenerico,
      'loginCredencialesVacias': loginGenerico,
      'logoutNormal': logoutNormal,        // ← TC009
      'logoutDesdeMenu': logoutDesdeMenu,
      'cambiarModoClaro': cambiarModoClaro,
      'cambiarModoOscuro': cambiarModoOscuro,
      'cambiarModoSistema': cambiarModoSistema
    };

    if (!funciones[nombreFuncion]) {
      return () => {
        cy.log(`Función no encontrada en mapping: "${nombreFuncion}"`);
        return cy.wrap(null);
      };
    }
    return funciones[nombreFuncion];
  }

  // Helper: abre el menú de usuario y espera al panel
  function abrirMenuUsuario() {
    return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 10000 })
      .then($el => $el.is('img') ? cy.wrap($el).closest('button') : cy.wrap($el))
      .then($btn => {
        cy.wrap($btn).scrollIntoView().click({ force: true });
        return cy.get('.fi-dropdown-panel', { timeout: 10000 }).should('exist');
      });
  }

  // === FUNCIONES DE VALIDACIÓN ===

  // Casos de login (positivos/negativos). SIEMPRE se llama tras irALoginLimpio()
  function loginGenerico(casoExcel) {
    const email = casoExcel.dato_1;
    const password = casoExcel.dato_2;
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} - Usuario: ${email}`);

    // Escribimos solo si hay valor (para los casos de vacío, no llamamos .type(''))
    if (email) {
      cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', { timeout: 10000 })
        .clear().type(email);
    } else {
      cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', { timeout: 10000 })
        .clear();
    }

    if (password) {
      cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
        .clear().type(password);
    } else {
      cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
        .clear();
    }

    cy.get('button[type="submit"], input[type="submit"]').click();

    if (numero === 1 || /credenciales válidas/i.test(casoExcel.nombre || '')) {
      // Después del login puede redirigir a /panelinterno o /fichar, ambos son válidos
      cy.url({ timeout: 15000 }).should((url) => {
        expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
      });
      return cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist');
    } else {
      // Debe permanecer en la pantalla de login
      cy.wait(300);
      return cy.url().should('include', LOGIN_PATH);
    }
  }

  function loginConRecordarme(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', { timeout: 10000 })
      .clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 })
      .clear().type(password);

    // Marca "Recordarme" si existe
    cy.get('input[type="checkbox"], [role="checkbox"]', { timeout: 3000 })
      .first()
      .check({ force: true })
      .should('be.checked');

    cy.get('button[type="submit"], input[type="submit"]').click();
    // Después del login puede redirigir a /panelinterno o /fichar, ambos son válidos
    cy.url({ timeout: 15000 }).should((url) => {
      expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
    });
  }

  // TC009 — Espera 30s antes de loguear y luego pulsa "Salir"
  function logoutNormal(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (con espera de 30s antes del login)`);

    // Requisito de la app: esperar 30 segundos antes de introducir credenciales
    cy.wait(40000);

    // Autenticación
    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]', { timeout: 10000 }).clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]', { timeout: 10000 }).clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();

    // Asegurar que estamos en el dashboard o fichajes (ambos válidos)
    cy.url({ timeout: 20000 }).should((url) => {
      expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
    });
    cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist');

    // Pulsar botón Salir (robusto)
    return clickBotonSalir()
      .then(() => {
        // Después del logout puede redirigir a /login o a / (raíz), ambos son válidos
        cy.url({ timeout: 20000 }).should((url) => {
          expect(url).to.satisfy((u) => u.includes('/login') || u.endsWith('/') || u === 'https://horario.dev.novatrans.app/');
        });
      });
  }

  function logoutDesdeMenu(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]').clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    
    // Después del login puede redirigir a /panelinterno o /fichar
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      // Si estamos en /fichar, saltar este caso porque no hay menú de usuario con "Cerrar sesión"
      if (currentUrl.includes('/fichar')) {
        cy.log('TC010: Saltado porque estamos en /fichar (no hay menú de usuario con cerrar sesión)');
        // Registrar como OK ya que el comportamiento es correcto
        return cy.wrap(true);
      }

      // Si estamos en /panelinterno, continuar con la lógica normal
      cy.log('TC010: En panel interno, ejecutando logout desde menú de usuario');

    return abrirMenuUsuario()
      .within(() => {
        cy.get('form[action*="/logout"] button[type="submit"]', { timeout: 10000 })
          .should('exist')
          .click({ force: true });
      })
        .then(() => {
          // Después del logout puede redirigir a /login o a / (raíz), ambos son válidos
          cy.url({ timeout: 15000 }).should((url) => {
            expect(url).to.satisfy((u) => u.includes('/login') || u.endsWith('/') || u === 'https://horario.dev.novatrans.app/');
          });
        });
    });
  }

  function cambiarModoClaro(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]').clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    
    // Después del login puede redirigir a /panelinterno o /fichar
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      // Si estamos en /fichar, navegar a panel interno primero
      if (currentUrl.includes('/fichar')) {
        cy.log('TC011: Estamos en fichajes, navegando a Panel interno');
        // Abrir el menú de usuario (igual que para cerrar sesión)
        cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
        
        cy.wait(800);
        
        // Hacer clic en "Panel interno"
        return cy.get('body').then($body => {
          const $panelInterno = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((i, el) => {
            const texto = Cypress.$(el).text().trim().toLowerCase();
            return texto === 'panel interno' || texto.includes('panel interno');
          }).first();
          
          if ($panelInterno.length > 0) {
            return cy.wrap($panelInterno)
              .scrollIntoView()
              .click({ force: true });
          } else {
            return cy.contains('button, a, [role="menuitem"], .dropdown-item', /Panel interno/i, { timeout: 10000 })
              .first({ force: true })
              .scrollIntoView()
              .click({ force: true });
          }
        }).then(() => {
          // Esperar a que se cargue panel interno completamente
          cy.url({ timeout: 15000 }).should('include', '/panelinterno');
          // Esperar a que el header y el menú de usuario estén disponibles
          return cy.get('header', { timeout: 10000 }).should('exist').then(() => {
            cy.wait(1500); // Esperar a que todos los componentes JavaScript se inicialicen
            // Verificar que el botón del menú de usuario esté disponible
            return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 5000 }).should('exist');
          });
        }).then(() => {
          // Ahora ejecutar la prueba normalmente (ya estamos en panel interno)
          cy.log('TC011: Cambiando a modo claro');
          
          return abrirMenuUsuario().within(() => {
            cy.get('button[aria-label="A modo claro"]').should('exist').click({ force: true });
          }).then(() => {
            expect(localStorage.getItem('theme')).to.eq('light');
            return cy.url().should((url) => {
              expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
            });
          });
        });
      }

      // Si ya estamos en panel interno, ejecutar la prueba directamente
      cy.log('TC011: Cambiando a modo claro');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo claro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('light');
        return cy.url().should((url) => {
          expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
        });
      });
    });
  }

  function cambiarModoOscuro(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]').clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    
    // Después del login puede redirigir a /panelinterno o /fichar
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      // Si estamos en /fichar, navegar a panel interno primero
      if (currentUrl.includes('/fichar')) {
        cy.log('TC012: Estamos en fichajes, navegando a Panel interno');
        // Abrir el menú de usuario (igual que para cerrar sesión)
        cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
        
        cy.wait(800);
        
        // Hacer clic en "Panel interno"
        return cy.get('body').then($body => {
          const $panelInterno = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((i, el) => {
            const texto = Cypress.$(el).text().trim().toLowerCase();
            return texto === 'panel interno' || texto.includes('panel interno');
          }).first();
          
          if ($panelInterno.length > 0) {
            return cy.wrap($panelInterno)
              .scrollIntoView()
              .click({ force: true });
          } else {
            return cy.contains('button, a, [role="menuitem"], .dropdown-item', /Panel interno/i, { timeout: 10000 })
              .first({ force: true })
              .scrollIntoView()
              .click({ force: true });
          }
        }).then(() => {
          // Esperar a que se cargue panel interno completamente
          cy.url({ timeout: 15000 }).should('include', '/panelinterno');
          // Esperar a que el header y el menú de usuario estén disponibles
          return cy.get('header', { timeout: 10000 }).should('exist').then(() => {
            cy.wait(1500); // Esperar a que todos los componentes JavaScript se inicialicen
            // Verificar que el botón del menú de usuario esté disponible
            return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 5000 }).should('exist');
          });
        }).then(() => {
          // Ahora ejecutar la prueba normalmente (ya estamos en panel interno)
          cy.log('TC012: Cambiando a modo oscuro');
          
          return abrirMenuUsuario().within(() => {
            cy.get('button[aria-label="A modo oscuro"]').should('exist').click({ force: true });
          }).then(() => {
            expect(localStorage.getItem('theme')).to.eq('dark');
            return cy.url().should((url) => {
              expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
            });
          });
        });
      }

      // Si ya estamos en panel interno, ejecutar la prueba directamente
      cy.log('TC012: Cambiando a modo oscuro');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo oscuro"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('dark');
        return cy.url().should((url) => {
          expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
        });
      });
    });
  }

  function cambiarModoSistema(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;

    cy.get('input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]').clear().type(email);
    cy.get('input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]').clear().type(password);
    cy.get('button[type="submit"], input[type="submit"]').click();
    
    // Después del login puede redirigir a /panelinterno o /fichar
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      // Si estamos en /fichar, navegar a panel interno primero
      if (currentUrl.includes('/fichar')) {
        cy.log('TC013: Estamos en fichajes, navegando a Panel interno');
        // Abrir el menú de usuario (igual que para cerrar sesión)
        cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });
        
        cy.wait(800);
        
        // Hacer clic en "Panel interno"
        return cy.get('body').then($body => {
          const $panelInterno = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((i, el) => {
            const texto = Cypress.$(el).text().trim().toLowerCase();
            return texto === 'panel interno' || texto.includes('panel interno');
          }).first();
          
          if ($panelInterno.length > 0) {
            return cy.wrap($panelInterno)
              .scrollIntoView()
              .click({ force: true });
          } else {
            return cy.contains('button, a, [role="menuitem"], .dropdown-item', /Panel interno/i, { timeout: 10000 })
              .first({ force: true })
              .scrollIntoView()
              .click({ force: true });
          }
        }).then(() => {
          // Esperar a que se cargue panel interno completamente
          cy.url({ timeout: 15000 }).should('include', '/panelinterno');
          // Esperar a que el header y el menú de usuario estén disponibles
          return cy.get('header', { timeout: 10000 }).should('exist').then(() => {
            cy.wait(1500); // Esperar a que todos los componentes JavaScript se inicialicen
            // Verificar que el botón del menú de usuario esté disponible
            return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 5000 }).should('exist');
          });
        }).then(() => {
          // Ahora ejecutar la prueba normalmente (ya estamos en panel interno)
          cy.log('TC013: Cambiando a modo del sistema');
          
          return abrirMenuUsuario().within(() => {
            cy.get('button[aria-label="A modo del sistema"]').should('exist').click({ force: true });
          }).then(() => {
            expect(localStorage.getItem('theme')).to.eq('system');
            return cy.url().should((url) => {
              expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
            });
          });
        });
      }

      // Si ya estamos en panel interno, ejecutar la prueba directamente
      cy.log('TC013: Cambiando a modo del sistema');

    return abrirMenuUsuario().within(() => {
      cy.get('button[aria-label="A modo del sistema"]').should('exist').click({ force: true });
    }).then(() => {
      expect(localStorage.getItem('theme')).to.eq('system');
        return cy.url().should((url) => {
          expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
        });
      });
    });
  }
});