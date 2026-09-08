"use client";

import { formatSceneDate, formatSceneTime } from "@/lib/client/istTime";
import { recordViewedEvent } from "@/lib/client/lastViewedEvent";
import { useOpensInNewTab } from "@/lib/client/usePointerType";
import { useSavedEvents } from "@/lib/client/useSavedEvents";
import { eventPath } from "@/lib/seo";
import { Btn, BtnLink, SaveIcon } from "@/components/scene/ui";

export function EventPageActions({
  id,
  title,
  startAt,
}: {
  id: number;
  title: string;
  startAt: string | null;
}) {
  const saved = useSavedEvents();
  const newTab = useOpensInNewTab();

  function share() {
    const when = startAt ? ` — ${formatSceneDate(startAt)}, ${formatSceneTime(startAt)} IST` : "";
    const text = `${title}${when}. Found on SCENE/044.`;
    const url = `${window.location.origin}${eventPath({ id, title })}`;
    if (navigator.share) {
      navigator.share({ title, text, url }).catch(() => {
        /* The visitor dismissed the native share sheet. */
      });
      return;
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <BtnLink
        href={`/api/go/${id}`}
        variant="solid"
        className="col-span-2 w-full"
        newTab={newTab}
        onNavigate={() => recordViewedEvent(id)}
      >
        View original {newTab ? "↗" : "→"}
      </BtnLink>
      <Btn variant="outline" className="w-full" onClick={() => saved.toggle(id)}>
        <SaveIcon filled={saved.has(id)} />
        {saved.has(id) ? "Saved" : "Save"}
      </Btn>
      <Btn variant="outline" className="w-full" onClick={share}>
        Share
      </Btn>
    </div>
  );
}
