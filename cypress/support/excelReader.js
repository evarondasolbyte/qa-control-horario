// === Parser CSV que funciona con formato vertical de Google Sheets ===
function parseCsvRespectingQuotes(csv) {
  if (csv && csv.charCodeAt && csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);
  const lines = (csv || '').split(/\r?\n/).filter(line => line.trim() !== '');
  const rows = lines.map(line => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim()); current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  });
  return rows;
}

const safe = (v) => (v ?? '').toString().trim();

Cypress.Commands.add('leerDatosGoogleSheets', () => {
  cy.log('🚀 NUEVO PARSER CSV - Intentando leer datos desde Google Sheets (CSV público)...');

  // IDs de tu documento y la hoja LOGIN
  const spreadsheetId = '1SrfWzbyPDnNsCd5AKrInQAvOG-wgUW9sWqH6Z7VPdXY';
  const gid = '1362476451'; // Hoja LOGIN
  const range = 'A:M';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&range=${encodeURIComponent(range)}`;

  cy.log(`🔍 Leyendo hoja LOGIN (gid=${gid}) desde: ${csvUrl}`);

  return cy.request({ method: 'GET', url: csvUrl, failOnStatusCode: false }).then((response) => {
    if (response.status === 200 && response.body) {
      let filasExcel = parseCsvRespectingQuotes(response.body);

      // Normalizar A..M (13 columnas)
      const COLS = 13;
      filasExcel = filasExcel.map(f => {
        const row = Array.from(f);
        while (row.length < COLS) row.push('');
        return row.slice(0, COLS);
      });

      if (filasExcel.length > 1) {
        cy.log(`📗 Leídas ${filasExcel.length} filas (parser robusto)`);
        return cy.wrap(filasExcel);
      }
    }

    cy.log('❌ Error al leer Google Sheets CSV');
    return cy.wrap([]);
  });
});

Cypress.Commands.add('obtenerDatosExcel', (pantalla) => {
  const pantallaSafe = safe(pantalla).toLowerCase();

  return cy.leerDatosGoogleSheets().then((filasExcel) => {
    if (!filasExcel || filasExcel.length === 0) {
      cy.log('❌ No se pudieron leer datos del Excel');
      return cy.wrap([]);
    }

    const headers = (filasExcel[0] || []).map(safe);
    cy.log(`Headers del Excel: [${headers.join(', ')}]`);

    const datos = [];

    for (let i = 1; i < filasExcel.length; i++) {
      const fila = (filasExcel[i] || []).map(safe);
      if (fila.every(c => c === '')) continue;

      const pantallaFila = (fila[0] || '').toLowerCase();
      if (pantallaFila === pantallaSafe || pantallaFila === 'login') {
        const dato = {
          // A..M según tu captura:
          pantalla         : safe(fila[0]),  // A - Pantalla
          funcionalidad    : safe(fila[1]),  // B - Funcionalidad
          caso             : safe(fila[2]),  // C - N°Caso (TCxxx)
          nombre           : safe(fila[3]),  // D - Nombre
          prioridad        : safe(fila[4]),  // E - Prioridad
          funcion          : safe(fila[5]),  // F - Función (clave para mapping)
          etiqueta_1       : safe(fila[6]),  // G
          valor_etiqueta_1 : safe(fila[7]),  // H
          dato_1           : safe(fila[8]),  // I - Email
          etiqueta_2       : safe(fila[9]),  // J
          valor_etiqueta_2 : safe(fila[10]), // K
          dato_2           : safe(fila[11]), // L - Password
          dato_3           : safe(fila[12])  // M - extra
        };

        cy.log(`✅ ${dato.caso} - ${dato.nombre} | Función=${dato.funcion} | Email="${dato.dato_1}" | Password="${dato.dato_2}"`);
        datos.push(dato);
      }
    }

    cy.log(`🔎 Encontrados ${datos.length} casos para pantalla "${pantalla}"`);
    return cy.wrap(datos);
  });
});