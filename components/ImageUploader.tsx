"use client";
import { DragEvent, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatBytes, imageUrl, optimizeImage } from "@/lib/images";
import FitImage from "./FitImage";

type Pending = { key: string; preview: string; name: string };

/**
 * Picks photos, shrinks them in the browser, uploads them and keeps the list
 * of uploaded image ids. The first photo is the cover.
 */
export default function ImageUploader({
  value,
  onChange,
  max = 12,
  onBusyChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  max?: number;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [message, setMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const latest = useRef(value);
  latest.current = value;

  async function add(files: FileList | File[]) {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    const room = max - latest.current.length - pending.length;
    if (!list.length) return;
    if (room <= 0) {
      setMessage(`You can add up to ${max} photos.`);
      return;
    }
    const batch = list.slice(0, room).map((file) => ({ file, key: `${file.name}-${file.size}-${Math.random()}` }));
    setPending((p) => [...p, ...batch.map(({ file, key }) => ({ key, name: file.name, preview: URL.createObjectURL(file) }))]);
    onBusyChange?.(true);
    let before = 0;
    let after = 0;
    const errors: string[] = [];
    for (const { file, key } of batch) {
      try {
        const img = await optimizeImage(file);
        const saved = await api<{ _id: string }>("/images", {
          method: "POST",
          body: JSON.stringify({ full: img.full, thumb: img.thumb, width: img.width, height: img.height }),
        });
        before += img.originalBytes;
        after += img.bytes;
        onChange([...latest.current, saved._id]);
      } catch (err) {
        errors.push(`${file.name}: ${(err as Error).message}`);
      } finally {
        setPending((p) => {
          const done = p.find((x) => x.key === key);
          if (done) URL.revokeObjectURL(done.preview);
          return p.filter((x) => x.key !== key);
        });
      }
    }
    onBusyChange?.(false);
    setMessage(
      [
        after ? `Optimised ${formatBytes(before)} → ${formatBytes(after)} for faster loading.` : "",
        list.length > room ? `Only ${room} more photo(s) fit; the rest were skipped.` : "",
        ...errors,
      ].filter(Boolean).join(" "),
    );
  }

  function drop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    void add(e.dataTransfer.files);
  }

  const makeCover = (i: number) => onChange([value[i], ...value.filter((_, j) => j !== i)]);
  const remove = (i: number) => onChange(value.filter((_, j) => j !== i));

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {value.map((ref, i) => (
          <div key={ref} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
            <FitImage src={imageUrl(ref, "thumb")} alt="" />
            {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-[#174b34] px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>}
            <div className="absolute right-1.5 top-1.5 flex gap-1">
              {i > 0 && (
                <button type="button" onClick={() => makeCover(i)} title="Make cover photo" className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-slate-600 hover:text-amber-600">
                  <Star size={12} />
                </button>
              )}
              <button type="button" onClick={() => remove(i)} title="Remove photo" className="grid h-6 w-6 place-items-center rounded-full bg-white/90 text-slate-600 hover:text-red-600">
                <X size={12} />
              </button>
            </div>
          </div>
        ))}
        {pending.map((p) => (
          <div key={p.key} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-slate-200">
            <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
            <span className="absolute inset-0 grid place-items-center text-[#174b34]"><Loader2 className="animate-spin" size={20} /></span>
          </div>
        ))}
        {value.length + pending.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={drop}
            className={`flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-xs font-semibold transition ${dragging ? "border-[#174b34] bg-[#eaf2ec] text-[#174b34]" : "border-slate-300 text-slate-500 hover:border-[#174b34]/50"}`}
          >
            <ImagePlus size={20} />
            Add photos
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files) void add(e.target.files);
          e.target.value = "";
        }}
      />
      <p className="mt-2 text-[11px] text-slate-400">
        {message || `Up to ${max} photos. They are resized and compressed automatically; the first one is the cover.`}
      </p>
    </div>
  );
}
