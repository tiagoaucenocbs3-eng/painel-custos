const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const APP_PASSWORD = process.env.APP_PASSWORD;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).end('Método não permitido');
  }

  // Verificar senha se estiver configurada na Vercel
  if (APP_PASSWORD) {
    const authHeader = req.headers['authorization'];
    if (authHeader !== APP_PASSWORD) {
      return res.status(401).json({ error: 'Não autorizado. Senha incorreta ou ausente.' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase não configurado.' });
  }

  const { startDate, endDate } = req.query;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Datas de início e fim são obrigatórias.' });
  }

  try {
    // Buscar todos os eventos da Cooud dentro do período
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/cooud_events?date=gte.${startDate}&date=lte.${endDate}&order=date.desc,createdAt.desc`,
      {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Erro ao buscar eventos do Supabase: ${await response.text()}`);
    }

    const events = await response.json();

    // Calcular estatísticas consolidadas
    let grossRevenue = 0;
    let netRevenue = 0;
    let approvedOrders = 0;
    let refusedOrders = 0;
    let refundCount = 0;
    let refundAmount = 0;

    events.forEach(evt => {
      const amt = parseFloat(evt.amount || 0);
      const netAmt = parseFloat(evt.net_amount || 0);

      const isApproved = evt.status === 'approved' || evt.status.startsWith('approved_rate:');

      if (isApproved) {
        approvedOrders++;
        grossRevenue += amt;
        netRevenue += netAmt;
      } else if (evt.status === 'refused') {
        refusedOrders++;
      } else if (evt.status === 'refunded' || evt.status.startsWith('refunded_rate:')) {
        refundCount++;
        refundAmount += amt;
      }
    });

    const totalOrders = approvedOrders + refusedOrders;
    const approvalRate = totalOrders > 0 ? (approvedOrders / totalOrders) * 100 : 0;

    return res.status(200).json({
      summary: {
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        netRevenue: Math.round(netRevenue * 100) / 100,
        approvedOrders,
        refusedOrders,
        totalOrders,
        approvalRate: Math.round(approvalRate * 10) / 10,
        refundCount,
        refundAmount: Math.round(refundAmount * 100) / 100
      },
      transactions: events // Retorna a lista para renderizar a tabela
    });

  } catch (error) {
    console.error('Erro na API cooud-stats:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.', details: error.message });
  }
};
