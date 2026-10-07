import { CHANDRU_TESTIMONIAL } from "@/lib/venueTestimonials";
import { Quote } from "./icons";

export function ChandruTestimonial({ variant = 'compact' }: { variant?: 'compact' | 'landing' }) {
  return <figure className={`w-full min-w-0 max-w-96 self-start border-[1.5px] border-ink p-3 font-body text-ink shadow-hard-lg ${variant === 'landing' ? 'bg-paper' : 'bg-white'}`}>
    <ul aria-label="Chandru’s event photos" className="grid gap-2">
      {CHANDRU_TESTIMONIAL.eventPhotos.map(photo => <li key={photo.src}>
        <a href={photo.src} target="_blank" rel="noopener noreferrer" aria-label={`${photo.alt} (open full photo in a new tab)`} className="block">
          <img src={photo.src} alt={photo.alt} className="aspect-video w-full border border-ink object-cover" loading="lazy" />
        </a>
      </li>)}
    </ul>
    <div className="px-2 pt-4">
      <Quote aria-hidden="true" className="size-5 text-primary-ink" />
      <blockquote className="mt-2 text-base leading-6">“{CHANDRU_TESTIMONIAL.quote}”</blockquote>
    </div>
      <figcaption className="mx-2 mt-4 flex items-center gap-3 border-t border-line pt-3 pb-2">
        <img src={CHANDRU_TESTIMONIAL.profilePhoto} alt="Chandru" className="size-10 shrink-0 rounded-full border border-ink object-cover" loading="lazy" />
        <div className="min-w-0"><p className="font-head text-base">{CHANDRU_TESTIMONIAL.name}</p>
        <p className="mt-0.5 text-xs text-stone">{CHANDRU_TESTIMONIAL.role}</p></div>
      </figcaption>
  </figure>;
}
