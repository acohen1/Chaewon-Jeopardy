/** CellEditorDialog — Question/Answer tabbed editor over DRAFT copies of a
 * cell's slides. Save commits both drafts; Cancel/Escape discards (legacy
 * OK/Cancel parity). Pastes anywhere in the dialog land in the active tab.
 *
 * The dialog owns its own Ctrl+Z / Ctrl+Y history while open (the board-level
 * undo is suspended behind the modal): one timeline over BOTH tabs — asset
 * add/remove/reorder, volume drags, the stack toggle, and text — with bursts
 * (typing, a slider drag, one multi-file drop) coalesced into single steps.
 * Undo/redo jump to the tab the affected change happened on, and PAUSE while
 * uploads are in flight (history over an unsettled batch would strand its
 * remaining files). Media redo is safe: undo only drops the slide's path
 * reference — the uploaded file stays in the board's assets until an orphan
 * tidy, so redo simply re-references it. */
import { clsx } from 'clsx'
import { LoaderCircle, Redo2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { SlideEditor } from '@/components/editor/SlideEditor'
import type { SlideEditorHandle } from '@/components/editor/SlideEditor'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import type { Cell, Slide } from '@/types/board'

export interface CellEditorDialogProps {
  cell: Cell
  boardId: string
  title: string
  onSave: (question: Slide, answer: Slide) => void
  onCancel: () => void
}

type Tab = 'question' | 'answer'
const TABS: Tab[] = ['question', 'answer']

const cloneSlide = (s: Slide): Slide => ({
  text: s.text,
  audio_stack: s.audio_stack,
  assets: s.assets.map((a) => ({ ...a })),
})

/** Trim text + drop a dangling audio_stack flag (legacy get_slide parity). */
const finalizeSlide = (s: Slide): Slide => ({
  ...s,
  text: s.text.trim(),
  audio_stack:
    s.assets.filter((a) => a.asset_type === 'audio').length >= 2 ? s.audio_stack : false,
})

const HISTORY_CAP = 100
const COALESCE_MS = 900

export function CellEditorDialog({ cell, boardId, title, onSave, onCancel }: CellEditorDialogProps) {
  const [tab, setTab] = useState<Tab>('question')
  const [qDraft, setQDraft] = useState<Slide>(() => cloneSlide(cell.question_slide))
  const [aDraft, setADraft] = useState<Slide>(() => cloneSlide(cell.answer_slide))
  const [qUploading, setQUploading] = useState(false)
  const [aUploading, setAUploading] = useState(false)
  const uploading = qUploading || aUploading

  const qRef = useRef<SlideEditorHandle | null>(null)
  const aRef = useRef<SlideEditorHandle | null>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  /* ---- Dialog-local undo/redo (one timeline over both tabs) ---- */
  type Snapshot = { q: Slide; a: Slide; tab: Tab }
  const undoStackRef = useRef<Snapshot[]>([])
  const redoStackRef = useRef<Snapshot[]>([])
  const lastCoalesceRef = useRef<string | null>(null)
  const lastEditAtRef = useRef(0)
  // Live mirrors of the drafts, synced at MUTATION time by setDrafts (render
  // time is too late — see setDrafts). Initialized alongside the states.
  const qDraftRef = useRef(qDraft)
  const aDraftRef = useRef(aDraft)

  /** Set both draft states AND their live mirrors in the same tick — upload
   * commits arrive in async continuations, and two of them can land before
   * React flushes a render, so render-time-only mirrors would let the second
   * snapshot capture a stale draft. (Same pattern as useBoardDraft's apply.) */
  const setDrafts = (q: Slide, a: Slide) => {
    qDraftRef.current = q
    aDraftRef.current = a
    setQDraft(q)
    setADraft(a)
  }

  /** Route a SlideEditor change into the drafts, recording history. A change
   * whose coalesceKey matches the previous one (within the burst window, or
   * unconditionally for one multi-file `add:` batch) extends that undo step
   * instead of opening a new one. Keys are namespaced by tab — both
   * SlideEditors number their batches independently, so the raw keys collide
   * across tabs and would merge two unrelated drops into one step. */
  const applyChange = useCallback((which: Tab, next: Slide, coalesceKey?: string) => {
    const key = coalesceKey == null ? null : `${which}/${coalesceKey}`
    const isBatch = coalesceKey != null && coalesceKey.startsWith('add:')
    const now = Date.now()
    const continues =
      key != null &&
      key === lastCoalesceRef.current &&
      (isBatch || now - lastEditAtRef.current < COALESCE_MS)
    if (!continues) {
      undoStackRef.current.push({ q: qDraftRef.current, a: aDraftRef.current, tab: which })
      if (undoStackRef.current.length > HISTORY_CAP) undoStackRef.current.shift()
      redoStackRef.current = [] // a fresh edit invalidates the redo branch
    }
    lastCoalesceRef.current = key
    lastEditAtRef.current = now
    setDrafts(
      which === 'question' ? next : qDraftRef.current,
      which === 'answer' ? next : aDraftRef.current,
    )
  }, [])

  // While uploads are in flight the history is UNSETTLED — an undo now would
  // strand the rest of the batch (later files re-commit as fresh edits and
  // wipe the redo branch). Undo/redo pause until uploads settle, then one
  // Ctrl+Z removes the whole batch. Ref-mirrored for the stable callbacks.
  const uploadingRef = useRef(uploading)
  uploadingRef.current = uploading

  const undoEdit = useCallback(() => {
    if (uploadingRef.current) return
    const prev = undoStackRef.current.pop()
    if (!prev) return
    // The redo entry keeps the CHANGE's tab (prev.tab), not the tab the user
    // happens to be viewing — so redo later jumps to where the change reappears.
    redoStackRef.current.push({ q: qDraftRef.current, a: aDraftRef.current, tab: prev.tab })
    lastCoalesceRef.current = null // an undone burst never continues
    setDrafts(prev.q, prev.a)
    setTab(prev.tab) // show the tab the undone change happened on
  }, [])

  const redoEdit = useCallback(() => {
    if (uploadingRef.current) return
    const next = redoStackRef.current.pop()
    if (!next) return
    undoStackRef.current.push({ q: qDraftRef.current, a: aDraftRef.current, tab: next.tab })
    lastCoalesceRef.current = null
    setDrafts(next.q, next.a)
    setTab(next.tab)
  }, [])

  // canUndo/canRedo read at render time — safe because every stack mutation
  // happens alongside a setState (same pattern as useBoardDraft).
  const canUndo = undoStackRef.current.length > 0
  const canRedo = redoStackRef.current.length > 0

  // Guard against silently losing typed work: Cancel/Escape on a dirty
  // draft asks before discarding (the drafts live only in this dialog).
  const initialRef = useRef(JSON.stringify([qDraft, aDraft]))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const requestCancel = () => {
    if (JSON.stringify([qDraft, aDraft]) !== initialRef.current) setConfirmDiscard(true)
    else onCancel()
  }

  // Focus the dialog body so clipboard pastes are caught even before the user
  // clicks into a field.
  useEffect(() => {
    bodyRef.current?.focus()
  }, [])

  // Ctrl/Cmd+Z / Ctrl+Y / Ctrl+Shift+Z — the dialog's history owns undo here,
  // INCLUDING inside the textarea (native text undo is replaced by the burst
  // steps above; two histories over the same text would fight). The board
  // route's listener already yields while a modal is open. Suspended while
  // the discard confirm is up so Ctrl+Z can't mutate behind it.
  useEffect(() => {
    if (confirmDiscard) return
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      const isUndo = key === 'z' && !e.shiftKey
      const isRedo = key === 'y' || (key === 'z' && e.shiftKey)
      if (!isUndo && !isRedo) return
      e.preventDefault()
      if (isUndo) undoEdit()
      else redoEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmDiscard, undoEdit, redoEdit])

  const handlePaste = (e: React.ClipboardEvent) => {
    const target = tab === 'question' ? qRef.current : aRef.current
    if (!target) return
    const files = Array.from(e.clipboardData.files)
    if (files.length > 0) {
      e.preventDefault()
      target.addFiles(files)
      return
    }
    // Raw image data (e.g. a copied screenshot region) → pasted_image.png
    const item = Array.from(e.clipboardData.items).find((i) => i.type.startsWith('image/'))
    const blob = item?.getAsFile()
    if (blob) {
      e.preventDefault()
      target.addPastedImage(blob)
    }
  }

  return (
    <Dialog
      open
      onClose={requestCancel}
      title={title}
      dismissable={false}
      className="h-[86vh] w-full max-w-3xl"
      titleExtra={
        <div className="bg-surface ml-2 flex rounded-lg border border-line/60 p-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={clsx(
                'cursor-pointer rounded-md px-3.5 py-1 text-xs font-semibold capitalize transition-colors duration-100',
                tab === t
                  ? 'bg-surface-warm text-accent-bright'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      }
    >
      <div
        ref={bodyRef}
        tabIndex={-1}
        onPaste={handlePaste}
        className="flex h-full min-h-0 flex-col outline-none"
      >
        <div className={clsx('min-h-0 flex-1', tab !== 'question' && 'hidden')}>
          <SlideEditor
            draft={qDraft}
            onChange={(next, coalesceKey) => applyChange('question', next, coalesceKey)}
            boardId={boardId}
            handleRef={qRef}
            active={tab === 'question'}
            onUploadingChange={setQUploading}
          />
        </div>
        <div className={clsx('min-h-0 flex-1', tab !== 'answer' && 'hidden')}>
          <SlideEditor
            draft={aDraft}
            onChange={(next, coalesceKey) => applyChange('answer', next, coalesceKey)}
            boardId={boardId}
            handleRef={aRef}
            active={tab === 'answer'}
            onUploadingChange={setAUploading}
          />
        </div>

        <div className="flex shrink-0 items-center gap-2 border-t border-line-soft px-5 py-3">
          <Button
            variant="ghost"
            size="sm"
            disabled={!canUndo || uploading}
            onClick={undoEdit}
            title={uploading ? 'Undo — waiting for uploads to finish' : 'Undo (Ctrl+Z)'}
            aria-label="Undo"
            className="px-1.5 py-1.5"
          >
            <Undo2 size={14} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canRedo || uploading}
            onClick={redoEdit}
            title={uploading ? 'Redo — waiting for uploads to finish' : 'Redo (Ctrl+Y)'}
            aria-label="Redo"
            className="px-1.5 py-1.5"
          >
            <Redo2 size={14} />
          </Button>
          <div className="ml-auto flex items-center gap-2">
          {uploading && (
            <span className="text-ink-muted flex items-center gap-1.5 text-xs">
              <LoaderCircle size={13} className="text-accent animate-spin" />
              Uploading…
            </span>
          )}
          <Button variant="ghost" onClick={requestCancel}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={uploading}
            onClick={() => onSave(finalizeSlide(qDraft), finalizeSlide(aDraft))}
          >
            Save
          </Button>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard changes?"
        message="This cell has unsaved edits. Discard them?"
        confirmLabel="Discard"
        danger
        onConfirm={() => {
          setConfirmDiscard(false)
          onCancel()
        }}
        onCancel={() => setConfirmDiscard(false)}
      />
    </Dialog>
  )
}
