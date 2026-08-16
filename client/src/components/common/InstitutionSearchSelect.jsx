import {
  Building2,
  ChevronDown,
  Search,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  INSTITUTION_CATEGORY_LABELS,
  INSTITUTION_SECTOR_LABELS,
} from "../../data/institutionCatalog";
import { OTHER_VALUE } from "../../data/learningCatalog";

function InstitutionSearchSelect({
  institutions,
  value,
  onChange,
  placeholder,
  disabled = false,
  hasError = false,
}) {
  const rootRef = useRef(null);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedInstitution = useMemo(
    () =>
      institutions.find(
        (item) => item.id === value,
      ) || null,
    [institutions, value],
  );

  const selectedLabel =
    value === OTHER_VALUE
      ? "Other / Not listed"
      : selectedInstitution?.name || "";

  useEffect(() => {
    setQuery(selectedLabel);
  }, [selectedLabel]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (
        rootRef.current &&
        !rootRef.current.contains(event.target)
      ) {
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

  const filtered = useMemo(() => {
    const q = query
      .trim()
      .toLowerCase();

    if (!q) {
      return institutions.slice(0, 80);
    }

    return institutions
      .filter((item) => {
        const category =
          INSTITUTION_CATEGORY_LABELS[
            item.category
          ] || item.category;

        return (
          item.name
            .toLowerCase()
            .includes(q) ||
          category
            .toLowerCase()
            .includes(q)
        );
      })
      .slice(0, 80);
  }, [institutions, query]);

  const choose = (nextValue) => {
    onChange(nextValue);
    setIsOpen(false);

    if (nextValue === OTHER_VALUE) {
      setQuery("Other / Not listed");
      return;
    }

    const next = institutions.find(
      (item) => item.id === nextValue,
    );

    setQuery(next?.name || "");
  };

  const handleInputChange = (event) => {
    setQuery(event.target.value);

    if (value) {
      onChange("");
    }

    setIsOpen(true);
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
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              setQuery(selectedLabel);
            }

            if (
              event.key === "Enter" &&
              isOpen &&
              filtered.length > 0
            ) {
              event.preventDefault();
              choose(filtered[0].id);
            }
          }}
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
          aria-label="Toggle institution options"
        >
          <ChevronDown size={17} />
        </button>
      </div>

      {isOpen && !disabled && (
        <div
          role="listbox"
          className="absolute z-40 mt-2 max-h-72 w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl"
        >
          {filtered.length === 0 && (
            <p className="px-3 py-3 text-sm text-slate-500">
              No matching institution found. Use
              “Other / Not listed” below.
            </p>
          )}

          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={
                value === item.id
              }
              onClick={() =>
                choose(item.id)
              }
              className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                value === item.id
                  ? "bg-brand-50 text-brand-800"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Building2
                size={17}
                className="mt-0.5 shrink-0 text-slate-400"
              />

              <span className="min-w-0">
                <span className="block text-sm font-semibold">
                  {item.name}
                </span>

                <span className="mt-0.5 block text-xs text-slate-500">
                  {item.sector
                    ? `${INSTITUTION_SECTOR_LABELS[item.sector] || item.sector} · `
                    : ""}
                  {INSTITUTION_CATEGORY_LABELS[
                    item.category
                  ] || item.category}
                  {" · "}
                  {item.state}
                </span>
              </span>
            </button>
          ))}

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
        </div>
      )}
    </div>
  );
}

export default InstitutionSearchSelect;