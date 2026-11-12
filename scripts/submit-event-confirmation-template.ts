import assert from "node:assert/strict";
import { eventRegistrationTemplate as template } from "../lib/eventRegistrationTemplate";

// Loads no env file: use only an explicitly selected service's existing Meta credentials.
// Default is read-only. --submit creates this one template, never sends a message.
async function main() {
  const args = process.argv.slice(2);
  const waba = args.find((arg) => /^--waba=\d+$/.test(arg))?.split("=")[1];
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
    if (!response.ok || result.error) {
      // Avoid printing access tokens, URLs or arbitrary provider response bodies.
      throw new Error(`Meta rejected the request (HTTP ${response.status}, code ${result.error?.code ?? "unknown"}, subcode ${result.error?.error_subcode ?? "none"}).`);
    }
    return result;
  }
  const phones = await graph(`${waba}/phone_numbers?fields=id&limit=100`);
  assert.ok(phones.data?.some((phone: {id: string}) => phone.id === phoneId), "This WABA does not contain the website's configured WhatsApp sender. Nothing changed.");
  const existing = await graph(`${waba}/message_templates?name=${template.name}&fields=id,name,status,category,language,components&limit=100`);
  const found = existing.data?.find((item: {name: string; language: string}) => item.name === template.name && item.language === template.language);
  if (found) {
    console.log(JSON.stringify({ name: found.name, id: found.id, status: found.status, category: found.category, language: found.language, existing: true }));
    return;
  }
  if (!args.includes("--submit")) {
    console.log(JSON.stringify({ name: template.name, exists: false, category: template.category, language: template.language, bodyParameters: 5, button: "View ticket", submitted: false }));
    return;
  }
  // Do not retry a timed-out POST: rerun the read-only check to resolve its outcome.
  const result = await graph(`${waba}/message_templates`, template);
  console.log(JSON.stringify({ name: template.name, id: result.id, status: result.status, category: result.category, submitted: true }));
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Template operation failed.");
  process.exitCode = 1;
});
