/**
 * CodeWatcherAgent integration test.
 * Feeds known code patterns and asserts correct trigger types are emitted.
 */

import { describe, it, expect } from 'vitest'

// Inline the detection logic from CodeAnalysisEngine for testing
function detectPatterns(code: string, language: string) {
  const triggers: string[] = []

  // Nested loops → brute force
  const nestedLoopPattern = /for\s*\(.*\)\s*\{[^}]*for\s*\(/s
  const pyNestedLoop = /for\s+\w+\s+in\s+.*:\s*\n\s+for\s+\w+\s+in/
  if (nestedLoopPattern.test(code) || pyNestedLoop.test(code)) {
    triggers.push('nested_loops')
  }

  // Recursion without memoization
  const fnMatch = code.match(/function\s+(\w+)|def\s+(\w+)/)
  if (fnMatch) {
    const fnName = fnMatch[1] || fnMatch[2]
    const callPattern = new RegExp(`${fnName}\\s*\\(`, 'g')
    const calls = code.match(callPattern)
    if (calls && calls.length >= 2) {
      // Recursive — check for memo
      const hasMemo =
        /memo|cache|dp\[|@lru_cache|@cache|functools/.test(code)
      if (!hasMemo) {
        triggers.push('recursion_no_memo')
      }
    }
  }

  // No edge case checks
  const hasEdgeCheck =
    /if\s*\(\s*!|if\s+not\s|\.length\s*===?\s*0|== None|=== null|=== undefined|\.empty\(\)/.test(
      code,
    )
  if (!hasEdgeCheck && code.length > 100) {
    triggers.push('no_edge_cases')
  }

  // Copy-paste detection (placeholder — real detection uses diff timing)
  // Algorithm switch detection (placeholder — real detection uses diff %)

  return triggers
}

function detectAlgorithmFamily(code: string): string {
  if (/\.sort\(|sorted\(|Arrays\.sort|sort\.Ints/.test(code)) return 'sorting'
  if (/while\s*\(.*left.*right|two.?pointer/i.test(code)) return 'two_pointer'
  if (/memo|dp\[|dynamic.?prog/i.test(code)) return 'dynamic_programming'
  if (/queue|bfs|breadth.?first/i.test(code)) return 'bfs'
  if (/stack.*dfs|depth.?first|dfs/i.test(code)) return 'dfs'
  if (
    /while\s*\(.*low.*high|mid\s*=.*\/\s*2|binary.?search/i.test(code)
  )
    return 'binary_search'
  if (/window|sliding/i.test(code)) return 'sliding_window'
  return 'unknown'
}

describe('CodeWatcherAgent', () => {
  it('should detect nested loops in O(n²) sort (JavaScript)', () => {
    const code = `
function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
      }
    }
  }
  return arr;
}
`
    const triggers = detectPatterns(code, 'javascript')
    expect(triggers).toContain('nested_loops')
  })

  it('should detect recursive fibonacci without memoization (Python)', () => {
    const code = `
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
`
    const triggers = detectPatterns(code, 'python')
    expect(triggers).toContain('recursion_no_memo')
  })

  it('should NOT flag recursion with memoization', () => {
    const code = `
from functools import lru_cache

@lru_cache(maxsize=None)
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)
`
    const triggers = detectPatterns(code, 'python')
    expect(triggers).not.toContain('recursion_no_memo')
  })

  it('should detect missing edge case checks in longer code', () => {
    const code = `
function twoSum(nums, target) {
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}
`
    const triggers = detectPatterns(code, 'javascript')
    expect(triggers).toContain('no_edge_cases')
  })

  it('should NOT flag edge cases when null check is present', () => {
    const code = `
function twoSum(nums, target) {
    if (!nums || nums.length === 0) return [];
    const map = new Map();
    for (let i = 0; i < nums.length; i++) {
        const complement = target - nums[i];
        if (map.has(complement)) {
            return [map.get(complement), i];
        }
        map.set(nums[i], i);
    }
    return [];
}
`
    const triggers = detectPatterns(code, 'javascript')
    expect(triggers).not.toContain('no_edge_cases')
  })

  it('should classify two-pointer algorithm', () => {
    const code = `
function twoSumSorted(nums, target) {
    let left = 0;
    let right = nums.length - 1;
    while (left < right) {
        const sum = nums[left] + nums[right];
        if (sum === target) return [left, right];
        if (sum < target) left++;
        else right--;
    }
    return [];
}
`
    expect(detectAlgorithmFamily(code)).toBe('two_pointer')
  })

  it('should classify binary search algorithm', () => {
    const code = `
function binarySearch(arr, target) {
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (arr[mid] === target) return mid;
        if (arr[mid] < target) low = mid + 1;
        else high = mid - 1;
    }
    return -1;
}
`
    expect(detectAlgorithmFamily(code)).toBe('binary_search')
  })

  it('should classify dynamic programming', () => {
    const code = `
function longestCommonSubsequence(text1, text2) {
    const dp = Array(text1.length + 1).fill(null).map(() =>
        Array(text2.length + 1).fill(0)
    );
    for (let i = 1; i <= text1.length; i++) {
        for (let j = 1; j <= text2.length; j++) {
            if (text1[i-1] === text2[j-1]) {
                dp[i][j] = dp[i-1][j-1] + 1;
            } else {
                dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
            }
        }
    }
    return dp[text1.length][text2.length];
}
`
    expect(detectAlgorithmFamily(code)).toBe('dynamic_programming')
  })

  it('should classify sliding window', () => {
    const code = `
function maxSumSubarray(arr, k) {
    let windowSum = 0;
    for (let i = 0; i < k; i++) windowSum += arr[i];
    let maxSum = windowSum;
    for (let i = k; i < arr.length; i++) {
        windowSum += arr[i] - arr[i - k];
        maxSum = Math.max(maxSum, windowSum);
    }
    return maxSum;
}
`
    expect(detectAlgorithmFamily(code)).toBe('sliding_window')
  })

  it('should detect nested loops in Python', () => {
    const code = `
def find_duplicates(matrix):
    result = []
    for i in range(len(matrix)):
        for j in range(len(matrix[0])):
            if matrix[i][j] in result:
                continue
            result.append(matrix[i][j])
    return result
`
    const triggers = detectPatterns(code, 'python')
    expect(triggers).toContain('nested_loops')
  })

  it('should rate-limit triggers (90 second cooldown simulation)', () => {
    const lastTriggerTime: Record<string, number> = {}
    const RATE_LIMIT_MS = 90_000

    const canTrigger = (type: string, now: number): boolean => {
      const last = lastTriggerTime[type]
      if (last && now - last < RATE_LIMIT_MS) return false
      lastTriggerTime[type] = now
      return true
    }

    const t0 = Date.now()
    expect(canTrigger('nested_loops', t0)).toBe(true)
    expect(canTrigger('nested_loops', t0 + 30_000)).toBe(false) // 30s later — blocked
    expect(canTrigger('nested_loops', t0 + 91_000)).toBe(true) // 91s later — allowed
    expect(canTrigger('no_edge_cases', t0 + 30_000)).toBe(true) // different type — allowed
  })
})
