# Roadmap Post-MVP — De MVP funcional a producto serio

## Propósito

Este documento propone un roadmap para evolucionar `simulador-api-ia` desde su estado actual de **MVP funcional** hacia un **producto serio, operable y escalable**. El criterio de priorización no está basado en “features lindas”, sino en madurez real de producto, seguridad, operación y sostenibilidad técnica.

---

## Resumen ejecutivo

El proyecto **ya superó la etapa de idea o prototipo**. Hoy existe una base concreta con:

- frontend funcional en Angular
- backend de gestión y runtime mock real
- persistencia real con Prisma/PostgreSQL
- logs y dashboard básicos
- flujos asistidos por IA
- CI con validaciones relevantes

En otras palabras: **sí, el MVP existe**.

Pero también hay una conclusión importante: el sistema todavía está en estado de **validación interna / beta cerrada**, no en estado de **producto serio listo para uso abierto o comercial**.

La principal brecha no es la falta de más pantallas. La brecha real está en:

- autenticación y autorización
- modelo multiusuario / multi-tenant
- endurecimiento operativo
- observabilidad seria
- coherencia de producto en funcionalidades visibles
- estrategia de despliegue y operación

---

## Estado actual del MVP

### Capacidades que ya existen

#### Producto

- creación, edición, listado y eliminación de proyectos
- gestión de endpoints
- gestión de escenarios
- configuración global del comportamiento mock
- dashboard principal
- visualización de logs
- flujo asistido por IA para previsualizar y generar endpoints

#### Backend

- API de gestión
- runtime mock real bajo `/mock/:projectSlug/*`
- persistencia real con PostgreSQL
- logging de requests del runtime
- dashboard summary backend-driven
- validaciones con Zod

#### Frontend

- workspace funcional
- dashboard y navegación principal
- UI para endpoints, configuración global y logs
- runtime config mediante `app-config.js`

#### Calidad

- CI con lint, tests, coverage y validaciones de PR
- frontend con validación de build productivo en CI
- backend con checks de cobertura e integración DB

### Qué significa realmente este estado

Este MVP ya permite demostrar valor, validar uso y enseñar el producto. No es humo. No es una maqueta. Pero todavía depende de supuestos típicos de etapa temprana:

- un único contexto de uso implícito
- ausencia de usuarios reales con permisos
- observabilidad limitada
- hardening incompleto
- algunas funcionalidades visibles todavía no implementadas

---

## Principios de priorización del roadmap

Este roadmap sigue cinco principios:

1. **Seguridad antes que comodidad**
   - no se incorporan usuarios reales sin auth, ownership y autorización.

2. **Operación antes que adorno**
   - antes de sumar features vistosas, el sistema debe ser desplegable, monitoreable y gobernable.

3. **Coherencia de producto antes que expansión artificial**
   - una feature visible pero vacía daña más que una feature todavía no expuesta.

4. **Escalabilidad después de estabilidad**
   - no tiene sentido optimizar para escala si todavía faltan capas básicas de producto.

5. **Madurez por fases, no por ansiedad**
   - el paso sano es: asegurar base, endurecer operación, cerrar superficie, luego diferenciar.

---

## Brechas principales entre MVP y producto serio

### 1. Identidad, acceso y ownership

Faltan:

- autenticación
- usuarios
- organizaciones o workspaces
- ownership por proyecto
- roles y permisos

Sin esto, el sistema no puede considerarse plataforma real.

### 2. Tenancy y aislamiento

Hoy el eje del dominio es `Project`, pero no existe una capa formal que garantice separación por cliente, cuenta o equipo.

### 3. Hardening operativo

Persisten riesgos como:

- rate limiting en memoria del proceso
- configuración sensible todavía inmadura para despliegues abiertos
- observabilidad básica pero insuficiente
- ausencia de una política clara de retención y control de crecimiento de logs

### 4. Coherencia visible del producto

Existen acciones o superficies visibles que todavía no están terminadas, por ejemplo:

