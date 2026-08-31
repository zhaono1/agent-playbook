

# Agent Playbook

> Una colección de guías prácticas, indicaciones y habilidades para agentes de IA (Claude Code)

Inglés | [简体中文](./README.zh-CN.md)

## Descripción general

Este repositorio recopila bloques de construcción prácticos y de uso público para agentes de IA: habilidades reutilizables, patrones de indicaciones, documentación de flujos de trabajo y herramientas para Claude Code, Codex y Gemini.

Todo lo que hay en este repositorio está diseñado para ser portátil y abstracto. Los detalles operativos privados, flujos de trabajo específicos de la empresa y el contexto empresarial sensible deben almacenarse en otro lugar.

## Lo que obtienes

- Habilidades reutilizables con archivos `SKILL.md` específicos y material más detallado en `references/`
- Herramientas de instalación y ciclo de vida a través de `@codeharbor/agent-playbook`
- Un servidor MCP para el descubrimiento de habilidades
- Documentación de flujos de trabajo para planificación,  auto-mejora, automatización y diseño de contexto

## Principios de diseño

El repositorio está evolucionando alrededor de algunas reglas portátiles de diseño de agentes:

- Mantén las restricciones estrictas siempre activadas, pero mantenlas cortas
- Convierte los métodos reutilizables en habilidades
- Mantén los detalles y ejemplos detallados accesibles desde referencias y documentación
- Persiste el estado de tareas de larga ejecución fuera del chat para que la recuperación sea fiable

Lectura complementaria:

- [Capas de contexto para Agent Playbooks](./docs/context-layering-for-agent-playbooks.md)
- [Referencias del ecosistema de habilidades](./docs/skill-ecosystem-references.md)
- [long-task-coordinator](./skills/long-task-coordinator/)

## ¿A quién va dirigido?

- Creadores que desarrollan sus propias habilidades de agentes reutilizables
- Equipos que estandarizan cómo los agentes planifican, revisan y recuperan el trabajo
- Usuarios avanzados que desean herramientas de uso local en lugar de una orquestación basada en SaaS

## Instalación

### Método 0: Instalador de un solo comando (PNPM/NPM)

Configura las habilidades para Claude Code, Codex y Gemini. Actualmente conecta registros de sesión y ganchos de  auto-mejora para Claude Code, registra un bloque de metadatos `agent_playbook` para Codex y prepara los directorios de habilidades de Gemini.

```bash
pnpm dlx @codeharbor/agent-playbook init
# o
npm exec -- @codeharbor/agent-playbook init
```

Configuración solo para el proyecto:

```bash
pnpm dlx @codeharbor/agent-playbook init --project
```

### Método 1: Enlaces simbólicos (Recomendado)

Vincula las habilidades a tus directorios globales de habilidades:

```bash
mkdir -p ~/.claude/skills ~/.codex/skills ~/.gemini/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  ln -s "$skill" ~/.claude/skills/
  ln -s "$skill" ~/.codex/skills/
  ln -s "$skill" ~/.gemini/skills/
done
```

Ejemplo:

```bash
# Vincular habilidades individuales
ln -s ~/Documents/code/GitHub/agent-playbook/skills/skill-router ~/.claude/skills/skill-router
ln -s ~/Documents/code/GitHub/agent-playbook/skills/architecting-solutions ~/.claude/skills/architecting-solutions
ln -s ~/Documents/code/GitHub/agent-playbook/skills/planning-with-files ~/.claude/skills/planning-with-files
```

### Método 2: Copiar habilidades

Copia las habilidades directamente en tus directorios globales de habilidades:

```bash
mkdir -p ~/.claude/skills ~/.codex/skills ~/.gemini/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  cp -R "$skill" ~/.claude/skills/
  cp -R "$skill" ~/.codex/skills/
  cp -R "$skill" ~/.gemini/skills/
done
```

### Método 3: Agregar a habilidades específicas del proyecto

Para el uso específico de un proyecto, crea directorios de habilidades `.claude/.codex/.gemini` en tu proyecto:

```bash
mkdir -p .claude/skills .codex/skills .gemini/skills
for skill in /path/to/agent-playbook/skills/*; do
  [ -f "$skill/SKILL.md" ] || continue
  cp -R "$skill" .claude/skills/
  cp -R "$skill" .codex/skills/
  cp -R "$skill" .gemini/skills/
done
```

### Verificar instalación

Lista tus habilidades instaladas:

```bash
ls -la ~/.claude/skills/
ls -la ~/.codex/skills/
ls -la ~/.gemini/skills/
```

## Administrador de habilidades

Utiliza el administrador de habilidades solo local para inspeccionar y gestionar habilidades en ámbitos de proyecto y globales:

```bash
apb skills list --scope both --target all
apb skills add ./skills/my-skill --scope project --target claude
```

`apb` es un alias corto para `agent-playbook`.

## Compatibilidad con plataformas

