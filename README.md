# Catálogo B2B ROMEA Joyería

MVP web para catálogo mayorista de joyería. Permite cargar productos desde Excel, crear y editar productos manualmente, buscar con chips, filtrar, armar una preorden tipo nota de venta y generar un PDF comercial con identidad ROMEA.

No incluye backend, login, base de datos, pagos, inventario en tiempo real ni conexión con ERP.

## Cómo correr

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite, normalmente:

```text
http://localhost:5173
```

Para validar producción:

```bash
npm run build
```

## Flujo principal

1. Usa el menú izquierdo para cargar Excel, descargar plantilla o crear un producto.
2. Cambia el idioma con el selector **ES / EN** de la parte superior derecha.
3. Busca productos con texto libre o chips.
4. Combina filtros rápidos y filtros laterales.
5. Abre el detalle de un producto para editar, duplicar o agregar a preorden.
6. Abre la ceja derecha **Preorden** para trabajar como nota de venta.
7. Captura datos generales, cliente y Ship To.
8. Genera el PDF.

## Idiomas

La app permite cambiar entre español e inglés en cualquier momento. El idioma seleccionado afecta:

- Interfaz principal.
- Botones y filtros.
- Plantilla Excel descargable.
- Exportación del catálogo actualizado.
- PDF de preorden / nota de venta.

La carga de Excel acepta encabezados en español o inglés.

## Excel

La plantilla se descarga como `plantilla_catalogo_romea.xlsx` y contiene las hojas `Catalogo_Web` e `Instrucciones`.

Columnas del catálogo:

```text
codigo
modelo
descripcion
metal
kilataje
linea
familia
grupo
genero
acabado
piedra
medida
estatus
peso_promedio
unidad_venta
clave_venta
precio_minimo
moneda_precio_min
foto_url
foto_url_2
foto_url_3
visible_web
orden_web
tags_busqueda
```

Columnas obligatorias para importar:

```text
codigo
descripcion
metal
familia
peso_promedio
foto_url
visible_web
tags_busqueda
```

Reglas: `visible_web` debe ser `1`, `SI`, `Sí`, `TRUE`, `true` o `Activo`; `estatus` con `Baja` se excluye; pesos y precios se leen como números.

## Productos manuales

El botón **Nuevo producto** abre un formulario con ayuda por campo. Desde el detalle puedes **Editar producto** o **Duplicar producto**. Los cambios se guardan en `localStorage`.

El botón **Descargar catálogo actualizado** exporta productos cargados y creados manualmente como `catalogo_romea_actualizado.xlsx`.

## Búsqueda

El buscador acepta chips: escribe `anillo caballero`, presiona Enter y queda como filtro. Puedes agregar otros como `piedra negra`. Todo se combina con filtros rápidos y laterales.

## Preorden y PDF

La preorden se abre desde la ceja derecha y se muestra como hoja de trabajo / nota de venta con datos generales, Ship To, tabla de productos y totales.

El PDF se genera en carta vertical con:

- Proveedor ROMEA.
- Cliente.
- Ship To.
- Tabla de productos con foto pequeña cuando sea posible.
- Totales.
- Instrucciones para confirmar.
- Cuentas bancarias configurables.
- Términos comerciales.

Si una imagen externa falla por CORS, el PDF sigue funcionando y muestra `Sin imagen`.

## Configuración ROMEA

Edita `src/config/companyInfo.js` para configurar marca, RFC, teléfono, correo, ciudad, logos, instrucciones, términos y cuentas bancarias.

Logos soportados en `public/`:

```text
public/logo-romea.png
public/logo-romea-r.png
public/caja-romea.png
```

## Despliegue en Vercel

1. Sube el proyecto a Git.
2. Crea un proyecto en Vercel.
3. Framework: Vite.
4. Build command: `npm run build`.
5. Output directory: `dist`.

## Limitaciones

- La V2 usa Supabase para login, clientes, catálogos asignados y listas de precio.
- Para activar Supabase copia `.env.example` a `.env` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase antes de usar la V2.
- Después de crear el primer usuario, conviértelo en admin con:

```sql
update public.profiles set role = 'admin' where email = 'admin@tuempresa.com';
```

- El admin puede crear clientes, catálogos, asignar productos a varios catálogos y asignar listas de precio por gramo.
- El cliente entra con correo y contraseña, y solo ve catálogos asignados.
- El precio cliente se calcula con la lista de precio por gramo más la mano de obra del producto.
- No hay historial de preórdenes ni envío automático por correo.
- Las imágenes externas del PDF dependen de CORS.
- El bundle es grande por `xlsx` y `jsPDF`; puede optimizarse con carga dinámica en una versión 2.
