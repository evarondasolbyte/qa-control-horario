const FALLBACK_BASE_URL = 'https://staging.controlhorario.novatrans.app';

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl).replace(/\/+$/, '');
}

export function getAppBaseUrl() {
  const rawBaseUrl =
    Cypress.env('APP_BASE_URL') ||
    Cypress.config('baseUrl') ||
    FALLBACK_BASE_URL;

  return normalizeBaseUrl(rawBaseUrl);
}

export function getScopedBaseUrl(envKey, fallbackBaseUrl = getAppBaseUrl()) {
  return normalizeBaseUrl(Cypress.env(envKey) || fallbackBaseUrl);
}

export function buildUrlFromBase(baseUrl, pathname = '/') {
  return new URL(String(pathname || '/'), `${normalizeBaseUrl(baseUrl)}/`).toString();
}

export function buildAppUrl(pathname = '/') {
  return buildUrlFromBase(getAppBaseUrl(), pathname);
}
