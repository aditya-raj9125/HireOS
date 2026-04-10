// ============================================================
// HireOS — Recording Manager
// Client-side class that manages video/audio recording,
// chunked upload to R2, and finalization.
// ============================================================

interface RecordingConfig {
  token: string
  sessionId: string
  candidateId: string
  jobId: string
  type: 'video' | 'audio' | 'screen'
  stream: MediaStream
}

interface UploadPart {
  partNumber: number
  etag: string
}

const CHUNK_INTERVAL_MS = 30_000 // 30 seconds
const MAX_RETRIES = 3
const BASE_RETRY_DELAY_MS = 1000

export class RecordingManager {
  private config: RecordingConfig
  private recorder: MediaRecorder | null = null
  private r2Key = ''
  private uploadId = ''
  private parts: UploadPart[] = []
  private partNumber = 0
  private recording = false
  private totalBytes = 0
  private startTime = 0

  constructor(config: RecordingConfig) {
    this.config = config
  }

  async start(): Promise<void> {
    // Get presigned upload
    const res = await fetch('/api/portal/recording/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: this.config.token,
        sessionId: this.config.sessionId,
        type: this.config.type,
      }),
    })

    if (!res.ok) {
      console.error('[RecordingManager] Failed to get presign:', res.status)
      return
    }

    const data = await res.json()
    this.r2Key = data.r2Key
    this.uploadId = data.uploadId
    this.startTime = Date.now()

    // Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4'

    this.recorder = new MediaRecorder(this.config.stream, {
      mimeType,
      videoBitsPerSecond: 500_000, // 500kbps
    })

    this.recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.uploadChunk(event.data)
      }
    }

    this.recorder.onerror = (event) => {
      console.error('[RecordingManager] Recorder error:', event)
    }

    this.recorder.start(CHUNK_INTERVAL_MS)
    this.recording = true
  }

  async stop(): Promise<void> {
    if (!this.recording || !this.recorder) return
    this.recording = false

    return new Promise<void>((resolve) => {
      if (!this.recorder) {
        resolve()
        return
      }

      this.recorder.onstop = async () => {
        await this.finalize()
        resolve()
      }

      this.recorder.stop()
    })
  }

  isRecording(): boolean {
    return this.recording
  }

  // ─── Upload Logic ─────────────────────────────────────────

  private async uploadChunk(blob: Blob): Promise<void> {
    this.partNumber++
    const partNum = this.partNumber
    this.totalBytes += blob.size

    // Upload with retry
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // Use the Cloudflare Worker R2 endpoint to upload the part
        const cfWorkersUrl = process.env.NEXT_PUBLIC_CLOUDFLARE_WORKERS_URL || ''
        const formData = new FormData()
        formData.append('file', blob)

        const res = await fetch(
          `${cfWorkersUrl}/r2/upload-part?key=${encodeURIComponent(this.r2Key)}&uploadId=${encodeURIComponent(this.uploadId)}&partNumber=${partNum}`,
          {
            method: 'PUT',
            body: blob,
          },
        )

        if (res.ok) {
          const etag = res.headers.get('etag') || `"part-${partNum}"`
          this.parts.push({ partNumber: partNum, etag })
          return
        }

        throw new Error(`Upload returned ${res.status}`)
      } catch (err) {
        console.warn(
          `[RecordingManager] Part ${partNum} upload attempt ${attempt + 1} failed:`,
          (err as Error).message,
        )

        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt)
          await new Promise((r) => setTimeout(r, delay))
        }
      }
    }

    console.error(`[RecordingManager] Failed to upload part ${partNum} after ${MAX_RETRIES} attempts`)
  }

  private async finalize(): Promise<void> {
    if (this.parts.length === 0) return

    const durationSeconds = Math.floor((Date.now() - this.startTime) / 1000)

    try {
      await fetch('/api/portal/recording/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.config.token,
          r2Key: this.r2Key,
          uploadId: this.uploadId,
          parts: this.parts.sort((a, b) => a.partNumber - b.partNumber),
          sessionId: this.config.sessionId,
          candidateId: this.config.candidateId,
          jobId: this.config.jobId,
          type: this.config.type,
          sizeBytes: this.totalBytes,
          durationSeconds,
        }),
      })
    } catch (err) {
      console.error('[RecordingManager] Finalization failed:', (err as Error).message)
    }
  }
}
