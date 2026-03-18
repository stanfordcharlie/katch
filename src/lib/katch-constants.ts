export const NOTE_CHECKS = [
  { id: "demo", label: "Wants a demo" },
  { id: "budget", label: "Budget approved" },
  { id: "timeline", label: "Active buying timeline" },
  { id: "followup", label: "They asked me to follow up" },
];

export const DEFAULT_SIGNAL_LABELS = NOTE_CHECKS.map((c) => c.label);

export const DEFAULT_VISIBLE_FIELDS = [
  "email",
  "phone",
  "linkedin",
  "company",
  "title",
  "event",
  "lead_score",
  "notes",
] as const;

export const VISIBLE_FIELD_LABELS: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  linkedin: "LinkedIn",
  company: "Company",
  title: "Title",
  event: "Event",
  lead_score: "Lead Score",
  notes: "Notes",
};

export const SCORE_BANDS = [
  { id: "cold", label: "Cold", min: 1, max: 3, dot: "bg-slate-400", bar: "bg-slate-300" },
  { id: "warm", label: "Warm", min: 4, max: 5, dot: "bg-amber-400", bar: "bg-amber-400" },
  { id: "hot", label: "Hot", min: 6, max: 8, dot: "bg-orange-500", bar: "bg-orange-500" },
  { id: "fire", label: "Fire", min: 9, max: 10, dot: "bg-red-500", bar: "bg-red-500" },
];

export const bandForScore = (score: number) =>
  SCORE_BANDS.find((b) => score >= b.min && score <= b.max) || SCORE_BANDS[0];

export const EVENT_TYPES = ["Conference", "Trade Show", "Meetup", "Summit", "Workshop", "Networking", "Webinar", "Other"];

export const MOCK_SEQUENCE = [
  { subject: "Great meeting you", body: `Hi [Name],\n\nReally enjoyed our conversation. What you shared stuck with me.\n\nNo ask here, just wanted to say it was a genuine highlight of the day.\n\nTalk soon,\n[Your name]`, day: "Day 1-2", intent: "Pure warmth, no ask" },
  { subject: "The resource I mentioned", body: `Hey [Name],\n\nFollowing up on what I promised. Wanted to get this over before it slips.\n\nLet me know if any of it resonates.\n\n[Your name]`, day: "Day 5-7", intent: "Value delivery" },
  { subject: "Worth a quick call?", body: `Hi [Name],\n\nI've been thinking about what you mentioned. Would it make sense to spend 20 minutes on a call?\n\nHappy to work around your schedule.\n\n[Your name]`, day: "Day 14", intent: "Soft CTA" },
];
