import type { IncomingMessage, ServerResponse } from 'node:http'
import { budgets, purchaseOrders, vendorHistory } from '../src/data/demo-invoices.js'

type CogneeRequest = IncomingMessage & { body?: unknown }
type CogneeConfig = { baseUrl: string; dataset: string; apiKey: string; loopback: boolean; configured: boolean; allowed: boolean; missing: string[] }

function isLoopback(url: string) {
  try {
    return ['localhost', '127.0.0.1', '::1'].includes(new URL(url).hostname)
  } catch {
    return false
  }
}

function config(environment: NodeJS.ProcessEnv = process.env): CogneeConfig {
  const baseUrl = (environment.COGNEE_BASE_URL?.trim() || 'https://api.cognee.ai').replace(/\/+$/, '')
  const dataset = environment.COGNEE_DATASET_NAME?.trim() || ''
  const apiKey = environment.COGNEE_API_KEY?.trim() || ''
  const loopback = isLoopback(baseUrl)
  const allowed = environment.ALLOW_EXTERNAL_FINANCE_DATA === 'true' || loopback
  const missing: string[] = []
  if (!dataset) missing.push('COGNEE_DATASET_NAME')
  if (!apiKey && !loopback) missing.push('COGNEE_API_KEY')
  const configured = missing.length === 0
  if (configured && !allowed) missing.push('ALLOW_EXTERNAL_FINANCE_DATA=true')
  return { baseUrl, dataset, apiKey, loopback, configured, allowed, missing }
}

function sendJson(response: ServerResponse, status: number, value: unknown) {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.setHeader('cache-control', 'no-store')
  response.end(JSON.stringify(value))
}

async function requestBody(request: CogneeRequest) {
  if (request.body !== undefined) {
    if (typeof request.body === 'string') return JSON.parse(request.body)
    return request.body
  }
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > 24_000) throw new Error('Request body is too large.')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

function datasetList(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    for (const key of ['datasets', 'items', 'data']) {
      if (Array.isArray(record[key])) return (record[key] as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    }
  }
  return []
}

function field(record: Record<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = record[name]
    if (typeof value === 'string' && value) return value
    if (typeof value === 'number') return String(value)
  }
  return ''
}

async function cogneeFetch(settings: CogneeConfig, path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  if (settings.apiKey) headers.set('X-Api-Key', settings.apiKey)
  if (options.body && !(options.body instanceof FormData)) headers.set('content-type', 'application/json')
  return fetch(settings.baseUrl + path, {
    ...options,
    headers,
    signal: options.signal ?? AbortSignal.timeout(25_000),
  })
}

async function readResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text.slice(0, 1500)
  }
}

async function findConfiguredDataset(settings: CogneeConfig) {
  const response = await cogneeFetch(settings, '/api/v1/datasets/')
  if (!response.ok) throw new Error('Could not list the Cognee Cloud datasets.')
  const data = await readResponse(response)
  const match = datasetList(data).find((item) => field(item, ['name', 'dataset_name', 'datasetName']) === settings.dataset)
  return match
}

function sampleWorkspaceMemory() {
  return {
    workspace: 'InvoiceGuard demo',
    data_notice: 'All records below are synthetic sample data created for a product demo.',
    invoices: vendorHistory,
    vendor_history: vendorHistory,
    purchase_orders: purchaseOrders,
    budgets,
  }
}

function invoiceQuery(value: unknown) {
  if (!value || typeof value !== 'object') throw new Error('Invoice context is required.')
  const invoice = value as Record<string, unknown>
  const vendor = typeof invoice.vendor === 'string' ? invoice.vendor.trim().slice(0, 120) : ''
  if (!vendor) throw new Error('A vendor name is required for memory search.')
  const lineItems = Array.isArray(invoice.lineItems) ? invoice.lineItems.slice(0, 30) : []
  const itemTerms = lineItems.flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const item = value as Record<string, unknown>
    const description = typeof item.description === 'string' ? item.description.trim().slice(0, 100) : ''
    const unit = typeof item.unit === 'string' ? item.unit.trim().slice(0, 30) : ''
    return description ? [description + (unit ? ' (' + unit + ')' : '')] : []
  })
  const invoiceNumber = typeof invoice.invoiceNumber === 'string' ? invoice.invoiceNumber.trim().slice(0, 80) : ''
  return 'Prior vendor invoice records and historical unit prices for ' + vendor
    + (invoiceNumber ? ' related to invoice ' + invoiceNumber : '')
    + (itemTerms.length ? '. Comparable line items: ' + itemTerms.join(', ') : '.')
}

