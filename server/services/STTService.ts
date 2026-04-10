// ============================================================
// HireOS — STT Service (Deepgram Streaming)
// Each interview session gets its own STT connection.
// ============================================================

import Redis from 'ioredis'

// Deepgram SDK types (imported dynamically to avoid build issues if not installed)
interface DeepgramConfig {
  apiKey: string
  model: string
  language: string
  smartFormat: boolean
  punctuate: boolean
  interimResults: boolean
  utteranceEndMs: number
  vadEvents: boolean
  encoding: string
  sampleRate: number
  keywords?: string[]
}

interface TranscriptResult {
  text: string
  isFinal: boolean
  confidence: number
  words: { word: string; start: number; end: number }[]
}

// Common technical keyword boost list
const TECHNICAL_KEYWORDS = [
  'Dijkstra',
  'Bellman-Ford',
  'Prim',
  'Kruskal',
  'Kubernetes',
  'microservices',
  'eventual consistency',
  'segfault',
  'hashmap',
  'malloc',
  'binary search',
  'dynamic programming',
  'memoization',
  'recursion',
  'breadth-first',
  'depth-first',
  'topological sort',
  'Red-Black tree',
  'B-tree',
  'trie',
  'heap',
  'queue',
  'stack',
  'linked list',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Kafka',
  'RabbitMQ',
  'Docker',
  'gVisor',
  'API gateway',
  'load balancer',
  'sharding',
  'replication',
  'CAP theorem',
  'ACID',
  'BASE',
  'WebSocket',
  'REST',
  'gRPC',
  'GraphQL',
  'big O notation',
  'O of n',
  'O of n squared',
  'O of log n',
  'amortized',
]

