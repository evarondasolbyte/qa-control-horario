export const LABELS_FECHA_ENTRADA = ['fecha entrada', 'fecha inicio', 'fecha'];
export const LABELS_FECHA_SALIDA = ['fecha salida', 'fecha fin'];
export const LABELS_HORA_ENTRADA = ['hora entrada', 'entrada', 'hora inicio'];
export const LABELS_HORA_SALIDA = ['hora salida', 'salida', 'hora fin'];
export const LABELS_MIN_ENTRADA = ['min entrada', 'minuto entrada', 'minutos entrada'];
export const LABELS_MIN_SALIDA = ['min salida', 'minuto salida', 'minutos salida'];
export const LABELS_ALERTA_ENTRADA = ['mensaje entrada', 'alerta entrada', 'mensaje registrar entrada', 'mensaje fichaje entrada'];
export const LABELS_ALERTA_SALIDA = ['mensaje salida', 'alerta salida', 'mensaje registrar salida', 'mensaje fichaje salida'];
export const ESPERA_SALIDA_MS = 10000;

export const CASOS_FICHAJE_RECARGAR = new Set([
  'TC007', 'TC008', 'TC009', 'TC010', 'TC011', 'TC012', 'TC013', 'TC014', 'TC015',
  'TC017', 'TC018', 'TC019', 'TC020', 'TC021', 'TC022', 'TC023', 'TC024', 'TC025',
  'TC026', 'TC027', 'TC028'
]);

export const CASOS_FICHAJE_TRABAJO = new Set(['TC024', 'TC025', 'TC026', 'TC027', 'TC030']);

export const CASOS_ALERTA_ACEPTAR = new Set([
  'TC008', 'TC009', 'TC010', 'TC015', 'TC019', 'TC020'
]);

export function obtenerDatoPorEtiqueta(casoExcel, etiquetaBuscada) {
  for (let i = 1; i <= 11; i += 1) {
    const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
    if (valorEtiqueta === etiquetaBuscada.toLowerCase().trim()) {
      return casoExcel[`dato_${i}`] || '';
    }
  }
  return '';
}

export function generarTextoAleatorio(longitud = 20) {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let resultado = '';
  for (let i = 0; i < longitud; i += 1) {
    const idx = Math.floor(Math.random() * caracteres.length);
    resultado += caracteres.charAt(idx);
  }
  return resultado;
}

export function horaStringToMinutes(valor) {
  if (!valor) return null;
  const [horas, minutos] = valor.split(':').map(Number);
  if ([horas, minutos].some(Number.isNaN)) return null;
  return horas * 60 + minutos;
}

export function compararHoras(horaA, horaB) {
  const minutosA = horaStringToMinutes(horaA);
  const minutosB = horaStringToMinutes(horaB);
  if (minutosA === null || minutosB === null) return 0;
  if (minutosA === minutosB) return 0;
  return minutosA > minutosB ? 1 : -1;
}

export function obtenerDatoPorEtiquetas(casoExcel, etiquetas = []) {
  for (const etiqueta of etiquetas) {
    const valor = obtenerDatoPorEtiqueta(casoExcel, etiqueta);
    if (valor) return valor;
  }
  return '';
}

export function pad2(valor) {
  if (valor === null || valor === undefined) return '';
  const str = String(valor).trim();
  if (!str) return '';
  if (!/^\d{1,2}$/.test(str)) return '';
  return str.padStart(2, '0');
}

export function desglosarHora(valor) {
  if (!valor) return { h: '', m: '', s: '' };
  const str = String(valor).trim();
  if (!str) return { h: '', m: '', s: '' };
  const normalizada = str.replace(/[hHmMsS]/g, ':').replace(/\s+/g, '');
  const partes = normalizada.split(':').filter((p) => p !== '');
  if (!partes.length) return { h: '', m: '', s: '' };

  const h = pad2(partes[0]);
  if (!h) return { h: '', m: '', s: '' };
  const m = pad2(partes[1] ?? '0') || '00';
  const s = pad2(partes[2] ?? '0') || '00';
  return { h, m, s };
}

export function normalizarHora({ base = '', hora = '', minuto = '', segundo = '', segundos = '' } = {}) {
  let { h, m, s } = desglosarHora(base);

  const horaNormalizada = pad2(hora);
  if (horaNormalizada) h = horaNormalizada;

  const minutoNormalizado = pad2(minuto);
  if (minutoNormalizado) m = minutoNormalizado;

  const segundoNormalizado = pad2(segundo || segundos);
  if (segundoNormalizado) s = segundoNormalizado;

  if (!h) return { time: '', segundos: '' };
  if (!m) m = '00';
  if (!s) s = '00';

  return { time: `${h}:${m}`, segundos: s };
}

export function esValorHoraPosible(valor) {
  if (valor === null || valor === undefined) return false;
  const str = String(valor).trim();
  if (!str) return false;
  if (/^\d{1,2}(:\d{2}){1,2}$/.test(str)) return true;
  if (/^\d{1,2}$/.test(str)) return true;
  if (/^\d{1,2}h\d{0,2}$/i.test(str)) return true;
  return false;
}

