@echo off
setlocal enabledelayedexpansion

REM ============================================================
REM Ejecuta Cypress con sistema de prioridades + alias por pantalla
REM Uso:
REM   run-simple.bat [categoria] [subcategoria OPCIONAL] [--prioridad alta|media|baja|todas]
REM   (o solo con alias: run-simple.bat login --prioridad alta)
REM ============================================================

REM --------- Parseo de argumentos (robusto) ----------

REM Inicializo las variables:
REM - CATEGORIA → primer argumento (ej: login, dashboard, etc.)
REM - SUBCAT → segundo argumento (ej: usuarios, configuracion, etc.)
REM - PRIORIDAD → valor por defecto = "todas"
REM - EXPECT_PRIO_VALUE → bandera que me indica que el siguiente argumento es la prioridad
set "CATEGORIA="
set "SUBCAT="
set "PRIORIDAD=todas"
set "EXPECT_PRIO_VALUE="

REM Recorro todos los argumentos que recibe el .bat (%* = todos los parámetros)
for %%A in (%*) do (
  
  REM Si la bandera EXPECT_PRIO_VALUE está activa,
  REM este argumento actual (%%A) es el valor de la prioridad (alta, media, baja)
  if defined EXPECT_PRIO_VALUE (
    set "PRIORIDAD=%%~A"
    set "EXPECT_PRIO_VALUE="
  
  ) else (
    REM Si el argumento actual es "--prioridad", activo la bandera
    if /I "%%~A"=="--prioridad" (
      set "EXPECT_PRIO_VALUE=1"
    
    ) else (
      REM Si aún no he guardado categoría, lo guardo aquí
      if not defined CATEGORIA (
        set "CATEGORIA=%%~A"
      
      REM Si ya tengo categoría pero no subcategoría, guardo aquí
      ) else if not defined SUBCAT (
        set "SUBCAT=%%~A"
      )
    )
  )
)

REM ============================================================
REM =====================  ALIAS  ==============================
REM Puedes llamar por alias directo (ej: "login") o "autenticacion login"
REM ============================================================

REM ---- AUTENTICACION
if /I "%CATEGORIA%"=="login" (
  set "CATEGORIA=autenticacion"
  set "SUBCAT=login"
) else if /I "%CATEGORIA%"=="logout" (
  set "CATEGORIA=autenticacion"
  set "SUBCAT=logout"
)

REM ---- DASHBOARD
if /I "%CATEGORIA%"=="dashboard" (
  set "CATEGORIA=dashboard"
  set "SUBCAT=principal"
) else if /I "%CATEGORIA%"=="inicio" (
  set "CATEGORIA=dashboard"
  set "SUBCAT=principal"
)

REM ---- CONFIGURACION
if /I "%CATEGORIA%"=="usuarios" (
  set "CATEGORIA=configuracion"
  set "SUBCAT=usuarios"
) else if /I "%CATEGORIA%"=="perfiles" (
  set "CATEGORIA=configuracion"
  set "SUBCAT=perfiles"
) else if /I "%CATEGORIA%"=="empresas" (
  set "CATEGORIA=configuracion"
  set "SUBCAT=empresas"
)

REM ---- CONTROL HORARIO
if /I "%CATEGORIA%"=="horarios" (
  set "CATEGORIA=controlHorario"
  set "SUBCAT=horarios"
) else if /I "%CATEGORIA%"=="asistencias" (
  set "CATEGORIA=controlHorario"
  set "SUBCAT=asistencias"
) else if /I "%CATEGORIA%"=="incidencias" (
  set "CATEGORIA=controlHorario"
  set "SUBCAT=incidencias"
) else if /I "%CATEGORIA%"=="vacaciones" (
  set "CATEGORIA=controlHorario"
  set "SUBCAT=vacaciones"
)

REM ---- REPORTES
if /I "%CATEGORIA%"=="reportes" (
  set "CATEGORIA=reportes"
  set "SUBCAT=generales"
) else if /I "%CATEGORIA%"=="estadisticas" (
  set "CATEGORIA=reportes"
  set "SUBCAT=estadisticas"
)

REM ---- PORTAL EMPLEADO SUPERADMIN
if /I "%CATEGORIA%"=="portalEmpleadoSuperAdmin" (
  set "CATEGORIA=portalEmpleadoSuperAdmin"
  set "SUBCAT="
)

REM ============================================================
REM Normalizar prioridad y exportar a Cypress
set "PRIORIDAD_LC=%PRIORIDAD%"
for %%A in (ALTA,alta) do if /I "%PRIORIDAD%"=="%%A" set "PRIORIDAD_LC=alta"
for %%A in (MEDIA,media) do if /I "%PRIORIDAD%"=="%%A" set "PRIORIDAD_LC=media"
for %%A in (BAJA,baja)  do if /I "%PRIORIDAD%"=="%%A" set "PRIORIDAD_LC=baja"
for %%A in (TODAS,todas) do if /I "%PRIORIDAD%"=="%%A" set "PRIORIDAD_LC=todas"
set "CYPRESS_prioridad=%PRIORIDAD_LC%"

REM ============================================================
REM Resolver patrón (exacto a tus ficheros)
set "SPEC_PATTERN="