// Transcript normalization rules
const NORMALIZATION_RULES: [RegExp, string][] = [
  [/\bbig oh?\b/gi, 'O'],
  [/\bo of n\b/gi, 'O(n)'],
  [/\bo of n squared\b/gi, 'O(n²)'],
  [/\bo of n log n\b/gi, 'O(n log n)'],
  [/\bo of log n\b/gi, 'O(log n)'],
  [/\bo of one\b/gi, 'O(1)'],
  [/\bo of n cubed\b/gi, 'O(n³)'],
  [/\bdijkra\b/gi, 'Dijkstra'],
  [/\bdijkstra's?\b/gi, "Dijkstra's"],
  [/\bpostgre\b/gi, 'PostgreSQL'],
  [/\bpostgres\b/gi, 'PostgreSQL'],
  [/\bredis\b/gi, 'Redis'],
  [/\bkafka\b/gi, 'Kafka'],
  [/\bkubernetes\b/gi, 'Kubernetes'],
  [/\bk8s\b/gi, 'Kubernetes'],
  [/\bdocker\b/gi, 'Docker'],
  // Indian number system
  [/(\d+)\s*crore/gi, (_, n) => `${parseInt(n) * 10000000}`],
  [/(\d+)\s*lakh/gi, (_, n) => `${parseInt(n) * 100000}`],
]

// Filler words to strip (only when transcript is long enough)
const FILLER_WORDS = /\b(um|uh|like,?\s|you know,?\s|basically,?\s|actually,?\s|so basically,?\s)/gi

export class STTService {
  private redis: Redis
  private sessionId: string
  private config: DeepgramConfig
  private ws: WebSocket | null = null
  private currentLanguage: 'en' | 'hi' = 'en'

  constructor(redis: Redis, sessionId: string, apiKey: string) {
    this.redis = redis
    this.sessionId = sessionId
    this.config = {
      apiKey,
      model: 'nova-2',
      language: 'en',
      smartFormat: true,
      punctuate: true,
      interimResults: true,
      utteranceEndMs: 1200,
      vadEvents: true,
      encoding: 'linear16',
      sampleRate: 16000,
      keywords: TECHNICAL_KEYWORDS,
    }
  }

  async connect(): Promise<void> {
    const params = new URLSearchParams({
      model: this.config.model,
      language: this.config.language,
      smart_format: String(this.config.smartFormat),
      punctuate: String(this.config.punctuate),
      interim_results: String(this.config.interimResults),
      utterance_end_ms: String(this.config.utteranceEndMs),
      vad_events: String(this.config.vadEvents),
      encoding: this.config.encoding,
      sample_rate: String(this.config.sampleRate),
    })

    // Add keyword boosts
    if (this.config.keywords) {
      for (const kw of this.config.keywords) {
        params.append('keywords', kw)
      }
    }

    const url = `wss://api.deepgram.com/v1/listen?${params.toString()}`

    this.ws = new WebSocket(url, {
      headers: { Authorization: `Token ${this.config.apiKey}` },
    } as unknown as string)

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleDeepgramMessage(event.data.toString())
    }

    this.ws.onerror = (event: Event) => {
      console.error('[STT] Deepgram WebSocket error:', event)
    }

    this.ws.onclose = () => {
      console.log('[STT] Deepgram connection closed')
    }

    // Wait for open
    await new Promise<void>((resolve, reject) => {
      if (!this.ws) return reject(new Error('No WebSocket'))
      this.ws.onopen = () => resolve()
      setTimeout(() => reject(new Error('Deepgram connection timeout')), 10000)
    })
  }

  /** Send raw PCM audio data to Deepgram */
  sendAudio(pcmBuffer: Buffer): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(pcmBuffer)
    }
  }

  /** Switch STT language (tears down and recreates connection) */
  async switchLanguage(language: 'en' | 'hi'): Promise<void> {
    this.currentLanguage = language
    this.disconnect()

    if (language === 'hi') {
      this.config.model = 'base'
      this.config.language = 'hi'
      this.config.keywords = [] // Hindi model doesn't support keyword boost
    } else {
      this.config.model = 'nova-2'
      this.config.language = 'en'
      this.config.keywords = TECHNICAL_KEYWORDS
    }

    await this.connect()
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  // ─── Private ────────────────────────────────────────────

  private async handleDeepgramMessage(raw: string): Promise<void> {
    try {
      const data = JSON.parse(raw)

      if (data.type === 'Results') {
        const alt = data.channel?.alternatives?.[0]
        if (!alt) return

        const transcript = alt.transcript as string
        if (!transcript) return

        const isFinal = data.is_final === true

        const result: TranscriptResult = {
          text: transcript,
          isFinal,
          confidence: alt.confidence ?? 0,
          words: alt.words ?? [],
        }

        if (isFinal) {
          // Normalize and emit final transcript
          const normalized = this.normalizeTranscript(result.text)

          await this.redis.xadd(
            `interview:${this.sessionId}:events`,
            '*',
            'type',
            'transcript:final',
            'data',
            JSON.stringify({ text: normalized, confidence: result.confidence, timestamp: Date.now() }),
          )
        } else {
          // Emit partial transcript (for real-time display)
          await this.redis.xadd(
            `interview:${this.sessionId}:events`,
            '*',
            'type',
            'transcript:partial',
            'data',
            JSON.stringify({ text: result.text, timestamp: Date.now() }),
          )
        }
      }

      if (data.type === 'UtteranceEnd') {
        await this.redis.xadd(
          `interview:${this.sessionId}:events`,
          '*',
          'type',
          'utterance:end',
          'data',
          JSON.stringify({ timestamp: Date.now() }),
        )
      }
    } catch (err) {
      console.error('[STT] Error handling Deepgram message:', err)
    }
  }

  private normalizeTranscript(text: string): string {
    let normalized = text

    // Apply normalization rules
    for (const [pattern, replacement] of NORMALIZATION_RULES) {
      if (typeof replacement === 'string') {
        normalized = normalized.replace(pattern, replacement)
      } else {
        normalized = normalized.replace(pattern, replacement as (...args: string[]) => string)
      }
    }

    // Strip filler words only for longer transcripts (>100 chars)
    if (normalized.length > 100) {
      normalized = normalized.replace(FILLER_WORDS, '')
      // Clean up double spaces
      normalized = normalized.replace(/\s{2,}/g, ' ').trim()
    }

    return normalized
  }
}
