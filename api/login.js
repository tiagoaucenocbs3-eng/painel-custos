const APP_PASSWORD = process.env.APP_PASSWORD;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).end('Método não permitido');
  }

  try {
    // Para simplificar sem dependência extra (body-parser), o Vercel já parseia req.body automaticamente
    const { password } = req.body || {};

    if (!APP_PASSWORD) {
      // Se não há senha configurada nas variáveis de ambiente da Vercel, libera acesso automático
      return res.status(200).json({ success: true, required: false });
    }

    if (password === APP_PASSWORD) {
      return res.status(200).json({ success: true, required: true });
    } else {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }
  } catch (error) {
    console.error('Erro na API de login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};
