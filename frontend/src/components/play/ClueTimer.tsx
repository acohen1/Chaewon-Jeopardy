/** ClueTimer — the clue overlay's phase-aware countdown ring. One ring, two
 * timers, both configured in Game settings (seconds; 0 = off):
 *  - BUZZ-IN ("time to buzz in", accent ring): auto-starts when the buzzers
 *    arm or re-arm (steal windows included); a buzz stops it.
 *  - ANSWER ("time to answer", dollar-amber ring): auto-starts when someone
 *    buzzes in; the verdict (or reset) clears it.
 * Expiry is ADVISORY: red pulse + soft double beep (sfx-mute aware); the
 * host still closes the clue or judges the answer.
 * Manual: 'T' or clicking starts/restarts the timer for the current moment —
 * answer clock while a buzz is held, buzz-in clock while armed, and in games
 * without a session ("couch play") the answer clock. If that timer is Off,
 * the other enabled one is used so a lone press never dead-ends.
 * Renders nothing when every applicable timer is Off. Mounted outside the
 * keyed SlideView so a countdown survives question↔answer flips.
 * PRESENTATION: idle is a compact host button; a running clock is the big
 * TV ring (couch-readable seconds, a caption naming the clock, heartbeat
 * urgency under 3s, pulsing TIME! on expiry) — it docks inside ClueOverlay's
 * stage cluster next to the buzzer surfaces so timer + buzz UI read as one
 * component. All motion is motion-safe (reduced-motion gets static color). */
import { clsx } from 'clsx'
import { Timer } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { useHotkeys } from '@/hooks/useHotkeys'
import type { BuzzerState } from '@/lib/live'
import { playSfx } from '@/lib/sfx'

export interface ClueTimerProps {
  /** Game-settings durations in seconds; 0 disables that timer. */
  buzzSeconds: number
  answerSeconds: number
  /** Live buzzer state while hosting; null/undefined = couch play. */
  buzzer?: BuzzerState | null
  /** Skip the compact idle button (the hosted stage cluster provides its own
   * affordances and a stray chip reads as clutter next to the big banner);
   * the T hotkey and the automatic triggers stay active regardless. */
  hideIdle?: boolean
}

type TimerKind = 'buzz' | 'answer'

const RADIUS = 15.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ClueTimer({ buzzSeconds, answerSeconds, buzzer, hideIdle = false }: ClueTimerProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'expired'>('idle')
  const [kind, setKind] = useState<TimerKind>('answer')
  const [duration, setDuration] = useState(0)
  const [remaining, setRemaining] = useState(0)

  const intervalRef = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearInterval(intervalRef.current), [])

  const stop = () => {
    window.clearInterval(intervalRef.current)
    setStatus('idle')
  }

  const start = (k: TimerKind, secs: number) => {
    if (secs <= 0) return
    window.clearInterval(intervalRef.current)
    const end = Date.now() + secs * 1000
    setKind(k)
    setDuration(secs)
    setStatus('running')
    setRemaining(secs)
    intervalRef.current = window.setInterval(() => {
      const rem = (end - Date.now()) / 1000
      if (rem <= 0) {
        window.clearInterval(intervalRef.current)
        setRemaining(0)
        setStatus('expired')
        playSfx('timeUp')
      } else {
        setRemaining(rem)
      }
    }, 100)
  }

  /* ---- Automatic triggers, driven by buzzer phase transitions ---- */
  const phase = buzzer?.phase ?? null
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    const prev = prevPhaseRef.current
    if (phase === prev) return
    prevPhaseRef.current = phase
    if (phase === 'armed') {
      // Arm or re-arm (steal window): open the buzz-in clock — or clear a
      // stale answer clock when the buzz-in timer is off.
      if (buzzSeconds > 0) start('buzz', buzzSeconds)
      else stop()
    } else if (phase === 'won') {
      // Someone holds the floor: their answer clock (stops the buzz-in one).
      if (answerSeconds > 0) start('answer', answerSeconds)
      else stop()
    } else if (phase === 'locked' || phase === null) {
      // Verdict landed / buzzer reset / session gone: nothing is being timed.
      stop()
    }
  }, [phase, buzzSeconds, answerSeconds])

  /* A settings change can disable the RUNNING timer without a phase change
   * (Game settings is reachable mid-clue, and another window's change arrives
   * via a query refetch). The early-return above never sees it, and rendering
   * null doesn't unmount us — without this, the orphaned interval ticks to a
   * phantom time-up beep behind a hidden ring. */
  const runningSecs = kind === 'buzz' ? buzzSeconds : answerSeconds
  useEffect(() => {
    if (status !== 'idle' && runningSecs <= 0) stop()
  }, [status, runningSecs])

  /* ---- Manual start/restart (T / click): time the current moment ---- */
  const manualStart = () => {
    const preferred: TimerKind = phase === 'won' ? 'answer' : phase ? 'buzz' : 'answer'
    const secsFor = (k: TimerKind) => (k === 'buzz' ? buzzSeconds : answerSeconds)
    const k = secsFor(preferred) > 0 ? preferred : preferred === 'buzz' ? 'answer' : 'buzz'
    start(k, secsFor(k))
  }

  const anyEnabled = buzzer != null ? buzzSeconds > 0 || answerSeconds > 0 : answerSeconds > 0
  useHotkeys({ t: manualStart }, { enabled: anyEnabled })

  if (!anyEnabled) return null

  if (status === 'idle') {
    if (hideIdle) return null
    const idleSecs =
      phase === 'won'
        ? answerSeconds || buzzSeconds
        : phase
          ? buzzSeconds || answerSeconds
          : answerSeconds || buzzSeconds
    return (
      <Button variant="ghost" size="sm" onClick={manualStart} title="Start timer [T]">
        <Timer className="size-4" />
        {idleSecs}s
      </Button>
    )
  }

  /* ---- Running / expired: the big TV ring — arc drains, seconds front and
   * center, a caption naming the clock, heartbeat urgency in the last
   * seconds, and an expired state readable from a couch. ---- */
  const expired = status === 'expired'
  const urgent = !expired && remaining <= 3
  const frac = duration > 0 ? remaining / duration : 0
  const arcClass = expired || urgent
    ? 'stroke-danger'
    : kind === 'answer'
      ? 'stroke-dollar'
      : 'stroke-accent'
  return (
    <button
      type="button"
      onClick={manualStart}
      title={expired ? "Time's up — click to restart [T]" : 'Restart timer [T]'}
      className={clsx(
        'relative size-26 shrink-0 cursor-pointer',
        expired && 'motion-safe:animate-pulse',
        urgent && 'motion-safe:animate-urgent-tick',
      )}
    >
      <svg viewBox="0 0 36 36" className="size-26 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          className="stroke-line-soft"
        />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - frac)}
          className={clsx('transition-colors duration-300', arcClass)}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={clsx(
            'font-display text-4xl leading-none font-bold tabular-nums',
            expired || urgent ? 'text-danger' : 'text-ink',
          )}
        >
          {Math.ceil(remaining)}
        </span>
        <span
          className={clsx(
            'mt-1 text-[10px] font-bold tracking-widest uppercase',
            expired ? 'text-danger' : kind === 'answer' ? 'text-dollar' : 'text-accent',
          )}
        >
          {expired ? 'Time!' : kind === 'answer' ? 'Answer' : 'Buzz in'}
        </span>
      </span>
    </button>
  )
}