| Plataforma | Instalación de habilidades | Automatización de ganchos/configuración | Estado actual |
|------------|----------------------------|------------------------------------------|--------------|
| Claude Code | Sí | Instala ganchos SessionEnd y PostToolUse | Completo |
| Codex | Sí | Escribe el bloque de metadatos `agent_playbook` en `~/.codex/config.toml` | Parcial |
| Gemini | Sí | Aún no hay conexión de ganchos | Solo distribución de habilidades |

El servidor MCP es una integración opcional separada y actualmente está documentado para Claude Code.

## Estructura del proyecto

```text
agent-playbook/
├── prompts/       # Plantillas y ejemplos de indicaciones
├── skills/        # Documentación de habilidades personalizadas
├── docs/          # Mejores prácticas y ejemplos de automatización
├── mcp-server/    # Servidor MCP para el descubrimiento de habilidades
└── README.md      # Documentación del proyecto
```

## Catálogo de habilidades

### Habilidades meta (Flujo de trabajo y coordinación)

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[skill-router](./skills/skill-router/)** | Enruta inteligentemente las solicitudes de los usuarios a la habilidad más adecuada | Manual |
| **[create-pr](./skills/create-pr/)** | Crea PRs con verificaciones de documentación bilingüe | Al enviar |
| **[session-logger](./skills/session-logger/)** | Guarda el historial de conversaciones en archivos de registro de sesión | Gancho compatible con el anfitrión |
| **[auto-trigger](./skills/auto-trigger/)** | Documenta metadatos de ganchos de seguimiento entre habilidades | Solo configuración |
| **[workflow-orchestrator](./skills/workflow-orchestrator/)** | Coordina flujos de trabajo con múltiples habilidades y registra seguimientos compatibles | Manual / gancho compatible con el anfitrión |
| **[self-improving-agent](./skills/self-improving-agent/)** | Captura artefactos de aprendizaje y propone mejoras validadas | Manual / seguimiento en segundo plano |

### Desarrollo principal

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[commit-helper](./skills/commit-helper/)** | Mensajes de commit de Git siguiendosiguiendo la especificación Conventional Commits | Manual |
| **[code-reviewer](./skills/code-reviewer/)** | Revisión de código exhaustiva para calidad, seguridad y mejores prácticas | Manual / Tras la implementación |
| **[debugger](./skills/debugger/)** | Depuración sistemática y resolución de problemas | Manual |
| **[refactoring-specialist](./skills/refactoring-specialist/)** | Refactorización de código y reducción de deuda técnica | Manual |

### Documentación y pruebas

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[documentation-engineer](./skills/documentation-engineer/)** | Documentación técnica y creación de READMEs | Manual |
| **[api-documenter](./skills/api-documenter/)** | Documentación de API OpenAPI/Swagger | Manual |
| **[test-automator](./skills/test-automator/)** | Configuración de marcos de  automatización de pruebas y creación de pruebas | Manual |
| **[qa-expert](./skills/qa-expert/)** | Estrategia de aseguramiento de calidad y puntos de control de calidad | Manual |

### Arquitectura y DevOps

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[api-designer](./skills/api-designer/)** | Diseño de arquitectura de API REST y GraphQL | Manual |
| **[security-auditor](./skills/security-auditor/)** | Auditoría de seguridad que cubre OWASP Top 10 | Manual |
| **[performance-engineer](./skills/performance-engineer/)** | Optimización y análisis de rendimiento | Manual |
| **[deployment-engineer](./skills/deployment-engineer/)** | Pipelines de CI/CD y automatización de despliegue | Manual |

### Planificación y arquitectura

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[prd-planner](./skills/prd-planner/)** | Crea PRDs utilizando planificación persistente basada en archivos | Manual (palabra clave: "PRD") |
| **[prd-implementation-precheck](./skills/prd-implementation-precheck/)** | Realiza una revisión preliminar antes de implementar PRDs | Manual |
| **[architecting-solutions](./skills/architecting-solutions/)** | Diseño de solución técnica y arquitectura | Manual (palabra clave: "design solution") |
| **[planning-with-files](./skills/planning-with-files/)** | Planificación general basada en archivos para tareas de múltiples pasos | Manual |
| **[long-task-coordinator](./skills/long-task-coordinator/)** | Coordina trabajo entre múltiples sesiones o delegado con estado persistente y reglas de recuperación | Manual |

### Diseño y creatividad

| Habilidad | Descripción | Seguimiento |
|-----------|-------------|-------------|
| **[figma-designer](./skills/figma-designer/)** | Analiza diseños de Figma y genera PRDs listos para la implementación con especificaciones visuales | Manual (URL de Figma) |

## Cómo funcionan los seguimientos con ganchos

Las habilidades pueden declarar intención de seguimiento en `metadata.hooks`. Un entorno de ejecución anfitrión o un agente puede usar esos metadatos para ejecutar acciones de bajo riesgo, registrar seguimientos pendientes o preguntar antes de realizar acciones externas como la creación de PRs.

```
┌──────────────┐
│  prd-planner │ completes
└──────┬───────┘
       │
       ├──→ self-improving-agent (background) → writes learning proposal
       │         └──→ create-pr (ask first) ──→ session-logger (if supported)
       │
       └──→ session-logger (if supported)
```

