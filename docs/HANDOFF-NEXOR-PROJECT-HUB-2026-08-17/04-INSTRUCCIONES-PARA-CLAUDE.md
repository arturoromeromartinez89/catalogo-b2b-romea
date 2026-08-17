# Instrucciones exactas para Claude

## Tu encargo

Continúa la primera vertical funcional del Project Hub de NEXOR IA desde el estado existente. No rediseñes el concepto, no cambies contenido de negocio ni rompas funciones del catálogo. Tu objetivo inmediato es cerrar las correcciones de revisión, verificar staging y dejar un respaldo auditable.

Trabaja en:

```text
C:\Users\Vanguardia\Documents\GitHub\catalogo-b2b-romea-project-hub-deploy
```

Rama obligatoria:

```text
codex/project-hub-staging
```

Antes de tocar código, lee completa esta carpeta, `PRODUCT.md`, `DESIGN.md` y `docs/NEXOR-PROJECT-OPERATING-MODEL.md`. Después ejecuta `git status --short` y revisa los cambios existentes. Preserva todo. No uses `git reset --hard`, `git checkout --`, limpieza destructiva ni producción.

## Correcciones prioritarias de cierre

Resuelve en este orden:

1. En la lista móvil del cronograma, aplica modificadores de estado a solución y tareas para conservar azul, verde, naranja, rojo, negro y gris, siempre con texto.
2. No filtres las tareas canceladas del cronograma. Muéstralas en negro y permite abrir su detalle; mantenlas excluidas de todos los cálculos de avance.
3. En `ProjectHubManager`, sustituye todo texto visible como “2 · Ficha” y “Ficha vN” por “Ficha de solución”, agregando versión solo como metadato secundario comprensible.
4. Alinea `ProjectHubManager.confirmedProgress` con el cálculo del portal, incluyendo la exclusión coherente de elementos cancelados. Debe existir una sola regla de cálculo.
5. En `SolutionWorkspace`, reutiliza el mapa global completo de estados. Nunca muestres claves internas como `planned`, `waiting`, `needs_changes` o `cancelled` al usuario.
6. Actualiza `DESIGN.md`: documenta un cronograma único, soluciones desplegables in situ y lista móvil sin timeline horizontal. Elimina la prescripción obsoleta Cronograma/Tablero.
7. Elimina el kicker “Próximos 3 meses” encima de “Cronograma de soluciones”. Integra el horizonte temporal en el título o texto auxiliar, una sola vez.

Mantén sin cambios conceptuales:

- la placa asimétrica de Inicio;
- el orden dashboard → métricas → cronograma;
- la visibilidad de avance y atención en el primer viewport móvil;
- el banner que identifica los datos demostrativos;
- el único cronograma que se transforma en lista móvil;
- las acciones Aprobar y Solicitar cambios;
- la regla madre y la jerarquía canónica.

## Verificación obligatoria

Después de corregir:

```powershell
npm run build
npm run build:staging
git diff --check
```

No vuelvas a ejecutar el detector visual histórico de Impeccable: ya se ejecutó una vez y sus avisos restantes corresponden principalmente a acentos laterales y deuda previa no material para esta extensión.

Si dispones de la contraseña de base de datos de staging de forma segura, ejecuta el lint enlazado de Supabase sin imprimir ni guardar la credencial. Si no existe, regístralo como verificación pendiente; no inventes la variable ni pidas acceso a producción.

Despliega únicamente staging:

```powershell
npm run deploy:staging
```

Verifica en la URL canónica:

- Inicio carga sin errores.
- La placa no aparece al cambiar a Soluciones, Entregables, Documentos o Decisiones.
- La solución se despliega dentro del cronograma.
- Todas las tareas, incluida una cancelada, conservan estado y abren su detalle.
- La vista móvil no requiere scroll horizontal y conserva estados legibles.
- Los datos sintéticos siguen identificados como demo.

## Entrega y respaldo

1. Actualiza `00-LEEME-PRIMERO.md` y `03-ESTADO-TECNICO-Y-ARQUITECTURA.md` con el nuevo estado.
2. Guarda capturas desktop y móvil actualizadas en `.impeccable/review/`.
3. Ejecuta `git diff --check` y revisa que no haya secretos.
4. Crea un commit descriptivo en la rama existente.
5. Empuja la rama a `origin`.
6. Si la vertical queda cerrada, crea y empuja una etiqueta de respaldo con fecha.
7. Informa el commit, la URL verificada, pruebas pasadas y cualquier pendiente real.

## Lo siguiente después del cierre

No saltes directamente a contratos o automatizaciones. El siguiente bloque es Fase 2 del plan maestro: alta hipersimple de cliente y proyecto, con objetivo, meta, alcance, exclusiones, fechas, etapas, roles y publicación. Diseña primero el flujo y su modelo de datos; usa un proyecto real como piloto antes de generalizar.
