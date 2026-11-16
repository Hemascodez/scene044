/** Utility reminders; parameter order and URL prefix match eventNotifications.ts. */
export const eventReminderTemplates = [
  {
    key: "day-before",
    name: "scene_event_day_before_v1",
    header: "Your event is tomorrow",
    intro: "Hi {{1}}, this is SCENE with a reminder for your confirmed registration for {{2}} tomorrow.",
  },
  {
    key: "morning-of",
    name: "scene_event_morning_of_v1",
    header: "Your event is today",
    intro: "Hi {{1}}, this is SCENE with a reminder for your confirmed registration for {{2}} today.",
  },
  {
    key: "directions",
    name: "scene_event_directions_v1",
    header: "Your event venue details",
    intro: "Hi {{1}}, here are the venue details for your confirmed registration for {{2}} from SCENE.",
  },
] as const;

export function eventReminderTemplate(key: (typeof eventReminderTemplates)[number]["key"]) {
  const definition = eventReminderTemplates.find(item => item.key === key)!;
  return {
    name: definition.name,
    language: "en",
    category: "UTILITY",
    components: [
      { type: "HEADER", format: "TEXT", text: definition.header },
      {
        type: "BODY",
        text: `${definition.intro}\n\nDate & time: {{3}}\n${key === "directions" ? "Venue address" : "Venue"}: {{4}}\nTicket ID: {{5}}\n\nTap View ticket for your pass and event details. Show your ticket at check-in.\n\nReply STOP to stop WhatsApp updates.`,
        example: {
          body_text: [["Asha", "Chapter Lounge - Sunday Reads", "22 November, 11:00 am IST", key === "directions" ? "119, Dr Radha Krishnan Salai, Mylapore, Chennai 600004" : "Madras Adda, Chennai", "SCN-EVT-A1B2C3D4E5"]],
        },
      },
      { type: "FOOTER", text: "SCENE | Event reminder" },
      {
        type: "BUTTONS",
        buttons: [{
          type: "URL", text: "View ticket", url: "https://scene044.in/events/{{1}}",
          // Synthetic credential, never an attendee's actual private pass.
          example: ["https://scene044.in/events/chapter-lounge-sunday-reads-1/ticket?ticket=" + "0".repeat(64)],
        }],
      },
    ],
  } as const;
}

/** Ignore review examples/status, but never activate a different sending contract. */
export function matchesEventReminderTemplate(value: unknown, key: (typeof eventReminderTemplates)[number]["key"]): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const expected = eventReminderTemplate(key);
  if (candidate.name !== expected.name || candidate.language !== expected.language || candidate.category !== expected.category || !Array.isArray(candidate.components)) return false;
  const components = candidate.components as Record<string, unknown>[];
  if (components.length !== expected.components.length) return false;
  return expected.components.every(component => {
    const actual = components.find(item => item.type === component.type);
    if (!actual) return false;
    if (component.type === "BUTTONS") {
      if (!Array.isArray(actual.buttons) || actual.buttons.length !== 1) return false;
      const button = actual.buttons[0] as Record<string, unknown>;
      return button.type === "URL" && button.text === component.buttons[0].text && button.url === component.buttons[0].url;
    }
    return actual.text === component.text && (component.type !== "HEADER" || actual.format === component.format);
  });
}
