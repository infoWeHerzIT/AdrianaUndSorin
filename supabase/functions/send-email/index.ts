import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  try {
    const { action, params } = await req.json();

    const SERVICE_ID  = Deno.env.get('EMAILJS_SERVICE_ID');
    const PUBLIC_KEY  = Deno.env.get('EMAILJS_PUBLIC_KEY');
    const PRIVATE_KEY = Deno.env.get('EMAILJS_PRIVATE_KEY');
    const BCC         = Deno.env.get('EMAILJS_BCC') ?? '';

    const TEMPLATES: Record<string, string | undefined> = {
      registration: Deno.env.get('EMAILJS_TEMPLATE_REGISTRATION'),
      danke:        Deno.env.get('EMAILJS_TEMPLATE_DANKE'),
    };

    console.log(`[send-email] action=${action} service=${SERVICE_ID} template=${TEMPLATES[action]} public_key_set=${!!PUBLIC_KEY} private_key_set=${!!PRIVATE_KEY}`);

    const template_id = TEMPLATES[action];
    if (!template_id || !SERVICE_ID || !PUBLIC_KEY || !PRIVATE_KEY) {
      const missing = [!template_id && `template_${action}`, !SERVICE_ID && 'SERVICE_ID', !PUBLIC_KEY && 'PUBLIC_KEY', !PRIVATE_KEY && 'PRIVATE_KEY'].filter(Boolean).join(', ');
      console.error(`[send-email] Fehlende Secrets: ${missing}`);
      return new Response(
        JSON.stringify({ error: `Konfigurationsfehler – Secrets fehlen: ${missing}` }),
        { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    const templateParams: Record<string, string> = { ...params, bcc_email: BCC };

    const payload = {
      service_id:      SERVICE_ID,
      template_id,
      user_id:         PUBLIC_KEY,
      accessToken:     PRIVATE_KEY,
      template_params: templateParams,
    };

    const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    console.log(`[send-email] EmailJS response: status=${res.status} body=${text}`);

    if (!res.ok) {
      console.error(`[send-email] EmailJS error ${res.status}: ${text}`);
      return new Response(
        JSON.stringify({ error: text }),
        { status: res.status, headers: { ...CORS, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error(`[send-email] Exception: ${err}`);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    );
  }
});
