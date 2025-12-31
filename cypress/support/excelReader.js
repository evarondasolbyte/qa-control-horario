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

Cypress.Commands.add('leerDatosGoogleSheets', (pantalla) => {
  cy.log('🚀 NUEVO PARSER CSV - Intentando leer datos desde Google Sheets (CSV público)...');

  // IDs de tu documento
  const spreadsheetId = '1SrfWzbyPDnNsCd5AKrInQAvOG-wgUW9sWqH6Z7VPdXY';
  
  // Mapeo de gid por hoja/pantalla (según pestañas del Excel)
  const gidMap = {
    'datos': '0',                // Hoja Datos (primera hoja)
    'login': '1362476451',       // Hoja LOGIN
    'empresas': '1194727364',    // Hoja EMPRESAS
    'departamentos': '403068141',// Hoja DEPARTAMENTOS
    'jornadas diarias': '707566490', // Hoja JORNADAS DIARIAS
    'fichajes': '1887303307',    // Hoja FICHAJES
    'grupos': '761865168',       // Hoja GRUPOS
    'empleados': '1388297990',   // Hoja EMPLEADOS
    'roles': '975271079',        // Hoja ROLES
    'jornada semanal': '536828058', // Hoja JORNADA SEMANAL
    'admin': '1098026656',       // Hoja ADMIN (PruebasUsuarioAdmin)
    'pruebasusuarioadmin': '1098026656', // Hoja ADMIN (alias)
    'supervisor': '453149105',            // Hoja SUPERVISOR (PruebasUsuarioSupervisor) 
    'pruebasusuariosupervisor': '453149105' // Hoja SUPERVISOR 
  };
  
  const pantallaNormalizada = (pantalla || 'datos').toLowerCase();
  const gid = gidMap[pantallaNormalizada] || '0';
  const range = 'A:AK';
  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}&range=${encodeURIComponent(range)}`;

  cy.log(`🔍 Leyendo hoja ${pantalla} (gid=${gid}) desde: ${csvUrl}`);

  return cy.request({ method: 'GET', url: csvUrl, failOnStatusCode: false }).then((response) => {
    if (response.status === 200 && response.body) {
      let filasExcel = parseCsvRespectingQuotes(response.body);

      // Normalizar número de columnas (hasta AK => 37 columnas)
      const COLS = 37;
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

  return cy.leerDatosGoogleSheets(pantalla).then((filasExcel) => {
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
      const normalizadaFila = pantallaFila.replace(/s$/, '');
      const normalizadaSafe = pantallaSafe.replace(/s$/, '');
      const coincidePantalla =
        pantallaFila === pantallaSafe ||
        normalizadaFila === normalizadaSafe ||
        pantallaFila.includes(pantallaSafe) ||
        pantallaSafe.includes(pantallaFila);

      // Casos especiales para coincidencia
      const casosEspeciales = ['login', 'admin', 'pruebasusuarioadmin', 'supervisor', 'pruebasusuariosupervisor'];
      const esCasoEspecial = casosEspeciales.some(esp => 
        pantallaFila === esp || pantallaSafe === esp || 
        pantallaFila.includes(esp) || pantallaSafe.includes(esp)
      );

      if (coincidePantalla || esCasoEspecial) {
        const dato = {
          pantalla      : safe(fila[0]),
          funcionalidad : safe(fila[1]),
          caso          : safe(fila[2]),
          nombre        : safe(fila[3]),
          prioridad     : safe(fila[4]),
          funcion       : safe(fila[5])
        };

        // Procesar bloques etiqueta/valor/dato (hasta 11 bloques => columnas G..AK)
        for (let idx = 1; idx <= 11; idx++) {
          const base = 6 + (idx - 1) * 3;
          dato[`etiqueta_${idx}`]        = safe(fila[base]);
          dato[`valor_etiqueta_${idx}`]  = safe(fila[base + 1]);
          dato[`dato_${idx}`]            = safe(fila[base + 2]);
        }

        cy.log(`✅ ${dato.caso} - ${dato.nombre} | Función=${dato.funcion} | dato_1="${dato.dato_1}" | dato_2="${dato.dato_2}"`);
        datos.push(dato);
      }
    }

    cy.log(`🔎 Encontrados ${datos.length} casos para pantalla "${pantalla}"`);
    return cy.wrap(datos);
  });
});