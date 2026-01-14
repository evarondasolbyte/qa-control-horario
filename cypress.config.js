// CARGO VARIABLES DE ENTORNO DESDE .env
// Motivo: no quiero hardcodear secretos (private key de la SA, spreadsheet ID, etc.)
// En CI uso variables de entorno del runner (GitHub Actions, GitLab, Azure DevOps...).
require('dotenv').config();

const { defineConfig } = require('cypress');
const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// ==== GOOGLE SHEETS POR REST CON SERVICE ACCOUNT ====
// Uso GoogleAuth para obtener un Bearer token (OAuth2) a partir de credenciales de Service Account.
// Ventaja: no necesito cliente oficial de Sheets (googleapis); la llamada es 100% REST.
const { GoogleAuth } = require('google-auth-library');

// fetchCompat(hacer peticiones HTTP): usa fetch nativo si está disponible; si no, hace import dinámico de node-fetch.
// Así evito añadir node-fetch si el runtime ya trae fetch (Node 18+ lo trae).
const fetchCompat = (...args) =>
  (global.fetch ? global.fetch(...args) : import('node-fetch').then(({ default: f }) => f(...args)));

module.exports = defineConfig({
  e2e: {
    // URL base de la app que estoy probando (Control Horario). Evito repetir en los tests.
    baseUrl: 'https://horario.dev.novatrans.app/panelinterno',

    // Ignorar errores de JavaScript de la aplicación globalmente
    setupNodeEvents(on, config) {
      // Pasar variables de entorno del .env a Cypress.env()
      config.env.SUPERVISOR_EMAIL = process.env.SUPERVISOR_EMAIL || config.env.SUPERVISOR_EMAIL;
      config.env.SUPERVISOR_PASSWORD = process.env.SUPERVISOR_PASSWORD || config.env.SUPERVISOR_PASSWORD;
      config.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || config.env.ADMIN_EMAIL;
      config.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || config.env.ADMIN_PASSWORD;
      config.env.SUPERADMIN_EMAIL = process.env.SUPERADMIN_EMAIL || config.env.SUPERADMIN_EMAIL;
      config.env.SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || config.env.SUPERADMIN_PASSWORD;
      
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome') {
          launchOptions.args.push('--disable-web-security');
          launchOptions.args.push('--disable-features=VizDisplayCompositor');
        }
        return launchOptions;
      });
      // Carpeta local para reportes Excel cuando RESULT_SINK=excel (fallback o offline).
      // Importante en local: aseguro que la ruta exista para no fallar al escribir.
      const carpetaResultados = path.resolve(__dirname, 'cypress/resultados');
      if (!fs.existsSync(carpetaResultados)) fs.mkdirSync(carpetaResultados, { recursive: true });

      on('task', {
        /**
         * guardarEnExcel
         * - Registra cada test (fila granular) en Google Sheets o Excel local.
         * - Se selecciona el "sink" por variable de entorno RESULT_SINK:
         *    - 'sheets' => escribe vía REST en Google Sheets (hoja "Log")
         *    - 'excel'  => escribe en cypress/resultados/reportes_pruebas_control_horario.xlsx
         *
         * Campos esperados:
         *   numero: ID del caso (TCxxx)
         *   nombre: nombre descriptivo del caso
         *   esperado / obtenido: textos de comparación
         *   resultado: 'OK' o 'ERROR'
         *   fechaHora: opcional (si no viene, pongo timestamp ISO friendly)
         *   archivo: permite elegir nombre de Excel local (opcional)
         *   pantalla: módulo/pantalla a la que pertenece el caso
         *   observacion: notas adicionales (stacktrace resumido, causa, etc.)
         *   ok/warning/error: solo para "Resultados Pruebas"
         */
        async guardarEnExcel({ numero, nombre, esperado, obtenido, resultado, fechaHora, archivo, pantalla, observacion, ok, warning, error }) {
          // Default a sheets para usar Google Sheets
          const sink = process.env.RESULT_SINK || 'sheets';

          // ============== SINK: GOOGLE SHEETS ==============
          // Verificar si hay credenciales de Google Sheets válidas antes de intentar usarlas
          const hasValidCredentials = process.env.GS_CLIENT_EMAIL && 
                                     process.env.GS_PRIVATE_KEY &&
                                     !process.env.GS_CLIENT_EMAIL.includes('tu_service_account') &&
                                     !process.env.GS_PRIVATE_KEY.includes('tu_private_key');
          
          if (sink === 'sheets' && hasValidCredentials) {
            try {
            // 1) Autenticación OAuth2 con Service Account
            const auth = new GoogleAuth({
              credentials: {
                client_email: process.env.GS_CLIENT_EMAIL,
                private_key: (process.env.GS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
              },
              scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const client = await auth.getClient();
            const { token } = await client.getAccessToken();
            if (!token) throw new Error('No se pudo obtener access token');

            // Helper: escribe en la siguiente fila REAL (debajo del último registro)
            const appendExactRow = async ({ sheetName, endColLetter, rowValues }) => {
              // Leo la columna A para contar filas reales (incluye cabecera si existe)
              const getUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GS_SPREADSHEET_ID}/values/` +
                `${encodeURIComponent(`${sheetName}!A:A`)}?majorDimension=COLUMNS`;
              const getRes = await fetchCompat(getUrl, { headers: { Authorization: `Bearer ${token}` } });
              const getJson = await getRes.json();
              const colA = (getJson.values && getJson.values[0]) ? getJson.values[0] : [];
              const currentRows = colA.length;       // nº de filas actualmente ocupadas en A
              const nextRow = currentRows + 1;       // siguiente fila exacta

              // PUT en el rango exacto (RAW)
              const range = `${sheetName}!A${nextRow}:${endColLetter}${nextRow}`;
              const putUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GS_SPREADSHEET_ID}/values/` +
                `${encodeURIComponent(range)}?valueInputOption=RAW`;
              const putRes = await fetchCompat(putUrl, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: [rowValues] }),
              });
              const putTxt = await putRes.text();
              if (!putRes.ok) throw new Error(`Sheets REST error (update ${range}): ${putRes.status} ${putTxt}`);
            };

            // 2) Construir fila y escribir en hoja exacta
            if (pantalla === 'Resultados Pruebas') {
              // Formato especial Resumen
              const row = [
                numero ?? '',                                                   // A: Test-ID
                (fechaHora || new Date().toISOString().replace('T', ' ').substring(0, 19)), // B: Fecha y Hora
                esperado ?? '',                                                 // C: Test
                obtenido ?? '',                                                 // D: Nombre
                resultado ?? '',                                                // E: Resultado
                (ok ?? '').toString(),                                          // F: OK
                (warning ?? '').toString(),                                     // G: WARNING
                (error ?? '').toString(),                                       // H: ERROR
              ];
              await appendExactRow({ sheetName: 'Resultados Pruebas', endColLetter: 'H', rowValues: row });
            } else {
              // Formato estándar para "Log"
              const row = [
                numero ?? '',                                                   // A: Nº
                nombre ?? '',                                                   // B: Nombre
                esperado ?? '',                                                 // C: Resultado Esperado
                obtenido ?? '',                                                 // D: Resultado Obtenido
                resultado ?? '',                                                // E: Resultado
                (fechaHora || new Date().toISOString().replace('T', ' ').substring(0, 19)), // F: Fecha y Hora
                pantalla || '',                                                 // G: Test (pantalla)
                observacion || ''                                               // H: Observaciones
              ];
              await appendExactRow({ sheetName: 'Log', endColLetter: 'H', rowValues: row });
            }
            return 'OK';
            } catch (error) {
              console.error('❌ Error al guardar en Google Sheets:', error.message);
              console.log('⚠️ Fallando a Excel local...');
              // Continuar al código de Excel local más abajo
            }
          }
          
          // Si no hay credenciales válidas o falló Google Sheets, usar Excel local
          if (sink === 'sheets' && !hasValidCredentials) {
            console.log('⚠️ Credenciales de Google Sheets no configuradas o inválidas. Usando Excel local...');
          }

          // ============== SINK: EXCEL LOCAL ==============
          // Nombre de archivo por defecto (permite override con 'archivo').
          const nombreArchivo = archivo || 'reportes_pruebas_control_horario.xlsx';
          const rutaExcel = path.join(carpetaResultados, nombreArchivo);

          let workbook, worksheet;
          if (fs.existsSync(rutaExcel)) {
            workbook = xlsx.readFile(rutaExcel);
          } else {
            workbook = xlsx.utils.book_new();
          }

          // Determinar qué hoja usar basado en el parámetro 'pantalla'
          if (pantalla === 'Resultados Pruebas') {
            console.log(`Guardando en "Resultados Pruebas": numero=${numero}, nombre=${nombre}, esperado=${esperado}, obtenido=${obtenido}, resultado=${resultado}, ok=${ok}, warning=${warning}, error=${error}`);
            
            if (workbook.SheetNames.includes('Resultados Pruebas')) {
              worksheet = workbook.Sheets['Resultados Pruebas'];
            } else {
              worksheet = xlsx.utils.aoa_to_sheet([[
                'Test-ID', 'Fecha y Hora', 'Test', 'Nombre', 'Resultado', 'OK', 'WARNING', 'ERROR'
              ]]);
              xlsx.utils.book_append_sheet(workbook, worksheet, 'Resultados Pruebas');
            }
            
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            data.push([numero, fechaHora || new Date().toISOString().replace('T', ' ').substring(0, 19), esperado, obtenido, resultado, ok || '', warning || '', error || '']);
            const nuevaHoja = xlsx.utils.aoa_to_sheet(data);
            workbook.Sheets['Resultados Pruebas'] = nuevaHoja;
          } else {
            if (workbook.SheetNames.includes('Log')) {
              worksheet = workbook.Sheets['Log'];
            } else {
              worksheet = xlsx.utils.aoa_to_sheet([[
                'Nº', 'Nombre', 'Resultado Esperado', 'Resultado Obtenido', 'Resultado', 'Fecha y Hora', 'Test', 'Observaciones'
              ]]);
              xlsx.utils.book_append_sheet(workbook, worksheet, 'Log');
            }
            
            const fechaHoraFinal = fechaHora || new Date().toISOString().replace('T', ' ').substring(0, 19);
            const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
            data.push([numero, nombre, esperado, obtenido, resultado, fechaHoraFinal, pantalla || '', observacion || '']);
            const nuevaHoja = xlsx.utils.aoa_to_sheet(data);
            workbook.Sheets['Log'] = nuevaHoja;
          }

          xlsx.writeFile(workbook, rutaExcel);
          return 'OK';
        },

        /**
         * guardarEnLog
         * - Inserta un registro individual en la hoja "Log" con el formato correcto.
         * - En Sheets escribe en el nuevo Google Sheets separado para Log (A:I).
         * - En Excel local crea/usa una hoja llamada "Log".
         *
         * Campos:
         *   testId: ID único del test
         *   test: nombre de la pantalla
         *   paso: número del paso (TC001, TC002, etc.)
         *   fechaHora: fecha y hora de ejecución
         *   resultado: OK/ERROR/WARNING
         *   nombre: nombre del test
         *   esperado: resultado esperado
         *   obtenido: resultado obtenido
         *   observacion: observaciones
         */
        async guardarEnLog({ testId, test, paso, fechaHora, resultado, nombre, esperado, obtenido, observacion }) {
          const sink = process.env.RESULT_SINK || 'sheets';

          // ============== SINK: GOOGLE SHEETS ==============
          // Verificar si hay credenciales de Google Sheets válidas antes de intentar usarlas
          const hasValidCredentials = process.env.GS_CLIENT_EMAIL && 
                                     process.env.GS_PRIVATE_KEY &&
                                     !process.env.GS_CLIENT_EMAIL.includes('tu_service_account') &&
                                     !process.env.GS_PRIVATE_KEY.includes('tu_private_key');
          
          if (sink === 'sheets' && hasValidCredentials) {
            try {
            const auth = new GoogleAuth({
              credentials: {
                client_email: process.env.GS_CLIENT_EMAIL,
                private_key: (process.env.GS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
              },
              scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            const client = await auth.getClient();
            const { token } = await client.getAccessToken();
            if (!token) throw new Error('No se pudo obtener access token');

            // Helper común: escribe en la fila exacta debajo del último registro
            const appendExactRow = async ({ sheetName, endColLetter, rowValues, spreadsheetId }) => {
              const getUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
                `${encodeURIComponent(`${sheetName}!A:A`)}?majorDimension=COLUMNS`;
              const getRes = await fetchCompat(getUrl, { headers: { Authorization: `Bearer ${token}` } });
              const getJson = await getRes.json();
              const colA = (getJson.values && getJson.values[0]) ? getJson.values[0] : [];
              const currentRows = colA.length;
              const nextRow = currentRows + 1;

              const range = `${sheetName}!A${nextRow}:${endColLetter}${nextRow}`;
              const putUrl =
                `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/` +
                `${encodeURIComponent(range)}?valueInputOption=RAW`;
              const putRes = await fetchCompat(putUrl, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values: [rowValues] }),
              });
              const putTxt = await putRes.text();
              if (!putRes.ok) throw new Error(`Sheets REST error (update ${range}): ${putRes.status} ${putTxt}`);
            };

            // A: Test-ID, B: Test, C: Paso, D: Fecha y Hora, E: Resultado, F: Nombre, G: Esperado, H: Obtenido, I: Observaciones
            const row = [
              testId ?? '',
              test ?? '',
              paso ?? '',
              fechaHora ?? '',
              resultado ?? '',
              nombre ?? '',
              esperado ?? '',
              obtenido ?? '',
              observacion ?? ''
            ];

            // Usar el nuevo Google Sheets ID para el Log de Control Horario
            const logSpreadsheetId = '1cX-c_CHSpCqNVtY8tWWCyP_h2Q-Nrn6I5Xd4hcKcbHo';
            await appendExactRow({ sheetName: 'Log', endColLetter: 'I', rowValues: row, spreadsheetId: logSpreadsheetId });
            return 'OK';
            } catch (error) {
              console.error('❌ Error al guardar en Google Sheets:', error.message);
              console.log('⚠️ Fallando a Excel local...');
              // Continuar al código de Excel local más abajo
            }
          }
          
          // Si no hay credenciales válidas o falló Google Sheets, usar Excel local
          if (sink === 'sheets' && !hasValidCredentials) {
            console.log('⚠️ Credenciales de Google Sheets no configuradas o inválidas. Usando Excel local...');
          }

          // ============== SINK: EXCEL LOCAL ==============
          const nombreArchivo = 'reportes_pruebas_control_horario.xlsx';
          const rutaExcel = path.join(carpetaResultados, nombreArchivo);

          let workbook, worksheet;
          if (fs.existsSync(rutaExcel)) {
            workbook = xlsx.readFile(rutaExcel);
            if (workbook.SheetNames.includes('Log')) {
              worksheet = workbook.Sheets['Log'];
            } else {
              worksheet = xlsx.utils.aoa_to_sheet([[
                'Test-ID', 'Test', 'Paso', 'Fecha y Hora', 'Resultado', 'Nombre', 'Resultado Esperado', 'Resultado Obtenido', 'Observaciones'
              ]]);
              xlsx.utils.book_append_sheet(workbook, worksheet, 'Log');
            }
          } else {
            workbook = xlsx.utils.book_new();
            worksheet = xlsx.utils.aoa_to_sheet([[
              'Test-ID', 'Test', 'Paso', 'Fecha y Hora', 'Resultado', 'Nombre', 'Resultado Esperado', 'Resultado Obtenido', 'Observaciones'
            ]]);
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Log');
          }

          const data = xlsx.utils.sheet_to_json(worksheet, { header: 1 });
          data.push([testId, test, paso, fechaHora, resultado, nombre, esperado, obtenido, observacion]);
          const nuevaHoja = xlsx.utils.aoa_to_sheet(data);
          workbook.Sheets['Log'] = nuevaHoja;

          xlsx.writeFile(workbook, rutaExcel);
          return 'OK';
        },

      });
      
      // Devolver config para que las variables de entorno se apliquen
      return config;
    },
  },
});
