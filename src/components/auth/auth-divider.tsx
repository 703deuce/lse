export function AuthDivider({ label = "or continue with" }: { label?: string }) {
  return (
    <div className="my-5 flex items-center gap-3" role="separator" aria-label={label}>
      <div className="h-px flex-1 bg-zinc-200" />
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-zinc-400">
        {label}
      </span>
      <div className="h-px flex-1 bg-zinc-200" />
    </div>
  );
}
