import { useEffect, useState } from 'react'

const A = '/assets'
const types = ['Cafe / restaurant', 'Rooftop / terrace', 'Design studio', 'Event hall', 'Garden / courtyard', 'Workspace/ office']
const formats = ['Tech meetups', 'Workshops', 'Podcast recording', 'Product launches', 'Networking', 'Screenings', 'Photo / film shoots', 'Private dinners']
const amenities: [string, string][] = [
  ['High-speed wifi', 'b099e'],
  ['Projector / screen', '510c7'],
  ['Mics & PA', '80b2a'],
  ['Barista / catering', 'da7af'],
  ['Power backup', 'df40f'],
  ['On-site staff', 'f61c2'],
]

const label = 'font-mono-b text-[11px] uppercase tracking-[0.88px] text-ink'
const input =
  'w-full border-[1.5px] border-ink bg-white px-4 py-3 font-body text-sm text-ink shadow-hard-sm placeholder:text-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-flame focus-visible:ring-offset-2 focus-visible:ring-offset-paper'
const primary =
  'press inline-flex items-center gap-2 border-[1.5px] border-ink bg-flame px-6 py-3.5 font-mono-b text-xs uppercase tracking-[0.72px] text-white shadow-hard-sm disabled:cursor-not-allowed disabled:opacity-40'
const chip = (on: boolean) =>
  `press border-[1.5px] border-ink px-3.5 py-2.5 text-center font-body-m text-sm shadow-hard-sm ${on ? 'bg-flame text-white' : 'bg-white text-ink'}`

function TopBar({ onHome }: { onHome: () => void }) {
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur-md">
      <div className="px-5 py-4 md:px-8">
        <button type="button" onClick={onHome} aria-label="SCENE/044 home" className="font-mono-b text-sm tracking-[2.52px]">
          SCENE<span className="text-flame">/044</span>
        </button>
      </div>
    </header>
  )
}

