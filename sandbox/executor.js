const express = require('express')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const app = express()
app.use(express.json({ limit: '1mb' }))

const PORT = 4000
const MAX_TEST_CASES = 10
const MAX_TOTAL_TIMEOUT_MS = 30_000
const PER_TEST_TIMEOUT_MS = 10_000
const MAX_MEMORY_MB = 256

const EXTENSIONS = {
  python: '.py',
  javascript: '.js',
  typescript: '.ts',
  java: '.java',
  go: '.go',
  cpp: '.cpp',
  rust: '.rs',
}

/**
 * POST /execute
 * Body: { code, language, testCases: [{input, expected}], timeoutMs? }
 * Returns: { results: [{passed, input, expected, actual, error, timeMs}] }
 */
app.post('/execute', async (req, res) => {
  const { code, language, testCases, timeoutMs } = req.body

  if (!code || !language || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({ error: 'Missing required fields: code, language, testCases' })
  }

  if (testCases.length > MAX_TEST_CASES) {
    return res.status(400).json({ error: `Maximum ${MAX_TEST_CASES} test cases allowed` })
  }

  const ext = EXTENSIONS[language]
  if (!ext) {
    return res.status(400).json({ error: `Unsupported language: ${language}` })
  }

  const totalTimeout = Math.min(timeoutMs || MAX_TOTAL_TIMEOUT_MS, MAX_TOTAL_TIMEOUT_MS)
  const startTime = Date.now()
  const results = []

  // Write code to temp file
  const fileId = crypto.randomBytes(8).toString('hex')
  const fileName = language === 'java' ? 'Solution' + ext : `solution_${fileId}${ext}`
  const filePath = path.join('/tmp/sandbox', fileName)

  try {
    fs.writeFileSync(filePath, code, 'utf-8')

    for (let i = 0; i < testCases.length; i++) {
      const elapsed = Date.now() - startTime
      if (elapsed >= totalTimeout) {
        results.push({
          testCase: i + 1,
          passed: false,
          input: testCases[i].input,
          expected: testCases[i].expected,
          actual: '',
          error: 'Total timeout exceeded',
          timeMs: 0,
        })
        continue
      }

      const remainingTime = Math.min(PER_TEST_TIMEOUT_MS, totalTimeout - elapsed)
      const tcResult = await runTestCase(
        filePath,
        language,
        testCases[i],
        remainingTime,
        i + 1,
      )
      results.push(tcResult)
    }
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(filePath)
    } catch {
      // ignore
    }
    // Clean up compiled Java class
    if (language === 'java') {
      try {
        fs.unlinkSync(filePath.replace('.java', '.class'))
      } catch {
        // ignore
      }
    }
  }

  res.json({ results })
})

/**
 * POST /execute/stream
 * SSE endpoint that streams results as each test case completes.
 */
app.post('/execute/stream', async (req, res) => {
  const { code, language, testCases, timeoutMs } = req.body

  if (!code || !language || !testCases || !Array.isArray(testCases)) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  if (testCases.length > MAX_TEST_CASES) {
    return res.status(400).json({ error: `Maximum ${MAX_TEST_CASES} test cases allowed` })
  }

  const ext = EXTENSIONS[language]
  if (!ext) {
    return res.status(400).json({ error: `Unsupported language: ${language}` })
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const totalTimeout = Math.min(timeoutMs || MAX_TOTAL_TIMEOUT_MS, MAX_TOTAL_TIMEOUT_MS)
  const startTime = Date.now()

  const fileId = crypto.randomBytes(8).toString('hex')
  const fileName = language === 'java' ? 'Solution' + ext : `solution_${fileId}${ext}`
  const filePath = path.join('/tmp/sandbox', fileName)

  try {
    fs.writeFileSync(filePath, code, 'utf-8')

    for (let i = 0; i < testCases.length; i++) {
      const elapsed = Date.now() - startTime
      if (elapsed >= totalTimeout) {
        res.write(
          `data: ${JSON.stringify({
            testCase: i + 1,
            passed: false,
            error: 'Total timeout exceeded',
            timeMs: 0,
          })}\n\n`,
        )
        continue
      }

      const remainingTime = Math.min(PER_TEST_TIMEOUT_MS, totalTimeout - elapsed)
      const result = await runTestCase(filePath, language, testCases[i], remainingTime, i + 1)
      res.write(`data: ${JSON.stringify(result)}\n\n`)
    }

    res.write('data: [DONE]\n\n')
  } finally {
    try {
      fs.unlinkSync(filePath)
    } catch {
      // ignore
    }
    if (language === 'java') {
      try {
        fs.unlinkSync(filePath.replace('.java', '.class'))
      } catch {
        // ignore
      }
    }
  }

  res.end()
})

function runTestCase(filePath, language, testCase, timeoutMs, testNumber) {
  return new Promise((resolve) => {
    const tcStart = Date.now()
    const input = testCase.input || ''
    const expected = (testCase.expected || '').trim()

    const child = spawn('./run-language.sh', [language, filePath], {
      timeout: timeoutMs,
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: '/app',
      env: {
        ...process.env,
        // Memory limit hint (not enforced here — gVisor handles it)
        NODE_OPTIONS: `--max-old-space-size=${MAX_MEMORY_MB}`,
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
      // Prevent unbounded output
      if (stdout.length > 100_000) {
        child.kill('SIGKILL')
      }
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
      if (stderr.length > 50_000) {
        child.kill('SIGKILL')
      }
    })

    // Send input via stdin
    if (input) {
      child.stdin.write(input)
    }
    child.stdin.end()

    child.on('close', (code) => {
      const timeMs = Date.now() - tcStart
      const actual = stdout.trim()

      if (code === null) {
        // killed (timeout)
        resolve({
          testCase: testNumber,
          passed: false,
          input: testCase.input,
          expected,
          actual: '',
          error: `Time limit exceeded (${timeoutMs}ms)`,
          timeMs,
        })
      } else if (code !== 0) {
        resolve({
          testCase: testNumber,
          passed: false,
          input: testCase.input,
          expected,
          actual,
          error: stderr.trim().slice(0, 2000) || `Process exited with code ${code}`,
          timeMs,
        })
      } else {
        resolve({
          testCase: testNumber,
          passed: actual === expected,
          input: testCase.input,
          expected,
          actual,
          error: null,
          timeMs,
        })
      }
    })

    child.on('error', (err) => {
      resolve({
        testCase: testNumber,
        passed: false,
        input: testCase.input,
        expected,
        actual: '',
        error: `Execution error: ${err.message}`,
        timeMs: Date.now() - tcStart,
      })
    })
  })
}

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', languages: Object.keys(EXTENSIONS) })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`HireOS Sandbox running on port ${PORT}`)
})
