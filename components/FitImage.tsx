/**
 * Shows the whole photo inside its box, never cropped, whatever its shape.
 * Space the photo doesn't cover is filled with a soft, blurred copy of the
 * same photo (same URL, so no extra download) instead of empty bars.
 * The parent sets the box size; this fills it.
 */
export default function FitImage({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative h-full w-full overflow-hidden bg-slate-100 ${className}`}>
      <img src={src} alt="" aria-hidden="true" loading="lazy" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
      <img src={src} alt={alt} loading="lazy" className="relative h-full w-full object-contain" />
    </div>
  );
}
