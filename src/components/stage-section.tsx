"use client";

import Image from "next/image";
import { KeyboardEvent, useMemo, useState } from "react";

type StageStatus =
  | "draft"
  | "scheduled"
  | "postponed"
  | "completed"
  | "cancelled";

type Stage = {
  id: string;
  round_number: number;
  name: string;
  city: string | null;
  stage_date: string;
  status: StageStatus;
  tracks?: {
    name: string;
    google_maps_url: string | null;
    website_url?: string | null;
  } | null;
};

type StageResult = {
  id: string;
  stage_id: string;
  finish_position: number;
  pole_position: boolean;
  fastest_lap: boolean;
  total_points: number;
  full_name: string;
  kart_number: number | null;
  team_name: string;
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusLabel(status: StageStatus) {
  switch (status) {
    case "scheduled":
      return "Agendada";
    case "postponed":
      return "Adiada";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    default:
      return "Rascunho";
  }
}

function getStatusClass(status: StageStatus) {
  switch (status) {
    case "scheduled":
      return "border-orange-400/20 bg-orange-500/10 text-orange-300";
    case "postponed":
      return "border-amber-400/30 bg-amber-500/15 text-amber-200";
    case "completed":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
    case "cancelled":
      return "border-red-400/30 bg-red-500/15 text-red-200";
    default:
      return "border-slate-400/20 bg-slate-500/10 text-slate-300";
  }
}

function normalizeStageText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getStageArtwork(stage: Stage) {
  const haystack = `${normalizeStageText(stage.name)} ${normalizeStageText(stage.city)}`;

  if (haystack.includes("braga")) return "/stages/braga.svg";
  if (haystack.includes("baltar")) return "/stages/baltar.svg";
  if (haystack.includes("cabo") || haystack.includes("matosinhos")) {
    return "/stages/cabo-do-mundo.svg";
  }
  if (haystack.includes("viana")) return "/stages/viana.svg";

  const fallback = [
    "/stages/braga.svg",
    "/stages/baltar.svg",
    "/stages/cabo-do-mundo.svg",
    "/stages/viana.svg",
  ];

  return fallback[(stage.round_number - 1) % fallback.length];
}

function getMapsLink(stage: Stage) {
  const dbLink = stage.tracks?.google_maps_url;
  if (dbLink) return dbLink;

  const query = encodeURIComponent(stage.name);
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function StageSection({
  stages,
  stageResults,
}: {
  stages: Stage[];
  stageResults: StageResult[];
}) {
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  const resultsByStage = useMemo(() => {
    const grouped = new Map<string, StageResult[]>();

    for (const result of stageResults) {
      const current = grouped.get(result.stage_id) ?? [];
      current.push(result);
      grouped.set(result.stage_id, current);
    }

    for (const [stageId, results] of grouped) {
      grouped.set(
        stageId,
        [...results].sort((a, b) => a.finish_position - b.finish_position)
      );
    }

    return grouped;
  }, [stageResults]);

  const selectedStage = stages.find((stage) => stage.id === selectedStageId) ?? null;
  const selectedResults = selectedStage
    ? resultsByStage.get(selectedStage.id) ?? []
    : [];

  function openStage(stageId: string) {
    setSelectedStageId(stageId);
  }

  function handleCardKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    stageId: string
  ) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openStage(stageId);
    }
  }

  return (
    <>
      <section id="etapas" className="mx-auto max-w-7xl px-6 py-16 md:px-10">
        <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
              Calendário
            </p>
            <h2 className="mt-2 text-3xl font-black md:text-4xl">
              Etapas do campeonato
            </h2>
          </div>
          <p className="max-w-2xl text-slate-400">
            As etapas são carregadas diretamente do Supabase e refletem o estado
            real do campeonato.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {stages.map((stage) => (
            <div
              key={stage.id}
              role="button"
              tabIndex={0}
              onClick={() => openStage(stage.id)}
              onKeyDown={(event) => handleCardKeyDown(event, stage.id)}
              className="overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-white/10 to-white/5 p-5 transition hover:-translate-y-1 hover:border-orange-400/40 focus:outline-none focus:ring-2 focus:ring-orange-400/60"
            >
              <div className="mb-5 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 text-lg font-black text-white">
                  {stage.round_number}
                </div>
                <span
                  className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                    stage.status
                  )}`}
                >
                  {getStatusLabel(stage.status)}
                </span>
              </div>

              <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/10">
                <Image
                  src={getStageArtwork(stage)}
                  alt={stage.name}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 25vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                <div className="absolute left-4 top-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-xs font-semibold text-slate-100 backdrop-blur">
                  {stage.city || "Circuito"}
                </div>
              </div>

              <h3 className="mt-5 text-xl font-bold leading-tight">
                {stage.name}
              </h3>
              <p className="mt-2 text-sm text-slate-400">{stage.city || "—"}</p>
              <p className="mt-1 text-sm text-slate-500">
                {formatDate(stage.stage_date)}
              </p>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    openStage(stage.id);
                  }}
                  className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
                >
                  Ver classificação
                </button>
                <a
                  href={getMapsLink(stage)}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Direções
                </a>
                {stage.tracks?.website_url && (
                  <a
                    href={stage.tracks.website_url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-white/10 bg-slate-900 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
                  Classificação da etapa
                </p>
                <h3 className="mt-2 text-2xl font-black text-white">
                  Etapa {selectedStage.round_number} · {selectedStage.name}
                </h3>
                <p className="mt-2 text-sm text-slate-400">
                  {selectedStage.city || "—"} · {formatDate(selectedStage.stage_date)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStageId(null)}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Fechar
              </button>
            </div>

            {selectedResults.length === 0 ? (
              <div className="px-6 py-10 text-slate-300">
                Ainda não existem resultados registados para esta etapa.
              </div>
            ) : (
              <div className="max-h-[70vh] overflow-auto">
                <div className="grid grid-cols-12 border-b border-white/10 bg-white/5 px-6 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  <div className="col-span-2 md:col-span-1">Pos.</div>
                  <div className="col-span-6 md:col-span-5">Piloto</div>
                  <div className="hidden md:col-span-2 md:block">Kart</div>
                  <div className="col-span-4 md:col-span-2">Extras</div>
                  <div className="col-span-4 text-right md:col-span-2">Pontos</div>
                </div>

                {selectedResults.map((result) => (
                  <div
                    key={result.id}
                    className="grid grid-cols-12 items-center border-b border-white/5 px-6 py-4 text-sm text-white last:border-b-0"
                  >
                    <div className="col-span-2 md:col-span-1">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/5 font-black text-orange-300">
                        {result.finish_position}
                      </span>
                    </div>
                    <div className="col-span-6 md:col-span-5">
                      <div className="font-semibold">{result.full_name}</div>
                      <div className="text-xs text-slate-400">{result.team_name}</div>
                    </div>
                    <div className="hidden text-slate-300 md:col-span-2 md:block">
                      #{result.kart_number ?? "—"}
                    </div>
                    <div className="col-span-4 md:col-span-2">
                      <div className="flex flex-wrap gap-2">
                        {result.pole_position && (
                          <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200">
                            Pole
                          </span>
                        )}
                        {result.fastest_lap && (
                          <span className="rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-2 py-1 text-[11px] font-semibold text-fuchsia-200">
                            Volta rápida
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="col-span-4 text-right text-lg font-black text-orange-300 md:col-span-2">
                      {result.total_points}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
