const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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

  const { method, query, body } = req;

  try {
    // 1. GET - Buscar todos os gastos extras
    if (method === 'GET') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/extra_expenses?select=*&order=date.desc`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase: ${await response.text()}`);
      }

      const data = await response.json();
      return res.status(200).json(data);
    }

    // 2. POST - Criar ou atualizar (Upsert) um gasto extra
    if (method === 'POST') {
      if (!body) {
        return res.status(400).json({ error: 'Corpo da requisição ausente.' });
      }

      const response = await fetch(`${SUPABASE_URL}/rest/v1/extra_expenses?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase ao salvar gasto extra: ${await response.text()}`);
      }

      return res.status(200).json({ success: true });
    }

    // 3. DELETE - Excluir um gasto extra ou todos
    if (method === 'DELETE') {
      const { id, all } = query;

      let url = `${SUPABASE_URL}/rest/v1/extra_expenses`;
      if (all === 'true') {
        url += `?id=not.is.null`;
      } else {
        if (!id) {
          return res.status(400).json({ error: 'Parâmetro ID ausente.' });
        }
        url += `?id=eq.${id}`;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase ao excluir: ${await response.text()}`);
      }

      return res.status(200).json({ success: true });
    }

    res.setHeader('Allow', ['GET', 'POST', 'DELETE']);
    return res.status(405).end(`Método ${method} não suportado.`);
  } catch (error) {
    console.error('Erro na função api/extra-expenses:', error);
    return res.status(500).json({ error: error.message });
  }
};