- `settings`
- `test all`
- `export`
- `import`
- knobs avanzados mostrados pero todavía no plenamente soportados

Esto afecta la percepción de solidez.

### 5. Operación y evolución del negocio

Faltan decisiones más serias sobre:

- despliegue reproducible
- monitoreo y alertas
- auditoría
- escalado
- versionado futuro de configuraciones y contratos

---

## Roadmap recomendado por fases

## Fase 1 — Base seria de producto

### Objetivo

Convertir el MVP en un sistema donde puedan entrar usuarios reales sin exponer todo ni depender de supuestos peligrosos.

### Prioridad

**Máxima**

### Enfoque

Esta fase no se trata de sumar “más producto”; se trata de construir la **base mínima seria** para que el producto exista en el mundo real.

### Cambios recomendados

#### Identidad y acceso

- implementar autenticación real
- introducir entidad `User`
- introducir `Organization`, `Workspace` o modelo equivalente
- asociar proyectos a un owner o espacio de trabajo
- definir autorización por proyecto
- establecer roles iniciales (por ejemplo: owner, editor, viewer)

#### Seguridad y configuración

- endurecer política de CORS
- revisar manejo de secretos y variables de entorno
- asegurar que las URLs públicas del mock salgan de config real y no de supuestos locales
- revisar exposición pública de endpoints de gestión y mock

#### Calidad del backend en CI

- reforzar validaciones del backend en CI
- asegurar chequeos equivalentes de build/type safety si faltan
- formalizar más claramente qué condiciones bloquean un merge

### Resultado esperado

Al final de esta fase, el proyecto debería poder decir:

- “tenemos usuarios y ownership”
- “cada proyecto pertenece a alguien o a un workspace”
- “nadie toca lo que no le corresponde”
- “la configuración base del sistema ya es apta para entornos no locales”

### Riesgos si se posterga

- exposición total de recursos
- imposibilidad de abrir beta real
- deuda conceptual cada vez más cara de resolver

---

## Fase 2 — Hardening operacional

### Objetivo

Hacer que el sistema sobreviva al uso real, a errores reales y a cargas moderadas sin comportamiento frágil.

### Prioridad

**Alta**

### Enfoque

Una vez que el acceso está controlado, lo siguiente es que el sistema pueda **operarse con disciplina**.

### Cambios recomendados

#### Runtime y protección

- reemplazar o complementar el rate limiting en memoria con una estrategia distribuida o persistente
- establecer límites de payload y políticas anti abuso
- revisar timeouts y tolerancia a fallos externos

#### Observabilidad seria

- logs estructurados
- métricas técnicas y de negocio
- error tracking
- alertas operativas mínimas
- trazabilidad de requests críticos

#### Gestión de datos operativos

- definir retención de logs
- limpieza o archivado
- revisar tamaño de payloads persistidos en modo full

#### Performance base

- paginación y filtros sólidos
- revisar fan-out innecesario entre frontend y backend
- identificar consultas o agregaciones que escalen mal

#### Operación y despliegue

- estrategia reproducible de despliegue
- contenedorización o setup equivalente para producción
- checklist de configuración por entorno

### Resultado esperado

Al final de esta fase, el sistema debería poder decir:

- “si algo falla, lo podemos ver”
- “si el uso sube, el sistema no colapsa por supuestos del MVP”
- “la operación básica ya es predecible”

### Riesgos si se posterga

- incidentes difíciles de diagnosticar
- crecimiento de costos por logs/datos sin control
- inconsistencia al escalar el runtime

---

## Fase 3 — Cierre de superficie funcional

### Objetivo

Eliminar el desalineamiento entre lo que la UI promete y lo que el producto realmente soporta.

### Prioridad

**Media**

### Enfoque

Un producto serio no solo tiene que funcionar: también tiene que sentirse coherente y honesto.

### Cambios recomendados

