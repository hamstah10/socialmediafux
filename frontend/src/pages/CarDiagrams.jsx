import { useEffect, useRef, useState } from "react";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import { Car, ImageOff, Plus, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";

const emptyVehicleForm = { customer_id: "", vehicle: "", year: "", engine: "" };
const emptyGenForm = {
  diagram_title: "",
  markings: [],
  perspective: "Motorraum von oben, Motorhaube offen",
  language: "Deutsch",
  detail_view: true,
  realistic: true,
  notes: "",
  image_area: "motorroom",
  use_saved_base: true,
  save_prompt_name: "",
};

const AssetPreview = ({ assetId, assets, emptyLabel }) => {
  const [failed, setFailed] = useState(false);
  const asset = assets[assetId];
  const src = asset ? resolveUpload(asset.file_path) : null;
  if (!src || failed) {
    return (
      <div className="w-full aspect-video border border-border bg-secondary flex items-center justify-center text-muted-foreground">
        <ImageOff size={20} className="mr-2" /> {emptyLabel}
      </div>
    );
  }
  return <img src={src} alt="" className="w-full aspect-video object-cover border border-border bg-secondary" onError={() => setFailed(true)} />;
};

export default function CarDiagrams() {
  const [customers, setCustomers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [diagrams, setDiagrams] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [assets, setAssets] = useState({});
  const [newOpen, setNewOpen] = useState(false);
  const [vehicleForm, setVehicleForm] = useState(emptyVehicleForm);
  const [creating, setCreating] = useState(false);
  const [uploadingArea, setUploadingArea] = useState("");
  const [generatingBase, setGeneratingBase] = useState("");
  const [genForm, setGenForm] = useState(emptyGenForm);
  const [markingInput, setMarkingInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const motorroomFileRef = useRef(null);
  const trunkFileRef = useRef(null);

  const selected = diagrams.find((d) => d.id === selectedId) || null;

  const loadDiagrams = () => api.get("/car-diagrams").then((r) => setDiagrams(r.data));

  const loadAsset = async (id) => {
    if (!id || assets[id]) return;
    try {
      const r = await api.get(`/media?category=Motorraum`);
      const map = {};
      r.data.forEach((a) => { map[a.id] = a; });
      setAssets((prev) => ({ ...prev, ...map }));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    api.get("/customers").then((r) => setCustomers(r.data));
    api.get("/settings").then((r) => setSettings(r.data));
    loadDiagrams();
  }, []);

  useEffect(() => {
    if (selected) {
      loadAsset(selected.motorroom_media_asset_id);
      loadAsset(selected.trunk_media_asset_id);
      setResult(null);
    }
  }, [selectedId]);

  const createVehicle = async () => {
    if (!vehicleForm.vehicle || !vehicleForm.engine) {
      return toast.error("Fahrzeug und Motor sind Pflichtfelder");
    }
    setCreating(true);
    try {
      const r = await api.post("/car-diagrams", { ...vehicleForm, customer_id: vehicleForm.customer_id || null });
      toast.success("Fahrzeug angelegt");
      setNewOpen(false);
      setVehicleForm(emptyVehicleForm);
      await loadDiagrams();
      setSelectedId(r.data.id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Anlegen fehlgeschlagen");
    } finally { setCreating(false); }
  };

  const deleteVehicle = async (d) => {
    if (!window.confirm(`${d.vehicle} löschen?`)) return;
    try {
      await api.delete(`/car-diagrams/${d.id}`);
      toast.success("Gelöscht");
      if (selectedId === d.id) setSelectedId("");
      loadDiagrams();
    } catch { toast.error("Löschen fehlgeschlagen"); }
  };

  const uploadBase = async (file, area) => {
    if (!file || !selected) return;
    setUploadingArea(area);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const r = await api.post(`/car-diagrams/${selected.id}/upload-base?image_area=${area}`, fd);
      toast.success("Basisbild hochgeladen");
      setDiagrams((prev) => prev.map((d) => (d.id === r.data.id ? r.data : d)));
      loadAsset(area === "trunk" ? r.data.trunk_media_asset_id : r.data.motorroom_media_asset_id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Upload fehlgeschlagen");
    } finally { setUploadingArea(""); }
  };

  const generateBase = async (area) => {
    if (!selected) return;
    setGeneratingBase(area);
    try {
      const r = await api.post(`/car-diagrams/${selected.id}/generate-base?image_area=${area}`);
      toast.success("Basisbild generiert");
      setDiagrams((prev) => prev.map((d) => (d.id === r.data.id ? r.data : d)));
      loadAsset(area === "trunk" ? r.data.trunk_media_asset_id : r.data.motorroom_media_asset_id);
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Basisbild fehlgeschlagen");
    } finally { setGeneratingBase(""); }
  };

  const addMarking = () => {
    if (!markingInput.trim()) return;
    setGenForm({ ...genForm, markings: [...genForm.markings, markingInput.trim()] });
    setMarkingInput("");
  };

  const removeMarking = (i) => {
    setGenForm({ ...genForm, markings: genForm.markings.filter((_, idx) => idx !== i) });
  };

  const generateDiagram = async () => {
    if (!selected) return;
    if (!genForm.diagram_title.trim()) return toast.error("Haupttitel eingeben");
    setGenerating(true);
    setResult(null);
    try {
      const r = await api.post(`/car-diagrams/${selected.id}/generate`, genForm);
      setResult(r.data);
      setAssets((prev) => ({ ...prev, [r.data.media_asset.id]: r.data.media_asset }));
      toast.success("Schaubild generiert — in Media Library gespeichert");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Generierung fehlgeschlagen");
    } finally { setGenerating(false); }
  };

  const openaiConfigured = settings?.openai_configured;

  return (
    <div className="space-y-6" data-testid="car-diagrams-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ car-diagrams</div>
          <h1 className="fux-heading text-4xl mt-1">Motorraum-Schaubilder</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Fahrzeuge, Motorraum-/Kofferraum-Basisbilder und beschriftete KI-Schaubilder für Werkstatt-Content.
          </p>
        </div>
        <button className="fux-btn-primary" onClick={() => setNewOpen(true)} data-testid="new-vehicle-btn">
          <Plus size={14} /> Fahrzeug anlegen
        </button>
      </header>

      {settings && !openaiConfigured && (
        <div className="fux-card text-sm" style={{ borderColor: "#FFB020", color: "#FFB020" }}>
          OPENAI_API_KEY ist nicht konfiguriert — KI-Bildgenerierung ist deaktiviert. Basisbilder können manuell hochgeladen werden.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: vehicle list */}
        <div className="fux-card lg:col-span-1 space-y-2">
          <div className="fux-label mb-2">Fahrzeuge ({diagrams.length})</div>
          {diagrams.map((d) => (
            <div
              key={d.id}
              onClick={() => setSelectedId(d.id)}
              className={`p-3 border cursor-pointer flex items-center justify-between ${selectedId === d.id ? "border-primary" : "border-border"}`}
              data-testid={`vehicle-${d.id}`}
            >
              <div>
                <div className="font-medium text-sm flex items-center gap-1.5"><Car size={13} /> {d.vehicle} {d.year}</div>
                <div className="text-xs text-muted-foreground">{d.engine}</div>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteVehicle(d); }} className="text-muted-foreground hover:text-destructive" data-testid={`delete-vehicle-${d.id}`}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          {diagrams.length === 0 && (
            <div className="text-sm text-muted-foreground py-6 text-center">Noch keine Fahrzeuge angelegt.</div>
          )}
        </div>

        {/* Right: base images + generation */}
        <div className="lg:col-span-2 space-y-4">
          {!selected && (
            <div className="fux-card min-h-64 flex flex-col items-center justify-center text-muted-foreground">
              <Sparkles size={32} className="opacity-40 mb-3" />
              <p className="text-sm">Fahrzeug links auswählen oder neu anlegen.</p>
            </div>
          )}

          {selected && (
            <>
              <div className="fux-card space-y-3">
                <div className="fux-label">Basisbilder</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Motorraum</div>
                    <AssetPreview assetId={selected.motorroom_media_asset_id} assets={assets} emptyLabel="kein Basisbild" />
                    <div className="flex gap-2">
                      <input ref={motorroomFileRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => uploadBase(e.target.files?.[0], "motorroom")} data-testid="upload-motorroom" />
                      <button className="fux-btn-ghost flex-1 justify-center text-xs" onClick={() => motorroomFileRef.current?.click()} disabled={uploadingArea === "motorroom"}>
                        <Upload size={12} /> {uploadingArea === "motorroom" ? "…" : "Hochladen"}
                      </button>
                      <button className="fux-btn-ghost flex-1 justify-center text-xs" onClick={() => generateBase("motorroom")} disabled={!openaiConfigured || generatingBase === "motorroom"}>
                        <Wand2 size={12} /> {generatingBase === "motorroom" ? "…" : "KI generieren"}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium">Kofferraum</div>
                    <AssetPreview assetId={selected.trunk_media_asset_id} assets={assets} emptyLabel="kein Basisbild" />
                    <div className="flex gap-2">
                      <input ref={trunkFileRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => uploadBase(e.target.files?.[0], "trunk")} data-testid="upload-trunk" />
                      <button className="fux-btn-ghost flex-1 justify-center text-xs" onClick={() => trunkFileRef.current?.click()} disabled={uploadingArea === "trunk"}>
                        <Upload size={12} /> {uploadingArea === "trunk" ? "…" : "Hochladen"}
                      </button>
                      <button className="fux-btn-ghost flex-1 justify-center text-xs" onClick={() => generateBase("trunk")} disabled={!openaiConfigured || generatingBase === "trunk"}>
                        <Wand2 size={12} /> {generatingBase === "trunk" ? "…" : "KI generieren"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="fux-card space-y-3">
                <div className="fux-label">Schaubild generieren</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="fux-label block mb-1.5">Bereich</label>
                    <select className="fux-input" value={genForm.image_area} onChange={(e) => setGenForm({ ...genForm, image_area: e.target.value })}>
                      <option value="motorroom">Motorraum</option>
                      <option value="trunk">Kofferraum</option>
                    </select>
                  </div>
                  <div>
                    <label className="fux-label block mb-1.5">Sprache</label>
                    <input className="fux-input" value={genForm.language} onChange={(e) => setGenForm({ ...genForm, language: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Haupttitel</label>
                  <input className="fux-input" placeholder="z.B. DPF-Druck- und Temperatursensoren" value={genForm.diagram_title}
                    onChange={(e) => setGenForm({ ...genForm, diagram_title: e.target.value })} data-testid="diagram-title" />
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Perspektive</label>
                  <input className="fux-input" value={genForm.perspective} onChange={(e) => setGenForm({ ...genForm, perspective: e.target.value })} />
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Markierungen / Bauteile</label>
                  <div className="flex gap-2">
                    <input className="fux-input" value={markingInput} placeholder="z.B. Ladeluftkühler"
                      onChange={(e) => setMarkingInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addMarking(); } }}
                      data-testid="marking-input" />
                    <button className="fux-btn-ghost" onClick={addMarking} type="button"><Plus size={14} /></button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {genForm.markings.map((m, i) => (
                      <span key={i} className="fux-badge fux-badge-accent inline-flex items-center gap-1">
                        {m}
                        <button onClick={() => removeMarking(i)}><X size={10} /></button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={genForm.detail_view} onChange={(e) => setGenForm({ ...genForm, detail_view: e.target.checked })} /> Detailansicht
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={genForm.realistic} onChange={(e) => setGenForm({ ...genForm, realistic: e.target.checked })} /> Fotorealistisch
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={genForm.use_saved_base} onChange={(e) => setGenForm({ ...genForm, use_saved_base: e.target.checked })} /> Basisbild wiederverwenden
                  </label>
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Zusatzhinweise</label>
                  <textarea className="fux-input min-h-16" value={genForm.notes} onChange={(e) => setGenForm({ ...genForm, notes: e.target.value })} />
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Als Vorlage speichern (optional, Name)</label>
                  <input className="fux-input" value={genForm.save_prompt_name} onChange={(e) => setGenForm({ ...genForm, save_prompt_name: e.target.value })} />
                </div>
                {selected.prompt_templates?.length > 0 && (
                  <div>
                    <label className="fux-label block mb-1.5">Gespeicherte Vorlage laden</label>
                    <select className="fux-input" defaultValue="" onChange={(e) => {
                      const t = selected.prompt_templates[e.target.value];
                      if (t) setGenForm({ ...genForm, ...t, save_prompt_name: "" });
                    }}>
                      <option value="" disabled>— wählen —</option>
                      {selected.prompt_templates.map((t, i) => <option key={i} value={i}>{t.name}</option>)}
                    </select>
                  </div>
                )}
                <button className="fux-btn-primary w-full justify-center py-3" onClick={generateDiagram}
                  disabled={generating || !openaiConfigured} data-testid="generate-diagram">
                  <Wand2 size={16} /> {generating ? "Generiere…" : "Schaubild generieren"}
                </button>
              </div>

              {result && (
                <div className="fux-card" data-testid="diagram-result">
                  <div className="fux-label mb-2">Ergebnis · {result.mode}</div>
                  <img src={resolveUpload(result.media_asset.file_path)} alt="" className="w-full border border-border" />
                  <p className="text-xs text-muted-foreground mt-2">In Media Library gespeichert (Kategorie „Motorraum") — direkt im Creative Editor als Bildebene nutzbar.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {newOpen && (
        <div className="fixed inset-0 bg-background/85 flex items-center justify-center z-50 p-6" data-testid="new-vehicle-modal">
          <div className="fux-card w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="fux-heading text-2xl">Fahrzeug anlegen</h2>
              <button onClick={() => setNewOpen(false)}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="fux-label block mb-1.5">Kunde (optional)</label>
                <select className="fux-input" value={vehicleForm.customer_id} onChange={(e) => setVehicleForm({ ...vehicleForm, customer_id: e.target.value })} data-testid="vf-customer">
                  <option value="">Global (alle Kunden)</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="fux-label block mb-1.5">Fahrzeug</label>
                <input className="fux-input" placeholder="z.B. BMW 3er G20/G21" value={vehicleForm.vehicle} onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle: e.target.value })} data-testid="vf-vehicle" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="fux-label block mb-1.5">Baujahr</label>
                  <input className="fux-input" placeholder="2019" value={vehicleForm.year} onChange={(e) => setVehicleForm({ ...vehicleForm, year: e.target.value })} data-testid="vf-year" />
                </div>
                <div>
                  <label className="fux-label block mb-1.5">Motor</label>
                  <input className="fux-input" placeholder="30d 286 PS B57" value={vehicleForm.engine} onChange={(e) => setVehicleForm({ ...vehicleForm, engine: e.target.value })} data-testid="vf-engine" />
                </div>
              </div>
              <button className="fux-btn-primary w-full justify-center" disabled={creating} onClick={createVehicle} data-testid="vf-submit">
                {creating ? "Anlegen…" : "Anlegen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
