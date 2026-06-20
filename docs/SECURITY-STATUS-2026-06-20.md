# Estado de seguridad - 20 de junio de 2026

## Resultado actual

La separacion de datos entre empresas fue probada directamente en la base de
produccion. Productos, clientes, pedidos, partidas, filtros, dominios y todas las
tablas con `tenant_id` ocultaron los datos de otras empresas.

Durante esta revision se encontro una politica antigua que permitia a un
administrador ver partidas de pedidos de otro tenant. La prueba fallo antes del
cambio y paso despues de eliminar las politicas globales heredadas. Tambien se
retiraron reglas antiguas equivalentes de configuracion de empresa, lineas,
precios de metal y margenes.

## Cambios aplicados en produccion

- `20260620170000_tenant_domains.sql`: registro verificado de dominios por
  tenant, con lectura aislada y escritura exclusiva para superadministradores.
- `20260620171500_remove_legacy_global_policies.sql`: elimina politicas globales
  heredadas y limita la edicion de partidas a pedidos pendientes o en revision.
- `20260620173000_harden_public_quote_submission.sql`: impide alterar productos,
  pesos o precios desde una liga publica y limita abuso por cantidad y frecuencia.
- La Edge Function de invitaciones consulta `tenant_domains` para CORS y URLs de
  retorno. Estuches Chavez ya no depende de una palabra fija dentro del codigo.
- El secreto `ALLOWED_ORIGINS` conserva solamente la plataforma y desarrollo
  local; los dominios de clientes provienen de la base verificada.

## Pruebas ejecutadas

- `tenant_core_rls.sql`: bloqueo de lectura, alta, cambio y borrado cruzado en
  productos, clientes, pedidos y partidas. PASS despues de la correccion.
- `catalog_quick_filters_rls.sql`: aislamiento completo de filtros. PASS.
- `tenant_domains_rls.sql`: aislamiento de dominios y verificacion exclusiva de
  superadministrador. PASS.
- `all_tenant_select_isolation.sql`: cuenta real de Estuches Chavez contra todas
  las tablas directas con `tenant_id`. PASS.
- `sin_piedra.test.mjs`: conserva la exclusion especial de productos con piedra.
  PASS.
- `client_access_cors.test.mjs`: acepta el dominio verificado, rechaza un origen
  ajeno y exige autenticacion. PASS.
- `public_quote_submission_security.sql`: como usuario anonimo rechaza productos
  inventados, usa los precios aprobados y frena reenvios inmediatos. PASS.
- `npm audit`: cero vulnerabilidades conocidas.
- `supabase db lint`: cero errores de esquema.
- `npm run build:proxy`: compila y genera recursos bajo `/catalogo/assets/`.

## Situacion de Paco

- Dominio: `www.estucheschavez.com.mx`.
- Ruta autorizada: `/catalogo`.
- Tenant: `estuches-chavez`.
- Estado del dominio en la plataforma: activo y verificado.
- Hosting detectado: HostGator sobre Apache.
- Estado externo actual: el sitio principal responde `200`; `/catalogo/`
  responde `403` porque el proxy aun no esta instalado.

## Pendientes antes de compradores reales

1. Integrar la estetica final de Claude y aprobarla en staging.
2. Pedir al webmaster que confirme si HostGator permite proxy inverso. Si no,
   usar Cloudflare o un conector ligero.
3. Ejecutar `npm run check:proxy -- https://www.estucheschavez.com.mx/catalogo/`
   despues de conectar la ruta.
4. Crear monitoreo externo y una URL de emergencia controlada por la plataforma.

Completado posteriormente: registro publico desactivado, contrasenas de minimo
10 caracteres, proteccion HIBP activada y URLs de retorno separadas para staging
y produccion.

Los headers reforzados estan preparados en `vercel.json`, pero deben verificarse
otra vez despues del siguiente despliegue central y a traves del proxy de Paco.
Las ligas publicas siguen siendo accesos por token de forma intencional. Para una
apertura masiva conviene agregar proteccion anti-bot en una Edge Function.

## Advertencia honesta

Ningun sistema puede prometer riesgo cero. La garantia responsable consiste en
aislamiento probado, contraseñas administradas por Supabase, dominios verificados,
actualizaciones centrales, monitoreo y respuesta documentada ante incidentes.
