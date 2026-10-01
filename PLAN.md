# Proyecto Cartas: plan del MVP

## Objetivo

Crear una aplicación sencilla para buscar cartas de Magic: The Gathering y construir mazos, priorizando el uso personal y evitando al principio funciones sociales o un simulador de partidas.

## Principios

- Scryfall es la fuente canónica del catálogo de cartas.
- Separar la identidad de reglas de una carta (`CardDefinition`) de cada impresión física (`CardPrinting`).
- No agregar base de datos hasta que el flujo del MVP esté definido; los datos locales actuales viven solo mientras el servidor está activo.
- Mantener módulos y servicios independientes para que la persistencia se pueda añadir después.
- No implementar un motor de reglas de partidas.

## Fases

### 1. Catálogo estable - completado

- [x] Definir los modelos de definición e impresión.
- [x] Buscar cartas desde Scryfall con paginación y respuesta normalizada.
- [x] Cubrir respuestas vacías y fallos de Scryfall con pruebas.
- [x] Documentar los endpoints y límites de esta integración.

Endpoint inicial: `GET /cards/search?q=<consulta>&page=1`. Devuelve definiciones y una impresión por resultado. No persiste los resultados; usa páginas de Scryfall y limita las peticiones a una cada 100 ms.

El CRUD temporal administra entradas `CardCatalogEntry` con `{ definition, printing }`. `GET /cards/:id`, `PATCH /cards/:id` y `DELETE /cards/:id` identifican una impresión por `printing.id`; actualizar una entrada no cambia ese ID. Para agregar una impresión a la lista temporal, `POST /cards` recibe el objeto de una entrada. Esto no modifica ni guarda datos en Scryfall.

### 2. Mazos - implementado en memoria

- [x] Crear/listar/consultar/editar/eliminar mazos.
- [x] Agregar, quitar, actualizar cantidad y mover cartas entre zonas.
- [x] Referenciar la impresión concreta por `printingId` y conservar snapshot de catálogo.
- [x] Validar tamaño, legalidad, límite de copias y comandante/identidad.
- [x] Exponer conteos, colores, tipos y curva de maná.

Rutas: `GET/POST /decks`, `GET/PATCH/DELETE /decks/:id`, `POST /decks/:id/cards`, `PATCH/DELETE /decks/:id/cards/:printingId`, `GET /decks/:id/validation` y `GET /decks/:id/statistics`.

Formato del mazo: `{ "name": "Azorius", "format": "standard", "description": "..." }`. Para agregar una carta: `{ "card": <objeto data[i] de /cards/search>, "quantity": 4, "zone": "mainboard" }`. Las zonas son `mainboard`, `sideboard` y `commander`.

Standard: al menos 60 en mainboard, hasta 15 en sideboard, máximo cuatro copias por Oracle ID excepto tierras básicas, y cada carta debe venir marcada legal en Standard por Scryfall. Commander: exactamente 100 contando una carta en zona commander, un solo comandante elegible en este MVP, singleton excepto tierras básicas e identidad de color contenida dentro de la del comandante. Las cartas fuera de reglas se bloquean al agregarlas; el endpoint de validación informa conteo/tamaño y demás incidencias. Las cartas con datos faltantes de legalidad no se aceptan como legales.

El endpoint de validación de Standard usa la legalidad que Scryfall reporte en el snapshot; no calcula rotaciones por fecha local. Partners, Backgrounds y otros casos de múltiples comandantes no están soportados aún.

### 3. Búsqueda y construcción - en progreso

- [x] Filtros de nombre, color, identidad, tipo, valor de maná, texto Oracle y expansión en `/cards/search`.
- [x] Estadísticas básicas del mazo para la futura interfaz.
- [x] Crear una interfaz React/Vite en `frontend/` con búsqueda, filtros, selector/creación de mazos, edición de cantidades y zonas, métricas y validación.
- [x] Importar/exportar respaldos versionados `.cardtable.json`, conservando edición, cantidad y zona.

Ejecutar backend con `npm run start:dev` y frontend con `npm run start:frontend`. En desarrollo Vite reenvía `/cards` y `/decks` al backend en el puerto 3001. Ambos datos de mazos y colección de cartas locales son temporales y se pierden al reiniciar Nest.

Respaldo: `GET /decks/:id/export` produce `{ schemaVersion: 1, exportedAt, deck }`; `POST /decks/import` valida e importa como un mazo nuevo con ID nuevo. La app incluye descarga/carga JSON. Las importaciones son atómicas y aceptan hasta 500 renglones; Nest limita JSON a 2 MB.

### 4. Persistencia y cuentas (siguiente decisión de producto)

- Elegir base de datos cuando se conozcan las consultas y relaciones necesarias.
- Añadir usuarios, propiedad de mazos y visibilidad solo si hacen falta.
- Añadir colección personal y funciones sociales como fases separadas.

## Fuera del alcance inicial

- Simulación de turnos, combate o resolución de reglas.
- Mercado, precios históricos o gestión de inventario comercial.
- Comentarios, seguimiento, rankings y otras funciones sociales.

## Decisiones y límites actuales

- El catálogo consultado a Scryfall no se persiste; cada búsqueda depende de la disponibilidad de su API.
- Las impresiones se conservan separadas de la definición Oracle para permitir varias ediciones, idiomas y acabados de una misma carta.
- Antes de publicar la aplicación, revisar las condiciones de uso y atribución de Scryfall y de las imágenes de cartas.
- Los mazos actuales solo viven en memoria del proceso. El snapshot identifica la edición exacta (`printingId`) y deja mostrar el mazo sin volver a consultar cada carta, pero no es persistencia durable.
- Al incorporar base de datos, modelar `Deck` y `DeckCard` con FK a `CardPrinting` (Scryfall printing ID) y guardar cantidad/zona. Mantener Oracle ID para agrupar reimpresiones y contar copias; no usar el Oracle ID como identidad de impresión.
- Arquitectura actual y recomendada: monolito modular NestJS. `cards`, `decks` y futuras cuentas son módulos con contratos claros. Scryfall ya está aislado detrás de `ScryfallService`; eso basta como límite de integración.
- No crear microservicios ahora: no hay escala independiente, equipo distribuido, despliegue separado ni carga medida que lo justifique. Reconsiderar un servicio de catálogo solo si sincronización/caché/uso de recursos necesita escalar o desplegarse por separado.
- No agregar guards hasta que exista autenticación y una política de acceso. Al añadir usuarios, implementar guard de autenticación y guard/policy de propietario del mazo; un guard de rol no sustituye comprobar que el mazo pertenece al usuario.
- Antes de exponer la API públicamente, agregar `ValidationPipe` global con `class-validator`/`class-transformer` y DTOs runtime; los tipos TS y las validaciones manuales actuales no validan automáticamente todos los campos anidados.