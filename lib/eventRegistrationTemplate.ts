/** Utility template; positional parameters match eventNotifications.ts exactly. */
export const EVENT_REGISTRATION_TEMPLATE_NAME = "scene_event_registration_confirmed_v1";

export const eventRegistrationTemplate = {
  name: EVENT_REGISTRATION_TEMPLATE_NAME,
  language: "en",
  category: "UTILITY",
  components: [
    { type: "HEADER", format: "TEXT", text: "Registration confirmed" },
    {
      type: "BODY",
      text: "Hi {{1}}, your registration for {{2}} is confirmed.\n\nDate & time: {{3}}\nVenue: {{4}}\nTicket ID: {{5}}\n\nYour payment has been received. Tap View ticket below for your pass and event details. Show your ticket at check-in.\n\nThis is a registration update from SCENE. Reply STOP to stop WhatsApp updates.",
      example: {
        body_text: [["Asha", "Let's do more reading", "22 November, 11:00 am IST", "Madras Adda, Mylapore, Chennai", "SCN-EVT-DEMO1234"]],
      },
    },
    { type: "FOOTER", text: "SCENE | Event registration" },
    {
      type: "BUTTONS",
      buttons: [{
        type: "URL",
        text: "View ticket",
        url: "https://scene044.in/events/{{1}}",
        // Synthetic example, never a real attendee's bearer ticket.
        example: ["https://scene044.in/events/let-s-do-more-reading-1?ticket=0000000000000000000000000000000000000000000000000000000000000000"],
      }],
    },
  ],
} as const;

/** Ignore Meta's review examples, but require the exact sending contract/content. */
export function matchesEventRegistrationTemplate(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.name !== eventRegistrationTemplate.name || candidate.language !== "en" || candidate.category !== "UTILITY" || !Array.isArray(candidate.components)) return false;
  const components = candidate.components as Record<string, unknown>[];
  if (components.length !== eventRegistrationTemplate.components.length) return false;
  return eventRegistrationTemplate.components.every(expected => {
    const actual = components.find(component => component.type === expected.type);
    if (!actual) return false;
    if (expected.type === "BUTTONS") {
      if (!Array.isArray(actual.buttons) || actual.buttons.length !== 1) return false;
      const button = actual.buttons[0] as Record<string, unknown>;
      return button.type === "URL" && button.text === expected.buttons[0].text && button.url === expected.buttons[0].url;
    }
    return actual.text === expected.text && (expected.type !== "HEADER" || actual.format === expected.format);
  });
}
