# QA Control Horario

Proyecto de pruebas automatizadas para la aplicación Control Horario usando Cypress.

## 📁 Estructura del Proyecto

```
QA Control Horario/
├── cypress/
│   ├── e2e/                    # Tests de Cypress
│   │   └── login.cy.js         # Test de ejemplo
│   ├── fixtures/               # Datos de prueba
│   ├── results/                # Resultados de las pruebas
│   ├── screenshots/            # Capturas de pantalla
│   └── support/                # Comandos personalizados
│       ├── commands.js         # Comandos customizados
│       └── e2e.js             # Configuración de soporte
├── cypress.config.js          # Configuración principal de Cypress
├── cypress.env.json           # Variables de entorno
├── package.json               # Dependencias del proyecto
└── README.md                  # Este archivo
```

## 🚀 Instalación

1. **Instalar dependencias:**
   ```bash
   npm install
   ```

2. **Configurar variables de entorno:**
   - Crear archivo `.env` en la raíz del proyecto
   - Configurar las credenciales de Google Sheets (opcional)

## ⚙️ Configuración

### Variables de Entorno (.env)

```env
# Configuración para Google Sheets (opcional)
RESULT_SINK=sheets
GS_CLIENT_EMAIL=tu-service-account@proyecto.iam.gserviceaccount.com
GS_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nTU_PRIVATE_KEY_AQUI\n-----END PRIVATE KEY-----\n"
GS_SPREADSHEET_ID=11vSlu38nk_eUwNyHBwx6GZGrxe83-2_Kvceukmctszw
GS_LOG_SPREADSHEET_ID=1cX-c_CHSpCqNVtY8tWWCyP_h2Q-Nrn6I5Xd4hcKcbHo
```

### Configuración de la Aplicación

1. **URL Base:** Ya configurada en `cypress.config.js` → `https://horario.dev.novatrans.app/panelinterno`
2. **Credenciales:** Editar `cypress.env.json` con las credenciales reales
3. **Google Sheets:** Ya configurados los IDs para Control Horario

## 🧪 Ejecutar Pruebas

### Modo Interactivo (Cypress UI)
```bash
npm run cypress:open
```

### Modo Headless (Terminal)
```bash
npm run cypress:run
```

### Ejecutar test específico
```bash
npx cypress run --spec "cypress/e2e/login.cy.js"
```

## 📊 Resultados

Los resultados se guardan en:
- **Excel Local:** `cypress/resultados/reportes_pruebas_control_horario.xlsx`
- **Google Sheets:** Si está configurado (Resultados Pruebas y Log separados)

## 🛠️ Comandos Personalizados

### Login
```javascript
cy.login({
  email: 'admin@novatrans.com',
  password: 'password123'
});
```

### Navegación por Menú
```javascript
cy.navegarAMenu('Menú Principal', 'Submenú');
```

### Registrar Resultados
```javascript
cy.registrarResultados({
  numero: 1,
  nombre: 'Nombre del test',
  esperado: 'Resultado esperado',
  obtenido: 'Resultado obtenido',
  pantalla: 'Nombre de la pantalla'
});
```

### Capturar Errores
```javascript
cy.capturarError('Contexto del error', error, {
  numero: 1,
  nombre: 'Test que falló',
  pantalla: 'Nombre de la pantalla'
});
```

## 📝 Crear Nuevos Tests

1. Crear archivo `.cy.js` en `cypress/e2e/`
2. Usar la estructura básica:
   ```javascript
   describe('Nombre del Módulo', () => {
     beforeEach(() => {
       cy.resetearFlagsTest();
     });

     it('TC001 - Descripción del test', () => {
       // Código del test
       cy.registrarResultados({
         numero: 1,
         nombre: 'Descripción del test',
         esperado: 'Resultado esperado',
         obtenido: 'Resultado obtenido',
         pantalla: 'Nombre del Módulo'
       });
     });

     after(() => {
       cy.procesarResultadosPantalla('Nombre del Módulo');
     });
   });
   ```

## 🔧 Personalización

### Adaptar para tu aplicación:
1. Cambiar `baseUrl` en `cypress.config.js`
2. Modificar el comando `login` en `commands.js`
3. Ajustar selectores según tu aplicación
4. Configurar Google Sheets IDs

### Agregar nuevos comandos:
1. Editar `cypress/support/commands.js`
2. Agregar nuevos comandos personalizados
3. Documentar su uso

## 📞 Soporte

Para dudas o problemas, contactar al equipo de QA.
