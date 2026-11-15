import { useEffect, useRef, useState } from "react";
import { LANGS, useI18n, type Lang } from "../i18n";

/** Short code shown in the header; the menu lists full language names. */
const SHORT: Record<Lang, string> = { en: "EN", ru: "RU", tg: "TJ" };

export default function LanguageSwitcher() {
  const { lang, setLang, d } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lang-dd" ref={ref}>
      <button
        type="button"
        className="lang-dd-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={d.header.language}
        onClick={() => setOpen((o) => !o)}
      >
        {SHORT[lang]}
        <span className="lang-dd-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <ul className="lang-dd-menu" role="listbox" aria-label={d.header.language}>
          {LANGS.map((l) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={l === lang}
                className={"lang-dd-item" + (l === lang ? " active" : "")}
                onClick={() => {
                  setLang(l);
                  setOpen(false);
                }}
              >
                {d.langName[l]}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
