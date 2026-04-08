# Universal Engineering Rules

## Core Principle
- Always prioritize clarity, maintainability, and correctness over speed.

## Code Quality
- Write clean, readable, and modular code
- Avoid duplication (DRY)
- Keep functions small and focused
- Use meaningful and consistent naming

## Architecture
- Separate concerns clearly
- Do not mix business logic with presentation
- Reuse existing structures before creating new ones

## Simplicity
- Prefer simple solutions over complex ones
- Do not overengineer
- Implement only what is necessary

## Consistency
- Follow existing project patterns
- Do not introduce new patterns without reason

## Error Handling
- Always handle edge cases
- Never assume data is valid
- Validate inputs and outputs

## Performance
- Avoid unnecessary operations
- Optimize only when needed
- Be aware of scalability

## Security
- Never expose secrets or sensitive data
- Validate all external input
- Follow secure coding practices

## When Generating Code
- Produce complete and working solutions
- Include necessary validation and structure
- Do not leave TODOs or incomplete logic

## When Modifying Code
- Do not break existing functionality
- Refactor instead of patching when needed
- Keep backward compatibility in mind

## Communication
- Be concise and clear
- Explain only when necessary
- Avoid unnecessary verbosity

# UI/UX Agent Rules (Global)

## Core Principle
- UI must be clean, modern, and responsive by default
- Mobile-first is mandatory
- Simplicity > complexity

## Design Philosophy
- Minimal, modern interface
- Focus on usability and clarity
- Avoid clutter and unnecessary elements

## Behavior Rules
- Always ensure responsive design
- Always handle loading, error, empty states
- Prefer reusable components
- Avoid duplicated UI patterns

## Architecture
- Screen = layout container
- Components = reusable UI blocks
- Logic must be separated (hooks/services)

## Strict Rules
- No fixed layouts that break responsiveness
- No UI without mobile support
- No inconsistent spacing or typography

## Enforcement Rules

- If code is complex → SIMPLIFY
- If logic is duplicated → REFACTOR
- If validation is missing → ADD validation
- If structure is unclear → REORGANIZE

