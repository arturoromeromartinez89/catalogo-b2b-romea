# Ambientes y politica de versiones

## Por que existen dos versiones

La plataforma ya maneja informacion real de empresas. Probar cambios sobre la
misma aplicacion o base que usa Paco puede alterar productos, pedidos, accesos o
seguridad. Por eso existen dos ambientes independientes:

| Ambiente | Uso | Vercel | Supabase |
|---|---|---|---|
| STAGING / PRUEBAS | Desarrollo, revision y aprobacion | `catalogo-b2b-staging-security` | branch `staging-security` (`vafqcvpzksjlrborxoos`) |
| PRODUCCION / VIVA | Clientes y datos reales | `catalogo-b2b-romea` | `pyignizeoevafifzfnik` |

Paco y los proxies de clientes apuntan solamente a produccion. Staging utiliza
una URL controlada por Romea y datos ficticios. Una falla en staging no debe
afectar a un cliente real.

## Reglas que no se negocian

1. Ningun cambio se prueba por primera vez en produccion.
2. Staging nunca usa la URL ni las llaves de Supabase de produccion.
3. No se copian datos reales de clientes a staging. Si se requiere una muestra,
   debe anonimizarse antes de salir de produccion.
4. Toda modificacion SQL vive en `supabase/migrations`; no se pega SQL manual en
   produccion.
5. RLS, Auth, CORS, dominios y Edge Functions se prueban primero en staging.
6. Solo `main` representa codigo candidato a produccion. El trabajo nuevo usa
   ramas `feature/*`, `fix/*`, `claude/*` o `codex/*`.
7. Un despliegue productivo requiere aprobacion humana explicita.

## Flujo de implementacion

1. Crear una rama desde `main` actualizado.
2. Implementar el cambio sin mezclar refactors no relacionados.
3. Ejecutar compilacion y pruebas locales.
4. Aplicar migraciones en Supabase staging.
5. Desplegar en Vercel staging.
6. Revisar escritorio, movil, sesiones, permisos y flujo afectado.
7. Registrar evidencia y riesgos pendientes.
8. Obtener aprobacion.
9. Integrar en `main` y crear una etiqueta de version.
10. Aplicar primero las migraciones compatibles y despues desplegar frontend.
11. Observar produccion y conservar una ruta clara de regreso.

## Numeros de version

Mientras el producto siga en MVP se usa `0.MENOR.PARCHE`:

- `0.1.0`: primera entrega controlada para Paco.
- `0.1.1`: correccion pequena o de seguridad sin funcion nueva.
- `0.2.0`: funcion nueva compatible.
- `1.0.0`: primera version comercial estable.
- `2.0.0`: cambio incompatible que requiere migracion o capacitacion.

Cada version productiva debe tener etiqueta Git `vX.Y.Z`, fecha, cambios,
migraciones, pruebas realizadas, aprobador y version anterior recuperable.

## Base de datos y rollback

El frontend de Vercel puede volver a un despliegue anterior con rapidez. La base
no debe depender de "deshacer" una migracion destructiva. Se usa el patron:

1. **Expandir:** agregar columnas o tablas compatibles.
2. **Migrar:** desplegar codigo que soporte estructura vieja y nueva.
3. **Comprobar:** verificar datos y uso real.
4. **Retirar:** eliminar lo antiguo en una version posterior.

Nunca se renombra o elimina una columna usada por la version viva en el mismo
despliegue que introduce su reemplazo.

## Politica de publicacion

- Cambios normales: publicar en una ventana con tiempo para observar.
- Seguridad critica: puede publicarse de inmediato despues de pasar staging.
- No publicar una mezcla de cambios no revisados.
- No publicar mientras otra persona modifica los mismos archivos.
- Para mas clientes: activar cambios por tenant en etapas: equipo interno,
  piloto, 10 por ciento y finalmente todos.

## Lista minima antes de produccion

- Build y pruebas automatizadas en verde.
- Migraciones probadas en staging.
- Aislamiento entre dos tenants cuando cambian datos o permisos.
- Login, cierre y recuperacion verificados si cambia Auth.
- Escritorio y movil revisados si cambia interfaz.
- CORS y security headers verificados si cambia despliegue.
- Version y notas de cambio preparadas.
- Aprobacion explicita y responsable disponible para observar el despliegue.

## Situacion actual

Staging existe como infraestructura separada y sin datos de Paco. La base es una
rama de Supabase aislada y Vercel es un proyecto independiente. Las variables
locales sensibles viven en `.env.staging.local`, ignorado por Git.

El dominio `www.estucheschavez.com.mx/catalogo/` no debe conectarse a staging.
Cuando el proxy se instale, siempre apuntara al proyecto Vercel de produccion.

## Operacion diaria de staging

URL: `https://catalogo-b2b-staging-security.vercel.app/catalogo/`

El acceso ficticio local se encuentra en `.env.staging.credentials.local`. El
archivo esta ignorado por Git y nunca debe compartirse como credencial real.

Preparar enlaces locales una sola vez:

```powershell
npx vercel link --yes --project catalogo-b2b-staging-security
npx supabase link --project-ref vafqcvpzksjlrborxoos
```

Comandos habituales:

```powershell
npm run build:staging
npm run seed:staging
npm run deploy:staging
```

`deploy:staging` comprueba los IDs de Vercel y Supabase antes de publicar. Se
detiene si cualquiera apunta a produccion. En la salida de Vercel, la palabra
`Production` significa la URL estable del proyecto de staging, no la plataforma
viva de clientes.

## Publicacion a produccion

No existe un comando automatico de produccion por decision de seguridad. Debe
crearse despues de integrar y aprobar el flujo completo. Antes de publicar hay
que enlazar conscientemente el proyecto productivo, ejecutar las comprobaciones
de ambiente y dejar evidencia de la version aprobada.
