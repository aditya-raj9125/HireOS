// ============================================================
// HireOS — Code Analysis Engine
// Tree-sitter based AST analysis for algorithm family detection,
// complexity estimation, and structural pattern recognition.
// ============================================================

// ─── Types ──────────────────────────────────────────────────

export type AlgorithmFamily =
  | 'brute_force'
  | 'dynamic_programming'
  | 'greedy'
  | 'graph'
  | 'binary_search'
  | 'divide_conquer'
  | 'two_pointer'
  | 'sliding_window'
  | 'unknown'

export interface ComplexityHint {
  time: string
  space: string
  confidence: number
}

export interface CodeAnalysis {
  algorithmFamily: AlgorithmFamily
  timeComplexityHint: ComplexityHint
  hasNestedLoops: boolean
  recursionDepth: number
  hasEdgeCaseChecks: boolean
  usesBuiltins: string[]
  isPastedCode: boolean
  problemProgress: number
}

// ─── Pattern Detectors ──────────────────────────────────────

// Simple heuristic-based analysis using regex patterns
// (tree-sitter is the ideal solution but adds heavy native deps;
// this regex approach covers the main triggers reliably)

const LOOP_PATTERNS: Record<string, RegExp[]> = {
  python: [/\bfor\s+\w+\s+in\b/g, /\bwhile\s+/g],
  javascript: [/\bfor\s*\(/g, /\bwhile\s*\(/g, /\.forEach\s*\(/g, /\.map\s*\(/g],
  typescript: [/\bfor\s*\(/g, /\bwhile\s*\(/g, /\.forEach\s*\(/g, /\.map\s*\(/g],
  java: [/\bfor\s*\(/g, /\bwhile\s*\(/g],
  cpp: [/\bfor\s*\(/g, /\bwhile\s*\(/g],
  go: [/\bfor\s+/g],
}

const RECURSION_PATTERNS: Record<string, RegExp> = {
  python: /\bdef\s+(\w+)\s*\([^)]*\)[\s\S]*?\b\1\s*\(/,
  javascript: /\bfunction\s+(\w+)\s*\([^)]*\)[\s\S]*?\b\1\s*\(/,
  typescript: /\bfunction\s+(\w+)\s*\([^)]*\)[\s\S]*?\b\1\s*\(/,
  java: /\b(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\b\1\s*\(/,
  cpp: /\b(\w+)\s*\([^)]*\)\s*\{[\s\S]*?\b\1\s*\(/,
  go: /\bfunc\s+(\w+)\s*\([^)]*\)[\s\S]*?\b\1\s*\(/,
}

const MEMO_PATTERNS = [
  /\bmemo\b/i,
  /\bcache\b/i,
  /\bdp\s*[\[=]/,
  /\bfunctools\.lru_cache\b/,
  /\b@cache\b/,
  /\b@lru_cache\b/,
  /\bHashMap\b/,
  /\bMap\s*\(\)/,
  /\bnew\s+Map\b/,
  /\bdict\s*\(\)/,
  /\{\s*\}\s*#?\s*memo/i,
]

const TWO_POINTER_PATTERNS = [
  /\b(left|lo|low|l)\b[\s\S]{0,50}\b(right|hi|high|r)\b/,
  /\b(start|begin)\b[\s\S]{0,50}\b(end|finish)\b/,
  /while\s*\(\s*\w+\s*<\s*\w+\s*\)/,
]

const BINARY_SEARCH_PATTERNS = [
  /\b(mid|middle)\s*=\s*.*\b(left|lo|low|right|hi|high)\b/,
  /\b(left|lo)\s*\+\s*\(\s*(right|hi)\s*-\s*(left|lo)\s*\)\s*\/?\s*\/?\s*2/,
  /Math\.floor\s*\(\s*\(\s*\w+\s*\+\s*\w+\s*\)\s*\/\s*2\s*\)/,
  /\bbisect\b/,
  /\bArrays\.binarySearch\b/,
  /\bsort\.Search\b/,
]

const GRAPH_PATTERNS = [
  /\b(queue|deque)\b.*\b(append|push|add)\b/,
  /\bBFS\b/i,
  /\bDFS\b/i,
  /\bvisited\b/,
  /\badjacency\b/i,
  /\b(neighbors|adj)\b/,
]

const SLIDING_WINDOW_PATTERNS = [
  /\bwindow\b/i,
  /\b\w+\s*-\s*\w+\s*>=?\s*\w+\s*&&/,
]

const SORT_PATTERNS = [
  /\.sort\s*\(/,
  /\bsorted\s*\(/,
  /Arrays\.sort\s*\(/,
  /Collections\.sort\s*\(/,
  /sort\.Slice\s*\(/,
  /std::sort\s*\(/,
]

const EDGE_CASE_PATTERNS = [
  /if\s*\(\s*!?\s*\w+\s*(===?\s*(null|undefined|None|nil|0|"")|\.length\s*(===?\s*0|<=?\s*1))\s*\)/,
  /if\s*\(\s*\w+\s*===?\s*null\b/,
  /if\s*\(\s*\w+\s+is\s+None\b/,
  /if\s*\(\s*len\s*\(\s*\w+\s*\)\s*(===?\s*0|<=?\s*1)\s*\)/,
  /if\s*\(\s*\w+\.length\s*(===?\s*0|<=?\s*1)\s*\)/,
  /if\s*\(\s*\w+\.isEmpty\b/,
]

const BUILTIN_PATTERNS: Record<string, RegExp[]> = {
  python: [/\bsorted\b/, /\breversed\b/, /\bmap\b/, /\bfilter\b/, /\breduce\b/, /\bset\b/, /\bheapq\b/, /\bcollections\b/],
  javascript: [/\.sort\b/, /\.reverse\b/, /\.map\b/, /\.filter\b/, /\.reduce\b/, /\bnew Set\b/, /\bnew Map\b/],
  typescript: [/\.sort\b/, /\.reverse\b/, /\.map\b/, /\.filter\b/, /\.reduce\b/, /\bnew Set\b/, /\bnew Map\b/],
  java: [/Arrays\.sort\b/, /Collections\.sort\b/, /\.stream\b/, /PriorityQueue\b/, /HashMap\b/, /TreeMap\b/],
  cpp: [/std::sort\b/, /std::reverse\b/, /std::map\b/, /std::set\b/, /priority_queue\b/],
  go: [/sort\.Sort\b/, /sort\.Slice\b/],
}

// ─── Engine ─────────────────────────────────────────────────

export class CodeAnalysisEngine {
  /**
   * Analyze code for structural patterns, algorithm family, and complexity.
   */
  analyze(code: string, language: string): CodeAnalysis {
    const lang = language.toLowerCase()

    const hasNestedLoops = this.detectNestedLoops(code, lang)
    const recursionDepth = this.detectRecursion(code, lang)
    const hasMemo = this.detectMemoization(code)
    const hasTwoPointer = this.matchAny(code, TWO_POINTER_PATTERNS)
    const hasBinarySearch = this.matchAny(code, BINARY_SEARCH_PATTERNS)
    const hasGraph = this.matchAny(code, GRAPH_PATTERNS)
    const hasSlidingWindow = this.matchAny(code, SLIDING_WINDOW_PATTERNS)
    const hasSort = this.matchAny(code, SORT_PATTERNS)
    const hasEdgeCaseChecks = this.matchAny(code, EDGE_CASE_PATTERNS)
    const usesBuiltins = this.detectBuiltins(code, lang)

    // Determine algorithm family
    const algorithmFamily = this.classifyAlgorithm({
      hasNestedLoops,
      recursionDepth,
      hasMemo,
      hasTwoPointer,
      hasBinarySearch,
      hasGraph,
      hasSlidingWindow,
    })

    // Estimate complexity
    const timeComplexityHint = this.estimateComplexity({
      hasNestedLoops,
      recursionDepth,
      hasMemo,
      hasSort,
      hasBinarySearch,
      algorithmFamily,
    })

    return {
      algorithmFamily,
      timeComplexityHint,
      hasNestedLoops,
      recursionDepth,
      hasEdgeCaseChecks,
      usesBuiltins,
      isPastedCode: false, // Determined by CodeWatcherAgent via diff timing
      problemProgress: this.estimateProgress(code),
    }
  }

  // ─── Detection Methods ────────────────────────────────────

  private detectNestedLoops(code: string, lang: string): boolean {
    const patterns = LOOP_PATTERNS[lang] || LOOP_PATTERNS.javascript
    const lines = code.split('\n')

    let depth = 0
    let maxDepth = 0

    for (const line of lines) {
      const trimmed = line.trim()
      for (const pattern of patterns) {
        pattern.lastIndex = 0
        if (pattern.test(trimmed)) {
          depth++
          maxDepth = Math.max(maxDepth, depth)
        }
      }
      // Simple depth tracking via braces/indentation
      if (trimmed === '}' || trimmed === '') {
        depth = Math.max(0, depth - 1)
      }
    }

    return maxDepth >= 2
  }

  private detectRecursion(code: string, lang: string): number {
    const pattern = RECURSION_PATTERNS[lang] || RECURSION_PATTERNS.javascript
    const match = code.match(pattern)
    if (!match) return 0

    // Count recursive calls to estimate depth
    const fnName = match[1]
    const callCount = (code.match(new RegExp(`\\b${fnName}\\s*\\(`, 'g')) || []).length
    return callCount > 1 ? Math.min(callCount - 1, 5) : 1
  }

  private detectMemoization(code: string): boolean {
    return MEMO_PATTERNS.some((p) => p.test(code))
  }

  private detectBuiltins(code: string, lang: string): string[] {
    const patterns = BUILTIN_PATTERNS[lang] || BUILTIN_PATTERNS.javascript
    return patterns
      .filter((p) => p.test(code))
      .map((p) => {
        const match = code.match(p)
        return match?.[0]?.trim() || ''
      })
      .filter(Boolean)
  }

  private matchAny(code: string, patterns: RegExp[]): boolean {
    return patterns.some((p) => p.test(code))
  }

  // ─── Classification ───────────────────────────────────────

  private classifyAlgorithm(features: {
    hasNestedLoops: boolean
    recursionDepth: number
    hasMemo: boolean
    hasTwoPointer: boolean
    hasBinarySearch: boolean
    hasGraph: boolean
    hasSlidingWindow: boolean
  }): AlgorithmFamily {
    if (features.hasBinarySearch) return 'binary_search'
    if (features.hasGraph) return 'graph'
    if (features.recursionDepth > 0 && features.hasMemo) return 'dynamic_programming'
    if (features.hasTwoPointer) return 'two_pointer'
    if (features.hasSlidingWindow) return 'sliding_window'
    if (features.recursionDepth > 0 && !features.hasMemo) return 'divide_conquer'
    if (features.hasNestedLoops) return 'brute_force'
    return 'unknown'
  }

  private estimateComplexity(features: {
    hasNestedLoops: boolean
    recursionDepth: number
    hasMemo: boolean
    hasSort: boolean
    hasBinarySearch: boolean
    algorithmFamily: AlgorithmFamily
  }): ComplexityHint {
    if (features.hasBinarySearch) {
      return { time: 'O(log n)', space: 'O(1)', confidence: 0.7 }
    }
    if (features.algorithmFamily === 'dynamic_programming') {
      return { time: 'O(n²)', space: 'O(n)', confidence: 0.5 }
    }
    if (features.recursionDepth > 0 && !features.hasMemo) {
      return { time: 'O(2^n)', space: 'O(n)', confidence: 0.4 }
    }
    if (features.hasSort) {
      return {
        time: features.hasNestedLoops ? 'O(n² log n)' : 'O(n log n)',
        space: 'O(n)',
        confidence: 0.6,
      }
    }
    if (features.hasNestedLoops) {
      return { time: 'O(n²)', space: 'O(1)', confidence: 0.6 }
    }
    return { time: 'O(n)', space: 'O(1)', confidence: 0.3 }
  }

  private estimateProgress(code: string): number {
    // Rough heuristic: non-empty lines as percentage of "typical" solution
    const lines = code.split('\n').filter((l) => l.trim().length > 0)
    const lineCount = lines.length
    if (lineCount < 3) return 0.05
    if (lineCount < 10) return 0.3
    if (lineCount < 25) return 0.6
    if (lineCount < 50) return 0.8
    return 0.95
  }
}
