import { useCallback, useEffect, useRef, useState } from 'react'

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

  // Load and pick a natural English voice
  useEffect(() => {
    if (!isSupported) return

    function updateVoices() {
      const availableVoices = window.speechSynthesis.getVoices()
      setVoices(availableVoices)

      // Priority list of natural-sounding English voices
      const englishVoices = availableVoices.filter((v) => v.lang.startsWith('en'))
      const preferred =
        englishVoices.find((v) => v.name.includes('Google US English')) ||
        englishVoices.find((v) => v.name.includes('Samantha')) ||
        englishVoices.find((v) => v.name.includes('Daniel')) ||
        englishVoices.find((v) => v.name.includes('Natural')) ||
        englishVoices.find((v) => v.lang === 'en-US') ||
        englishVoices[0] ||
        availableVoices[0] ||
        null

      selectedVoiceRef.current = preferred
    }

    updateVoices()
    window.speechSynthesis.onvoiceschanged = updateVoices

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null
      }
    }
  }, [isSupported])

  const cancel = useCallback(() => {
    if (isSupported) {
      window.speechSynthesis.cancel()
    }
    setIsSpeaking(false)
  }, [isSupported])

  const speak = useCallback(
    (text: string) => {
      if (!isSupported || isMuted) return

      const cleaned = cleanTextForSpeech(text)
      if (!cleaned) return

      cancel()

      const utterance = new SpeechSynthesisUtterance(cleaned)
      if (selectedVoiceRef.current) {
        utterance.voice = selectedVoiceRef.current
      }
      utterance.rate = 1.0
      utterance.pitch = 1.0
      utterance.lang = selectedVoiceRef.current?.lang || 'en-US'

      utterance.onstart = () => {
        setIsSpeaking(true)
      }

      utterance.onend = () => {
        setIsSpeaking(false)
      }

      utterance.onerror = () => {
        setIsSpeaking(false)
      }

      window.speechSynthesis.speak(utterance)
    },
    [cancel, isMuted, isSupported],
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
      if (isSupported) {
        window.speechSynthesis.cancel()
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
