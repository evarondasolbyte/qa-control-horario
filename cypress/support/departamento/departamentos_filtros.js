export function createDepartamentosFiltrosActions(deps) {
  const {
    obtenerValorEmpresa,
    filtrarEmpresaEnListado
  } = deps;

  function filtrarEmpresa(casoExcel) {
    cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
    const empresa = obtenerValorEmpresa(casoExcel) || 'Admin';
    return filtrarEmpresaEnListado(empresa);
  }

  return {
    filtrarEmpresa
  };
}
