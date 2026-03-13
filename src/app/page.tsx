import Image from "next/image";
import { StageSection } from "@/components/stage-section";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

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

type Standing = {
  pilot_id: string;
  full_name: string;
  kart_number: number | null;
  team_name: string;
  total_points: number;
  wins: number;
  podiums: number;
  standing_position: number;
};

type Pilot = {
  id: string;
  full_name: string;
  kart_number: number | null;
  team_name: string;
};

type StageResultRow = {
  id: string;
  stage_id: string;
  pilot_id: string;
  finish_position: number;
  pole_position: boolean;
  fastest_lap: boolean;
  total_points: number;
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

export default async function Page() {
  const championshipSlug = process.env.NEXT_PUBLIC_CHAMPIONSHIP_SLUG;

  const { data: championship, error: championshipError } = await supabase
    .from("championships")
    .select("id, name, description")
    .eq("slug", championshipSlug)
    .single();

  if (championshipError || !championship) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-red-500/10 p-8">
          <h1 className="text-3xl font-black">Erro a carregar campeonato</h1>
          <p className="mt-3 text-slate-300">
            Verifica o slug do campeonato e as variáveis do Supabase.
          </p>
        </div>
      </main>
    );
  }

  const [{ data: stages }, { data: standings }, { data: pilots }, { data: results }] =
    await Promise.all([
    supabase
      .from("stages")
      .select(`
        id,
        round_number,
        name,
        city,
        stage_date,
        status,
        tracks (
          name,
          google_maps_url,
          website_url
        )
      `)
      .eq("championship_id", championship.id)
      .eq("is_public", true)
      .order("round_number", { ascending: true }),
    supabase
      .from("championship_standings")
      .select(
        "pilot_id, full_name, kart_number, team_name, total_points, wins, podiums, standing_position"
      )
      .eq("championship_id", championship.id)
      .order("standing_position", { ascending: true }),
    supabase
      .from("pilots")
      .select("id, full_name, kart_number, team_name")
      .eq("championship_id", championship.id),
    supabase
      .from("results")
      .select(
        "id, stage_id, pilot_id, finish_position, pole_position, fastest_lap, total_points"
      )
      .order("finish_position", { ascending: true }),
  ]);

  const typedStages: Stage[] = (stages ?? []) as unknown as Stage[];
  const typedStandings: Standing[] = (standings ?? []) as Standing[];
  const typedPilots: Pilot[] = (pilots ?? []) as Pilot[];
  const typedResults: StageResultRow[] = (results ?? []) as StageResultRow[];

  const pilotMap = new Map(typedPilots.map((pilot) => [pilot.id, pilot]));
  const stageResults = typedResults
    .map((result) => {
      const pilot = pilotMap.get(result.pilot_id);
      if (!pilot) return null;

      return {
        id: result.id,
        stage_id: result.stage_id,
        finish_position: result.finish_position,
        pole_position: result.pole_position,
        fastest_lap: result.fastest_lap,
        total_points: result.total_points,
        full_name: pilot.full_name,
        kart_number: pilot.kart_number,
        team_name: pilot.team_name,
      };
    })
    .filter((result) => result !== null);

  const nextStage =
    typedStages.find((stage) => stage.status === "scheduled") ??
    typedStages.find((stage) => stage.status === "postponed") ??
    typedStages[0];

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.2),_transparent_38%),linear-gradient(135deg,rgba(15,23,42,0.92),rgba(15,23,42,0.72))]" />
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-orange-500 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-16 md:px-10 md:py-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1 text-sm font-medium text-orange-300">
                1.º Campeonato de Karting · CMS Edition
              </div>

              <h1 className="max-w-4xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
                {championship.name}
              </h1>

              <p className="mt-5 max-w-2xl text-base text-slate-300 md:text-lg">
                {championship.description ||
                  "Acompanha etapas, classificação geral e evolução do campeonato em tempo real."}
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="#classificacao"
                  className="rounded-2xl bg-orange-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.02]"
                >
                  Ver classificação
                </a>
                <a
                  href="#etapas"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Ver etapas
                </a>
                <a
                  href="/admin"
                  className="rounded-2xl border border-orange-400/30 bg-orange-500/10 px-6 py-3 text-sm font-semibold text-orange-300 transition hover:bg-orange-500/20"
                >
                  Admin Dashboard
                </a>
              </div>

              <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-2xl font-black text-orange-400">
                    {typedStages.length}
                  </div>
                  <div className="text-sm text-slate-300">Etapas</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-2xl font-black text-orange-400">
                    {typedStandings.length}
                  </div>
                  <div className="text-sm text-slate-300">Pilotos</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-2xl font-black text-orange-400">25</div>
                  <div className="text-sm text-slate-300">Pontos vitória</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                  <div className="text-2xl font-black text-orange-400">CMS</div>
                  <div className="text-sm text-slate-300">Edition</div>
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
              {nextStage && (
                <div className="absolute inset-x-5 top-5 h-40 overflow-hidden rounded-3xl border border-white/10">
                  <Image
                    src={getStageArtwork(nextStage)}
                    alt={nextStage.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover opacity-55"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-slate-950/10" />
                </div>
              )}

              {nextStage ? (
                <>
                  <div className="relative mb-5 mt-36 flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
                        Próxima etapa
                      </p>
                      <h2 className="mt-2 text-3xl font-black">
                        Etapa {nextStage.round_number}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-sm font-semibold ${getStatusClass(
                        nextStage.status
                      )}`}
                    >
                      {getStatusLabel(nextStage.status)}
                    </span>
                  </div>

                  <div className="rounded-3xl bg-gradient-to-r from-orange-500 to-orange-400 p-[1px]">
                    <div className="rounded-3xl bg-slate-950 p-6">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-sm text-slate-400">Circuito</p>
                          <p className="mt-1 text-lg font-semibold">
                            {nextStage.name}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Cidade</p>
                          <p className="mt-1 text-lg font-semibold">
                            {nextStage.city || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Data</p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatDate(nextStage.stage_date)}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-400">Formato</p>
                          <p className="mt-1 text-lg font-semibold">
                            Qualificação + Corrida
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap gap-3">
                        <a
                          href={getMapsLink(nextStage)}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:scale-[1.02]"
                        >
                          Ver direções
                        </a>

                        {nextStage.tracks?.website_url && (
                          <a
                            href={nextStage.tracks.website_url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
                          >
                            Website
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-white/10 bg-slate-950 p-6 text-slate-300">
                  Ainda não existem etapas configuradas.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <StageSection
        stages={typedStages}
        stageResults={stageResults}
      />

      <section
        id="classificacao"
        className="border-y border-white/10 bg-white/5"
      >
        <div className="mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
                Standings
              </p>
              <h2 className="mt-2 text-3xl font-black md:text-4xl">
                Classificação geral
              </h2>
            </div>
            <p className="max-w-2xl text-slate-400">
              Ranking automático com base nos resultados registados no Supabase.
            </p>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl">
            <div className="grid grid-cols-12 border-b border-white/10 bg-white/5 px-6 py-4 text-sm font-semibold text-slate-300">
              <div className="col-span-2 md:col-span-1">Pos.</div>
              <div className="col-span-5 md:col-span-4">Piloto</div>
              <div className="hidden md:col-span-2 md:block">N.º</div>
              <div className="hidden md:col-span-2 md:block">Vitórias</div>
              <div className="hidden md:col-span-1 md:block">Pódios</div>
              <div className="col-span-5 text-right md:col-span-2">Pontos</div>
            </div>

            {typedStandings.map((row, index) => (
              <div
                key={row.pilot_id}
                className="grid grid-cols-12 items-center border-b border-white/5 px-6 py-4 text-sm last:border-b-0"
              >
                <div className="col-span-2 font-bold text-white md:col-span-1">
                  <span
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
                      index === 0
                        ? "bg-yellow-500/20 text-yellow-300"
                        : index === 1
                        ? "bg-slate-300/20 text-slate-200"
                        : index === 2
                        ? "bg-orange-700/20 text-orange-300"
                        : "bg-white/5 text-slate-300"
                    }`}
                  >
                    {row.standing_position}
                  </span>
                </div>

                <div className="col-span-5 md:col-span-4">
                  <div className="font-semibold">{row.full_name}</div>
                  <div className="text-xs text-slate-400 md:hidden">
                    {row.team_name}
                  </div>
                </div>

                <div className="hidden text-slate-300 md:col-span-2 md:block">
                  #{row.kart_number ?? "—"}
                </div>
                <div className="hidden text-slate-300 md:col-span-2 md:block">
                  {row.wins}
                </div>
                <div className="hidden text-slate-300 md:col-span-1 md:block">
                  {row.podiums}
                </div>
                <div className="col-span-5 text-right text-lg font-black text-orange-300 md:col-span-2">
                  {row.total_points}
                </div>
              </div>
            ))}

            {typedStandings.length === 0 && (
              <div className="px-6 py-10 text-slate-400">
                Ainda não existem resultados suficientes para mostrar a
                classificação.
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
