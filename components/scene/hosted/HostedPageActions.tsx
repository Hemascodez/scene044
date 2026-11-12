"use client";

import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import { eventPath } from "@/lib/seo";
import { Btn, SaveIcon } from "@/components/scene/ui";

/** Save and Share for hosted events — the existing pair, minus "View original". */
export function HostedPageActions({ id, title, startAt }: { id: number; title: string; startAt: string | null }) {
  const saved = useSavedEvents();

  function share() {
    const when = startAt ? ` — ${formatSceneDate(startAt)}, ${formatSceneTime(startAt)} IST` : "";
    const text = `${title}${when}. Hosted by SCENE/044.`;
    const url = `${window.location.origin}${eventPath({ id, title })}`;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {
        /* dismissed */
      });
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <Btn variant="outline" className="min-h-11 w-full" onClick={() => saved.toggle(id)}>
        <SaveIcon filled={saved.has(id)} />
        {saved.has(id) ? "Saved" : "Save"}
      </Btn>
      <Btn variant="outline" className="min-h-11 w-full" onClick={share}>
        Share
      </Btn>
    </div>
  );
}
