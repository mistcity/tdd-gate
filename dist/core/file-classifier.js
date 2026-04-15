/**
 * File classifier for tdd-gate.
 *
 * Classifies file paths as test files, implementation files, or exempt files.
 * Supports 10 programming languages.
 */
import path from 'path';
import { existsSync } from 'node:fs';
// ---------------------------------------------------------------------------
// Default exempt extensions
// ---------------------------------------------------------------------------
export const DEFAULT_EXEMPT_EXTENSIONS = [
    '.json', '.md', '.yaml', '.yml', '.toml', '.lock',
    '.env', '.gitignore', '.dockerignore', '.editorconfig',
    '.txt', '.csv', '.svg', '.png', '.jpg', '.gif', '.ico',
    '.woff', '.woff2', '.ttf', '.eot',
];
// ---------------------------------------------------------------------------
// JS/TS languages that support the __tests__ subdirectory convention
// ---------------------------------------------------------------------------
const JS_TS_LANGUAGES = new Set(['typescript', 'javascript', 'tsx', 'jsx']);
// ---------------------------------------------------------------------------
// Language definitions
// ---------------------------------------------------------------------------
/**
 * Build a JS/TS-style language (foo.test.ext / foo.spec.ext).
 */
function makeJsTsLanguage(name, ext) {
    return {
        name,
        extensions: [ext],
        testPatterns(basename) {
            const stem = basename.slice(0, basename.length - ext.length);
            return [`${stem}.test${ext}`, `${stem}.spec${ext}`];
        },
        isTestFile(basename) {
            return basename.endsWith(`.test${ext}`) || basename.endsWith(`.spec${ext}`);
        },
    };
}
/**
 * Build a JVM/C#-style language (FooTest.ext / FooTests.ext).
 */
function makeJvmLanguage(name, ext) {
    return {
        name,
        extensions: [ext],
        testPatterns(basename) {
            const stem = basename.slice(0, basename.length - ext.length);
            return [`${stem}Test${ext}`, `${stem}Tests${ext}`];
        },
        isTestFile(basename) {
            // Match stem ending with Test or Tests (case-sensitive)
            const stem = basename.slice(0, basename.length - ext.length);
            return (basename.endsWith(ext) &&
                (stem.endsWith('Test') || stem.endsWith('Tests')));
        },
    };
}
export const LANGUAGES = [
    // Python: test_foo.py  /  foo_test.py
    {
        name: 'python',
        extensions: ['.py'],
        testPatterns(basename) {
            const stem = basename.slice(0, basename.length - '.py'.length);
            return [`test_${stem}.py`, `${stem}_test.py`];
        },
        isTestFile(basename) {
            return (basename.startsWith('test_') && basename.endsWith('.py') ||
                (basename.endsWith('_test.py')));
        },
    },
    // TypeScript
    makeJsTsLanguage('typescript', '.ts'),
    // JavaScript
    makeJsTsLanguage('javascript', '.js'),
    // TSX
    makeJsTsLanguage('tsx', '.tsx'),
    // JSX
    makeJsTsLanguage('jsx', '.jsx'),
    // Kotlin
    makeJvmLanguage('kotlin', '.kt'),
    // Java
    makeJvmLanguage('java', '.java'),
    // Go: foo_test.go
    {
        name: 'go',
        extensions: ['.go'],
        testPatterns(basename) {
            const stem = basename.slice(0, basename.length - '.go'.length);
            return [`${stem}_test.go`];
        },
        isTestFile(basename) {
            return basename.endsWith('_test.go');
        },
    },
    // Rust: foo_test.rs
    {
        name: 'rust',
        extensions: ['.rs'],
        testPatterns(basename) {
            const stem = basename.slice(0, basename.length - '.rs'.length);
            return [`${stem}_test.rs`];
        },
        isTestFile(basename) {
            return basename.endsWith('_test.rs');
        },
    },
    // C#
    makeJvmLanguage('csharp', '.cs'),
];
// ---------------------------------------------------------------------------
// classifyFile
// ---------------------------------------------------------------------------
export function classifyFile(filePath, config) {
    const ext = path.extname(filePath);
    const basename = path.basename(filePath);
    // 1. Check config.exempt.extensions (includes DEFAULT_EXEMPT_EXTENSIONS via config)
    if (config.exempt.extensions.includes(ext)) {
        return { type: 'exempt', reason: `extension ${ext} is exempt` };
    }
    // 2. Check config.exempt.paths
    for (const pattern of config.exempt.paths) {
        if (filePath.includes(pattern)) {
            return { type: 'exempt', reason: `path matches exempt pattern "${pattern}"` };
        }
    }
    // 3. Check each enabled language
    for (const lang of LANGUAGES) {
        const langConfig = config.languages[lang.name];
        if (!langConfig?.enabled)
            continue;
        if (!lang.extensions.some((e) => basename.endsWith(e)))
            continue;
        if (lang.isTestFile(basename)) {
            return { type: 'test', language: lang.name };
        }
        // It matches an extension of this language but is not a test file → impl
        const expectedTests = lang.testPatterns(basename);
        return { type: 'impl', language: lang.name, expectedTests };
    }
    return { type: 'unknown' };
}
// ---------------------------------------------------------------------------
// findProjectRoot
// ---------------------------------------------------------------------------
/** Root marker files used to detect project root directory. */
const ROOT_MARKERS = ['.git', 'tdd-gate.config.json', 'package.json'];
/** Maximum number of parent directories to walk when searching for root. */
const MAX_ROOT_SEARCH_DEPTH = 10;
/**
 * Walk up from `startDir` looking for a project root marker (.git,
 * tdd-gate.config.json, or package.json). Returns the root directory path
 * or null if not found within MAX_ROOT_SEARCH_DEPTH levels.
 */
export function findProjectRoot(startDir) {
    let current = startDir;
    for (let i = 0; i < MAX_ROOT_SEARCH_DEPTH; i++) {
        for (const marker of ROOT_MARKERS) {
            if (existsSync(path.join(current, marker))) {
                return current;
            }
        }
        const parent = path.dirname(current);
        // Reached filesystem root — stop
        if (parent === current)
            return null;
        current = parent;
    }
    return null;
}
// ---------------------------------------------------------------------------
// getExpectedTestPaths
// ---------------------------------------------------------------------------
export function getExpectedTestPaths(implPath, config) {
    const basename = path.basename(implPath);
    const dir = path.dirname(implPath);
    // Find the enabled language for this file
    const lang = LANGUAGES.find((l) => {
        const langConfig = config.languages[l.name];
        if (!langConfig?.enabled)
            return false;
        return l.extensions.some((e) => basename.endsWith(e)) && !l.isTestFile(basename);
    });
    if (!lang)
        return [];
    const patterns = lang.testPatterns(basename);
    const result = new Set();
    // Same-directory paths
    for (const p of patterns) {
        result.add(path.join(dir, p));
    }
    // __tests__ subdirectory for JS/TS family
    if (JS_TS_LANGUAGES.has(lang.name)) {
        for (const p of patterns) {
            result.add(path.join(dir, '__tests__', p));
        }
    }
    // Project-root-relative test directories from config.testDirs
    const projectRoot = findProjectRoot(dir);
    if (projectRoot && config.testDirs.length > 0) {
        for (const testDir of config.testDirs) {
            for (const p of patterns) {
                result.add(path.join(projectRoot, testDir, p));
            }
        }
    }
    return [...result];
}
//# sourceMappingURL=file-classifier.js.map