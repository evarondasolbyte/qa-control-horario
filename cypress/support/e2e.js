// ***********************************************************
// This example support/e2e.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import './excelReader'

// Alternatively you can use CommonJS syntax:
// require('./commands')

// Ignorar errores de JavaScript de la aplicación globalmente
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignorar errores de Livewire que interfieren con el guardado
  if (err.message.includes('Component already registered') ||
      err.message.includes('Snapshot missing on Livewire component') ||
      err.message.includes('Component already initialized') ||
      err.message.includes('Livewire')) {
    return false;
  }
  // Para otros errores, permitir que falle
  return true;
});
