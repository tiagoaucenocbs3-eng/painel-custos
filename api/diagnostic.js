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
    return res.status(500).json({ error: 'Supabase não configurado.' });
  }

  try {
    const headers = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json'
    };

    const startDate = '2026-08-30';
    const endDate = '2026-08-30';

    // 1. Simular a consulta do cooud-stats
    const url = `${SUPABASE_URL}/rest/v1/cooud_events?date=gte.${startDate}&date=lte.${endDate}&order=date.desc,createdAt.desc`;
    const response = await fetch(url, { headers });

    if (!response.ok) {
      throw new Error(`Erro ao buscar eventos: ${await response.text()}`);
    }

    const events = await response.json();

    // Calcular estatísticas
    let grossRevenue = 0;
    let netRevenue = 0;
    let approvedOrders = 0;
    let refusedOrders = 0;
    let refundCount = 0;
    let refundAmount = 0;

    events.forEach(evt => {
      const amt = parseFloat(evt.amount || 0);
      const netAmt = parseFloat(evt.net_amount || 0);

      if (evt.status === 'approved') {
        approvedOrders++;
        grossRevenue += amt;
        netRevenue += netAmt;
      } else if (evt.status === 'refused') {
        refusedOrders++;
      } else if (evt.status === 'refunded') {
        refundCount++;
        refundAmount += amt;
      }
    });

    const totalOrders = approvedOrders + refusedOrders;
    const approvalRate = totalOrders > 0 ? (approvedOrders / totalOrders) * 100 : 0;

    return res.status(200).json({
      success: true,
      queryUrl: url,
      eventsCount: events.length,
      events,
      summary: {
        grossRevenue,
        netRevenue,
        approvedOrders,
        refusedOrders,
        totalOrders,
        approvalRate,
        refundCount,
        refundAmount
      }
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro no teste.', details: error.message });
  }
};
