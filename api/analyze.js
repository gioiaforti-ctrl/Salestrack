export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const body = req.body;

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
          messages: [{ role: 'user', content: body.prompt }]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Anthropic error:', response.status, errText);
        return res.status(502).json({ error: 'Errore API Anthropic: ' + response.status });
      }

      const data = await response.json();
      return res.status(200).json(data);
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
              text: 'Sei un assistente per venditori second hand italiani. Analizza questo screenshot e estrai i dati della vendita.\n\nRestituisci SOLO un oggetto JSON valido, senza testo aggiuntivo:\n{\n  "platform": "vinted" | "depop" | "wallapop" | "subito" | "etsy" | "ebay" | "altro",\n  "item": "nome articolo (marca + tipo + taglia se visibile)",\n  "price": numero,\n  "fee": numero,\n  "net": numero,\n  "confidence": "alta" | "media" | "bassa"\n}\n\nSe non riesci a estrarre i dati, restituisci: {"error": "non leggibile"}'
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return res.status(502).json({ error: 'Errore API Anthropic: ' + response.status });
    }

    const data = await response.json();
    const match = (data.content?.[0]?.text || '').match(/\{[\s\S]*\}/);
    if (!match) throw new Error('no json');
    return res.status(200).json(JSON.parse(match[0]));

  } catch (err) {
    console.error('Function error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
