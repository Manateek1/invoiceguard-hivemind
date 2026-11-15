import type { IncomingMessage, ServerResponse } from 'node:http'
export async function handleAgents(request: IncomingMessage & { body?: unknown }, response: ServerResponse, env: NodeJS.ProcessEnv = process.env) {
  response.setHeader('content-type', 'application/json')
  response.setHeader('cache-control', 'no-store')
  if (!env.BAND_RUNTIME_URL || !env.BAND_BRIDGE_TOKEN) {
    response.statusCode = 503
    response.end(JSON.stringify({ connected: false, error: 'Band runtime bridge is not configured for this deployment.' }))
    return
  }
  if (!['GET', 'POST'].includes(request.method || '')) { response.statusCode = 405; response.end('{}'); return }
  try {
    let body = ''
    if (request.method === 'POST') {
      if (request.body !== undefined) body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body)
      else for await (const chunk of request) { body += chunk; if (body.length > 24000) throw new Error('Too large') }
      if (body.length > 24000) throw new Error('Too large')
      JSON.parse(body)
    }
    const upstream = await fetch(env.BAND_RUNTIME_URL, { method: request.method, headers: { authorization: `Bearer ${env.BAND_BRIDGE_TOKEN}`, 'content-type': 'application/json' }, body: body || undefined, signal: AbortSignal.timeout(15000) })
    response.statusCode = upstream.status
    response.end(await upstream.text())
  } catch { response.statusCode = 502; response.end(JSON.stringify({ connected: false, error: 'Band runtime is unavailable.' })) }
}
export default handleAgents
