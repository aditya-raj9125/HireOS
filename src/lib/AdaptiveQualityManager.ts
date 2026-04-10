/**
 * AdaptiveQualityManager — Monitors connection quality and adjusts
 * video stream parameters. Downgrades to audio-only on poor connections.
 */

export type ConnectionQuality = 'good' | 'degraded' | 'poor'

interface QualityChangeEvent {
  from: ConnectionQuality
  to: ConnectionQuality
  timestamp: number
}

export class AdaptiveQualityManager {
  private currentQuality: ConnectionQuality = 'good'
  private mediaRecorder: MediaRecorder | null = null
  private videoTrack: MediaStreamTrack | null = null
  private onBanner: ((message: string | null) => void) | null = null
  private onProctorEvent: ((event: { type: string; detail: string }) => void) | null = null
  private history: QualityChangeEvent[] = []

  constructor(options: {
    mediaRecorder?: MediaRecorder
    videoTrack?: MediaStreamTrack
    onBanner?: (message: string | null) => void
    onProctorEvent?: (event: { type: string; detail: string }) => void
  }) {
    this.mediaRecorder = options.mediaRecorder ?? null
    this.videoTrack = options.videoTrack ?? null
    this.onBanner = options.onBanner ?? null
    this.onProctorEvent = options.onProctorEvent ?? null
  }

  /**
   * Called when a `connection:quality` WebSocket message arrives.
   */
  onQualityChange(quality: ConnectionQuality): void {
    if (quality === this.currentQuality) return

    const previous = this.currentQuality
    this.currentQuality = quality

    this.history.push({
      from: previous,
      to: quality,
      timestamp: Date.now(),
    })

    // Log as proctor event
    this.onProctorEvent?.({
      type: 'connection_quality_change',
      detail: `Connection quality changed from ${previous} to ${quality}`,
    })

    switch (quality) {
      case 'degraded':
        this.handleDegraded()
        break
      case 'poor':
        this.handlePoor()
        break
      case 'good':
        this.handleRecovery()
        break
    }
  }

  /**
   * Degraded: reduce video bitrate + resolution.
   */
  private handleDegraded(): void {
    // Constrain video track to 640x480
    if (this.videoTrack && this.videoTrack.readyState === 'live') {
      this.videoTrack
        .applyConstraints({ width: 640, height: 480 })
        .catch(() => {})
    }

    // Note: MediaRecorder videoBitsPerSecond can only be set at construction.
    // For degraded mode, the reduced resolution helps significantly.

    this.onBanner?.('Connection quality reduced. Video quality has been lowered to maintain stability.')
  }

  /**
   * Poor: stop video entirely, audio-only mode.
   */
  private handlePoor(): void {
    // Disable video track
    if (this.videoTrack && this.videoTrack.readyState === 'live') {
      this.videoTrack.enabled = false
    }

    this.onBanner?.(
      'Switched to audio-only mode due to connection quality. Your interview will continue normally.',
    )
  }

  /**
   * Quality recovered: restore video.
   */
  private handleRecovery(): void {
    if (this.videoTrack && this.videoTrack.readyState === 'live') {
      this.videoTrack.enabled = true
      // Restore original constraints
      this.videoTrack
        .applyConstraints({ width: 1280, height: 720 })
        .catch(() => {})
    }

    this.onBanner?.(null) // dismiss banner
  }

  getCurrentQuality(): ConnectionQuality {
    return this.currentQuality
  }

  getHistory(): QualityChangeEvent[] {
    return [...this.history]
  }
}
