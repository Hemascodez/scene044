/**
 * The ticket-printer sound, synthesised with Web Audio so there is no audio
 * file to host or license: thermal-printer chatter on each paper-feed step,
 * a cutter "chk" as the feed stops, and a soft bell as the ticket settles.
 *
 * Timing is shared with the TicketPrinter animation (PRINT_TIMING is passed to
 * it as CSS variables), so every burst lines up with a visible feed step.
 *
 * Browsers only let a page make sound after the visitor interacts with it, and
 * Safari only unlocks audio inside the tap itself. So `primeTicketSound()` runs
 * synchronously in the Pay / Verify tap, and `playTicketPrint()` later, when
 * the server has confirmed the payment.
 */

export const PRINT_TIMING = { feedMs: 1600, feedSteps: 24, settleMs: 350 } as const;

export interface PrintTiming {
  feedMs: number;
  feedSteps: number;
  settleMs: number;
}

export interface PrintSchedule {
  /** ms from the start of the feed, one per step. */
  bursts: number[];
  cutAt: number;
  dingAt: number;
}

export function ticketPrintSchedule(timing: PrintTiming): PrintSchedule {
  const step = timing.feedMs / timing.feedSteps;
  return {
    bursts: Array.from({ length: timing.feedSteps }, (_, i) => i * step),
    cutAt: timing.feedMs,
    dingAt: timing.feedMs + timing.settleMs,
  };
}

// ------------------------------------------------------------- Web Audio

type AudioContextCtor = typeof AudioContext;

let context: AudioContext | null = null;

function audioContextClass(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as typeof window & { webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Call inside the visitor's tap. Safe to call more than once. */
export function primeTicketSound(): void {
  try {
    const Ctor = audioContextClass();
    if (!Ctor) return;
    context ??= new Ctor();
    if (context.state === "suspended") void context.resume();
  } catch {
    // Audio unavailable — the animation still plays silently.
  }
}

function noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function noiseBurst(
  ctx: AudioContext,
  out: AudioNode,
  at: number,
  { duration, frequency, q, gain }: { duration: number; frequency: number; q: number; gain: number },
): void {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = frequency;
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  source.connect(filter).connect(env).connect(out);
  source.start(at);
  source.stop(at + duration + 0.01);
}

function bell(ctx: AudioContext, out: AudioNode, at: number): void {
  for (const [frequency, level] of [[1318.5, 0.18], [1975.5, 0.08]] as const) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = frequency;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(level, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.9);
    osc.connect(env).connect(out);
    osc.start(at);
    osc.stop(at + 0.95);
  }
}

/** Plays the print: motor hum + chatter, cutter, bell. Silent if audio is locked or unavailable. */
export function playTicketPrint(timing: PrintTiming = PRINT_TIMING): void {
  try {
    if (!context || context.state !== "running") return;
    const ctx = context;
    const schedule = ticketPrintSchedule(timing);
    const start = ctx.currentTime + 0.03;
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);

    // Low motor hum under the feed.
    const motor = ctx.createOscillator();
    motor.type = "sawtooth";
    motor.frequency.value = 92;
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = "lowpass";
    motorFilter.frequency.value = 400;
    const motorGain = ctx.createGain();
    const feedEnd = start + schedule.cutAt / 1000;
    motorGain.gain.setValueAtTime(0.0001, start);
    motorGain.gain.exponentialRampToValueAtTime(0.06, start + 0.05);
    motorGain.gain.setValueAtTime(0.06, feedEnd - 0.05);
    motorGain.gain.exponentialRampToValueAtTime(0.0001, feedEnd);
    motor.connect(motorFilter).connect(motorGain).connect(master);
    motor.start(start);
    motor.stop(feedEnd + 0.02);

    // Thermal print-head chatter, one burst per feed step.
    for (const ms of schedule.bursts) {
      noiseBurst(ctx, master, start + ms / 1000, { duration: 0.035, frequency: 3400, q: 1.4, gain: 0.35 });
    }
    // Cutter.
    noiseBurst(ctx, master, start + schedule.cutAt / 1000, { duration: 0.06, frequency: 1800, q: 0.8, gain: 0.7 });
    // Ticket ready.
    bell(ctx, master, start + schedule.dingAt / 1000);
  } catch {
    // Never let sound break the confirmation.
  }
}
