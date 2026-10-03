import { useCallback, useEffect, useRef, useState } from 'react'
import { getSpeechSettings, subscribeSpeechSettings } from '../speechSettings'

export function isNaturalVoice(v: SpeechSynthesisVoice): boolean {
  const name = v.name.toLowerCase()
  return (
    name.includes('natural') ||
    name.includes('enhanced') ||
    name.includes('premium') ||
    name.includes('online') ||
    name.includes('google') ||
    name.includes('siri') ||
    name.includes('neural') ||
    name === 'alex' ||
    name === 'samantha' ||
    name === 'daniel' ||
    name === 'ava' ||
    name === 'allison' ||
    name === 'karen' ||
    name === 'tessa' ||
    name === 'serena'
  )
}

function cleanTextForSpeech(text: string): string {
  return text
    // Remove markdown code blocks and inline backticks
    .replace(/```[\s\S]*?```/g, ' code block omitted ')
    .replace(/`([^`]+)`/g, '$1')
    // Remove markdown headers, bold, italics, bullets
    .replace(/#{1,6}\s+/g, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^\s*[-*+]\s+/gm, '')
    // Remove special interview tokens
    .replace(/\[END_INTERVIEW\]/g, '')
    .trim()
}

export function useSpeechSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])

  const isSupported =
    typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window

  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null)
  const speakTimeoutRef = useRef<number | null>(null)

  const resolvePreferredVoice = useCallback((availableVoices: SpeechSynthesisVoice[]) => {
    if (!availableVoices || availableVoices.length === 0) return null
    const settings = getSpeechSettings()
    const targetLang = settings.dictationLang || 'en-US'
    const langPrefix = targetLang.split('-')[0].toLowerCase()

    // 1. User explicitly selected voice URI
    if (settings.voiceURI) {
      const match = availableVoices.find(
        (v) =>
          v.voiceURI === settings.voiceURI ||
          v.name === settings.voiceURI ||
          `${v.name} (${v.lang})` === settings.voiceURI,
      )
      if (match) return match
    }

    // 2. Filter voices matching current active language code / prefix (e.g. 'hi', 'mr', 'de', 'es', 'fr', 'ja', 'en')
    const langVoices = availableVoices.filter(
      (v) => v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix) || v.lang.toLowerCase() === targetLang.toLowerCase(),
    )

    if (langVoices.length > 0) {
      // Prioritize natural / enhanced voices in this language
      const naturalLangVoice = langVoices.find((v) => isNaturalVoice(v))
      if (naturalLangVoice) return naturalLangVoice

      // Exact dialect match
      const exactMatch = langVoices.find((v) => v.lang.toLowerCase().replace('_', '-') === targetLang.toLowerCase())
      if (exactMatch) return exactMatch

      return langVoices[0]
    }

    // 3. Fallback to natural English voices if language voices not installed on browser/OS
    const englishVoices = availableVoices.filter((v) => v.lang.startsWith('en'))
    const preferred =
      englishVoices.find((v) => v.name.includes('Google US English')) ||
      englishVoices.find((v) => v.name.toLowerCase().includes('samantha')) ||
      englishVoices.find((v) => v.name.toLowerCase().includes('daniel')) ||
      englishVoices.find((v) => isNaturalVoice(v)) ||
      englishVoices[0] ||
      availableVoices[0] ||
      null

    return preferred
  }, [])

  // Load voices and sync with speech settings
  useEffect(() => {
    if (!isSupported) return

    function updateVoices() {
      const availableVoices = window.speechSynthesis.getVoices()
      if (availableVoices && availableVoices.length > 0) {
        setVoices(availableVoices)
        selectedVoiceRef.current = resolvePreferredVoice(availableVoices)
      }
    }

    updateVoices()
    window.speechSynthesis.onvoiceschanged = updateVoices

    // Subscribe to speech settings changes
    const unsubscribe = subscribeSpeechSettings(() => {
      const availableVoices = window.speechSynthesis.getVoices()
      selectedVoiceRef.current = resolvePreferredVoice(availableVoices)
    })

    return () => {
      unsubscribe()
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [isSupported, resolvePreferredVoice])

  const cancel = useCallback(() => {
    if (speakTimeoutRef.current !== null) {
      clearTimeout(speakTimeoutRef.current)
      speakTimeoutRef.current = null
    }
    if (isSupported && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel()
        window.speechSynthesis.resume()
      } catch {
        // Ignored
      }
    }
    setIsSpeaking(false)
  }, [isSupported])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || isMuted || typeof window === 'undefined') return

      const cleaned = cleanTextForSpeech(text)
      if (!cleaned) return

      cancel()

      // Small tick delay to let previous cancel finish cleanly on all browsers
      speakTimeoutRef.current = window.setTimeout(() => {
        try {
          const currentSettings = getSpeechSettings()
          const availableVoices = window.speechSynthesis.getVoices()
          const voice = resolvePreferredVoice(availableVoices) || selectedVoiceRef.current

          const utterance = new SpeechSynthesisUtterance(cleaned)
          if (voice) {
            utterance.voice = voice
            utterance.lang = voice.lang || 'en-US'
          } else {
            utterance.lang = 'en-US'
          }
          utterance.rate = currentSettings.rate
          utterance.pitch = currentSettings.pitch

          utterance.onstart = () => {
            setIsSpeaking(true)
          }

          utterance.onend = () => {
            setIsSpeaking(false)
          }

          utterance.onerror = (e) => {
            if (e.error !== 'canceled' && e.error !== 'interrupted') {
              console.warn('Speech synthesis error:', e)
            }
            setIsSpeaking(false)
          }

          window.speechSynthesis.resume()
          window.speechSynthesis.speak(utterance)
        } catch (err) {
          console.error('Speech synthesis speak failure:', err)
          setIsSpeaking(false)
        }
      }, 30)
    },
    [cancel, isMuted, isSupported, resolvePreferredVoice],
  )

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev
      if (next) {
        cancel()
      }
      return next
    })
  }, [cancel])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (speakTimeoutRef.current !== null) {
        clearTimeout(speakTimeoutRef.current)
      }
      if (isSupported && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel()
        } catch {
          // Ignored
        }
      }
    }
  }, [isSupported])

  return {
    isSupported,
    isSpeaking,
    isMuted,
    voices,
    speak,
    cancel,
    toggleMute,
    setIsMuted,
  }
}
