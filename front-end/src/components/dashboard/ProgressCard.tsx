import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Activity } from "lucide-react";
import type { BodyLogResponse } from "@/lib/types";

interface ProgressCardProps {
  logs: BodyLogResponse[] | undefined;
}

function bodyFatOf(log: BodyLogResponse): number | null | undefined {
  return log.calculated_body_fat_percent ?? log.bio_body_fat_percent;
}

function formatDelta(value: number, suffix: string, isPositiveGood = true): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)} ${suffix}`;
}

export function ProgressCard({ logs }: ProgressCardProps) {
  if (!logs || logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Progresso</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Registre seu peso na aba Registro Corporal para ver seu progresso.
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = logs[0];
  const previous = logs[1];
  const oldest = logs[logs.length - 1];

  const weightDelta = previous ? latest.weight_kg - previous.weight_kg : null;
  const daysBetween = previous
    ? Math.max((new Date(latest.date).getTime() - new Date(previous.date).getTime()) / 86400000, 1)
    : null;
  const weeklyRate = weightDelta !== null && daysBetween !== null ? (weightDelta / daysBetween) * 7 : null;
  const monthlyProjection = weeklyRate !== null ? weeklyRate * 4 : null;
  const totalDelta = latest.weight_kg - oldest.weight_kg;

  const latestBf = bodyFatOf(latest);
  const previousBf = previous ? bodyFatOf(previous) : null;
  const bfDelta = latestBf != null && previousBf != null ? latestBf - previousBf : null;

  const latestMuscle = latest.bio_muscle_mass_kg;
  const previousMuscle = previous?.bio_muscle_mass_kg ?? null;
  const muscleDelta = latestMuscle != null && previousMuscle != null ? latestMuscle - previousMuscle : null;

  const rateIsPositive = weeklyRate !== null && weeklyRate >= 0;
  const RateIcon = rateIsPositive ? TrendingUp : TrendingDown;

  const stat = (label: string, value: string, sub?: string) => (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums mt-0.5">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          Progresso
        </CardTitle>
        {weeklyRate !== null && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <RateIcon className={`h-4 w-4 ${rateIsPositive ? "text-emerald-500" : "text-red-500"}`} />
            {formatDelta(weeklyRate, "kg/semana")}
          </span>
        )}
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 grid-cols-2 sm:grid-cols-4">
          {stat("Peso atual", `${latest.weight_kg.toFixed(1)} kg`)}
          {stat(
            "Variação semanal",
            weeklyRate !== null ? formatDelta(weeklyRate, "kg/semana") : "—",
            previous ? `vs registro de ${previous.date}` : "Aguardando 2º registro"
          )}
          {stat(
            "Projeção mensal",
            monthlyProjection !== null ? formatDelta(monthlyProjection, "kg/mês") : "—"
          )}
          {stat("Variação total", formatDelta(totalDelta, "kg"))}
        </div>
        {(bfDelta !== null || muscleDelta !== null) && (
          <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 mt-2">
            {bfDelta !== null && stat("Gordura (último registro)", formatDelta(bfDelta, "pp"))}
            {muscleDelta !== null && stat("Massa muscular", formatDelta(muscleDelta, "kg"))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
