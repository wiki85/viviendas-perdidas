---
name: desplegar
description: Desplegar Viviendas Perdidas a producción (Firebase) de forma segura, en el orden correcto y con smoke tests posteriores contra aquiviviamos.com. Usar cuando el usuario pida desplegar, publicar o subir cambios a producción.
---

# Despliegue seguro

El proyecto Firebase es `mapa-de-despoblacion` (producción: https://www.aquiviviamos.com). `firebase deploy` requiere confirmación explícita (regla `ask`): no lo lances sin que el usuario lo pida claramente.

## 1. Antes de desplegar

1. Ejecuta `/verificar` entero y confirma que está **todo en verde** (incluida la integración con emulador).
2. Revisa qué se despliega: `git status` y `git diff --stat`. Si tocaste `firestore.rules`, `storage.rules`, `firestore.indexes.json` o `firebase.json`, léelos completos: un error aquí expone datos o cuesta dinero.
3. Confirma que no hay secretos ni `.env*` en el working tree a punto de subirse.

## 2. Orden de despliegue (no alterar)

Los índices deben existir antes de que las Functions que dependen de ellos entren en servicio:

```bash
firebase deploy --only firestore:rules,firestore:indexes
firebase deploy --only functions
firebase deploy --only hosting
```

Si el cambio es solo de frontend, basta `--only hosting`. Si solo tocaste una función, puedes acotar: `--only functions:<nombre>`.

## 3. Smoke tests post-despliegue (solo lectura)

Contra producción, con `curl` de solo lectura (nunca `-X`/`-d`/`-F`):

```bash
curl -sS -D - -o /dev/null --max-time 20 https://www.aquiviviamos.com/                 # 200 + cabeceras CSP
curl -sS -D - -o /dev/null --max-time 20 https://www.aquiviviamos.com/ciudad/sevilla    # página de ciudad (SSR)
curl -sS -D - -o /dev/null --max-time 20 https://www.aquiviviamos.com/embed/sevilla/cifras   # embed (siempre con sufijo /cifras o /evolucion)
curl -sS --max-time 25 https://www.aquiviviamos.com/datos/export -o /tmp/export.json      # export público
curl -sS -D - -o /dev/null --max-time 20 https://www.aquiviviamos.com/fuentes             # /fuentes
```

Comprueba: HTTP 200, cabeceras de seguridad presentes (CSP estricta, sin `unsafe-inline` fuera de lo previsto), y que `/datos/export` devuelve JSON válido con contadores plausibles. Verifica que las capas vecinal y oficial siguen sin mezclarse en los totales.

## 4. Sincronización de fuentes oficiales (si aplica)

Si el despliegue incluye una fuente oficial nueva o modificada, dispara su sincronización sin esperar al job semanal, mediante el callable `adminSyncOfficialData` (desde el panel `/admin` con una cuenta de `ADMIN_EMAILS`), y luego revisa con `node scripts/estado-fuentes.mjs`.

## 5. Resumen

Informa: qué targets se desplegaron, resultado de cada smoke test (código HTTP), y cualquier acción pendiente (sincronización manual, verificación visual en móvil).
