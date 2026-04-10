# Plan ejecutable post-MVP

## Objetivo del plan

Traducir el roadmap post-MVP a un plan de ejecución concreto, priorizado y secuencial para el equipo.

Este documento está pensado para ser usado como base de trabajo real: backlog inicial, planificación técnica, definición de épicas y coordinación de entregas.

---

## Criterios de ejecución

- priorizar primero lo que habilita producto real
- evitar sumar features vistosas antes de cerrar base operativa
- cortar el trabajo en entregables pequeños pero con valor acumulativo
- no dejar placeholders visibles sin decisión explícita
- medir el avance por reducción de riesgo, no solo por cantidad de tickets cerrados

---

## Orden recomendado de ejecución

1. **Seguridad y ownership**
2. **Hardening operacional**
3. **Cierre funcional visible**
4. **Escala y diferenciación**

---

# EPIC 1 — Identidad, acceso y ownership

## Objetivo

Convertir el producto en una plataforma donde existan usuarios reales, acceso controlado y pertenencia clara de los proyectos.

## Prioridad

**P0 — crítica**

## Riesgo que resuelve

- exposición total de recursos
- imposibilidad de abrir el sistema a usuarios reales
- deuda futura más cara en el dominio

## Dependencias

- ninguna funcional crítica previa

## Tareas ejecutables

### 1.1 Definir modelo de identidad

- decidir estrategia de auth (propia, provider externo o híbrida)
- definir entidades mínimas: `User`, `Organization/Workspace`, membresías, roles
- definir ownership de `Project`
- definir reglas de acceso por recurso

### 1.2 Ajustar modelo de datos

- extender esquema Prisma
- relacionar proyectos con owner/workspace
- preparar migraciones de datos
- definir reglas de borrado / cascada / integridad

### 1.3 Implementar autenticación

- login / sesión / token según estrategia elegida
- middleware de autenticación backend
- guardas o manejo de sesión en frontend
- estados de sesión, expiración y logout

### 1.4 Implementar autorización

- chequeos por proyecto
- roles mínimos por recurso
- protección de endpoints sensibles
- evitar acceso cruzado entre espacios

### 1.5 Adaptar frontend al nuevo modelo

- flujo de acceso
- recuperación del contexto activo
- manejo de errores de permisos
- ocultar o deshabilitar acciones no permitidas

## Entregable de cierre

- usuario autenticado
- proyectos pertenecen a un owner o workspace
- acceso a API y UI protegido por permisos

## Definición de Done

- no se puede operar la plataforma sin autenticación
- un usuario no puede acceder a recursos ajenos
- frontend y backend manejan correctamente estados no autenticados / no autorizados

---

# EPIC 2 — Configuración segura y readiness básica de entorno

## Objetivo

Eliminar supuestos de entorno local y cerrar huecos básicos de configuración para despliegues reales.

## Prioridad

**P0 — crítica**

## Riesgo que resuelve

- configuración incorrecta en entornos reales
- exposición por CORS o defaults inseguros
- URLs públicas incorrectas

## Dependencias

- puede ejecutarse en paralelo parcial con Epic 1

## Tareas ejecutables

### 2.1 Revisar contrato de configuración

- inventariar variables de entorno backend y frontend
- clasificar obligatorias, opcionales y peligrosas
- documentar defaults aceptables y defaults inseguros

### 2.2 Corregir construcción de URLs públicas

- asegurar que el backend use configuración real para URLs del mock
- eliminar supuestos `localhost` donde todavía existan

### 2.3 Endurecer CORS y exposición HTTP

- definir orígenes permitidos por entorno
- revisar headers y políticas mínimas
- documentar la política para desarrollo vs producción

### 2.4 Formalizar readiness de entorno

- checklist de variables requeridas
- validación de arranque con mensajes claros
- documentación de despliegue inicial

## Entregable de cierre

- configuración reproducible por entorno
- URLs correctas fuera de localhost
- CORS controlado

## Definición de Done

- el sistema no depende de supuestos locales ocultos
- la documentación de entorno es suficiente para desplegar sin adivinanzas

---

# EPIC 3 — Hardening del runtime y protección operativa

## Objetivo

Evitar que el runtime mock y la API se vuelvan frágiles ante uso real o abuso básico.

