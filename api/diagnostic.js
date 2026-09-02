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

    // 1. Buscar todos os cooud_events
    const urlEvents = `${SUPABASE_URL}/rest/v1/cooud_events?select=*&order=date.desc,createdAt.desc`;
    const respEvents = await fetch(urlEvents, { headers });
    const events = respEvents.ok ? await respEvents.json() : [];

    // 2. Buscar todas as entries
    const urlEntries = `${SUPABASE_URL}/rest/v1/entries?select=*&order=date.asc`;
    const respEntries = await fetch(urlEntries, { headers });
    const entries = respEntries.ok ? await respEntries.json() : [];

    // 3. Agrupar cooud_events por data e status
    const eventsByDate = {};
    const refunds = [];
    const approved = [];

    events.forEach(evt => {
      const isApproved = evt.status === 'approved' || (evt.status && evt.status.startsWith('approved_rate:'));
      const isRefunded = evt.status === 'refunded' || (evt.status && evt.status.startsWith('refunded_rate:'));

      if (isApproved) approved.push(evt);
      if (isRefunded) refunds.push(evt);

      if (!eventsByDate[evt.date]) {
        eventsByDate[evt.date] = { approved: 0, refunded: 0, refused: 0, other: 0, items: [] };
      }
      if (isApproved) eventsByDate[evt.date].approved++;
      else if (isRefunded) eventsByDate[evt.date].refunded++;
      else if (evt.status === 'refused') eventsByDate[evt.date].refused++;
      else eventsByDate[evt.date].other++;

      eventsByDate[evt.date].items.push({ id: evt.id, status: evt.status, amount: evt.amount, net_amount: evt.net_amount });
    });

    return res.status(200).json({
      totalEvents: events.length,
      totalApproved: approved.length,
      totalRefunds: refunds.length,
      refundsList: refunds,
      eventsByDate,
      entriesSummary: entries.map(e => ({ date: e.date, sales: e.sales, revenue: e.revenue, adSpend: e.adSpend, id: e.id })),
      totalEntriesSales: entries.reduce((a, b) => a + (Number(b.sales) || 0), 0),
      totalEntriesRevenue: entries.reduce((a, b) => a + (Number(b.revenue) || 0), 0),
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro no teste.', details: error.message });
  }
};
