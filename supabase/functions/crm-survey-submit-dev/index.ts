import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// DEV-Variante von crm-survey-submit: schreibt gegen die Dynamics-DEV-Umgebung.
// Nutzt die bereits vorhandenen DYNAMICS_*-Secrets (das sind die DEV-
// Zugangsdaten) — getrennt von den DYNAMICS_PROD_*-Secrets der PROD-
// Function "crm-survey-submit", damit lokale Tests niemals versehentlich
// echte Leads in Dynamics PROD anlegen.
//
// Legt IMMER einen neuen Lead an (Entität "wht_lead"), keinen Contact — die
// Umfrage-Antworten werden als JSON direkt ins Feld wht_jsoncontent gelegt.
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();

    // Whitelist: nur diese Felder werden angenommen, alles andere im Body wird ignoriert
    const firstname    = String(payload.firstname ?? "").trim();
    const lastnameRaw  = String(payload.lastname ?? "").trim();
    const emailRaw     = String(payload.email ?? "").trim();
    const mobilephone  = String(payload.mobilephone ?? "").trim();
    const survey        = payload.survey ?? {};

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw : "";

    // wht_name (Nachname) ist auf wht_lead Pflicht. Bei anonymen Antworten
    // liefert der Client bereits einen Platzhalter (Zeitstempel) als lastname
    // mit — diese Fallback-Kette greift nur, falls doch mal alles leer sein sollte.
    const lastname = lastnameRaw || firstname || email || mobilephone || "Umfrage-Teilnehmerin";

    const token = await getAccessToken();

    // Dataverse Web API verlangt Attribut-Logical-Names IMMER in Kleinschreibung,
    // unabhängig davon, wie der Schema-Name im Studio angezeigt wird.
    const leadFields: Record<string, unknown> = {
      wht_name:        lastname,
      wht_leadname:    (firstname + " " + lastname).trim(),
      wht_jsoncontent: JSON.stringify(survey, null, 2),
    };
    if (firstname) leadFields.wht_vorname = firstname;
    if (email)     leadFields.wht_email1  = email;
    if (mobilephone) leadFields.wht_phone1 = mobilephone;

    const leadRes = await fetch(`${RESOURCE}/api/data/v9.2/wht_leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      body: JSON.stringify(leadFields),
    });

    if (!leadRes.ok) {
      console.error("Dataverse error:", leadRes.status, await leadRes.text());
      return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
