import { useState, useEffect } from "react";
import { useListMatches, useListMarkets, useListInsuranceProducts, useListGovernanceProposals } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { RefreshCw, ShieldCheck, TrendingUp, Trophy, Scale, CheckCircle2, Lock } from "lucide-react";

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY || "proofgoal-admin";
const API = "/api";

function apiFetch(path: string, body?: object) {
  return fetch(`${API}${path}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

// ── Auth gate ─────────────────────────────────────────────────────────────────
function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const { toast } = useToast();
  const tryAuth = () => {
    if (pw === ADMIN_KEY) { onAuth(); }
    else toast({ title: "Wrong password", variant: "destructive" });
  };
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Card className="w-full max-w-sm">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lock size={18} /> Admin Access
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Enter the admin password to manage the platform.</p>
          <Input
            type="password"
            placeholder="Password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && tryAuth()}
          />
          <Button className="w-full" onClick={tryAuth}>Unlock</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function Stat({ label, value, color = "" }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-secondary rounded-lg p-3 text-center">
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon size={16} /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// ── Main admin panel ──────────────────────────────────────────────────────────
function AdminPanel() {
  const { toast } = useToast();
  const [stats, setStats] = useState<Record<string, number> | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [creatingAll, setCreatingAll] = useState(false);

  const { data: matchesRaw, refetch: refetchMatches } = useListMatches();
  const { data: marketsRaw, refetch: refetchMarkets } = useListMarkets({});
  const { data: productsRaw, refetch: refetchProducts } = useListInsuranceProducts({});
  const { data: proposalsRaw, refetch: refetchProposals } = useListGovernanceProposals({});

  const matches = Array.isArray(matchesRaw) ? matchesRaw : [];
  const markets = Array.isArray(marketsRaw) ? marketsRaw : [];
  const products = Array.isArray(productsRaw) ? productsRaw : [];
  const proposals = Array.isArray(proposalsRaw) ? proposalsRaw : [];

  const loadStats = async () => {
    const r = await apiFetch("/admin/stats");
    if (r.ok) setStats(await r.json());
  };
  useEffect(() => { loadStats(); }, []);

  // ── Sync ────────────────────────────────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true);
    try {
      const r = await apiFetch("/admin/sync");
      const d = await r.json();
      toast({ title: "Sync complete", description: d.message });
      await loadStats();
      refetchMatches();
      refetchMarkets();
    } catch { toast({ title: "Sync failed", variant: "destructive" }); }
    finally { setSyncing(false); }
  };

  // ── Create all markets ──────────────────────────────────────────────────────
  const handleCreateAll = async () => {
    setCreatingAll(true);
    try {
      const r = await apiFetch("/admin/markets/create-all");
      const d = await r.json();
      toast({ title: "Markets created", description: d.message });
      refetchMarkets();
      await loadStats();
    } catch { toast({ title: "Failed", variant: "destructive" }); }
    finally { setCreatingAll(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">Manage the ProofGoal platform</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={handleSync} disabled={syncing}>
            <RefreshCw size={14} className={`mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Syncing…" : "Sync TxLINE"}
          </Button>
          <Button size="sm" onClick={handleCreateAll} disabled={creatingAll}>
            <TrendingUp size={14} className="mr-1" />
            {creatingAll ? "Creating…" : "Create All Markets"}
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          <Stat label="Matches" value={stats.matches ?? 0} />
          <Stat label="Markets" value={stats.markets ?? 0} />
          <Stat label="Open" value={stats.openMarkets ?? 0} color="text-green-600" />
          <Stat label="Settled" value={stats.settledMarkets ?? 0} color="text-blue-600" />
          <Stat label="Positions" value={stats.positions ?? 0} />
          <Stat label="Ins. Products" value={stats.insuranceProducts ?? 0} />
          <Stat label="Policies" value={stats.insurancePolicies ?? 0} />
          <Stat label="Proposals" value={stats.governanceProposals ?? 0} />
          <Stat label="Proofs" value={stats.proofs ?? 0} color="text-primary" />
        </div>
      )}

      {/* Markets management */}
      <Section title="Markets" icon={TrendingUp}>
        <div className="space-y-4">
          {/* Settle open markets */}
          {markets.filter((m) => m.status === "open").length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Open Markets — click to settle</p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {markets.filter((m) => m.status === "open").map((market) => (
                  <SettleMarketRow key={market.id} market={market} onSettled={() => { refetchMarkets(); loadStats(); }} />
                ))}
              </div>
            </div>
          )}

          {/* Create custom market */}
          <CreateMarketForm matches={matches} onCreated={() => { refetchMarkets(); loadStats(); }} />
        </div>
      </Section>

      {/* Matches — proofs */}
      <Section title="Matches & Proofs" icon={Trophy}>
        <div className="space-y-2 max-h-72 overflow-y-auto">
          {matches.map((match) => (
            <MatchProofRow key={match.id} match={match} onProofGenerated={loadStats} />
          ))}
        </div>
      </Section>

      {/* Insurance products */}
      <Section title="Insurance Products" icon={ShieldCheck}>
        <div className="space-y-4">
          {products.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {products.map((p) => (
                <div key={p.id} className="flex justify-between text-xs p-2 bg-secondary rounded">
                  <span className="font-medium">{p.name}</span>
                  <span className="text-muted-foreground">{(p.premiumRateBps / 100).toFixed(1)}% premium</span>
                </div>
              ))}
            </div>
          )}
          <CreateInsuranceForm onCreated={() => { refetchProducts(); loadStats(); }} />
        </div>
      </Section>

      {/* Governance */}
      <Section title="Governance Proposals" icon={Scale}>
        <div className="space-y-4">
          {proposals.length > 0 && (
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {proposals.map((p) => (
                <div key={p.id} className="flex justify-between text-xs p-2 bg-secondary rounded">
                  <span className="font-medium">{p.title}</span>
                  <span className={`font-mono ${p.status === "active" ? "text-green-600" : "text-muted-foreground"}`}>
                    {p.status} · {p.votesFor}↑ {p.votesAgainst}↓
                  </span>
                </div>
              ))}
            </div>
          )}
          <CreateProposalForm onCreated={() => { refetchProposals(); loadStats(); }} />
        </div>
      </Section>
    </div>
  );
}

