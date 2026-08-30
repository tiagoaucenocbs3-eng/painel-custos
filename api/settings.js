const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Verificar senha se estiver configurada na Vercel
  if (APP_PASSWORD) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== APP_PASSWORD) {
      return res.status(401).json({ error: 'Não autorizado. Senha incorreta ou ausente.' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas na Vercel.' });
  }

  const { method, body } = req;

  try {
    // 1. GET - Buscar as configurações (sempre id = 1)
    if (method === 'GET') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/settings?id=eq.1&select=data`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase: ${await response.text()}`);
      }

      const data = await response.json();
      const settings = data && data[0] ? data[0].data : {};
      return res.status(200).json(settings);
    }

    // 2. POST - Atualizar as configurações
    if (method === 'POST') {
      if (!body) {
        return res.status(400).json({ error: 'Corpo da requisição ausente.' });
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/settings?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 1,
          data: body,
          "updatedAt": new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase ao salvar configurações: ${await response.text()}`);
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).end(`Método ${method} não suportado.`);
  } catch (error) {
    console.error('Erro na função api/settings:', error);
    return res.status(500).json({ error: error.message });
  }
};
