import type { InvoiceLineItem, InvoiceRecord } from '../domain/types'

export interface ParsedInvoice {
  vendor: string
  invoiceNumber: string
  amount: number
  invoiceDate: string
  dueDate?: string
  purchaseOrder?: string
  lineItems: InvoiceLineItem[]
  text: string
  fileName: string
}

function parseMoney(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined
  if (typeof value !== 'string') return undefined
  const normalized = value.replace(/[$,\s]/g, '')
  const parsed = Number(normalized)
  return normalized && Number.isFinite(parsed) ? parsed : undefined
}

function parseQuantity(value: unknown): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replace(/[,\s]/g, ''))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
}

function formatDate(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month - 1, day))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return ''
  return year + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')
}

function normalizeDate(value: string | undefined): string {
  if (!value) return ''
  const trimmed = value.trim()
  const iso = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (iso) return formatDate(Number(iso[1]), Number(iso[2]), Number(iso[3]))
  const local = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/)
  if (local) {
    const year = Number(local[3].length === 2 ? (Number(local[3]) >= 70 ? '19' : '20') + local[3] : local[3])
    return formatDate(year, Number(local[1]), Number(local[2]))
  }
  const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
  const named = trimmed.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/i) ?? trimmed.match(/^(\d{1,2})\s+([a-z]+),?\s+(\d{4})$/i)
  if (!named) return ''
  const monthName = (named[1].length > 2 ? named[1] : named[2]).slice(0, 3).toLowerCase()
  const month = months.indexOf(monthName) + 1
  const day = Number(named[1].length > 2 ? named[2] : named[1])
  const year = Number(named[3])
  return month > 0 ? formatDate(year, month, day) : ''
}

function makeLineItem(description: string, quantity: number, unit: string, billedUnitPrice: number, id: string): InvoiceLineItem | undefined {
  const cleanDescription = description.replace(/^[-•*\s]+|[-•*\s]+$/g, '').replace(/\s{2,}/g, ' ').trim()
  if (!cleanDescription || /^(?:item|description|subtotal|tax|shipping|discount|total|balance|amount due)$/i.test(cleanDescription)) return undefined
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(billedUnitPrice) || billedUnitPrice < 0) return undefined
  return { id, description: cleanDescription, quantity, unit: unit || 'each', billedUnitPrice }
}

function parseLineItemLine(line: string, index: number): InvoiceLineItem | undefined {
  if (/\b(?:sub)?total\b|\b(?:tax|shipping|discount|amount due|balance due)\b/i.test(line)) return undefined

  const columns = line.split(/\s*\|\s*|\t+|\s{2,}/).map((cell) => cell.trim()).filter(Boolean)
  if (columns.length >= 3) {
    const quantityIndex = columns.findIndex((cell, cellIndex) => cellIndex > 0 && /^\d+(?:\.\d+)?$/.test(cell))
    if (quantityIndex > 0) {
      const quantity = parseQuantity(columns[quantityIndex]) ?? 1
      const priceCells = columns.slice(quantityIndex + 1).map(parseMoney).filter((price): price is number => price !== undefined)
      if (priceCells.length) {
        const unitCell = columns.slice(quantityIndex + 1).find((cell) => parseMoney(cell) === undefined)
        const price = priceCells.length > 1 ? priceCells[0] : priceCells[0] / quantity
        return makeLineItem(columns.slice(0, quantityIndex).join(' '), quantity, unitCell ?? 'each', price, 'text-item-' + index)
      }
    }
  }

  const quantityAndPrice = line.match(/^(.+?)\s+(?:x\s*)?(\d+(?:\.\d+)?)\s*(?:([a-z][a-z0-9/-]*))?\s*(?:@|at)?\s*\$?([\d,]+(?:\.\d{1,2})?)(?:\s*(?:=|total)?\s*\$?([\d,]+(?:\.\d{1,2})?))?$/i)
  if (quantityAndPrice) {
    const quantity = parseQuantity(quantityAndPrice[2]) ?? 1
    const unitPrice = parseMoney(quantityAndPrice[4])
    if (unitPrice !== undefined) {
      return makeLineItem(quantityAndPrice[1], quantity, quantityAndPrice[3] ?? 'each', unitPrice, 'text-item-' + index)
    }
  }

  const quantityTimesDescription = line.match(/^(\d+(?:\.\d+)?)\s*x\s+(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)$/i)
  if (quantityTimesDescription) {
    const quantity = parseQuantity(quantityTimesDescription[1]) ?? 1
    const total = parseMoney(quantityTimesDescription[3])
    if (total !== undefined) return makeLineItem(quantityTimesDescription[2], quantity, 'each', total / quantity, 'text-item-' + index)
  }

  const descriptionAndPrice = line.match(/^(.+?)\s+\$?([\d,]+\.\d{2})$/)
  if (descriptionAndPrice) {
    const price = parseMoney(descriptionAndPrice[2])
    if (price !== undefined) return makeLineItem(descriptionAndPrice[1], 1, 'each', price, 'text-item-' + index)
  }
  return undefined
}

