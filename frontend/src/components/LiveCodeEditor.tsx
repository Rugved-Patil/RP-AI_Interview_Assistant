import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  runCodeInSandbox,
  type RunCodeResponse,
  type SupportedLanguage,
} from '../api/practiceApi'
import { PlayIcon, StopIcon } from './Icons'
import './LiveCodeEditor.css'

interface LiveCodeEditorProps {
  initialCode?: string
  initialLanguage?: SupportedLanguage
  onCodeChange?: (code: string, language: SupportedLanguage) => void
  onInsertToAnswer?: (formattedCodeMarkdown: string) => void
  onClose?: () => void
  isEmbedded?: boolean
}

const DEFAULT_STARTER: Record<SupportedLanguage, string> = {
  python: `def solution():
    # Write your solution here
    pass

# Quick test execution
print(solution())
`,
  javascript: `function solution() {
    // Write your solution here
    return null;
}

// Quick test execution
console.log(solution());
`,
}

/**
 * Lightweight, safe syntax highlighter tokenizing Python & JavaScript code into HTML spans.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function highlightSyntax(code: string, language: SupportedLanguage): string {
  if (!code) return '&nbsp;'

  const lines = code.split('\n')
  const highlightedLines = lines.map((line) => {
    if (!line) return ''

    if (language === 'python') {
      return highlightPythonLine(line)
    } else {
      return highlightJsLine(line)
    }
  })

  return highlightedLines.join('\n')
}

function highlightPythonLine(line: string): string {
  // Check for whole line or inline comments first
  const commentIdx = line.indexOf('#')
  let codePart = line
  let commentPart = ''
  if (commentIdx !== -1) {
    // Make sure '#' is not inside a string
    let inQuotes = false
    let quoteChar = ''
    for (let i = 0; i < commentIdx; i++) {
      const char = line[i]
      if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (quoteChar === char) {
          inQuotes = false
        }
      }
    }
    if (!inQuotes) {
      codePart = line.substring(0, commentIdx)
      commentPart = `<span class="token-comment">${escapeHtml(line.substring(commentIdx))}</span>`
    }
  }

  // Tokenize codePart
  let html = escapeHtml(codePart)

  // Strings: "..." or '...'
  html = html.replace(
    /(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;)/g,
    '<span class="token-string">$1</span>',
  )

  // Python Keywords
  const pyKeywords = [
    'def',
    'class',
    'return',
    'if',
    'elif',
    'else',
    'for',
    'while',
    'in',
    'is',
    'not',
    'and',
    'or',
    'import',
    'from',
    'as',
    'try',
    'except',
    'finally',
    'raise',
    'with',
    'yield',
    'lambda',
    'async',
    'await',
    'pass',
    'break',
    'continue',
    'global',
    'nonlocal',
    'assert',
  ]
  const kwRegex = new RegExp(`\\b(${pyKeywords.join('|')})\\b`, 'g')
  html = html.replace(kwRegex, '<span class="token-keyword">$1</span>')

  // Python Builtins & Booleans / Constants
  const pyBuiltins = [
    'True',
    'False',
    'None',
    'self',
    'print',
    'len',
    'range',
    'int',
    'str',
    'float',
    'list',
    'dict',
    'set',
    'tuple',
    'bool',
    'enumerate',
    'zip',
    'map',
    'filter',
    'sorted',
    'sum',
    'min',
    'max',
    'abs',
  ]
  const builtinRegex = new RegExp(`\\b(${pyBuiltins.join('|')})\\b`, 'g')
  html = html.replace(builtinRegex, '<span class="token-builtin">$1</span>')

  // Function definitions: def func_name
  html = html.replace(
    /(<span class="token-keyword">def<\/span>\s+)([a-zA-Z_][a-zA-Z0-9_]*)/g,
    '$1<span class="token-function">$2</span>',
  )

  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')

  return html + commentPart
}

function highlightJsLine(line: string): string {
  // Check for // comment
  const commentIdx = line.indexOf('//')
  let codePart = line
  let commentPart = ''
  if (commentIdx !== -1) {
    let inQuotes = false
    let quoteChar = ''
    for (let i = 0; i < commentIdx; i++) {
      const char = line[i]
      if ((char === '"' || char === "'" || char === '`') && (i === 0 || line[i - 1] !== '\\')) {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (quoteChar === char) {
          inQuotes = false
        }
      }
    }
    if (!inQuotes) {
      codePart = line.substring(0, commentIdx)
      commentPart = `<span class="token-comment">${escapeHtml(line.substring(commentIdx))}</span>`
    }
  }

  let html = escapeHtml(codePart)

  // Strings: "...", '...', `...`
  html = html.replace(
    /(&quot;[\s\S]*?&quot;|&#039;[\s\S]*?&#039;|`[\s\S]*?`)/g,
    '<span class="token-string">$1</span>',
  )

  // JS Keywords
  const jsKeywords = [
    'function',
    'const',
    'let',
    'var',
    'return',
    'if',
    'else',
    'for',
    'while',
    'do',
    'switch',
    'case',
    'break',
    'continue',
    'class',
    'extends',
    'import',
    'export',
    'default',
    'from',
    'try',
    'catch',
    'finally',
    'throw',
    'new',
    'typeof',
    'instanceof',
    'async',
    'await',
    'yield',
    'this',
  ]
  const kwRegex = new RegExp(`\\b(${jsKeywords.join('|')})\\b`, 'g')
  html = html.replace(kwRegex, '<span class="token-keyword">$1</span>')

  // JS Builtins & Literals
  const jsBuiltins = [
    'true',
    'false',
    'null',
    'undefined',
    'NaN',
    'console',
    'Math',
    'JSON',
    'Array',
    'Object',
    'String',
    'Number',
    'Boolean',
    'Set',
    'Map',
    'Promise',
  ]
  const builtinRegex = new RegExp(`\\b(${jsBuiltins.join('|')})\\b`, 'g')
  html = html.replace(builtinRegex, '<span class="token-builtin">$1</span>')

  // Functions: function name()
  html = html.replace(
    /(<span class="token-keyword">function<\/span>\s+)([a-zA-Z_][a-zA-Z0-9_]*)/g,
    '$1<span class="token-function">$2</span>',
  )

  // Numbers
  html = html.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>')

  return html + commentPart
}

export function LiveCodeEditor({
  initialCode,
  initialLanguage = 'python',
  onCodeChange,
  onInsertToAnswer,
  onClose,
  isEmbedded = true,
}: LiveCodeEditorProps) {
  const [language, setLanguage] = useState<SupportedLanguage>(initialLanguage)
  const [code, setCode] = useState<string>(() => initialCode || DEFAULT_STARTER[initialLanguage])
  const [fontSize, setFontSize] = useState<number>(13.5)
  const [copied, setCopied] = useState(false)

  // Execution state
  const [isRunning, setIsRunning] = useState(false)
  const [runResult, setRunResult] = useState<RunCodeResponse | null>(null)
  const [outputOpen, setOutputOpen] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const highlightRef = useRef<HTMLPreElement | null>(null)
  const lineNumbersRef = useRef<HTMLDivElement | null>(null)

  // Sync state change to parent
  useEffect(() => {
    if (onCodeChange) {
      onCodeChange(code, language)
    }
  }, [code, language, onCodeChange])

  // Scroll sync across textarea, line gutter, and syntax highlight layer
  const handleScroll = () => {
    if (!textareaRef.current) return
    const top = textareaRef.current.scrollTop
    const left = textareaRef.current.scrollLeft

    if (highlightRef.current) {
      highlightRef.current.scrollTop = top
      highlightRef.current.scrollLeft = left
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = top
    }
  }

  // Keyboard ergonomics: Tabs, Auto-Indentation & Auto-Closing Brackets/Quotes
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const value = textarea.value

    // Shortcut: ⌘/Ctrl + Enter = Run Code
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRunCode()
      return
    }

    // 1. Tab & Shift+Tab indentation handling
    if (e.key === 'Tab') {
      e.preventDefault()
      const indentUnit = language === 'python' ? '    ' : '  '

      if (start === end) {
        // Single cursor insert indent
        const updated = value.substring(0, start) + indentUnit + value.substring(end)
        setCode(updated)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + indentUnit.length
        }, 0)
      } else {
        // Block indent/outdent
        const startLineIdx = value.lastIndexOf('\n', start - 1) + 1
        const endLineIdx = value.indexOf('\n', end)
        const sliceEnd = endLineIdx === -1 ? value.length : endLineIdx
        const block = value.substring(startLineIdx, sliceEnd)
        const lines = block.split('\n')

        let modifiedBlock: string
        if (e.shiftKey) {
          // Outdent
          modifiedBlock = lines
            .map((l) => (l.startsWith(indentUnit) ? l.substring(indentUnit.length) : l.replace(/^\s{1,4}/, '')))
            .join('\n')
        } else {
          // Indent
          modifiedBlock = lines.map((l) => indentUnit + l).join('\n')
        }

        const updated = value.substring(0, startLineIdx) + modifiedBlock + value.substring(sliceEnd)
        setCode(updated)
        setTimeout(() => {
          textarea.selectionStart = startLineIdx
          textarea.selectionEnd = startLineIdx + modifiedBlock.length
        }, 0)
      }
      return
    }

    // 2. Auto-Indent on Enter
    if (e.key === 'Enter') {
      const lines = value.substring(0, start).split('\n')
      const currentLine = lines[lines.length - 1]
      const match = currentLine.match(/^\s+/)
      const baseIndent = match ? match[0] : ''
      const extraIndent =
        currentLine.trimEnd().endsWith(':') || currentLine.trimEnd().endsWith('{')
          ? language === 'python'
            ? '    '
            : '  '
          : ''
      const insertion = '\n' + baseIndent + extraIndent

      e.preventDefault()
      const updated = value.substring(0, start) + insertion + value.substring(end)
      setCode(updated)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + insertion.length
      }, 0)
      return
    }

    // 3. Auto-Closing Brackets and Quotes Pairs
    const pairs: Record<string, string> = {
      '(': ')',
      '[': ']',
      '{': '}',
      '"': '"',
      "'": "'",
      '`': '`',
    }
    const closingChars = new Set([')', ']', '}', '"', "'", '`'])

    if (pairs[e.key]) {
      // If typing opening bracket/quote
      e.preventDefault()
      const closeChar = pairs[e.key]
      const selected = value.substring(start, end)
      const insertion = e.key + selected + closeChar
      const updated = value.substring(0, start) + insertion + value.substring(end)
      setCode(updated)
      setTimeout(() => {
        textarea.selectionStart = start + 1
        textarea.selectionEnd = start + 1 + selected.length
      }, 0)
      return
    }

    // Skip over existing closing character if typed
    if (closingChars.has(e.key) && start === end && value[start] === e.key) {
      e.preventDefault()
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 1
      }, 0)
      return
    }

    // Backspace between matching empty pairs: delete both
    if (e.key === 'Backspace' && start === end && start > 0) {
      const prev = value[start - 1]
      const next = value[start]
      if (pairs[prev] && pairs[prev] === next) {
        e.preventDefault()
        const updated = value.substring(0, start - 1) + value.substring(start + 1)
        setCode(updated)
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start - 1
        }, 0)
      }
    }
  }

  // Language switch
  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setLanguage(newLang)
    if (code.trim() === DEFAULT_STARTER[language].trim() || !code.trim()) {
      setCode(DEFAULT_STARTER[newLang])
    }
  }

  // Reset code template
  const handleReset = () => {
    if (window.confirm('Reset code editor to default starter boilerplate?')) {
      setCode(DEFAULT_STARTER[language])
      setRunResult(null)
      setOutputOpen(false)
      setErrorBanner(null)
    }
  }

  // Copy code
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback
    }
  }

  // Execute Code in Sandbox
  const handleRunCode = async () => {
    if (isRunning) return
    setIsRunning(true)
    setErrorBanner(null)
    setOutputOpen(true)

    try {
      const res = await runCodeInSandbox({
        code,
        language,
      })
      setRunResult(res)
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Execution failed')
    } finally {
      setIsRunning(false)
    }
  }

  // Embed/Insert code block into answer text
  const handleInsertCode = () => {
    if (!onInsertToAnswer) return
    const formatted = `\`\`\`${language}\n${code.trim()}\n\`\`\``
    onInsertToAnswer(formatted)
  }

  // Line count & numbers
  const lineCount = Math.max(1, code.split('\n').length)
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1)

  // Generate highlighted HTML
  const highlightedHtml = useMemo(() => {
    return highlightSyntax(code, language)
  }, [code, language])

  return (
    <div className={`live-code-editor ${isEmbedded ? 'live-code-editor--embedded' : ''}`}>
      {/* Editor Header Bar */}
      <div className="live-editor__header">
        <div className="live-editor__header-left">
          <div className="live-editor__lang-toggle">
            <button
              type="button"
              className={`live-editor__lang-btn ${language === 'python' ? 'live-editor__lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('python')}
            >
              Python 3.14
            </button>
            <button
              type="button"
              className={`live-editor__lang-btn ${language === 'javascript' ? 'live-editor__lang-btn--active' : ''}`}
              onClick={() => handleLanguageChange('javascript')}
            >
              JavaScript
            </button>
          </div>

          <span className="live-editor__badge">Live Sandbox</span>
        </div>

        <div className="live-editor__header-right">
          <div className="live-editor__font-controls">
            <button
              type="button"
              className="live-editor__tool-btn"
              onClick={() => setFontSize((f) => Math.max(11, f - 1))}
              title="Decrease Font Size"
            >
              A-
            </button>
            <button
              type="button"
              className="live-editor__tool-btn"
              onClick={() => setFontSize((f) => Math.min(18, f + 1))}
              title="Increase Font Size"
            >
              A+
            </button>
          </div>

          <button
            type="button"
            className="live-editor__tool-btn"
            onClick={handleCopy}
            title="Copy code to clipboard"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>

          <button
            type="button"
            className="live-editor__tool-btn"
            onClick={handleReset}
            title="Reset code template"
          >
            Reset
          </button>

          {onClose && (
            <button
              type="button"
              className="live-editor__close-btn"
              onClick={onClose}
              title="Minimize code window"
              aria-label="Close Code Window"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Editor Main Surface (Line Numbers + Highlight Overlay + Interactive Textarea) */}
      <div className="live-editor__body" style={{ fontSize: `${fontSize}px` }}>
        {/* Line Numbers Gutter */}
        <div ref={lineNumbersRef} className="live-editor__gutter" aria-hidden="true">
          {lineNumbers.map((num) => (
            <div key={num} className="live-editor__gutter-num">
              {num}
            </div>
          ))}
        </div>

        {/* Code Canvas Area */}
        <div className="live-editor__canvas">
          {/* Syntax Highlighted HTML Background Layer */}
          <pre
            ref={highlightRef}
            className="live-editor__highlight"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: highlightedHtml + '\n' }}
          />

          {/* Transparent Input Textarea */}
          <textarea
            ref={textareaRef}
            className="live-editor__textarea"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder={language === 'python' ? '# Type your Python code here...' : '// Type your JavaScript code here...'}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
          />
        </div>
      </div>

      {/* Action Footer & Run Button */}
      <div className="live-editor__footer">
        <div className="live-editor__footer-left">
          <button
            type="button"
            className={`live-editor__run-btn ${isRunning ? 'live-editor__run-btn--running' : ''}`}
            onClick={handleRunCode}
            disabled={isRunning}
            title="Execute code in sandbox (⌘/Ctrl + Enter)"
          >
            {isRunning ? (
              <>
                <StopIcon width={14} height={14} className="live-editor__spin" />
                <span>Running…</span>
              </>
            ) : (
              <>
                <PlayIcon width={14} height={14} />
                <span>Run Code</span>
              </>
            )}
          </button>

          {onInsertToAnswer && (
            <button
              type="button"
              className="live-editor__insert-btn"
              onClick={handleInsertCode}
              title="Attach code snippet into your response"
            >
              Attach Code to Answer
            </button>
          )}
        </div>

        <div className="live-editor__footer-right">
          <button
            type="button"
            className={`live-editor__toggle-output-btn ${outputOpen ? 'live-editor__toggle-output-btn--active' : ''}`}
            onClick={() => setOutputOpen((prev) => !prev)}
          >
            Console Output {runResult ? `(${runResult.total_execution_time_ms}ms)` : ''} {outputOpen ? '▼' : '▲'}
          </button>
        </div>
      </div>

      {/* Execution Output Drawer */}
      {outputOpen && (
        <div className="live-editor__output-drawer">
          <div className="live-editor__output-header">
            <span className="live-editor__output-title">Execution Console</span>
            {runResult && (
              <span className={`live-editor__status-badge ${runResult.error ? 'live-editor__status-badge--err' : 'live-editor__status-badge--ok'}`}>
                {runResult.error ? 'Runtime Error' : 'Finished in ' + runResult.total_execution_time_ms + 'ms'}
              </span>
            )}
          </div>

          <div className="live-editor__output-content">
            {errorBanner && <div className="live-editor__console-err">{errorBanner}</div>}

            {runResult ? (
              <>
                {runResult.stdout && (
                  <div className="live-editor__console-stdout">
                    <span className="live-editor__console-label">Standard Output:</span>
                    <pre>{runResult.stdout}</pre>
                  </div>
                )}
                {runResult.stderr && (
                  <div className="live-editor__console-stderr">
                    <span className="live-editor__console-label">Standard Error:</span>
                    <pre>{runResult.stderr}</pre>
                  </div>
                )}
                {runResult.error && (
                  <div className="live-editor__console-err">
                    <span className="live-editor__console-label">Error Details:</span>
                    <pre>{runResult.error}</pre>
                  </div>
                )}
                {!runResult.stdout && !runResult.stderr && !runResult.error && (
                  <div className="live-editor__console-empty">Code executed successfully with no output returned.</div>
                )}
              </>
            ) : (
              !errorBanner && (
                <div className="live-editor__console-empty">
                  Click &ldquo;Run Code&rdquo; or press <kbd>⌘</kbd>+<kbd>Enter</kbd> to execute your code in the sandbox.
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  )
}