// ── Settle market row ─────────────────────────────────────────────────────────
function SettleMarketRow({
  market,
  onSettled,
}: {
  market: { id: string; title: string; selections: { id: string; label: string; odds: number }[] };
  onSettled: () => void;
}) {
  const { toast } = useToast();
  const [settling, setSettling] = useState(false);

  const handleSettle = async (selectionId: string) => {
    setSettling(true);
    try {
      const r = await apiFetch(`/admin/markets/${market.id}/settle`, { winningSelectionId: selectionId });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Market settled", description: `Winner: ${market.selections.find(s => s.id === selectionId)?.label}` });
      onSettled();
    } catch (err) {
      toast({ title: "Settle failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSettling(false); }
  };

  return (
    <div className="p-3 border rounded bg-card space-y-2">
      <p className="text-xs font-medium">{market.title}</p>
      <div className="flex flex-wrap gap-1">
        {market.selections.map((s) => (
          <Button key={s.id} size="sm" variant="outline" className="text-xs h-7 px-2" disabled={settling} onClick={() => handleSettle(s.id)}>
            <CheckCircle2 size={11} className="mr-1" /> {s.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// ── Match proof row ────────────────────────────────────────────────────────────
function MatchProofRow({ match, onProofGenerated }: { match: { id: string; homeTeam: string; awayTeam: string; status: string; homeScore: number | null; awayScore: number | null }; onProofGenerated: () => void }) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const r = await apiFetch("/admin/proofs/generate", { matchId: match.id });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Proof generated", description: `${match.homeTeam} vs ${match.awayTeam}` });
      onProofGenerated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  return (
    <div className="flex items-center justify-between p-2 bg-secondary rounded text-xs">
      <div className="flex items-center gap-2">
        <span className={`w-1.5 h-1.5 rounded-full ${match.status === "live" ? "bg-green-500 animate-pulse" : match.status === "finished" ? "bg-blue-500" : "bg-muted-foreground"}`} />
        <span className="font-medium">{match.homeTeam} vs {match.awayTeam}</span>
        {match.homeScore !== null && (
          <span className="font-mono text-muted-foreground">{match.homeScore}:{match.awayScore}</span>
        )}
      </div>
      {match.status === "finished" && (
        <Button size="sm" variant="ghost" className="text-xs h-6 px-2" disabled={generating} onClick={handleGenerate}>
          {generating ? "…" : "Gen Proof"}
        </Button>
      )}
    </div>
  );
}

// ── Create market form ────────────────────────────────────────────────────────
function CreateMarketForm({ matches, onCreated }: { matches: Array<{ id: string; homeTeam: string; awayTeam: string }>; onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ matchId: "", type: "match_winner", title: "", selections: "Team A,2.10|Draw,3.30|Team B,2.80" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const selections = form.selections.split("|").map((s) => {
        const [label, odds] = s.split(",");
        return { label: label?.trim() ?? "", odds: parseFloat(odds ?? "2") };
      });
      const r = await apiFetch("/admin/markets", {
        matchId: form.matchId || undefined,
        type: form.type,
        title: form.title,
        selections,
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Market created" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Custom Market
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Market</p>
      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Fixture (optional)</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.matchId} onChange={(e) => setForm((p) => ({ ...p, matchId: e.target.value }))}>
            <option value="">No fixture</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.homeTeam} vs {m.awayTeam}</option>)}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Market Type</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {["match_winner","over_under_goals","both_teams_score","double_chance","exact_score","first_scorer","corners","cards","tournament_winner","group_winner","custom"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Title</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Market title…" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <Label className="text-[10px]">Selections (Label,Odds|Label,Odds)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="Home,2.1|Draw,3.3|Away,2.8" value={form.selections} onChange={set("selections")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Create insurance form ─────────────────────────────────────────────────────
function CreateInsuranceForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", type: "favorite_team_loss", description: "", premiumRateBps: "500", maxCoverageLamports: "5000000000", triggerCondition: "home_team_loses" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    setSaving(true);
    try {
      const r = await apiFetch("/admin/insurance/products", {
        ...form,
        premiumRateBps: parseInt(form.premiumRateBps),
        maxCoverageLamports: parseInt(form.maxCoverageLamports),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Insurance product created" });
      setOpen(false);
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Insurance Product
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Insurance Product</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px]">Name</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="e.g. Favourite Team Loss Cover" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <Label className="text-[10px]">Type</Label>
          <select className="w-full text-xs border rounded h-8 px-2 bg-background mt-0.5" value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {["favorite_team_loss","tournament_exit","qualification","goal_insurance","event_triggered","custom"].map((t) => (
              <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-[10px]">Premium Rate (bps)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="500 = 5%" value={form.premiumRateBps} onChange={set("premiumRateBps")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Max Coverage (lamports)</Label>
          <Input className="text-xs h-8 mt-0.5 font-mono" placeholder="5000000000 = 5 SOL" value={form.maxCoverageLamports} onChange={set("maxCoverageLamports")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Description</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="What this policy covers…" value={form.description} onChange={set("description")} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px]">Trigger Condition</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="e.g. home_team_loses" value={form.triggerCondition} onChange={set("triggerCondition")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Create proposal form ──────────────────────────────────────────────────────
function CreateProposalForm({ onCreated }: { onCreated: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", endsAt: "" });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: e.target.value }));

  const handleCreate = async () => {
    if (!form.title || !form.description) { toast({ title: "Fill all fields", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const r = await apiFetch("/admin/governance/proposals", form);
      if (!r.ok) throw new Error((await r.json()).error);
      toast({ title: "Proposal created" });
      setOpen(false);
      setForm({ title: "", description: "", endsAt: "" });
      onCreated();
    } catch (err) {
      toast({ title: "Failed", description: (err as Error).message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (!open) return (
    <Button size="sm" variant="outline" className="w-full text-xs" onClick={() => setOpen(true)}>
      + Create Proposal
    </Button>
  );

  return (
    <div className="border rounded p-3 space-y-3 bg-card">
      <p className="text-xs font-semibold">New Governance Proposal</p>
      <div className="space-y-2">
        <div>
          <Label className="text-[10px]">Title</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Proposal title…" value={form.title} onChange={set("title")} />
        </div>
        <div>
          <Label className="text-[10px]">Description</Label>
          <Input className="text-xs h-8 mt-0.5" placeholder="Describe the proposal…" value={form.description} onChange={set("description")} />
        </div>
        <div>
          <Label className="text-[10px]">Ends At (optional)</Label>
          <Input className="text-xs h-8 mt-0.5" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="flex-1 text-xs" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</Button>
        <Button size="sm" variant="ghost" className="text-xs" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Page export ───────────────────────────────────────────────────────────────
export function AdminPage() {
  const [authed, setAuthed] = useState(() => {
    try { return localStorage.getItem("pg_admin_authed") === "1"; } catch { return false; }
  });

  const handleAuth = () => {
    try { localStorage.setItem("pg_admin_authed", "1"); } catch {}
    setAuthed(true);
  };

  if (!authed) return <AuthGate onAuth={handleAuth} />;
  return <AdminPanel />;
}
