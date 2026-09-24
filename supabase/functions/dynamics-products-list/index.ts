import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// PROD-Variante: liest alle aktiven Produkte aus der Dynamics-PROD-Umgebung
// (Entität "wht_product", Felder wht_name/wht_url). Read-only — keine
// Schreibzugriffe.
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

// Der Entity-Set-Name (Plural, für die REST-URL) wird nicht fest angenommen
// (z. B. "wht_products"), sondern per Metadata-Abfrage aus dem logischen
// Namen "wht_product" aufgelöst — Dataverse generiert Pluralformen nicht
// immer nach dem simplen "+s"-Schema (siehe wht_paymentlink → "wht_paymentlinkses").
async function getEntitySetName(headers: Record<string, string>): Promise<string> {
  const url = `${RESOURCE}/api/data/v9.2/EntityDefinitions(LogicalName='wht_product')?$select=EntitySetName`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`Metadata-Anfrage fehlgeschlagen: ${res.status}`);
  const data = await res.json();
  return data.EntitySetName as string;
}

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

    const entitySet = await getEntitySetName(headers);

    // Bewusst OHNE $select/$orderby: die genauen Feldnamen (wht_name,
    // wht_url) sind nicht per Metadata verifiziert — ohne $select liefert
    // Dataverse alle Attribute mit, ein falsch geratener Feldname führt
    // dann nur zu einem leeren Wert statt zu einem 400-Fehler der ganzen
    // Abfrage. "Aktiv" = Dataverse-Standardstatus statecode eq 0.
    const productsUrl = `${RESOURCE}/api/data/v9.2/${entitySet}?$filter=statecode eq 0`;
    const res = await fetch(productsUrl, { headers });

    if (!res.ok) {
      console.error("Dataverse error (products):", res.status, await res.text());
      return jsonResponse({ error: "CRM-Anfrage fehlgeschlagen" }, 502);
    }

    const data = await res.json();
    const products = (data.value || [])
      .map((r: Record<string, unknown>) => ({
        id:   r.wht_productid ?? null,
        name: r.wht_name ?? "",
        url:  r.wht_url ?? "",
      }))
      .sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "de"));

    return jsonResponse(products, 200);
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: "Interner Fehler" }, 500);
  }
});
