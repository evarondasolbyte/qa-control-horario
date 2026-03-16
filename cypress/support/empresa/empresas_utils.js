import {
  obtenerDatoPorEtiqueta,
  reemplazarConNumeroAleatorio as reemplazarConNumeroAleatorioGlobal
} from '../dataHelpers';
import { irAListadoRecursoLimpio, verificarUrlRecurso } from '../resourceHelpers';

export function createEmpresasUtils(config) {
  const { EMPRESAS_URL_ABS, EMPRESAS_PATH, DASHBOARD_PATH } = config;

  function irAEmpresasLimpio() {
    return irAListadoRecursoLimpio({
      urlAbs: EMPRESAS_URL_ABS,
      path: EMPRESAS_PATH,
      dashboardPath: DASHBOARD_PATH,
      nombrePantalla: 'Empresas'
    });
  }

  function verificarUrlEmpresas() {
    return verificarUrlRecurso({
      urlAbs: EMPRESAS_URL_ABS,
      path: EMPRESAS_PATH
    });
  }

  function obtenerNumeroCaso(casoExcel) {
    return parseInt(String(casoExcel?.caso || '').replace('TC', ''), 10) || 0;
  }

  function obtenerDatoPorEtiquetaParcial(casoExcel, etiquetas = []) {
    const listaEtiquetas = Array.isArray(etiquetas) ? etiquetas : [etiquetas];
    if (!listaEtiquetas.length) return '';

    for (let i = 1; i <= 11; i += 1) {
      const etiqueta = (casoExcel[`etiqueta_${i}`] || '').toLowerCase().trim();
      const valorEtiqueta = (casoExcel[`valor_etiqueta_${i}`] || '').toLowerCase().trim();
      const dato = casoExcel[`dato_${i}`] || '';

      if (!dato) continue;

      const coincide = listaEtiquetas.some((item) => {
        const patron = String(item || '').toLowerCase().trim();
        return patron && (etiqueta.includes(patron) || valorEtiqueta.includes(patron));
      });

      if (coincide) return dato;
    }

    return '';
  }

  function obtenerDatoEmpresa(casoExcel, etiquetas = [], fallback = '') {
    const listaEtiquetas = Array.isArray(etiquetas) ? etiquetas : [etiquetas];

    for (const etiqueta of listaEtiquetas) {
      const valorExacto = obtenerDatoPorEtiqueta(casoExcel, etiqueta);
      if (String(valorExacto || '').trim()) return valorExacto;
    }

    const valorParcial = obtenerDatoPorEtiquetaParcial(casoExcel, listaEtiquetas);
    if (String(valorParcial || '').trim()) return valorParcial;

    return fallback || '';
  }

  function esVacioOMalo(valor) {
    const texto = String(valor ?? '').trim();
    return !texto || texto === '16' || texto === '1' || /^\d+$/.test(texto);
  }

  function esFecha(valor) {
    const texto = String(valor ?? '').trim();
    return /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(texto) || /^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(texto);
  }

  function normalizarFechaInput(valor) {
    const texto = String(valor ?? '').trim();
    if (!texto) return '';

    let match = texto.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (match) {
      const dia = match[1].padStart(2, '0');
      const mes = match[2].padStart(2, '0');
      const anio = match[3];
      return `${anio}-${mes}-${dia}`;
    }

    match = texto.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (match) {
      const anio = match[1];
      const mes = match[2].padStart(2, '0');
      const dia = match[3].padStart(2, '0');
      return `${anio}-${mes}-${dia}`;
    }

    return '';
  }

  return {
    EMPRESAS_PATH,
    irAEmpresasLimpio,
    verificarUrlEmpresas,
    obtenerDatoEmpresa,
    obtenerDatoPorEtiquetaParcial,
    obtenerNumeroCaso,
    esFecha,
    esVacioOMalo,
    normalizarFechaInput,
    reemplazarConNumeroAleatorio: reemplazarConNumeroAleatorioGlobal
  };
}