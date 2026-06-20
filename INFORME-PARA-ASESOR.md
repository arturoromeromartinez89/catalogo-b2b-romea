# INFORME PARA ASESOR — Radiografía y Auditoría del Catálogo B2B

**Fecha:** 12 de junio de 2026 (v2 — integra auditoría cruzada)
**Repo auditado:** `catalogo-b2b-romea` (github.com/arturoromeromartinez89/catalogo-b2b-romea), commit `d9ab162`
**Despliegue:** catalogo-b2b-romea.vercel.app (Vercel, deploy automático desde `main`)
**Elaborado por:** Claude Code (exploración estática del repo) + hallazgos verificados de una auditoría independiente de Codex sobre el mismo commit. Cada hallazgo de Codex fue re-verificado contra el código antes de incluirse. No se modificó código.

> **Límite importante de esta auditoría:** se auditó el CÓDIGO y los archivos SQL del repo. Lo que está realmente aplicado en la base de datos de Supabase en producción **no es verificable desde el repo** — las migraciones se corren a mano copiando y pegando en el SQL Editor, y no hay registro de cuáles se corrieron. Varios hallazgos dependen de eso y se marcan como "VERIFICAR EN VIVO".

> **Nota de transparencia (v2):** la primera versión de este informe afirmaba que la mano de obra estaba protegida frente al cliente. La auditoría de Codex demostró que esa conclusión era incorrecta y la verificación posterior lo confirmó (hallazgo S-3). Esta versión corrige esa conclusión e integra los 7 hallazgos adicionales de Codex, todos confirmados contra el código.

---

## 1. RESUMEN EJECUTIVO

### Qué versión es esta

Esta es la **versión multi-tenant más avanzada** del sistema. Pistas concluyentes:

- El repo se llama "romea" y el README describe un MVP viejo sin backend ("No incluye backend, login, base de datos…") — **el README está totalmente desactualizado**; el sistema actual tiene Supabase, login, roles y base de datos completa.
- Existen migraciones `multi_tenant_migration.sql`, `superadmin_tenants.sql` y `rename_tenants_vanguardia_romea.sql`: esta versión hospeda a **Vanguardia y Romea como dos "tenants" (empresas) dentro de la misma base de datos**, no como sistemas separados.
- El deploy en producción muestra el branding de Vanguardia Joyera porque el branding se carga por tenant (`company_settings` por empresa).
- Hay 11 ramas de Git sin fusionar (design-system, sentry, rls-tenant-isolation, etc.) — la rama `main` es la viva.

**Conclusión:** las "tres versiones" son en realidad: (1) los MVPs viejos single-empresa de Vanguardia y Romea (repos/carpetas aparte, ancestros), y (2) ESTA versión, que ya los absorbió como tenants. Mi recomendación coincide con la del asesor: **esta es la versión a escalar; las otras dos deben archivarse**.

### Porcentaje de avance hacia un SaaS comercial

| Dimensión | Avance estimado |
|---|---|
| Producto funcional para una joyería (catálogo, precios, preórdenes, clientes) | **~80%** |
| Multi-tenant técnico (aislamiento de datos entre empresas) | **~60%** — la estructura existe; hay hoyos de seguridad y deriva de migraciones |
| Integridad comercial frente al cliente final (precios calculados en servidor) | **~30%** — hoy el navegador del cliente calcula y puede manipular precios |
| SaaS comercial (onboarding self-service, Stripe, subdominios, planes) | **~5%** — prácticamente desde cero |
| Calidad de ingeniería (tests, TypeScript, CI/CD, migraciones ordenadas) | **~10%** — no hay tests, no hay TS, migraciones manuales |

**En una frase:** es un producto interno sólido y en uso real, a medio camino de ser plataforma; **no está listo para venderle a terceros sin resolver primero la seguridad multi-tenant, la integridad de precios en servidor y la disciplina de migraciones.**

---

## 2. FASE 1 — INVENTARIO DEL ESTADO REAL

### 2.1 Stack técnico

