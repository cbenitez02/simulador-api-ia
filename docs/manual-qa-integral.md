# Manual QA Integral - Simulador API IA

## 1) Objetivo

Este documento define una estrategia de QA manual para validar de punta a punta la aplicacion:

- Flujos funcionales principales de la web.
- Comportamiento backend asociado a cada flujo.
- Permisos y restricciones por rol (`owner`, `editor`, `viewer`).
- Casos negativos y de regresion rapida antes de liberar.

## 2) Alcance

Incluye:

- Frontend Angular y navegacion por secciones del workspace.
- API de gestion bajo `/api/v1`.
- Mock runtime bajo `/mock`.
- Logs, auditoria, OpenAPI, snapshots y miembros de workspace.

No incluye:

- Automatizacion de pruebas.
- Pruebas de carga/formales de performance.
- Pentesting profundo.

## 3) Entorno y precondiciones

## Entorno recomendado

- Backend corriendo en `http://localhost:3000`.
- Frontend corriendo en `http://127.0.0.1:4200`.
- Base de datos con migraciones aplicadas.
- Configuracion runtime correcta (`apiBaseUrl`, `mockBaseUrl` y auth si corresponde).

## Herramientas para ejecucion manual

- Navegador con DevTools.
- Cliente HTTP (Postman/Insomnia/cURL) para validaciones directas de API.
- Acceso a DB o data admin opcional para sembrado/control de datos.

## Cuentas de prueba minimas

- `owner_user` (dueno del workspace personal y owner en workspace colaborativo).
- `editor_user` (miembro editor en workspace colaborativo).
- `viewer_user` (miembro viewer en workspace colaborativo).
- `outsider_user` (sin membresia en el workspace bajo prueba).

## Datos semilla minimos

- 1 workspace colaborativo con al menos 1 proyecto.
- 1 proyecto con `slug` conocido.
- 2 endpoints existentes (metodos diferentes).
- 1 endpoint con escenarios multiples.
- Logs existentes (generados contra `/mock`).
- Al menos 1 snapshot previo.

## 4) Inventario funcional y cobertura

| Modulo            | Ruta UI                    | API backend principal                                                        | Cobertura minima                                     |
| ----------------- | -------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------- |
| Auth / sesion     | `/auth`                    | middleware auth `/api/v1/*`                                                  | Estado autenticado/no autenticado y acceso protegido |
| Shell workspace   | `/:navId`                  | `/api/v1/projects`, `/api/v1/workspaces/:workspaceId/members`                | Carga, error, sin acceso, cambio de proyecto/seccion |
| Dashboard         | `/dashboard`               | `/api/v1/projects/:projectId/dashboard-summary`                              | Resumen, enlaces y estados vacios                    |
| Endpoints         | `/endpoints`               | `/api/v1/projects/:projectId/endpoints`                                      | Listado, filtros, CRUD, validaciones                 |
| Scenarios         | panel detalle endpoint     | `/api/v1/endpoints/:endpointId/scenarios`                                    | CRUD de escenarios y autorizacion                    |
| Configuracion     | drawers/paneles            | `/api/v1/projects/:projectId/config`, `/api/v1/endpoints/:endpointId/config` | Lectura/edicion y efecto en mock                     |
| Logs              | `/logs`                    | `/api/v1/projects/:projectId/logs`                                           | Listado, detalle, filtros, limpieza                  |
| Auditoria         | `/history`                 | `/api/v1/projects/:projectId/audit-events`                                   | Eventos posteriores a mutaciones                     |
| OpenAPI           | utilidades dashboard/shell | `/api/v1/projects/:projectId/openapi`                                        | Export, analyze, import y errores de archivo         |
| Snapshots         | utilidades dashboard       | `/api/v1/projects/:projectId/snapshots`                                      | Crear, listar, restaurar                             |
| Workspace members | `/workspace`               | `/api/v1/workspaces/:workspaceId/members`                                    | Listar, invitar y eliminar segun rol                 |
| Account sections  | `/account-*`               | N/A (principalmente UI)                                                      | Navegacion, estado visual y continuidad de shell     |
| Mock runtime      | N/A (consumo externo)      | `/mock/:projectSlug/*`                                                       | Resolucion de endpoint, latencia, logging y codigos  |

## 5) Matriz de permisos por rol

