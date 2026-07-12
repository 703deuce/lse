"use client";

import { Circle, Tooltip } from "react-leaflet";
import { formatRingMilesLabel } from "@/lib/maps/grid-metrics";

const METERS_PER_MILE = 1609.344;

export function RadiusRingsLayer({
  center,
  ringsMiles,
  visible = true,
}: {
  center: [number, number];
  ringsMiles: number[];
  visible?: boolean;
}) {
  if (!visible || ringsMiles.length === 0) return null;

  return (
    <>
      {ringsMiles.map((miles, index) => {
        const isOuter = index === ringsMiles.length - 1;
        return (
          <Circle
            key={`${miles}-${index}`}
            center={center}
            radius={miles * METERS_PER_MILE}
            pathOptions={{
              color: "#2563eb",
              weight: isOuter ? 2 : 1.5,
              opacity: isOuter ? 0.7 : 0.55 - index * 0.05,
              fillOpacity: 0.03,
              dashArray: isOuter ? undefined : "6 4",
            }}
          >
            <Tooltip permanent direction="right" offset={[8, 0]} className="radius-ring-label">
              {formatRingMilesLabel(miles)}
              {isOuter ? " · edge pins" : ""}
            </Tooltip>
          </Circle>
        );
      })}
    </>
  );
}
