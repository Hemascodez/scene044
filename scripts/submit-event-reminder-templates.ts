import assert from "node:assert/strict";
import { eventReminderTemplates, eventReminderTemplate, matchesEventReminderTemplate } from "../lib/eventReminderTemplates";

// Read-only unless --submit is explicit. Never sends or queues an attendee message.
async function main() {
  const args = process.argv.slice(2);
  const waba = args.find(arg => /^--waba=\d+$/.test(arg))?.split("=")[1];
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const version = process.env.WHATSAPP_GRAPH_API_VERSION;
  assert.ok(waba && token && phoneId && /^v\d+\.\d+$/.test(version ?? ""), "Select a WABA and the website's existing Meta configuration.");
  async function graph(path: string, body?: unknown) {
    const response = await fetch(`https://graph.facebook.com/${version}/${path}`, {
      method: body ? "POST" : "GET",
      headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json();
    if (!response.ok || result.error) throw new Error(`Meta rejected the request (HTTP ${response.status}, code ${result.error?.code ?? "unknown"}, subcode ${result.error?.error_subcode ?? "none"}).`);
    return result;
  }
  const phones = await graph(`${waba}/phone_numbers?fields=id&limit=100`);
  assert.ok(phones.data?.some((phone: { id: string }) => phone.id === phoneId), "This WABA does not contain the website's sender. Nothing changed.");
  for (const { key } of eventReminderTemplates) {
    const definition = eventReminderTemplate(key);
    const existing = await graph(`${waba}/message_templates?name=${definition.name}&fields=id,name,status,category,language,components&limit=100`);
    const found = existing.data?.find((item: { name: string; language: string }) => item.name === definition.name && item.language === definition.language);
    if (found) {
      console.log(JSON.stringify({ key, name: found.name, id: found.id, status: found.status, category: found.category, language: found.language, matchesDefinition: matchesEventReminderTemplate(found, key), existing: true }));
      continue;
    }
    if (!args.includes("--submit")) {
      console.log(JSON.stringify({ key, name: definition.name, exists: false, submitted: false }));
      continue;
    }
    // A failed/timed-out POST stops the script. Resolve with read-only lookup before retrying.
    const result = await graph(`${waba}/message_templates`, definition);
    console.log(JSON.stringify({ key, name: definition.name, id: result.id, status: result.status, category: result.category, submitted: true }));
  }
}
void main().catch(error => {
  console.error(error instanceof Error ? error.message : "Reminder template operation failed.");
  process.exitCode = 1;
});
