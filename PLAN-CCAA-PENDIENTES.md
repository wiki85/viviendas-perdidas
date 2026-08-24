# Plan de incorporación de las CCAA pendientes

> **Estado (24-08-2026, tarde):** las fases 1-4 están **IMPLEMENTADAS** (fuentes `eiv`, `cnt`, `lrj`, `gij` y `avi`, con parsers, tests, jobs y atribuciones). Quedan vivas las **gestiones administrativas** del final y la vigilancia de frescura de Cantabria. Este documento se conserva como registro de la investigación que fundamentó cada integración.

Estado a 24 de agosto de 2026: 15 fuentes espejadas cubren 14 de 17 CCAA (Baleares a medias: faltan Ibiza y Formentera). Pendientes: **Asturias, Cantabria, La Rioja, Ibiza, Formentera** (+ Ceuta y Melilla, descartadas). Todos los datos de este plan proceden de muestreos acotados verificados el 24-08-2026 por tres agentes de exploración; lo no verificado se marca como supuesto.

Regla de oro (petición expresa): **solo fuentes oficiales** (registro de turismo o portal institucional) **y actualizadas** (frescura verificada, no declarada).

## Orden propuesto

| Fase | Territorio             | Veredicto                        | Esfuerzo                                    | Bloqueos previos                            |
| ---- | ---------------------- | -------------------------------- | ------------------------------------------- | ------------------------------------------- |
| 1    | **Ibiza (eiv)**        | Integrable ya                    | Medio (patrón Murcia + carril Catastro)     | Ninguno técnico; licencia = Ley 37/2007     |
| 2    | **Cantabria (cnt)**    | Integrable tras 2 verificaciones | Bajo en código; alto en verificación        | Licencia D.87/2013 + frescura sin confirmar |
| 3    | **La Rioja (lrj)**     | Integrable con trabajo extra     | Alto (PDF posicional + WAF + URL rotatoria) | Ninguno administrativo                      |
| 4    | **Asturias (gij/avi)** | Parcial, vía municipal           | Medio (2 fuentes pequeñas)                  | Aclarar licencia del visor de Gijón         |
| —    | **Formentera**         | Sin fuente pública               | —                                           | Solicitud formal al Consell                 |
| —    | **Ceuta y Melilla**    | Descartadas                      | —                                           | Sin dato abierto y volumen ínfimo (~40 VUT) |

## Fase 1 — Ibiza (`eiv`)

**Fuente (verificada):** Portal de Registres Turístics del Consell d'Eivissa, export vivo `https://registreturistic.conselldeivissa.es/export_xls.asp?ETT_id=14` — tabla HTML servida como `.xls`, ISO-8859-1, generada en cada petición desde la base del registro (no depende del catálogo CAIB, que NO tiene datasets pitiusos).

- **Volumen verificado:** 2.361 viviendas útiles (Sant Josep 945, Santa Eulària 802, Sant Antoni 329, Sant Joan 245, Eivissa 40). Figuras: ETV 1.537, ET 700, VTV 89, VT 40 — todas vivienda completa (`entire: true`).
- **Esquema (14 columnas):** `Tipus`, `Sub-tipus`, `Número Inscripció`, `Nom Comercial`, `Categoria`, `Total Habitacions`, `Total Places`, `Referència cadastral`, `Explotador`, `Direcció`, `Municipi`, `Telèfon`, `Email`, `Pàgina Web`. Tercer esquema balear: no reutiliza los parsers de Mallorca ni Menorca.
- **Ubicación:** 0% coordenadas, **98,5% referencia catastral** → carril `Consulta_CPMRC` con la caché `catastro-*` existente; geocodificación por dirección solo para el ~1,5% residual (direcciones rústicas sucias).
- **Licencia:** sin declarar → reutilización Ley 37/2007, con el precedente editorial de Murcia y Aragón.
- **Trampas verificadas:** 5 filas fantasma (`NUEVO BOLSA DE PLAZAS`, excluir); `#` inicial en el número de inscripción (limpiar); 7 números duplicados (desambiguar con hash de dirección, como Menorca); PII a descartar (`Explotador` con NIF, `Telèfon`, `Email`); sin columna de estado (el listado público solo contiene vigentes — supuesto razonable).
- **Integración:** `domain/eivissa.ts` + test con fixtures reales; `services/eivissa-source.ts` reutilizando el patrón de tabla HTML de `murcia-source.ts` (incluida la decodificación de entidades); `idPrefix: 'eiv-'`; `MIN_EXPECTED_EIVISSA_ROWS ≈ 1.500`; job `syncEivissa` en hueco libre (propuesto: **martes 05:30**); atribución ×4 (README, `/fuentes` con puntuación, `official-sources.ts` con `coordinatesCredit` del Catastro, MethodologyPage/AboutPage).

