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

    // 1. Buscar transações mais recentes (cooud_events)
    const eventsRes = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?select=*&order=createdAt.desc&limit=15`, {
      headers
    });
    if (!eventsRes.ok) {
      throw new Error(`Erro ao buscar eventos: ${await eventsRes.text()}`);
    }
    const events = await eventsRes.json();

    // 2. Buscar lançamentos recentes (entries)
    const entriesRes = await fetch(`${SUPABASE_URL}/rest/v1/entries?select=*&order=date.desc&limit=5`, {
      headers
    });
    if (!entriesRes.ok) {
      throw new Error(`Erro ao buscar lançamentos: ${await entriesRes.text()}`);
    }
    const entries = await entriesRes.json();

    return res.status(200).json({
      success: true,
      events,
      entries
    });

  } catch (error) {
    return res.status(500).json({ error: 'Erro interno no diagnóstico.', details: error.message });
  }
};
