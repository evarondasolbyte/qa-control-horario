require('dotenv').config();

console.log('Variables de entorno cargadas:');
console.log('GS_CLIENT_EMAIL:', process.env.GS_CLIENT_EMAIL);
console.log('GS_SPREADSHEET_ID:', process.env.GS_SPREADSHEET_ID);
console.log('GS_RANGE:', process.env.GS_RANGE);
console.log('GS_PRIVATE_KEY existe:', !!process.env.GS_PRIVATE_KEY);
console.log('RESULT_SINK:', process.env.RESULT_SINK);

