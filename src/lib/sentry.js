/**
 * Inicialización de Sentry para monitoreo de errores en producción.
 *
 * Solo se activa si VITE_SENTRY_DSN está definido en el entorno.
 * En desarrollo o sin DSN, Sentry no se inicializa (degradación silenciosa).
 *
 * Para activar:
 *   1. Agrega VITE_SENTRY_DSN=https://xxxx@oxxxx.ingest.sentry.io/yyyy en .env
 *   2. Crea el proyecto en https://sentry.io (tipo: React)
 *   3. El DSN se encuentra en Settings → Projects → [proyecto] → Client Keys
 */
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

// Campos que nunca deben enviarse a Sentry por contener PII o datos comerciales.
const SENSITIVE_KEYS = new Set([
  "email", "correo", "phone", "telefono", "rfc",
  "name", "nombre", "customer", "cliente", "token",
  "password", "contraseña", "newPassword",
]);

/**
 * Redacta tokens de URLs tipo /cotizacion/:token y elimina
 * query string y hash para evitar filtrar accesos privados a cotizaciones.
 *
 * Ejemplo:
 *   /cotizacion/abc123XYZ → /cotizacion/[token]
 *   https://app.com/cotizacion/xyz?foo=bar#hash → https://app.com/cotizacion/[token]
 */
const sanitizeUrl = (url) => {
  if (!url || typeof url !== "string") return url;
  try {
    // Redactar segmento de token en rutas de cotización
    const redacted = url.replace(
      /(\/cotizacion\/)([^/?#]+)/gi,
      "$1[token]"
    );
    // Eliminar query string y hash — pueden contener parámetros sensibles
    const parsed = new URL(redacted, "https://placeholder.local");
    parsed.search = "";
    parsed.hash = "";
    // Reconstruir: si era relativa, devolver solo pathname
    return url.startsWith("http") ? parsed.toString() : parsed.pathname;
  } catch {
    return url;
  }
};

/**
 * Elimina recursivamente claves sensibles de un objeto de contexto.
 * Reemplaza el valor con "[Filtered]" en lugar de borrar la clave,
 * para mantener la estructura visible en Sentry sin exponer datos.
 */
const sanitizeExtras = (extras) => {
  if (!extras || typeof extras !== "object") return extras;
  const sanitized = {};
  for (const [key, value] of Object.entries(extras)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[Filtered]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeExtras(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
};

export const initSentry = () => {
  if (!dsn) return; // Sin DSN no hay init — seguro para desarrollo local

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE, // "production" | "development"
    // No enviar PII del usuario automáticamente (IP, email de sesión, etc.)
    sendDefaultPii: false,
    // Solo captura errores. Sin tracing de performance.
    tracesSampleRate: 0,
    // Ignorar errores de bajo valor que generan ruido sin acción posible.
    ignoreErrors: [
      "ResizeObserver loop limit exceeded",
      "ResizeObserver loop completed with undelivered notifications",
      "Non-Error promise rejection captured",
      "Network request failed",
      "Failed to fetch",
      "Load failed",
    ],
    beforeSend(event) {
      // 1. Descartar errores de extensiones del navegador
      if (event.exception?.values?.[0]?.stacktrace?.frames?.some(
        (frame) =>
          frame.filename?.startsWith("chrome-extension://") ||
          frame.filename?.startsWith("moz-extension://")
      )) {
        return null;
      }

      // 2. Sanitizar URL de la petición — redactar tokens de cotización
      if (event.request?.url) {
        event.request.url = sanitizeUrl(event.request.url);
      }

      // 3. Sanitizar referrer si existe
      if (event.request?.headers?.Referer) {
        event.request.headers.Referer = sanitizeUrl(event.request.headers.Referer);
      }

      // 4. Sanitizar extras/contexto — eliminar PII pasado manualmente
      if (event.extra) {
        event.extra = sanitizeExtras(event.extra);
      }

      return event;
    },
  });
};

/**
 * Captura un error manualmente desde cualquier parte de la app.
 * Los datos de contexto se sanitizan antes de enviarse a Sentry.
 *
 * Ejemplo:
 *   import { captureError } from "../lib/sentry";
 *   captureError(error, { context: "fetchAdminData", tenantId });
 *
 * NUNCA pasar: email, phone, rfc, name, token, password ni datos de cliente.
 */
export const captureError = (error, context = {}) => {
  if (!dsn) return; // No-op sin DSN
  Sentry.withScope((scope) => {
    scope.setExtras(sanitizeExtras(context));
    Sentry.captureException(error);
  });
};
