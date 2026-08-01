/** GameSettingsDialog — per-board game settings, grouped into sections:
 * Turn order (radio cards, conditional sub-groups), Buzzer (auto-arm +
 * the two pacing timers), Media (autoplay), Scoring (negatives).
 * Choices apply instantly (server-authoritative) and the server remembers
 * them as the defaults for every future board. Conditional sections:
 * multi-award transfer only matters under First-correct; first pick only
 * when a mode is automatic. */
import { clsx } from 'clsx'
import type { ReactNode } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import type {
  Board,
  FirstPick,
  GameSettingsPatch,
  MultiAwardRule,
  TurnMode,
} from '@/types/board'

export interface GameSettingsDialogProps {
  open: boolean
  board: Board
  onChange: (settings: GameSettingsPatch) => void
  onClose: () => void
}

const TURN_MODES: { value: TurnMode; label: string; hint: string }[] = [
  {
    value: 'first-correct',
    label: 'First correct answer',
    hint: 'The classic rule: whoever answers right picks the next clue.',
  },
  {
    value: 'sequential',
    label: 'Take turns',
    hint: 'The board passes around the scoreboard in order, clue by clue.',
  },
  {
    value: 'manual',
    label: 'Host decides',
    hint: 'Hand the board to anyone from the scoreboard; the pick clears after each clue.',
  },
]

const MULTI_AWARD: { value: MultiAwardRule; label: string; hint: string }[] = [
  {
    value: 'first',
    label: 'First award',
    hint: 'The first player awarded keeps the board.',
  },
  {
    value: 'last',
    label: 'Last award',
    hint: 'The most recent award takes the board.',
  },
  {
    value: 'host',
    label: 'Host decides',
    hint: 'Nobody keeps it automatically — hand the board out yourself.',
  },
]

const FIRST_PICK: { value: FirstPick; label: string; hint: string }[] = [
  {
    value: 'random',
    label: 'Random player',
    hint: 'The app picks someone to start.',
  },
  {
    value: 'lowest',
    label: 'Lowest score',
    hint: 'Trailing player starts — great for round two.',
  },
  {
    value: 'host',
    label: 'Host decides',
    hint: 'Nobody starts with the board until you hand it over.',
  },
]

/** Pill choices for the two timers — 0 renders as "Off". */
const BUZZ_SECONDS = [0, 10, 15, 20, 30]
const ANSWER_SECONDS = [0, 5, 10, 15, 20, 30]

