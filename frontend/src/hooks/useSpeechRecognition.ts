import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpeechSettings } from '../speechSettings'

// Browser Web Speech API type declarations
interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message?: string
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

interface UseSpeechRecognitionOptions {
  onTranscriptChange?: (text: string) => void
  lang?: string
}

export function useSpeechRecognition(options: UseSpeechRecognitionOptions = {}) {
  const settingsLang = getSpeechSettings().dictationLang || 'en-US'
  const { onTranscriptChange, lang = settingsLang } = options
  const [isListening, setIsListening] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const isSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)

  const onTranscriptChangeRef = useRef(onTranscriptChange)
  useEffect(() => {
    onTranscriptChangeRef.current = onTranscriptChange
  }, [onTranscriptChange])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch {
        // Ignored if already stopped
      }
    }
    setIsListening(false)
  }, [])

  const startListening = useCallback(() => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser.')
      return
    }

    setError(null)

    // Stop any existing instance
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort()
      } catch {
        // Ignore
      }
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) return

    const recognition = new SpeechRec()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = lang

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcript + ' '
        }
      }

      if (finalTranscript.trim() && onTranscriptChangeRef.current) {
        onTranscriptChangeRef.current(finalTranscript)
      }
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'no-speech') {
        // Ignore brief pauses without setting an error
        return
      }
      if (event.error === 'not-allowed') {
        setError('Microphone permission was denied. You can continue typing.')
      } else if (event.error === 'network') {
        setError('Speech recognition network error.')
      } else {
        setError(`Speech recognition error: ${event.error}`)
      }
      setIsListening(false)
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    try {
      recognition.start()
      setIsListening(true)
      recognitionRef.current = recognition
    } catch {
      setError('Could not start microphone.')
      setIsListening(false)
    }
  }, [isSupported, lang])

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }, [isListening, startListening, stopListening])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort()
        } catch {
          // Ignore
        }
      }
    }
  }, [])

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    toggleListening,
  }
}
