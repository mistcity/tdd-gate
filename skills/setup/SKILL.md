---
description: Set up tdd-gate TDD enforcement for your project. Detects test framework, directory layout, and generates config.
---

# tdd-gate Setup

Set up TDD enforcement for this project.

## Steps

1. **Detect test framework:**
   - Check for: `jest.config.*`, `vitest.config.*`, `pytest.ini`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `build.gradle*`, `*.csproj`
   - Report which frameworks are detected

2. **Detect test directory layout:**
   - Check if tests live in: `tests/`, `test/`, `spec/`, `__tests__/`, or alongside source files
   - Report the layout

3. **Detect test commands:**
   - Check `package.json` scripts for test commands
   - Check `Makefile` for test targets
   - Report detected commands

4. **Generate config:**
   - Create `tdd-gate.config.json` with:
     - `testDirs` matching the actual layout
     - `testCommands` for non-standard commands
     - `impactAnalysis: true`
     - Disable languages not used in the project

5. **Coverage summary:**
   - List source files and whether they have a matching test
   - Report coverage percentage
   - Highlight uncovered files