## Fase 2 — Cantabria (`cnt`)

**Fuente (verificada):** capa «Viviendas Turísticas» del servicio ArcGIS REST oficial `https://geoservicios.cantabria.es/inspire/rest/services/Turismo_Infraestructura_Turistica/MapServer/3/query` (datos de la DG de Turismo). 806 viviendas hoy (Suances 89, San Vicente 63, Miengo 52, Laredo 33, Santander 29, Noja 21, Santillana 17, Castro-Urdiales 9…). Campos con `modalidad` separable (ALQUILER COMPLETO 765 / COMPARTIDO 41), `num_plazas`, dirección desglosada y **geometría nativa EPSG:25830** (el servidor reproyecta a 4326 con `outSR`). Una sola request cubre todo (maxRecordCount 2000).

**Verificaciones ANTES de escribir código:**

1. **Frescura:** el abstract declara «anual» pero el recuento (806) encaja con la hipótesis de registro vivo post-Decreto 50/2025 (529 regularizadas en mayo → 806 en agosto). Muestrear el recuento semanalmente 2-3 semanas: si crece, es vivo; si no, contactar con la DG de Turismo antes de integrar.
2. **Licencia:** «Licencia de Uso No Comercial» del Decreto 87/2013 — leer el decreto y validar que el proyecto (sin ánimo de lucro) encaja; atribuir conforme a él. Si hay dudas, consulta escrita.

- **Riesgo técnico principal:** sin número de registro estable (`signatura` = "VUT" literal) ni referencia catastral → identidad sintética por dirección normalizada (mismo enfoque que Madrid y CLM, con su coste conocido: correcciones = alta+baja).
- **Integración:** primera fuente ArcGIS REST (código ≈ CSV tipo Madrid en esfuerzo); `idPrefix: 'cnt-'`; mapear código INE → nombre con la capa 7 «Municipios» del propio servicio; `MIN_EXPECTED_CANTABRIA_ROWS ≈ 500`; job propuesto: **viernes 06:30**.

## Fase 3 — La Rioja (`lrj`)

**Fuente (verificada):** «Listado de Viviendas autorizadas» del Registro de Proveedores de Servicios Turísticos — **PDF mensual** enlazado desde `https://web.larioja.org/oficina-electronica/tramite?n=24269` (edición «VUT AGOSTO 2026»: 1.795 viviendas en 120 municipios; Logroño 827, Haro 153, Ezcaray 103). Número de registro estable `VT-LR-NNNN`. Sin plazas, sin coordenadas, sin catastro.

