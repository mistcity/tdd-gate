---
name: setup
description: Set up tdd-gate TDD enforcement for your project
---

# tdd-gate Setup

tdd-gate is now active. It enforces Test-Driven Development by:

1. **Requiring tests before implementation** — When you write an implementation file, tdd-gate checks that you've already written the corresponding test file in this session.

2. **Detecting Bash writes** — File writes via `cat >`, `echo >`, `tee`, and heredocs are also subject to TDD checks.

3. **Completion audit** — When you signal completion, tdd-gate checks that all changed implementation files have corresponding test changes.

## Supported Languages

Python, TypeScript, JavaScript, TSX, JSX, Kotlin, Java, Go, Rust, C#

## Configuration

Create `tdd-gate.config.json` in your project root to customize:

```json
{
  "languages": {
    "rust": { "enabled": false }
  },
  "exempt": {
    "extensions": [".proto"],
    "paths": ["/migrations/"]
  }
}
```

## Usage

Just write code normally. tdd-gate will guide you to write tests first.