export function esEtiquetaHoraEntradaGenerica(etiqueta) {
  const val = (etiqueta || '').toLowerCase();
  if (!val || val.includes('fecha')) return false;

  return (
    val.includes('hora_entrada') ||
    (val.includes('entrada') && val.includes('hora')) ||
    val.includes('entry-start') ||
    (val.includes('entrada') && /\d/.test(val)) ||
    val.includes('reentrada')
  );
}

export function esEtiquetaHoraSalidaGenerica(etiqueta) {
  const val = (etiqueta || '').toLowerCase();
  if (!val || val.includes('fecha')) return false;

  return (
    val.includes('hora_salida') ||
    (val.includes('salida') && val.includes('hora')) ||
    val.includes('entry-end') ||
    val.includes('exit') ||
    (val.includes('salida') && /\d/.test(val))
  );
}

export function normalizarMensajesEsperados(mensaje) {
  if (!mensaje) return [];

  const convertir = (valor) =>
    String(valor || '')
      .split(/\r?\n+/)
      .flatMap((fragmento) => fragmento.split(/[\|;]+/))
      .map((fragmento) => fragmento.trim())
      .filter(Boolean);

  if (Array.isArray(mensaje)) {
    return mensaje.flatMap(convertir);
  }

  return convertir(mensaje);
}

export function normalizarFecha(valor) {
  if (!valor) return '';
  const str = String(valor).trim();
  if (!str) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  const matchDMY = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (matchDMY) {
    let [, dia, mes, ano] = matchDMY;
    if (ano.length === 2) {
      ano = parseInt(ano, 10) > 50 ? `19${ano}` : `20${ano}`;
    }
    return `${ano.padStart(4, '0')}-${pad2(mes)}-${pad2(dia)}`;
  }

  const matchYMD = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (matchYMD) {
    const [, ano, mes, dia] = matchYMD;
    return `${ano}-${pad2(mes)}-${pad2(dia)}`;
  }

  const fecha = new Date(str);
  if (!Number.isNaN(fecha.getTime())) {
    return fecha.toISOString().slice(0, 10);
  }

  return str;
}

