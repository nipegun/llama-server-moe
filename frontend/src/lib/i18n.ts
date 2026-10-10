import dEnglishUs from './locales/en-US.json';
import dEnglishGb from './locales/en-GB.json';
import dSpanishAr from './locales/es-AR.json';
import dSpanishEs from './locales/es-ES.json';

export const aLanguages = ['en-GB', 'en-US', 'es-AR', 'es-ES'] as const;
export type Language = (typeof aLanguages)[number];
const cStorageKey = 'moe-gguf-server.language';
const dCatalogs: Record<Language, Record<string, string>> = {
  'en-GB': dEnglishGb,
  'en-US': dEnglishUs,
  'es-AR': dSpanishAr,
  'es-ES': dSpanishEs
};

function fInitialLanguage(): Language {
  if (typeof window === 'undefined') return 'en-US';
  let vLanguage = new URL(window.location.href).searchParams.get('lang');
  try {
    vLanguage ??= window.localStorage.getItem(cStorageKey);
  } catch {
    // The URL still supports language selection when storage is unavailable.
  }
  return aLanguages.includes(vLanguage as Language) ? (vLanguage as Language) : 'en-US';
}

const cLanguage = fInitialLanguage();

export function fGetLanguage(): Language {
  return cLanguage;
}

export function fTranslate(pKey: string, pValues: Record<string, unknown> = {}): string {
  const vMessage = dCatalogs[cLanguage][pKey] ?? dCatalogs['en-US'][pKey] ?? pKey;
  return vMessage.replace(/\{(p\d+)\}/g, (pMatch, pName: string) =>
    Object.prototype.hasOwnProperty.call(pValues, pName) ? String(pValues[pName]) : pMatch
  );
}

export function fSetLanguage(pLanguage: string): void {
  if (!aLanguages.includes(pLanguage as Language) || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(cStorageKey, pLanguage);
  } catch {
    // Preserve the choice in the URL even in private or restricted browsers.
  }
  const vUrl = new URL(window.location.href);
  vUrl.searchParams.set('lang', pLanguage);
  // Reload so imported configuration labels and already-open dialogs agree.
  window.location.assign(vUrl.toString());
}