## Prioridad

**P1 — alta**

## Riesgo que resuelve

- colapso o inconsistencia al escalar
- abuso de endpoints
- comportamiento impredecible bajo carga moderada

## Dependencias

- recomendable después de Epic 1

## Tareas ejecutables

### 3.1 Replantear rate limiting

- evaluar estrategia distribuida o persistente
- definir qué se limita: por proyecto, usuario, IP, organización o combinación
- llevar la decisión a una implementación compatible con múltiples instancias

### 3.2 Endurecer manejo de requests

- límites de payload
- timeouts coherentes
- revisión de body sizes y casos patológicos
- respuesta consistente ante abuso o saturación

### 3.3 Revisar comportamiento del runtime

- validar políticas de logging según nivel
- revisar persistencia de cuerpos completos
- revisar impacto de escenarios complejos en performance

## Entregable de cierre

- runtime más resistente
- política de límites explícita
- menor dependencia de supuestos monoinstancia

## Definición de Done

- la protección operativa no depende exclusivamente de memoria local del proceso
- los límites y respuestas están definidos y documentados

---

# EPIC 4 — Observabilidad y control operativo

## Objetivo

Poder ver, entender y diagnosticar el comportamiento del sistema cuando algo falle o crezca el uso.

## Prioridad

**P1 — alta**

## Riesgo que resuelve

- incidentes invisibles
- troubleshooting lento
- crecimiento de logs sin control

## Dependencias

- recomendable después de Epic 2 y en paralelo con parte de Epic 3

## Tareas ejecutables

### 4.1 Estandarizar logging

- logs estructurados backend
- correlación mínima por request
- separación entre logs técnicos y logs de producto

### 4.2 Incorporar métricas mínimas

- health útil
- métricas de requests, errores, latencias
- métricas operativas del runtime mock

### 4.3 Gestionar errores e incidentes

- error tracking
- clasificación de errores esperados vs inesperados
- lineamientos de alerta mínima

### 4.4 Definir política de retención

- cuánto guardar
- qué guardar en modo full
- limpieza, archivado o expiración

## Entregable de cierre

- visibilidad básica del sistema en producción
- crecimiento de logs y errores bajo control

## Definición de Done

- un incidente importante deja evidencia observable
- la persistencia de logs tiene criterios de costo y retención definidos

---

# EPIC 5 — Calidad de entrega y gates técnicos

## Objetivo

Endurecer la disciplina de entrega para evitar que lleguen regressions o configuraciones rotas a ramas principales.

## Prioridad

**P1 — alta**

## Riesgo que resuelve

- merges con validación insuficiente
- drift entre lo que se asume y lo que realmente corre

## Dependencias

- ninguna estricta; puede avanzar en paralelo

## Tareas ejecutables

### 5.1 Revisar CI del backend

- agregar chequeos que falten para build/type safety
- asegurar simetría razonable con frontend
- revisar cobertura mínima exigida

### 5.2 Clarificar gates

- qué falla bloquea merge
- qué validaciones son obligatorias por tipo de cambio
- documentación clara para contributors

### 5.3 Preparar baseline de release

- checklist técnica mínima antes de release
- criterios de smoke checks o validación manual mínima

## Entregable de cierre

- pipeline más confiable
- menor ambigüedad al integrar cambios

## Definición de Done

- el equipo sabe exactamente qué condiciones deben cumplirse para integrar cambios

---

# EPIC 6 — Cierre de funcionalidades visibles incompletas

## Objetivo

Eliminar deuda visible que hoy degrada la percepción de solidez del producto.

## Prioridad

**P2 — media**

## Riesgo que resuelve

- pérdida de confianza del usuario
- fricción UX por acciones vacías

## Dependencias

- recomendable después de épicas 1 a 5

## Tareas ejecutables

### 6.1 Resolver acciones vacías

- implementar `export config`
- implementar `import endpoints`
- implementar `test all endpoints`

### 6.2 Resolver placeholders

- terminar `settings` o remover su acceso hasta tener alcance real

### 6.3 Revisar knobs avanzados

- decidir cuáles pasan a soporte real
- cuáles permanecen deshabilitados
- cuáles deben salir de UI por ahora

## Entregable de cierre