export function sumarDiasISO(fechaISO, dias) {
  if (!fechaISO) return '';
  const partes = fechaISO.split('-').map(Number);
  if (partes.length !== 3 || partes.some((n) => Number.isNaN(n))) return fechaISO;
  const [year, month, day] = partes;
  const fecha = new Date(Date.UTC(year, month - 1, day));
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

export function prepararDatosFichaje(casoExcel, casoId) {
  const entradas = [];
  const salidas = [];
  const casoCruceDia = String(casoId || '').toUpperCase() === 'TC010';
  const hoyISO = new Date().toISOString().slice(0, 10);

  const fechaEntradaPreferente =
    normalizarFecha(obtenerDatoPorEtiquetas(casoExcel, LABELS_FECHA_ENTRADA)) ||
    normalizarFecha(casoExcel.dato_3);

  let fechaEntradaActual = fechaEntradaPreferente || hoyISO;
  let fechaEntradaExplicita = Boolean(fechaEntradaPreferente);

  const fechaSalidaPreferente =
    normalizarFecha(obtenerDatoPorEtiquetas(casoExcel, LABELS_FECHA_SALIDA)) ||
    normalizarFecha(casoExcel.dato_4);

  let fechaSalidaActual = fechaSalidaPreferente || fechaEntradaActual;
  let fechaSalidaExplicita = Boolean(fechaSalidaPreferente);

  for (let i = 1; i <= 11; i += 1) {
    const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
    if (!valorEtiqueta) continue;

    const dato = casoExcel[`dato_${i}`];
    if (dato === undefined || dato === null || dato === '') continue;

    if (valorEtiqueta.includes('fecha_entrada')) {
      const normalizada = normalizarFecha(dato);
      if (normalizada) {
        fechaEntradaActual = normalizada;
        fechaEntradaExplicita = true;
      } else {
        fechaEntradaActual = hoyISO;
        fechaEntradaExplicita = true;
      }
      if (String(casoId || '').toUpperCase() === 'TC023') {
        fechaEntradaActual = normalizarFecha('2025-11-29');
        fechaEntradaExplicita = true;
      }
      continue;
    }

    if (valorEtiqueta.includes('hora_entrada')) {
      const { time } = normalizarHora({ base: dato });
      if (time) {
        const fechaPaso = fechaEntradaActual || hoyISO;
        entradas.push({
          fecha: fechaPaso,
          hora: time,
          tocarFecha: fechaEntradaExplicita
        });
      }
      continue;
    }

    if (esEtiquetaHoraEntradaGenerica(valorEtiqueta) && esValorHoraPosible(dato)) {
      const { time } = normalizarHora({ base: dato });
      if (time) {
        const fechaPaso = fechaEntradaActual || hoyISO;
        entradas.push({
          fecha: fechaPaso,
          hora: time,
          tocarFecha: fechaEntradaExplicita
        });
      }
      continue;
    }

    if (valorEtiqueta.includes('fecha_salida')) {
      const normalizada = normalizarFecha(dato);
      if (normalizada) {
        fechaSalidaActual = normalizada;
        fechaSalidaExplicita = true;
      } else {
        fechaSalidaActual = fechaEntradaActual;
        fechaSalidaExplicita = true;
      }
      if (String(casoId || '').toUpperCase() === 'TC023') {
        fechaSalidaActual = normalizarFecha('2025-11-29');
        fechaSalidaExplicita = true;
      }
      continue;
    }

    if (valorEtiqueta.includes('hora_salida')) {
      const { time } = normalizarHora({ base: dato });
      if (time) {
        const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
        salidas.push({
          fecha: fechaPaso,
          hora: time,
          tocarFecha: fechaSalidaExplicita
        });
      }
      continue;
    }

    if (esEtiquetaHoraSalidaGenerica(valorEtiqueta) && esValorHoraPosible(dato)) {
      const { time } = normalizarHora({ base: dato });
      if (time) {
        const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
        salidas.push({
          fecha: fechaPaso,
          hora: time,
          tocarFecha: fechaSalidaExplicita
        });
      }
    }
  }

  const horaEntradaFallback = normalizarHora({
    base: obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_ENTRADA) || casoExcel.dato_1
  }).time;

  if (!entradas.length && horaEntradaFallback) {
    const fechaPaso = fechaEntradaActual || hoyISO;
    entradas.push({
      fecha: fechaPaso,
      hora: horaEntradaFallback,
      tocarFecha: fechaEntradaExplicita
    });
  }

  const horaSalidaFallback = normalizarHora({
    base: obtenerDatoPorEtiquetas(casoExcel, LABELS_HORA_SALIDA) || casoExcel.dato_2
  }).time;

  if (!salidas.length && horaSalidaFallback) {
    const fechaPaso = fechaSalidaActual || fechaEntradaActual || hoyISO;
    salidas.push({
      fecha: fechaPaso,
      hora: horaSalidaFallback,
      tocarFecha: fechaSalidaExplicita
    });
  }

  const secuencia = [];
  const totalPasos = Math.max(entradas.length, salidas.length);

  if (!totalPasos) {
    cy.log('No se encontraron instrucciones de entrada/salida en el Excel.');
    return { secuencia };
  }

  for (let i = 0; i < totalPasos; i += 1) {
    const entrada = entradas[i];
    if (entrada) {
      if (!entrada.fecha) entrada.fecha = fechaEntradaActual || hoyISO;

      secuencia.push({
        tipo: 'entrada',
        fecha: entrada.fecha,
        hora: entrada.hora,
        tocarFecha: Boolean(entrada.tocarFecha)
      });
    }

    const salida = salidas[i];
    if (salida) {
      if (!salida.fecha) salida.fecha = fechaSalidaActual || fechaEntradaActual || hoyISO;

      let fechaSalidaPaso =
        salida.fecha ||
        (entrada && entrada.fecha) ||
        fechaSalidaActual ||
        fechaEntradaActual ||
        hoyISO;

      let tocarFechaSalida =
        salida.fecha ? Boolean(salida.tocarFecha) : true;

      if (entrada && casoCruceDia) {
        fechaSalidaPaso = sumarDiasISO(entrada.fecha, 1);
        tocarFechaSalida = true;
      } else if (
        entrada &&
        entrada.fecha &&
        salida.hora &&
        compararHoras(salida.hora, entrada.hora) < 0 &&
        fechaSalidaPaso === entrada.fecha
      ) {
        fechaSalidaPaso = sumarDiasISO(entrada.fecha, 1);
        tocarFechaSalida = true;
      }

      secuencia.push({
        tipo: 'salida',
        fecha: fechaSalidaPaso,
        hora: salida.hora,
        tocarFecha: tocarFechaSalida
      });
    }
  }

  return { secuencia };
}

export function obtenerConfiguracionCasoFichaje(casoId) {
  const base = {
    accionAlertaEntrada: 'omitir',
    accionAlertaSalida: 'omitir',
    validarEntradaDuplicada: false,
    salidaSinEntrada: false,
    verificarEntradaNoRegistradaTrasCancelar: true
  };

  if (CASOS_FICHAJE_RECARGAR.has(casoId)) {
    base.accionAlertaEntrada = 'omitir';
    base.accionAlertaSalida = 'omitir';
    base.verificarEntradaNoRegistradaTrasCancelar = false;
  }

  if (CASOS_ALERTA_ACEPTAR.has(casoId)) {
    base.accionAlertaEntrada = 'aceptar';
    base.accionAlertaSalida = 'aceptar';
  }

  switch (casoId) {
    case 'TC014':
    case 'TC023':
      base.validarEntradaDuplicada = true;
      break;
    case 'TC022':
      base.salidaSinEntrada = true;
      break;
    default:
      break;
  }

  return base;
}