-- SCRIPT DE CONFIGURAÇÃO PARA O SUPABASE SQL EDITOR
-- Abra o Supabase > SQL Editor > New Query > Cole este script > Clique em Run

-- 1. Criar a tabela de lançamentos (entries)
CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  "adSpend" NUMERIC DEFAULT 0,
  "iofPercent" NUMERIC DEFAULT 0,
  sales INTEGER DEFAULT 0,
  revenue NUMERIC DEFAULT 0,
  notes TEXT,
  sample BOOLEAN DEFAULT FALSE,
  "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Desabilitar RLS para permitir acesso via API (seguro pois a API roda no backend da Vercel)
ALTER TABLE entries DISABLE ROW LEVEL SECURITY;

-- 2. Criar a tabela de configurações (settings)
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY,
  data JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Desabilitar RLS
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Inserir registro padrão de configurações vazias se não existir
INSERT INTO settings (id, data)
VALUES (1, '{}')
ON CONFLICT (id) DO NOTHING;

-- 3. Criar a tabela de eventos do Checkout Cooud (Postbacks)
CREATE TABLE IF NOT EXISTS cooud_events (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL, -- 'approved', 'refused', 'refunded', 'chargeback', 'pending'
  amount NUMERIC DEFAULT 0, -- valor bruto
  net_amount NUMERIC DEFAULT 0, -- valor líquido
  date TEXT NOT NULL, -- YYYY-MM-DD (para agrupamento)
  "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Desabilitar RLS
ALTER TABLE cooud_events DISABLE ROW LEVEL SECURITY;

-- 4. Criar a tabela de gastos extras mensais (extra_expenses)
CREATE TABLE IF NOT EXISTS extra_expenses (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL, -- YYYY-MM-DD
  description TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'Outros',
  notes TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
  "updatedAt" TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- Desabilitar RLS
ALTER TABLE extra_expenses DISABLE ROW LEVEL SECURITY;

