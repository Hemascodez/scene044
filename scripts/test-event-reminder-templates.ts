import assert from "node:assert/strict";
import { eventReminderTemplates, eventReminderTemplate, matchesEventReminderTemplate } from "../lib/eventReminderTemplates";
import { buildWhatsappTemplatePayload } from "../lib/whatsappSend";

assert.deepEqual(eventReminderTemplates.map(item => item.key), ["day-before", "morning-of", "directions"]);
for (const { key } of eventReminderTemplates) {
  const template = eventReminderTemplate(key);
  assert.equal(template.category, "UTILITY");
  assert.equal(template.language, "en");
  assert.equal(matchesEventReminderTemplate(template, key), true);
  assert.equal(matchesEventReminderTemplate({ ...template, category: "MARKETING" }, key), false);
  assert.equal(matchesEventReminderTemplate({ ...template, components: [] }, key), false);
  assert.equal(matchesEventReminderTemplate({ ...template, components: template.components.map(item => item.type === "BODY" ? { ...item, text: "Other message" } : item) }, key), false);
  assert.equal(matchesEventReminderTemplate({ ...template, components: template.components.map(item => item.type === "BUTTONS" ? { ...item, buttons: [{ ...item.buttons[0], url: "https://other.example/{{1}}" }] } : item) }, key), false);
  const body = template.components[1];
  assert.deepEqual([...body.text.matchAll(/\{\{(\d+)\}\}/g)].map(match => Number(match[1])), [1, 2, 3, 4, 5]);
  assert.equal(body.example.body_text[0].length, 5);
  assert.ok(body.text.length < 1024);
  assert.ok(body.text.includes("Reply STOP"));
  assert.match(body.text, /confirmed registration/);
  assert.match(template.components[3].buttons[0].example[0], /\/ticket\?ticket=0{64}$/);
  const payload = buildWhatsappTemplatePayload({ to: "919000000000", name: template.name, language: template.language, bodyParameters: [...body.example.body_text[0]], urlButtonSuffix: "chapter-lounge-sunday-reads-1/ticket?ticket=" + "0".repeat(64) });
  assert.equal(payload.template.components.find(item => item.type === "body")?.parameters.length, 5);
  assert.ok(!payload.template.components.some(item => item.type === "header"));
  assert.equal(payload.template.components.find(item => item.type === "button")?.parameters[0].type, "text");
}
console.log("PASS all three utility reminder templates, exact five-parameter sending contract, private ticket button, synthetic samples and STOP; no messages or network calls");
