import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// DEV-Variante von crm-survey-submit: schreibt gegen die Dynamics-DEV-Umgebung.
// Nutzt die bereits vorhandenen DYNAMICS_*-Secrets (das sind die DEV-
// Zugangsdaten) — getrennt von den DYNAMICS_PROD_*-Secrets der PROD-
// Function "crm-survey-submit", damit lokale Tests niemals versehentlich
// echte Kontakte/Notizen in Dynamics PROD anlegen.
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

const dataverseHeaders = (token: string) => ({
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "OData-MaxVersion": "4.0",
  "OData-Version": "4.0",
});

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function odataEscape(value: string): string {
  return value.replace(/'/g, "''");
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

// Sucht einen bestehenden Kontakt anhand E-Mail oder Telefonnummer.
async function findContactId(token: string, email: string, mobilephone: string): Promise<string | null> {
  const filters: string[] = [];
  if (email) filters.push(`emailaddress1 eq '${odataEscape(email)}'`);
  if (mobilephone) filters.push(`mobilephone eq '${odataEscape(mobilephone)}'`);
  if (!filters.length) return null;

  const url = `${RESOURCE}/api/data/v9.2/contacts?$select=contactid&$filter=${encodeURIComponent(filters.join(" or "))}&$top=1`;
  const res = await fetch(url, { headers: dataverseHeaders(token) });
  if (!res.ok) {
    console.error("Dataverse lookup error:", res.status, await res.text());
    return null;
  }
  const data = await res.json();
  return data.value?.[0]?.contactid ?? null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const payload = await req.json();

    const firstname   = String(payload.firstname ?? "").trim();
    const lastname    = String(payload.lastname ?? "").trim();
    const emailRaw    = String(payload.email ?? "").trim();
    const mobilephone = String(payload.mobilephone ?? "").trim();
    const survey       = payload.survey ?? {};

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw);
    const email = emailValid ? emailRaw : "";

    if (!email && !mobilephone) {
      return jsonResponse({ error: "E-Mail oder Telefonnummer erforderlich" }, 400);
    }

    const token = await getAccessToken();
    let contactId = await findContactId(token, email, mobilephone);

    const contactFields: Record<string, unknown> = {};
    if (firstname) contactFields.firstname = firstname;
    if (email) contactFields.emailaddress1 = email;
    if (mobilephone) contactFields.mobilephone = mobilephone;
    contactFields.lastname = lastname || firstname || email || mobilephone || "Umfrage-Teilnehmerin";

    if (contactId) {
      const updateRes = await fetch(`${RESOURCE}/api/data/v9.2/contacts(${contactId})`, {
        method: "PATCH",
        headers: dataverseHeaders(token),
        body: JSON.stringify(contactFields),
      });
      if (!updateRes.ok) {
        console.error("Dataverse update error:", updateRes.status, await updateRes.text());
      }
    } else {
      const createRes = await fetch(`${RESOURCE}/api/data/v9.2/contacts`, {
        method: "POST",
        headers: { ...dataverseHeaders(token), Prefer: "return=representation" },
        body: JSON.stringify(contactFields),
      });
      if (!createRes.ok) {
        console.error("Dataverse create error:", createRes.status, await createRes.text());
        return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
      }
      const created = await createRes.json();
      contactId = created.contactid;
    }

    if (contactId) {
      const noteRes = await fetch(`${RESOURCE}/api/data/v9.2/annotations`, {
        method: "POST",
        headers: dataverseHeaders(token),
        body: JSON.stringify({
          subject: "Zielgruppen-Umfrage",
          notetext: JSON.stringify(survey, null, 2),
          "objectid_contact@odata.bind": `/contacts(${contactId})`,
        }),
      });
      if (!noteRes.ok) {
        console.error("Dataverse note error:", noteRes.status, await noteRes.text());
      }
    }

    return jsonResponse({ success: true, contactId }, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
