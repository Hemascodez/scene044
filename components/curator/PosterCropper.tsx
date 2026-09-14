"use client";

import { useEffect, useRef, useState } from "react";
import { AdminBtn, AdminLabel } from "@/components/curator/adminUi";

const OUTPUT_WIDTH = 1280;
const OUTPUT_HEIGHT = 720;

export function PosterCropper({
  source,
  onCancel,
  onApply,
}: {
  source: string;
  onCancel: () => void;
  onApply: (blob: Blob) => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [x, setX] = useState(50);
  const [y, setY] = useState(50);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onCancel]);

  useEffect(() => {
    const image = imageRef.current;
    const canvas = canvasRef.current;
    if (!ready || !image || !canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const targetRatio = OUTPUT_WIDTH / OUTPUT_HEIGHT;
    const baseCropWidth = Math.min(image.naturalWidth, image.naturalHeight * targetRatio);
    const baseCropHeight = baseCropWidth / targetRatio;
    const cropWidth = baseCropWidth / zoom;
    const cropHeight = baseCropHeight / zoom;
    const sourceX = ((image.naturalWidth - cropWidth) * x) / 100;
    const sourceY = ((image.naturalHeight - cropHeight) * y) / 100;

    context.clearRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    context.drawImage(
      image,
      sourceX,
      sourceY,
      cropWidth,
      cropHeight,
      0,
      0,
      OUTPUT_WIDTH,
      OUTPUT_HEIGHT,
    );
  }, [ready, x, y, zoom]);

  function apply() {
    const canvas = canvasRef.current;
    if (!canvas || !ready) return;
    setBusy(true);
    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (blob) onApply(blob);
      },
      "image/jpeg",
      0.9,
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="Adjust and crop event poster" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <div className="w-full max-w-3xl border border-[#39ff9b] bg-[#0a130f] p-4 shadow-[8px_8px_0_0_#04160d] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div><AdminLabel>Poster editor · 16:9</AdminLabel><h3 className="mt-1 font-display text-xl font-black">Adjust and crop</h3><p className="mt-1 text-xs text-[#8ba295]">The saved image matches the event card and detail page.</p></div>
          <AdminBtn variant="ghost" onClick={onCancel} title="Close crop editor">✕</AdminBtn>
        </div>

        <div className="mt-5 overflow-hidden border-2 border-[#33493c] bg-black">
          <canvas ref={canvasRef} width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} className="aspect-video w-full" />
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL used only as a canvas source */}
          <img ref={imageRef} src={source} alt="" className="hidden" onLoad={() => setReady(true)} />
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-2"><AdminLabel>Zoom · {zoom.toFixed(1)}×</AdminLabel><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} className="accent-[#39ff9b]" /></label>
          <label className="flex flex-col gap-2"><AdminLabel>Horizontal · {x}%</AdminLabel><input type="range" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} className="accent-[#39ff9b]" /></label>
          <label className="flex flex-col gap-2"><AdminLabel>Vertical · {y}%</AdminLabel><input type="range" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} className="accent-[#39ff9b]" /></label>
        </div>

        <div className="mt-5 flex flex-wrap gap-2 border-t border-[#25382e] pt-4">
          <AdminBtn variant="primary" onClick={apply} disabled={!ready || busy}>{busy ? "Preparing…" : "Crop and use"}</AdminBtn>
          <AdminBtn variant="outline" onClick={() => { setZoom(1); setX(50); setY(50); }}>Reset</AdminBtn>
          <AdminBtn variant="ghost" onClick={onCancel}>Cancel</AdminBtn>
        </div>
      </div>
    </div>
  );
}
