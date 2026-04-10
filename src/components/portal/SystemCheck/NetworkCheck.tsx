'use client'

import { useEffect, useState, useCallback } from 'react'
import { Wifi, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react'
import type { CheckResult, CheckStatus } from './index'

interface NetworkCheckProps {
  onCheckComplete: (result: CheckResult) => void
  onNext: () => void
}

export default function NetworkCheck({ onCheckComplete, onNext }: NetworkCheckProps) {
  const [downloadStatus, setDownloadStatus] = useState<CheckStatus>('checking')
  const [downloadSpeed, setDownloadSpeed] = useState<string>('')
  const [latencyStatus, setLatencyStatus] = useState<CheckStatus>('checking')
  const [latencyMs, setLatencyMs] = useState<string>('')
  const [webrtcStatus, setWebrtcStatus] = useState<CheckStatus>('checking')

  const measureDownload = useCallback(async (): Promise<CheckStatus> => {
    try {
      // Fetch a known resource to measure speed (~1MB)
      const url = `https://speed.cloudflare.com/__down?bytes=1000000&cachebust=${Date.now()}`
      const start = performance.now()
      const res = await fetch(url, { cache: 'no-store' })
      await res.arrayBuffer()
      const elapsed = (performance.now() - start) / 1000 // seconds
      const mbps = (1 * 8) / elapsed // ~1MB = 8Mb
      setDownloadSpeed(`${mbps.toFixed(1)} Mbps`)

      if (mbps < 0.8) {
        setDownloadStatus('fail')
        return 'fail'
      }
      if (mbps < 2) {
        setDownloadStatus('warn')
        return 'warn'
      }
      setDownloadStatus('pass')
      return 'pass'
    } catch {
      setDownloadStatus('fail')
      setDownloadSpeed('Failed')
      return 'fail'
    }
  }, [])

  const measureLatency = useCallback(async (): Promise<CheckStatus> => {
    try {
      const times: number[] = []
      for (let i = 0; i < 5; i++) {
        const start = performance.now()
        await fetch(`/api/health?t=${Date.now()}`, {
          method: 'HEAD',
          cache: 'no-store',
        }).catch(() => {
          // fallback: ping a common endpoint
          return fetch(`https://1.1.1.1/cdn-cgi/trace?t=${Date.now()}`, {
            method: 'HEAD',
            cache: 'no-store',
          })
        })
        times.push(performance.now() - start)
      }
      times.sort((a, b) => a - b)
      const median = times[Math.floor(times.length / 2)]
      setLatencyMs(`${Math.round(median)} ms`)

      if (median > 500) {
        setLatencyStatus('fail')
        return 'fail'
      }
      if (median > 200) {
        setLatencyStatus('warn')
        return 'warn'
      }
      setLatencyStatus('pass')
      return 'pass'
    } catch {
      setLatencyStatus('fail')
      setLatencyMs('Failed')
      return 'fail'
    }
  }, [])

  const checkWebRTC = useCallback(async (): Promise<CheckStatus> => {
    try {
      if (!window.RTCPeerConnection) {
        setWebrtcStatus('fail')
        return 'fail'
      }
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      })

      const result = await new Promise<CheckStatus>((resolve) => {
        const timeout = setTimeout(() => {
          pc.close()
          resolve('warn')
        }, 5000)

        pc.onicecandidate = (e) => {
          if (e.candidate) {
            clearTimeout(timeout)
            pc.close()
            resolve('pass')
          }
        }

        pc.createDataChannel('test')
        pc.createOffer().then((offer) => pc.setLocalDescription(offer))
      })

      setWebrtcStatus(result)
      return result
    } catch {
      setWebrtcStatus('fail')
      return 'fail'
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function runChecks() {
      const [dl, lat, rtc] = await Promise.all([
        measureDownload(),
        measureLatency(),
        checkWebRTC(),
      ])

      if (cancelled) return

      const statuses = [dl, lat, rtc]
      const hasFail = statuses.includes('fail')
      const hasWarn = statuses.includes('warn')
      onCheckComplete({
        status: hasFail ? 'fail' : hasWarn ? 'warn' : 'pass',
        detail: hasFail
          ? 'Network check failed'
          : hasWarn
            ? 'Network check passed with warnings'
            : 'Network check passed',
      })
    }

    runChecks()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
        {/* Download Speed */}
        <div className="flex items-center gap-3 text-sm">
          <StatusIcon status={downloadStatus} />
          <span className="text-neutral-700 font-medium">Download Speed</span>
          <span className="ml-auto text-neutral-500">
            {downloadStatus === 'checking' ? 'Measuring...' : downloadSpeed}
          </span>
        </div>

        {/* Latency */}
        <div className="flex items-center gap-3 text-sm">
          <StatusIcon status={latencyStatus} />
          <span className="text-neutral-700 font-medium">Latency</span>
          <span className="ml-auto text-neutral-500">
            {latencyStatus === 'checking' ? 'Measuring...' : latencyMs}
          </span>
        </div>

        {/* WebRTC */}
        <div className="flex items-center gap-3 text-sm">
          <StatusIcon status={webrtcStatus} />
          <span className="text-neutral-700 font-medium">WebRTC</span>
          <span className="ml-auto text-neutral-500">
            {webrtcStatus === 'checking'
              ? 'Checking...'
              : webrtcStatus === 'pass'
                ? 'Available'
                : webrtcStatus === 'warn'
                  ? 'Partially available'
                  : 'Not available'}
          </span>
        </div>
      </div>

      {/* Network tips for failures */}
      {(downloadStatus === 'fail' || latencyStatus === 'fail') && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3">
          <p className="text-sm font-medium text-red-800 mb-1">Network Issues Detected</p>
          <ul className="text-xs text-red-700 list-disc ml-4 space-y-1">
            <li>Use a wired ethernet connection if possible</li>
            <li>Close bandwidth-heavy apps (streaming, downloads)</li>
            <li>Move closer to your Wi-Fi router</li>
            <li>Ask others on the network to reduce usage</li>
          </ul>
        </div>
      )}

      <button
        onClick={onNext}
        className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:bg-neutral-300"
      >
        Continue
      </button>
    </div>
  )
}

function StatusIcon({ status }: { status: CheckStatus }) {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-green-500" />
  if (status === 'warn') return <AlertTriangle className="h-5 w-5 text-amber-500" />
  if (status === 'fail') return <XCircle className="h-5 w-5 text-red-500" />
  return <div className="h-5 w-5 animate-spin rounded-full border-2 border-neutral-300 border-t-brand-500" />
}
