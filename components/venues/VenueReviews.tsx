import { VenueIcon } from "@/components/venues/VenueUi";

/**
 * Reviews, before there are any.
 *
 * This replaced three invented five-star testimonials with attributed names.
 * They were labelled "Sample", but fabricated praise sitting beside a genuine
 * "visited & verified" badge and a real dining rating undercuts the signals
 * that are true — and this product's whole premise is that nothing is invented.
 * An honest empty state is worth more than borrowed credibility.
 */
export function VenueReviews({ venueName }: { venueName: string }) {
  return (
    <div className="mt-6 rounded-[22px] border border-dashed border-venue-line bg-secondary/40 p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-card text-primary-ink">
          <VenueIcon name="star" className="size-5" />
        </span>
        <div>
          <p className="font-display text-xl font-black tracking-[-0.03em]">No reviews yet</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
            {venueName} is newly listed. Reviews here will only ever come from organizers who actually
            completed a booking through SCENE — so the first one will arrive after the first event
            wraps, not before.
          </p>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            In the meantime: the photos are ours from an in-person visit, and the capacity, rates, and
            house rules were confirmed with the owner.
          </p>
        </div>
      </div>
    </div>
  );
}