- implementar `export config`
- implementar `import endpoints`
- implementar `test all endpoints`
- terminar `settings` o removerlo hasta tener alcance real
- revisar knobs avanzados visibles y decidir:
  - o se implementan
  - o se ocultan
  - o se explican mejor como alcance futuro

### Resultado esperado

Al final de esta fase, la experiencia debería transmitir:

- consistencia
- menor frustración del usuario
- menor deuda UX/producto
- mayor credibilidad del sistema

### Riesgos si se posterga

- pérdida de confianza del usuario
- percepción de producto “a medio hacer”
- soporte innecesario por confusión funcional

---

## Fase 4 — Escala y diferenciación

### Objetivo

Transformar la base ya estabilizada en una plataforma con capacidades competitivas y preparadas para crecer.

### Prioridad

**Media/Alta según estrategia comercial**

### Enfoque

Esta fase ya no es de supervivencia. Es de expansión, posicionamiento y escalabilidad de negocio.

### Cambios recomendados

#### Multi-tenant y colaboración

- modelo multi-tenant sólido
- colaboración por equipos
- gestión de miembros y permisos más rica

#### Producto avanzado

- versionado de mocks y configuraciones
- import/export OpenAPI
- test suites y contract testing
- auditoría de cambios
- analítica avanzada de uso y comportamiento

#### IA más madura

- abstracción de proveedor
- estrategias de fallback
- versionado de prompts
- caching y control de costos

#### Plataforma

- políticas de backup/recovery
- feature flags
- release strategy más madura

### Resultado esperado

Al final de esta fase, el producto debería estar listo para:

- crecer en complejidad
- soportar equipos reales
- diferenciarse frente a alternativas más básicas

---

## Priorización transversal

## Lo que se debe hacer ahora

- auth
- usuarios / organizaciones / ownership
- autorización por proyecto
- CORS y configuración segura
- corrección de URLs públicas y variables sensibles
- fortalecimiento del backend en CI

## Lo que sigue inmediatamente después

- rate limiting serio
- observabilidad real
- retención de logs
- paginación / filtros / performance base
- despliegue reproducible

## Lo que puede esperar un poco

- export/import
- test all endpoints
- settings final
- UX avanzada de knobs complejos

## Lo que NO conviene priorizar antes de tiempo

- sofisticación excesiva de IA
- optimizaciones prematuras
- features visuales sin soporte backend sólido
- escalabilidad compleja sin haber resuelto seguridad y operación básica

---

## Dependencias clave entre fases

- **Fase 1** habilita el ingreso de usuarios reales.
- **Fase 2** habilita operar con menos riesgo e incertidumbre.
- **Fase 3** mejora coherencia, confianza y percepción de calidad.
- **Fase 4** habilita crecimiento, diferenciación y comercialización más seria.

No conviene invertir el orden. Si se salta directo a Fase 3 o 4, la base queda débil y la deuda explota más adelante.

---

## Criterios de éxito del roadmap

Este roadmap estará funcionando bien si, al completarlo por etapas, el proyecto puede afirmar con evidencia:

### Después de Fase 1

- existen usuarios y ownership claro
- los permisos están controlados
- la plataforma ya no está conceptualmente abierta

### Después de Fase 2

- los incidentes son observables
- el runtime soporta mejor uso real
- los costos operativos están más gobernados

### Después de Fase 3

- la superficie funcional es coherente
- la UI ya no promete cosas que no existen

### Después de Fase 4

- el sistema puede crecer como plataforma
- hay capacidades diferenciales y no solo base operativa

---

## Conclusión

La conclusión más importante es esta:

**`simulador-api-ia` ya tiene un MVP real.**

El paso siguiente correcto NO es correr a sumar features vistosas. El paso correcto es profesionalizar la base:

1. seguridad y ownership
2. operación y observabilidad
3. coherencia visible del producto
4. escala y diferenciación

Ese orden importa. Muchísimo.

Porque un producto serio no se define por cuántas pantallas tiene, sino por cuánto podés confiar en él cuando entran usuarios reales.