export function GameSettingsDialog({ open, board, onChange, onClose }: GameSettingsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title="Game settings" className="w-full max-w-lg">
      <div className="max-h-[70vh] space-y-6 overflow-y-auto px-5 py-4">
        <Section title="Turn order">
          <RuleGroup
            idPrefix="rule-turn"
            options={TURN_MODES}
            value={board.turn_mode}
            onSelect={(v) => onChange({ turn_mode: v })}
          />
          {board.turn_mode === 'first-correct' && (
            <RuleGroup
              idPrefix="rule-multi"
              label="When several players score"
              options={MULTI_AWARD}
              value={board.multi_award}
              onSelect={(v) => onChange({ multi_award: v })}
            />
          )}
          {board.turn_mode !== 'manual' && (
            <RuleGroup
              idPrefix="rule-pick"
              label="Who starts"
              options={FIRST_PICK}
              value={board.first_pick}
              onSelect={(v) => onChange({ first_pick: v })}
            />
          )}
        </Section>

        <Section title="Buzzer">
          <SwitchRow
            testid="setting-auto-arm"
            label="Auto-arm buzzers"
            hint="Buzzers arm themselves the moment a clue opens. Off = you arm each clue with B."
            checked={board.auto_arm_buzzers}
            onChange={(v) => onChange({ auto_arm_buzzers: v })}
          />
          <PillRow
            testid="setting-buzz-timer"
            label="Time to buzz in"
            hint="Counts down once the buzzers arm; a beep calls the dead clue. Hosted games."
            options={BUZZ_SECONDS}
            value={board.buzz_timer_seconds}
            onSelect={(v) => onChange({ buzz_timer_seconds: v })}
          />
          <PillRow
            testid="setting-answer-timer"
            label="Time to answer"
            hint="Counts down once someone buzzes in — or start it anytime with T."
            options={ANSWER_SECONDS}
            value={board.answer_timer_seconds}
            onSelect={(v) => onChange({ answer_timer_seconds: v })}
          />
        </Section>

        <Section title="Media">
          <SwitchRow
            testid="setting-autoplay"
            label="Auto-play media"
            hint="A slide's video or audio starts on reveal when it's the only clip. Slides with several clips stay manual."
            checked={board.autoplay_media}
            onChange={(v) => onChange({ autoplay_media: v })}
          />
        </Section>

        <Section title="Scoring">
          <SwitchRow
            testid="setting-negatives"
            label="Allow negative scores"
            hint="Wrong answers can take a player below $0."
            checked={board.allow_negatives}
            onChange={(v) => onChange({ allow_negatives: v })}
          />
        </Section>

        <p className="text-ink-faint text-xs leading-relaxed">
          Changes apply immediately and become the defaults for new boards.
        </p>
      </div>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="text-accent border-line-soft border-b pb-1.5 text-xs font-bold tracking-widest uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function RuleGroup<T extends string>({
  idPrefix,
  label,
  options,
  value,
  onSelect,
}: {
  /** Namespaces the testids — "host" exists in more than one group. */
  idPrefix: string
  /** Optional: the first group in a section reads fine under the section title alone. */
  label?: string
  options: { value: T; label: string; hint: string }[]
  value: T
  onSelect: (value: T) => void
}) {
  return (
    <fieldset className="space-y-2">
      {label && (
        <legend className="text-ink-muted mb-1.5 text-xs font-semibold tracking-wide uppercase">
          {label}
        </legend>
      )}
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          data-testid={`${idPrefix}-${opt.value}`}
          onClick={() => onSelect(opt.value)}
          className={clsx(
            'block w-full cursor-pointer rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-100',
            value === opt.value
              ? 'border-accent/70 bg-accent/10'
              : 'border-line-soft hover:border-line',
          )}
        >
          <span
            className={clsx(
              'text-sm font-semibold',
              value === opt.value ? 'text-accent' : 'text-ink',
            )}
          >
            {opt.label}
          </span>
          <span className="text-ink-muted mt-0.5 block text-xs leading-relaxed">{opt.hint}</span>
        </button>
      ))}
    </fieldset>
  )
}

/** Label + hint on the left, a switch on the right — boolean settings. */
function SwitchRow({
  testid,
  label,
  hint,
  checked,
  onChange,
}: {
  testid: string
  label: string
  hint: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testid}
      onClick={() => onChange(!checked)}
      className="border-line-soft hover:border-line group flex w-full cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors duration-100"
    >
      <span className="min-w-0 flex-1">
        <span className="text-ink block text-sm font-semibold">{label}</span>
        <span className="text-ink-muted mt-0.5 block text-xs leading-relaxed">{hint}</span>
      </span>
      <span
        className={clsx(
          'relative h-4.5 w-8 shrink-0 rounded-full transition-colors duration-150',
          checked ? 'bg-accent-deep' : 'bg-cell',
        )}
      >
        <span
          className={clsx(
            'bg-ink absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform duration-150',
            checked && 'translate-x-3.5',
          )}
        />
      </span>
    </button>
  )
}

/** Label + hint above a row of segmented pills — the timer durations. */
function PillRow({
  testid,
  label,
  hint,
  options,
  value,
  onSelect,
}: {
  testid: string
  label: string
  hint: string
  /** Seconds; 0 renders as "Off". */
  options: number[]
  value: number
  onSelect: (v: number) => void
}) {
  // Imports and the API accept any 0–600s — an off-list stored value gets
  // its own pill so the active setting is never invisible in the dialog.
  const shown = options.includes(value)
    ? options
    : [...options, value].sort((a, b) => a - b)
  return (
    <fieldset className="border-line-soft space-y-2 rounded-xl border px-3.5 py-2.5">
      <legend className="sr-only">{label}</legend>
      <span className="text-ink block text-sm font-semibold">{label}</span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {shown.map((secs) => (
          <button
            key={secs}
            type="button"
            role="radio"
            aria-checked={value === secs}
            data-testid={`${testid}-${secs}`}
            onClick={() => onSelect(secs)}
            className={clsx(
              'cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors duration-100',
              value === secs
                ? 'border-accent/70 bg-accent/15 text-accent'
                : 'border-line-soft text-ink-muted hover:border-line hover:text-ink',
            )}
          >
            {secs === 0 ? 'Off' : `${secs}s`}
          </button>
        ))}
      </div>
      <span className="text-ink-muted block text-xs leading-relaxed">{hint}</span>
    </fieldset>
  )
}
