import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, resolveUpload } from "../lib/api";
import { toast } from "sonner";
import {
  Type, Image as ImageIcon, Square, Trash2, Copy, ChevronUp,
  ChevronDown, Save, Layers, MousePointer2, Grid3x3, FolderPlus,
  Folder, Eye, EyeOff, Link2, Link2Off, Pencil, BookmarkPlus, FileText,
} from "lucide-react";
import { FORMAT_SIZES } from "../components/CreativePreview";
import MediaPicker from "../components/MediaPicker";

const FORMATS = Object.entries(FORMAT_SIZES).map(([key, v]) => ({ key, ...v }));

const TEXT_ROLES = [
  { key: "static", label: "Statisch" },
  { key: "headline", label: "Headline (auto)" },
  { key: "subline", label: "Subline (auto)" },
  { key: "cta", label: "CTA (auto)" },
  { key: "website_slot", label: "Website (auto)" },
];
const IMAGE_ROLES = [
  { key: "static", label: "Statisch" },
  { key: "image_slot", label: "Bild-Slot (News/Auto)" },
  { key: "logo_slot", label: "Logo-Slot (Kunde)" },
];

const uid = () => Math.random().toString(36).slice(2, 9);

// Fonts — dropdown presets + free Google Font input
const FONT_PRESETS = [
  { key: "Rajdhani", label: "Rajdhani", stack: "'Rajdhani', sans-serif" },
  { key: "IBM Plex Sans", label: "IBM Plex Sans", stack: "'IBM Plex Sans', sans-serif" },
  { key: "IBM Plex Mono", label: "IBM Plex Mono", stack: "'IBM Plex Mono', monospace" },
  { key: "Inter", label: "Inter", stack: "'Inter', sans-serif" },
  { key: "JetBrains Mono", label: "JetBrains Mono", stack: "'JetBrains Mono', monospace" },
];
const isPresetFont = (name) => FONT_PRESETS.some((f) => f.key === name);

// Dynamically inject Google Font link tags for custom fonts.
const useGoogleFontLoader = (fontNames) => {
  useEffect(() => {
    const unique = [...new Set(fontNames.filter((n) => n && !isPresetFont(n)))];
    const links = unique.map((name) => {
      const family = name.trim().replace(/\s+/g, "+");
      const id = `gf-${family}`;
      if (document.getElementById(id)) return null;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = `https://fonts.googleapis.com/css2?family=${family}:wght@400;500;600;700;800&display=swap`;
      document.head.appendChild(link);
      return link;
    }).filter(Boolean);
    return () => {
      // keep loaded fonts cached — do not remove on cleanup
    };
  }, [fontNames.join("|")]);
};

const newTextLayer = () => ({
  id: uid(), type: "text", x: 8, y: 10, w: 60, h: 15, z: 10,
  text: "Neuer Text", fontSize: 4.5, fontWeight: 700, color: "#F5F7FA",
  bg: "", align: "left", upper: true, opacity: 1, radius: 0,
  fontFamily: "Rajdhani", groupId: null, visible: true, role: "static",
});
const newBoxLayer = (color = "#B4E600") => ({
  id: uid(), type: "box", x: 8, y: 80, w: 25, h: 8, z: 5,
  bg: color, opacity: 1, radius: 0,
  groupId: null, visible: true, role: "static",
});
const newImageLayer = (src) => ({
  id: uid(), type: "image", x: 60, y: 8, w: 30, h: 20, z: 8,
  src, fit: "contain", opacity: 1, radius: 0,
  groupId: null, visible: true, role: "static",
});

// ─── Snap helper (values in %) ────────────────────────────────
const snap = (v, gridPct, on) => (on ? Math.round(v / gridPct) * gridPct : v);

// ─── Layer renderer with 8 resize handles ─────────────────────
const RESIZE_HANDLES = [
  { key: "nw", cursor: "nwse-resize", x: 0,   y: 0 },
  { key: "n",  cursor: "ns-resize",   x: 0.5, y: 0 },
  { key: "ne", cursor: "nesw-resize", x: 1,   y: 0 },
  { key: "e",  cursor: "ew-resize",   x: 1,   y: 0.5 },
  { key: "se", cursor: "nwse-resize", x: 1,   y: 1 },
  { key: "s",  cursor: "ns-resize",   x: 0.5, y: 1 },
  { key: "sw", cursor: "nesw-resize", x: 0,   y: 1 },
  { key: "w",  cursor: "ew-resize",   x: 0,   y: 0.5 },
];

