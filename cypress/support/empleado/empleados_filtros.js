export function createEmpleadosFiltrosActions(deps) {
  const {
    obtenerDatoEnTexto,
    obtenerDatoPorEtiqueta,
    obtenerValorEmpresa
  } = deps;

  function conLog(fn) {
    return (casoExcel) => {
      cy.log(`Ejecutando ${casoExcel.caso}: ${casoExcel.nombre}`);
      return fn(casoExcel);
    };
  }

  return {
    filtrarEmpresa: conLog((casoExcel) => {
      const casoId = String(casoExcel.caso || '').toUpperCase();
      const empresa = casoId === 'TC038' ? 'Demo1' : obtenerValorEmpresa(casoExcel);
      return cy.uiFiltrarPorSelectEnPanel(empresa, 'Empresa');
    }),
    filtrarDepartamento: conLog((casoExcel) => {
      const casoId = String(casoExcel.caso || '').toUpperCase();
      const depto = casoId === 'TC039'
        ? 'Departamento de Admin'
        : (obtenerDatoPorEtiqueta(casoExcel, 'mountedTableActionsData.0.name') || obtenerDatoEnTexto(casoExcel, 'Departamento') || 'Departamento SuperAdmin');
      return cy.uiFiltrarPorSelectEnPanel(depto, 'Departamento');
    }),
    filtrarGrupo: conLog((casoExcel) => {
      const casoId = String(casoExcel.caso || '').toUpperCase();
      const grupo = casoId === 'TC040' ? 'admin' : (obtenerDatoEnTexto(casoExcel, 'Grupo') || 'GrupoMiguel');
      return cy.uiFiltrarPorSelectEnPanel(grupo, 'Grupo');
    }),
    filtrarRol: conLog((casoExcel) => {
      const rol = obtenerDatoEnTexto(casoExcel, 'Rol') || 'Administrador';
      return cy.uiFiltrarPorSelectEnPanel(rol, 'Rol');
    })
  };
}
