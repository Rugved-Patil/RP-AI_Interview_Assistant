import { en } from './en'
import { hi } from './hi'
import { mr } from './mr'
import { de } from './de'
import { es } from './es'
import { fr } from './fr'
import { ja } from './ja'
import { gu } from './gu'
import { ta } from './ta'
import { te } from './te'
import { bn } from './bn'
import { kn } from './kn'
import type { LanguageId } from '../languages'

export const TRANSLATIONS: Record<LanguageId, Record<string, string>> = {
  en,
  hi,
  mr,
  de,
  es,
  fr,
  ja,
  gu,
  ta,
  te,
  bn,
  kn,
}
