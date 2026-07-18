"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";

type Result = { type: string; id: string; label: string; href: string };

export function WorkspaceSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      void fetch(`/api/workspace/search?q=${encodeURIComponent(q.trim())}`)
        .then((r) => r.json())
        .then((j) => setResults(j.results ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="relative w-full max-w-sm">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5">
        <Search className="h-3.5 w-3.5 text-zinc-400" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search clients, prospects, keywords…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
        />
      </div>
      {open && results.length > 0 ? (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {results.map((r) => (
            <li key={`${r.type}-${r.id}`}>
              <Link
                href={r.href}
                className="flex items-center justify-between px-3 py-2 text-sm hover:bg-zinc-50"
                onClick={() => {
                  setOpen(false);
                  setQ("");
                }}
              >
                <span className="truncate font-medium text-zinc-900">{r.label}</span>
                <span className="ml-2 shrink-0 text-[10px] uppercase text-zinc-400">{r.type}</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
