/**
 * In-app notification sounds
 * Uses Web Audio API + MP3 fallback
 * Handles browser autoplay policy by unlocking on first user interaction
 */

let unlocked = false
let audioCtx: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let loadError = false

// Unlock audio on first user interaction
if (typeof window !== 'undefined') {
  const unlock = () => {
    if (unlocked) return
    unlocked = true
    initAudio()
    window.removeEventListener('click', unlock)
    window.removeEventListener('keydown', unlock)
    window.removeEventListener('touchstart', unlock)
  }
  window.addEventListener('click', unlock)
  window.addEventListener('keydown', unlock)
  window.addEventListener('touchstart', unlock)
}

function initAudio() {
  try {
    if (audioCtx) return
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()

    // Load the MP3 into a buffer for instant reliable playback
    fetch('/sounds/notification.mp3')
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx!.decodeAudioData(buf))
      .then(decoded => { audioBuffer = decoded })
      .catch(() => { loadError = true })
  } catch {
    loadError = true
  }
}

function playSound(volume = 0.7) {
  // Method 1: AudioContext buffer (most reliable)
  if (audioCtx && audioBuffer) {
    try {
      if (audioCtx.state === 'suspended') audioCtx.resume()
      const source = audioCtx.createBufferSource()
      const gainNode = audioCtx.createGain()
      source.buffer = audioBuffer
      gainNode.gain.value = volume
      source.connect(gainNode)
      gainNode.connect(audioCtx.destination)
      source.start(0)
      return
    } catch { /* fall through */ }
  }

  // Method 2: HTMLAudio fallback
  try {
    const a = new Audio('/sounds/notification.mp3')
    a.volume = volume
    a.play().catch(() => {})
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
