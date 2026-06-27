import { Router, Request, Response } from 'express';

const router = Router();

router.post('/mistral', async (req: Request, res: Response) => {
  try {
    const { prompt, system, apiKey } = req.body;
    if (!prompt) {
      res.status(400).json({ error: 'Le champ prompt est requis' });
      return;
    }

    const key = apiKey || process.env.MISTRAL_API_KEY || '';
    if (!key) {
      res.status(500).json({ error: 'Clé API Mistral non configurée' });
      return;
    }

    const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: system || 'Tu es un assistant utile qui répond en français.' },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Mistral API error:', errText);
      res.status(response.status).json({ error: 'Erreur API Mistral', detail: errText });
      return;
    }

    const data = await response.json();
    res.json({ result: data.choices?.[0]?.message?.content?.trim() || '' });
  } catch (err) {
    console.error('AI proxy error:', err);
    res.status(500).json({ error: 'Erreur interne du proxy IA' });
  }
});

export { router as aiRouter };
