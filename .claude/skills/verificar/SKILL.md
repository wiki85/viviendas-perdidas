---
name: verificar
description: Ejecutar la cadena completa de calidad del proyecto (typecheck, format, lint, tests, build e integración con emulador) en el orden correcto y con un único resumen final. Usar antes de commits importantes y siempre antes de desplegar.
---

# Verificación completa

Ejecuta desde la **raíz del repositorio**, en este orden (parar y arreglar en cuanto algo falle es más barato que seguir):

```bash
npm run typecheck        # 1. TS en workspaces + scripts
npm run format:check     # 2. Prettier (el CI lo exige)
npm run lint             # 3. ESLint, --max-warnings 0: un solo warning rompe el CI
npm test                 # 4. unitarios (vitest) en apps/web y functions
npm run build            # 5. web + functions (prebuild ejecuta sync:geo) + scripts
```

6. Integración (requiere Java ≥ 21 para el emulador de Firestore):

```bash
firebase emulators:exec --only firestore --project demo-viviendas-perdidas "npm run test:integration"
```

Si el emulador no puede arrancar (falta Java, puerto ocupado), decláralo explícitamente en el resumen como **no ejecutado**, nunca como pasado.

## Notas

- Un solo test: `npx vitest run <fichero.test.ts>` desde el workspace del fichero (`apps/web` o `functions`). En `functions`, `pretest` ejecuta `sync:geo` solo.
- Los tests tocan red jamás: si un test nuevo necesita datos de un portal autonómico, se le dan fixtures.
- Nada de verificación dinámica contra producción; solo emuladores.

## Resumen final

Termina siempre con un único bloque de estado, por ejemplo:

```
typecheck ✔ · format ✔ · lint ✔ · tests 312/312 ✔ · build ✔ · integración 24/24 ✔
```

y, si algo falló, el fichero:línea del primer error de cada paso fallido y qué se hizo (o queda por hacer) para arreglarlo.
