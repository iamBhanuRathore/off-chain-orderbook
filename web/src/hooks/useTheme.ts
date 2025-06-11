
"use client";
import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark';

export function useTheme() {
  // Initialize state to undefined or a sensible default to avoid hydration mismatch warnings.
  // The actual theme will be set in useEffect.
  const [theme, setThemeState] = useState<Theme | undefined>(undefined);

  const applyThemePreference = useCallback((newTheme: Theme) => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(newTheme);
    localStorage.setItem('theme', newTheme);
    setThemeState(newTheme);
  }, []);

  useEffect(() => {
    // This effect runs only on the client side
    const storedTheme = localStorage.getItem('theme') as Theme | null;
    if (storedTheme) {
      applyThemePreference(storedTheme);
    } else {
      const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyThemePreference(systemPrefersDark ? 'dark' : 'light');
    }
  }, [applyThemePreference]);

  // Listen to system theme changes to update if no preference is set
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
        const storedTheme = localStorage.getItem('theme') as Theme | null;
        // Only update if no explicit theme is set in localStorage
        // or if the current theme was derived from system preference initially
        if (!storedTheme) { 
            applyThemePreference(e.matches ? 'dark' : 'light');
        }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [applyThemePreference]);


  const toggleTheme = () => {
    if (theme) { // Ensure theme is defined before toggling
      applyThemePreference(theme === 'light' ? 'dark' : 'light');
    }
  };

  // Return a loading state or the current theme
  return { theme: theme ?? 'light', toggleTheme, isLoading: theme === undefined };
}
