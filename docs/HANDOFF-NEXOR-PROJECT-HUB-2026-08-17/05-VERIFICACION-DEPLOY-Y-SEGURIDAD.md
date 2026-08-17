# Verificación, deploy y seguridad

## Separación de ambientes

| Ambiente | Identificador | Regla |
| --- | --- | --- |
| Supabase staging | `vafqcvpzksjlrborxoos` | Permitido para esta vertical |
| Supabase producción | `pyignizeoevafifzfnik` | No tocar |
| Web staging | `catalogo-b2b-staging-security.vercel.app` | Único destino de despliegue |

Antes de una operación sobre la base de datos, confirmar que el identificador visible es el de staging. Si no puede confirmarse, detener la operación.

## Comandos del proyecto

```powershell
npm run build
npm run build:staging
npm run seed:staging
npm run deploy:staging
```

El seed modifica staging y solo debe repetirse de manera intencional. Revisar primero `scripts/seed-staging.ps1` y confirmar que el proyecto enlazado sea `vafqcvpzksjlrborxoos`.

## Variables y secretos

- No copiar valores de `.env*` a documentación, commits, capturas o mensajes.
- No registrar contraseñas de Supabase, tokens personales ni tokens de Vercel.
- Los nombres de proyectos y URLs no son secretos; las credenciales sí.
- Ejecutar `git diff --cached` antes de cada commit.

## Evidencia existente

- Build normal aprobado.
- Build staging aprobado.
- Migraciones funcionales aplicadas.
- Seed funcional aplicado.
- Auditoría verificada.
- Navegación y aperturas principales verificadas en staging.
- Screenshots guardados para escritorio y móvil.
- Deployment final de staging listo: `dpl_F8gxhTmntF8w7djRWpyUh5qnBLpL`.
- Actividad cancelada visible, negra, operable y excluida del avance.
- Studio y portal consumen el mismo cálculo de avance confirmado.
- QA público sin errores de consola y sin desbordamiento móvil.

## Pendientes de verificación

- Repetir Supabase DB lint cuando exista `SUPABASE_DB_PASSWORD` en una sesión segura.
- Recapturar desktop y móvil cuando la API de screenshot vuelva a responder; los PNG actuales son del corte anterior.

## Definición de respaldo completo

Un respaldo de este hito requiere:

1. archivos guardados en el repositorio canónico;
2. commit local;
3. rama empujada a GitHub;
4. etiqueta de respaldo empujada;
5. staging verificable;
6. esta carpeta actualizada.

El despliegue no sustituye Git y Git no sustituye la base de datos. Los tres deben mantenerse trazables.
