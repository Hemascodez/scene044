'use client';
import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { checkInBooking } from '@/lib/client/hostApi';
export function HostQrScanner({ onRefresh }: { onRefresh: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const generation = useRef(0);
  const processing = useRef(false);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('Camera access is requested only when you start scanning.');
  useEffect(() => () => { generation.current++; controls.current?.stop(); }, []);
  const stop = () => { generation.current++; controls.current?.stop(); controls.current = null; setRunning(false); };
  async function start() {
    if (running) return;
    const current = ++generation.current;
    setRunning(true); setMessage('Starting camera…');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (current !== generation.current || !video.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, video.current, async (result, _error, scan) => {
        if (!result || processing.current || current !== generation.current) return;
        let token: string;
        try {
          const url = new URL(result.getText());
          if (!['scene044.in', 'www.scene044.in', window.location.hostname].includes(url.hostname)) throw new Error();
          const match = /^\/host\/checkin\/([a-f0-9]{48})$/.exec(url.pathname);
          if (!match) throw new Error(); token = match[1];
        } catch { setMessage('That is not a SCENE/044 booking QR. Point at the organiser’s booking pass.'); return; }
        processing.current = true; generation.current++; scan.stop(); controls.current = null; setRunning(false);
        try {
          const { booking } = await checkInBooking({ token });
          setMessage(booking.status === 'checked_in' ? `${booking.code} checked in. Timer is running below.` : `${booking.code}: ${booking.status}. Only paid, confirmed bookings can check in.`);
          onRefresh();
        } catch (e) { setMessage(e instanceof Error ? e.message : 'Check-in failed. Try the booking code instead.'); }
        finally { processing.current = false; }
      });
      if (current !== generation.current || processing.current) scanner.stop();
      else { controls.current = scanner; setMessage('Point your camera at the organiser’s booking QR.'); }
    } catch { if (current === generation.current) { setRunning(false); setMessage('Camera unavailable. Allow camera access on HTTPS, or enter the booking code below.'); } }
  }
  return <section className="space-y-3 border-2 border-ink bg-white p-4 shadow-hard">
    <video ref={video} muted playsInline aria-label="Booking QR camera preview" className={`aspect-square w-full max-w-[340px] mx-auto bg-ink object-cover ${running ? '' : 'hidden'}`} />
    <button type="button" className="min-h-11 w-full border border-ink bg-ink px-4 py-3 text-white" onClick={running ? stop : start}>{running ? 'Stop camera' : 'Scan booking QR'}</button>
    <p role="status" className="text-sm">{message}</p>
  </section>;
}
