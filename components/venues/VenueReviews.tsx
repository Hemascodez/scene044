"use client";

import { useState } from "react";
import type { AspectScore, ReviewSummary, VenueReview } from "@/lib/venueBookings";
import { SelfReviewForm } from "@/components/venues/SelfReviewForm";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";
import { LottiePlayer } from "@/components/ui/LottiePlayer";

function AspectBar({ aspect }: { aspect: AspectScore }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-24 shrink-0 text-xs font-semibold sm:text-sm">{aspect.tag}</span>
      <div className="h-2 flex-1 overflow-hidden border border-foreground/30 bg-venue-paper">
        <div className="h-full bg-signal-ink" style={{ width: `${aspect.percent}%` }} />
      </div>
      <span className="w-32 shrink-0 text-right text-xs text-muted-foreground">
        {aspect.percent}% · {aspect.count} review{aspect.count === 1 ? "" : "s"}
      </span>
    </div>
  );
}

function ReviewRow({ review }: { review: VenueReview }) {
  return (
    <div className="border-b border-foreground/15 py-4 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-bold">{review.organizerName ?? "Anonymous organizer"}</p>
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {new Date(review.createdAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
        </span>
      </div>
      {review.eventType && <p className="text-xs text-muted-foreground">{review.eventType}</p>}
      {review.comment && <p className="mt-2 text-sm leading-6">{review.comment}</p>}
      {review.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {review.tags.map((tag) => (
            <span key={tag} className="border border-foreground/30 bg-venue-paper px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>
      )}
      {review.source === "booking" && (
        <span className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] font-bold uppercase tracking-[0.06em] text-signal-ink">
          <VenueIcon name="shield" className="size-3.5" /> Booked through SCENE
        </span>
      )}
    </div>
  );
}

export function VenueReviews({
  venueSlug,
  venueName,
  reviews,
  summary,
  aspects,
}: {
  venueSlug: string;
  venueName: string;
  reviews: VenueReview[];
  summary: ReviewSummary;
  aspects: AspectScore[];
}) {
  const [formOpen, setFormOpen] = useState(false);

  if (formOpen) {
    return <SelfReviewForm venueSlug={venueSlug} venueName={venueName} onDone={() => setFormOpen(false)} />;
  }

  if (summary.count === 0) {
    return (
      <div className="mt-6 border-[1.5px] border-dashed border-foreground/60 bg-venue-card p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <span className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border-[1.5px] border-foreground bg-secondary text-primary-ink">
            <LottiePlayer
              src="/lottie/empty-reviews.json"
              className="size-16"
              fallback={<VenueIcon name="star" className="size-5" />}
            />
          </span>
          <div>
            <p className="font-display text-xl font-extrabold tracking-[-0.02em]">No reviews yet</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {venueName} is newly listed. Reviews come from organizers who booked through SCENE, or from
              anyone who has hosted here before.
            </p>
            <button type="button" onClick={() => setFormOpen(true)} className={`${venueButton.outline} mt-4`}>
              Already hosted here? Add your review
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-display text-2xl font-extrabold">
          {summary.averageRating}/5 <span className="text-base font-normal text-muted-foreground">· {summary.count} review{summary.count === 1 ? "" : "s"}</span>
        </p>
        <button type="button" onClick={() => setFormOpen(true)} className={venueButton.outline}>
          Already hosted here? Add your review
        </button>
      </div>

      {aspects.length > 0 && (
        <div className="mt-5 flex flex-col gap-2.5 border-[1.5px] border-foreground bg-venue-card p-4 shadow-hard-sm">
          {aspects.map((a) => (
            <AspectBar key={a.tag} aspect={a} />
          ))}
        </div>
      )}

      <div className="mt-5 border-[1.5px] border-foreground bg-venue-card px-5 shadow-hard-sm">
        {reviews.map((r) => (
          <ReviewRow key={r.id} review={r} />
        ))}
      </div>
    </div>
  );
}
