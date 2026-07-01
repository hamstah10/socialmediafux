import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import {
  Type, Image as ImageIcon, Square, Trash2, Copy, ChevronUp,
  ChevronDown, Save, Layers, MousePointer2,
} from "lucide-react";
import { FORMAT_SIZES } from "../components/CreativePreview";
import MediaPicker from "../components/MediaPicker";

const FORMATS = Object.entries(FORMAT_SIZES).map(([key, v]) => ({ key, ...v }));

const uid = () => Math.random().toString(36).slice(2, 9);

const newTextLayer = () => ({
  id: uid(), type: "text", x: 8, y: 10, w: 60, h: 15, z: 10,
  text: "Neuer Text", fontSize: 4.5, fontWeight: 700, color: "#F5F7FA",
  bg: "", align: "left", upper: true, opacity: 1, radius: 0,
});
const newBoxLayer = (color = "#B4E600") => ({
  id: uid(), type: "box", x: 8, y: 80, w: 25, h: 8, z: 5,
  bg: color, opacity: 1, radius: 0,
});
const newImageLayer = (src) => ({
  id: uid(), type: "image", x: 60, y: 8, w: 30, h: 20, z: 8,
  src, fit: "contain", opacity: 1, radius: 0,
});

// Renders one absolute-positioned layer inside the canvas.
const LayerBox = ({ layer, selected, onSelect, onDragMove, canvasRef }) => {
  const startDrag = (e) => {
    e.stopPropagation();
    onSelect();
    const canvas = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = layer.x;
    const origY = layer.y;
    const onMove = (ev) => {
      const dx = ((ev.clientX - startX) / canvas.width) * 100;
      const dy = ((ev.clientY - startY) / canvas.height) * 100;
      onDragMove(Math.max(0, Math.min(100 - layer.w, origX + dx)),
                 Math.max(0, Math.min(100 - layer.h, origY + dy)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const commonStyle = {
    position: "absolute", left: `${layer.x}%`, top: `${layer.y}%`,
    width: `${layer.w}%`, height: `${layer.h}%`, zIndex: layer.z,
    opacity: layer.opacity, borderRadius: layer.radius,
    outline: selected ? "2px solid #B4E600" : "1px dashed rgba(180,230,0,0.25)",
    outlineOffset: 0, cursor: "move", overflow: "hidden",
  };

  return (
    <div style={commonStyle} onPointerDown={startDrag} data-testid={`layer-${layer.id}`}>
      {layer.type === "text" && (
        <div style={{
          background: layer.bg || "transparent",
          color: layer.color, width: "100%", height: "100%",
          fontSize: `${layer.fontSize}cqw`, fontWeight: layer.fontWeight,
          textTransform: layer.upper ? "uppercase" : "none",
          display: "flex", alignItems: "center", justifyContent: layer.align,
          padding: "0.5em 0.8em", lineHeight: 1.1, letterSpacing: "-0.01em",
          pointerEvents: "none",
        }}>{layer.text}</div>
      )}
      {layer.type === "box" && (
        <div style={{ width: "100%", height: "100%", background: layer.bg, pointerEvents: "none" }} />
      )}
      {layer.type === "image" && (
        <img src={resolveUpload(layer.src)} alt="" draggable={false}
             style={{ width: "100%", height: "100%", objectFit: layer.fit, pointerEvents: "none" }} />
      )}
    </div>
  );
};

const NumberField = ({ label, value, onChange, min = 0, max = 100, step = 1, testid }) => (
  <label className="block">
    <div className="fux-label mb-1">{label}</div>
    <input type="number" className="fux-input" value={value} min={min} max={max} step={step}
           onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
           data-testid={testid} />
  </label>
);

export default function LayoutEditor() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState("");
  const [format, setFormat] = useState("instagram_square");
  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    api.get("/customers").then((r) => {
      setCustomers(r.data);
      setCustomerId(r.data[0]?.id || "");
    });
  }, []);

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const selected = layers.find((l) => l.id === selectedId);
  const fmt = FORMATS.find((f) => f.key === format) || FORMATS[0];

  const primary = customer?.primary_color || "#080D1A";

  const updateSelected = (patch) => {
    setLayers((ls) => ls.map((l) => (l.id === selectedId ? { ...l, ...patch } : l)));
  };
  const deleteSelected = () => {
    setLayers((ls) => ls.filter((l) => l.id !== selectedId));
    setSelectedId(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const dup = { ...selected, id: uid(), x: Math.min(90, selected.x + 3), y: Math.min(90, selected.y + 3) };
    setLayers((ls) => [...ls, dup]);
    setSelectedId(dup.id);
  };
  const bumpZ = (delta) => {
    if (!selected) return;
    updateSelected({ z: Math.max(1, selected.z + delta) });
  };

  const addText = () => {
    const l = newTextLayer();
    setLayers((ls) => [...ls, l]); setSelectedId(l.id);
  };
  const addBox = () => {
    const l = newBoxLayer(customer?.accent_color || "#B4E600");
    setLayers((ls) => [...ls, l]); setSelectedId(l.id);
  };
  const addImage = () => setPickerOpen(true);

  const save = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    setSaving(true);
    try {
      await api.post("/creatives", {
        customer_id: customerId, format,
        headline: "Custom Layout", subline: "", cta: "",
        layers,
      });
      toast.success("Layout gespeichert");
      navigate("/archive");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4" data-testid="layout-editor-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ layout-editor</div>
          <h1 className="fux-heading text-4xl mt-1">Layout Editor</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Freies Layer-System — Texte, Bilder und Boxen frei platzieren. Klick zum Auswählen, ziehen zum Verschieben.
          </p>
        </div>
        <button className="fux-btn-primary" onClick={save} disabled={saving} data-testid="le-save">
          <Save size={14} /> {saving ? "Speichere…" : "Speichern"}
        </button>
      </header>

      <div className="grid grid-cols-12 gap-4">
        {/* Left: layers + add */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          <div className="fux-card space-y-2">
            <div className="fux-label">Setup</div>
            <select className="fux-input" value={customerId} onChange={(e) => setCustomerId(e.target.value)} data-testid="le-customer">
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="fux-input" value={format} onChange={(e) => setFormat(e.target.value)} data-testid="le-format">
              {FORMATS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
          </div>

          <div className="fux-card space-y-2">
            <div className="fux-label">Layer hinzufügen</div>
            <div className="grid grid-cols-3 gap-1.5">
              <button className="fux-btn-ghost justify-center" onClick={addText} data-testid="add-text"><Type size={14} /> Text</button>
              <button className="fux-btn-ghost justify-center" onClick={addImage} data-testid="add-image"><ImageIcon size={14} /> Bild</button>
              <button className="fux-btn-ghost justify-center" onClick={addBox} data-testid="add-box"><Square size={14} /> Box</button>
            </div>
          </div>

          <div className="fux-card">
            <div className="fux-label mb-2 flex items-center gap-1"><Layers size={12} /> Layer ({layers.length})</div>
            <ul className="space-y-1 max-h-96 overflow-y-auto" data-testid="layers-list">
              {[...layers].sort((a, b) => b.z - a.z).map((l) => (
                <li key={l.id}>
                  <button
                    onClick={() => setSelectedId(l.id)}
                    className={`w-full text-left px-2 py-1.5 text-xs border ${
                      l.id === selectedId ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`layer-item-${l.id}`}
                  >
                    <span className="mono uppercase">{l.type}</span>
                    <span className="ml-2 truncate">{l.type === "text" ? l.text.slice(0, 20) : l.type === "image" ? "img" : "box"}</span>
                    <span className="fux-label ml-auto float-right">z{l.z}</span>
                  </button>
                </li>
              ))}
              {layers.length === 0 && (
                <li className="fux-label text-center py-4">Kein Layer. Oben hinzufügen.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="col-span-12 lg:col-span-6">
          <div className="fux-card p-4">
            <div className="fux-label mb-2">// canvas · {fmt.w}×{fmt.h}</div>
            <div
              ref={canvasRef}
              onPointerDown={() => setSelectedId(null)}
              data-testid="canvas"
              style={{
                width: "100%", aspectRatio: `${fmt.w}/${fmt.h}`,
                background: primary,
                backgroundImage: "linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px)",
                backgroundSize: "40px 40px",
                position: "relative", overflow: "hidden",
                border: "1px solid #232D42",
                containerType: "inline-size",
                fontFamily: "'Rajdhani','IBM Plex Sans',sans-serif",
              }}
            >
              {layers.map((l) => (
                <LayerBox
                  key={l.id}
                  layer={l}
                  selected={l.id === selectedId}
                  onSelect={() => setSelectedId(l.id)}
                  onDragMove={(x, y) => setLayers((ls) => ls.map((ll) => ll.id === l.id ? { ...ll, x, y } : ll))}
                  canvasRef={canvasRef}
                />
              ))}
              {layers.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                  <div className="text-center">
                    <MousePointer2 size={28} className="mx-auto mb-2 opacity-40" />
                    <div className="fux-label">Add a layer to start</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: properties */}
        <div className="col-span-12 lg:col-span-3 space-y-3">
          {selected ? (
            <div className="fux-card space-y-3" data-testid="props-panel">
              <div className="flex items-center justify-between">
                <div className="fux-label">{selected.type}</div>
                <div className="flex gap-1">
                  <button onClick={duplicateSelected} className="fux-label hover:text-primary" title="Duplicate" data-testid="dup-layer"><Copy size={12} /></button>
                  <button onClick={() => bumpZ(1)} className="fux-label hover:text-primary" title="Bring forward"><ChevronUp size={12} /></button>
                  <button onClick={() => bumpZ(-1)} className="fux-label hover:text-primary" title="Send back"><ChevronDown size={12} /></button>
                  <button onClick={deleteSelected} className="fux-label hover:text-destructive" title="Delete" data-testid="del-layer"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <NumberField label="X %" value={selected.x} onChange={(v) => updateSelected({ x: v })} />
                <NumberField label="Y %" value={selected.y} onChange={(v) => updateSelected({ y: v })} />
                <NumberField label="W %" value={selected.w} onChange={(v) => updateSelected({ w: v })} min={1} />
                <NumberField label="H %" value={selected.h} onChange={(v) => updateSelected({ h: v })} min={1} />
              </div>

              {selected.type === "text" && (
                <>
                  <label className="block">
                    <div className="fux-label mb-1">Text</div>
                    <textarea className="fux-input min-h-16" value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} data-testid="txt-text" />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <NumberField label="Font (cqw)" value={selected.fontSize} onChange={(v) => updateSelected({ fontSize: v })} step={0.25} min={1} max={20} />
                    <NumberField label="Weight" value={selected.fontWeight} onChange={(v) => updateSelected({ fontWeight: v })} step={100} min={100} max={900} />
                  </div>
                  <div>
                    <div className="fux-label mb-1">Align</div>
                    <div className="grid grid-cols-3 gap-1">
                      {["left","center","right"].map((a) => (
                        <button key={a} onClick={() => updateSelected({ align: a })} className={`px-2 py-1 text-[10px] uppercase border ${selected.align===a?"border-primary text-primary":"border-border text-muted-foreground"}`}>{a}</button>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 fux-label">
                    <input type="checkbox" checked={!!selected.upper} onChange={(e) => updateSelected({ upper: e.target.checked })} />
                    UPPERCASE
                  </label>
                  <label className="block">
                    <div className="fux-label mb-1">Color</div>
                    <input type="color" className="fux-input h-9" value={selected.color} onChange={(e) => updateSelected({ color: e.target.value })} />
                  </label>
                  <label className="block">
                    <div className="fux-label mb-1">Background</div>
                    <input className="fux-input" placeholder="transparent oder #hex" value={selected.bg || ""} onChange={(e) => updateSelected({ bg: e.target.value })} />
                  </label>
                </>
              )}

              {selected.type === "box" && (
                <label className="block">
                  <div className="fux-label mb-1">Color</div>
                  <input type="color" className="fux-input h-9" value={selected.bg} onChange={(e) => updateSelected({ bg: e.target.value })} />
                </label>
              )}

              {selected.type === "image" && (
                <>
                  <button className="fux-btn-ghost w-full justify-center" onClick={() => setPickerOpen(true)}>
                    <ImageIcon size={12} /> Bild ändern
                  </button>
                  <div>
                    <div className="fux-label mb-1">Fit</div>
                    <div className="grid grid-cols-3 gap-1">
                      {["cover","contain","fill"].map((f) => (
                        <button key={f} onClick={() => updateSelected({ fit: f })} className={`px-2 py-1 text-[10px] uppercase border ${selected.fit===f?"border-primary text-primary":"border-border text-muted-foreground"}`}>{f}</button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <NumberField label="Opacity" value={selected.opacity} onChange={(v) => updateSelected({ opacity: v })} step={0.1} min={0} max={1} />
              <NumberField label="Radius px" value={selected.radius} onChange={(v) => updateSelected({ radius: v })} step={1} min={0} max={200} />
            </div>
          ) : (
            <div className="fux-card text-muted-foreground text-sm">
              <div className="fux-label mb-2">Properties</div>
              Klicke einen Layer im Canvas oder in der Liste zum Bearbeiten.
            </div>
          )}
        </div>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        customerId={customerId}
        onPick={(asset) => {
          setPickerOpen(false);
          if (selected?.type === "image") {
            updateSelected({ src: asset.file_path });
          } else {
            const l = newImageLayer(asset.file_path);
            setLayers((ls) => [...ls, l]);
            setSelectedId(l.id);
          }
        }}
      />
    </div>
  );
}
