# Figma Designer Skill

> "Transform Figma designs into implementation-ready specifications with pixel-perfect accuracy"

## Overview

This skill analyzes Figma designs through the Figma MCP server and generates detailed PRDs with precise visual specifications. It extracts design tokens, component specifications, and layout information that developers can implement directly.

## Installation

Install through the package CLI when possible:

```bash
apb skills add ./skills/figma-designer --scope global --target all --link
```

## Prerequisites

### Figma MCP Server

Ensure the host exposes a Figma MCP server or plugin. Tool names vary by host
and plugin version, so inspect the available Figma tools in the current session
instead of assuming fixed names. The required capability set is:

- Read file or page metadata
- Read selected nodes or node details
- Read component and style information when available

### Figma Access Token

You need a Figma access token with appropriate permissions:

```bash
# Set environment variable
export FIGMA_ACCESS_TOKEN="your_token_here"
```

## Usage

### Basic Usage

Provide a Figma link or ask to analyze a design:

```
You: Analyze this Figma design: https://www.figma.com/file/abc123/My-Design
```

The skill will:
1. Extract the file key from the URL
2. Fetch design data via Figma MCP
3. Analyze design tokens (colors, typography, spacing)
4. Extract component hierarchy
5. Generate visual specifications

### With PRD Generation

```
You: Create a PRD from this Figma design: [URL]
```

Generates a complete 4-file PRD in `docs/`:
- `{feature}-notes.md` - Design decisions
- `{feature}-task-plan.md` - Implementation tasks
- `{feature}-prd.md` - Product requirements
- `{feature}-tech.md` - Technical specifications

## What Gets Extracted

### Design Tokens

| Category | What's Extracted |
|----------|-----------------|
| **Colors** | Hex/RGBA values for primary, secondary, semantic colors |
| **Typography** | Font families, sizes, weights, line heights, letter spacing |
| **Spacing** | Padding, margin, gap values (typically 4/8/12/16px scale) |
| **Borders** | Corner radius, border widths |
| **Shadows** | Offset, blur, spread, color values |
| **Icons** | Names, sizes, colors |
| **Images** | URLs, dimensions, fit modes |

### Component Analysis

For each component found in the design:
- Props (size, variant, state)
- Layout (flex direction, alignment, gap, padding)
- Styles (fill, stroke, effects)
- Content (text, icons, images)
- Constraints (responsive behavior)

## Output Examples

### Visual Specification

```markdown
## Screen: Login

### Layout Structure
```
┌─────────────────────────────────────────┐
│           Logo                          [Icon] │
├─────────────────────────────────────────┤
│  Welcome back                            │
│  Sign in to continue                    │
├─────────────────────────────────────────┤
│  Email                    [✓]           │
│  ┌────────────────────────────────┐    │
│  └────────────────────────────────┘    │
├─────────────────────────────────────────┤
│  Password                [👁️]           │
│  ┌────────────────────────────────┐    │
│  └────────────────────────────────┘    │
├─────────────────────────────────────────┤
│         Forgot password?               │
├─────────────────────────────────────────┤
│  [      Sign In        ]               │
└─────────────────────────────────────────┘
```

### Design Tokens

```typescript
// tokens.ts
export const colors = {
  primary: '#007AFF',
  background: '#FFFFFF',
  surface: '#F5F5F7',
  textPrimary: '#1C1C1E',
  textSecondary: '#8E8E93',
};

export const typography = {
  displayLarge: {
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  // ...
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  2xl: 32,
};
```

## Integration with Other Skills

### Typical Workflow

```
Figma URL → figma-designer → Visual Specs
                                ↓
                           prd-planner → PRD
                                ↓
                           implementation → Code
                                ↓
                           code-reviewer → Quality Check
```

### Auto-Triggers

After figma-designer completes:
- `prd-planner` (ask first) - Further refine PRD with 4-file pattern
- `self-improving-agent` (background) - Learn design patterns
- `session-logger` (auto) - Save design analysis session

## Platform Support

The skill generates specifications for:
- **React Native** - Uses StyleSheet with exact pixel values
- **React/Web** - CSS values with proper units
- **SwiftUI** - Native SwiftUI values

## Examples

### Example 1: Quick Analysis

```
You: What are the colors used in this design?
```

Returns a table of all colors with their usage contexts.

### Example 2: Component Spec

```
You: Extract the button component specifications
```

Returns props interface, variants, and all states.

### Example 3: Full PRD

```
You: Create a complete PRD from this Figma file
```

Generates 4-file PRD with all visual specifications.

## Tips

1. **Organize Figma files** with clear naming conventions for better extraction
2. **Use components** for reusable elements to get proper component specs
3. **Set up auto-layout** in Figma for accurate layout information
4. **Document prototypes** to include interaction states
5. **Provide context** about target platform for platform-specific output

## See Also

- [SKILL.md](./SKILL.md) - Full skill definition with all templates
- [prd-planner](../prd-planner/) - Create PRDs from design specs
- [architecting-solutions](../architecting-solutions/) - Technical architecture
