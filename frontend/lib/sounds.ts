/**
 * In-app notification sounds using Web Audio API
 * No external files needed — tones generated in browser
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  }
  // Resume if suspended (browser autoplay policy)
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = 'sine',
  volume = 0.3,
  startDelay = 0
) {
  const ctx = getAudioContext()
  if (!ctx) return

  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()

  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)

  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime + startDelay)

  gainNode.gain.setValueAtTime(0, ctx.currentTime + startDelay)
  gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + startDelay + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + startDelay + duration)

  oscillator.start(ctx.currentTime + startDelay)
  oscillator.stop(ctx.currentTime + startDelay + duration)
}

/** 🆕 New Task Assigned — two ascending chime tones (pleasant alert) */
export function playNewTaskSound() {
  playTone(523, 0.15, 'sine', 0.25, 0)      // C5
  playTone(659, 0.15, 'sine', 0.25, 0.18)   // E5
  playTone(784, 0.25, 'sine', 0.25, 0.36)   // G5
}

/** 💬 Chat Message — soft single ping */
export function playChatSound() {
  playTone(880, 0.12, 'sine', 0.2, 0)       // A5
  playTone(1046, 0.2, 'sine', 0.15, 0.14)  // C6
}

/** 📅 Due Today — double pulse warning */
export function playDueTodaySound() {
  playTone(440, 0.15, 'triangle', 0.3, 0)   // A4
  playTone(440, 0.15, 'triangle', 0.3, 0.25) // A4 again
}

/** 🚨 Overdue — three urgent descending pulses */
export function playOverdueSound() {
  playTone(660, 0.12, 'square', 0.15, 0)    // E5
  playTone(550, 0.12, 'square', 0.15, 0.18) // C#5
  playTone(440, 0.2, 'square', 0.15, 0.36)  // A4
}