- UI sin promesas vacías
- superficie funcional más honesta

## Definición de Done

- toda acción visible hace algo real o está conscientemente removida

---

# EPIC 7 — Performance base y escalabilidad inicial

## Objetivo

Reducir riesgos de degradación al crecer la cantidad de proyectos, endpoints y tráfico.

## Prioridad

**P2 — media**

## Riesgo que resuelve

- tiempos de respuesta pobres
- sobrecarga por fan-out o consultas ineficientes

## Dependencias

- recomendable después de observabilidad, para medir antes de optimizar

## Tareas ejecutables

### 7.1 Revisar accesos a datos y listados

- paginación real
- filtros y ordenamientos útiles
- reducción de N+1 o fan-out innecesario

### 7.2 Medir y ajustar puntos críticos

- dashboard
- logs
- listados principales
- generación y lectura de configuraciones

## Entregable de cierre

- experiencia más estable con mayor volumen de datos

## Definición de Done

- los listados principales no dependen de cargas ingenuas a medida que crece el volumen

---

# EPIC 8 — Plataforma avanzada y diferenciación

## Objetivo

Construir capacidades que posicionen al producto como plataforma madura y no solo como herramienta funcional.

## Prioridad

**P3 — posterior**

## Riesgo que resuelve

- techo de crecimiento funcional/comercial

## Dependencias

- requiere base sólida de épicas anteriores

## Tareas ejecutables

### 8.1 Multi-tenant completo

- organizaciones/equipos maduros
- gestión de miembros
- permisos más finos

### 8.2 Gestión avanzada del dominio

- versionado de mocks/configs
- auditoría de cambios
- snapshots o historial relevante

### 8.3 Integraciones y diferenciación

- import/export OpenAPI
- contract testing
- analítica avanzada

### 8.4 Evolución de IA

- abstracción de proveedor
- fallback
- caching
- versionado de prompts
- control de costos

## Entregable de cierre

- base para crecimiento serio del producto y del negocio

## Definición de Done

- el producto puede competir por capacidades, no solo por resolver lo básico

---

## Secuencia sugerida por entregas

### Entrega A

- Epic 1
- Epic 2
- parte mínima de Epic 5

### Entrega B

- Epic 3
- Epic 4
- resto de Epic 5

### Entrega C

- Epic 6
- Epic 7

### Entrega D

- Epic 8

---

## Backlog inmediato recomendado

Si hubiera que empezar HOY, el backlog inicial debería ser:

1. definir estrategia de auth y modelo de identidad
2. modelar ownership de proyectos
3. implementar middleware de autenticación y autorización
4. corregir URLs/config sensibles y política de CORS
5. reforzar CI del backend
6. definir nueva estrategia de rate limiting
7. instrumentar observabilidad mínima
8. definir política de retención de logs

---

## Decisiones que el equipo debe cerrar cuanto antes

Antes de implementar fuerte, conviene cerrar estas decisiones:

1. **modelo de acceso**
   - usuarios individuales
   - organizaciones
   - workspaces
   - roles iniciales

2. **estrategia de autenticación**
   - auth propia vs proveedor externo
   - sesión vs JWT vs híbrido

3. **estrategia de despliegue**
   - contenedores, hosting, base de datos, secrets y observabilidad

4. **política de logs y datos operativos**
   - cuánto guardar
   - cuánto cuesta
   - qué se considera sensible

5. **alcance de superficie funcional visible**
   - qué se termina ahora
   - qué se esconde
   - qué se deja explícitamente fuera

---

## Indicadores de avance sugeridos

Para evitar medir solo “cantidad de tickets”, conviene usar señales de madurez:

- porcentaje de endpoints protegidos por auth/autorización
- porcentaje de recursos con ownership explícito
- nivel de cobertura de observabilidad sobre flujos críticos
- porcentaje de acciones visibles realmente implementadas
- reducción de supuestos locales en configuración
- tiempo de diagnóstico de fallos relevantes

---

## Conclusión operativa

La ejecución correcta no es “hacer más cosas”.

La ejecución correcta es:

1. cerrar identidad y ownership
2. endurecer operación
3. alinear la superficie del producto
4. recién después escalar y diferenciar

Ese es el plan sano para pasar de un MVP real a un producto serio.