function parseTextLineItems(lines: string[]): InvoiceLineItem[] {
  const items: InvoiceLineItem[] = []
  for (const [index, line] of lines.entries()) {
    const item = parseLineItemLine(line.trim(), index + 1)
    if (item) items.push(item)
  }
  return items
}

function parseText(text: string, fileName: string): ParsedInvoice {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const vendorLabel = text.match(/(?:vendor|supplier)\s*[:#]\s*([^\r\n]+)/i)?.[1]?.trim()
  const vendor = vendorLabel ?? lines.find((line) => line.length > 2 && line.length < 90 && !/invoice|bill to|ship to|statement|date:|number:|total|amount due|purchase order|\bPO[- #]/i.test(line)) ?? ''
  const invoiceNumberMatch = text.match(/(?:invoice|inv\.?)\s*(?:number|no\.?|#)\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})|invoice\s*[:#]\s*([a-z0-9][a-z0-9-]{2,})/i)
  const invoiceNumber = invoiceNumberMatch?.[1] ?? invoiceNumberMatch?.[2] ?? ''
  const totalMatches = [...text.matchAll(/\b(?:amount\s*due|invoice\s*total|grand\s*total|total\s*due|total)\b\s*[:\s]*\$?\s*([\d,]+(?:\.\d{1,2})?)/gi)]
  const amount = totalMatches.length ? parseMoney(totalMatches[totalMatches.length - 1][1]) : undefined
  const datePattern = '(\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|[a-z]+\\s+\\d{1,2},?\\s+\\d{4}|\\d{1,2}\\s+[a-z]+,?\\s+\\d{4})'
  const dateMatch = text.match(new RegExp('(?:invoice\\s*date|date)\\s*[:#]?\\s*' + datePattern, 'i'))
  const dueDateMatch = text.match(new RegExp('(?:due\\s*date|payment\\s*due)\\s*[:#]?\\s*' + datePattern, 'i'))
  const purchaseOrder = text.match(/(?:purchase\s*order|P\.?\s*O\.?)\s*(?:number|no\.?|#)?\s*[:#-]?\s*([a-z0-9-]{3,})/i)?.[1]

  return {
    vendor: vendor.replace(/\s{2,}/g, ' ').slice(0, 90),
    invoiceNumber,
    amount: amount ?? 0,
    invoiceDate: normalizeDate(dateMatch?.[1]),
    dueDate: normalizeDate(dueDateMatch?.[1]) || undefined,
    purchaseOrder,
    lineItems: parseTextLineItems(lines),
    text,
    fileName,
  }
}

async function readPdf(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, workerUrl] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ])
  GlobalWorkerOptions.workerSrc = workerUrl.default
  const pdfDocument = await getDocument({ data: await file.arrayBuffer() }).promise
  const pageText: string[] = []

  for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
    const page = await pdfDocument.getPage(pageNumber)
    const content = await page.getTextContent()
    const items = content.items.flatMap((item) => {
      if (!('str' in item) || !('transform' in item)) return []
      return [{ x: item.transform[4], y: item.transform[5], text: item.str }]
    })
    const grouped = new Map<number, Array<{ x: number; text: string }>>()
    for (const item of items) {
      const y = Math.round(item.y / 3) * 3
      const row = grouped.get(y) ?? []
      row.push({ x: item.x, text: item.text })
      grouped.set(y, row)
    }
    const rows = [...grouped.entries()].sort(([left], [right]) => right - left).map(([, row]) => row.sort((left, right) => left.x - right.x).map((item) => item.text).join(' ').trim()).filter(Boolean)
    pageText.push(rows.join('\n'))
  }

  let text = pageText.join('\n')
  if (text.replace(/\s/g, '').length < 18) {
    const page = await pdfDocument.getPage(1)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = window.document.createElement('canvas')
    const context = canvas.getContext('2d')
    if (!context) throw new Error('This browser could not prepare the PDF for local OCR.')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const { data } = await import('tesseract.js').then(({ recognize }) => recognize(canvas, 'eng'))
    text = data.text
  }
  return text
}

async function readImage(file: File) {
  const { recognize } = await import('tesseract.js')
  const { data } = await recognize(file, 'eng')
  return data.text
}

function parseJsonLineItems(value: unknown): InvoiceLineItem[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry, index) => {
    if (!entry || typeof entry !== 'object') return []
    const raw = entry as Record<string, unknown>
    const description = String(raw.description ?? raw.name ?? raw.item ?? '').trim()
    const quantity = parseQuantity(raw.quantity) ?? 1
    const unit = String(raw.unit ?? 'each')
    const unitPrice = parseMoney(raw.billedUnitPrice ?? raw.unitPrice ?? raw.unit_price ?? raw.price)
    const lineTotal = parseMoney(raw.lineTotal ?? raw.line_total ?? raw.amount ?? raw.total)
    const billedUnitPrice = unitPrice ?? (lineTotal !== undefined ? lineTotal / quantity : undefined)
    if (billedUnitPrice === undefined) return []
    const item = makeLineItem(description, quantity, unit, billedUnitPrice, 'json-item-' + index)
    return item ? [item] : []
  })
}

function parseCsvRows(text: string, fileName: string): ParsedInvoice[] {
  const rows = text.split(/\r?\n/).filter((row) => row.trim())
  if (rows.length < 2) throw new Error('CSV needs a header row and at least one invoice row.')
  const splitRow = (row: string) => {
    const values: string[] = []
    let value = ''
    let quoted = false
    for (let i = 0; i < row.length; i += 1) {
      const char = row[i]
      if (char === '"' && row[i + 1] === '"' && quoted) { value += '"'; i += 1 }
      else if (char === '"') quoted = !quoted
      else if (char === ',' && !quoted) { values.push(value.trim()); value = '' }
      else value += char
    }
    values.push(value.trim())
    return values
  }
  const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const headers = splitRow(rows[0]).map(normalizeHeader)
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header))
  const vendorCol = column('vendor', 'vendorname', 'supplier', 'suppliername')
  const numberCol = column('invoicenumber', 'invoiceno', 'invoice', 'number')
  const amountCol = column('amount', 'total', 'totalamount', 'invoicetotal')
  const dateCol = column('invoicedate', 'date')
  const dueCol = column('duedate', 'paymentdue')
  const poCol = column('purchaseorder', 'purchaseordernumber', 'ponumber', 'po')
  const descriptionCol = column('itemdescription', 'linedescription', 'description', 'lineitem', 'product')
  const quantityCol = column('quantity', 'qty')
  const unitCol = column('unit', 'uom')
  const unitPriceCol = column('unitprice', 'priceperunit', 'rate')
  const lineTotalCol = column('linetotal', 'lineamount', 'itemtotal')
  if (vendorCol < 0 || numberCol < 0 || amountCol < 0) {
    throw new Error('CSV headers must include vendor, invoice_number, and amount. Optional: invoice_date, due_date, po_number, item_description, quantity, unit, unit_price, line_total.')
  }
  return rows.slice(1).map((row, index) => {
    const cells = splitRow(row)
    const vendor = cells[vendorCol] ?? ''
    const invoiceNumber = cells[numberCol] ?? ''
    const amount = parseMoney(cells[amountCol] ?? '')
    if (!vendor || !invoiceNumber || amount === undefined || amount <= 0) {
      throw new Error('CSV row ' + (index + 2) + ' is missing a vendor, invoice number, or positive amount.')
    }
    const quantity = parseQuantity(cells[quantityCol] ?? '') ?? 1
    const itemPrice = parseMoney(cells[unitPriceCol] ?? '')
    const lineTotal = parseMoney(cells[lineTotalCol] ?? '')
    const description = cells[descriptionCol] ?? ''
    const lineItemPrice = itemPrice ?? (lineTotal !== undefined ? lineTotal / quantity : undefined)
    const lineItem = description && lineItemPrice !== undefined
      ? makeLineItem(description, quantity, cells[unitCol] || 'each', lineItemPrice, 'csv-item-' + (index + 1))
      : undefined
    return {
      vendor, invoiceNumber, amount,
      invoiceDate: normalizeDate(cells[dateCol]),
      dueDate: normalizeDate(cells[dueCol]) || undefined,
      purchaseOrder: cells[poCol] || undefined,
      lineItems: lineItem ? [lineItem] : [],
      text: row,
      fileName,
    }
  })
}

