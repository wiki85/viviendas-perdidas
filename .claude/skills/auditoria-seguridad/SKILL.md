---
name: auditoria-seguridad
description: Lanzar una auditoría de seguridad profesional del proyecto siguiendo la metodología de Security Assessment/. Usar cuando el usuario pida una revisión de seguridad, pentest o análisis de vulnerabilidades de la aplicación.
---

# Auditoría de seguridad

La metodología completa vive en `Security Assessment/CLAUDE.md` (carpeta privada, solo local, gitignored). Esta skill la pone al alcance desde la raíz del repositorio.

## Cómo proceder

1. Lee `Security Assessment/CLAUDE.md` para cargar el modelo de amenaza, las 10 áreas de revisión priorizadas y el formato de entregables (hallazgos `VP-NNN` con severidad, ubicación `fichero:línea`, escenario de explotación, evidencia y recomendación).
2. Para una auditoría amplia, delega en el agente **`auditor-seguridad`**, que ya encapsula esa metodología y está restringido a solo lectura sobre el código.
3. **Reglas absolutas:**
   - Auditoría de **solo lectura** sobre el código: no modifiques `apps/`, `functions/`, reglas ni configuración de Firebase.
   - Los únicos ficheros que se crean o editan viven dentro de `Security Assessment/` (`REPORT.md`, `findings/`…), que nunca se versiona ni despliega.
   - Verificación dinámica **solo en emuladores locales**, jamás contra producción ni contra APIs de Google con credenciales reales.
4. Contrasta cada promesa de seguridad/privacidad del README con el código real: toda promesa incumplida es un hallazgo. Distingue lo **confirmado** (leído/reproducido) de lo **probable no verificado**. Incluye una sección de controles positivos.

## Entregables

En `Security Assessment/`: `REPORT.md` (resumen ejecutivo, alcance, metodología, tabla de hallazgos, detalle y conclusiones) y opcionalmente `findings/` con un fichero por hallazgo.
