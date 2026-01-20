// Suite de pruebas para Portal Empleado SuperAdmin
// Este archivo agrupa las pruebas de los siguientes módulos:
// - login
// - departamentos
// - empleados
// - empresas
// - grupos
// - jornada_semanal
// - jornadas_diarias
//
// Para ejecutar todas las pruebas del Portal Empleado SuperAdmin, usa uno de los siguientes métodos:
//
// 1. Usando el script run-simple.bat:
//    En PowerShell: .\run-simple.bat portalEmpleadoSuperAdmin [--prioridad alta|media|baja|todas]
//    En CMD: run-simple.bat portalEmpleadoSuperAdmin [--prioridad alta|media|baja|todas]
//
// 2. Usando Cypress directamente:
//    npx cypress run --spec "cypress/e2e/login.cy.js,cypress/e2e/departamentos.cy.js,cypress/e2e/empleados.cy.js,cypress/e2e/empresas.cy.js,cypress/e2e/grupos.cy.js,cypress/e2e/jornada_semanal.cy.js,cypress/e2e/jornadas_diarias.cy.js"
//
// 3. Ejecutando todos los archivos del portal empleado con un patrón:
//    npx cypress run --spec "cypress/e2e/{login,departamentos,empleados,empresas,grupos,jornada_semanal,jornadas_diarias}.cy.js"

describe('PORTAL EMPLEADO SUPERADMIN - Agrupación de suites de pruebas', () => {
  
  // Ignorar ciertos errores JS de la app que no deben romper la suite
  before(() => {
    Cypress.on('uncaught:exception', (err) => {
      if (
        err.message?.includes('Component already registered') ||
        err.message?.includes('Snapshot missing on Livewire component') ||
        err.message?.includes('Component already initialized')
      ) {
        return false;
      }
      return true;
    });
  });

  it('Información: Portal Empleado SuperAdmin agrupa las siguientes suites de pruebas', () => {
    const modulos = [
      '1. Login',
      '2. Departamentos',
      '3. Empleados',
      '4. Empresas',
      '5. Grupos',
      '6. Jornada Semanal',
      '7. Jornadas Diarias'
    ];
    
    cy.log('========================================');
    cy.log('PORTAL EMPLEADO SUPERADMIN - Módulos incluidos:');
    cy.log('========================================');
    modulos.forEach(modulo => cy.log(modulo));
    cy.log('========================================');
    cy.log('');
    cy.log('Para ejecutar todas las pruebas del Portal Empleado SuperAdmin:');
    cy.log('PowerShell: .\\run-simple.bat portalEmpleadoSuperAdmin [--prioridad nivel]');
    cy.log('CMD: run-simple.bat portalEmpleadoSuperAdmin [--prioridad nivel]');
    cy.log('');
  });

});