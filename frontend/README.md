# Cardtable Web

Cliente React + TypeScript servido por Vite. Consume la API Nest del repositorio padre.

Desde la raíz del repositorio:

```powershell
npm install --prefix frontend
npm run start:frontend
```

Vite publica la app en `http://localhost:5173` y reenvía `/cards` y `/decks` a Nest en `http://localhost:3001`.

Compilar y revisar estilo desde la raíz:

```powershell
npm run build:frontend
npm run lint:frontend
```
