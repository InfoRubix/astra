import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  t as translate,
  setLanguage as setLang,
  getLanguage,
} from '../utils/i18n';

// ─── Context ────────────────────────────────────────────────────────────────
const LanguageContext = createContext(null);

// ─── Provider ───────────────────────────────────────────────────────────────
/**
 * Wraps the application (or a subtree) and provides language state to all
 * descendants via the `useLanguage` hook.
 *
 * Usage:
 *   <LanguageProvider>
 *     <App />
 *   </LanguageProvider>
 */
export function LanguageProvider({ children }) {
  // Initialise from localStorage via the i18n utility
  const [language, setLanguageState] = useState(getLanguage);

  /**
   * Switch the active language.
   * Updates both the module-level state (used by the `t` function) and
   * the React state (triggers a re-render for consuming components).
   */
  const setLanguage = useCallback((lang) => {
    setLang(lang);              // persist to localStorage + update module var
    setLanguageState(lang);     // trigger React re-render
  }, []);

  /**
   * Translation function that is reactive to language changes.
   * Because `language` is in the dependency array of useMemo,
   * any component calling `t(key)` will re-render when the language
   * is switched.
   */
  const t = useCallback(
    (key) => translate(key),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language]                  // re-create when language changes so consumers re-render
  );

  /**
   * Toggle between English and Bahasa Malaysia.
   */
  const toggleLanguage = useCallback(() => {
    const next = language === LANGUAGES.EN ? LANGUAGES.BM : LANGUAGES.EN;
    setLang(next);
    setLanguageState(next);
  }, [language]);

  // Memoize the context value to avoid unnecessary re-renders
  const value = useMemo(() => ({
    language,
    setLanguage,
    t,
    toggleLanguage,
    languages: LANGUAGES,
    languageLabels: LANGUAGE_LABELS,
    isEnglish: language === LANGUAGES.EN,
    isMalay: language === LANGUAGES.BM,
  }), [language, setLanguage, t, toggleLanguage]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

// ─── Hook ───────────────────────────────────────────────────────────────────
/**
 * Custom hook to consume the language context.
 *
 * Returns an object with:
 *   - language        : current language code ('en' | 'ms')
 *   - setLanguage     : function to change the language
 *   - t               : translation function  t('nav.dashboard') => 'Papan Pemuka'
 *   - toggleLanguage  : shortcut to switch between en <-> ms
 *   - languages       : { EN: 'en', BM: 'ms' }
 *   - languageLabels  : { en: 'English', ms: 'Bahasa Malaysia' }
 *   - isEnglish       : boolean
 *   - isMalay         : boolean
 *
 * @example
 *   const { t, language, setLanguage } = useLanguage();
 *   return <h1>{t('nav.dashboard')}</h1>;
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error(
      'useLanguage must be used within a <LanguageProvider>. ' +
      'Wrap your app or component tree with <LanguageProvider>.'
    );
  }
  return context;
}

export default LanguageContext;
