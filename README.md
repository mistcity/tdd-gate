# tdd-gate

[![npm version](https://img.shields.io/npm/v/tdd-gate.svg)](https://www.npmjs.com/package/tdd-gate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Zero-cost, full-coverage TDD enforcement for Claude Code**

A Claude Code plugin that enforces Test-Driven Development at the tool level. Zero API cost. Zero configuration required.

---

## Why tdd-gate?

Claude Code is a powerful coding assistant — but left unconstrained, it will happily write an entire implementation before a single test exists. It may skip tests altogether when it thinks a change is "too small" to warrant them.

tdd-gate fixes this at the tool level. Before Claude can write or edit an implementation file, the corresponding test file must already exist. The check happens in a hook, not a prompt, so Claude cannot reason its way around it.

**Key properties:**

- No API calls. No LLM in the critical path. Decisions are pure file-system checks.
- Enforces the rule on `Write`, `Edit`, `MultiEdit`, and `Bash` (file writes via shell).
- Audits completion: when Claude tries to stop, tdd-gate checks whether any impl files written this message have uncovered tests.
- Resets cleanly at every new user message — no cross-message state leakage.

---

## Comparison

| Capability | tdd-gate | tdd-guard | ATDD |
|---|---|---|---|
| API cost | **Zero** | Claude Sonnet per edit | Zero |
| Bash write interception | **Yes** | No | Yes |
| Completion audit | **Yes** | No | No |
| Response time | **<10ms** | ~1-3s | <10ms |
| Languages | **10** | 8 | Shell-based |
| Impact analysis | **Yes** | No | No |
| Test quality check | No | **Yes** | No |

tdd-gate and tdd-guard are complementary, not competing. tdd-gate enforces that tests exist; tdd-guard can verify that tests are meaningful. Use both for maximum coverage.

---

## Impact Analysis (v0.2.0)

tdd-gate doesn't just check that *your* tests exist — it checks that tests for files **depending on your changes** were also run.

```
Claude modifies auth.ts → runs auth.test.ts → tries to finish
                                                    ↓
                                    tdd-gate: "user-service.ts depends on
                                    auth.ts. Run user-service.test.ts first."
```

This catches the #1 source of regressions: changing a module without testing its consumers. Zero API cost.

---

## How It Works

Three Claude Code hooks cooperate to enforce TDD:

```
UserPromptSubmit         PreToolUse                    Stop
─────────────────        ──────────────────────────    ──────────────────────────
Reset per-message   →    Write / Edit / MultiEdit:      Audit: for each impl file
state (journal,          1. Classify file               written this message,
circuit breaker)         2. If impl: require test        check test exists.
                            exists on disk              Block if missing.
                         3. Record impl in journal

                         Bash:
                         1. Detect shell writes
                         2. Classify written file
                         3. Same test check
```

The journal tracks which implementation files were written during a message. The `Stop` hook reads the journal and blocks Claude from finishing if any impl file is uncovered.

---

## Prerequisites

- **Node.js >= 18** (required for building and running the plugin)
- Claude Code installed

## Installation

```bash
# Add the marketplace
claude plugin marketplace add mistcity/tdd-gate

# Install the plugin
claude plugin install tdd-gate
```

Restart Claude Code after installation. The plugin auto-builds on first launch (takes ~10 seconds). No configuration file required — works immediately.

---

## Supported Languages

| Language | Implementation | Test Patterns |
|---|---|---|
| Python | `foo.py` | `test_foo.py`, `foo_test.py` |
| TypeScript | `foo.ts` | `foo.test.ts`, `foo.spec.ts` |
| JavaScript | `foo.js` | `foo.test.js`, `foo.spec.js` |
| TSX | `foo.tsx` | `foo.test.tsx`, `foo.spec.tsx` |
| JSX | `foo.jsx` | `foo.test.jsx`, `foo.spec.jsx` |
| Kotlin | `Foo.kt` | `FooTest.kt`, `FooTests.kt` |
| Java | `Foo.java` | `FooTest.java`, `FooTests.java` |
| Go | `foo.go` | `foo_test.go` |
| Rust | `foo.rs` | `foo_test.rs` |
| C# | `Foo.cs` | `FooTest.cs`, `FooTests.cs` |

For TypeScript, JavaScript, TSX, and JSX, tdd-gate also accepts test files in a `__tests__/` subdirectory alongside the implementation.

---

## Configuration

All configuration is optional. By default tdd-gate runs with zero configuration.

To customize, create `tdd-gate.config.json` in your project root:

```json
{
  "languages": {
    "python": { "enabled": false },
    "kotlin": { "enabled": false }
  },
  "exempt": {
    "extensions": [".json", ".md", ".yaml", ".yml", ".toml", ".lock",
                   ".env", ".txt", ".csv", ".svg"],
    "paths": ["migrations/", "generated/", "vendor/"]
  },
  "bashDetection": true,
  "completionAudit": true,
  "circuitBreaker": {
    "preToolUse": 1000,
    "stop": 20
  }
}
```

**Options:**

| Field | Default | Description |
|---|---|---|
| `languages.<lang>.enabled` | `true` | Disable enforcement for a specific language |
| `exempt.extensions` | See above | File extensions that are never checked |
| `exempt.paths` | `[]` | Path substrings that are always exempt (e.g. `migrations/`) |
| `bashDetection` | `true` | Detect file writes in Bash commands |
| `completionAudit` | `true` | Audit impl coverage when Claude stops |
| `circuitBreaker.preToolUse` | `1000` | Max blocks before auto-allow (PreToolUse) |
| `circuitBreaker.stop` | `20` | Max blocks before auto-allow (Stop) |
| `testDirs` | `["tests","test","spec","__tests__"]` | Directories to search for test files |
| `testCommands` | `[]` | Additional test commands to recognize |
| `impactAnalysis` | `true` | Analyze import dependencies at completion |
| `impactAnalysisMaxFiles` | `500` | Max files to scan for dependencies |
| `impactAnalysisTimeout` | `5000` | Timeout (ms) for dependency scan |

When `exempt.paths` is set, any file path containing one of those strings is skipped — useful for generated code, migrations, or third-party directories.

---

## Bash Write Detection

tdd-gate intercepts shell-based file writes in `Bash` tool calls by pattern-matching the command string.

**Covered patterns:**

| Pattern | Example |
|---|---|
| Redirect (`>`, `>>`) | `echo "..." > src/foo.py` |
| `cat` redirect | `cat > src/foo.py` |
| `printf` redirect | `printf "..." > src/foo.py` |
| `tee` | `... \| tee src/foo.py` |
| Heredoc | `cat > src/foo.py << 'EOF'` |

**Not covered:**

| Pattern | Reason |
|---|---|
| `python3 -c "open('f.py','w').write(...)"` | Arbitrary code execution |
| `cp source.py dest.py` | Copy, not write |
| `mv tmp.py foo.py` | Move, not write |
| `sed -i 's/x/y/' foo.py` | In-place edit |

If you rely on these patterns, the `completionAudit` in the `Stop` hook will still catch uncovered impl files before Claude finishes.

---

## Circuit Breaker

tdd-gate is designed to never permanently block your work.

Each hook maintains a file-based counter. If the counter exceeds the configured limit, the hook auto-allows the operation. This means:

- A misconfigured project will not permanently stall Claude.
- You can always escape a false-positive loop by continuing to work.
- The counter resets at every new user message (via `UserPromptSubmit`).

The default limits (`preToolUse: 1000`, `stop: 20`) are intentionally high. Lower them if you want stricter enforcement; set to `1` to effectively disable the circuit breaker.

---

## Known Limitations

- **No test quality validation.** tdd-gate only checks that a test file exists on disk. It does not verify that the file contains meaningful assertions. Use tdd-guard alongside tdd-gate for quality checks.
- **File-level granularity.** One test file covers an entire implementation file. There is no function-level tracking.
- **Some Bash write patterns not detected.** See the table above. The `Stop` audit provides a second line of defense for these cases.
- **Test file must exist before impl is written.** tdd-gate does not check that the test was written first chronologically — only that it exists at the time the impl is written. In practice this is equivalent for Claude Code workflows.

---

## Contributing

Bug reports and pull requests are welcome.

1. Fork the repo
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Write tests first — tdd-gate enforces this on itself
4. Run `npm test` to verify all tests pass
5. Open a pull request

```bash
git clone https://github.com/mistcity/tdd-gate
cd tdd-gate
npm install
npm test
```

---

## License

MIT — see [LICENSE](LICENSE) for details.
