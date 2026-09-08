"use client";

import { FormEvent, forwardRef, useEffect, useRef, useState } from "react";
import {
  COMMANDS,
  CommandDef,
  CommandResult,
  parseCommand,
  loadHistory,
  saveHistory,
  addToHistory,
  getCommandSuggestions,
} from "@/lib/commands";

export type { CommandDef, CommandResult };
export { COMMANDS, parseCommand, addToHistory, getCommandSuggestions };

type CommandBarProps = {
  onCommand: (result: CommandResult) => void;
};

const CommandBar = forwardRef<HTMLInputElement, CommandBarProps>(
  function CommandBar({ onCommand }, ref) {
    const [input, setInput] = useState("");
    const [suggestions, setSuggestions] = useState<CommandDef[]>([]);
    const [selectedIdx, setSelectedIdx] = useState(-1);
    const [historyIdx, setHistoryIdx] = useState(-1);
    const [history, setHistory] = useState<string[]>([]);
    const suggestRef = useRef<HTMLUListElement>(null);

    // Load history once on mount (client only).
    useEffect(() => {
      setHistory(loadHistory());
    }, []);

    // Update suggestions as input changes dynamically with universal ticker matching and recency weighting.
    useEffect(() => {
      const q = input.trim();
      if (!q) {
        setSuggestions([]);
        setSelectedIdx(-1);
        return;
      }
      const matches = getCommandSuggestions(q, history);
      setSuggestions(matches);
      setSelectedIdx(-1);
    }, [input, history]);

    // Automatically scroll the selected item into view when navigating with Arrow keys
    useEffect(() => {
      if (selectedIdx >= 0 && suggestRef.current) {
        const activeItem = suggestRef.current.children[selectedIdx] as HTMLElement | undefined;
        if (activeItem) {
          if (typeof activeItem.scrollIntoView === "function") {
            activeItem.scrollIntoView({ block: "nearest", inline: "nearest" });
          } else {
            const container = suggestRef.current;
            const itemTop = activeItem.offsetTop;
            const itemBottom = itemTop + activeItem.offsetHeight;
            if (itemTop < container.scrollTop) {
              container.scrollTop = itemTop;
            } else if (itemBottom > container.scrollTop + container.clientHeight) {
              container.scrollTop = itemBottom - container.clientHeight;
            }
          }
        }
      } else if (selectedIdx === -1 && suggestRef.current) {
        suggestRef.current.scrollTop = 0;
      }
    }, [selectedIdx]);

    function executeCommand(value: string) {
      const trimmed = value.trim();
      if (!trimmed) return;

      const result = parseCommand(trimmed);
      onCommand(result);

      // Save to terminal command history (localStorage)
      const nextHistory = addToHistory(trimmed, history);
      setHistory(nextHistory);
      saveHistory(nextHistory);
      setHistoryIdx(-1);

      setInput("");
      setSuggestions([]);
      setSelectedIdx(-1);
    }

    function submit(e: FormEvent) {
      e.preventDefault();
      executeCommand(input);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      // Escape — close suggestions.
      if (e.key === "Escape") {
        setSuggestions([]);
        setSelectedIdx(-1);
        return;
      }

      // ArrowDown — navigate suggestions (with auto-scroll); if none, go into history.
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIdx((i) => (i + 1 < suggestions.length ? i + 1 : 0));
        } else {
          const next = historyIdx + 1;
          if (next < history.length) {
            setHistoryIdx(next);
            setInput(history[next]);
          }
        }
        return;
      }

      // ArrowUp — navigate history backwards (or suggestions with wrap-around).
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (suggestions.length > 0) {
          setSelectedIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else {
          const prev = historyIdx - 1;
          if (prev >= 0) {
            setHistoryIdx(prev);
            setInput(history[prev]);
          } else if (historyIdx === 0) {
            setHistoryIdx(-1);
            setInput("");
          } else {
            // First up press — go to most recent history item.
            if (history.length > 0) {
              setHistoryIdx(0);
              setInput(history[0]);
            }
          }
        }
        return;
      }

      // Tab — brings selected suggestion into input field without executing (Google autocomplete style)
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        const pick = suggestions[selectedIdx >= 0 ? selectedIdx : 0];
        if (pick) {
          const filled = pick.args ? `${pick.name} ` : pick.name;
          setInput(filled);
          setSuggestions([]);
          setSelectedIdx(-1);
        }
        return;
      }

      // Enter with a highlighted suggestion — directly runs the command immediately!
      if (e.key === "Enter" && selectedIdx >= 0) {
        e.preventDefault();
        const pick = suggestions[selectedIdx];
        if (pick) {
          executeCommand(pick.name);
        }
        return;
      }
    }

    function pickSuggestion(def: CommandDef) {
      if (def.args) {
        setInput(`${def.name} `);
        setSuggestions([]);
        setSelectedIdx(-1);
        (ref as React.RefObject<HTMLInputElement>)?.current?.focus();
      } else {
        executeCommand(def.name);
      }
    }

    return (
      <div className="command-bar-wrap">
        <form className="command-bar" onSubmit={submit} role="search">
          <label className="command-prompt" htmlFor="terminal-command">
            CMD
          </label>
          <input
            id="terminal-command"
            ref={ref}
            value={input}
            onChange={(e) => { setInput(e.target.value); setHistoryIdx(-1); }}
            onKeyDown={handleKeyDown}
            placeholder="EDGAR, STOCK, NEWS, ECON, WEI, FX, YIELD, FNG, HELP"
            spellCheck={false}
            autoComplete="off"
            aria-label="Terminal command"
            aria-autocomplete="list"
            aria-expanded={suggestions.length > 0}
            aria-controls="cmd-suggestions"
          />
          <button type="submit" aria-label="Run command">
            GO
          </button>
        </form>

        {/* Autocomplete dropdown */}
        {suggestions.length > 0 && (
          <ul className="cmd-suggestions" id="cmd-suggestions" ref={suggestRef} role="listbox">
            {suggestions.map((def, i) => (
              <li
                key={def.name}
                role="option"
                aria-selected={i === selectedIdx}
                className={`cmd-suggestion-item${i === selectedIdx ? " cmd-suggestion-selected" : ""}`}
                onMouseDown={(e) => { e.preventDefault(); pickSuggestion(def); }}
              >
                <span className="cmd-suggestion-name">
                  {def.name}
                  {def.args && <span className="cmd-suggestion-args"> {def.args}</span>}
                </span>
                <span className="cmd-suggestion-desc">{def.description}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);

export default CommandBar;