### Modos de seguimiento

| Modo | Comportamiento |
|------|----------------|
| `auto` | El anfitrión puede ejecutar o registrar un seguimiento de bajo riesgo |
| `background` | El anfitrión puede registrar  trabajo de análisis o propuestas no bloqueantes |
| `ask_first` | Pregunta al usuario antes de ejecutar |

## Uso

Una vez instaladas, las habilidades están disponibles automáticamente en cualquier sesión de Claude Code. Puedes invocarlas mediante:

1. **Activación directa** - La habilidad se activa según el contexto (por ejemplo, mencionando "PRD", "planificación")
2. **Invocación manual** - Pídele explícitamente a Claude que use una habilidad específica

Ejemplo:

```
You: Create a PRD for a new authentication feature
```

La habilidad `prd-planner` se activará automáticamente.

## Ejemplo de flujo de trabajo

Flujo de trabajo completo de PRD a implementación:

```
User: "Create a PRD for user authentication"
       ↓
prd-planner executes
       ↓
Phase complete → follow-ups:
       ├──→ self-improving-agent (background) - writes proposal
       └──→ session-logger (if supported) - saves session
       ↓
User: "Implement this PRD"
       ↓
prd-implementation-precheck → implementation
       ↓
code-reviewer → self-improving-agent → create-pr
```

## Ruta de aprendizaje para agentes de IA

**[docs/ai-agent-learning-path.md](./docs/ai-agent-learning-path.md)** - Una ruta de aprendizaje progresiva para construir agentes con Claude, GLM y Codex:

| Nivel | Tema | Tiempo | Resultado |
|-------|------|--------|-----------|
| 1 | Fundamentos de ingeniería de indicaciones | 1 semana | Completar un flujo de trabajo de tarea única |
| 2 | Desarrollo de habilidades | 1 semana | Lanzar la primera habilidad reutilizable |
| 3 | Orquestación de flujos de trabajo | 2 semanas | Construir un flujo de trabajo completamente automatizado |
| 4 | Sistemas de aprendizaje propio | 2-3 semanas | Crear un agente que aprende de la experiencia |
| 5 | Agentes de  auto-evolución | 2-3 semanas | Construir un ciclo de mejora más autónomo |

## Ejemplo de flujo de trabajo completo

**[docs/complete-workflow-example.md](./docs/complete-workflow-example.md)** - Un ejemplo integral desde la entrada o referencia de diseño hasta la entrega final:

1. **Entrada** → Sube una imagen o describe la solicitud
2. **PRD** → `prd-planner` crea el PRD y puede registrar un seguimiento de `self-improving-agent` `
3. **Revisión** → Revisar y refinar el plan
4. **Implementación** → Construir según el PRD
5. **Revisión** → `code-reviewer` verifica la calidad
6. **Retroalimentación** → `self-improving-agent` captura artefactos de aprendizaje y propone actualizaciones
7. **Envío** → `create-pr` abre un PR y mantiene alineada la documentación bilingüe

## Actualización de habilidades

Cuando actualices las habilidades en agent-playbook, los enlaces simbólicos aseguran que siempre tengas la última versión. Para actualizar:

```bash
cd /path/to/agent-playbook
git pull origin main
```

Si usas habilidades copiadas, actualiza a través de la CLI para que todos los destinos seleccionados permanezcan sincronizados:

```bash
apb skills upgrade --scope both --target all
```

## Contribuciones

¡Se aceptan contribuciones! No dudes en enviar PRs con tus propias indicaciones, habilidades o casos de uso.

Al contribuir con habilidades:

1. Agrega tu habilidad a la categoría correspondiente en el Catálogo de habilidades anterior
2. Incluye `SKILL.md` con la estructura correcta (name, description, allowed-tools, hooks)
3. Agrega `README.md` con ejemplos de uso
4. Mantén `SKILL.md` ligero y mueve procedimientos largos o plantillas a `references/`
5. Prefiere orientación abstracta y portátil sobre conocimiento privado o específico de la empresa
6. Agrega criterios de aceptación explícitos para que la habilidad tenga una definición clara de "hecho"
7. Agrega indicaciones de evaluación ligeras o verificaciones de escenario para las nuevas habilidades cuando sea práctico
8. Sigue la estructura y  guías de [skill-creator de Anthropic](https://github.com/anthropics/skills/tree/main/skills/skill-creator)
9. Revisa [Referencias del ecosistema de habilidades](./docs/skill-ecosystem-references.md) antes de agregar nueva infraestructura de habilidades
10. Actualiza tanto README.md como README.zh-CN.md cuando la paridad bilingüe forme parte del cambio
11. Valida la estructura de la habilidad: `python3 scripts/validate_skills.py`
12. Opcional: ejecuta la validación de skills-ref: `python3 -m pip install "git+https://github.com/agentskills/agentskills.git@5d4c1fda3f786fff826c7f56b6cb3341e7f3a911#subdirectory=skills-ref" && skills-ref validate skills/<name>`

## Licencia

Licencia MIT
