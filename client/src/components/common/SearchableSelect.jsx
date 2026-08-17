import {
  ChevronDown,
  Search,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { OTHER_VALUE } from "../../data/learningCatalog";
import FloatingSelectMenu from "./FloatingSelectMenu";

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  allowOther = true,
  id,
  hasError = false,
}) {
  const rootRef = useRef(null);
  const menuRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedLabel =
    value === OTHER_VALUE ? "Other" : value || "";

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickedAnchor =
        rootRef.current?.contains(event.target);
      const clickedMenu =
        menuRef.current?.contains(event.target);

      if (!clickedAnchor && !clickedMenu) {
        setIsOpen(false);
        setQuery(selectedLabel);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, [selectedLabel]);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query
      .trim()
      .toLowerCase();

    if (!normalizedQuery) {
      return options.slice(0, 80);
    }

    return options
      .filter((option) =>
        option
          .toLowerCase()
          .includes(normalizedQuery),
      )
      .slice(0, 80);
  }, [options, query]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);

    setQuery(
      nextValue === OTHER_VALUE
        ? "Other"
        : nextValue,
    );
  };

  const handleInputChange = (event) => {
    setQuery(event.target.value);

    if (value) {
      onChange("");
    }

    setIsOpen(true);
  };

  const handleKeyDown = (event) => {
    if (
      event.key === "Enter" &&
      isOpen
    ) {
      event.preventDefault();

      if (filteredOptions.length > 0) {
        choose(filteredOptions[0]);
      } else if (allowOther) {
        choose(OTHER_VALUE);
      }
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery(selectedLabel);
    }
  };

  return (
    <div
      ref={rootRef}
      className="relative"
    >
      <div className="relative">
        <Search
          size={17}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
        />

        <input
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          autoComplete="off"
          placeholder={placeholder}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-invalid={hasError}
          onFocus={() =>
            !disabled && setIsOpen(true)
          }
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-xl border bg-white py-3 pl-11 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
            hasError
              ? "border-rose-400 focus:border-rose-500 focus:ring-4 focus:ring-rose-100"
              : "border-slate-200 focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
          } disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() =>
            setIsOpen((current) => !current)
          }
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 disabled:cursor-not-allowed"
          aria-label="Toggle options"
        >
          <ChevronDown size={17} />
        </button>
      </div>

      {isOpen && !disabled && (
        <FloatingSelectMenu
          anchorRef={rootRef}
          panelRef={menuRef}
          maxHeight={256}
        >
          <div role="listbox">
            {filteredOptions.length === 0 &&
              !allowOther && (
                <p className="px-3 py-3 text-sm text-slate-500">
                  No matching options.
                </p>
              )}

            {filteredOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="option"
                aria-selected={value === option}
                onClick={() => choose(option)}
                className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                  value === option
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {option}
              </button>
            ))}

            {allowOther && (
              <>
                <div className="my-1.5 h-px bg-slate-100" />

                <button
                  type="button"
                  role="option"
                  aria-selected={
                    value === OTHER_VALUE
                  }
                  onClick={() =>
                    choose(OTHER_VALUE)
                  }
                  className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                    value === OTHER_VALUE
                      ? "bg-brand-50 font-semibold text-brand-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  Other / Not listed
                </button>
              </>
            )}
          </div>
        </FloatingSelectMenu>
      )}
    </div>
  );
}

export default SearchableSelect;
