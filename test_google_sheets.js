// Cargo variables de entorno desde .env (ID del sheet, email de la service account, clave, rango, etc.)
require('dotenv').config();

// Uso la lib oficial de Google para obtener un token OAuth sin el SDK de googleapis de Sheets
const { GoogleAuth } = require('google-auth-library');

// Fetch compatible en Node (import dinámico de node-fetch si no existe global.fetch)
const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

(async () => {
  try {
    // 1) Me autentico con mi Service Account y pido un access token (Bearer) válido para Google Sheets
    const auth = new GoogleAuth({
      credentials: {
        // email de la service account que tengo en .env
        client_email: process.env.GS_CLIENT_EMAIL,
        // mi clave privada; sustituyo los \n literales por saltos reales para que Google la acepte
        private_key: (process.env.GS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      // scope mínimo para poder leer/escribir en Sheets
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    // Creo un cliente OAuth y obtengo el token de acceso
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    // Si por lo que sea no llega token, corto aquí para ver el error claramente
    if (!token) throw new Error('No se pudo obtener access token');

    // 2) Construyo la URL REST al endpoint de "append" de Google Sheets
    //    Codifico el rango (incluye nombre de pestaña) por si lleva espacios
    const encodedRange = encodeURIComponent(process.env.GS_RANGE || 'Resultados Pruebas!A:G');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GS_SPREADSHEET_ID}/values/${encodedRange}:append?valueInputOption=RAW`;

    // 3) Hago la petición POST con el Bearer en la cabecera y el body en JSON
    //    Aquí mando una fila de ejemplo: ["OK desde REST", "<fecha ISO>"]
    const body = { values: [['OK desde REST', new Date().toISOString()]] };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,     // <- token OAuth
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Si Google responde con error, leo el texto para diagnosticar y lanzo excepción
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }

    // Si va bien, muestro el rango afectado (Google lo devuelve en updates.updatedRange)
    const json = await res.json();
    console.log('Append OK:', json.updates?.updatedRange || json);
  } catch (e) {
    // Cualquier fallo (auth, permisos, rango inexistente...) cae aquí
    console.error('Error:', e.message || e);
    process.exit(1);
  }
})();