const LayerBox = ({ layer, selected, onSelect, onDragMove, onResize, canvasRef, snapPct, snapOn, resolveFont }) => {
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
      let nx = Math.max(0, Math.min(100 - layer.w, origX + dx));
      let ny = Math.max(0, Math.min(100 - layer.h, origY + dy));
      nx = snap(nx, snapPct, snapOn);
      ny = snap(ny, snapPct, snapOn);
      onDragMove(nx, ny);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startResize = (handle) => (e) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    const canvas = canvasRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const o = { x: layer.x, y: layer.y, w: layer.w, h: layer.h };
    const onMove = (ev) => {
      const dxPct = ((ev.clientX - startX) / canvas.width) * 100;
      const dyPct = ((ev.clientY - startY) / canvas.height) * 100;
      let x = o.x, y = o.y, w = o.w, h = o.h;
      if (handle.includes("e")) w = Math.max(2, o.w + dxPct);
      if (handle.includes("s")) h = Math.max(2, o.h + dyPct);
      if (handle.includes("w")) { w = Math.max(2, o.w - dxPct); x = o.x + (o.w - w); }
      if (handle.includes("n")) { h = Math.max(2, o.h - dyPct); y = o.y + (o.h - h); }
      // Constrain to canvas
      if (x < 0) { w += x; x = 0; }
      if (y < 0) { h += y; y = 0; }
      if (x + w > 100) w = 100 - x;
      if (y + h > 100) h = 100 - y;
      // Snap
      x = snap(x, snapPct, snapOn);
      y = snap(y, snapPct, snapOn);
      w = snap(w, snapPct, snapOn);
      h = snap(h, snapPct, snapOn);
      onResize({ x, y, w: Math.max(2, w), h: Math.max(2, h) });
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  if (!layer.visible) return null;

  const commonStyle = {
    position: "absolute", left: `${layer.x}%`, top: `${layer.y}%`,
    width: `${layer.w}%`, height: `${layer.h}%`, zIndex: layer.z,
    opacity: layer.opacity, borderRadius: layer.radius,
    outline: selected ? "2px solid #B4E600" : "1px dashed rgba(180,230,0,0.25)",
    outlineOffset: 0, cursor: "move",
  };

  return (
    <div style={commonStyle} onPointerDown={startDrag} data-testid={`layer-${layer.id}`}>
      <div style={{ width: "100%", height: "100%", overflow: "hidden", borderRadius: layer.radius }}>
        {layer.type === "text" && (
          <div style={{
            background: layer.bg || "transparent",
            color: layer.color, width: "100%", height: "100%",
            fontSize: `${layer.fontSize}cqw`, fontWeight: layer.fontWeight,
            fontFamily: resolveFont(layer.fontFamily),
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

      {/* Resize handles — only when selected */}
      {selected && RESIZE_HANDLES.map((h) => (
        <div
          key={h.key}
          onPointerDown={startResize(h.key)}
          data-testid={`resize-${h.key}`}
          style={{
            position: "absolute",
            left: `calc(${h.x * 100}% - 6px)`,
            top: `calc(${h.y * 100}% - 6px)`,
            width: 12, height: 12,
            background: "#B4E600",
            border: "1px solid #080D1A",
            cursor: h.cursor,
            zIndex: 9999,
          }}
        />
      ))}
    </div>
  );
};

const LayerItem = ({ l, selectedId, onToggleVisible, onSelect }) => (
  <li>
    <div className={`flex items-center gap-1 px-2 py-1.5 text-xs border ${
      l.id === selectedId ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground hover:text-foreground"
    }`}>
      <button
        onClick={() => onToggleVisible(l.id)}
        className="opacity-60 hover:opacity-100"
        data-testid={`toggle-vis-${l.id}`}
        title={l.visible ? "Ausblenden" : "Einblenden"}
      >
        {l.visible ? <Eye size={11} /> : <EyeOff size={11} />}
      </button>
      <button
        onClick={() => onSelect(l.id)}
        className="flex-1 text-left truncate"
        data-testid={`layer-item-${l.id}`}
      >
        <span className="mono uppercase">{l.type}</span>
        <span className="ml-2 truncate">{l.type === "text" ? l.text.slice(0, 20) : l.type === "image" ? "img" : "box"}</span>
      </button>
      {l.role && l.role !== "static" && (
        <span
          className="px-1 py-0.5 text-[9px] uppercase border border-primary text-primary"
          title={`Rolle: ${l.role}`}
        >
          {l.role.replace("_slot", "")}
        </span>
      )}
      <span className="fux-label">z{l.z}</span>
    </div>
  </li>
);

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
  const [groups, setGroups] = useState([]); // {id, name, linked, collapsed}
  const [selectedId, setSelectedId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Snap-to-Grid controls
  const [snapOn, setSnapOn] = useState(true);
  const [gridSize, setGridSize] = useState(10); // px on visual canvas mapping to %
  // gridSize is % because coordinates are stored in %; 5/10/20 → % steps

  // Layout templates
  const [layoutTemplates, setLayoutTemplates] = useState([]);
  const [loadedTemplateId, setLoadedTemplateId] = useState("");
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateScope, setTemplateScope] = useState("customer"); // 'customer' | 'global'

  const canvasRef = useRef(null);

  // Load Google Fonts on the fly for custom font families
  const fontFamilies = layers.filter((l) => l.type === "text").map((l) => l.fontFamily);
  useGoogleFontLoader(fontFamilies);

  const resolveFont = (name) => {
    const preset = FONT_PRESETS.find((f) => f.key === name);
    if (preset) return preset.stack;
    return `'${name}', sans-serif`;
  };

  useEffect(() => {
    api.get("/customers").then((r) => {
      setCustomers(r.data);
      setCustomerId(r.data[0]?.id || "");
    });
  }, []);

  // Reload layout templates when customer changes
  useEffect(() => {
    if (!customerId) return;
    api.get("/layout-templates", { params: { customer_id: customerId, include_global: true } })
      .then((r) => setLayoutTemplates(r.data));
  }, [customerId]);

  const loadTemplate = async (id) => {
    if (!id) return;
    try {
      const r = await api.get(`/layout-templates/${id}`);
      setLayers(r.data.layers || []);
      setGroups(r.data.groups || []);
      setFormat(r.data.format || "instagram_square");
      setSelectedId(null);
      setSelectedGroupId(null);
      setLoadedTemplateId(id);
      toast.success(`Template geladen: ${r.data.name}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Konnte Template nicht laden");
    }
  };

  const saveAsTemplate = async () => {
    const name = templateName.trim();
    if (!name) return toast.error("Name eingeben");
    if (layers.length === 0) return toast.error("Keine Layer zum Speichern");
    const payload = {
      name,
      customer_id: templateScope === "customer" ? customerId : null,
      is_global: templateScope === "global",
      format,
      layers, groups,
    };
    try {
      const r = await api.post("/layout-templates", payload);
      setLayoutTemplates((ts) => [r.data, ...ts]);
      setLoadedTemplateId(r.data.id);
      setSaveTemplateOpen(false);
      setTemplateName("");
      toast.success(`Template "${name}" gespeichert`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Speichern fehlgeschlagen");
    }
  };

  const customer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId]);
  const selected = layers.find((l) => l.id === selectedId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);
  const fmt = FORMATS.find((f) => f.key === format) || FORMATS[0];
  const primary = customer?.primary_color || "#080D1A";

  // ── Layer ops ────────────────────────────────
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
  const toggleLayerVisible = (id) => {
    setLayers((ls) => ls.map((l) => l.id === id ? { ...l, visible: !l.visible } : l));
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

  // ── Group ops ────────────────────────────────
  const addGroup = () => {
    const g = { id: uid(), name: `Gruppe ${groups.length + 1}`, linked: true, collapsed: false };
    setGroups((gs) => [...gs, g]);
    setSelectedGroupId(g.id);
  };
  const renameGroup = (id) => {
    const g = groups.find((x) => x.id === id);
    const name = window.prompt("Gruppenname", g?.name || "");
    if (name === null) return;
    setGroups((gs) => gs.map((x) => x.id === id ? { ...x, name: name.trim() || x.name } : x));
  };
  const deleteGroup = (id) => {
    // detach members
    setLayers((ls) => ls.map((l) => l.groupId === id ? { ...l, groupId: null } : l));
    setGroups((gs) => gs.filter((g) => g.id !== id));
    if (selectedGroupId === id) setSelectedGroupId(null);
  };
  const toggleGroupCollapsed = (id) => {
    setGroups((gs) => gs.map((g) => g.id === id ? { ...g, collapsed: !g.collapsed } : g));
  };
  const toggleGroupLinked = (id) => {
    setGroups((gs) => gs.map((g) => g.id === id ? { ...g, linked: !g.linked } : g));
  };
  const toggleGroupVisible = (id) => {
    const members = layers.filter((l) => l.groupId === id);
    const anyVisible = members.some((m) => m.visible);
    setLayers((ls) => ls.map((l) => l.groupId === id ? { ...l, visible: !anyVisible } : l));
  };
  const assignLayerToGroup = (layerId, groupId) => {
    setLayers((ls) => ls.map((l) => l.id === layerId ? { ...l, groupId: groupId || null } : l));
  };

  // Move all group members together when a linked group's child is dragged
  const moveLayer = (layerId, newX, newY) => {
    const layer = layers.find((l) => l.id === layerId);
    if (!layer) return;
    const group = groups.find((g) => g.id === layer.groupId);
    if (group?.linked) {
      const dx = newX - layer.x;
      const dy = newY - layer.y;
      setLayers((ls) => ls.map((l) => {
        if (l.groupId !== group.id) return l;
        return {
          ...l,
          x: Math.max(0, Math.min(100 - l.w, l.x + dx)),
          y: Math.max(0, Math.min(100 - l.h, l.y + dy)),
        };
      }));
    } else {
      setLayers((ls) => ls.map((l) => l.id === layerId ? { ...l, x: newX, y: newY } : l));
    }
  };

  const resizeLayer = (layerId, patch) => {
    setLayers((ls) => ls.map((l) => l.id === layerId ? { ...l, ...patch } : l));
  };

  const save = async () => {
    if (!customerId) return toast.error("Kunde wählen");
    setSaving(true);
    try {
      await api.post("/creatives", {
        customer_id: customerId, format,
        headline: "Custom Layout", subline: "", cta: "",
        layers, groups,
      });
      toast.success("Layout gespeichert");
      navigate("/archive");
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Save failed");
    } finally { setSaving(false); }
  };

  // Group tree for layer panel
  const ungroupedLayers = [...layers].filter((l) => !l.groupId).sort((a, b) => b.z - a.z);
  const layersByGroup = (gid) => [...layers].filter((l) => l.groupId === gid).sort((a, b) => b.z - a.z);

  const handleSelectLayer = (id) => { setSelectedId(id); setSelectedGroupId(null); };

  return (
    <div className="space-y-4" data-testid="layout-editor-page">
      <header className="flex items-end justify-between">
        <div>
          <div className="fux-label">/ layout-editor</div>
          <h1 className="fux-heading text-4xl mt-1">Layout Editor</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Freies Layer-System — Ecken-Handles zum Skalieren, Snap-to-Grid, Fonts &amp; Gruppen.
          </p>
        </div>
        <div className="flex items-end gap-2 flex-wrap justify-end">
          {/* Layout Template loader */}
          <div className="fux-card p-2 flex items-center gap-2" data-testid="template-toolbar">
            <div className="fux-label flex items-center gap-1"><FileText size={11} /> Template</div>
            <select
              value={loadedTemplateId}
              onChange={(e) => loadTemplate(e.target.value)}
              className="fux-input h-7 text-[11px] w-44"
              data-testid="load-template"
            >
              <option value="">— laden —</option>
              {layoutTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.is_global ? "🌐 " : ""}{t.name} · {t.format}
                </option>
              ))}
            </select>
            <button
              onClick={() => setSaveTemplateOpen(true)}
              className="fux-btn-ghost text-[10px] px-2 py-1"
              data-testid="save-as-template"
              title="Als Template speichern"
            >
              <BookmarkPlus size={12} /> Speichern als…
            </button>
          </div>

          {/* Snap toolbar */}
          <div className="fux-card p-2 flex items-center gap-2" data-testid="snap-toolbar">
            <button
              onClick={() => setSnapOn((v) => !v)}
              className={`flex items-center gap-1 px-2 py-1 text-[10px] uppercase border ${snapOn ? "border-primary text-primary" : "border-border text-muted-foreground"}`}
              data-testid="snap-toggle"
              title="Snap-to-Grid"
            >
              <Grid3x3 size={12} /> Snap {snapOn ? "ON" : "OFF"}
            </button>
            <select
              value={gridSize}
              onChange={(e) => setGridSize(parseFloat(e.target.value))}
              className="fux-input h-7 text-[10px] w-16"
              data-testid="grid-size"
              disabled={!snapOn}
            >
              <option value={2.5}>2.5%</option>
              <option value={5}>5%</option>
              <option value={10}>10%</option>
              <option value={20}>20%</option>
            </select>
          </div>
          <button className="fux-btn-primary" onClick={save} disabled={saving} data-testid="le-save">
            <Save size={14} /> {saving ? "Speichere…" : "Speichern"}
          </button>
        </div>
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
            <button className="fux-btn-ghost w-full justify-center" onClick={addGroup} data-testid="add-group">
              <FolderPlus size={12} /> Neue Gruppe
            </button>
          </div>

          <div className="fux-card">
            <div className="fux-label mb-2 flex items-center gap-1"><Layers size={12} /> Layer ({layers.length})</div>
            <ul className="space-y-1 max-h-[32rem] overflow-y-auto" data-testid="layers-list">
              {/* Groups */}
              {groups.map((g) => {
                const members = layersByGroup(g.id);
                const anyVisible = members.some((m) => m.visible);
                return (
                  <li key={g.id} className="space-y-1">
                    <div className={`flex items-center gap-1 px-2 py-1.5 text-xs border ${
                      g.id === selectedGroupId ? "border-primary bg-secondary text-primary" : "border-border text-muted-foreground"
                    }`}>
                      <button onClick={() => toggleGroupCollapsed(g.id)} className="opacity-60 hover:opacity-100" title="Ein-/Ausklappen">
                        {g.collapsed ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
                      </button>
                      <button onClick={() => toggleGroupVisible(g.id)} className="opacity-60 hover:opacity-100" title="Sichtbarkeit">
                        {anyVisible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                      <button onClick={() => toggleGroupLinked(g.id)} className="opacity-60 hover:opacity-100" title={g.linked ? "Verknüpft (Move zusammen)" : "Getrennt"}>
                        {g.linked ? <Link2 size={11} /> : <Link2Off size={11} />}
                      </button>
                      <button
                        onClick={() => { setSelectedGroupId(g.id); setSelectedId(null); }}
                        className="flex-1 text-left truncate flex items-center gap-1"
                        data-testid={`group-item-${g.id}`}
                      >
                        <Folder size={11} />
                        <span className="truncate">{g.name}</span>
                      </button>
                      <button onClick={() => renameGroup(g.id)} className="opacity-60 hover:opacity-100" title="Umbenennen"><Pencil size={10} /></button>
                      <button onClick={() => deleteGroup(g.id)} className="opacity-60 hover:text-destructive" title="Löschen"><Trash2 size={10} /></button>
                    </div>
                    {!g.collapsed && (
                      <ul className="space-y-1 pl-4 border-l border-border ml-2">
                        {members.map((l) => (
                          <LayerItem
                            key={l.id}
                            l={l}
                            selectedId={selectedId}
                            onToggleVisible={toggleLayerVisible}
                            onSelect={handleSelectLayer}
                          />
                        ))}
                        {members.length === 0 && (
                          <li className="fux-label italic px-2">leer — Layer zuweisen</li>
                        )}
                      </ul>
                    )}
                  </li>
                );
              })}

              {/* Ungrouped */}
              {ungroupedLayers.map((l) => (
                <LayerItem
                  key={l.id}
                  l={l}
                  selectedId={selectedId}
                  onToggleVisible={toggleLayerVisible}
                  onSelect={handleSelectLayer}
                />
              ))}

              {layers.length === 0 && groups.length === 0 && (
                <li className="fux-label text-center py-4">Kein Layer. Oben hinzufügen.</li>
              )}
            </ul>
          </div>
        </div>

        {/* Center: canvas */}
        <div className="col-span-12 lg:col-span-6">
          <div className="fux-card p-4">
            <div className="fux-label mb-2 flex items-center justify-between">
              <span>// canvas · {fmt.w}×{fmt.h}</span>
              {snapOn && <span className="text-primary">grid: {gridSize}%</span>}
            </div>
            <div
              ref={canvasRef}
              onPointerDown={() => { setSelectedId(null); setSelectedGroupId(null); }}
              data-testid="canvas"
              style={{
                width: "100%", aspectRatio: `${fmt.w}/${fmt.h}`,
                background: primary,
                backgroundImage: snapOn
                  ? `linear-gradient(rgba(180,230,0,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(180,230,0,0.12) 1px,transparent 1px)`
                  : `linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px)`,
                backgroundSize: snapOn ? `${gridSize}% ${gridSize}%` : "40px 40px",
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
                  onSelect={() => { setSelectedId(l.id); setSelectedGroupId(null); }}
                  onDragMove={(x, y) => moveLayer(l.id, x, y)}
                  onResize={(patch) => resizeLayer(l.id, patch)}
                  canvasRef={canvasRef}
                  snapPct={gridSize}
                  snapOn={snapOn}
                  resolveFont={resolveFont}
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
          {selectedGroup && !selected && (
            <div className="fux-card space-y-3" data-testid="group-props-panel">
              <div className="flex items-center justify-between">
                <div className="fux-label flex items-center gap-1"><Folder size={11} /> Gruppe</div>
                <div className="flex gap-1">
                  <button onClick={() => renameGroup(selectedGroup.id)} className="fux-label hover:text-primary" title="Umbenennen"><Pencil size={12} /></button>
                  <button onClick={() => deleteGroup(selectedGroup.id)} className="fux-label hover:text-destructive" title="Löschen"><Trash2 size={12} /></button>
                </div>
              </div>
              <div>
                <div className="fux-label mb-1">Name</div>
                <div className="text-sm truncate">{selectedGroup.name}</div>
              </div>
              <label className="flex items-center gap-2 fux-label">
                <input
                  type="checkbox"
                  checked={selectedGroup.linked}
                  onChange={() => toggleGroupLinked(selectedGroup.id)}
                  data-testid="group-linked"
                />
                Verknüpft (zusammen verschieben)
              </label>
              <div>
                <div className="fux-label mb-1">Mitglieder ({layersByGroup(selectedGroup.id).length})</div>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {layersByGroup(selectedGroup.id).map((l) => (
                    <li key={l.id} className="text-xs text-muted-foreground truncate">
                      · {l.type} — {l.type === "text" ? l.text.slice(0, 24) : l.type}
                    </li>
                  ))}
                  {layersByGroup(selectedGroup.id).length === 0 && (
                    <li className="fux-label italic">Weise Layer über deren Properties zu.</li>
                  )}
                </ul>
              </div>
            </div>
          )}

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
                <NumberField label="X %" value={Math.round(selected.x * 100) / 100} onChange={(v) => updateSelected({ x: v })} />
                <NumberField label="Y %" value={Math.round(selected.y * 100) / 100} onChange={(v) => updateSelected({ y: v })} />
                <NumberField label="W %" value={Math.round(selected.w * 100) / 100} onChange={(v) => updateSelected({ w: v })} min={1} />
                <NumberField label="H %" value={Math.round(selected.h * 100) / 100} onChange={(v) => updateSelected({ h: v })} min={1} />
              </div>

              {/* Group assignment */}
              <label className="block">
                <div className="fux-label mb-1">Gruppe</div>
                <select
                  className="fux-input"
                  value={selected.groupId || ""}
                  onChange={(e) => assignLayerToGroup(selected.id, e.target.value)}
                  data-testid="layer-group-select"
                >
                  <option value="">— keine —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </label>

              {/* Role selector — template placeholders */}
              {(selected.type === "text" || selected.type === "image") && (
                <label className="block">
                  <div className="fux-label mb-1 flex items-center gap-1">
                    <BookmarkPlus size={10} /> Rolle (Template-Slot)
                  </div>
                  <select
                    className="fux-input"
                    value={selected.role || "static"}
                    onChange={(e) => updateSelected({ role: e.target.value })}
                    data-testid="layer-role-select"
                  >
                    {(selected.type === "text" ? TEXT_ROLES : IMAGE_ROLES).map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                  {selected.role && selected.role !== "static" && (
                    <div className="fux-label mt-1 text-[10px] text-primary opacity-80">
                      ↳ Wird beim Bulk-Generate automatisch ersetzt.
                    </div>
                  )}
                </label>
              )}

              {selected.type === "text" && (
                <>
                  <label className="block">
                    <div className="fux-label mb-1">Text</div>
                    <textarea className="fux-input min-h-16" value={selected.text} onChange={(e) => updateSelected({ text: e.target.value })} data-testid="txt-text" />
                  </label>

                  {/* Font selection */}
                  <label className="block">
                    <div className="fux-label mb-1">Font</div>
                    <select
                      className="fux-input"
                      value={isPresetFont(selected.fontFamily) ? selected.fontFamily : "__custom__"}
                      onChange={(e) => {
                        if (e.target.value === "__custom__") {
                          updateSelected({ fontFamily: selected.fontFamily && !isPresetFont(selected.fontFamily) ? selected.fontFamily : "Bebas Neue" });
                        } else {
                          updateSelected({ fontFamily: e.target.value });
                        }
                      }}
                      data-testid="font-select"
                    >
                      {FONT_PRESETS.map((f) => (
                        <option key={f.key} value={f.key} style={{ fontFamily: f.stack }}>{f.label}</option>
                      ))}
                      <option value="__custom__">Custom Google Font…</option>
                    </select>
                  </label>
                  {!isPresetFont(selected.fontFamily) && (
                    <label className="block">
                      <div className="fux-label mb-1">Google Font Name</div>
                      <input
                        className="fux-input"
                        value={selected.fontFamily}
                        onChange={(e) => updateSelected({ fontFamily: e.target.value })}
                        placeholder="z.B. Bebas Neue, Space Grotesk, Oswald"
                        data-testid="font-custom"
                      />
                      <div className="fux-label mt-1 text-[10px] opacity-70">
                        Wird automatisch von fonts.google.com geladen.
                      </div>
                    </label>
                  )}

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
          ) : !selectedGroup ? (
            <div className="fux-card text-muted-foreground text-sm">
              <div className="fux-label mb-2">Properties</div>
              Klicke einen Layer oder eine Gruppe zum Bearbeiten.
            </div>
          ) : null}
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

      {/* Save as Template dialog */}
      {saveTemplateOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-center justify-center p-4"
          onClick={() => setSaveTemplateOpen(false)}
          data-testid="save-template-dialog"
        >
          <div
            className="fux-card w-full max-w-md space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="fux-heading text-lg flex items-center gap-2">
                <BookmarkPlus size={16} /> Als Template speichern
              </div>
              <button onClick={() => setSaveTemplateOpen(false)} className="fux-label hover:text-primary">✕</button>
            </div>
            <p className="text-xs text-muted-foreground">
              Speichere dieses Layout inkl. Layer &amp; Gruppen als wiederverwendbares Template.
              Setze Text-/Bild-Layer auf eine &quot;Rolle&quot;, damit sie beim Bulk-Generate automatisch ersetzt werden.
            </p>
            <label className="block">
              <div className="fux-label mb-1">Name</div>
              <input
                autoFocus
                className="fux-input"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="z.B. Instagram · News-Post V1"
                data-testid="template-name-input"
              />
            </label>
            <div>
              <div className="fux-label mb-1">Sichtbarkeit</div>
              <div className="grid grid-cols-2 gap-1">
                {[
                  { key: "customer", label: `Kunde (${customer?.name || "—"})` },
                  { key: "global", label: "🌐 Global (alle Kunden)" },
                ].map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setTemplateScope(s.key)}
                    className={`px-2 py-1.5 text-[10px] uppercase border truncate ${
                      templateScope === s.key
                        ? "border-primary text-primary"
                        : "border-border text-muted-foreground"
                    }`}
                    data-testid={`scope-${s.key}`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fux-label text-[10px] opacity-70">
              {layers.length} Layer · {groups.length} Gruppe(n) · Format: {format}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="fux-btn-ghost" onClick={() => setSaveTemplateOpen(false)}>
                Abbrechen
              </button>
              <button
                className="fux-btn-primary"
                onClick={saveAsTemplate}
                data-testid="template-save-confirm"
              >
                <BookmarkPlus size={12} /> Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
