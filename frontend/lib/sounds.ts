/**
 * In-app notification sounds
 * Uses the uploaded notification tone for all events
 */

let audio: HTMLAudioElement | null = null

function getAudio(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null
  if (!audio) {
    audio = new Audio('/sounds/notification.mp3')
    audio.volume = 0.6
  }
  return audio
}

function playSound(volume = 0.6) {
  const a = getAudio()
  if (!a) return
  a.volume = volume
  a.currentTime = 0
  a.play().catch(() => {}) // silently fail if browser blocks autoplay
}

/** 🆕 New Task Assigned */
export function playNewTaskSound() {
  playSound(0.7)
}

/** 💬 Chat Message */
export function playChatSound() {
  playSound(0.5)
}

/** 📅 Due Today */
export function playDueTodaySound() {
  playSound(0.6)
}

/** 🚨 Overdue */
export function playOverdueSound() {
  playSound(0.8)
}
