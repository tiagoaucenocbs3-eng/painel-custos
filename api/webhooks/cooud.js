const crypto = require('crypto');
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const COOUD_WEBHOOK_TOKEN = process.env.COOUD_WEBHOOK_TOKEN; // Opcional, para segurança extra

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Cooud-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Método não permitido');
  }

  // 1. Verificar token de segurança se estiver configurado
  if (COOUD_WEBHOOK_TOKEN) {
    const tokenHeader = req.headers['x-cooud-token'];
    const tokenQuery = req.query.token;
    if (tokenHeader !== COOUD_WEBHOOK_TOKEN && tokenQuery !== COOUD_WEBHOOK_TOKEN) {
      return res.status(401).json({ error: 'Token de segurança do webhook inválido.' });
    }
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(500).json({ error: 'Supabase não configurado.' });
  }

  try {
    const body = req.body || {};
    
    // Logar payload para depuração na Vercel (se necessário)
    console.log('[Webhook Cooud] Payload recebido:', JSON.stringify(body));

    // 2. Extrair e normalizar o ID da transação
    const id = body.id || body.transaction_id || body.order_id || body.id_transacao || body.reference ||
               (body.order && body.order.id) || (body.transaction && body.transaction.id);

    if (!id) {
      return res.status(400).json({ error: 'ID de transação não encontrado no payload.' });
    }

    // 3. Extrair e normalizar o Status
    const rawStatus = (body.status || body.order_status || body.transaction_status || body.event || 
                      (body.order && body.order.status) || (body.transaction && body.transaction.status) || '').toLowerCase();
    
    let status = 'pending';
    if (rawStatus.includes('pay') || rawStatus.includes('aprov') || rawStatus.includes('paid') || 
        rawStatus.includes('approved') || rawStatus.includes('success') || rawStatus.includes('complete')) {
      status = 'approved';
    } else if (rawStatus.includes('recus') || rawStatus.includes('refus') || rawStatus.includes('declin') || 
               rawStatus.includes('failed') || rawStatus.includes('cancel') || rawStatus.includes('error')) {
      status = 'refused';
    } else if (rawStatus.includes('reemb') || rawStatus.includes('refund') || rawStatus.includes('chargeback') || 
               rawStatus.includes('estorn')) {
      status = 'refunded';
    }

    // 4. Extrair e normalizar o Valor Bruto (Amount)
    const rawAmount = body.amount || body.price || body.value || body.price_cents || body.total || 
                      body.valor || body.valor_bruto || (body.order && body.order.amount) || 
                      (body.order && body.order.price) || (body.transaction && body.transaction.amount) || 0;

    let amount = parseFloat(rawAmount);
    // Tratar se o checkout enviar valores em centavos (apenas se a chave de origem contiver 'cents')
    const hasCentsInKey = Object.keys(body).some(key => key.toLowerCase().includes('cents') && parseFloat(body[key]) === amount);
    if (hasCentsInKey) {
      amount = amount / 100;
    }

    // 5. Extrair e normalizar o Valor Líquido (Net Amount)
    const rawNetAmount = body.net_amount || body.net_value || body.commission || body.valor_liquido || 
                         body.net_cents || body.net || (body.order && body.order.net_amount) || null;
    
    let net_amount = rawNetAmount !== null ? parseFloat(rawNetAmount) : null;
    if (net_amount !== null) {
      const hasCentsInNetKey = Object.keys(body).some(key => key.toLowerCase().includes('cents') && parseFloat(body[key]) === net_amount);
      if (hasCentsInNetKey) {
        net_amount = net_amount / 100;
      }
    }
    // Se não enviado pela API, assume uma comissão padrão de 93% (7% de taxa da plataforma)
    if (net_amount === null || isNaN(net_amount)) {
      net_amount = amount * 0.93;
    }

    // 6. Extrair e normalizar a Data (formato YYYY-MM-DD no timezone de Brasília)
    const rawDate = body.date || body.approved_date || body.created_at || body.data_aprovacao || 
                    body.payment_date || (body.order && body.order.created_at) || null;
    
    let date = '';
    if (rawDate && typeof rawDate === 'string' && rawDate.length >= 10) {
      date = rawDate.substring(0, 10);
    } else {
      // Data de hoje em Brasília (UTC-3)
      const nowUtc = new Date();
      const tzOffset = -3 * 60; // minutos
      const localTime = new Date(nowUtc.getTime() + tzOffset * 60 * 1000);
      date = localTime.toISOString().substring(0, 10);
    }

    // 7. Buscar se o evento já existe para verificar duplicações ou transições de status
    const fetchExistingEventResponse = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?id=eq.${id}&select=*`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (!fetchExistingEventResponse.ok) {
      throw new Error(`Erro ao verificar evento existente: ${await fetchExistingEventResponse.text()}`);
    }

    const existingEvents = await fetchExistingEventResponse.json();
    const existingEvent = existingEvents.length > 0 ? existingEvents[0] : null;

    // Se o evento já existe e já estava aprovado, não fazemos nada (evita duplicações)
    if (existingEvent && existingEvent.status === 'approved') {
      return res.status(200).json({
        success: true,
        message: 'Evento já processado e aprovado anteriormente.'
      });
    }

    // 8. Salvar ou atualizar o evento na tabela cooud_events
    const supabaseHeaders = {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    };

    const eventPayload = {
      id: String(id),
      status: status === 'approved' ? 'approved' : `pending_debug:${JSON.stringify(body)}`,
      amount,
      net_amount,
      date,
      "updatedAt": new Date().toISOString()
    };

    const saveEventResponse = await fetch(`${SUPABASE_URL}/rest/v1/cooud_events?on_conflict=id`, {
      method: 'POST',
      headers: supabaseHeaders,
      body: JSON.stringify(eventPayload)
    });

    if (!saveEventResponse.ok) {
      throw new Error(`Erro ao salvar evento no Supabase: ${await saveEventResponse.text()}`);
    }

    // 9. Se o evento atual for aprovado, incrementamos a tabela principal de lançamentos (entries)
    if (status === 'approved') {
      // Buscar lançamento atual para incrementar de forma relativa
      const fetchEntryResponse = await fetch(`${SUPABASE_URL}/rest/v1/entries?date=eq.${date}&select=*`, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });

      if (!fetchEntryResponse.ok) {
        throw new Error(`Erro ao buscar lançamento do dia: ${await fetchEntryResponse.text()}`);
      }

      const entries = await fetchEntryResponse.json();

      if (entries.length > 0) {
        // Registro do dia existe, faz o incremento das vendas e faturamento sem sobrescrever tudo
        const entry = entries[0];
        const newSales = (entry.sales || 0) + 1;
        const newRevenue = Math.round(((entry.revenue || 0) + amount) * 100) / 100;

        const updateResponse = await fetch(`${SUPABASE_URL}/rest/v1/entries?id=eq.${entry.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sales: newSales,
            revenue: newRevenue,
            "updatedAt": new Date().toISOString()
          })
        });

        if (!updateResponse.ok) {
          throw new Error(`Erro ao atualizar lançamento principal: ${await updateResponse.text()}`);
        }
      } else {
        // Registro do dia não existe, cria um novo lançamento inicial
        const uuid = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
        const createResponse = await fetch(`${SUPABASE_URL}/rest/v1/entries`, {
          method: 'POST',
          headers: supabaseHeaders,
          body: JSON.stringify({
            id: uuid,
            date,
            adSpend: 0,
            iofPercent: 3.5,
            sales: 1,
            revenue: amount,
            notes: 'Criado via Webhook Cooud',
            sample: false,
            "createdAt": new Date().toISOString(),
            "updatedAt": new Date().toISOString()
          })
        });

        if (!createResponse.ok) {
          throw new Error(`Erro ao criar lançamento principal: ${await createResponse.text()}`);
        }
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Webhook processado e lançamento atualizado com sucesso.',
      data: { date, status, amount }
    });

  } catch (error) {
    console.error('Erro no processamento do webhook:', error);
    return res.status(500).json({ error: 'Erro interno no processamento do webhook.', details: error.message });
  }
};
