"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import type { ReviewRequestsSection } from "@/components/reputation/review-requests-sub-tabs";
import {
  ReviewRequestsSubTabsBar,
  ReviewRequestsTopBar,
} from "@/components/reputation/review-requests-ui";
import { ModulePage, ModuleHeader } from "@/components/ui/design-system";

const VALID_SECTIONS: ReviewRequestsSection[] = ["poster", "messages", "send", "bulk", "tracking"];

function parseSection(value: string | null): ReviewRequestsSection {
  if (value && VALID_SECTIONS.includes(value as ReviewRequestsSection)) {
    return value as ReviewRequestsSection;
  }
  return "poster";
}

export function ReviewRequestsDashboard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [section, setSection] = useState<ReviewRequestsSection>(() =>
    parseSection(searchParams.get("tab"))
  );

  useEffect(() => {
    setSection(parseSection(searchParams.get("tab")));
  }, [searchParams]);

  const handleSectionChange = useCallback(
    (next: ReviewRequestsSection) => {
      setSection(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/businesses/${businessId}/review-requests?${params.toString()}`, {
        scroll: false,
      });
    },
    [businessId, router, searchParams]
  );

  return (
    <ModulePage>
      <ModuleHeader
        title="Review Requests"
        subtitle="Manage your review links, templates, sending, and tracking in one place."
        actions={<ReviewRequestsTopBar />}
      />

      <ReviewRequestsSubTabsBar active={section} onChange={handleSectionChange} />

      <ReviewRequestsPanel businessId={businessId} section={section} hideSubTabs />
    </ModulePage>
  );
}
