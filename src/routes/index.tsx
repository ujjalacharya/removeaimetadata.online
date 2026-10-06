import { createFileRoute } from '@tanstack/react-router'
import {
  AlertTriangle,
  Check,
  Download,
  Eraser,
  FileImage,
  Fingerprint,
  Info,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react'
import { usePostHog } from 'posthog-js/react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import {
  cleanImage,
  cleanedFilename,
  formatBytes,
  inspectImage,
  type ImageInspection,
} from '../lib/imageEvidence'

export const Route = createFileRoute('/')({ component: ImageEvidenceDesk })

type Mode = 'clean' | 'scan'
type ImageInputMethod = 'file_picker' | 'drag_and_drop'

function ImageEvidenceDesk() {
  const posthog = usePostHog()
  const imageProcessingLogger = posthog?.logger
  const [mode, setMode] = useState<Mode>('clean')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [inspection, setInspection] = useState<ImageInspection | null>(null)
  const [cleaned, setCleaned] = useState<{ blob: Blob; url: string } | null>(null)
  const [status, setStatus] = useState<'idle' | 'reading' | 'cleaning' | 'ready'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const cleanTabRef = useRef<HTMLButtonElement>(null)
  const scanTabRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (cleaned) URL.revokeObjectURL(cleaned.url)
    }
  }, [previewUrl, cleaned])

  async function loadFile(nextFile: File, inputMethod: ImageInputMethod) {
    setError(null)
    setStatus('reading')
    setInspection(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (cleaned) URL.revokeObjectURL(cleaned.url)
    setCleaned(null)
    setFile(nextFile)
    setPreviewUrl(URL.createObjectURL(nextFile))
    try {
      const nextInspection = await inspectImage(nextFile)
      setInspection(nextInspection)
      setStatus('ready')
      const logAttributes = {
        mode,
        input_method: inputMethod,
        image_type: nextFile.type,
        file_size_bucket: nextFile.size <= 1024 * 1024 ? 'under_1_mb' : '1_to_25_mb',
      }
      imageProcessingLogger?.info('image inspection completed', logAttributes)
      posthog?.capture('image_inspection_completed', logAttributes)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'This image could not be read.')
      setStatus('idle')
      const logAttributes = {
        mode,
        input_method: inputMethod,
      }
      imageProcessingLogger?.warn('image inspection failed', logAttributes)
      posthog?.capture('image_inspection_failed', logAttributes)
    }
  }

  function switchMode(nextMode: Mode) {
    if (nextMode !== mode) {
      posthog?.capture('tool_mode_selected', { selected_mode: nextMode })
    }
    setMode(nextMode)
    setError(null)
    setCleaned((current) => {
      if (current) URL.revokeObjectURL(current.url)
      return null
    })
  }

  function handleTabKey(event: KeyboardEvent<HTMLButtonElement>, currentMode: Mode) {
    let nextMode: Mode | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      nextMode = currentMode === 'clean' ? 'scan' : 'clean'
    } else if (event.key === 'Home') {
      nextMode = 'clean'
    } else if (event.key === 'End') {
      nextMode = 'scan'
    }
    if (!nextMode) return
    event.preventDefault()
    switchMode(nextMode)
    requestAnimationFrame(() => {
      (nextMode === 'clean' ? cleanTabRef.current : scanTabRef.current)?.focus()
    })
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    if (cleaned) URL.revokeObjectURL(cleaned.url)
    setFile(null)
    setPreviewUrl(null)
    setInspection(null)
    setCleaned(null)
    setStatus('idle')
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  async function handleClean() {
    if (!file) return
    setStatus('cleaning')
    setError(null)
    try {
      const blob = await cleanImage(file)
      if (cleaned) URL.revokeObjectURL(cleaned.url)
      setCleaned({ blob, url: URL.createObjectURL(blob) })
      setStatus('ready')
      const logAttributes = {
        input_image_type: file.type,
        output_image_type: blob.type || file.type,
      }
      imageProcessingLogger?.info('metadata cleanup completed', logAttributes)
      posthog?.capture('metadata_cleanup_completed', logAttributes)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The image could not be cleaned.')
      setStatus('ready')
      imageProcessingLogger?.warn('metadata cleanup failed')
      posthog?.capture('metadata_cleanup_failed')
    }
  }

  function handleDownload() {
    if (!file || !cleaned) return
    const logAttributes = {
      output_image_type: cleaned.blob.type || file.type,
    }
    imageProcessingLogger?.info('cleaned image downloaded', logAttributes)
    posthog?.capture('cleaned_image_downloaded', logAttributes)
  }

  const liveMessage = error
    ? error
    : status === 'cleaning'
      ? 'Cleaning image'
      : status === 'reading'
        ? 'Reading image evidence'
        : cleaned
          ? 'Clean copy ready to download'
          : mode === 'scan' && inspection
            ? `AI signal scan complete: ${inspection.assessment.title}`
            : inspection
              ? 'Image evidence loaded'
              : ''
  const shownUrl = cleaned?.url ?? previewUrl

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="brand" href="#top" aria-label="Image Evidence Desk home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <span>Image Evidence Desk</span>
        </a>
        <p className="local-note">
          <LockKeyhole size={15} aria-hidden="true" />
          <span>Local only · no upload</span>
        </p>
      </header>

      <section className="desk" id="top" aria-labelledby="workspace-title">
        <div className="folder-tabs" role="tablist" aria-label="Image tools">
          <button
            ref={cleanTabRef}
            type="button"
            role="tab"
            aria-selected={mode === 'clean'}
            aria-controls="workspace-panel"
            tabIndex={mode === 'clean' ? 0 : -1}
            className={mode === 'clean' ? 'folder-tab active' : 'folder-tab'}
            onClick={() => switchMode('clean')}
            onKeyDown={(event) => handleTabKey(event, 'clean')}
          >
            <Eraser size={18} aria-hidden="true" />
            Clean metadata
          </button>
          <button
            ref={scanTabRef}
            type="button"
            role="tab"
            aria-selected={mode === 'scan'}
            aria-controls="workspace-panel"
            tabIndex={mode === 'scan' ? 0 : -1}
            className={mode === 'scan' ? 'folder-tab active' : 'folder-tab'}
            onClick={() => switchMode('scan')}
            onKeyDown={(event) => handleTabKey(event, 'scan')}
          >
            <ScanSearch size={18} aria-hidden="true" />
            Scan AI signals
          </button>
        </div>

        <div className={`folder-leaf mode-${mode}`} id="workspace-panel" role="tabpanel">
          <div className="folder-heading">
            <h1 id="workspace-title">
              {mode === 'clean' ? 'Clean metadata' : 'Scan AI signals'}
            </h1>
            <p className="folder-tagline">
              {mode === 'clean'
                ? 'Strip EXIF, XMP, and location from a share-ready copy.'
                : 'Read embedded provenance—evidence, not certainty.'}
            </p>
          </div>

          <div className="work-grid">
            <section className="image-field" aria-label="Image source">
              {shownUrl && file ? (
                <>
                  <img
                    src={shownUrl}
                    alt={cleaned ? `Clean copy of ${file.name}` : `Preview of ${file.name}`}
                  />
                  <div className="image-caption">
                    <span>{cleaned ? `${cleanedFilename(file)} · clean preview` : file.name}</span>
                    <span>{formatBytes(cleaned?.blob.size ?? file.size)}</span>
                  </div>
                  <button className="remove-file" type="button" onClick={reset} aria-label="Remove image">
                    <X size={18} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <label
                  htmlFor={inputId}
                  className={dragging ? 'drop-field dragging' : 'drop-field'}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      inputRef.current?.click()
                    }
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault()
                    setDragging(true)
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    const dropped = event.dataTransfer.files[0]
                    if (dropped) void loadFile(dropped, 'drag_and_drop')
                  }}
                >
                  <span className="upload-seal"><Upload size={28} aria-hidden="true" /></span>
                  <strong>{mode === 'clean' ? 'Place an image on the desk' : 'Add an image to examine'}</strong>
                  <span>Drop it here or choose a file</span>
                  <small>JPEG, PNG, or WebP · up to 25 MB</small>
                </label>
              )}
              <input
                ref={inputRef}
                id={inputId}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const selected = event.target.files?.[0]
                  if (selected) void loadFile(selected, 'file_picker')
                }}
              />
            </section>

            <EvidenceSlip
              mode={mode}
              file={file}
              inspection={inspection}
              cleaned={cleaned}
              status={status}
              error={error}
              onChoose={() => inputRef.current?.click()}
              onClean={handleClean}
              onDownload={handleDownload}
            />
          </div>
        </div>
      </section>

      <span className="sr-live" role="status" aria-live="polite">
        {liveMessage}
      </span>
    </main>
  )
}

