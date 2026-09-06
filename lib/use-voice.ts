'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type Estado = 'no-soportado' | 'inactivo' | 'escuchando' | 'error'

/**
 * Dictado por voz mediante la Web Speech API.
 *
 * Safari la expone con prefijo (webkitSpeechRecognition) y solo bajo HTTPS,
 * así que se comprueba en tiempo de ejecución: donde no exista, el botón
 * sencillamente no aparece en vez de fallar al pulsarlo.
 */
export function useVoice(onResult: (texto: string) => void) {
  const [estado, setEstado] = useState<Estado>('inactivo')
  const [parcial, setParcial] = useState('')
  const recRef = useRef<any>(null)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (typeof window === 'undefined') return
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) { setEstado('no-soportado'); return }

    const rec = new SR()
    rec.lang = 'es-CO'
    rec.continuous = false
    rec.interimResults = true
    rec.maxAlternatives = 1

    rec.onresult = (e: any) => {
      let texto = ''
      for (let i = e.resultIndex; i < e.results.length; i++) texto += e.results[i][0].transcript
      setParcial(texto)
      if (e.results[e.results.length - 1].isFinal) onResultRef.current(texto)
    }
    rec.onerror = () => setEstado('error')
    rec.onend = () => setEstado((s) => (s === 'escuchando' ? 'inactivo' : s))

    recRef.current = rec
    return () => { try { rec.abort() } catch { /* ya detenido */ } }
  }, [])

  const start = useCallback(() => {
    if (!recRef.current) return
    setParcial('')
    setEstado('escuchando')
    try { recRef.current.start() } catch { /* ya estaba escuchando */ }
  }, [])

  const stop = useCallback(() => {
    try { recRef.current?.stop() } catch { /* noop */ }
    setEstado('inactivo')
  }, [])

  return { estado, parcial, start, stop, soportado: estado !== 'no-soportado' }
}