if /I "%CATEGORIA%"=="autenticacion" (
  if /I "%SUBCAT%"=="login"  set "SPEC_PATTERN=cypress/e2e/login.cy.js"
  if /I "%SUBCAT%"=="logout" set "SPEC_PATTERN=cypress/e2e/logout.cy.js"
  if not defined SUBCAT set "SPEC_PATTERN=cypress/e2e/login.cy.js"
)

if /I "%CATEGORIA%"=="dashboard" (
  if /I "%SUBCAT%"=="principal" set "SPEC_PATTERN=cypress/e2e/dashboard.cy.js"
  if not defined SUBCAT set "SPEC_PATTERN=cypress/e2e/dashboard.cy.js"
)

if /I "%CATEGORIA%"=="configuracion" (
  if /I "%SUBCAT%"=="usuarios"  set "SPEC_PATTERN=cypress/e2e/configuracion_usuarios.cy.js"
  if /I "%SUBCAT%"=="perfiles"  set "SPEC_PATTERN=cypress/e2e/configuracion_perfiles.cy.js"
  if /I "%SUBCAT%"=="empresas"  set "SPEC_PATTERN=cypress/e2e/configuracion_empresas.cy.js"
  if not defined SUBCAT set "SPEC_PATTERN=cypress/e2e/configuracion_*.cy.js"
)

if /I "%CATEGORIA%"=="controlHorario" (
  if /I "%SUBCAT%"=="horarios"     set "SPEC_PATTERN=cypress/e2e/controlHorario_horarios.cy.js"
  if /I "%SUBCAT%"=="asistencias"  set "SPEC_PATTERN=cypress/e2e/controlHorario_asistencias.cy.js"
  if /I "%SUBCAT%"=="incidencias"  set "SPEC_PATTERN=cypress/e2e/controlHorario_incidencias.cy.js"
  if /I "%SUBCAT%"=="vacaciones"   set "SPEC_PATTERN=cypress/e2e/controlHorario_vacaciones.cy.js"
  if not defined SUBCAT set "SPEC_PATTERN=cypress/e2e/controlHorario_*.cy.js"
)

if /I "%CATEGORIA%"=="reportes" (
  if /I "%SUBCAT%"=="generales"    set "SPEC_PATTERN=cypress/e2e/reportes_generales.cy.js"
  if /I "%SUBCAT%"=="estadisticas" set "SPEC_PATTERN=cypress/e2e/reportes_estadisticas.cy.js"
  if not defined SUBCAT set "SPEC_PATTERN=cypress/e2e/reportes_*.cy.js"
)

if /I "%CATEGORIA%"=="portalEmpleadoSuperAdmin" (
  set "SPEC_PATTERN=cypress/e2e/login.cy.js,cypress/e2e/departamentos.cy.js,cypress/e2e/empleados.cy.js,cypress/e2e/empresas.cy.js,cypress/e2e/grupos.cy.js,cypress/e2e/jornada_semanal.cy.js,cypress/e2e/jornadas_diarias.cy.js"
)

REM Si NO hay categoria (pero sí prioridad), ejecuta TODO
if "%CATEGORIA%"=="" (
  set "SPEC_PATTERN=cypress/e2e/**/*.cy.js"
)

REM Si sigue sin patrón, mostrar ayuda
if not defined SPEC_PATTERN (
  echo.
  echo ========================================
  echo    SISTEMA DE PRIORIDADES CYPRESS
  echo    CONTROL HORARIO - NOVATRANS
  echo ========================================
  echo.
  echo Uso: run-simple.bat [categoria] [subcategoria] [--prioridad nivel]
  echo.
  echo Categorias disponibles:
  echo   login                    - Pruebas de autenticacion
  echo   dashboard                - Pruebas del panel principal
  echo   configuracion           - Pruebas de configuracion
  echo   controlHorario          - Pruebas de control horario
  echo   reportes                - Pruebas de reportes
  echo   portalEmpleadoSuperAdmin - Todas las pruebas del Portal Empleado SuperAdmin
  echo.
  echo Ejemplos:
  echo   run-simple.bat login --prioridad alta
  echo   run-simple.bat autenticacion login --prioridad alta
  echo   run-simple.bat configuracion usuarios --prioridad media
  echo   run-simple.bat controlHorario horarios --prioridad alta
  echo   run-simple.bat portalEmpleadoSuperAdmin --prioridad alta
  echo   run-simple.bat --prioridad alta
  echo.
  goto :eof
)

echo.
echo ========================================
echo    EJECUTANDO PRUEBAS CYPRESS
echo    CONTROL HORARIO - NOVATRANS
echo ========================================
if defined CATEGORIA echo Categoria   : %CATEGORIA%
if defined SUBCAT    echo Subcategoria: %SUBCAT%
echo Prioridad   : %PRIORIDAD_LC%
echo Pattern     : %SPEC_PATTERN%
echo ========================================
echo.

npx cypress run --spec "%SPEC_PATTERN%" --env prioridad=%PRIORIDAD_LC%

echo.
echo ========================================
echo    PRUEBAS COMPLETADAS
echo ========================================
echo.
endlocal

