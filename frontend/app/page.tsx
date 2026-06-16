'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store'

export default function Home() {
  const { token } = useAuthStore()
  const router = useRouter()
  useEffect(() => { router.push(token ? '/dashboard' : '/login') }, [token, router])
  return null
}
