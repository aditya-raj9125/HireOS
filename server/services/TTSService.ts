// ============================================================
// HireOS — TTS Service
// Primary: ElevenLabs streaming. Fallback: Azure TTS.
// ============================================================

export interface AudioChunk {
  data: Buffer
  sampleRate: number
}

export class TTSService {
  private elevenLabsKey: string
  private elevenLabsVoiceId: string
  private azureTtsKey?: string
  private azureTtsRegion?: string

  constructor(config: {
    elevenLabsApiKey: string
    elevenLabsVoiceId: string
    azureTtsKey?: string
    azureTtsRegion?: string
  }) {
    this.elevenLabsKey = config.elevenLabsApiKey
    this.elevenLabsVoiceId = config.elevenLabsVoiceId
    this.azureTtsKey = config.azureTtsKey
    this.azureTtsRegion = config.azureTtsRegion
  }

  /**
   * Stream speech synthesis. Primary: ElevenLabs, Fallback: Azure.
   */
  async *streamSpeech(text: string): AsyncIterable<AudioChunk> {
    try {
      yield* this.elevenLabsStream(text)
    } catch (err) {
      console.warn('[TTS] ElevenLabs failed, falling back to Azure:', (err as Error).message)
      if (this.azureTtsKey && this.azureTtsRegion) {
        yield* this.azureTtsStream(text)
      } else {
        throw new Error('TTS failed: ElevenLabs unavailable and no Azure fallback configured')
      }
    }
  }

  private async *elevenLabsStream(text: string): AsyncIterable<AudioChunk> {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}/stream`

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2000)

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'xi-api-key': this.elevenLabsKey,
        'Content-Type': 'application/json',
        Accept: 'audio/pcm',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_turbo_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        output_format: 'pcm_24000',
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!res.ok) {
      throw new Error(`ElevenLabs returned ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body from ElevenLabs')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        yield { data: Buffer.from(value), sampleRate: 24000 }
      }
    }
  }

  private async *azureTtsStream(text: string): AsyncIterable<AudioChunk> {
    const url = `https://${this.azureTtsRegion}.tts.speech.microsoft.com/cognitiveservices/v1`

    const ssml = `
      <speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
        <voice name='en-US-JennyNeural'>
          ${escapeXml(text)}
        </voice>
      </speak>
    `.trim()

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.azureTtsKey!,
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'raw-24khz-16bit-mono-pcm',
      },
      body: ssml,
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      throw new Error(`Azure TTS returned ${res.status}`)
    }

    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body from Azure TTS')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) {
        yield { data: Buffer.from(value), sampleRate: 24000 }
      }
    }
  }
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
