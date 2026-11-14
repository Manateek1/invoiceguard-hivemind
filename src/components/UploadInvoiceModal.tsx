import { useState } from 'react'
import { FileUp, LockKeyhole, X } from 'lucide-react'
import type { ParsedInvoice } from '../lib/invoice-parser'

interface Props {
  isParsing: boolean
  parsedInvoices: ParsedInvoice[] | null
  error: string
  onClose: () => void
  onChoose: () => void
  onConfirm: (invoices: ParsedInvoice[]) => void
}

export function UploadInvoiceModal({ isParsing, parsedInvoices, error, onClose, onChoose, onConfirm }: Props) {
  const [drafts, setDrafts] = useState<ParsedInvoice[]>(parsedInvoices ?? [])

  function edit(index: number, key: 'vendor' | 'invoiceNumber' | 'amount' | 'purchaseOrder', value: string) {
    setDrafts((current) => current.map((invoice, currentIndex) => currentIndex !== index ? invoice : {
      ...invoice,
      [key]: key === 'amount' ? Number(value) : value,
    }))
  }

  const ready = drafts.length > 0 && drafts.every((invoice) => invoice.vendor.trim() && invoice.invoiceNumber.trim() && Number.isFinite(invoice.amount) && invoice.amount > 0)

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !isParsing) onClose() }}>
    <section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <button className="modal-close" onClick={onClose} aria-label="Close upload dialog" disabled={isParsing}><X size={18} /></button>
      <div className="upload-icon"><FileUp size={22} /></div>
      <h2 id="upload-title">{drafts.length ? 'Confirm extracted invoices' : 'Upload invoices'}</h2>
      {drafts.length ? <>
        <p className="upload-lede">Check the fields before they enter this business workspace. The original file stays in this browser.</p>
        {drafts.length === 1 ? <div className="review-fields">
          <label>Vendor<input value={drafts[0].vendor} onChange={(event) => edit(0, 'vendor', event.target.value)} required /></label>
          <label>Invoice number<input value={drafts[0].invoiceNumber} onChange={(event) => edit(0, 'invoiceNumber', event.target.value)} required /></label>
          <label>Amount (USD)<input type="number" min="0.01" step="0.01" value={drafts[0].amount || ''} onChange={(event) => edit(0, 'amount', event.target.value)} required /></label>
          <label>Purchase order<input value={drafts[0].purchaseOrder ?? ''} onChange={(event) => edit(0, 'purchaseOrder', event.target.value)} placeholder="Optional" /></label>
        </div> : <div className="csv-review-wrap">
          <div className="csv-summary">{drafts.length} invoices found in {drafts[0].fileName}; review each before adding.</div>
          <div className="csv-review-table">
            <div className="csv-review-row csv-review-head"><span>Vendor</span><span>Invoice #</span><span>Amount</span><span>PO</span></div>
            {drafts.map((invoice, index) => <div className="csv-review-row" key={`${invoice.fileName}-${index}`}>
              <input aria-label={`Vendor on row ${index + 1}`} value={invoice.vendor} onChange={(event) => edit(index, 'vendor', event.target.value)} />
              <input aria-label={`Invoice number on row ${index + 1}`} value={invoice.invoiceNumber} onChange={(event) => edit(index, 'invoiceNumber', event.target.value)} />
              <input aria-label={`Amount on row ${index + 1}`} type="number" min="0.01" step="0.01" value={invoice.amount || ''} onChange={(event) => edit(index, 'amount', event.target.value)} />
              <input aria-label={`Purchase order on row ${index + 1}`} value={invoice.purchaseOrder ?? ''} onChange={(event) => edit(index, 'purchaseOrder', event.target.value)} />
            </div>)}
          </div>
        </div>}
        <div className="review-actions">
          <button className="primary-button" onClick={() => onConfirm(drafts)} disabled={!ready}>Add {drafts.length} invoice{drafts.length === 1 ? '' : 's'} to review</button>
          <button className="text-button" onClick={onChoose} disabled={isParsing}>Choose a different file</button>
        </div>
        <p className="privacy-note"><LockKeyhole size={14} /> Parsed fields stay in this browser session.</p>
      </> : <>
        <p className="upload-lede">Upload one invoice or a CSV with multiple rows. We’ll read it locally and let you correct the extracted fields.</p>
        <button className="dropzone" onClick={onChoose} disabled={isParsing}>
          <span className="dropzone-symbol"><FileUp size={19} /></span>
          <strong>{isParsing ? 'Reading invoices…' : 'Choose a file'}</strong>
          <small>{isParsing ? 'Local OCR may take a few seconds.' : 'PDF, image, TXT, JSON, or CSV · up to 10 MB'}</small>
        </button>
        {error && <p className="upload-error" role="alert">{error}</p>}
        <p className="privacy-note"><LockKeyhole size={14} /> The file stays on this device. Only confirmed fields enter the demo.</p>
        <button className="text-button" onClick={onClose} disabled={isParsing}>Cancel</button>
      </>}
    </section>
  </div>
}