export async function handleCognee(request: CogneeRequest, response: ServerResponse, environment: NodeJS.ProcessEnv = process.env) {
  const settings = config(environment)
  const url = new URL(request.url || '/', 'http://localhost')
  const method = request.method || 'GET'

  if (method === 'GET' && url.searchParams.get('action') === 'status') {
    if (!settings.configured) {
      return sendJson(response, 200, {
        provider: 'Cognee Cloud',
        configured: false,
        allowed: settings.allowed,
        reachable: false,
        missing: settings.missing,
        datasetName: settings.dataset || undefined,
      })
    }
    if (!settings.allowed) {
      return sendJson(response, 200, { provider: 'Cognee Cloud', configured: true, allowed: false, reachable: false, missing: settings.missing, datasetName: settings.dataset, message: 'External data access is off for this workspace.' })
    }
    try {
      const health = await cogneeFetch(settings, '/health', { signal: AbortSignal.timeout(7_000) })
      return sendJson(response, 200, {
        provider: 'Cognee Cloud',
        configured: true,
        allowed: true,
        reachable: health.ok,
        missing: [],
        datasetName: settings.dataset,
        message: health.ok ? 'Cognee Cloud API is reachable.' : 'Cognee Cloud did not accept the configured key or health request.',
      })
    } catch {
      return sendJson(response, 200, {
        provider: 'Cognee Cloud',
        configured: true,
        allowed: true,
        reachable: false,
        missing: [],
        datasetName: settings.dataset,
        message: 'Cognee Cloud could not be reached.',
      })
    }
  }

  if (!settings.configured || !settings.allowed) {
    return sendJson(response, 503, { error: 'Cognee Cloud is not enabled for this workspace.', missing: settings.missing })
  }

  if (method === 'GET' && url.searchParams.get('action') === 'graph') {
    try {
      const dataset = await findConfiguredDataset(settings)
      if (!dataset) {
        return sendJson(response, 200, {
          source: 'cognee-cloud',
          datasetName: settings.dataset,
          graph: { nodes: [], edges: [] },
          message: 'No dataset exists yet. Write the synthetic sample memory to create it.',
        })
      }
      const datasetId = field(dataset, ['id', 'dataset_id', 'datasetId'])
      if (!datasetId) throw new Error('Cognee Cloud did not return a dataset ID.')
      const graphResponse = await cogneeFetch(settings, '/api/v1/datasets/' + encodeURIComponent(datasetId) + '/graph')
      if (!graphResponse.ok) throw new Error('Cognee Cloud could not read the configured dataset graph.')
      return sendJson(response, 200, {
        source: 'cognee-cloud',
        datasetName: settings.dataset,
        graph: await readResponse(graphResponse),
      })
    } catch {
      return sendJson(response, 502, { error: 'Cognee Cloud graph could not be loaded. Check the dataset name and API permissions.' })
    }
  }

  if (method !== 'POST') return sendJson(response, 405, { error: 'Method not allowed.' })

  let body: Record<string, unknown>
  try {
    const parsed = await requestBody(request)
    if (!parsed || typeof parsed !== 'object') throw new Error('A JSON request body is required.')
    body = parsed as Record<string, unknown>
  } catch (error) {
    return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid request body.' })
  }

  if (body.action === 'seed-sample') {
    const form = new FormData()
    form.set('datasetName', settings.dataset)
    form.set('raw_data', JSON.stringify(sampleWorkspaceMemory()))
    form.set('self_improvement', 'false')
    try {
      const result = await cogneeFetch(settings, '/api/v1/remember', { method: 'POST', body: form, signal: AbortSignal.timeout(60_000) })
      if (!result.ok) throw new Error('Cognee Cloud rejected the synthetic sample records.')
      return sendJson(response, 200, { message: 'Synthetic invoice, vendor, purchase-order, and budget records were written to Cognee Cloud.' })
    } catch {
      return sendJson(response, 502, { error: 'Cognee Cloud could not store the synthetic sample records. Check the configured dataset and service status.' })
    }
  }

  if (body.action === 'search') {
    let query: string
    try {
      query = invoiceQuery(body.invoice)
    } catch (error) {
      return sendJson(response, 400, { error: error instanceof Error ? error.message : 'Invalid invoice context.' })
    }
    try {
      const result = await cogneeFetch(settings, '/api/v1/search', {
        method: 'POST',
        body: JSON.stringify({ query, search_type: 'CHUNKS', datasets: [settings.dataset], top_k: 5 }),
      })
      if (!result.ok) throw new Error('Cognee Cloud memory search failed.')
      return sendJson(response, 200, { results: await readResponse(result), datasetName: settings.dataset })
    } catch {
      return sendJson(response, 502, { error: 'Cognee Cloud memory search failed. Check the API key and dataset access.' })
    }
  }

  return sendJson(response, 400, { error: 'Unknown Cognee action.' })
}

export default handleCognee