type EvidenceSlipProps = {
  mode: Mode
  file: File | null
  inspection: ImageInspection | null
  cleaned: { blob: Blob; url: string } | null
  status: 'idle' | 'reading' | 'cleaning' | 'ready'
  error: string | null
  onChoose: () => void
  onClean: () => void
  onDownload: () => void
}

function EvidenceSlip({ mode, file, inspection, cleaned, status, error, onChoose, onClean, onDownload }: EvidenceSlipProps) {
  if (error) {
    return (
      <aside className="evidence-slip error-slip" aria-label="Image error">
        <div className="slip-title"><AlertTriangle size={20} aria-hidden="true" /><span>Could not open file</span></div>
        <p>{error}</p>
        <button className="secondary-action" type="button" onClick={onChoose}>Choose another image</button>
      </aside>
    )
  }

  if (status === 'reading' || status === 'cleaning') {
    return (
      <aside className="evidence-slip processing-slip" aria-label="Processing image">
        <div className="slip-title"><Fingerprint size={20} aria-hidden="true" /><span>{status === 'cleaning' ? 'Cleaning…' : 'Reading…'}</span></div>
        <div className="scan-lines" aria-hidden="true"><span /><span /><span /></div>
        <p className="processing-copy">
          {status === 'cleaning' ? 'Re-encoding without standard metadata.' : 'Checking metadata and provenance.'}
        </p>
      </aside>
    )
  }

  if (!file || !inspection) {
    return (
      <aside className="evidence-slip empty-slip" aria-label="What happens next">
        <div className="slip-title"><FileImage size={20} aria-hidden="true" /><span>Quick steps</span></div>
        <ol className="process-steps">
          <li><strong>1</strong><span>Drop or choose an image</span></li>
          <li><strong>2</strong><span>{mode === 'clean' ? 'Review embedded fields' : 'Run signal scan'}</span></li>
          <li><strong>3</strong><span>{mode === 'clean' ? 'Download clean copy' : 'Read the report'}</span></li>
        </ol>
        <p className="empty-hint">
          <ShieldCheck size={16} aria-hidden="true" />
          Processing stays in your browser.
        </p>
        <ScopeDetails mode={mode} />
      </aside>
    )
  }

  if (mode === 'scan') {
    const result = inspection.assessment
    return (
      <aside className={`evidence-slip result-slip verdict-${result.verdict}`} aria-label="AI signal scan result">
        <div className="slip-scroll">
          <div className="slip-title"><ScanSearch size={20} aria-hidden="true" /><span>AI signal report</span></div>
          <div className="result-stamp compact-stamp" key={result.title}>
            <span>{result.confidence} confidence</span>
            <strong>{result.title}</strong>
          </div>
          <p className="result-summary">{result.summary}</p>
          <dl className="file-facts compact-facts">
            <div><dt>Index</dt><dd>{result.score}/100</dd></div>
            <div><dt>Frame</dt><dd>{inspection.width} × {inspection.height}</dd></div>
          </dl>
          <div className="evidence-list">
            {result.evidence.map((item) => (
              <div className={`evidence-row tone-${item.tone}`} key={`${item.label}-${item.detail}`}>
                <span className="evidence-mark" aria-hidden="true" />
                <p><strong>{item.label}</strong> {item.detail}</p>
              </div>
            ))}
          </div>
          <ScopeDetails mode={mode} />
        </div>
      </aside>
    )
  }

  return (
    <aside className="evidence-slip result-slip" aria-label="Metadata cleanup result">
      <div className="slip-scroll">
        <div className="slip-title"><Eraser size={20} aria-hidden="true" /><span>Metadata ledger</span></div>
        <dl className="file-facts compact-facts">
          <div><dt>Frame</dt><dd>{inspection.width} × {inspection.height}</dd></div>
          <div><dt>MP</dt><dd>{inspection.megapixels.toFixed(1)}</dd></div>
          <div><dt>Fields</dt><dd>{inspection.metadata.length}</dd></div>
        </dl>
        <div className="metadata-list">
          {inspection.metadata.length > 0 ? (
            inspection.metadata.map((item) => (
              <div className="metadata-row" key={`${item.label}-${item.value}`}>
                <span>{item.label}</span><strong title={item.value}>{item.value}</strong>
              </div>
            ))
          ) : (
            <p className="empty-metadata">No readable EXIF, IPTC, or XMP. Re-encoding still produces a fresh copy.</p>
          )}
        </div>
        <ScopeDetails mode={mode} />
      </div>

      <div className="slip-actions">
        {cleaned ? (
          <div className="clean-result compact-clean" key={cleaned.url}>
            <span className="clean-check"><Check size={18} aria-hidden="true" /></span>
            <div className="clean-result-copy">
              <strong>Ready</strong>
              <p>{formatBytes(cleaned.blob.size)}</p>
            </div>
            <a className="primary-action" href={cleaned.url} download={cleanedFilename(file)} onClick={onDownload}>
              <Download size={18} aria-hidden="true" /> Download
            </a>
          </div>
        ) : (
          <button className="primary-action" type="button" onClick={onClean}>
            <Eraser size={18} aria-hidden="true" /> Remove metadata
          </button>
        )}
      </div>
    </aside>
  )
}

function ScopeDetails({ mode }: { mode: Mode }) {
  return (
    <details className="scope-details">
      <summary>
        <Info size={15} aria-hidden="true" />
        Limits &amp; scope
      </summary>
      <p>
        {mode === 'clean'
          ? 'Removes standard embedded metadata from the download. Does not alter pixels or guarantee how platforms label an image.'
          : 'Cannot prove human authorship. Missing markers may mean metadata was stripped or never written.'}
      </p>
    </details>
  )
}
