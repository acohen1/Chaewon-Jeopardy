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
 * keyed SlideView so a countdown survives question↔answer flips. */
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
}

type TimerKind = 'buzz' | 'answer'

const RADIUS = 15.5
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ClueTimer({ buzzSeconds, answerSeconds, buzzer }: ClueTimerProps) {
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

  const expired = status === 'expired'
  const frac = duration > 0 ? remaining / duration : 0
  return (
    <button
      type="button"
      onClick={manualStart}
      title={expired ? "Time's up — click to restart [T]" : 'Restart timer [T]'}
      className={clsx('relative size-9 shrink-0 cursor-pointer', expired && 'animate-pulse')}
    >
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          className="stroke-line-soft"
        />
        <circle
          cx="18"
          cy="18"
          r={RADIUS}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - frac)}
          className={clsx(
            expired ? 'stroke-danger' : kind === 'answer' ? 'stroke-dollar' : 'stroke-accent',
          )}
        />
      </svg>
      <span
        className={clsx(
          'absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums',
          expired ? 'text-danger' : 'text-ink',
        )}
      >
        {Math.ceil(remaining)}
      </span>
    </button>
  )
}