| Recurso / accion                  | owner    | editor   | viewer   | outsider     |
| --------------------------------- | -------- | -------- | -------- | ------------ |
| Ver proyectos de su workspace     | Si       | Si       | Si       | No (403)     |
| Crear/editar/eliminar proyecto    | Si       | Si       | No (403) | No (403/404) |
| Crear/editar/eliminar endpoints   | Si       | Si       | No (403) | No           |
| Crear/editar/eliminar escenarios  | Si       | Si       | No (403) | No           |
| Editar config global/endpoint     | Si       | Si       | No (403) | No           |
| Ver logs y auditoria              | Si       | Si       | Si       | No           |
| Limpiar logs                      | Si       | Si       | No (403) | No           |
| Exportar OpenAPI                  | Si       | Si       | Si       | No           |
| Importar OpenAPI                  | Si       | Si       | No (403) | No           |
| Crear/restaurar snapshots         | Si       | Si       | No (403) | No           |
| Listar miembros workspace         | Si       | Si       | Si       | No           |
| Invitar/eliminar miembros         | Si       | No (403) | No (403) | No           |
| Eliminarse del workspace personal | No (409) | N/A      | N/A      | N/A          |

## 6) Casos criticos paso a paso

Formato:

- **ID**
- **Prioridad**
- **Precondiciones**
- **Pasos**
- **Resultado esperado**

### CP-001 - Acceso protegido del workspace

- Prioridad: Alta
- Precondiciones: Usuario no autenticado.
- Pasos:
  1. Ir a `/dashboard`.
  2. Observar redireccion o estado de auth.
  3. Iniciar sesion y volver a `/dashboard`.
- Resultado esperado:
  - Sin autenticacion, no accede al contenido protegido.
  - Con autenticacion, carga shell y contenido normal.

### CP-002 - Carga inicial del shell y cambio de secciones

- Prioridad: Alta
- Precondiciones: `owner_user` autenticado con al menos un proyecto.
- Pasos:
  1. Abrir `/dashboard`.
  2. Navegar por `endpoints`, `logs`, `history`, `workspace`, `account-profile-settings`.
  3. Volver a `dashboard`.
- Resultado esperado:
  - Sidebar y header persisten.
  - Cada seccion renderiza sin error.
  - No hay perdida inesperada del proyecto activo.

### CP-003 - CRUD de endpoint desde UI

- Prioridad: Alta
- Precondiciones: `owner_user` o `editor_user`.
- Pasos:
  1. Ir a `endpoints`.
  2. Crear endpoint nuevo.
  3. Editar nombre/path/metodo.
  4. Eliminar endpoint.
- Resultado esperado:
  - Operaciones responden exitosamente.
  - Listado se actualiza en UI.
  - Se registra evento en auditoria.

### CP-004 - Restriccion viewer al mutar endpoint

- Prioridad: Alta
- Precondiciones: `viewer_user` autenticado.
- Pasos:
  1. Ir a `endpoints`.
  2. Intentar crear o editar endpoint.
  3. Si existe acceso via API client, enviar `POST/PATCH/DELETE`.
- Resultado esperado:
  - UI bloquea acciones o backend responde `403`.
  - No hay cambios persistidos.

### CP-005 - Filtros y orden en listado de endpoints

- Prioridad: Media
- Precondiciones: Proyecto con varios endpoints.
- Pasos:
  1. Aplicar busqueda por texto (`q`).
  2. Filtrar por metodo HTTP.
  3. Cambiar orden.
  4. Limpiar filtros.
- Resultado esperado:
  - Resultados coinciden con filtros y orden elegidos.
  - Se puede volver al estado completo.

### CP-006 - CRUD de escenarios por endpoint

- Prioridad: Alta
- Precondiciones: Endpoint existente seleccionado.
- Pasos:
  1. Abrir detalle de endpoint.
  2. Crear escenario nuevo.
  3. Editar respuesta/estado del escenario.
  4. Eliminar escenario.
- Resultado esperado:
  - Operaciones exitosas para owner/editor.
  - Para viewer, intento de mutacion es denegado.

### CP-007 - Configuracion de endpoint y efecto en mock

- Prioridad: Alta
- Precondiciones: Endpoint con config editable.
- Pasos:
  1. Ajustar latencia/configuracion del endpoint.
  2. Ejecutar request al mock del endpoint.
  3. Medir impacto observable (ej. demora).
- Resultado esperado:
  - Configuracion se guarda.
  - Request mock refleja la configuracion aplicada.

### CP-008 - Logs: generacion y consulta