function parseJsonInvoice(value: unknown, fileName: string, text: string): ParsedInvoice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each JSON invoice must be an object.')
  const raw = value as Record<string, unknown>
  const vendor = String(raw.vendor ?? raw.vendorName ?? raw.supplier ?? '').trim()
  const invoiceNumber = String(raw.invoiceNumber ?? raw.invoice_number ?? raw.number ?? '').trim()
  const amount = parseMoney(raw.amount ?? raw.total ?? raw.totalAmount ?? raw.invoiceTotal)
  if (!vendor || !invoiceNumber || amount === undefined || amount <= 0) {
    throw new Error('JSON invoices need vendor, invoiceNumber, and a positive amount.')
  }
  const lineItems = parseJsonLineItems(raw.lineItems ?? raw.line_items ?? raw.items)
  return {
    vendor,
    invoiceNumber,
    amount,
    invoiceDate: normalizeDate(raw.invoiceDate === undefined ? String(raw.invoice_date ?? '') : String(raw.invoiceDate)),
    dueDate: normalizeDate(raw.dueDate === undefined ? String(raw.due_date ?? '') : String(raw.dueDate)) || undefined,
    purchaseOrder: String(raw.purchaseOrder ?? raw.purchase_order ?? raw.purchaseOrderNumber ?? raw.po_number ?? '').trim() || undefined,
    lineItems,
    text,
    fileName,
  }
}

