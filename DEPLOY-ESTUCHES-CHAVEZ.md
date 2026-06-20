# Publicacion del MVP de Estuches Chavez

Estado al 20 de junio de 2026: funcion segura, migraciones, RLS, tenant, datos de empresa y filtros ya aplicados en produccion. Vercel tambien esta actualizado. Solo falta la configuracion de Auth indicada abajo y la carga del ZIP en cPanel.

## 1. Supabase

Aplicar en este orden:

1. En Authentication > URL Configuration, agregar:
   - Site URL: `https://www.estucheschavez.com.mx/catalogo/`
   - Redirect URL: `https://www.estucheschavez.com.mx/catalogo/`
   - Mantener `https://catalogo-b2b-romea.vercel.app/` como respaldo.
2. En Authentication, desactivar el registro publico de usuarios. Las invitaciones administrativas siguen siendo el mecanismo de alta.

La cuenta administradora activa de Estuches Chavez ya existe.

Antes de continuar, ejecutar en SQL Editor:

- `supabase/tests/catalog_quick_filters_rls.sql`
- `supabase/tests/tenant_core_rls.sql`

Ambos deben terminar solo con mensajes `PASS`.

## 2. Compilacion

```powershell
npm ci
npm run build:chavez
```

El contenido listo para publicar queda dentro de `dist`. Confirmar que incluye el archivo oculto `.htaccess`.

## 3. cPanel de HostGator

1. Abrir File Manager y activar `Show Hidden Files`.
2. Entrar a `public_html/catalogo/`.
3. Descargar un respaldo de lo que exista antes de cambiarlo.
4. Subir el contenido de `dist`, no la carpeta `dist` completa.
5. Confirmar que `public_html/catalogo/index.html` y `public_html/catalogo/.htaccess` existen.
6. Abrir `https://www.estucheschavez.com.mx/catalogo/` en una ventana privada.

No modificar los archivos del sitio principal. El tecnico del sitio solo necesita agregar un enlace hacia `/catalogo/` cuando Paco lo apruebe.

## 4. Verificacion

- El sitio principal sigue abriendo en `/index.php`.
- `/catalogo/` abre el login con marca Estuches Chavez.
- Paco inicia y cierra sesion.
- Recuperar contraseña vuelve a `/catalogo/`, no a la pagina principal.
- Una cotizacion en `/catalogo/cotizacion/:token` abre al recargar.
- Los productos sin foto no muestran un cuadro de reemplazo.
- Los headers incluyen CSP, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` y `Permissions-Policy`.

## 5. Regreso rapido

Si algo falla, retirar los archivos nuevos de `public_html/catalogo/` y restaurar el respaldo. El sitio principal no debe verse afectado y Vercel permanece disponible.
