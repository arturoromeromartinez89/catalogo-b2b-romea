# Conexion de clientes mediante proxy

## Objetivo

El navegador conserva una URL como `https://www.estucheschavez.com.mx/catalogo/`,
pero el contenido se obtiene de la aplicacion central. El sitio principal del
cliente no se reemplaza.

## Requisitos antes de activar

1. Registrar el hostname y `/catalogo` en `tenant_domains`.
2. Verificar el control del dominio antes de marcarlo como `active`.
3. Publicar la aplicacion central con `npm run build:proxy`.
4. Confirmar que la instalacion central responde en `/catalogo/` y que sus
   recursos responden en `/catalogo/assets/`.
5. Crear un monitor para la URL exacta del cliente.

Los administradores de tenant no pueden autorizar dominios. Esa operacion es
exclusiva del superadministrador.

## Configuracion del hosting del cliente

La persona responsable del hosting debe enviar `/catalogo/` y todo lo que cuelga
de esa ruta al origen central, conservando el metodo, query string y hostname
original. El resto del sitio debe seguir atendido por el hosting actual.

No se deben guardar credenciales permanentes de cPanel. Las opciones aceptables
son: configuracion por el webmaster del cliente, acceso temporal limitado o una
cuenta tecnica revocable.

No existe una regla universal de `.htaccess`: algunos hostings compartidos
deshabilitan el proxy inverso. Antes de instalar se debe identificar si usan
Apache/cPanel, Nginx, Cloudflare u otro proveedor y aplicar la plantilla
correspondiente.

## Verificacion por instalacion

- El sitio principal del cliente sigue respondiendo.
- `/catalogo/` devuelve la aplicacion y no una copia local.
- Una ruta interna puede recargarse sin error.
- Los archivos bajo `/catalogo/assets/` cargan correctamente.
- Inicio, cierre y recuperacion de sesion conservan `/catalogo/`.
- El origen aparece activo y verificado en `tenant_domains`.
- CORS acepta el dominio verificado y rechaza uno no registrado.
- Los headers CSP, HSTS, `nosniff`, frame y permisos llegan al navegador.
- El monitor externo detecta disponibilidad, tiempo de respuesta y certificado.

## Riesgo y contingencia

La URL depende tanto de la plataforma central como del dominio, certificado y
hosting del cliente. Si el hosting del cliente falla, `/catalogo/` tambien falla
aunque la plataforma central este sana.

Cada cliente debe recibir una URL de emergencia bajo un dominio controlado por
la plataforma. Esa URL no sustituye la direccion habitual; permite diagnosticar
y mantener acceso durante una falla del hosting del cliente.