function Stepper({ step }: { step: 1 | 2 }) {
  const items = ['Space basics', 'Capacity & fit']
  return (
    <ol className="flex flex-col gap-2 pt-8">
      {items.map((t, i) => {
        const n = i + 1
        const done = step > n
        const cur = step === n
        return (
          <li key={t} className="flex items-center gap-2.5" aria-current={cur ? 'step' : undefined}>
            <span
              className={`flex size-5 items-center justify-center font-mono-b text-[10px] text-white ${
                done ? 'bg-moss' : cur ? 'border-[1.5px] border-ink bg-flame shadow-hard-sm' : 'border-[1.5px] border-ink/30 bg-white text-muted'
              }`}
            >
              {done ? <img src={`${A}/3945b.svg`} alt="" className="size-3" /> : n}
            </span>
            <span className={`font-mono-b text-[10px] uppercase tracking-[0.6px] ${done ? 'text-moss' : cur ? 'text-ink' : 'text-muted'}`}>{t}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Counter({ id, value, onChange, min = 1 }: { id: string; value: number; onChange: (n: number) => void; min?: number }) {
  const btn = 'press flex size-10 items-center justify-center border-[1.5px] border-ink bg-white font-mono-b text-lg shadow-hard-sm disabled:opacity-40'
  return (
    <div className="flex items-center gap-3" role="group" aria-labelledby={id}>
      <button type="button" className={btn} aria-label="Decrease" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 5))}>
        −
      </button>
      <output className="min-w-12 text-center font-head text-2xl tabular-nums" aria-live="polite">
        {value}
      </output>
      <button type="button" className={btn} aria-label="Increase" onClick={() => onChange(value + 5)}>
        +
      </button>
    </div>
  )
}

export default function VenuePartner({ onHome }: { onHome: () => void }) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState(types[0])
  const [area, setArea] = useState('')
  const [seated, setSeated] = useState(30)
  const [standing, setStanding] = useState(50)
  const [picked, setPicked] = useState<string[]>([])
  const [amen, setAmen] = useState<string[]>([])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [step])

  const toggle = (list: string[], set: (l: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const valid1 = name.trim() && host.trim() && phone.replace(/\D/g, '').length >= 10 && area.trim()

  if (step === 3)
    return (
      <div className="flex min-h-screen flex-col bg-paper text-ink">
        <TopBar onHome={onHome} />
        <main className="flex flex-1 items-center justify-center px-5 py-12 md:px-8">
          <section className="page-in flex w-full max-w-[652px] flex-col items-center gap-8 border-[1.5px] border-ink bg-white px-6 pb-11 pt-12 shadow-hard-md md:px-14">
            <img src={`${A}/1d744.png`} alt="" className="size-[150px] object-cover" />
            <div className="flex flex-col items-center gap-4 text-center" role="status">
              <p className="font-mono-b text-[11px] uppercase tracking-[1.32px] text-flame">Venue partner application</p>
              <h1 className="font-head text-[32px] leading-[1.1] tracking-[-1px] md:text-[40px] md:leading-[44px]">Successfully submitted</h1>
              <p className="max-w-[500px] text-base leading-[26px] text-muted">The SCENE/044 team will get in touch with you within the next 48 hours.</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-4 border-[1.5px] border-ink bg-paper px-[18px] py-4">
              <span className="h-10 w-1 bg-flame" />
              <div className="min-w-[180px] flex-1">
                <p className="font-mono-b text-base uppercase tracking-[0.8px]">What happens next</p>
                <p className="mt-1 font-body-m text-sm text-muted">We’ll review your space details and contact you directly.</p>
              </div>
              <span className="rounded-full bg-[#ffe2dc] px-3 py-2 font-mono-b text-xs uppercase tracking-[0.6px] text-flame">Within 48 hrs</span>
            </div>
            <button type="button" onClick={onHome} className={`${primary} shadow-hard-md`}>
              Return to SCENE/044 <img src={`${A}/ca5e8.svg`} alt="" className="size-4" />
            </button>
          </section>
        </main>
      </div>
    )

  return (
    <div className="min-h-screen bg-paper text-ink">
      <TopBar onHome={onHome} />
      <main className="page-in mx-auto grid max-w-[1024px] gap-10 px-5 py-10 md:px-8 md:py-16 lg:grid-cols-[minmax(0,427fr)_minmax(0,469fr)] lg:gap-16">
        <div className="lg:self-start">
          <p className="font-mono-b text-xs uppercase tracking-[1.44px] text-flame">Hi, Venue partners</p>
          <h1 className="mt-3 font-head text-[30px] leading-[1.05] tracking-[-0.9px] md:text-4xl">Put your space on Chennai’s professional map.</h1>
          <p className="mt-4 max-w-[384px] text-base leading-[26px] text-muted">
            We're starting with a small group of cafes, studios, rooftops, and community spaces. SCENE handles the listing and booking flow; you stay in control of every request.
          </p>
          <Stepper step={step} />
        </div>

        {step === 1 ? (
          <form
            className="flex flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid1) setStep(2)
            }}
          >
            <div className="flex flex-col">
              <label htmlFor="vn" className={`${label} py-1`}>Venue name</label>
              <p className="pt-1 text-xs text-muted">What organisers will see at the top of your listing.</p>
              <input id="vn" className={`${input} mt-2.5`} placeholder="Backyard cafe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-6 pt-6 sm:grid-cols-2">
              <div>
                <label htmlFor="hn" className={`${label} block py-1`}>Host name</label>
                <input id="hn" className={`${input} mt-2.5`} placeholder="e.g. Time Cafe & Spaces" value={host} onChange={(e) => setHost(e.target.value)} />
              </div>
              <div>
                <label htmlFor="wa" className={`${label} block py-1`}>Whatsapp number</label>
                <input id="wa" type="tel" inputMode="tel" className={`${input} mt-2.5`} placeholder="e.g. 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>
            <fieldset className="pt-6">
              <legend className={`${label} py-1`}>What kind of space is it?</legend>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {types.map((t) => (
                  <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={chip(type === t)}>
                    {t}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="pt-6">
              <label htmlFor="nb" className={`${label} block py-1`}>Neighbourhood</label>
              <p className="pt-1 text-xs text-muted">Exact address stays private until a booking is confirmed. Mention location or add google maps link</p>
              <div className="mt-2.5 flex items-center gap-2 border-[1.5px] border-ink bg-white px-4 py-3 shadow-hard-sm focus-within:ring-2 focus-within:ring-flame focus-within:ring-offset-2 focus-within:ring-offset-paper">
                <img src={`${A}/60aa4.svg`} alt="" className="size-[15px]" />
                <input id="nb" className="w-full bg-transparent font-body text-sm placeholder:text-muted/50 focus:outline-none" placeholder="e.g. Nungambakkam, Chennai" value={area} onChange={(e) => setArea(e.target.value)} />
              </div>
            </div>
            <div className="flex items-center gap-3 pt-8">
              <button type="button" onClick={onHome} className="flex items-center gap-2 p-3 font-mono-b text-xs uppercase tracking-[0.72px] text-muted hover:text-ink">
                <img src={`${A}/b0720.svg`} alt="" className="size-[15px]" /> Cancel
              </button>
              <div className="flex flex-1 justify-end">
                <button type="submit" disabled={!valid1} className={primary}>
                  Continue <img src={`${A}/444f7.svg`} alt="" className="size-4" />
                </button>
              </div>
            </div>
          </form>
        ) : (
          <form
            className="flex flex-col"
            onSubmit={(e) => {
              e.preventDefault()
              setStep(3)
            }}
          >
            <fieldset>
              <legend className={`${label} py-1`}>Capacity</legend>
              <div className="mt-2.5 grid gap-4 sm:grid-cols-2">
                {[
                  ['Seated', seated, setSeated],
                  ['Standing', standing, setStanding],
                ].map(([t, v, s]) => (
                  <div key={t as string} className="border-[1.5px] border-ink bg-white p-4 shadow-hard-sm">
                    <p id={`cap-${t}`} className="mb-3 flex items-center gap-2 font-mono-b text-[11px] uppercase tracking-[0.88px] text-muted">
                      <img src={`${A}/f61c2.svg`} alt="" className="size-4" /> {t as string}
                    </p>
                    <Counter id={`cap-${t}`} value={v as number} onChange={s as (n: number) => void} />
                  </div>
                ))}
              </div>
            </fieldset>
            <fieldset className="pt-6">
              <legend className={`${label} py-1`}>Best suited for</legend>
              <p className="pt-1 text-xs text-muted">Pick every format your space genuinely handles well.</p>
              <div className="mt-2.5 flex flex-wrap gap-2.5">
                {formats.map((f) => (
                  <button key={f} type="button" aria-pressed={picked.includes(f)} onClick={() => toggle(picked, setPicked, f)} className={chip(picked.includes(f))}>
                    {f}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="pt-6">
              <legend className={`${label} py-1`}>Amenities</legend>
              <div className="mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {amenities.map(([t, ic]) => {
                  const on = amen.includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(amen, setAmen, t)}
                      className={`press flex items-center gap-2 border-[1.5px] border-ink px-3 py-2.5 text-left font-body-m text-[13px] shadow-hard-sm ${on ? 'bg-flame text-white' : 'bg-white text-ink'}`}
                    >
                      <img src={`${A}/${ic}.svg`} alt="" className={`size-4 shrink-0 ${on ? 'brightness-0 invert' : ''}`} />
                      {t}
                    </button>
                  )
                })}
              </div>
            </fieldset>
            <div className="flex items-center gap-3 pt-8">
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-2 p-3 font-mono-b text-xs uppercase tracking-[0.72px] text-muted hover:text-ink">
                <img src={`${A}/b0720.svg`} alt="" className="size-[15px]" /> Back
              </button>
              <div className="flex flex-1 justify-end">
                <button type="submit" className={primary}>
                  Submit <img src={`${A}/e0ddd.svg`} alt="" className="size-[15px]" />
                </button>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
