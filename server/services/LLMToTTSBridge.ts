// ============================================================
// HireOS — LLM-to-TTS Bridge
// Achieves sub-800ms perceived latency by starting TTS on the
// first complete sentence while the LLM is still generating.
// ============================================================

import type { TTSService, AudioChunk } from './TTSService'
import type { WebSocket } from 'ws'

// Sentence boundary detection pattern
// Triggers on: period + space, exclamation, question mark
// Minimum buffer length of 15 chars to avoid false triggers on abbreviations
const SENTENCE_END = /[.!?]\s$/

export class LLMToTTSBridge {
  private tts: TTSService
  private ws: WebSocket
  private sessionId: string
  private audioSeq = 0

  constructor(tts: TTSService, ws: WebSocket, sessionId: string) {
    this.tts = tts
    this.ws = ws
    this.sessionId = sessionId
  }

  /**
   * Process a streaming LLM response and stream TTS audio concurrently.
   * Returns the full accumulated text.
   */
  async processAndSpeak(llmStream: AsyncIterable<string>): Promise<string> {
    let sentenceBuffer = ''
    let fullText = ''
    const ttsPromises: Promise<void>[] = []

    for await (const token of llmStream) {
      sentenceBuffer += token
      fullText += token

      // Check if we have a complete sentence
      if (sentenceBuffer.length >= 15 && SENTENCE_END.test(sentenceBuffer)) {
        const sentence = sentenceBuffer.trim()
        sentenceBuffer = ''

        // Start TTS for this sentence concurrently
        const ttsPromise = this.streamSentence(sentence)
        ttsPromises.push(ttsPromise)
      }
    }

    // Handle remaining text (last partial sentence)
    if (sentenceBuffer.trim().length > 0) {
      const ttsPromise = this.streamSentence(sentenceBuffer.trim())
      ttsPromises.push(ttsPromise)
    }

    // Wait for all TTS to complete
    await Promise.all(ttsPromises)

    // Send final audio marker
    this.sendAudioMessage(Buffer.alloc(0), true)

    return fullText
  }

  private async streamSentence(text: string): Promise<void> {
    try {
      for await (const chunk of this.tts.streamSpeech(text)) {
        this.sendAudioMessage(chunk.data, false)
      }
    } catch (err) {
      console.error('[Bridge] TTS failed for sentence:', (err as Error).message)
      // Graceful degradation — text will still be sent via ai:text message
    }
  }

  private sendAudioMessage(data: Buffer, isLastChunk: boolean): void {
    if (this.ws.readyState !== 1) return

    const message = {
      type: 'ai:audio',
      payload: {
        data: data.toString('base64'),
        sampleRate: 24000,
        sequenceNumber: this.audioSeq++,
        isLastChunk,
      },
      timestamp: Date.now(),
      sessionId: this.sessionId,
    }

    this.ws.send(JSON.stringify(message))
  }
}
