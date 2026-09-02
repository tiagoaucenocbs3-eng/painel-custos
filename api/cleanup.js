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

    // 1. Deletar a entrada duplicada específica (ID fbd06563-65b3-45e4-a6cb-735d4ce741a5)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.fbd06563-65b3-45e4-a6cb-735d4ce741a5`, {
      method: 'DELETE',
      headers
    });

    // 2. Atualizar o dia 23/08/2026 no entries (descontando 1 reembolso de R$ 200,42 -> 13 vendas e R$ 3.086,54)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-08-23`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 13,
        revenue: 3086.54,
        updatedAt: new Date().toISOString()
      })
    });

    // 3. Atualizar o dia 30/08/2026 no entries (descontando 2 reembolsos: R$ 362,80 + R$ 200,19 -> 18 vendas e R$ 3.603,15)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-08-30`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 18,
        revenue: 3603.15,
        updatedAt: new Date().toISOString()
      })
    });

    // 4. Buscar todas as entries atualizadas para confirmar
    const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.asc`, { headers });
    const entries = await entriesRes.json();

    const totalSales = entries.reduce((a, b) => a + (Number(b.sales) || 0), 0);
    const totalRevenue = entries.reduce((a, b) => a + (Number(b.revenue) || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Lançamentos atualizados com reembolsos descontados.',
      totalSales,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      entries
    });

  } catch (error) {
    console.error('Erro na função api/cleanup:', error);
    return res.status(500).json({ error: error.message });
  }
};
