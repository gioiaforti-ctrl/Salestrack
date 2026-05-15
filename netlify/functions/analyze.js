exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body);

    // ─── CASO 1: Generazione annuncio (solo testo) ───────────
    if (body.prompt) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: body.prompt
          }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic error:', response.status, errText);
        return {
          statusCode: 502,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Errore API Anthropic: ' + response.status })
        };
      }

      const data = await response.json();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      };
    }

    // ─── CASO 2: Analisi screenshot (immagine) ───────────────
    const { image, mediaType } = body;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: image }
            },
            {
              type: 'text',
              text: `Sei un assistente per venditori second hand italiani. Analizza questo screenshot e estrai i dati della vendita.

Restituisci SOLO un oggetto JSON valido, senza testo aggiuntivo:
{
  "platform": "vinted" | "depop" | "wallapop" | "subito" | "etsy" | "ebay" | "altro",
  "item": "nome articolo (marca + tipo + taglia se visibile)",
  "price": numero (prezzo di vendita in euro),
  "fee": numero (commissione/fee in euro, somma tutte le commissioni visibili, 0 se non visibile),
  "net": numero (guadagno netto = price - fee),
  "confidence": "alta" | "media" | "bassa"
}

Se non riesci a estrarre i dati, restituisci: {"error": "non leggibile"}`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Errore API Anthropic: ' + response.status + ' - ' + errText })
      };
    }

    const data = await response.json();
    const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: match[0]
    };

  } catch (err) {
    console.error('Function error:', err.message);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
