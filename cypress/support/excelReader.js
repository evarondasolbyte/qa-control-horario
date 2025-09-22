// === Parser CSV que funciona con formato vertical de Google Sheets ===
function parseCsvRespectingQuotes(csv) {
  // Quitar BOM si existe
  if (csv.charCodeAt(0) === 0xFEFF) csv = csv.slice(1);

  cy.log(`CSV raw length: ${csv.length} caracteres`);
  
  // Dividir por líneas y limpiar
  const lines = csv.split(/\r?\n/).filter(line => line.trim() !== '');
  cy.log(`Número de líneas: ${lines.length}`);
  
  // Parsear cada línea
  const rows = lines.map(line => {
    const cells = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Comilla doble escapada
          current += '"';
          i++; // Saltar la siguiente comilla
        } else {
          // Cambiar estado de comillas
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Fin de celda
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Agregar la última celda
    cells.push(current.trim());
    
    return cells;
  });
  
  cy.log(`Filas parseadas: ${rows.length}`);
  return rows;
}

// Helper para sanear valores
const safe = (v) => (v ?? '').toString().trim();

// Función para leer datos de Google Sheets (público -> CSV)
Cypress.Commands.add('leerDatosGoogleSheets', () => {
  cy.log('🚀 NUEVO PARSER CSV - Intentando leer datos desde Google Sheets (CSV público)...');

  const spreadsheetId = '1m3B_HFT8fJduBxloh8Kj36bVr0hwnj5TioUHAq5O7Zs';
  const range = 'Datos!A:I';
  const sheetName = range.split('!')[0]; // "Datos"
  // Usar formato que genera CSV vertical (líneas separadas)
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=0&range=${encodeURIComponent(range)}`;

  cy.log(`Spreadsheet ID: ${spreadsheetId}`);
  cy.log(`Range: ${range}`);
  cy.log(`Intentando leer desde: ${csvUrl}`);

  return cy.request({
    method: 'GET',
    url: csvUrl,
    failOnStatusCode: false,
  }).then((response) => {
    cy.log(`Respuesta del servidor: ${response.status}`);

      if (response.status === 200 && response.body) {
        const csvData = response.body;
        cy.log(`Datos CSV recibidos: ${csvData.length} caracteres`);
        
        // Debug: mostrar las primeras líneas del CSV raw
        const lineas = csvData.split('\n');
        cy.log(`🔍 CSV RAW - Primera línea: "${lineas[0]}"`);
        cy.log(`🔍 CSV RAW - Línea 24 (TC003): "${lineas[23]}"`);
        cy.log(`🔍 CSV RAW - Línea 25 (TC004): "${lineas[24]}"`);

        let filasExcel = parseCsvRespectingQuotes(csvData);

      // Normalizar longitud de columnas A..I (9 columnas)
      const COLS = 9;
      filasExcel = filasExcel.map(f => {
        const row = Array.from(f);
        while (row.length < COLS) row.push('');
        return row.slice(0, COLS);
      });

      // Comprobar que hay cabecera + al menos 1 fila
      if (filasExcel.length > 1) {
        cy.log(`Leídas ${filasExcel.length} filas desde Google Sheets CSV (parser robusto)`);
        return cy.wrap(filasExcel);
      }
    }

    cy.log('Error al leer Google Sheets CSV');
    cy.log(`Status: ${response.status}`);
    cy.log(`URL: ${csvUrl}`);
    return cy.wrap([]);
  });
});

// Función para obtener datos del Excel por pantalla
Cypress.Commands.add('obtenerDatosExcel', (pantalla) => {
  const pantallaSafe = safe(pantalla).toLowerCase();

  return cy.leerDatosGoogleSheets().then((filasExcel) => {
    if (!filasExcel || filasExcel.length === 0) {
      cy.log('No se pudieron leer datos del Excel');
      return cy.wrap([]);
    }

    // Headers
    const headers = (filasExcel[0] || []).map(safe);
    cy.log(`Headers del Excel: [${headers.map(h => `"${h}"`).join(', ')}]`);
    cy.log(`Número de columnas: ${headers.length}`);

    const datosFiltrados = [];

    // Filas de datos (A..I)
    for (let i = 1; i < filasExcel.length; i++) {
      const fila = (filasExcel[i] || []).map(safe);

      // Saltar filas totalmente vacías
      if (fila.every(c => c === '')) continue;

      // Columna A = "Pantalla"
      const pantallaFila = (fila[0] || '').toLowerCase();
      if (pantallaFila === pantallaSafe) {
        cy.log(`🎯 PROCESANDO FILA ${i}: pantalla="${pantallaFila}" === "${pantallaSafe}"`);
        const datoFiltro = {
          pantalla: safe(fila[0]),          // A
          funcionalidad: safe(fila[1]),     // B
          caso: safe(fila[2]),              // C
          etiqueta_1: safe(fila[3]),        // D
          valor_etiqueta_1: safe(fila[4]),  // E
          dato_1: safe(fila[5]),            // F
          etiqueta_2: safe(fila[6]),        // G
          valor_etiqueta_2: safe(fila[7]),  // H
          dato_2: safe(fila[8])             // I
        };

        // Debug por caso TC
        if (datoFiltro.caso && datoFiltro.caso.toUpperCase().startsWith('TC')) {
          cy.log(`🔍🔍🔍 ENCONTRADO ${datoFiltro.caso} 🔍🔍🔍`);
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: fila completa = [${fila.map(cell => `"${cell}"`).join(', ')}]`);
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: longitud fila=${fila.length}`);
          
          // Debugging específico para caracteres
          const rawDato2 = fila[8];
          const cleanDato2 = safe(rawDato2);
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: RAW indice_8 = "${rawDato2}" (tipo: ${typeof rawDato2})`);
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: CLEAN indice_8 = "${cleanDato2}" (longitud: ${cleanDato2.length})`);
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: CÓDIGOS CARACTERES = [${cleanDato2.split('').map(c => c.charCodeAt(0)).join(', ')}]`);
          
          cy.log(`🔍 DEBUG ${datoFiltro.caso}: resultado final dato_1="${datoFiltro.dato_1}", dato_2="${datoFiltro.dato_2}"`);
        }

        datosFiltrados.push(datoFiltro);
      }
    }

    cy.log(`🔍 DEBUGGING COMPLETO - Encontrados ${datosFiltrados.length} casos para pantalla "${pantalla}"`);
    
    // Mostrar resumen de todos los casos encontrados
    datosFiltrados.forEach(dato => {
      if (dato.caso && dato.caso.toUpperCase().startsWith('TC')) {
        cy.log(`📋 RESUMEN ${dato.caso}: columna="${dato.dato_1}", valor="${dato.dato_2}" (longitud: ${dato.dato_2.length})`);
      }
    });
    
    return cy.wrap(datosFiltrados);
  });
});