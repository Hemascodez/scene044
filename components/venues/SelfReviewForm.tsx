"use client";

import { useState } from "react";
import { REVIEW_TAGS } from "@/lib/venueReviewTags";
import { submitSelfReportedReview, VenueReviewApiError } from "@/lib/client/venueReviewApi";
import { VenueIcon, venueButton } from "@/components/venues/VenueUi";

const RATINGS = [
  { value: 3, emoji: "🙂", label: "Satisfied" },
  { value: 4, emoji: "😄", label: "Good" },
  { value: 5, emoji: "🤩", label: "Great" },
] as const;

/**
 * "Already hosted here? Add your review" — open to anyone, not gated to a
 * SCENE booking. Submissions land in the curator's approval queue rather than
 * publishing immediately (app/api/venues/[slug]/reviews), so opening this up
 * doesn't cost the page its honesty.
 */
export function SelfReviewForm({ venueSlug, venueName, onDone }: { venueSlug: string; venueName: string; onDone: () => void }) {
  const [reviewerName, setReviewerName] = useState("");
  const [eventType, setEventType] = useState("");
  const [rating, setRating] = useState<3 | 4 | 5 | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function toggleTag(tag: string) {
    setTags((current) => (current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag]));
  }

  async function submit() {
    if (!reviewerName.trim() || !rating) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitSelfReportedReview(venueSlug, {
        reviewerName: reviewerName.trim(),
        eventType: eventType.trim(),
        rating,
        tags,
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof VenueReviewApiError ? err.message : "Could not submit right now. Try again shortly.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="border-[1.5px] border-foreground bg-venue-card p-6 text-center shadow-hard">
        <span className="mx-auto grid size-10 place-items-center border-[1.5px] border-foreground bg-signal text-white">
          <VenueIcon name="check" className="size-5" />
        </span>
        <p className="mt-3 font-display text-lg font-extrabold">Thanks — sent for a quick check.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your review will appear on {venueName}&apos;s page once a curator confirms it.
        </p>
        <button type="button" onClick={onDone} className={`${venueButton.outline} mt-4`}>
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="border-[1.5px] border-foreground bg-venue-card p-5 shadow-hard sm:p-6">
      <p className="font-display text-lg font-extrabold">Already hosted here?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Share how it went — this goes to a curator for a quick check before it&apos;s shown publicly.
      </p>

      <label className="mt-4 block text-xs font-bold">
        Your name
        <input
          value={reviewerName}
          onChange={(e) => setReviewerName(e.target.value)}
          maxLength={80}
          placeholder="e.g. Priya, Chennai Data Circle"
          className="mt-1.5 min-h-11 w-full border-[1.5px] border-foreground bg-white px-3 text-sm outline-none transition-shadow focus:shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <label className="mt-3 block text-xs font-bold">
        What kind of event? (optional)
        <input
          value={eventType}
          onChange={(e) => setEventType(e.target.value)}
          maxLength={80}
          placeholder="e.g. Tech meetup"
          className="mt-1.5 min-h-11 w-full border-[1.5px] border-foreground bg-white px-3 text-sm outline-none transition-shadow focus:shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      <div className="mt-4">
        <span className="text-xs font-bold">How was it?</span>
        <div className="mt-2 flex gap-2">
          {RATINGS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRating(r.value)}
              aria-pressed={rating === r.value}
              className={`flex flex-1 flex-col items-center gap-1 border-[1.5px] py-3 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                rating === r.value ? "border-foreground bg-primary/15 shadow-hard-sm" : "border-foreground/40 hover:border-foreground"
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {r.emoji}
              </span>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        <span className="text-xs font-bold">What stood out? (optional)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              aria-pressed={tags.includes(tag)}
              className={`border-[1.5px] px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                tags.includes(tag) ? "border-foreground bg-foreground text-background" : "border-foreground/40 text-muted-foreground hover:border-foreground"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <label className="mt-4 block text-xs font-bold">
        Anything else? (optional)
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="A short note for organizers considering this space"
          className="mt-1.5 w-full border-[1.5px] border-foreground bg-white px-3 py-2 text-sm outline-none transition-shadow focus:shadow-hard-sm focus-visible:ring-2 focus-visible:ring-primary"
        />
      </label>

      {error && <p role="alert" className="mt-3 text-sm font-semibold text-primary-ink">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={submitting || !reviewerName.trim() || !rating}
        className={`${venueButton.primary} mt-4 w-full`}
      >
        {submitting ? "Sending…" : "Submit review"}
      </button>
    </div>
  );
}
