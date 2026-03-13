"use client";

export const dynamic = "force-dynamic";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Championship = {
  id: string;
  name: string;
  slug: string;
};

type Pilot = {
  id: string;
  full_name: string;
  kart_number: number | null;
  team_name: string;
  is_active: boolean;
};

type Stage = {
  id: string;
  round_number: number;
  name: string;
  city: string | null;
  stage_date: string;
  check_in_time: string | null;
  briefing_time: string | null;
  race_time: string | null;
  status: "draft" | "scheduled" | "completed" | "cancelled";
};

type ResultRow = {
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
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getStatusLabel(status: Stage["status"]) {
  switch (status) {
    case "scheduled":
      return "Agendada";
    case "completed":
      return "Concluída";
    case "cancelled":
      return "Cancelada";
    default:
      return "Rascunho";
  }
}

function getStatusClass(status: Stage["status"]) {
  switch (status) {
    case "scheduled":
      return "border-orange-400/20 bg-orange-500/10 text-orange-300";
    case "completed":
      return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300";
    case "cancelled":
      return "border-red-400/20 bg-red-500/10 text-red-300";
    default:
      return "border-slate-400/20 bg-slate-500/10 text-slate-300";
  }
}

export default function AdminPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [championship, setChampionship] = useState<Championship | null>(null);
  const [pilots, setPilots] = useState<Pilot[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [pilotForm, setPilotForm] = useState({
    full_name: "",
    kart_number: "",
    team_name: "CMS",
  });

  const [stageForm, setStageForm] = useState({
    round_number: "",
    name: "",
    city: "",
    stage_date: "",
    check_in_time: "",
    briefing_time: "",
    race_time: "",
    status: "scheduled" as Stage["status"],
  });

  const [resultForm, setResultForm] = useState({
    stage_id: "",
    pilot_id: "",
    finish_position: "",
    pole_position: false,
    fastest_lap: false,
  });

  const championshipSlug =
    process.env.NEXT_PUBLIC_CHAMPIONSHIP_SLUG ?? "cms-karting-championship-2026";

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile || profile.role !== "admin") {
        router.push("/");
        return;
      }

      setIsAdmin(true);
      setAuthChecked(true);
    }

    checkAdmin();
  }, [router]);

  async function loadData() {
    setLoading(true);
    setErrorMessage(null);

    const { data: championshipData, error: championshipError } = await supabase
      .from("championships")
      .select("id, name, slug")
      .eq("slug", championshipSlug)
      .single();

    if (championshipError || !championshipData) {
      setErrorMessage("Não foi possível carregar o campeonato.");
      setLoading(false);
      return;
    }

    setChampionship(championshipData);

    const [
      { data: pilotsData, error: pilotsError },
      { data: stagesData, error: stagesError },
      { data: resultsData, error: resultsError },
    ] = await Promise.all([
      supabase
        .from("pilots")
        .select("id, full_name, kart_number, team_name, is_active")
        .eq("championship_id", championshipData.id)
        .order("full_name", { ascending: true }),
      supabase
        .from("stages")
        .select(
          "id, round_number, name, city, stage_date, check_in_time, briefing_time, race_time, status"
        )
        .eq("championship_id", championshipData.id)
        .order("round_number", { ascending: true }),
      supabase
        .from("results")
        .select(
          "id, stage_id, pilot_id, finish_position, pole_position, fastest_lap, total_points"
        )
        .order("created_at", { ascending: false }),
    ]);

    if (pilotsError || stagesError || resultsError) {
      setErrorMessage("Erro ao carregar pilotos, etapas ou resultados.");
      setLoading(false);
      return;
    }

    setPilots((pilotsData ?? []) as Pilot[]);
    setStages((stagesData ?? []) as Stage[]);
    setResults((resultsData ?? []) as ResultRow[]);
    setLoading(false);
  }

  useEffect(() => {
    if (authChecked && isAdmin) {
      loadData();
    }
  }, [authChecked, isAdmin]);

  const pilotMap = useMemo(() => {
    return new Map(pilots.map((pilot) => [pilot.id, pilot]));
  }, [pilots]);

  const stageMap = useMemo(() => {
    return new Map(stages.map((stage) => [stage.id, stage]));
  }, [stages]);

  async function handleCreatePilot(e: FormEvent) {
    e.preventDefault();
    if (!championship) return;

    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("pilots").insert({
      championship_id: championship.id,
      full_name: pilotForm.full_name.trim(),
      kart_number: pilotForm.kart_number ? Number(pilotForm.kart_number) : null,
      team_name: pilotForm.team_name.trim() || "CMS",
      is_active: true,
    });

    if (error) {
      setErrorMessage(`Erro ao criar piloto: ${error.message}`);
      setSaving(false);
      return;
    }

    setPilotForm({
      full_name: "",
      kart_number: "",
      team_name: "CMS",
    });

    setMessage("Piloto criado com sucesso.");
    await loadData();
    setSaving(false);
  }

  async function handleCreateStage(e: FormEvent) {
    e.preventDefault();
    if (!championship) return;

    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("stages").insert({
      championship_id: championship.id,
      round_number: Number(stageForm.round_number),
      name: stageForm.name.trim(),
      city: stageForm.city.trim() || null,
      stage_date: stageForm.stage_date,
      check_in_time: stageForm.check_in_time || null,
      briefing_time: stageForm.briefing_time || null,
      race_time: stageForm.race_time || null,
      status: stageForm.status,
      is_public: true,
    });

    if (error) {
      setErrorMessage(`Erro ao criar etapa: ${error.message}`);
      setSaving(false);
      return;
    }

    setStageForm({
      round_number: "",
      name: "",
      city: "",
      stage_date: "",
      check_in_time: "",
      briefing_time: "",
      race_time: "",
      status: "scheduled",
    });

    setMessage("Etapa criada com sucesso.");
    await loadData();
    setSaving(false);
  }

  async function handleCreateResult(e: FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("results").insert({
      stage_id: resultForm.stage_id,
      pilot_id: resultForm.pilot_id,
      finish_position: Number(resultForm.finish_position),
      pole_position: resultForm.pole_position,
      fastest_lap: resultForm.fastest_lap,
    });

    if (error) {
      setErrorMessage(`Erro ao lançar resultado: ${error.message}`);
      setSaving(false);
      return;
    }

    setResultForm({
      stage_id: "",
      pilot_id: "",
      finish_position: "",
      pole_position: false,
      fastest_lap: false,
    });

    setMessage("Resultado lançado com sucesso.");
    await loadData();
    setSaving(false);
  }

  async function togglePilotActive(pilot: Pilot) {
    setBusyKey(`pilot-${pilot.id}`);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase
      .from("pilots")
      .update({ is_active: !pilot.is_active })
      .eq("id", pilot.id);

    if (error) {
      setErrorMessage(`Erro ao actualizar piloto: ${error.message}`);
      setBusyKey(null);
      return;
    }

    setMessage(
      pilot.is_active
        ? "Piloto marcado como inactivo."
        : "Piloto marcado como activo."
    );
    await loadData();
    setBusyKey(null);
  }

  async function updateStageStatus(stageId: string, status: Stage["status"]) {
    setBusyKey(`stage-${stageId}`);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase
      .from("stages")
      .update({ status })
      .eq("id", stageId);

    if (error) {
      setErrorMessage(`Erro ao actualizar etapa: ${error.message}`);
      setBusyKey(null);
      return;
    }

    setMessage("Estado da etapa actualizado com sucesso.");
    await loadData();
    setBusyKey(null);
  }

  async function deleteResult(resultId: string) {
    const confirmed = window.confirm(
      "Tens a certeza que queres apagar este resultado?"
    );

    if (!confirmed) return;

    setBusyKey(`result-${resultId}`);
    setMessage(null);
    setErrorMessage(null);

    const { error } = await supabase.from("results").delete().eq("id", resultId);

    if (error) {
      setErrorMessage(`Erro ao apagar resultado: ${error.message}`);
      setBusyKey(null);
      return;
    }

    setMessage("Resultado apagado com sucesso.");
    await loadData();
    setBusyKey(null);
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8">
          A validar permissões...
        </div>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <section className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-orange-500 blur-3xl" />
          <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-blue-500 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-7xl px-6 py-16 md:px-10">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-orange-400/30 bg-orange-500/10 px-4 py-1 text-sm font-medium text-orange-300">
                CMS Karting · Admin Panel
              </div>

              <h1 className="text-4xl font-black tracking-tight md:text-5xl">
                Gestão do campeonato
              </h1>

              <p className="mt-4 max-w-2xl text-slate-300">
                Adiciona pilotos, cria etapas, lança resultados e gere o estado
                do campeonato.
              </p>

              {championship && (
                <p className="mt-3 text-sm text-slate-400">
                  Campeonato activo:{" "}
                  <span className="font-semibold text-white">
                    {championship.name}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col items-stretch gap-3 sm:flex-row">
              <a
                href="/"
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Voltar à homepage
              </a>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-black text-orange-300">
                    {pilots.length}
                  </div>
                  <div className="text-sm text-slate-400">Pilotos</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-black text-orange-300">
                    {stages.length}
                  </div>
                  <div className="text-sm text-slate-400">Etapas</div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center">
                  <div className="text-2xl font-black text-orange-300">
                    {results.length}
                  </div>
                  <div className="text-sm text-slate-400">Resultados</div>
                </div>
              </div>
            </div>
          </div>

          {(message || errorMessage) && (
            <div className="mt-8 space-y-3">
              {message && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                  {message}
                </div>
              )}
              {errorMessage && (
                <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {errorMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-12 md:px-10">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-slate-300">
            A carregar dados...
          </div>
        ) : (
          <>
            <div className="grid gap-8 xl:grid-cols-3">
              <form
                onSubmit={handleCreatePilot}
                className="rounded-[28px] border border-white/10 bg-white/5 p-6"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
                  Novo piloto
                </p>
                <h2 className="mt-2 text-2xl font-black">Adicionar piloto</h2>

                <div className="mt-6 space-y-4">
                  <input
                    value={pilotForm.full_name}
                    onChange={(e) =>
                      setPilotForm((current) => ({
                        ...current,
                        full_name: e.target.value,
                      }))
                    }
                    placeholder="Nome do piloto"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                    required
                  />

                  <input
                    value={pilotForm.kart_number}
                    onChange={(e) =>
                      setPilotForm((current) => ({
                        ...current,
                        kart_number: e.target.value,
                      }))
                    }
                    placeholder="Número do kart (opcional)"
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                  />

                  <input
                    value={pilotForm.team_name}
                    onChange={(e) =>
                      setPilotForm((current) => ({
                        ...current,
                        team_name: e.target.value,
                      }))
                    }
                    placeholder="Equipa"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                  />

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Guardar piloto
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleCreateStage}
                className="rounded-[28px] border border-white/10 bg-white/5 p-6"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
                  Nova etapa
                </p>
                <h2 className="mt-2 text-2xl font-black">Criar etapa</h2>

                <div className="mt-6 space-y-4">
                  <input
                    value={stageForm.round_number}
                    onChange={(e) =>
                      setStageForm((current) => ({
                        ...current,
                        round_number: e.target.value,
                      }))
                    }
                    placeholder="N.º da etapa"
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                    required
                  />

                  <input
                    value={stageForm.name}
                    onChange={(e) =>
                      setStageForm((current) => ({
                        ...current,
                        name: e.target.value,
                      }))
                    }
                    placeholder="Nome do kartódromo"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                    required
                  />

                  <input
                    value={stageForm.city}
                    onChange={(e) =>
                      setStageForm((current) => ({
                        ...current,
                        city: e.target.value,
                      }))
                    }
                    placeholder="Cidade"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                  />

                  <input
                    type="date"
                    value={stageForm.stage_date}
                    onChange={(e) =>
                      setStageForm((current) => ({
                        ...current,
                        stage_date: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    required
                  />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                    <input
                      type="time"
                      value={stageForm.check_in_time}
                      onChange={(e) =>
                        setStageForm((current) => ({
                          ...current,
                          check_in_time: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    />

                    <input
                      type="time"
                      value={stageForm.briefing_time}
                      onChange={(e) =>
                        setStageForm((current) => ({
                          ...current,
                          briefing_time: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    />

                    <input
                      type="time"
                      value={stageForm.race_time}
                      onChange={(e) =>
                        setStageForm((current) => ({
                          ...current,
                          race_time: e.target.value,
                        }))
                      }
                      className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    />
                  </div>

                  <select
                    value={stageForm.status}
                    onChange={(e) =>
                      setStageForm((current) => ({
                        ...current,
                        status: e.target.value as Stage["status"],
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                  >
                    <option value="draft">Rascunho</option>
                    <option value="scheduled">Agendada</option>
                    <option value="completed">Concluída</option>
                    <option value="cancelled">Cancelada</option>
                  </select>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Guardar etapa
                  </button>
                </div>
              </form>

              <form
                onSubmit={handleCreateResult}
                className="rounded-[28px] border border-white/10 bg-white/5 p-6"
              >
                <p className="text-sm uppercase tracking-[0.2em] text-orange-400">
                  Novo resultado
                </p>
                <h2 className="mt-2 text-2xl font-black">Lançar resultado</h2>

                <div className="mt-6 space-y-4">
                  <select
                    value={resultForm.stage_id}
                    onChange={(e) =>
                      setResultForm((current) => ({
                        ...current,
                        stage_id: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    required
                  >
                    <option value="">Seleccionar etapa</option>
                    {stages.map((stage) => (
                      <option key={stage.id} value={stage.id}>
                        Etapa {stage.round_number} · {stage.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={resultForm.pilot_id}
                    onChange={(e) =>
                      setResultForm((current) => ({
                        ...current,
                        pilot_id: e.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none focus:border-orange-400/40"
                    required
                  >
                    <option value="">Seleccionar piloto</option>
                    {pilots
                      .filter((pilot) => pilot.is_active)
                      .map((pilot) => (
                        <option key={pilot.id} value={pilot.id}>
                          {pilot.full_name}
                        </option>
                      ))}
                  </select>

                  <input
                    value={resultForm.finish_position}
                    onChange={(e) =>
                      setResultForm((current) => ({
                        ...current,
                        finish_position: e.target.value,
                      }))
                    }
                    placeholder="Posição final"
                    type="number"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 outline-none placeholder:text-slate-500 focus:border-orange-400/40"
                    required
                  />

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-300">
                    <input
                      type="checkbox"
                      checked={resultForm.pole_position}
                      onChange={(e) =>
                        setResultForm((current) => ({
                          ...current,
                          pole_position: e.target.checked,
                        }))
                      }
                    />
                    Pole position
                  </label>

                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-300">
                    <input
                      type="checkbox"
                      checked={resultForm.fastest_lap}
                      onChange={(e) =>
                        setResultForm((current) => ({
                          ...current,
                          fastest_lap: e.target.checked,
                        }))
                      }
                    />
                    Volta mais rápida
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-2xl bg-orange-500 px-5 py-3 font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Guardar resultado
                  </button>
                </div>
              </form>
            </div>

            <div className="mt-10 grid gap-8 xl:grid-cols-3">
              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="text-xl font-black">Pilotos</h3>
                </div>

                <div className="divide-y divide-white/5">
                  {pilots.length === 0 ? (
                    <div className="px-6 py-8 text-slate-400">
                      Ainda não existem pilotos.
                    </div>
                  ) : (
                    pilots.map((pilot) => (
                      <div
                        key={pilot.id}
                        className="flex items-center justify-between gap-4 px-6 py-4"
                      >
                        <div>
                          <p className="font-semibold">{pilot.full_name}</p>
                          <p className="text-sm text-slate-400">
                            {pilot.team_name}
                            {pilot.kart_number ? ` · #${pilot.kart_number}` : ""}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              pilot.is_active
                                ? "bg-emerald-500/15 text-emerald-300"
                                : "bg-slate-500/15 text-slate-300"
                            }`}
                          >
                            {pilot.is_active ? "Activo" : "Inactivo"}
                          </span>

                          <button
                            onClick={() => togglePilotActive(pilot)}
                            disabled={busyKey === `pilot-${pilot.id}`}
                            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/10 disabled:opacity-50"
                          >
                            {busyKey === `pilot-${pilot.id}`
                              ? "A guardar..."
                              : pilot.is_active
                              ? "Desactivar"
                              : "Activar"}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="text-xl font-black">Etapas</h3>
                </div>

                <div className="divide-y divide-white/5">
                  {stages.length === 0 ? (
                    <div className="px-6 py-8 text-slate-400">
                      Ainda não existem etapas.
                    </div>
                  ) : (
                    stages.map((stage) => (
                      <div key={stage.id} className="px-6 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">
                              Etapa {stage.round_number} · {stage.name}
                            </p>
                            <p className="mt-1 text-sm text-slate-400">
                              {stage.city || "—"} · {formatDate(stage.stage_date)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Check-in: {stage.check_in_time || "—"} · Briefing:{" "}
                              {stage.briefing_time || "—"} · Corrida:{" "}
                              {stage.race_time || "—"}
                            </p>
                          </div>

                          <span
                            className={`rounded-full border px-3 py-1 text-xs ${getStatusClass(
                              stage.status
                            )}`}
                          >
                            {getStatusLabel(stage.status)}
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {(
                            [
                              "draft",
                              "scheduled",
                              "completed",
                              "cancelled",
                            ] as Stage["status"][]
                          ).map((status) => (
                            <button
                              key={status}
                              onClick={() => updateStageStatus(stage.id, status)}
                              disabled={
                                busyKey === `stage-${stage.id}` ||
                                stage.status === status
                              }
                              className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                                stage.status === status
                                  ? "bg-orange-500 text-white"
                                  : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                              } disabled:opacity-50`}
                            >
                              {busyKey === `stage-${stage.id}` &&
                              stage.status !== status
                                ? "A guardar..."
                                : getStatusLabel(status)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-white/10 bg-slate-900/70 shadow-2xl">
                <div className="border-b border-white/10 px-6 py-4">
                  <h3 className="text-xl font-black">Resultados</h3>
                </div>

                <div className="divide-y divide-white/5">
                  {results.length === 0 ? (
                    <div className="px-6 py-8 text-slate-400">
                      Ainda não existem resultados.
                    </div>
                  ) : (
                    results.map((result) => {
                      const pilot = pilotMap.get(result.pilot_id);
                      const stage = stageMap.get(result.stage_id);

                      return (
                        <div key={result.id} className="px-6 py-4">
                          <p className="font-semibold">
                            {result.finish_position}º ·{" "}
                            {pilot?.full_name ?? "Piloto"}
                          </p>

                          <p className="mt-1 text-sm text-slate-400">
                            {stage
                              ? `Etapa ${stage.round_number} · ${stage.name}`
                              : "Etapa"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {result.pole_position ? "Pole" : ""}
                            {result.pole_position && result.fastest_lap
                              ? " · "
                              : ""}
                            {result.fastest_lap ? "Volta rápida" : ""}
                            {result.pole_position || result.fastest_lap
                              ? " · "
                              : ""}
                            {result.total_points} pontos
                          </p>

                          <div className="mt-4">
                            <button
                              onClick={() => deleteResult(result.id)}
                              disabled={busyKey === `result-${result.id}`}
                              className="rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/20 disabled:opacity-50"
                            >
                              {busyKey === `result-${result.id}`
                                ? "A apagar..."
                                : "Apagar resultado"}
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  );
}