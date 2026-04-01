"use client";

import { useParams } from "next/navigation";
import { DashboardView } from "../DashboardView";

export default function EventDashboardPage() {
  const params = useParams();
  const raw = params.eventId;
  const eventId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";
  if (!eventId) {
    return null;
  }
  return <DashboardView mode="event" eventId={eventId} />;
}
