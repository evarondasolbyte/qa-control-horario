// Test directo para verificar el guardado
require('dotenv').config();

console.log('Variables de entorno:');
console.log('RESULT_SINK:', process.env.RESULT_SINK);
console.log('GS_CLIENT_EMAIL:', process.env.GS_CLIENT_EMAIL ? 'Configurado' : 'No configurado');
console.log('GS_SPREADSHEET_ID:', process.env.GS_SPREADSHEET_ID ? 'Configurado' : 'No configurado');

// Simular el guardado directo
const { GoogleAuth } = require('google-auth-library');

(async () => {
  try {
    console.log('Iniciando test de guardado...');
    
    const auth = new GoogleAuth({
      credentials: {
        client_email: process.env.GS_CLIENT_EMAIL,
        private_key: (process.env.GS_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    
    if (!token) {
      throw new Error('No se pudo obtener access token');
    }

    console.log('Token obtenido correctamente');
    
    // Test de escritura
    const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
    
    const encodedRange = encodeURIComponent('Resultados Pruebas!A:G');
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GS_SPREADSHEET_ID}/values/${encodedRange}:append?valueInputOption=RAW`;
    
    const body = { values: [['Test Directo', new Date().toISOString(), 'OK']] };
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HTTP ${res.status}: ${txt}`);
    }
    
    const json = await res.json();
    console.log('✅ Guardado exitoso:', json.updates?.updatedRange || json);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
})();


