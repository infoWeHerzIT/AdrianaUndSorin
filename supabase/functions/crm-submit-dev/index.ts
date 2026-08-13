import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// DEV-Variante von crm-submit: schreibt gegen die Dynamics-DEV-Umgebung.
// Nutzt die bereits vorhandenen DYNAMICS_*-Secrets (das sind die DEV-
// Zugangsdaten) — getrennt von den DYNAMICS_PROD_*-Secrets der PROD-
// Function "crm-submit", damit lokale Tests niemals versehentlich echte
// Kontakte in Dynamics PROD anlegen.
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
    const firstname   = String(payload.firstname ?? "").trim();
    const lastname    = String(payload.lastname ?? "").trim();
    const email       = String(payload.email ?? "").trim();
    const mobilephone = String(payload.mobilephone ?? "").trim();

    if (!lastname || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: "Pflichtfelder fehlen oder ungültig" }, 400);
    }

    const token = await getAccessToken();

    const contactRes = await fetch(`${RESOURCE}/api/data/v9.2/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      body: JSON.stringify({
        firstname,
        lastname,
        emailaddress1: email,
        ...(mobilephone ? { mobilephone } : {}),
      }),
    });

    if (!contactRes.ok) {
      console.error("Dataverse error:", contactRes.status, await contactRes.text());
      return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
    }

    return jsonResponse({ success: true }, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
