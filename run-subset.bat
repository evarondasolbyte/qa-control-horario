@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM Ejecuta un subconjunto específico de pruebas de Cypress
REM ============================================================

echo.
echo ========================================
echo    EJECUTANDO SUBSET DE PRUEBAS
echo    CONTROL HORARIO - NOVATRANS
echo ========================================
echo.

REM Construir la lista de archivos de pruebas separados por comas
set "SPEC_PATTERN=cypress/e2e/departamentos.cy.js,cypress/e2e/empleados.cy.js,cypress/e2e/empresas.cy.js,cypress/e2e/grupos.cy.js,cypress/e2e/jornada_semanal.cy.js,cypress/e2e/jornadas_diarias.cy.js,cypress/e2e/login.cy.js,cypress/e2e/portalEmpleadoSuperAdmin.cy.js,cypress/e2e/pruebasUsuarioSupervisor.cy.js"

echo Pruebas a ejecutar:
echo   - departamentos
echo   - empleados
echo   - empresas
echo   - grupos
echo   - jornada_semanal
echo   - jornadas_diarias
echo   - login
echo   - portalEmpleadoSuperAdmin
echo   - pruebasUsuarioSupervisor
echo.
echo Pattern: %SPEC_PATTERN%
echo ========================================
echo.

REM Ejecutar Cypress con el patrón de archivos
npx cypress run --spec "%SPEC_PATTERN%"

echo.
echo ========================================
echo    PRUEBAS COMPLETADAS
echo ========================================
echo.

endlocal