export async function parseInvoiceFile(file: File): Promise<ParsedInvoice[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'json') {
    const text = await file.text()
    const raw = JSON.parse(text) as unknown
    const values = Array.isArray(raw) ? raw : [raw]
    return values.map((value) => parseJsonInvoice(value, file.name, text))
  }

  if (extension === 'csv') return parseCsvRows(await file.text(), file.name)

  let text: string
  if (extension === 'pdf') text = await readPdf(file)
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) text = await readImage(file)
  else if (extension === 'txt' || file.type.startsWith('text/')) text = await file.text()
  else throw new Error('Choose a PDF, image, text, or JSON invoice file.')

  const parsed = parseText(text, file.name)
  if (!parsed.vendor || parsed.amount <= 0) {
    throw new Error('I could not confidently read the vendor and total. Try a text-based PDF or JSON, or correct the values after uploading.')
  }
  return [parsed]
}

export function parsedToRecord(parsed: ParsedInvoice): InvoiceRecord {
  return {
    id: 'upload-' + crypto.randomUUID(),
    vendor: parsed.vendor,
    invoiceNumber: parsed.invoiceNumber || 'Needs review',
    amount: parsed.amount,
    currency: 'USD',
    invoiceDate: parsed.invoiceDate,
    dueDate: parsed.dueDate,
    purchaseOrder: parsed.purchaseOrder,
    lineItems: parsed.lineItems.map((item, index) => ({ ...item, id: 'upload-item-' + index + '-' + crypto.randomUUID() })),
    source: 'upload',
  }
}
