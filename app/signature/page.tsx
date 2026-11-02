"use client";
import { ChangeEvent, PointerEvent, useEffect, useRef, useState } from "react";
import { Eraser, PenLine, Upload, Check } from "lucide-react";
import AppShell from "@/components/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";

const W = 600;
const H = 220;

/** Trims transparent edges and returns a PNG data URL no wider than 600px. */
function exportTrimmed(source: HTMLCanvasElement) {
  const ctx = source.getContext("2d")!;
  const { data, width, height } = ctx.getImageData(0, 0, source.width, source.height);
  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return "";
  const pad = 6;
  const cw = maxX - minX + 1 + pad * 2;
  const ch = maxY - minY + 1 + pad * 2;
  const scale = Math.min(1, 600 / cw);
  const out = document.createElement("canvas");
  out.width = Math.round(cw * scale);
  out.height = Math.round(ch * scale);
  out.getContext("2d")!.drawImage(source, minX - pad, minY - pad, cw, ch, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/** Turns a photo or scan of a signature on paper into ink on a transparent background. */
function removeBackground(img: HTMLImageElement) {
  const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const frame = ctx.getImageData(0, 0, c.width, c.height);
  const d = frame.data;
  // Paper brightness: the 90th percentile of luminance.
  const lums: number[] = [];
  for (let i = 0; i < d.length; i += 16) lums.push(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
  lums.sort((a, b) => a - b);
  const paper = lums[Math.floor(lums.length * 0.9)] || 230;
  const ink = paper * 0.45;
  for (let i = 0; i < d.length; i += 4) {
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const a = Math.max(0, Math.min(1, (paper - 18 - lum) / (paper - 18 - ink)));
    d[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(frame, 0, 0);
  return exportTrimmed(c);
}

export default function SignaturePage() {
  const { user, refreshUser } = useAuth();
  const [current, setCurrent] = useState("");
  const [preview, setPreview] = useState("");
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (user?.signature) {
      api<{ image: string }>(`/signatures/${user.signature}`).then((r) => setCurrent(r.image)).catch(() => {});
    }
  }, [user?.signature]);

  function point(e: PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * W, y: ((e.clientY - rect.top) / rect.height) * H };
  }
  function down(e: PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = e.currentTarget.getContext("2d")!;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }
  function move(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d")!;
    ctx.lineWidth = 2.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1c2470";
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function up() {
    if (!drawing.current) return;
    drawing.current = false;
    setPreview(exportTrimmed(canvas.current!));
  }
  function clear() {
    canvas.current?.getContext("2d")!.clearRect(0, 0, W, H);
    setPreview("");
  }
  function upload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      setPreview(removeBackground(img));
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function save() {
    if (!preview) return;
    setBusy(true);
    try {
      await api("/auth/me/signature", { method: "PUT", body: JSON.stringify({ image: preview }) });
      await refreshUser();
      setCurrent(preview);
      setPreview("");
      clear();
      setNotice("Your e-signature is saved. It will be applied to receipts and offer letters you sign from now on.");
    } catch (err) {
      setNotice((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell title="My e-signature" subtitle="The signature applied when you sign receipts and approve offer letters." permission="receipts.authorize">
      <div className="mx-auto max-w-3xl space-y-6">
        {notice && <p className="rounded-xl bg-[#edf4ed] p-3 text-sm text-[#245739]">{notice}</p>}

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-semibold">Signature on file</h2>
          <p className="mt-1 text-sm text-slate-500">Signed documents show it as <b>{user?.name}{user?.title ? ` - ${user.title}` : ""}</b>.</p>
          <div className="mt-4 grid h-36 place-items-center rounded-xl border border-dashed border-slate-200 bg-[#fafbfa]">
            {current ? <img src={current} alt="Your current signature" className="max-h-28 max-w-[80%] object-contain" /> : <p className="text-sm text-slate-400">No signature yet. You can&apos;t sign documents until you add one.</p>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold">{current ? "Replace signature" : "Add signature"}</h2>
            <div className="flex overflow-hidden rounded-xl border border-slate-200 text-xs font-semibold">
              {([["draw", "Draw", PenLine], ["upload", "Upload photo", Upload]] as const).map(([value, label, Icon]) => (
                <button key={value} onClick={() => { setMode(value); setPreview(""); }} className={`inline-flex items-center gap-1.5 px-3 py-2 ${mode === value ? "bg-[#174b34] text-white" : "text-slate-600"}`}>
                  <Icon size={14} /> {label}
                </button>
              ))}
            </div>
          </div>

          {mode === "draw" ? (
            <>
              <p className="mt-2 text-sm text-slate-500">Sign in the box with your mouse, finger or stylus.</p>
              <canvas
                ref={canvas}
                width={W}
                height={H}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerLeave={up}
                className="mt-3 w-full touch-none rounded-xl border border-slate-300 bg-white"
                style={{ aspectRatio: `${W} / ${H}` }}
              />
              <button onClick={clear} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500"><Eraser size={13} /> Clear</button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-slate-500">Sign on plain white paper with a dark pen, then upload a clear, well-lit photo or scan. The paper background is removed automatically.</p>
              <input type="file" accept="image/*" onChange={upload} className="mt-3 block text-sm" />
            </>
          )}

          {preview && (
            <div className="mt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preview</p>
              <div className="mt-2 grid h-36 place-items-center rounded-xl border border-slate-200 bg-[repeating-conic-gradient(#f3f4f3_0_25%,#fff_0_50%)] bg-[length:16px_16px]">
                <img src={preview} alt="New signature preview" className="max-h-28 max-w-[80%] object-contain" />
              </div>
              <button disabled={busy} onClick={save} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#174b34] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
                <Check size={16} /> {busy ? "Saving…" : "Save as my e-signature"}
              </button>
            </div>
          )}
          <p className="mt-5 text-xs leading-5 text-slate-400">
            Only you can set your signature. Documents you have already signed keep the signature they were signed with.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
