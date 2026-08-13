import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// DEV-Variante von dynamics-events-list: liest Events aus der Dynamics-DEV-
// Umgebung. Nutzt die bereits vorhandenen DYNAMICS_*-Secrets (DEV-
// Zugangsdaten). Read-only — keine Schreibzugriffe.
const TENANT_ID     = Deno.env.get("DYNAMICS_TENANT_ID")!;
const CLIENT_ID     = Deno.env.get("DYNAMICS_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("DYNAMICS_CLIENT_SECRET")!;
const RESOURCE      = Deno.env.get("DYNAMICS_RESOURCE")!; // https://<org>.crm4.dynamics.com

// DEV: Der Origin variiert beim lokalen Testen (file://, localhost:PORT,
// 127.0.0.1:PORT …) — deshalb hier bewusst NICHT wie bei PROD auf das feste
// ALLOWED_ORIGIN-Secret (Produktions-Domain) eingeschränkt, sonst blockt der
// Browser jede lokale Anfrage schon in der CORS-Preflight-Prüfung.
const ALLOWED_ORIGIN = "*";

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAccessToken(): Promise<string> {
  const url = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: `${RESOURCE}/.default`,
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) throw new Error(`Token-Anfrage fehlgeschlagen: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

// wht_timefrom ist ein Date-and-Time-Feld (z. B. "2026-08-15T08:00:00Z"),
// keine separaten Jahr/Monat/Tag-Felder. Wir parsen beides direkt aus dem
// ISO-String (nicht über new Date().getMonth() etc., das würde von der
// Laufzeit-Zeitzone des Deno-Runtimes abhängen). Monat wird 0-indexiert
// zurückgegeben (0=Januar), wie im übrigen Code (kalender.html, register.html).
function parseTimefrom(iso: unknown): { year: number | null; month: number | null; day: number | null; time: string } {
  const m = typeof iso === "string" ? iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/) : null;
  if (!m) return { year: null, month: null, day: null, time: "" };
  return {
    year:  Number(m[1]),
    month: Number(m[2]) - 1,
    day:   Number(m[3]),
    time:  `${m[4]}:${m[5]}`,
  };
}

function extractTime(iso: unknown): string {
  const m = typeof iso === "string" ? iso.match(/T(\d{2}):(\d{2})/) : null;
  return m ? `${m[1]}:${m[2]}` : "";
}

// Choice-Felder (Options-Werte laut Dynamics-Konfiguration): Dataverse
// liefert dafür kein zuverlässig nutzbares FormattedValue-Label über die
// Web API, deshalb hier fest anhand der tatsächlichen Options-Werte gemappt.
// Status kommt aus dem eingebauten Standardfeld "statuscode" (Status Reason),
// nicht aus einem eigenen wht_-Feld — 1 ("Aktiv") ist Dataverses Standard-
// Statusgrund, die anderen beiden sind eigens ergänzte Statusgründe.
function statusLabel(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (num === 1) return "Aktiv";
  if (num === 959230001) return "Vergangene";
  if (num === 959230002) return "Draft";
  return "Draft";
}

function typeLabel(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (num === 959230001) return "Webinar";
  return "Workshop"; // 959230000
}

function formatLabel(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (num === 959230001) return "Online";
  if (num === 959230002) return "Hybrid";
  return "Präsenz"; // 959230000
}

// wht_paymentlinktype (laut Dynamics-Konfiguration):
// 0=Primary, 1=Duo, 2=Ressourcen, 3=Video Meeting, 5=Early Bird, 6=Early Bird Duo
const LINK_TYPE_PRIMARY       = 0;
const LINK_TYPE_DUO           = 1;
const LINK_TYPE_EARLY_BIRD    = 5;
const LINK_TYPE_EARLY_BIRD_DUO = 6;

function paymentLinkTypeLabel(n: unknown): string {
  const num = typeof n === "number" ? n : Number(n);
  if (num === 0) return "Primary";
  if (num === 1) return "Duo";
  if (num === 2) return "Ressourcen";
  if (num === 3) return "Video Meeting";
  if (num === 5) return "Early Bird";
  if (num === 6) return "Early Bird Duo";
  return "Unbekannt (" + num + ")";
}

type EventLinks = { primary?: string; duo?: string; earlyBird?: string; earlyBirdDuo?: string };
type RawPaymentLink = { name: string; url: string; type: number | null; typeLabel: string };

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = await getAccessToken();
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
    };

    const select = [
      "wht_eventid", "wht_name", "wht_type",
      "wht_timefrom", "wht_timeto", "wht_location", "wht_format", "wht_price",
      "wht_spots", "wht_description", "wht_url", "wht_videomeetingurl", "statuscode",
      "wht_ebdata", "wht_duodiscount", "wht_ressourcenurl",
    ].join(",");
    const eventsUrl = `${RESOURCE}/api/data/v9.2/wht_events?$select=${select}&$orderby=wht_timefrom asc`;

    // Zahlungslinks kommen aus einer eigenen, verknüpften Tabelle
    // (wht_paymentlinks, Entity Set "wht_paymentlinkses") — pro Event können
    // mehrere Links existieren (Primary/Duo/Early Bird/Early Bird Duo),
    // unterschieden über wht_paymentlinktype, verknüpft über den Lookup wht_event.
    // Kein $select hier: die Navigation-Property des Lookups zu wht_event hat
    // einen anderen Namen als die Attribut-Logical-Name "wht_event" (die per
    // $select nicht auflösbar ist) — wir holen daher den vollen Datensatz und
    // lesen "_wht_event_value" direkt aus der Antwort.
    const linksUrl = `${RESOURCE}/api/data/v9.2/wht_paymentlinkses?$filter=statecode eq 0`;

    const [eventsRes, linksRes] = await Promise.all([
      fetch(eventsUrl, { headers }),
      fetch(linksUrl, { headers }),
    ]);

    if (!eventsRes.ok) {
      console.error("Dataverse error (events):", eventsRes.status, await eventsRes.text());
      return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
    }
    if (!linksRes.ok) {
      // Zahlungslinks sind nicht kritisch fürs Anzeigen der Events — bei
      // Fehlern (z. B. fehlende Berechtigung) einfach ohne Links weitermachen.
      console.error("Dataverse error (payment links):", linksRes.status, await linksRes.text());
    }

    const linksByEvent: Record<string, EventLinks> = {};
    const allLinksByEvent: Record<string, RawPaymentLink[]> = {};
    if (linksRes.ok) {
      const linksData = await linksRes.json();
      for (const link of (linksData.value || []) as Record<string, unknown>[]) {
        const eventGuid = link["_wht_event_value"] as string | null;
        if (!eventGuid) continue;
        const type = typeof link.wht_paymentlinktype === "number" ? link.wht_paymentlinktype : null;
        const linkUrl = typeof link.wht_url === "string" ? link.wht_url : "";
        const linkName = typeof link.wht_name === "string" ? link.wht_name : "";

        if (!allLinksByEvent[eventGuid]) allLinksByEvent[eventGuid] = [];
        allLinksByEvent[eventGuid].push({ name: linkName, url: linkUrl, type, typeLabel: paymentLinkTypeLabel(type) });

        if (!linkUrl) continue;
        if (!linksByEvent[eventGuid]) linksByEvent[eventGuid] = {};
        if (type === LINK_TYPE_PRIMARY)        linksByEvent[eventGuid].primary = linkUrl;
        else if (type === LINK_TYPE_DUO)        linksByEvent[eventGuid].duo = linkUrl;
        else if (type === LINK_TYPE_EARLY_BIRD)  linksByEvent[eventGuid].earlyBird = linkUrl;
        else if (type === LINK_TYPE_EARLY_BIRD_DUO) linksByEvent[eventGuid].earlyBirdDuo = linkUrl;
      }
    }

    const data = await eventsRes.json();
    const events = (data.value || []).map((r: Record<string, unknown>) => {
      const from = parseTimefrom(r.wht_timefrom);
      const eventGuid = String(r.wht_eventid);
      const links = linksByEvent[eventGuid] || {};
      return {
        id:                r.wht_eventid ?? null,
        name:              r.wht_name ?? "",
        type:              typeLabel(r.wht_type),
        year:              from.year,
        month:             from.month,
        day:               from.day,
        time_from:         from.time,
        time_to:           extractTime(r.wht_timeto),
        location:          r.wht_location ?? "",
        format:            formatLabel(r.wht_format),
        price:             r.wht_price != null ? String(r.wht_price) : "",
        spots:             r.wht_spots ?? "",
        description:       r.wht_description ?? "",
        url:               r.wht_url ?? "",
        video_meeting_url: r.wht_videomeetingurl ?? "",
        resources_url:     r.wht_ressourcenurl ?? "",
        status:            statusLabel(r.statuscode),
        // Zusätzliche Felder für register.html (Preisberechnung/Zahlungslinks):
        eb_data:            r.wht_ebdata ?? "",
        duo_discount:       r.wht_duodiscount ?? null,
        payment_url:        links.primary || "",
        duo_payment_url:    links.duo || "",
        eb_payment_url:     links.earlyBird || "",
        eb_duo_payment_url: links.earlyBirdDuo || "",
        // Alle verknüpften Zahlungslinks (ungefiltert) — fürs Debug-Panel in kalender.html
        payment_links:      allLinksByEvent[eventGuid] || [],
      };
    });

    return jsonResponse(events, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
