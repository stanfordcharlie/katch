import { bandForScore } from "@/lib/katch-constants";

export function ScoreBadge({ score }: { score: number }) {
  const band = bandForScore(score);
  const badgeStyles =
    band.id === "cold" ? "bg-slate-100 text-slate-500 border-slate-200"
    : band.id === "warm" ? "bg-amber-50 text-amber-700 border-amber-200"
    : band.id === "hot" ? "bg-orange-50 text-orange-700 border-orange-200"
    : "bg-red-50 text-red-700 border-red-200";
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${badgeStyles}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${band.dot}`} />
      {band.id === "fire" ? "🔥 " : ""}{band.label}
    </span>
  );
}

export function Avatar({ name, size = "sm" }: { name: string; size?: string }) {
  const initials = name ? name.split(" ").slice(0, 2).map((n) => n[0]).join("") : "?";
  return (
    <div className={`${size === "lg" ? "w-10 h-10 text-sm" : "w-8 h-8 text-xs"} rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-semibold flex-shrink-0`}>
      {initials}
    </div>
  );
}

export function MiniBar({ value, max, color = "bg-slate-800" }: { value: number; max: number; color?: string }) {
  return (
    <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: max > 0 ? `${(value / max) * 100}%` : "0%" }} />
    </div>
  );
}