- Prioridad: Alta
- Precondiciones: Proyecto con endpoint mock disponible.
- Pasos:
  1. Enviar 3-5 requests al `/mock/:projectSlug/*`.
  2. Abrir `logs`.
  3. Filtrar por metodo y/o estado.
  4. Abrir detalle de una entrada.
- Resultado esperado:
  - Las entradas aparecen en orden esperado.
  - El detalle muestra datos clave de request/response.

### CP-009 - Limpieza de logs

- Prioridad: Media
- Precondiciones: Proyecto con logs cargados.
- Pasos:
  1. Con owner/editor, ejecutar limpiar logs.
  2. Refrescar listado.
  3. Repetir intento con viewer.
- Resultado esperado:
  - Owner/editor: `DELETE` exitoso y listado vacio.
  - Viewer: accion denegada (`403`) o bloqueada en UI.

### CP-010 - Auditoria posterior a mutaciones

- Prioridad: Alta
- Precondiciones: Ejecutar previamente mutaciones (crear endpoint, editar escenario, etc.).
- Pasos:
  1. Ir a `history`.
  2. Buscar eventos recientes.
  3. Validar actor, accion y resumen.
- Resultado esperado:
  - Eventos recientes existen y son coherentes con acciones ejecutadas.
  - Paginacion/cursor funciona sin duplicados inesperados.

### CP-011 - Export de contrato OpenAPI

- Prioridad: Alta
- Precondiciones: Proyecto con endpoints.
- Pasos:
  1. Ejecutar export en JSON.
  2. Ejecutar export en YAML (si UI lo permite, si no via API client).
  3. Verificar nombre de archivo y contenido basico.
- Resultado esperado:
  - Descarga exitosa y contenido valido.
  - Headers de respuesta presentes (incluyendo warnings si aplica).

### CP-012 - Analyze/import OpenAPI (happy path)

- Prioridad: Alta
- Precondiciones: Archivo OpenAPI valido.
- Pasos:
  1. Subir archivo para analisis.
  2. Revisar resumen de impacto.
  3. Confirmar import.
  4. Verificar endpoints importados.
- Resultado esperado:
  - Analisis devuelve informacion util.
  - Import aplica cambios esperados.
  - Auditoria registra la accion.

### CP-013 - Analyze/import OpenAPI sin archivo

- Prioridad: Media
- Precondiciones: Ninguna.
- Pasos:
  1. Llamar endpoint de analyze/import sin archivo adjunto (via API client).
- Resultado esperado:
  - Respuesta `400` con codigo `OPENAPI_FILE_REQUIRED`.

### CP-014 - Snapshot y restore de proyecto

- Prioridad: Alta
- Precondiciones: Proyecto con estado conocido.
- Pasos:
  1. Crear snapshot.
  2. Hacer cambios en endpoints.
  3. Restaurar snapshot creado.
  4. Revalidar estado del proyecto.
- Resultado esperado:
  - Snapshot se crea y lista correctamente.
  - Restore revierte al estado esperado.
  - Auditoria refleja create/restore.

### CP-015 - Gestion de miembros por owner

- Prioridad: Alta
- Precondiciones: `owner_user` + usuario destino existente.
- Pasos:
  1. Ir a `workspace`.
  2. Invitar miembro por email con rol viewer/editor.
  3. Verificar que aparezca en listado.
  4. Remover miembro.
- Resultado esperado:
  - Alta y baja exitosas.
  - Errores controlados para usuario no existente (`404`) y miembro duplicado (`409`).

### CP-016 - Restriccion de miembros para no-owner

- Prioridad: Alta
- Precondiciones: `editor_user` y `viewer_user`.
- Pasos:
  1. Intentar invitar miembro desde UI y/o API.
  2. Intentar remover miembro.
- Resultado esperado:
  - Operaciones de mutacion denegadas (`403`).
  - Lectura de miembros se mantiene disponible si tiene acceso.

### CP-017 - Restriccion personal workspace owner membership

- Prioridad: Media
- Precondiciones: `owner_user` en su workspace personal.
- Pasos:
  1. Intentar eliminar su propia membresia del personal workspace (API client).
- Resultado esperado:
  - Respuesta `409` con codigo `PERSONAL_WORKSPACE_OWNER_MEMBERSHIP_REQUIRED`.

### CP-018 - Mock runtime: resolucion y no encontrado

- Prioridad: Alta
- Precondiciones: `projectSlug` valido y endpoint conocido.
- Pasos:
  1. Ejecutar request valido a `/mock/:projectSlug/...`.
  2. Ejecutar request a path inexistente.
  3. Ejecutar request con `projectSlug` inexistente.
