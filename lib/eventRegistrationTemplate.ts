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
