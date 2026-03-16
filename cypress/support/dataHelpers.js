export function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
  if (!etiquetaBuscada) return '';

  const total = Object.keys(casoExcel || {}).reduce((max, key) => {
    const match = /^valor_etiqueta_(\d+)$/.exec(key);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 11);

  for (let i = 1; i <= total; i += 1) {
    const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
    if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
      return casoExcel[`dato_${i}`] || '';
    }
  }

  return '';
}

export function obtenerDatoEnTexto(casoExcel, claveBuscada) {
  if (!claveBuscada) return '';

  const total = Object.keys(casoExcel || {}).reduce((max, key) => {
    const match = /^dato_(\d+)$/.exec(key);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 11);

  for (let i = 1; i <= total; i += 1) {
    const dato = casoExcel[`dato_${i}`] || '';
    const partes = dato.split(/\n+/).map((t) => t.trim()).filter(Boolean);

    for (const parte of partes) {
      const [clave, ...resto] = parte.split(':');
      if (clave && resto.length && clave.trim().toLowerCase() === claveBuscada.toLowerCase()) {
        return resto.join(':').trim();
      }
    }
  }

  return '';
}

export function extraerDesdeNombre(nombreCaso, clave) {
  if (!nombreCaso || !clave) return '';

  const regex = new RegExp(`${clave}\\s*(.*)$`, 'i');
  const match = nombreCaso.match(regex);
  return match && match[1] ? match[1].trim() : '';
}

export function generarNombreUnico(prefijo = 'item') {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000);
  return `${prefijo}${timestamp}${random}`;
}

export function reemplazarConNumeroAleatorio(valor, numeroCaso) {
  if (!valor || typeof valor !== 'string') return valor;

  let resultado = valor;

  if (resultado.includes('XXX')) {
    const numerosAleatorios3 = Math.floor(100 + Math.random() * 900);
    resultado = resultado.replace(/XXX/g, numerosAleatorios3.toString());
  }

  if (numeroCaso === 17) {
    return resultado.replace(/1\+/g, '1');
  }

  const numeroAleatorio = Math.floor(Math.random() * 9000) + 1000;
  return resultado.replace(/1\+/g, numeroAleatorio.toString());
}

export function obtenerCamposDesdeExcel(casoExcel) {
  const campos = {};
  const total = Object.keys(casoExcel || {}).reduce((max, key) => {
    const match = /^valor_etiqueta_(\d+)$/.exec(key);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 12);

  for (let i = 1; i <= total; i += 1) {
    const clave = casoExcel[`valor_etiqueta_${i}`];
    const valor = casoExcel[`dato_${i}`];
    if (clave) campos[clave] = valor;
  }

  return campos;
}

export function registerDataHelpersGlobal() {
  Cypress.dataHelpers = {
    obtenerCamposDesdeExcel,
    obtenerDatoPorEtiqueta,
    obtenerDatoEnTexto,
    extraerDesdeNombre,
    generarNombreUnico,
    reemplazarConNumeroAleatorio
  };
}
