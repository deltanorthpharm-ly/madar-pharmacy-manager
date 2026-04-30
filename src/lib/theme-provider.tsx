import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";
type Lang = "ar" | "en";

interface ThemeState {
  theme: Theme;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setLang: (l: Lang) => void;
  toggleTheme: () => void;
}

const Ctx = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");
  const [lang, setLangState] = useState<Lang>("ar");

  useEffect(() => {
    const t = (localStorage.getItem("madar_theme") as Theme) || "light";
    const l = (localStorage.getItem("madar_lang") as Lang) || "ar";
    setThemeState(t);
    setLangState(l);
    applyTheme(t);
    applyLang(l);
  }, []);

  function applyTheme(t: Theme) {
    const root = document.documentElement;
    if (t === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }

  function applyLang(l: Lang) {
    const root = document.documentElement;
    root.setAttribute("dir", l === "ar" ? "rtl" : "ltr");
    root.setAttribute("lang", l);
  }

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("madar_theme", t);
    applyTheme(t);
  };

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("madar_lang", l);
    applyLang(l);
    void import("@/i18n").then((m) => m.default.changeLanguage(l));
  };

  const toggleTheme = () => setTheme(theme === "light" ? "dark" : "light");

  return (
    <Ctx.Provider value={{ theme, lang, setTheme, setLang, toggleTheme }}>
      {children}
    </Ctx.Provider>
  );
}

export function useThemeLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useThemeLang must be used within ThemeProvider");
  return ctx;
}
