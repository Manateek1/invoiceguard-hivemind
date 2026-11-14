import { useEffect, useState, type DragEvent } from 'react'
import { FileUp, LockKeyhole, RefreshCw, UploadCloud, X } from 'lucide-react'
import type { ParsedInvoice } from '../lib/invoice-parser'
import { formatMoney } from '../lib/audit-engine'

interface Props {
  isParsing: boolean
  parsedInvoices: ParsedInvoice[] | null
  error: string
  onClose: () => void
  onChoose: () => void
  onConfirm: (invoices: ParsedInvoice[]) => void
  onDropFile?: (file: File) => void
}

export function UploadInvoiceModal({ isParsing, parsedInvoices, error, onClose, onChoose, onConfirm, onDropFile }: Props) {
  const [drafts, setDrafts] = useState<ParsedInvoice[]>(parsedInvoices ?? [])
  const [isDragging, setIsDragging] = useState(false)

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isParsing) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isParsing, onClose])

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    if (!isParsing) setIsDragging(true)
  }

  function handleDragLeave(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
  }

  function handleDrop(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    setIsDragging(false)
    if (isParsing) return
    const file = event.dataTransfer.files?.[0]
    if (!file) return
    if (onDropFile) {
      onDropFile(file)
      return
    }
    const input = document.querySelector<HTMLInputElement>('.hidden-file-input')
    if (input) {
      const transfer = new DataTransfer()
      transfer.items.add(file)
      input.files = transfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }

  function edit(index: number, key: 'vendor' | 'invoiceNumber' | 'amount' | 'invoiceDate' | 'purchaseOrder', value: string) {
    setDrafts((current) => current.map((invoice, currentIndex) => currentIndex !== index ? invoice : {
      ...invoice,
      [key]: key === 'amount' ? Number(value) : value,
    }))
  }

  const ready = drafts.length > 0 && drafts.every((invoice) => invoice.vendor.trim() && invoice.invoiceNumber.trim() && invoice.invoiceDate && Number.isFinite(invoice.amount) && invoice.amount > 0)

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isParsing) onClose() }}>
    <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title" style={{ maxHeight: 'calc(100vh - 40px)', overflowY: 'auto' }}>
      <button className="modal-close" onClick={onClose} aria-label="Close upload dialog" disabled={isParsing}><X size={18} /></button>
      <div className="upload-icon"><FileUp size={22} /></div>
      <h2 id="upload-title">{drafts.length ? 'Confirm extracted invoices' : 'Upload invoices'}</h2>
      {drafts.length ? <>
        <p className="upload-lede">Check the fields before they enter this business workspace. The original file stays in this browser.</p>
        {drafts.length === 1 ? <div className="review-fields">
          <label>Vendor<input value={drafts[0].vendor} onChange={(event) => edit(0, 'vendor', event.target.value)} required /></label>
          <label>Invoice number<input value={drafts[0].invoiceNumber} onChange={(event) => edit(0, 'invoiceNumber', event.target.value)} required /></label>
          <label>Invoice date<input type="date" value={drafts[0].invoiceDate} onChange={(event) => edit(0, 'invoiceDate', event.target.value)} required /></label>
          <label>Amount (USD)<input type="number" min="0.01" step="0.01" value={drafts[0].amount || ''} onChange={(event) => edit(0, 'amount', event.target.value)} required /></label>
          <label>Purchase order<input value={drafts[0].purchaseOrder ?? ''} onChange={(event) => edit(0, 'purchaseOrder', event.target.value)} placeholder="Optional" /></label>
        </div> : <div className="csv-review-wrap">
          <div className="csv-summary">{drafts.length} invoices found in {drafts[0].fileName}; review each before adding. Line-item descriptions and unit prices appear below each invoice.</div>
          <div className="csv-review-table">
            <div className="csv-review-row csv-review-head" style={{ gridTemplateColumns: 'minmax(110px,1fr) minmax(100px,.8fr) 112px 88px 78px', minWidth: 620 }}><span>Vendor</span><span>Invoice #</span><span>Date</span><span>Amount</span><span>PO</span></div>
            {drafts.map((invoice, index) => <div key={`${invoice.fileName}-${index}`}>
              <div className="csv-review-row" style={{ gridTemplateColumns: 'minmax(110px,1fr) minmax(100px,.8fr) 112px 88px 78px', minWidth: 620 }}>
                <input aria-label={`Vendor on row ${index + 1}`} value={invoice.vendor} onChange={(event) => edit(index, 'vendor', event.target.value)} />
                <input aria-label={`Invoice number on row ${index + 1}`} value={invoice.invoiceNumber} onChange={(event) => edit(index, 'invoiceNumber', event.target.value)} />
                <input aria-label={`Invoice date on row ${index + 1}`} type="date" value={invoice.invoiceDate} onChange={(event) => edit(index, 'invoiceDate', event.target.value)} />
                <input aria-label={`Amount on row ${index + 1}`} type="number" min="0.01" step="0.01" value={invoice.amount || ''} onChange={(event) => edit(index, 'amount', event.target.value)} />
                <input aria-label={`Purchase order on row ${index + 1}`} value={invoice.purchaseOrder ?? ''} onChange={(event) => edit(index, 'purchaseOrder', event.target.value)} />
              </div>
              <div className="csv-summary">{invoice.lineItems.length ? invoice.lineItems.map((item) => item.description + ' · ' + item.quantity + ' ' + item.unit + ' × ' + formatMoney(item.billedUnitPrice)).join('; ') : 'No line items detected for this invoice.'}</div>
            </div>)}
          </div>
        </div>}
        {drafts.length === 1 && <section className="detail-section" aria-label="Extracted line items">
          <div className="detail-section-heading"><h3>Extracted line items <span>({drafts[0].lineItems.length})</span></h3><span className="section-note">Review before adding</span></div>
          {drafts[0].lineItems.length ? <div className="line-items-table">
            <div className="line-item-row line-item-head"><span>Item / quantity</span><span>Expected</span><span>Billed / unit</span></div>
            {drafts[0].lineItems.map((item) => <div className="line-item-row" key={item.id}>
              <span className="line-item-name">{item.quantity} × {item.unit} · {item.description}</span><span>—</span><strong>{formatMoney(item.billedUnitPrice)}</strong>
            </div>)}
          </div> : <p className="upload-lede">No line items were detected. The invoice total is still available for review.</p>}
        </section>}
        <div className="review-actions">
          <button className="primary-button" onClick={() => onConfirm(drafts)} disabled={!ready}>Add {drafts.length} invoice{drafts.length === 1 ? '' : 's'} to review</button>
          <button className="text-button" onClick={onChoose} disabled={isParsing}>Choose a different file</button>
        </div>
        <p className="privacy-note"><LockKeyhole size={14} /> Parsed fields stay in this browser session.</p>
      </> : <>
        <p className="upload-lede">Upload one invoice or a CSV with multiple rows. We’ll read it locally and let you correct the extracted fields.</p>
        <button className={`dropzone ${isDragging ? 'drag-over' : ''}`} onClick={onChoose} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} disabled={isParsing} type="button" aria-label="Upload invoice file dropzone">
          <span className="dropzone-symbol">{isParsing ? <RefreshCw size={22} className="spin-icon" /> : isDragging ? <UploadCloud size={24} /> : <FileUp size={19} />}</span>
          <strong>{isParsing ? 'Reading invoices…' : isDragging ? 'Drop file here' : 'Choose or drop a file'}</strong>
          <small>{isParsing ? 'Local OCR may take a few seconds.' : 'PDF, image, TXT, JSON, or CSV · up to 10 MB'}</small>
        </button>
        {error && <p className="upload-error" role="alert">{error}</p>}
        <p className="privacy-note"><LockKeyhole size={14} /> The file stays on this device. Only confirmed fields enter the demo.</p>
        <button className="text-button" onClick={onClose} disabled={isParsing} type="button">Cancel</button>
      </>}
    </section>
  </div>
}