- **Frontend:** React 18.3 + Vite 6, JavaScript puro (sin TypeScript). Un solo `styles.css` de ~9,000 líneas + sistema de tokens de diseño.
- **Backend:** **No hay servidor propio.** Todo es Supabase (PostgreSQL + Auth + Storage) consumido directo desde el navegador con la llave anónima. La seguridad recae 100% en las políticas RLS de la base de datos.
- **Hosting:** Vercel (SPA con rewrite a index.html).
- **Otros:** jsPDF (PDFs), xlsx/SheetJS (Excel), @zxing (escáner de gafetes), Sentry opcional (con limpieza de datos sensibles ya implementada).

### 2.2 Lo YA construido y funcionando

| Módulo | Qué hace | Archivos clave |
|---|---|---|
| **Autenticación** | Login, registro, recuperación de contraseña, suspensión de cuenta (toggle recién agregado — ver hallazgo S-5: hoy solo bloquea la pantalla) | `AuthGate.jsx`, `authService.js`, `authLock.js` |
| **Roles** | superadmin → tenant_admin/admin → client, verificados con funciones SQL (`is_admin`, `is_superadmin`, `is_tenant_admin`) | `tenantUtils.js`, `multi_tenant_migration.sql` |
| **Superadmin** | Dashboard de plataforma: empresas, usuarios, métricas, modo soporte (impersonar tenant) | `superadmin/SuperAdminDashboard.jsx`, `ImpersonationContext.jsx`, `TenantsTab.jsx` |
| **Catálogo admin** | CRUD de productos, importación/exportación Excel con plantilla bilingüe, fotos (Drive + Storage), flag `visible_web`, filtros/búsqueda con chips, productos configurables (cadenas por patrón de código) | `CatalogTab.jsx`, `excelParser.js`, `catalogExcel.js`, `configurableCatalog.js` |
| **Precios por plata** | Precio del metal (Kitco + premio % + tipo de cambio) → precio por gramo por línea + mano de obra (`mo_base`). Listas de labores por línea, listas de precio por pieza, márgenes por cliente | `pricingService.js`, `pricing.js`, `PricingPanel.jsx`, `labor_lists.sql`, `piece_price_lists.sql` |
| **Clientes** | CRUD, prospectos con escaneo de gafete (expo JCK), catálogo restringido por cliente (`allowed_skus` cargado por Excel), lista de labores por cliente, asignación de lista de precios, **centro de acceso** (crear cuenta + contraseña generada + invitación + on/off) | `ClientsTab.jsx`, `ProspectsTab.jsx`, `supabaseCatalog.js` |
| **Preórdenes** | Workspace con pestañas, editor con drag & drop, candado optimista (dos personas editando), totales, estatus, PDF comercial con compresión de imágenes, exportación Excel, etiqueta de origen Cliente/Admin, filtro por cliente | `PreorderWorkspace.jsx`, `PreorderEditor.jsx`, `preorderService.js`, `pdfGenerator.js` |
| **Portal del cliente** | El cliente entra y ve SOLO su catálogo (sus SKUs asignados o lo visible), con precios calculados, arma carrito y genera preorden | `ClientCatalogApp.jsx`, `fetchClientData` |
| **Ligas de cotización públicas** | URL `/cotizacion/<token>` sin login, expiración 30 días, el visitante puede mandar su pedido (se convierte en preorden vía función segura) | `QuotePage.jsx`, `quoteLinkService.js`, `quote_links.sql` |
| **Remisiones** | Notas de entrega generadas desde preórdenes | `RemisionWorkspace.jsx`, `RemisionEditor.jsx` |
| **Módulo administrativo** | Gastos, categorías, cuentas caja/banco, centros de costos, balance, cobros/pagos | `GastosTab.jsx`, `BalanceTab.jsx`, `CuentasAdminTab.jsx`, etc. |
| **i18n** | Español/Inglés en toda la interfaz, plantillas y PDFs | `i18n/` |

### 2.3 Lo construido a medias, roto o en riesgo

