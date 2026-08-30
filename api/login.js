const APP_USERNAME = process.env.APP_USERNAME || 'admin';
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
    const { username, password } = req.body || {};

    if (!APP_PASSWORD) {
      // Se não há senha configurada nas variáveis de ambiente da Vercel, libera acesso automático
      return res.status(200).json({ success: true, required: false });
    }

    // Valida usuário (usa o definido no env ou o padrão 'admin') e a senha
    if (password === APP_PASSWORD && username === APP_USERNAME) {
      return res.status(200).json({ success: true, required: true });
    } else {
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }
  } catch (error) {
    console.error('Erro na API de login:', error);
    return res.status(500).json({ error: 'Erro interno no servidor.' });
  }
};
