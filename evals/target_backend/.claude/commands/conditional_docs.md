# Conditional Documentation Guide

This prompt helps you determine what documentation you should read based on the specific changes you need to make in the codebase. Review the conditions below and read the relevant documentation before proceeding with your task.

## Instructions

- Review the task you've been asked to perform
- Check each documentation path in the Conditional Documentation section
- For each path, evaluate if any of the listed conditions apply to your task
  - IMPORTANT: Only read the documentation if any one of the conditions match your task
- IMPORTANT: You don't want to excessively read documentation. Only read the documentation if it's relevant to your task.

## Conditional Documentation

- README.md

  - Conditions:
    - When first understanding the project structure
    - When you want to learn the commands to build or run the application
    - When understanding the overall architecture

- DESIGN.md

  - Conditions:
    - When understanding the overall application architecture
    - When adding new modules or packages
    - When implementing new features
    - When working with external integrations
    - IMPORTANT: Required reading before implementing any major feature

- adws/README.md

  - Conditions:
    - When you're operating in the `adws/` directory
    - When working with AI Developer Workflows

- .claude/commands/classify_adw.md

  - Conditions:
    - When adding or removing new `adws/adw_*.py` files

## TypeScript Project Structure

The project follows the standard TypeScript project layout:

```
src/routes/*.ts (Express routers)
src/services/*.ts (business logic)
src/models/*.ts (Sequelize models)
src/migrations/ (sequelize-cli)
src/tests/api/*.test.ts (supertest suites)
```

## Development Patterns

When working on this TypeScript project:

Route handlers stay thin and delegate to services; express-validator on inputs; Sequelize models with migrations (never sync force); supertest API tests using TestHelper fixtures.

<!--
Replace with project-specific guidance, e.g.:
- **Adding new modules**: Look at `<dir>/` for existing patterns
- **Configuration**: Use `<config dir>/` for app configuration
- **Data models**: Define in `<models dir>/`
-->