1. **README obsoleto** — describe un producto que ya no existe. Confunde a cualquier auditor o programador nuevo.
2. **`modulo_admin_PROPUESTA.sql` dice "Estado: PROPUESTA — pendiente de revisión"** pero los tabs del módulo administrativo ya existen en el código y consultan esas tablas. Si ese SQL no se corrió en producción, esos tabs fallan. VERIFICAR EN VIVO.
3. **Deriva de migraciones (el riesgo estructural #1):** hay 24 archivos SQL en `supabase/` con TRES generaciones de políticas de seguridad que se pisan entre sí (`schema.sql` → `multi_tenant_migration.sql` → `fix_rls_tenant_isolation.sql`). Cuál ganó depende del ORDEN en que se pegaron a mano en Supabase. No hay herramienta de migraciones ni registro.
4. **`client-access-setup.sql` recién creado y pendiente de correr** — sin él, los clientes nuevos quedan sin `tenant_id` y no ven nada (bug activo hoy con el cliente David).
5. **Duplicación de sistemas de precios:** `price_lists` (v1) y `piece_price_lists` (v2) coexisten; el código usa ambas.
6. **`tenant_features` es una tabla huérfana:** existe en SQL y tiene una función (`fetchTenantFeatures` en `adminModuleService.js:31`) que **nadie llama** — cero gating de features en UI y cero en servidor. Para el modelo de planes del SaaS, está todo por construir.
7. **11 ramas sin fusionar** — trabajo potencialmente perdido o duplicado.
8. **Cero pruebas automatizadas, cero TypeScript** — cada cambio se prueba a mano en producción (los bugs de esta misma semana lo demuestran).
9. **Productos configurables hardcodeados** — el patrón de código `CFG-XXX-CHN-10MM` y las etiquetas (Pulso, Cadena, Esclava, Militar) están en código (`configurableCatalog.js`), no son configurables por tenant.

### 2.4 Arquitectura actual (explicada simple)

- **Tenants (empresas):** existe la tabla `tenants`; casi todas las tablas de negocio tienen columna `tenant_id`. El frontend filtra por tenant (`withTenant()` en `tenantUtils.js`) y la base de datos REFUERZA ese filtro con políticas RLS (la versión buena está en `fix_rls_tenant_isolation.sql`). El frontend filtrando es cortesía; la seguridad real es RLS.
- **Roles:** viven en la tabla `profiles` (columna `role`). Las políticas SQL los verifican con funciones del lado del servidor — **no es solo esconder botones**, está bien planteado. Pero hay un hoyo de escalación (ver hallazgo S-1).
- **Pricing por plata:** el admin captura precio Kitco de la onza + premio % + tipo de cambio → el sistema calcula precio por gramo; cada línea de producto tiene mano de obra base; las listas de labores y de precio por pieza permiten condiciones especiales por cliente. **Punto débil estructural: todo el cálculo ocurre en el navegador** — también en el navegador del cliente final (ver S-3 y S-4).
- **Carga de productos:** Excel maestro (plantilla descargable) → parser → upsert por lotes de 500 a Supabase. También CRUD manual y carga de imágenes.
- **Preórdenes:** el admin (o el cliente desde su portal) arma una preorden con items; se guardan en `preorders` + `preorder_items` con folio, totales, estatus y candado optimista; generan PDF y pueden convertirse en remisión.

### 2.5 ¿Qué tan listo está para SaaS comercial?

| Capacidad | ¿Existe algo? | Realidad |
|---|---|---|
| **(a) Onboarding self-service** | **NO — desde cero.** | Hoy crear una joyería nueva = el superadmin la da de alta a mano en TenantsTab + correr SQLs + configurar branding. El registro público que existe solo crea cuentas de rol `client`. No hay flujo "registra tu joyería, sube tu logo, importa tu Excel y empieza". |
| **(b) Cobro con Stripe** | **NO — desde cero.** | Cero código de Stripe. Además hay un problema estructural: **no existe backend**, y Stripe requiere webhooks y llaves secretas que NO pueden vivir en el navegador. Se necesitan Supabase Edge Functions (o un backend pequeño) como prerequisito. No hay tablas de planes/suscripciones, y `tenant_features` (el embrión del feature-gating) no se consume en ninguna parte. |
| **(c) Tenant por subdominio** | **NO — desde cero.** | Hoy el tenant se deriva del perfil del usuario logueado (`profile.tenant_id`), nunca del dominio. No hay lectura de `window.location.hostname`, ni wildcard DNS, ni tabla de dominios por tenant. Es factible (Vercel soporta subdominios wildcard) pero no hay nada construido. |

---

## 3. FASE 2 — AUDITORÍA DE SEGURIDAD MULTI-TENANT (consolidada: Claude + Codex)

Esta sección integra las dos auditorías independientes sobre el mismo commit. Donde Codex aportó el hallazgo, se indica. Todos los hallazgos de Codex fueron re-verificados contra el código antes de incluirse — **los 7 se confirmaron**.

### Cobertura RLS de las 31 tablas usadas por el código

**Con RLS y políticas por tenant (en `fix_rls_tenant_isolation.sql` y módulos nuevos):** `products`, `clients`, `catalogs`, `catalog_products`, `price_lists`, `price_list_items`, `client_catalogs`, `client_price_lists`, `company_settings`, `product_lines`, `metal_prices`, `client_line_margins`, `preorders`, `preorder_items`, `quote_links`, `labor_lists`, `labor_list_lines`, `piece_price_lists`, `piece_price_list_items`, `gastos`, `gastos_recurrentes`, `categorias_gasto`, `cuentas_caja_banco`, `centros_costos`, `cobros`, `pagos`, `remisiones`, `remision_items`, `tenants`, `tenant_features`, `profiles`, `product_components`.

**El problema no es falta de políticas — es no saber CUÁLES están vivas (S-2) y que varias políticas vivas conceden de más (S-3, S-4, S-5).**

### Hallazgos (orden de severidad)

---

**[S-1] CRÍTICA — Escalación de privilegios: un admin de tenant puede autonombrarse superadmin**
- **Archivo:** `supabase/multi_tenant_migration.sql:159-166` (política `admins manage profiles`)
- **Problema:** la política permite a un `tenant_admin` hacer UPDATE a cualquier perfil de su tenant — **incluida la columna `role` de su propio perfil**. Nada restringe qué columnas puede cambiar.
- **Cómo se explota:** cualquier admin de una joyería cliente abre la consola del navegador y ejecuta un UPDATE directo a PostgREST: `update profiles set role='superadmin' where id=<su_id>`. La validación `with check` pasa porque su tenant no cambió. Resultado: **control total de la plataforma y de los datos de TODAS las joyerías.**
- **Fix propuesto:** trigger `BEFORE UPDATE` en `profiles` que rechace cambios a `role`, `tenant_id`, `client_id` y `active` salvo que `is_superadmin()` (Postgres no tiene RLS por columna; el trigger es el camino).
- *(Hallazgo coincidente de ambas auditorías.)*

---

**[S-2] CRÍTICA (condicional) — Deriva de migraciones: imposible saber qué políticas de seguridad están activas**
- **Archivos:** `supabase/schema.sql:252-328`, `supabase/SETUP_COMPLETO.sql:255-346` (generación vieja, `is_admin()` SIN filtro de tenant) vs `supabase/fix_rls_tenant_isolation.sql` (generación nueva, con tenant).
- **Problema:** `is_admin()` solo verifica el rol, NO la empresa. Si en la base viva quedó alguna política de la generación vieja, **el admin de la joyería A puede leer y modificar productos, clientes, precios y preórdenes de la joyería B** con requests directos a PostgREST.
- **Cómo se explota:** admin del tenant A consulta `GET /rest/v1/clients?select=*` sin filtro; si la política viva es `is_admin()`, recibe los clientes de todos los tenants.
- **Fix propuesto:** (1) correr HOY en Supabase: `select tablename, policyname, qual from pg_policies where schemaname='public' order by tablename;` y comparar contra `fix_rls_tenant_isolation.sql`; (2) re-correr ese archivo completo (es idempotente); (3) adoptar Supabase CLI con migraciones versionadas.
- *(Hallazgo coincidente de ambas auditorías.)*

---

**[S-3] ALTA — El cliente SÍ recibe la mano de obra (corrección a la v1 de este informe)** ⚠️ *Hallazgo de Codex, verificado*
- **Archivos:** `src/components/ClientCatalogApp.jsx:72-73`, `src/services/pricingService.js:487-510`, `src/services/preorderService.js:248`, política `"authenticated read product lines"` en `supabase/schema.sql:311` / `fix_rls_tenant_isolation.sql:405`
- **Problema:** la v1 de este informe afirmó que la mano de obra estaba protegida porque `sanitizeProductForClient` la elimina del producto. **Eso es cosmético.** El portal del cliente consulta `product_lines` (que contiene `mo_base`, la mano de obra por línea — el secreto comercial #1 según las reglas del negocio) y `metal_prices`, y la política RLS se lo permite a CUALQUIER usuario autenticado, incluidos clientes. El navegador del cliente calcula `quoteLaborPerGram` y lo guarda como `labor_mxn` en los items de su preorden.
- **Cómo se explota:** el cliente ni siquiera necesita la app — `GET /rest/v1/product_lines?select=*` con su sesión devuelve la mano de obra de cada línea. Con eso deduce el margen del joyero y negocia (o se lo pasa a la competencia).
- **Fix propuesto:** el cálculo de precios del cliente debe moverse al servidor (RPC `security definer` que devuelva SOLO precio final por producto); restringir la lectura de `product_lines` y `metal_prices` a roles admin.

---

**[S-4] ALTA — Los clientes pueden manipular sus preórdenes (precios, totales, estatus) o borrarlas** ⚠️ *Hallazgo de Codex, verificado*
- **Archivo:** `supabase/fix_rls_tenant_isolation.sql:488-503` (preorders) y `:533-553` (preorder_items) — políticas `for all`
- **Problema:** la política de clientes sobre sus preórdenes es `FOR ALL` (leer, insertar, **actualizar y borrar**). Un cliente puede, con requests directos: cambiar `status` a `confirmada`, alterar `total_mxn`, modificar `precio_gramo_mxn`/`labor_mxn` de los items, o borrar preórdenes.
- **Cómo se explota:** el cliente se auto-confirma una preorden con precios manipulados; si el admin surte confiando en el estatus y el total, la pérdida es directa. Matiz: solo afecta **sus propias** preórdenes (el aislamiento por tenant sí funciona) — es integridad comercial, no fuga entre empresas.
- **Fix propuesto:** separar políticas: cliente solo `SELECT` + `INSERT` (con estatus forzado `pendiente`); `UPDATE`/`DELETE` solo admin. Idealmente, el INSERT del cliente pasa por una RPC que recalcula precios en servidor (mismo proyecto que S-3).

---

**[S-5] ALTA — Suspender una cuenta solo bloquea la pantalla, no el acceso a los datos** ⚠️ *Hallazgo de Codex, verificado*
- **Archivos:** `src/components/AuthGate.jsx` (check de `profile.active` en React), ninguna política SQL consulta `profiles.active` ni `tenants.status`
- **Problema:** el toggle de suspensión recién construido evalúa `active === false` únicamente en la interfaz. Las políticas RLS no lo consultan: un cliente suspendido (o un tenant entero suspendido por falta de pago, en el futuro SaaS) sigue pudiendo leer catálogo y crear preórdenes vía PostgREST con su sesión vigente.
- **Cómo se explota:** cliente suspendido conserva su JWT y sigue operando por API. Para el SaaS es peor: un tenant moroso "cancelado" seguiría usando el sistema.
- **Fix propuesto:** incorporar `active` (y a futuro `tenants.status`) a las funciones de rol (`is_admin()`, `current_tenant_id()` o una función `is_active_user()`) para que TODA política lo herede automáticamente.

---

**[S-6] ALTA — Apropiación de cuenta de cliente por pre-registro (depende de configuración)**
- **Archivos:** `src/components/AuthGate.jsx:200` (signup público), `supabase/schema.sql:198-224` (`handle_new_user` vincula por coincidencia de email)
- **Problema:** el registro es público y el trigger vincula la cuenta nueva al registro de `clients` cuyo email coincida. Si la confirmación de email está DESACTIVADA en Supabase, un atacante que conozca el email de un cliente puede registrarse ANTES que él y quedarse con su acceso: catálogo, precios negociados y preórdenes.
- **Fix propuesto:** activar confirmación de email obligatoria; idealmente cerrar el signup público (el alta por invitación del admin ya existe).
- *(Hallazgo coincidente de ambas auditorías.)*

---

**[S-7] MEDIA — La liga pública de cotización confía en los precios que manda el visitante** ⚠️ *Hallazgo de Codex, verificado*
- **Archivo:** `supabase/quote_links.sql:129-140` (`submit_quote_link_preorder`)
- **Problema:** la función toma `precioMinimo`, `pesoPromedio` y `codigo` del payload del **visitante anónimo** sin reconstruirlos desde el snapshot guardado en `quote_links.products`. Mitigantes verificados: `labor := 0` está fijo (no se filtra mano de obra) y la preorden cae en `pendiente` sujeta a revisión del admin.
- **Cómo se explota:** un visitante manda precios alterados; si el admin confía en los totales al revisar, el error pasa. También puede inyectar códigos/descripciones de productos inexistentes.
- **Fix propuesto:** reconstruir cada item desde `q.products` por `codigo` (el visitante solo manda código + cantidad); rechazar códigos fuera del snapshot. Agregar límite de envíos por token.

---

**[S-8] MEDIA — Referencias UUID entre tablas sin validar que pertenezcan al mismo tenant** ⚠️ *Hallazgo de Codex, verificado*
- **Archivos:** `src/services/preorderService.js:126-135` (acepta `client_id`, `labor_list_id`, `piece_price_list_id` validando solo formato UUID), `supabase/fix_rls_tenant_isolation.sql:323-342` (política de `client_price_lists` valida el lado del cliente pero NO `price_list_id`)
- **Problema:** el patrón se repite: las políticas validan que UN lado de la relación pertenezca al tenant, pero no el otro. Un admin podría asignar a su cliente la lista de precios de otro tenant, o una preorden podría referenciar la lista de labores de otra empresa.
- **Fix propuesto:** validar ambos lados en las políticas de tablas puente, o triggers de integridad que verifiquen coincidencia de `tenant_id` en FKs.

---

**[S-9] MEDIA — Dependencias vulnerables: jsPDF (crítica en npm), xlsx (alta), DOMPurify (moderada)** ⚠️ *Severidad real verificada con `npm audit`*
- **Archivo:** `package.json` (`jspdf 2.5.2`, `xlsx ^0.18.5`)
- **Problema:** `npm audit` reporta 3 vulnerabilidades (1 crítica, 1 alta, 1 moderada). `jspdf <= 4.2.0` arrastra un DOMPurify con 7 advisories (XSS, prototype pollution); el fix es `jspdf@4.2.1` (breaking change desde 2.5.2). `xlsx` 0.18.x tiene prototype pollution + ReDoS **sin fix en npm** (hay que migrar al CDN oficial de SheetJS).
- **Matiz de riesgo real:** la explotación requiere contenido malicioso entrando a los flujos de PDF/Excel (p. ej. un Excel enviado por un tercero que el admin importa). En papel, cualquier due diligence lo marcará en rojo.
- **Fix propuesto:** planear upgrade de jsPDF a 4.x (revisar los 3 generadores de PDF) y migración de xlsx al canal oficial de SheetJS.

---

**[S-10] MEDIA — El cliente ve campos internos de su propia ficha**
- **Archivo:** `src/services/supabaseCatalog.js:524` (`select("*")` sobre `clients` en `fetchClientData`)
- **Problema:** el cliente logueado recibe TODO su renglón de `clients`, incluyendo `comentarios` (notas internas del vendedor sobre él) y campos comerciales internos.
- **Fix propuesto:** lista explícita de columnas (`select("id, name, company, email, allowed_skus")`).
- *(Hallazgo coincidente de ambas auditorías.)*

---

**[S-11] MEDIA — Bucket de Storage aparentemente público y sin política por tenant en el repo**
- **Archivos:** `src/services/companySettings.js:50-52`, `productImageService.js:45` (uso de `getPublicUrl` sobre `company-assets`)
- **Problema:** bucket público = cualquiera con la URL lee logos y fotos de todos los tenants; no hay SQL de políticas de Storage en el repo. Lo grave sería que la política de ESCRITURA no esté limitada por tenant.
- **Fix propuesto:** VERIFICAR EN VIVO; separar rutas por tenant con política de escritura por prefijo; versionar las políticas de Storage en el repo.
- *(Hallazgo coincidente de ambas auditorías.)*

---

**[S-12] MEDIA — Registro público abierto a internet sin fricción**
- **Archivo:** `src/components/AuthGate.jsx:442-444`
- **Problema:** cualquiera puede crear cuentas ilimitadas (rol `client`, sin tenant). Superficie de abuso y enumeración.
- **Fix propuesto:** quitar el signup público o agregar captcha de Supabase Auth.

---

**[S-13] MEDIA — Importador de Excel sin límites de tamaño ni de filas**
- **Archivos:** `src/utils/excelParser.js:196`, `UploadExcel.jsx:10`
- **Problema:** sin límite de tamaño/filas; un archivo enorme congela el navegador del admin. Mitigante: React escapa todo al renderizar (verificado: no hay `dangerouslySetInnerHTML` ni `eval`), así que no encontré vector de XSS por celdas.
- **Fix propuesto:** límite de tamaño (10 MB) y filas (20,000) con mensaje claro.

---

**[S-14] BAJA — Endpoints públicos de cotización sin límite de uso**
- **Archivo:** `supabase/quote_links.sql:193-194` (`grant execute ... to anon`)
- **Problema:** un visitante con token válido puede crear preórdenes ilimitadas (spam). El token es fuerte (`crypto.randomUUID()`).
- **Fix propuesto:** límite de envíos por token y/o expiración tras N usos. (Se complementa con S-7.)

---

**[S-15] BAJA — Impersonación de superadmin sin bitácora**
- **Archivo:** `src/contexts/ImpersonationContext.jsx`
- **Problema:** el "modo soporte" no deja registro de cuándo el operador de la plataforma vio datos de una joyería. Para vender a empresas, eso se audita.
- **Fix propuesto:** tabla `audit_log` con eventos de impersonación.

### Lo que SÍ está bien (verificado, para que el asesor no lo re-trabaje)

- ✅ **Secretos:** solo la llave anónima vive en el frontend; `.env` está en `.gitignore` y NO está trackeado en git; no hay `service_role` ni llaves hardcodeadas en ninguna parte del código (verificado por búsqueda exhaustiva).
- ✅ **Roles verificados en servidor** con funciones `security definer`, no solo UI.
- ✅ **Costos y márgenes de items NO se persisten:** `CLIENT_ONLY_ITEM_FIELDS` en `preorderService.js:54` elimina `costo_pieza_mxn` y `margen_pieza_pct` antes de guardar. *(Ojo: esto NO protege la mano de obra — ver S-3.)*
- ✅ **Columnas públicas de producto son lista explícita** (`PUBLIC_PRODUCT_COLUMNS`), sin campos de costo.
- ✅ **Tokens de cotización** con UUID criptográfico y expiración; la función pública fija `labor := 0` (no filtra mano de obra por esa vía).
- ✅ **Sentry** con lista de campos sensibles que nunca se envían.
- ✅ La generación NUEVA de políticas RLS (`fix_rls_tenant_isolation.sql`) está bien diseñada en aislamiento por tenant; sus defectos son de permisos *dentro* del tenant (S-4) y validación de un solo lado en tablas puente (S-8).

---

## 4. RECOMENDACIÓN DE PLAN

### Etapa 0 — Esta semana (reparar antes de cualquier cosa)

1. **Verificar políticas vivas** (`pg_policies`) y re-correr `fix_rls_tenant_isolation.sql` + `client-access-setup.sql`. Cierra S-2 y el bug activo del cliente David.
2. **Trigger anti-escalación en `profiles`** (cierra S-1; SQL de ~15 líneas; proteger `role`, `tenant_id`, `client_id`, `active`).
3. **Restringir lectura de `product_lines` y `metal_prices` a admins** (primera mitad de S-3; rompe temporalmente el cálculo de precios del portal del cliente — coordinar con el punto 6).
4. **Cambiar la política de preórdenes del cliente a SELECT+INSERT** (cierra el grueso de S-4; SQL puro).
5. **Activar confirmación de email** y/o cerrar signup público (cierra S-6/S-12). **Columnas explícitas en `fetchClientData`** (cierra S-10; una línea).

### Etapa 1 — Siguientes 2-4 semanas (cimientos para escalar)

6. **PROYECTO CENTRAL: precios calculados en servidor.** Una RPC (o Edge Function) que recibe códigos + cantidades y devuelve precios finales calculados con `mo_base`, metal y listas del cliente — sin exponer los insumos. Esto cierra de raíz S-3, S-4 (validación de totales) y S-7 (reconstrucción del snapshot en la liga pública). **Es UN proyecto, no tres parches** — las tres vulnerabilidades comparten la misma causa: el precio se calcula en el navegador.
7. **Incorporar `active`/`tenants.status` a las funciones de rol** (cierra S-5 para siempre, incluyendo la suspensión de tenants morosos del futuro SaaS).
8. **Adoptar Supabase CLI con migraciones versionadas.** Consolidar los 24 SQLs en una migración base + incrementos. **Prerequisito de todo lo demás.**
9. **Edge Functions de Supabase** como capa de servidor (prerequisito de Stripe; también reemplaza el truco del `authLock` para crear cuentas de cliente).
10. Actualizar README, archivar las versiones viejas, fusionar o borrar las 11 ramas. Upgrade de jsPDF/xlsx (S-9). Pruebas mínimas del flujo crítico (login → catálogo → preorden → PDF).

### Etapa 2 — Mes 2-3 (convertir en SaaS)

11. **Onboarding self-service:** registro de joyería → crea tenant + tenant_admin + branding + Excel de arranque. (La estructura de datos ya lo soporta; falta el flujo.)
12. **Stripe sobre Edge Functions:** tabla `subscriptions`, webhooks, y **construir el feature-gating real sobre `tenant_features`** (hoy es una tabla huérfana que nadie consume — ver inventario 2.3.6).
13. **Subdominios:** tabla de dominios por tenant + detección por hostname + wildcard en Vercel. Lo MENOS urgente de los tres: se puede vender con URL única y selector por login.

### Qué NO sirve para escalar y conviene rehacer (no urgente, pero decidirlo ya)

- **El cálculo de precios en el navegador** — es lo más importante de esta lista (ver Etapa 1.6). Todo lo demás de esta sección es calidad; esto es seguridad + integridad comercial.
- **El monolito `styles.css` (~9,000 líneas)** y `AdminDashboard.jsx` gigante: refactor progresivo ya iniciado (carpeta `tabs/`), continuarlo.
- **JavaScript sin tipos en la lógica de precios:** migrar al menos `pricingService` y `preorderService` a TypeScript.
- **Doble sistema de listas de precios (v1 y v2):** consolidar en uno.
- **Productos configurables hardcodeados:** volverlos configuración por tenant.
- **El flujo de crear cuenta de cliente desde el navegador del admin** (`authLock` + restaurar sesión): funciona, pero es frágil por diseño; migrar a Edge Function con `service_role`.

---

## 5. PREGUNTAS ABIERTAS (solo el dueño puede decidirlas)

1. **¿Las versiones viejas de Vanguardia y Romea tienen datos o features que NO existan aquí?** Si no, archivarlas formalmente esta semana. Si sí, listar qué y migrarlo una sola vez.
2. **¿El registro público de clientes debe existir?** Hoy cualquiera puede crear cuenta. La alternativa (solo invitación del admin) es más segura y ya está construida.
3. **¿Las fotos de producto pueden ser públicas?** (URLs adivinables ven el catálogo completo de cualquier joyería). Si el catálogo es confidencial, hay que mover Storage a privado con URLs firmadas.
4. **¿Cuánta urgencia tiene cerrar la fuga de mano de obra (S-3)?** El fix correcto (precios en servidor, Etapa 1.6) toma semanas; el parche rápido (bloquear lectura de `product_lines` al cliente) rompe el portal del cliente hasta que exista la RPC. ¿Se tolera tener el portal del cliente apagado unos días, o se acepta la fuga mientras se construye la solución?
5. **¿Quién será el "superadmin" operativo cuando haya decenas de joyerías?** Definir si habrá equipo de soporte y con qué permisos (impersonación auditada, S-15).
6. **Modelo de precios del SaaS:** ¿plan único o tiers? `tenant_features` existe pero está huérfana; decidir QUÉ features son premium define cuánto gating hay que construir.
7. **¿México primero o México+USA desde el día 1?** Stripe, facturación (CFDI vs invoices), idioma y soporte cambian según la respuesta. El i18n ES/EN ya existe, lo demás no.
8. **Presupuesto para un backend mínimo:** las Edge Functions de Supabase bastan al inicio; confirmar que el asesor está de acuerdo en esa ruta antes de construir Stripe sobre ellas.

---

*Fin del informe (v2, consolidado con auditoría de Codex). Generado a partir de exploración estática del repositorio el 12-jun-2026, commit `d9ab162`. Los hallazgos marcados "VERIFICAR EN VIVO" requieren consultar la base de datos de producción en Supabase (query de `pg_policies` incluida en S-2).*
