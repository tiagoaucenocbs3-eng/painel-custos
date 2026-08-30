const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase não configurado na Vercel.' });
  }

  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    // 1. Buscar transações atuais para diagnóstico
    const fetchResponse = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?select=*&order=createdAt.desc&limit=50`, {
      headers
    });

    if (!fetchResponse.ok) {
      throw new Error(`Erro ao buscar eventos: ${await fetchResponse.text()}`);
    }
    const currentEvents = await fetchResponse.json();

    // 2. Deletar eventos de teste (id começando com TEST_)
    const deleteResponse = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?id=like.TEST_*`, {
      method: 'DELETE',
      headers
    });

    if (!deleteResponse.ok) {
      throw new Error(`Erro ao deletar eventos de teste: ${await deleteResponse.text()}`);
    }

    // 3. Deletar a entrada duplicada específica (ID do backup original)
    const deleteEntryResponse = await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.0a950706-04a2-4302-b3c6-bc992c5977e8`, {
      method: 'DELETE',
      headers
    });

    if (!deleteEntryResponse.ok) {
      throw new Error(`Erro ao deletar entrada duplicada: ${await deleteEntryResponse.text()}`);
    }

    // 4. Restaurar o dia 30/08/2026 no entries para os dados reais
    const restoreResponse = await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-08-30`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 17,
        revenue: 3583.94,
        updatedAt: new Date().toISOString()
      })
    });

    if (!restoreResponse.ok) {
      throw new Error(`Erro ao restaurar o entries: ${await restoreResponse.text()}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Limpeza e restauração executadas com sucesso.',
      beforeEvents: currentEvents, // Lista de eventos encontrados antes da limpeza
      restoredDate: '2026-08-30',
      restoredSales: 17,
      restoredRevenue: 3583.94
    });

  } catch (error) {
    console.error('Erro na API de limpeza:', error);
    return res.status(500).json({ error: 'Erro interno na limpeza.', details: error.message });
  }
};
