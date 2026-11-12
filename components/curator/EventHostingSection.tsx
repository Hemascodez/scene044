"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AdminBtn,
  Field,
  Select,
  TextInput,
  TextArea as Textarea,
  Pill,
} from "./adminUi";

type HostedChoice = {
  id: number;
  title: string;
  status: string;
  hostName: string | null;
  hostPerson: string | null;
  pricePaise: number | null;
  capacity: number | null;
  registrationState: string | null;
  description: string | null;
  refundPolicy: string | null;
  terms: string[] | null;
  gallery: { src: string; alt: string }[] | null;
};
type Access = {
  id: number;
  eventId: number;
  eventTitle: string;
  phone: string;
  label: string;
  revokedAt: string | null;
};
const blank = {
  hostName: "",
  hostPerson: "",
  price: "",
  capacity: "",
  registrationState: "closed",
  description: "",
  refundPolicy: "",
  terms: "",
};

export function EventHostingSection() {
  const [events, setEvents] = useState<HostedChoice[]>([]);
  const [hosts, setHosts] = useState<Access[]>([]);
  const [eventId, setEventId] = useState("");
  const [form, setForm] = useState(blank);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const loadData = useCallback(async () => {
    const response = await fetch("/api/admin/event-hosts", {
      cache: "no-store",
    });
    const data = (await response.json()) as {
      events: HostedChoice[];
      hosts: Access[];
      error?: string;
    };
    if (!response.ok)
      throw new Error(data.error ?? "Could not load event hosting.");
    return data;
  }, []);
  const reload = useCallback(async () => {
    const data = await loadData();
    setEvents(data.events);
    setHosts(data.hosts);
    return data.events;
  }, [loadData]);
  useEffect(() => {
    let active = true;
    void loadData()
      .then((data) => {
        if (active) {
          setEvents(data.events);
          setHosts(data.hosts);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [loadData]);

  function choose(id: string, choices = events) {
    setEventId(id);
    const e = choices.find((e) => String(e.id) === id);
    setForm(
      e
        ? {
            hostName: e.hostName ?? "",
            hostPerson: e.hostPerson ?? "",
            price: e.pricePaise === null ? "" : String(e.pricePaise / 100),
            capacity: e.capacity === null ? "" : String(e.capacity),
            registrationState: e.registrationState ?? "closed",
            description: e.description ?? "",
            refundPolicy: e.refundPolicy ?? "",
            terms: (e.terms ?? []).join("\n"),
          }
        : blank,
    );
    setError("");
    setNotice("");
  }
  async function mutate(path: string, method: string, body?: object) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as {
      error?: string;
      notice?: string;
      eventId?: number;
    };
    if (!response.ok)
      throw new Error(data.error ?? "Could not save. Please retry.");
    return data;
  }
  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const selected = events.find((e) => String(e.id) === eventId);
  const update = (key: keyof typeof blank, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  return (
    <section className="space-y-6 p-4 lg:p-6">
      <div>
        <h1 className="font-display text-2xl font-black">Event hosting</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a9bcb0]">
          Set up on-site ticketing and approve each host for a specific event.
          Guest lists, check-in and payment reports stay private to approved
          hosts. Saving here does not publish an event.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <AdminBtn
          className="min-h-11"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const result = await mutate("/api/admin/hosted-events", "POST", {
                action: "prepare-chapter-lounge",
              });
              const choices = await reload();
              choose(String(result.eventId), choices);
              setNotice(result.notice ?? "Draft prepared.");
            })
          }
        >
          Prepare Chapter Lounge draft
        </AdminBtn>
        <p className="text-sm text-[#a9bcb0]">
          Uses the supplied event details and photos. Starts closed, with zero
          registrations.
        </p>
      </div>
      {error && (
        <p
          role="alert"
          className="border border-[#8a3630] p-3 text-sm text-[#ff9a8a]"
        >
          {error}
        </p>
      )}
      <p role="status" className="text-sm text-[#5effb0]">
        {notice}
      </p>
      <div className="max-w-2xl">
        <Field label="Select event" required>
          <Select
            className="min-h-11"
            disabled={loading || busy}
            value={eventId}
            onChange={(e) => choose(e.target.value)}
          >
            <option value="">
              {loading ? "Loading events…" : "Choose an event"}
            </option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} · {e.status}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {selected && (
        <>
          <form
            className="max-w-2xl space-y-4 border border-[#25382e] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                if (!/^\d+(\.\d{1,2})?$/.test(form.price))
                  throw new Error(
                    "Enter a ticket price in rupees (up to two decimal places).",
                  );
                await mutate("/api/admin/hosted-events", "POST", {
                  eventId: selected.id,
                  hostName: form.hostName,
                  hostPerson: form.hostPerson,
                  pricePaise: Math.round(Number(form.price) * 100),
                  capacity: Number(form.capacity),
                  registrationState: form.registrationState,
                  description: form.description,
                  refundPolicy: form.refundPolicy,
                  terms: form.terms
                    .split("\n")
                    .map((t) => t.trim())
                    .filter(Boolean),
                  gallery: selected.gallery ?? [],
                });
                await reload();
                setNotice(
                  "Ticketing settings saved. Publication status was not changed. Existing paid tickets keep their original price.",
                );
              });
            }}
          >
            <h2 className="font-display text-lg font-bold">
              Ticketing settings
            </h2>
            <Field label="Organising community / host name" required>
              <TextInput
                className="min-h-11"
                required
                maxLength={120}
                value={form.hostName}
                onChange={(e) => update("hostName", e.target.value)}
              />
            </Field>
            <Field label="Host person">
              <TextInput
                className="min-h-11"
                maxLength={120}
                value={form.hostPerson}
                onChange={(e) => update("hostPerson", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Ticket price (₹)" required>
                <TextInput
                  className="min-h-11"
                  inputMode="decimal"
                  required
                  value={form.price}
                  onChange={(e) => update("price", e.target.value)}
                />
              </Field>
              <Field label="Capacity" required>
                <TextInput
                  className="min-h-11"
                  type="number"
                  min={1}
                  max={10000}
                  required
                  value={form.capacity}
                  onChange={(e) => update("capacity", e.target.value)}
                />
              </Field>
            </div>
            <Field label="Registration">
              <Select
                className="min-h-11"
                value={form.registrationState}
                onChange={(e) => update("registrationState", e.target.value)}
              >
                <option value="closed">Closed</option>
                <option value="open">Open after the event is published</option>
                <option value="sold_out">Sold out</option>
              </Select>
            </Field>
            <Field label="Event description" required>
              <Textarea
                rows={5}
                required
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </Field>
            <Field label="Refund policy" required>
              <Textarea
                rows={2}
                required
                value={form.refundPolicy}
                onChange={(e) => update("refundPolicy", e.target.value)}
              />
            </Field>
            <Field label="Terms (one item per line)" required>
              <Textarea
                rows={5}
                required
                value={form.terms}
                onChange={(e) => update("terms", e.target.value)}
              />
            </Field>
            <AdminBtn
              type="submit"
              variant="primary"
              className="min-h-11"
              disabled={busy}
            >
              Save ticketing settings
            </AdminBtn>
          </form>
          <form
            className="max-w-2xl space-y-4 border border-[#25382e] p-4"
            onSubmit={(e) => {
              e.preventDefault();
              void action(async () => {
                await mutate("/api/admin/event-hosts", "POST", {
                  eventId: selected.id,
                  phone,
                  label: name,
                });
                await reload();
                setName("");
                setPhone("");
                setNotice(
                  `Host approved for ${selected.title}. They can sign in using this number after publication.`,
                );
              });
            }}
          >
            <h2 className="font-display text-lg font-bold">Add event host</h2>
            <p className="text-sm text-[#a9bcb0]">
              Access applies only to {selected.title}. It does not grant venue
              access.
            </p>
            <Field label="Host name" required>
              <TextInput
                className="min-h-11"
                required
                minLength={2}
                maxLength={120}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Mobile number (+91)" required>
              <TextInput
                className="min-h-11"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                required
                pattern="[6-9][0-9]{9}"
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) =>
                  setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
              />
            </Field>
            <AdminBtn
              type="submit"
              variant="primary"
              className="min-h-11"
              disabled={busy}
            >
              Approve host
            </AdminBtn>
          </form>
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-lg font-bold">Approved hosts</h2>
            {hosts.filter((h) => h.eventId === selected.id).length === 0 ? (
              <p className="text-sm text-[#a9bcb0]">
                No hosts added for this event yet.
              </p>
            ) : (
              hosts
                .filter((h) => h.eventId === selected.id)
                .map((h) => (
                  <div
                    key={h.id}
                    className="flex flex-wrap items-center justify-between gap-3 border border-[#25382e] p-4"
                  >
                    <div>
                      <p className="font-semibold">{h.label}</p>
                      <p className="text-sm text-[#a9bcb0]">
                        +91 {h.phone.slice(2)}
                      </p>
                    </div>
                    <Pill
                      tone={h.revokedAt ? "muted" : "green"}
                      glyph={h.revokedAt ? "−" : "✓"}
                    >
                      {h.revokedAt ? "Access removed" : "Approved"}
                    </Pill>
                    {!h.revokedAt && (
                      <AdminBtn
                        variant="danger"
                        className="min-h-11"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Remove ${h.label}'s access to ${selected.title}? Registrations and payments will stay saved.`,
                            )
                          )
                            void action(async () => {
                              await mutate(
                                `/api/admin/event-hosts/${h.id}`,
                                "DELETE",
                              );
                              await reload();
                              setNotice(
                                "Host access removed. Their existing session no longer grants event access.",
                              );
                            });
                        }}
                      >
                        Remove access
                      </AdminBtn>
                    )}
                  </div>
                ))
            )}
          </div>
        </>
      )}
    </section>
  );
}
