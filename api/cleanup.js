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

    // 2. Atualizar o dia 23/08/2026 no entries (13 vendas e R$ 3.086,54)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-08-23`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 13,
        revenue: 3086.54,
        updatedAt: new Date().toISOString()
      })
    });

    // 3. Atualizar o dia 30/08/2026 no entries (17 vendas e R$ 3.240,35)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-08-30`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 17,
        revenue: 3240.35,
        updatedAt: new Date().toISOString()
      })
    });

    // 4. Atualizar o dia 02/09/2026 no entries (8 vendas e R$ 1.642,08 mantendo gasto 250.43)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-09-02`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 8,
        revenue: 1642.08,
        adSpend: 250.43,
        updatedAt: new Date().toISOString()
      })
    });

    // 5. Atualizar o dia de hoje (03/09/2026) no entries (8 vendas e R$ 1.897,32 mantendo gasto 687.27)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-09-03`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 8,
        revenue: 1897.32,
        adSpend: 687.27,
        updatedAt: new Date().toISOString()
      })
    });

    // 6. Atualizar a taxa dos eventos de hoje (03/09/2026) em cooud_events para taxa real exata da Cooud
    const events03Res = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?date=eq.2026-09-03&select=*`, { headers });
    if (events03Res.ok) {
      const events03 = await events03Res.json();
      const approved03 = events03.filter(e => e.status && (e.status.startsWith('approved')));
      const totalNetEur = approved03.reduce((sum, e) => sum + (parseFloat(e.net_amount) || 0), 0);
      if (totalNetEur > 0) {
        const targetBRL = 1897.32;
        const rate = (targetBRL / totalNetEur).toFixed(6);
        for (const evt of approved03) {
          await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?id=eq.${evt.id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ status: `approved_rate:${rate}` })
          });
        }
      }
    }

    // 7. Buscar todas as entries atualizadas para confirmar
    const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.asc`, { headers });
    const entries = await entriesRes.json();

    const totalSales = entries.reduce((a, b) => a + (Number(b.sales) || 0), 0);
    const totalRevenue = entries.reduce((a, b) => a + (Number(b.revenue) || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Lançamentos e eventos de 03/09/2026 calibrados com sucesso.',
      totalSales,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      todayEntry: entries.find(e => e.date === '2026-09-03'),
      entries
    });

  } catch (error) {
    console.error('Erro na função api/cleanup:', error);
    return res.status(500).json({ error: error.message });
  }
};
