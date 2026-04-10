// ============================================================
// HireOS — Cloudflare Worker Entry
// Routes WebSocket connections to Durable Objects,
// handles AI proxy, R2 presigned uploads, and CORS.
// ============================================================

import { InterviewSessionDO } from './InterviewSessionDO'

export { InterviewSessionDO }

export interface Env {
  INTERVIEW_SESSION: DurableObjectNamespace
  AI: Ai
  R2: R2Bucket
  ALLOWED_ORIGIN: string
}

// ─── CORS Helpers ───────────────────────────────────────────

function corsHeaders(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

function handleCORS(env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(env) })
}

// ─── Main Worker ────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCORS(env)
    }

    // ─── WebSocket: Interview Session ───────────────────────
    const wsMatch = url.pathname.match(/^\/ws\/interview\/([a-zA-Z0-9_-]+)/)
    if (wsMatch) {
      const sessionId = wsMatch[1]
      const doId = env.INTERVIEW_SESSION.idFromName(sessionId)
      const stub = env.INTERVIEW_SESSION.get(doId)
      return stub.fetch(new Request(`${url.origin}/connect`, request))
    }

    // ─── Session Init ───────────────────────────────────────
    const initMatch = url.pathname.match(/^\/session\/([a-zA-Z0-9_-]+)\/init/)
    if (initMatch && request.method === 'POST') {
      const sessionId = initMatch[1]
      const doId = env.INTERVIEW_SESSION.idFromName(sessionId)
      const stub = env.INTERVIEW_SESSION.get(doId)
      const res = await stub.fetch(new Request(`${url.origin}/init`, {
        method: 'POST',
        headers: request.headers,
        body: request.body,
      }))
      return addCORS(res, env)
    }

    // ─── Session Restore ────────────────────────────────────
    const restoreMatch = url.pathname.match(/^\/session\/([a-zA-Z0-9_-]+)\/restore/)
    if (restoreMatch && request.method === 'GET') {
      const sessionId = restoreMatch[1]
      const doId = env.INTERVIEW_SESSION.idFromName(sessionId)
      const stub = env.INTERVIEW_SESSION.get(doId)
      const res = await stub.fetch(new Request(`${url.origin}/restore`))
      return addCORS(res, env)
    }

    // ─── R2 Presigned Upload ────────────────────────────────
    if (url.pathname === '/r2/presign' && request.method === 'POST') {
      return handleR2Presign(request, env)
    }

    // ─── R2 Complete Multipart ──────────────────────────────
    if (url.pathname === '/r2/complete' && request.method === 'POST') {
      return handleR2Complete(request, env)
    }

    // ─── Health ─────────────────────────────────────────────
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok' }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
      })
    }

    return new Response('Not found', { status: 404, headers: corsHeaders(env) })
  },
}

// ─── R2 Handlers ────────────────────────────────────────────

async function handleR2Presign(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { r2Key: string; partNumber?: number }
  const { r2Key } = body

  if (!r2Key || typeof r2Key !== 'string') {
    return new Response(JSON.stringify({ error: 'Missing r2Key' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    })
  }

  try {
    const multipartUpload = await env.R2.createMultipartUpload(r2Key)

    return new Response(
      JSON.stringify({
        uploadId: multipartUpload.uploadId,
        key: multipartUpload.key,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
      },
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to create multipart upload', detail: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
      },
    )
  }
}

async function handleR2Complete(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as {
    key: string
    uploadId: string
    parts: { partNumber: number; etag: string }[]
  }

  if (!body.key || !body.uploadId || !Array.isArray(body.parts)) {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    })
  }

  try {
    const upload = env.R2.resumeMultipartUpload(body.key, body.uploadId)
    await upload.complete(
      body.parts.map((p) => ({
        partNumber: p.partNumber,
        etag: p.etag,
      })),
    )

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Failed to complete upload', detail: String(err) }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
      },
    )
  }
}

function addCORS(response: Response, env: Env): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(corsHeaders(env))) {
    headers.set(key, value)
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
