import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// PROD-Variante: liest alle Events aus der Dynamics-PROD-Umgebung
// (Entität "wht_event"). Read-only — keine Schreibzugriffe.
const TENANT_ID     = Deno.env.get("DYNAMICS_PROD_TENANT_ID")!;
const CLIENT_ID     = Deno.env.get("DYNAMICS_PROD_CLIENT_ID")!;
const CLIENT_SECRET = Deno.env.get("DYNAMICS_PROD_CLIENT_SECRET")!;
const RESOURCE      = Deno.env.get("DYNAMICS_PROD_RESOURCE")!; // https://<org>.crm4.dynamics.com

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*";

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

const FV = "@OData.Community.Display.V1.FormattedValue";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET" && req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const token = await getAccessToken();

    const select = [
      "wht_eventid", "wht_name", "wht_type",
      "wht_timefrom", "wht_timeto", "wht_location", "wht_format", "wht_price",
      "wht_spots", "wht_description", "wht_url", "wht_videomeetingurl", "wht_statuscode",
    ].join(",");
    const url = `${RESOURCE}/api/data/v9.2/wht_events?$select=${select}&$orderby=wht_timefrom asc`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
        // Liefert für Choice-/OptionSet-Felder zusätzlich das lesbare Label
        // (…@OData.Community.Display.V1.FormattedValue) — robust gegen
        // unterschiedliche interne Options-Werte zwischen DEV und PROD.
        Prefer: 'odata.include-annotations="OData.Community.Display.V1.FormattedValue"',
      },
    });

    if (!res.ok) {
      console.error("Dataverse error:", res.status, await res.text());
      return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
    }

    const data = await res.json();
    const events = (data.value || []).map((r: Record<string, unknown>) => {
      const from = parseTimefrom(r.wht_timefrom);
      return {
        id:                r.wht_eventid ?? null,
        name:              r.wht_name ?? "",
        type:              r[`wht_type${FV}`] ?? r.wht_type ?? "",
        year:              from.year,
        month:             from.month,
        day:               from.day,
        time_from:         from.time,
        time_to:           extractTime(r.wht_timeto),
        location:          r.wht_location ?? "",
        format:            r[`wht_format${FV}`] ?? r.wht_format ?? "",
        price:             r.wht_price != null ? String(r.wht_price) : "",
        spots:             r.wht_spots ?? "",
        description:       r.wht_description ?? "",
        url:               r.wht_url ?? "",
        video_meeting_url: r.wht_videomeetingurl ?? "",
        status:            r[`wht_statuscode${FV}`] ?? "",
      };
    });

    return jsonResponse(events, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
