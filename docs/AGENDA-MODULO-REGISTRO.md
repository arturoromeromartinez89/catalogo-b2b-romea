# Registro de instalación — Módulo Agenda Comercial

> Actualizar este documento en CADA entrega del módulo (commit, migración o deploy).

## Última actualización: 2026-07-11 (rediseño UI)

## Base de datos (Supabase staging `vafqcvpzksjlrborxoos`)

| Objeto | Origen | Estado |
|---|---|---|
| Tablas `agenda_tasks`, `agenda_objectives` | Migración `20260708120000_agenda_comercial.sql` | ✅ Aplicada (2026-07-08) |
| Vista `client_followup_summary` (`security_invoker = true`) | misma migración | ✅ |
| Función `is_agenda_member()` | misma migración | ✅ |
| Rol `comercial` en `profiles_role_check` | misma migración | ✅ |
| Política "comercial reads clients" (solo SELECT) en `clients` | misma migración | ✅ |
| Flag `tenant_features.modulo_agenda` | misma migración; seed: Vanguardia Joyera = true | ✅ |
| Test RLS | `supabase/tests/agenda_comercial_rls.sql` — ejecutado en staging 2026-07-08: ALL PASS | ✅ |

⚠️ Nota histórica: existió un duplicado `20260709194500_agenda_comercial.sql`
(byte a byte idéntico, md5 `0bb3cba6bd75250f3ba774672c538095`); se eliminó el
2026-07-11 en el commit `bc913f4`. La canónica es `20260708120000`.

## Código fuente (repo `arturoromeromartinez89/catalogo-b2b-romea`)

| Archivo | Contenido |
|---|---|
| `src/components/tabs/AgendaTab.jsx` | UI completa del módulo (tablero, KPIs, panel lateral, reporte, adjuntos) |
| `src/services/agendaService.js` | Consultas Supabase (tenant-scoped) + helpers de fecha |
| `src/components/AdminDashboard.jsx` | Pestaña "agenda", gating `canAccessAgenda`, tabs del rol comercial |
| `src/App.jsx` + `src/services/tenantUtils.js` | Enrutamiento del rol `comercial` al portal admin |
| `src/styles.css` | Bloque `/* ══ Agenda comercial` (buscar ese marcador) |
| `src/i18n/translations.js` | Claves `ag*` (ES/EN) |

Historia de ramas: v1 `claude/agenda-comercial` (2026-07-08) → fork extendido de
Codex commiteado como `bc913f4` en `codex/fase0-cajita-consolidation` →
**rediseño actual en `claude/agenda-redesign`** (2026-07-11).

## Deploy

- **Staging (único ambiente autorizado):** Vercel `catalogo-b2b-staging-security`
  → https://catalogo-b2b-staging-security.vercel.app/catalogo/
- Producción: **NO desplegado**.
- Regla: desplegar solo desde la rama fusionada más reciente; verificar el
  bundle vivo (`grep agenda_tasks assets/index-*.js`) tras cada deploy.

## Acceso por rol

| Rol | Acceso |
|---|---|
| superadmin | Agenda del tenant activo |
| tenant_admin / admin | Agenda completa (incluye gestionar objetivos e importar JSON) |
| comercial | Solo pestañas Inicio y Agenda; tareas sí, objetivos solo lectura; clients solo lectura |
| client | **Sin acceso** (no entra al portal admin; RLS bloquea las tablas) |

## Pendientes conocidos

- Presupuesto anual/mensual: SOLO visual ($0/$0, marcado "fuente pendiente").
  Fuente futura por definir: `sales_orders` / `remisiones` / captura manual.
- Adjuntos: solo en memoria de la sesión (no persisten). Persistencia futura:
  bucket de Storage + tabla `agenda_task_attachments`.
- Realtime (tablero vivo multi-usuario): no implementado.
