"use client";

import classNames from "classnames";
import { Search as SearchIcon } from "lucide-react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SearchResult } from "@/lib/search/engine";
import {
  useDocsSearchEngine,
  useSearchShortcut,
  useShortcutLabel,
} from "@/lib/search/hooks";
import { snippet, termsPattern } from "@/lib/search/snippet";
import type { SearchSectionKind } from "@/lib/search/types";
import s from "./Search.module.css";

// KIND_LABELS are the badges shown next to each result.
const KIND_LABELS: Record<SearchSectionKind, string> = {
  page: "Page",
  section: "Section",
  "config-option": "Config",
  "keybind-action": "Action",
  "vt-sequence": "VT",
};

// CODE_KINDS are result kinds whose titles are identifiers, shown in monospace.
const CODE_KINDS = new Set<SearchSectionKind>([
  "config-option",
  "keybind-action",
]);

interface SearchProps {
  className?: string;
}

// Search renders the navbar search button and the docs search dialog.
// It opens with the button, Cmd/Ctrl+K, or "/".
export default function Search({ className }: SearchProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const { engine, failed, prepare } = useDocsSearchEngine();
  const shortcutLabel = useShortcutLabel();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => engine?.search(query) ?? [], [engine, query]);

  // open shows the dialog and selects the previous query.
  const open = useCallback(() => {
    prepare();
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
      inputRef.current?.select();
    }
  }, [prepare]);

  // close hides the dialog.
  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // toggle opens or closes the dialog from the keyboard shortcut.
  const toggle = useCallback(() => {
    if (dialogRef.current?.open) {
      close();
    } else {
      open();
    }
  }, [open, close]);

  useSearchShortcut(toggle);

  // Reset the highlighted result whenever the results change.
  useEffect(() => {
    setActiveIndex(0);
  }, [results]);

  // Keep the highlighted result visible while navigating with the keyboard.
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // handleInputKeyDown implements arrow-key navigation and Enter to open.
  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      router.push(results[activeIndex].id);
      close();
    }
  }

  const status = statusMessage({
    failed,
    loaded: engine !== null,
    query,
    resultCount: results.length,
  });

  return (
    <>
      <button
        type="button"
        className={classNames(s.trigger, className)}
        onClick={open}
        onMouseEnter={prepare}
        onFocus={prepare}
        aria-label="Search docs"
      >
        <SearchIcon size={16} aria-hidden />
        <span className={s.triggerLabel}>Search docs</span>
        <kbd className={s.triggerShortcut}>{shortcutLabel}</kbd>
      </button>

      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape already closes the native dialog; this only handles backdrop clicks. */}
      <dialog
        ref={dialogRef}
        className={s.dialog}
        aria-label="Search docs"
        onClick={(event) => {
          if (event.target === dialogRef.current) {
            close();
          }
        }}
      >
        <div className={s.panel}>
          <div className={s.inputRow}>
            <SearchIcon size={18} aria-hidden />
            <input
              ref={inputRef}
              className={s.input}
              type="search"
              placeholder="Search docs, config options, actions…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleInputKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className={s.escHint}>Esc</kbd>
          </div>

          {status && <p className={s.status}>{status}</p>}

          {results.length > 0 && (
            <ul ref={listRef} className={s.results}>
              {results.map((result, i) => (
                <SearchResultItem
                  key={result.id}
                  result={result}
                  index={i}
                  active={i === activeIndex}
                  onHover={setActiveIndex}
                  onSelect={close}
                />
              ))}
            </ul>
          )}
        </div>
      </dialog>
    </>
  );
}

interface SearchResultItemProps {
  result: SearchResult;
  index: number;
  active: boolean;
  onHover: (index: number) => void;
  onSelect: () => void;
}

// SearchResultItem renders one result: kind badge, title, location, and snippet.
function SearchResultItem({
  result,
  index,
  active,
  onHover,
  onSelect,
}: SearchResultItemProps) {
  return (
    <li
      data-index={index}
      data-active={active}
      className={s.result}
      onMouseMove={() => onHover(index)}
    >
      <NextLink href={result.id} onClick={onSelect}>
        <div className={s.resultHeader}>
          <span className={s.kind}>{KIND_LABELS[result.kind]}</span>
          <span
            className={classNames(s.title, {
              [s.code]: CODE_KINDS.has(result.kind),
            })}
          >
            <Highlight text={result.title} terms={result.terms} />
          </span>
        </div>
        <div className={s.breadcrumb}>{result.breadcrumb.join(" › ")}</div>
        {result.text && (
          <p className={s.snippet}>
            <Highlight
              text={snippet(result.text, result.terms)}
              terms={result.terms}
            />
          </p>
        )}
      </NextLink>
    </li>
  );
}

// statusMessage returns the message shown in place of results, if any.
function statusMessage({
  failed,
  loaded,
  query,
  resultCount,
}: {
  failed: boolean;
  loaded: boolean;
  query: string;
  resultCount: number;
}): string | null {
  const trimmed = query.trim();
  if (failed) {
    return "Search is unavailable right now. Please try again later.";
  }
  if (!trimmed) {
    return null;
  }
  if (!loaded) {
    return "Loading…";
  }
  return resultCount === 0 ? `No results for “${trimmed}”` : null;
}

interface HighlightProps {
  text: string;
  terms: string[];
}

// Highlight renders text with every occurrence of the matched terms in <mark>.
function Highlight({ text, terms }: HighlightProps) {
  if (terms.length === 0) {
    return text;
  }
  // split with a capture group puts the matches at odd indices.
  return text
    .split(termsPattern(terms))
    .map((part, i) =>
      i % 2 === 1 ? <mark key={`${i}-${part}`}>{part}</mark> : part,
    );
}
