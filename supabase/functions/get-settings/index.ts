import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const siteUrl1 = Deno.env.get('SITE_URL_1') ?? '';
  const siteUrl2 = Deno.env.get('SITE_URL_2') ?? '';

  const urls = [siteUrl1, siteUrl2].filter(Boolean);

  return new Response(JSON.stringify({ urls }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