- Resultado esperado:
  - Path valido responde segun escenario configurado.
  - Paths/slug invalidos responden `404`.
  - Logs se registran segun nivel configurado.

### CP-019 - Dashboard summary consistente

- Prioridad: Media
- Precondiciones: Proyecto con datos (endpoints/logs/snapshots).
- Pasos:
  1. Abrir dashboard.
  2. Contrastar contadores con datos de otras secciones.
- Resultado esperado:
  - Resumen coincide con estado real del proyecto.

### CP-020 - Navegacion account sections

- Prioridad: Baja
- Precondiciones: Usuario autenticado.
- Pasos:
  1. Navegar por `/account-profile-settings`, `/account-api-keys`, `/account-notifications`, `/account-security`, `/account-usage`, `/account-plan-billing`.
- Resultado esperado:
  - Cada ruta carga correctamente.
  - Se mantiene la estructura del shell sin romper navegacion principal.

## 7) Casos negativos transversales (API/UI)

- **NT-001** - Solicitud a `/api/v1/*` sin autenticacion: debe responder `401` con `AUTH_REQUIRED`.
- **NT-002** - Usuario sin membresia accede a recursos de otro workspace: `403` (`WORKSPACE_ACCESS_DENIED`) o `404` segun recurso.
- **NT-003** - IDs inexistentes (`projectId`, `endpointId`, `memberUserId`): validar `404` y mensaje consistente.
- **NT-004** - Validaciones de formularios UI (email invalido, campos obligatorios vacios, inputs fuera de rango): debe mostrar feedback y no enviar mutacion invalida.
- **NT-005** - Errores de red temporales: UI debe mostrar estado de error recuperable (sin romper shell global).

## 8) Checklist smoke/regresion pre-release

Ejecutar en cada release candidate:

1. `GET /health` y `GET /ops/health` responden OK.
2. Login funcional y acceso a `/dashboard`.
3. Crear endpoint y verlo en listado.
4. Ejecutar request al mock y ver log generado.
5. Confirmar evento en auditoria por accion reciente.
6. Export OpenAPI de proyecto.
7. Crear y restaurar snapshot corto.
8. Validar permisos: viewer no puede mutar endpoint.
9. Validar permisos: editor/viewer no gestionan miembros.
10. Verificar que rutas account cargan sin error.

Si falla cualquiera de los puntos 1-8, bloquear release hasta correccion.

## 9) Criterios de aprobacion QA

Un ciclo QA manual se considera aprobado cuando:

- 100% de casos de prioridad Alta ejecutados.
- 0 defectos abiertos de severidad Critica/Alta.
- Defectos Medios con decision explicita (fix ahora vs backlog).
- Sin regresiones en smoke checklist.

## 10) Plantilla de evidencia y reporte de defectos

## Registro de ejecucion por caso

| Campo         | Valor esperado                           |
| ------------- | ---------------------------------------- |
| Fecha/hora    | Timestamp de ejecucion                   |
| Ambiente      | Local / Staging / otro                   |
| Build/commit  | Identificador exacto                     |
| Caso          | ID del caso (ej. `CP-003`)               |
| Tester        | Nombre responsable                       |
| Resultado     | Pass / Fail / Blocked                    |
| Evidencia     | Link o referencia a screenshot/video/log |
| Observaciones | Notas de comportamiento                  |

## Plantilla de bug

- **Titulo:** `[Modulo] descripcion breve`
- **Severidad:** Critica / Alta / Media / Baja
- **Prioridad:** P0 / P1 / P2 / P3
- **Ambiente:** local/staging + version
- **Precondiciones:** datos y usuario usados
- **Pasos para reproducir:** lista numerada
- **Resultado actual:** que ocurre
- **Resultado esperado:** que deberia ocurrir
- **Evidencia:** screenshots, video, payload, response
- **Impacto:** funcional, seguridad, datos, UX

## 11) Orden sugerido de ejecucion

1. Smoke basico (seccion 8).
2. Casos criticos de autorizacion (`CP-001`, `CP-004`, `CP-016`).
3. CRUD principal (`CP-003`, `CP-006`, `CP-008`).
4. Integridad historica (`CP-010`, `CP-014`).
5. OpenAPI y rutas avanzadas (`CP-011`, `CP-012`, `CP-013`).
6. Cobertura restante media/baja.

Con ese orden se detectan primero fallas bloqueantes y de permisos antes de invertir tiempo en escenarios secundarios.
