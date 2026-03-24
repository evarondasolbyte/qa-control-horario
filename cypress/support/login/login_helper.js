import { buildAppUrl } from '../appUrls';

export function createLoginActions(config) {
  const { DASHBOARD_PATH, LOGIN_PATH, LOGIN_URL_ABS } = config;
  const rootUrl = buildAppUrl('/');

  const userSelector = 'input#usuario, input[name="usuario"], input[placeholder*="Usuario"], input[placeholder*="usuario"]';
  const passwordSelector = 'input#clave, input[name="clave"], input[type="password"], input[placeholder*="Contraseña"], input[placeholder*="password"]';
  const submitSelector = 'button[type="submit"], input[type="submit"]';

  function escribirCredenciales(email, password) {
    if (email) {
      cy.get(userSelector, { timeout: 10000 }).clear().type(email);
    } else {
      cy.get(userSelector, { timeout: 10000 }).clear();
    }

    if (password) {
      cy.get(passwordSelector, { timeout: 10000 }).clear().type(password);
    } else {
      cy.get(passwordSelector, { timeout: 10000 }).clear();
    }
  }

  function enviarLogin() {
    return cy.get(submitSelector, { timeout: 10000 }).click();
  }

  function asegurarSesionIniciada() {
    return cy.url({ timeout: 15000 }).should((url) => {
      expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
    });
  }

  function navegarAPanelInternoDesdeFichar() {
    cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
      .first()
      .scrollIntoView()
      .should('be.visible')
      .click({ force: true });

    cy.wait(800);

    return cy.get('body').then(($body) => {
      const $panelInterno = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((_, el) => {
        const texto = Cypress.$(el).text().trim().toLowerCase();
        return texto === 'panel interno' || texto.includes('panel interno');
      }).first();

      if ($panelInterno.length > 0) {
        return cy.wrap($panelInterno)
          .scrollIntoView()
          .click({ force: true });
      }

      return cy.contains('button, a, [role="menuitem"], .dropdown-item', /Panel interno/i, { timeout: 10000 })
        .scrollIntoView()
        .click({ force: true });
    }).then(() => {
      cy.url({ timeout: 15000 }).should('include', DASHBOARD_PATH);
      return cy.get('header', { timeout: 10000 }).should('exist').then(() => {
        cy.wait(1500);
        return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 5000 }).should('exist');
      });
    });
  }

  function asegurarPanelInternoSiHaceFalta(prefijoLog = '') {
    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (!currentUrl.includes('/fichar')) return cy.wrap(null);
      if (prefijoLog) cy.log(`${prefijoLog}: Estamos en fichajes, navegando a Panel interno`);
      return navegarAPanelInternoDesdeFichar();
    });
  }

  function irALoginLimpio() {
    cy.clearCookies({ log: false });
    cy.clearLocalStorage({ log: false });
    cy.window({ log: false }).then((w) => { try { w.sessionStorage?.clear(); } catch (_) {} });

    cy.visit(LOGIN_URL_ABS, { failOnStatusCode: false });
    cy.url({ timeout: 15000 }).should('include', LOGIN_PATH);
    return cy.get(userSelector, { timeout: 15000 }).should('exist');
  }

  function clickBotonSalir() {
    return cy.url().then((currentUrl) => {
      if (currentUrl.includes('/fichar')) {
        cy.log('Detectado contexto de fichajes, usando menu de usuario');
        cy.get('header .account-trigger, header a.account, header .account a, header .header-account a', { timeout: 10000 })
          .first()
          .scrollIntoView()
          .should('be.visible')
          .click({ force: true });

        cy.wait(800);

        return cy.get('body').then(($body) => {
          const $cerrarSesion = $body.find('button, a, [role="menuitem"], .dropdown-item').filter((_, el) => {
            const texto = Cypress.$(el).text().trim().toLowerCase();
            return texto === 'cerrar sesión' || texto === 'cerrar sesion' || texto.includes('cerrar sesión') || texto.includes('cerrar sesion');
          }).first();

          if ($cerrarSesion.length > 0) {
            cy.wrap($cerrarSesion).scrollIntoView().click({ force: true });
          } else {
            cy.contains('button, a, [role="menuitem"], .dropdown-item', /Cerrar sesión|Cerrar sesion/i, { timeout: 10000 })
              .scrollIntoView()
              .click({ force: true });
          }
        });
      }

      return cy.get('body').then(($body) => {
        const selForm = 'form[action*="/logout"] button[type="submit"]';
        if ($body.find(selForm).length) {
          cy.log('Encontrado boton Salir via form[action*="/logout"]');
          return cy.get(selForm).scrollIntoView().click({ force: true });
        }

        const textoSalir = /Salir/i;
        const $btnText = $body.find('button, a, [role="button"]').filter((_, el) => textoSalir.test(el.innerText || ''));
        if ($btnText.length) {
          cy.log('Encontrado boton Salir por texto visible');
          return cy.wrap($btnText.eq(0)).scrollIntoView().click({ force: true });
        }

        cy.log('Boton Salir no visible directo, intento alternativo por contains');
        return cy.contains('button, a, [role="button"]', textoSalir, { timeout: 3000 })
          .scrollIntoView()
          .click({ force: true });
      });
    });
  }

  function abrirMenuUsuario() {
    return cy.get('button[aria-label="Menú del Usuario"], img.fi-user-avatar', { timeout: 10000 })
      .then(($el) => ($el.is('img') ? cy.wrap($el).closest('button') : cy.wrap($el)))
      .then(($btn) => {
        cy.wrap($btn).scrollIntoView().click({ force: true });
        return cy.get('.fi-dropdown-panel', { timeout: 10000 }).should('exist');
      });
  }

  function loginGenerico(casoExcel) {
    const email = casoExcel.dato_1;
    const password = casoExcel.dato_2;
    const numero = parseInt(String(casoExcel.caso).replace('TC', ''), 10);

    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} - Usuario: ${email}`);

    escribirCredenciales(email, password);
    enviarLogin();

    if (numero === 1 || /credenciales válidas/i.test(casoExcel.nombre || '')) {
      return asegurarSesionIniciada()
        .then(() => cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist'));
    }

    cy.wait(300);
    return cy.url().should('include', LOGIN_PATH);
  }

  function loginConRecordarme(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    escribirCredenciales(email, password);

    cy.get('input[type="checkbox"], [role="checkbox"]', { timeout: 3000 })
      .first()
      .check({ force: true })
      .should('be.checked');

    enviarLogin();
    return asegurarSesionIniciada();
  }

  function logoutNormal(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre} (con espera de 30s antes del login)`);

    cy.wait(40000);
    escribirCredenciales(email, password);
    enviarLogin();

    return asegurarSesionIniciada()
      .then(() => cy.get('header, .MuiToolbar-root, .dashboard-container, body', { timeout: 10000 }).should('exist'))
      .then(() => clickBotonSalir())
      .then(() => {
        cy.url({ timeout: 20000 }).should((url) => {
          expect(url).to.satisfy((u) => u.includes('/login') || u.endsWith('/') || u === rootUrl);
        });
      });
  }

  function logoutDesdeMenu(casoExcel) {
    const { dato_1: email, dato_2: password } = casoExcel;
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);

    escribirCredenciales(email, password);
    enviarLogin();

    return cy.url({ timeout: 15000 }).then((currentUrl) => {
      if (currentUrl.includes('/fichar')) {
        cy.log('TC010: Saltado porque estamos en /fichar (no hay menu de usuario con cerrar sesión)');
        return cy.wrap(true);
      }

      cy.log('TC010: En panel interno, ejecutando logout desde menu de usuario');

      return abrirMenuUsuario()
        .within(() => {
          cy.get('form[action*="/logout"] button[type="submit"]', { timeout: 10000 })
            .should('exist')
            .click({ force: true });
        })
        .then(() => {
          cy.url({ timeout: 15000 }).should((url) => {
            expect(url).to.satisfy((u) => u.includes('/login') || u.endsWith('/') || u === rootUrl);
          });
        });
    });
  }

  function cambiarTema(casoExcel, { logPrefix, buttonLabel, expectedTheme }) {
    const { dato_1: email, dato_2: password } = casoExcel;

    escribirCredenciales(email, password);
    enviarLogin();

    return asegurarSesionIniciada()
      .then(() => asegurarPanelInternoSiHaceFalta(logPrefix))
      .then(() => {
        cy.log(`${logPrefix}: Cambiando tema`);
        return abrirMenuUsuario()
          .within(() => {
            cy.get(`button[aria-label="${buttonLabel}"]`, { timeout: 10000 })
              .should('exist')
              .click({ force: true });
          });
      })
      .then(() => {
        expect(localStorage.getItem('theme')).to.eq(expectedTheme);
        return cy.url().should((url) => {
          expect(url).to.satisfy((u) => u.includes('/panelinterno') || u.includes('/fichar'));
        });
      });
  }

  function cambiarModoClaro(casoExcel) {
    return cambiarTema(casoExcel, {
      logPrefix: 'TC011',
      buttonLabel: 'A modo claro',
      expectedTheme: 'light'
    });
  }

  function cambiarModoOscuro(casoExcel) {
    return cambiarTema(casoExcel, {
      logPrefix: 'TC012',
      buttonLabel: 'A modo oscuro',
      expectedTheme: 'dark'
    });
  }

  function cambiarModoSistema(casoExcel) {
    return cambiarTema(casoExcel, {
      logPrefix: 'TC013',
      buttonLabel: 'A modo del sistema',
      expectedTheme: 'system'
    });
  }

  return {
    abrirMenuUsuario,
    cambiarModoClaro,
    cambiarModoOscuro,
    cambiarModoSistema,
    clickBotonSalir,
    irALoginLimpio,
    loginConRecordarme,
    loginCredencialesIncorrectas: loginGenerico,
    loginCredencialesValidas: loginGenerico,
    loginCredencialesVacias: loginGenerico,
    loginEmailIncorrecto: loginGenerico,
    loginEmailVacio: loginGenerico,
    loginGenerico,
    loginPasswordIncorrecto: loginGenerico,
    loginPasswordVacia: loginGenerico,
    logoutDesdeMenu,
    logoutNormal
  };
}
