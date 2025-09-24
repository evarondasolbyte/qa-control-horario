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

  // 🔧 Ajusta estas constantes si cambias de hoja
  const spreadsheetId = '1SrfWzbyPDnNsCd5AKrInQAvOG-wgUW9sWqH6Z7VPdXY'; // <-- ID del Excel de Control Horario
  const gid = '0';                           // <-- cambia si tu pestaña no es la primera
  const range = 'A:L';                       // <-- rango de columnas
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&range=${encodeURIComponent(range)}`;
  
  cy.log(`🔍 Intentando leer hoja con gid=${gid} desde: ${csvUrl}`);

  return cy.request({ method: 'GET', url: csvUrl, failOnStatusCode: false }).then((response) => {
    if (response.status === 200 && response.body) {
      const csvData = response.body;
      let filasExcel = parseCsvRespectingQuotes(csvData);

      // Normalizar longitud de columnas A..L (12 columnas)
      const COLS = 12;
      filasExcel = filasExcel.map(f => {
        const row = Array.from(f);
        while (row.length < COLS) row.push('');
        return row.slice(0, COLS);
      });

      if (filasExcel.length > 1) {
        cy.log(`Leídas ${filasExcel.length} filas desde Google Sheets CSV (parser robusto)`);
        return cy.wrap(filasExcel);
      }
    }

    cy.log('Error al leer Google Sheets CSV');
    return cy.wrap([]);
  });
});

Cypress.Commands.add('obtenerDatosExcel', (pantalla) => {
  const pantallaSafe = safe(pantalla).toLowerCase();

  return cy.leerDatosGoogleSheets().then((filasExcel) => {
    if (!filasExcel || filasExcel.length === 0) {
      cy.log('No se pudieron leer datos del Excel');
      return cy.wrap([]);
    }

    const headers = (filasExcel[0] || []).map(safe);
    cy.log(`Headers del Excel: [${headers.join(', ')}]`);

    const datosFiltrados = [];

    for (let i = 1; i < filasExcel.length; i++) {
      const fila = (filasExcel[i] || []).map(safe);
      if (fila.every(c => c === '')) continue;

      const pantallaFila = (fila[0] || '').toLowerCase();
      if (pantallaFila === pantallaSafe) {
        const datoFiltro = {
          pantalla: safe(fila[0]),          // A
          funcionalidad: safe(fila[1]),     // B
          caso: safe(fila[2]),              // C
          etiqueta_1: safe(fila[3]),        // D
          valor_etiqueta_1: safe(fila[4]),  // E
          dato_1: safe(fila[5]),            // F
          etiqueta_2: safe(fila[6]),        // G
          valor_etiqueta_2: safe(fila[7]),  // H
          dato_2: safe(fila[8]),            // I
          etiqueta_3: safe(fila[9]),        // J
          valor_etiqueta_3: safe(fila[10]), // K
          dato_3: safe(fila[11])            // L
        };

        datosFiltrados.push(datoFiltro);
      }
    }

    cy.log(`Encontrados ${datosFiltrados.length} casos para pantalla "${pantalla}"`);
    return cy.wrap(datosFiltrados);
  });
});