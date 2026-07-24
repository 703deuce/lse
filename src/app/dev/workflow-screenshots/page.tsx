"use client";

import Link from "next/link";

const SCREENS = [
  { href: "/dev/workflow-overview-reputation", label: "1. Reputation Overview" },
  { href: "/dev/workflow-overview-combined", label: "2. Combined Overview" },
  { href: "/dev/workflow-local-visibility", label: "3. Local Visibility Bridge" },
  { href: "/dev/workflow-maps-setup", label: "4. Maps Setup Wizard" },
  { href: "/dev/workflow-maps-overview", label: "5. Maps Overview" },
  { href: "/dev/workflow-reputation-setup", label: "6. Reputation Setup Wizard" },
] as const;

export default function WorkflowScreenshotsIndex() {
  return (
    <div className="mx-auto max-w-lg space-y-3 px-6 py-12">
      <h1 className="text-xl font-bold text-[#101828]">Workflow screen previews</h1>
      <ul className="space-y-2">
        {SCREENS.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="text-[#137752] font-semibold hover:underline">
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
