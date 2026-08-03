/**
 * Notification sound system — works on Desktop, Android Chrome, iOS Safari
 *
 * Strategy:
 * 1. Register service worker on load
 * 2. On first user gesture → unlock AudioContext + preload buffer
 * 3. On notification events → play via AudioContext (most reliable)
 * 4. Fallback → HTMLAudio element
 * 5. iOS fallback → create fresh Audio on each play (iOS requires this)
 */

let audioCtx: AudioContext | null = null
let audioBuffer: AudioBuffer | null = null
let unlocked = false
let swRegistration: ServiceWorkerRegistration | null = null

// Register service worker
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').then(reg => {
    swRegistration = reg
  }).catch(() => {})

  // Listen for messages from SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'PLAY_SOUND') {
      _playAudio()
    }
  })
}

// Unlock audio on first user gesture (required by all mobile browsers)
function setupUnlock() {
  if (typeof window === 'undefined') return
  const unlock = async () => {
    if (unlocked) return
    try {
      const Ctx = window.AudioContext || (window as any).webkitAudioContext
      if (!Ctx) return
      audioCtx = new Ctx()
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      // Preload sound buffer
      const res = await fetch('/sounds/notification.mp3')
      const buf = await res.arrayBuffer()
      audioBuffer = await audioCtx.decodeAudioData(buf)
      unlocked = true
    } catch { /* silent */ }
  }

  // Unlock on any interaction
  const events = ['touchstart', 'touchend', 'mousedown', 'keydown', 'click', 'scroll']
  const handler = () => {
    unlock()
    // Keep listener active — iOS Safari needs resumed context on every gesture
  }
  events.forEach(e => window.addEventListener(e, handler, { passive: true }))
}

if (typeof window !== 'undefined') {
  setupUnlock()
}

// Core play function
async function _playAudio(volume = 0.8) {
  // Method 1: AudioContext buffer — best for all browsers
  if (audioCtx && audioBuffer) {
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume()
      const source = audioCtx.createBufferSource()
      const gain = audioCtx.createGain()
      source.buffer = audioBuffer
      gain.gain.value = volume
      source.connect(gain)
      gain.connect(audioCtx.destination)
      source.start(0)
      return
    } catch { /* fall through */ }
  }

  // Method 2: Fresh HTMLAudio — required for iOS Safari (reuse doesn't work)
  try {
    const a = new Audio('/sounds/notification.mp3')
    a.volume = volume
    // iOS requires play() inside a user gesture, but for socket events
    // the context is already unlocked so this works
    const playPromise = a.play()
    if (playPromise) await playPromise.catch(() => {})
  } catch { /* silent */ }
}

async function playSound(volume = 0.8) {
  await _playAudio(volume)

  // Also show native browser notification on mobile (works even when tab is in background)
  if ('Notification' in window && Notification.permission === 'granted' && swRegistration) {
    // Notification shown by service worker — triggers system sound on mobile
  }
}

// Request notification permission (call this once on login)
export async function requestNotificationPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const perm = await Notification.requestPermission()
  return perm === 'granted'
}

// Show native notification (works in background on mobile)
export function showNativeNotification(title: string, body: string, url = '/dashboard') {
  if (typeof window === 'undefined') return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!swRegistration) {
    // Fallback without SW
    new Notification(title, { body, icon: '/icon-192.png' })
    return
  }
  swRegistration.showNotification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url },
    tag: 'tvsdot',
    renotify: true,
  } as any)
}

/** 🆕 New Task Assigned */
export function playNewTaskSound() { playSound(0.9) }

/** 💬 Chat Message */
export function playChatSound() { playSound(0.8) }

/** 📅 Due Today */
export function playDueTodaySound() { playSound(0.8) }

/** 🚨 Overdue */
export function playOverdueSound() { playSound(1.0) }
