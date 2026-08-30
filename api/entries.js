const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  // Configurar cabeçalhos CORS básicos (caso seja acessado externamente, embora o padrão seja mesmo domínio)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Variáveis de ambiente do Supabase não configuradas na Vercel.' });
  }

  const { method, query, body } = req;

  try {
    // 1. GET - Buscar todos os lançamentos
    if (method === 'GET') {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*`, {
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

    // 2. POST - Criar ou atualizar (Upsert) um lançamento
    if (method === 'POST') {
      if (!body) {
        return res.status(400).json({ error: 'Corpo da requisição ausente.' });
      }

      // Certificar que é um objeto ou array
      const payload = body;

      const response = await fetch(`${SUPABASE_URL}/rest/v1/entries?on_conflict=id`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Erro no Supabase ao salvar: ${await response.text()}`);
      }

      return res.status(200).json({ success: true });
    }

    // 3. DELETE - Excluir um lançamento ou todos
    if (method === 'DELETE') {
      const { id, all } = query;

      let url = `${SUPABASE_URL}/rest/v1/entries`;
      if (all === 'true') {
        // Excluir todos (usamos uma condição que sempre é verdadeira, ex: id não é nulo)
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
    console.error('Erro na função api/entries:', error);
    return res.status(500).json({ error: error.message });
  }
};
