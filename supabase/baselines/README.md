# Baseline de base de datos

La fotografia `schema-only` del esquema publico de produccion se conserva en
el respaldo privado de NEXOR, no en este repositorio publico. Aqui se versiona
unicamente `production-manifest.json`, que permite comprobar su identidad sin
publicar la estructura interna.

- PostgreSQL origen: 17.6
- pg_dump: 17.11
- tablas funcionales: 42
- politicas RLS: 90
- funciones publicas: 17
- SHA-256: `d247b08b9876d626e9a55e0c106dbbd9a2033d70d2b27c2d267444b98b418c50`

La restauracion desde cero fue verificada en PostgreSQL 17.11 con stubs locales
para `auth.users`, `auth.uid()` y el rol `authenticated`. El dump privado es un
punto de arranque y auditoria; nunca debe ejecutarse sobre una base existente.