- **Ubicación:** geocodificación por dirección cacheada (gemelo de Navarra).
- **Piezas nuevas necesarias:** (1) descubrimiento del enlace en dos saltos — la URL del PDF rota con cada edición (supuesto verificado parcialmente; jamás fijarla); (2) **parser de PDF posicional** (pdfminer-style por coordenadas X/Y; sin precedente en el repo — evaluar `pdf-parse`/`pdfjs-dist` en functions); (3) WAF: HTTP/1.1 + User-Agent de navegador (el fetch de Node pasa añadiendo UA).
- **Licencia:** sin CC explícita; atribuir «Registro de Proveedores de Servicios Turísticos, DG de Turismo del Gobierno de La Rioja (Ley 37/2007; Decreto 19/2013)».
- **Integración:** `idPrefix: 'lrj-'`; `MIN_EXPECTED_RIOJA_ROWS ≈ 900`; municipios: Logroño (y opcional Haro, Ezcaray); job propuesto: **lunes 05:30** (el PDF es mensual; el job semanal reintenta sin coste). Contraste de umbral: la serie Jaxi de Estadística riojana (agregados por municipio).

## Fase 4 — Asturias, vía municipal (`gij` + `avi`)

**El Principado NO publica el REAT** (verificado: los PDF de turismoasturias.es son guías promocionales sin número de registro; el catálogo «profesional» tiene captcha; SADEI solo agregados). Vía utilizable hoy, dos fuentes municipales oficiales:

- **Gijón (`gij-`):** visor municipal de VUT con licencia urbanística — GeoJSON embebido en `https://documentos.gijon.es/doc/Urbanismo/PGO/Interactivo_vuts/layers/Vutsconcedidas_3.js`. **2.690 VUT verificadas**, expediente único estable, coordenadas WGS84 nativas 100%, ref. catastral 99,8%, sin plazas. Actualización trimestral declarada (Last-Modified 20-jul-2026). **Bloqueo previo:** el visor no declara licencia → pedir al Ayuntamiento su alta como dataset abierto o confirmación de reutilización. Riesgo: la ruta del export qgis2web puede cambiar al regenerar el visor.
- **Avilés (`avi-`):** CKAN municipal `datos.aviles.es` (dataset «Alojamientos turísticos», **CC BY verificada**) — 158 VUT vigentes con signatura REAT (`VUT.1097.AS`), plazas y ref. catastral 100%. Rezagado (última modificación feb-2026): vigilar antes de integrar. Trampas: 403 sin User-Agent; NBSP en valores.
- **En paralelo (sin código):** solicitud formal de reutilización del REAT al Principado — el dato existe estructurado (Avilés lo republica); si se consigue, sustituiría a las fuentes municipales y cubriría Oviedo, Llanes y Ribadesella.
- Job propuesto: **jueves 05:30** (ambas fuentes, escalonadas o combinadas).

## Gestiones administrativas (sin código, lanzar ya)

1. **Formentera:** solicitud de reutilización al Consell (turisme@formentera.es / Ordenació Turística), citando que el Reglament 1/2015 obliga a publicitar el número de registro. Mientras, vigilar el catálogo CAIB. (~900-950 viviendas estimadas.)
2. **Asturias:** solicitud del REAT al Principado (ver Fase 4).
3. **Cantabria:** validación de la licencia del Decreto 87/2013 (y consulta de frescura si el monitoreo no concluye).
4. **Gijón:** petición de licencia/alta en catálogo del visor de VUT.

## Notas transversales

- **Huecos de scheduler libres** (tandas actuales 04:30/05:30/06:30/07:30): lunes 05:30, martes 05:30, miércoles 05:30, jueves 05:30, viernes 06:30, sábado 05:30, domingo 05:30.
- **Barrios:** ninguna ciudad candidata tiene GeoJSON en `apps/web/public/geo/` — no bloquea nada (Vigo o Zaragoza tampoco lo tienen); `/nueva-ciudad` opcional después (candidatas: Logroño, Gijón, Eivissa).
- Cada fase sigue la skill `/nueva-fuente-oficial` completa: parser + test con fixtures reales del muestreo, servicio con `MIN_EXPECTED_*`, registro en el runner con `idPrefix` único, job escalonado, atribución en los 4 sitios obligatorios, verificación y despliegue con `/desplegar` + sync manual.
- Tras cada integración, actualizar la ficha y puntuación de `/fuentes` (rúbrica común) y la fecha de «Última revisión».
