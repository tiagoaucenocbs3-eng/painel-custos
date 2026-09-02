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

    // 4. Atualizar o dia de hoje (02/09/2026) no entries (7 vendas e R$ 1.547,29 mantendo gasto 250.43)
    await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.2026-09-02`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        sales: 7,
        revenue: 1547.29,
        adSpend: 250.43,
        updatedAt: new Date().toISOString()
      })
    });

    // 5. Calibrar taxa dos 7 eventos de hoje na cooud_events para taxa real de 5.944713
    const todayEvents = [
      '01M1J4C30YYSSK8H6NMKEW4Q41',
      '01M1J3Y9CS7GG45SK6WM2BK7AC',
      '01M1J2ZQ8D8NV01RY2MAVK9PA5',
      '01M1GNHZ3Q70M4MX7Y07Q729HN',
      '01M1GNH6CVPBX1T42CBKG4H7SM',
      '01M1GGEDD80H9SP6NE32RD999N',
      '01M1GEAHVCHRYMY131TY6C14WN'
    ];
    for (const evtId of todayEvents) {
      await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?id=eq.${evtId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'approved_rate:5.944713' })
      });
    }

    // 6. Buscar todas as entries atualizadas para confirmar
    const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.asc`, { headers });
    const entries = await entriesRes.json();

    const totalSales = entries.reduce((a, b) => a + (Number(b.sales) || 0), 0);
    const totalRevenue = entries.reduce((a, b) => a + (Number(b.revenue) || 0), 0);

    return res.status(200).json({
      success: true,
      message: 'Lançamentos e eventos de hoje atualizados com sucesso.',
      totalSales,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      todayEntry: entries.find(e => e.date === '2026-09-02'),
      entries
    });

  } catch (error) {
    console.error('Erro na função api/cleanup:', error);
    return res.status(500).json({ error: error.message });
  }
};
