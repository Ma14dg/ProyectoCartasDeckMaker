# Cardtable

Aplicación sencilla para buscar cartas de Magic: The Gathering y construir mazos Standard o Commander. El proyecto es un monolito modular NestJS con un cliente React/Vite independiente en `frontend/`.

## Requisitos

- Node.js compatible con la versión instalada de Nest/Vite.
- Conexión a internet para consultar Scryfall y cargar imágenes/tipografía externas.

## Ejecutar localmente

Abre dos terminales desde la raíz del repositorio.

Terminal 1, API Nest en `http://localhost:3001`:

```powershell
npm install
npm run start:dev
```

Terminal 2, interfaz Vite en `http://localhost:5173`:

```powershell
npm install --prefix frontend
npm run start:frontend
```

El proxy de Vite reenvía `/cards` y `/decks` a Nest en el puerto 3001. Si cambias el puerto del backend, actualiza `frontend/vite.config.ts`.

## Qué puedes probar

- Buscar cartas e impresiones desde Scryfall por nombre, color, tipo, valor de maná o expansión.
- Crear y editar mazos Standard o Commander.
- Añadir una impresión concreta a mainboard, sideboard o zona de comandante.
- Cambiar cantidades, mover cartas entre zonas y quitar cartas.
- Revisar legalidad reportada por Scryfall, tamaño, copias, identidad de color, comandante, colores y curva de maná.
- Exportar e importar respaldos `.cardtable.json`, conservando las ediciones exactas y zonas.

Los endpoints principales están listados en [PLAN.md](PLAN.md). La interfaz está en `frontend/`.

## Persistencia y límites

No hay base de datos ni cuentas todavía. Mazos y cartas agregadas al catálogo manual se guardan en memoria y desaparecen al reiniciar Nest. Las búsquedas consultan Scryfall y no se guardan localmente. Las validaciones de Commander cubren un solo comandante; partners y otros casos avanzados están pendientes. Standard usa la legalidad actual que devuelve Scryfall y no implementa un calendario de rotación propio.

Antes de publicar la aplicación, revisar las condiciones de uso y atribución de Scryfall y sus imágenes.

## Verificación

Desde la raíz:

```powershell
npm run build
npm test
npm run test:e2e
npm run lint
```

Para verificar el cliente:

```powershell
npm run build:frontend
npm run lint:frontend
```

Para mantener el proyecto corriendo, deja las dos terminales abiertas. Detén cada proceso con `Ctrl+C`.
