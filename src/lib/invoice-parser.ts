import type { InvoiceLineItem, InvoiceRecord } from '../domain/types'

export interface ParsedInvoice {
  vendor: string
  invoiceNumber: string
  amount: number
  invoiceDate: string
  dueDate?: string
  purchaseOrder?: string
  text: string
  fileName: string
}

function parseMoney(value: string) {
  const parsed = Number(value.replace(/[$,\s]/g, ''))
  return Number.isFinite(parsed) ? parsed : undefined
}

function parseText(text: string, fileName: string): ParsedInvoice {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const vendor = lines.find((line) => line.length > 2 && line.length < 90 && !/invoice|bill to|ship to|statement|date:|number:/i.test(line)) ?? ''
  const invoiceNumber = text.match(/(?:invoice\s*(?:number|no\.?|#)?|inv\.?\s*#?)\s*[:#-]?\s*([a-z0-9][a-z0-9-]{2,})/i)?.[1] ?? ''
  const totalMatch = text.match(/(?:amount\s*due|invoice\s*total|grand\s*total|total\s*due|total)\s*[:\s]*\$?\s*([\d,]+\.\d{2})/i)
  const amount = totalMatch ? parseMoney(totalMatch[1]) : undefined
  const dateMatch = text.match(/(?:invoice\s*date|date)\s*[:\s]*((?:\d{1,2}[/-]){2}\d{2,4}|\d{4}-\d{2}-\d{2})/i)
  const dueDateMatch = text.match(/(?:due\s*date|payment\s*due)\s*[:\s]*((?:\d{1,2}[/-]){2}\d{2,4}|\d{4}-\d{2}-\d{2})/i)
  const purchaseOrder = text.match(/(?:purchase\s*order|PO)\s*(?:number|no\.?|#)?\s*[:#-]?\s*([a-z0-9-]{3,})/i)?.[1]

  return {
    vendor: vendor.replace(/\s{2,}/g, ' ').slice(0, 90),
    invoiceNumber,
    amount: amount ?? 0,
    invoiceDate: dateMatch?.[1] ?? new Date().toISOString().slice(0, 10),
    dueDate: dueDateMatch?.[1],
    purchaseOrder,
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
    const lines = content.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean)
    pageText.push(lines.join(' '))
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
  if (vendorCol < 0 || numberCol < 0 || amountCol < 0) {
    throw new Error('CSV headers must include vendor, invoice_number, and amount. Optional: invoice_date, due_date, and po_number.')
  }
  return rows.slice(1).map((row, index) => {
    const cells = splitRow(row)
    const vendor = cells[vendorCol] ?? ''
    const invoiceNumber = cells[numberCol] ?? ''
    const amount = parseMoney(cells[amountCol] ?? '')
    if (!vendor || !invoiceNumber || amount === undefined || amount <= 0) {
      throw new Error(`CSV row ${index + 2} is missing a vendor, invoice number, or positive amount.`)
    }
    return {
      vendor, invoiceNumber, amount,
      invoiceDate: cells[dateCol] || new Date().toISOString().slice(0, 10),
      dueDate: cells[dueCol] || undefined,
      purchaseOrder: cells[poCol] || undefined,
      text: row,
      fileName,
    }
  })
}

export async function parseInvoiceFile(file: File): Promise<ParsedInvoice[]> {
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a file smaller than 10 MB.')
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'json') {
    const raw = JSON.parse(await file.text()) as Record<string, unknown>
    const vendor = String(raw.vendor ?? raw.vendorName ?? raw.supplier ?? '')
    const invoiceNumber = String(raw.invoiceNumber ?? raw.invoice_number ?? raw.number ?? '')
    const amount = Number(raw.amount ?? raw.total ?? raw.totalAmount ?? 0)
    if (!vendor || !invoiceNumber || !Number.isFinite(amount)) throw new Error('This JSON file needs vendor, invoiceNumber, and amount fields.')
    return [{
      vendor,
      invoiceNumber,
      amount,
      invoiceDate: String(raw.invoiceDate ?? raw.invoice_date ?? new Date().toISOString().slice(0, 10)),
      dueDate: raw.dueDate ? String(raw.dueDate) : undefined,
      purchaseOrder: raw.purchaseOrder ? String(raw.purchaseOrder) : undefined,
      text: await file.text(),
      fileName: file.name,
    }]
  }

  if (extension === 'csv') return parseCsvRows(await file.text(), file.name)

  let text: string
  if (extension === 'pdf') text = await readPdf(file)
  else if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) text = await readImage(file)
  else if (extension === 'txt' || file.type.startsWith('text/')) text = await file.text()
  else throw new Error('Choose a PDF, image, text, or JSON invoice file.')

  const parsed = parseText(text, file.name)
  if (!parsed.vendor || !parsed.amount) {
    throw new Error('I could not confidently read the vendor and total. Try a text-based PDF or JSON, or correct the values after uploading.')
  }
  return [parsed]
}

export function parsedToRecord(parsed: ParsedInvoice): InvoiceRecord {
  const lineItems: InvoiceLineItem[] = [{
    id: `uploaded-${crypto.randomUUID()}`,
    description: 'Invoice total (review line items)',
    quantity: 1,
    unit: 'invoice',
    billedUnitPrice: parsed.amount,
  }]
  return {
    id: `upload-${crypto.randomUUID()}`,
    vendor: parsed.vendor,
    invoiceNumber: parsed.invoiceNumber || 'Needs review',
    amount: parsed.amount,
    currency: 'USD',
    invoiceDate: parsed.invoiceDate,
    dueDate: parsed.dueDate,
    purchaseOrder: parsed.purchaseOrder,
    lineItems,
    source: 'upload',
  }
}
