import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// DEV-Variante von crm-submit: schreibt gegen die Dynamics-DEV-Umgebung.
// Nutzt die bereits vorhandenen DYNAMICS_*-Secrets (das sind die DEV-
// Zugangsdaten) — getrennt von den DYNAMICS_PROD_*-Secrets der PROD-
// Function "crm-submit", damit lokale Tests niemals versehentlich echte
// Kontakte in Dynamics PROD anlegen.
//
// Legt IMMER einen neuen Lead an (Entität "wht_lead"), keinen Contact.
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
    const firstname           = String(payload.firstname ?? "").trim();
    const lastname            = String(payload.lastname ?? "").trim();
    const email                = String(payload.email ?? "").trim();
    const mobilephone          = String(payload.mobilephone ?? "").trim();
    const eventId               = String(payload.eventId ?? "").trim();
    const quelleRaw             = payload.quelle;
    const interesseAnCoachingOptIn           = !!payload.interesseAnCoachingOptIn;
    const einwilligungDatenverarbeitungOptIn = !!payload.einwilligungDatenverarbeitungOptIn;
    const newsletterOptIn                    = !!payload.newsletterOptIn;
    const testimonialOptIn                   = !!payload.testimonialOptIn;

    if (!lastname || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Pflichtfelder fehlen oder ungültig" }, 400);
    }

    const token = await getAccessToken();
    const nowIso = new Date().toISOString();

    // Dataverse Web API verlangt Attribut-Logical-Names IMMER in Kleinschreibung,
    // unabhängig davon, wie der Schema-Name im Studio angezeigt wird
    // (wht_Vorname → wht_vorname usw.).
    const leadFields: Record<string, unknown> = {
      wht_vorname: firstname,
      wht_name:    lastname,
      wht_email1:  email,
    };
    if (mobilephone) leadFields.wht_phone1 = mobilephone;
    // wht_eventid ist ein Lookup (Verknüpfung zu wht_event), kein Textfeld —
    // Dataverse verlangt dafür die @odata.bind-Syntax. Der Navigation-Property-
    // Name ist NICHT der Attribut-Logical-Name (wht_eventid), sondern
    // "wht_EventId" (per ManyToOneRelationships-Metadaten ermittelt:
    // ReferencingAttribute=wht_eventid, ReferencingEntityNavigationPropertyName=wht_EventId).
    if (eventId) leadFields["wht_EventId@odata.bind"] = `/wht_events(${eventId})`;
    if (quelleRaw !== null && quelleRaw !== undefined && quelleRaw !== "") {
      const quelleNum = Number(quelleRaw);
      if (!Number.isNaN(quelleNum)) leadFields.wht_quelle = quelleNum;
    }
    // Zustimmungs-/Interessefelder speichern den Zeitpunkt der Anmeldung als
    // Datum, nicht true/false — nur gesetzt, wenn die Checkbox aktiv war.
    if (interesseAnCoachingOptIn)           leadFields.wht_interesseancoaching = nowIso;
    if (einwilligungDatenverarbeitungOptIn) leadFields.wht_einwilligungzurdatenverarbeitung = nowIso;
    if (newsletterOptIn)                    leadFields.wht_interesseannewsletterperemail = nowIso;
    if (testimonialOptIn)                   leadFields.wht_zustimmungfurtestimonials = nowIso;

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
