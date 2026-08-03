/**
 * In-app notification sounds
 * Plays sound ONLY on real events: new task, chat message, due today, overdue
 * Does NOT play on page load or user clicks
 */

let audioCtx: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let bufferLoaded = false

async function ensureReady(): Promise<boolean> {
  if (typeof window === 'undefined') return false

  try {
    // Create audio context on demand
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    }

    // Resume if suspended
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume()
    }

    // Load buffer once
    if (!bufferLoaded) {
      bufferLoaded = true // prevent multiple fetches
      const response = await fetch('/sounds/notification.mp3')
      const arrayBuffer = await response.arrayBuffer()
      audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)
    }

    return !!audioBuffer
  } catch {
    return false
  }
}

async function playSound(volume = 0.7) {
  const ready = await ensureReady()
  if (!ready || !audioCtx || !audioBuffer) {
    // Final fallback: HTMLAudio
    try {
      const a = new Audio('/sounds/notification.mp3')
      a.volume = volume
      await a.play()
    } catch { /* silent */ }
    return
  }

  try {
    const source = audioCtx.createBufferSource()
    const gainNode = audioCtx.createGain()
    source.buffer = audioBuffer
    gainNode.gain.value = volume
    source.connect(gainNode)
    gainNode.connect(audioCtx.destination)
    source.start(0)
  } catch { /* silent */ }
}

/** 🆕 New Task Assigned */
export function playNewTaskSound() {
  playSound(0.8)
}

/** 💬 Chat Message */
export function playChatSound() {
  playSound(0.7)
}

/** 📅 Due Today */
export function playDueTodaySound() {
  playSound(0.7)
}

/** 🚨 Overdue */
export function playOverdueSound() {
  playSound(0.9)
}
