import { createFichajesModule } from '../support/fichaje/fichajes_helper';

describe('FICHAJES - Validacion completa con gestion de errores y reporte a Excel', () => {
  const CASOS_OK = new Set();
  const CASOS_PAUSADOS = new Set(['TC030']);

  const fichajesModule = createFichajesModule();

  before(() => {
    fichajesModule.beforeSuite();
  });

  after(() => {
    fichajesModule.afterSuite();
  });

  it('Ejecutar casos OK de Fichajes desde Google Sheets', () => {
    return fichajesModule.ejecutarSuite(CASOS_OK, CASOS_PAUSADOS);
  });
});