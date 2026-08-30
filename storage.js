(function (root) {
  'use strict';

  const ENTRY_KEY = 'painelOperacao.entries.v1';
  const SETTINGS_KEY = 'painelOperacao.settings.v1';
  const SEEDED_KEY = 'painelOperacao.seeded.v1';

  // Chaves para sincronização e autenticação
  const PENDING_DELETES_KEY = 'painelOperacao.pendingDeletes.v1';
  const PENDING_UPSERTS_KEY = 'painelOperacao.pendingUpserts.v1';
  const MIGRATED_KEY = 'painelOperacao.migratedToCloud.v1';
  const AUTH_TOKEN_KEY = 'painelOperacao.password.v1';

  // BACKUP REAL DO USUÁRIO (21 a 30 de agosto de 2026)
  const DEFAULT_BACKUP = {
    entries: [
      {
        "id": "0a950706-04a2-4302-b3c6-bc992c5977e8",
        "date": "2026-08-21",
        "adSpend": 295.15,
        "iofPercent": 3.5,
        "sales": 0,
        "revenue": 0,
        "notes": "Inicio de testes de criativo",
        "sample": false,
        "createdAt": "2026-08-28T23:13:18.020Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "7a8971f7-1ce5-42c5-ba8a-a1cca46464fb",
        "date": "2026-08-22",
        "adSpend": 907.79,
        "iofPercent": 3.5,
        "sales": 6,
        "revenue": 1096.81,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-28T23:14:20.046Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "ed2654ea-ade1-4270-83ae-e935c405de07",
        "date": "2026-08-23",
        "adSpend": 966.94,
        "iofPercent": 3.5,
        "sales": 14,
        "revenue": 3286.96,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-28T23:15:01.352Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "a4106b6f-0eb3-4743-b2df-8788910b5bc9",
        "date": "2026-08-24",
        "adSpend": 573.17,
        "iofPercent": 3.5,
        "sales": 2,
        "revenue": 399.8,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-28T23:15:34.953Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "7494ecd3-84c6-41d9-b4c6-7ffd4768e3c3",
        "date": "2026-08-25",
        "adSpend": 840.79,
        "iofPercent": 3.5,
        "sales": 2,
        "revenue": 400.55,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-28T23:16:05.718Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "feed4d20-88de-43a7-8a9a-243773156755",
        "date": "2026-08-26",
        "adSpend": 316.5,
        "iofPercent": 3.5,
        "sales": 0,
        "revenue": 0,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-28T23:16:31.591Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "fe0228e5-eeb9-4194-b183-0a7c16bc2088",
        "date": "2026-08-28",
        "adSpend": 1004.81,
        "iofPercent": 3.5,
        "sales": 15,
        "revenue": 3393.16,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-29T03:02:24.615Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "5a3e0cb6-1f54-41c0-8232-a098e789939f",
        "date": "2026-08-29",
        "adSpend": 1372.62,
        "iofPercent": 3.5,
        "sales": 8,
        "revenue": 2005.5,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-30T02:49:41.078Z",
        "updatedAt": "2026-08-30T13:47:22.818Z"
      },
      {
        "id": "fbd06563-65b3-45e4-a6cb-735d4ce741a5",
        "date": "2026-08-30",
        "adSpend": 1021.01,
        "iofPercent": 3.5,
        "sales": 14,
        "revenue": 2982.56,
        "notes": "",
        "sample": false,
        "createdAt": "2026-08-30T19:32:59.330Z",
        "updatedAt": "2026-08-30T19:32:59.330Z"
      }
    ],
    settings: {
      "defaultIof": 3.5,
      "roasMin": 1.8,
      "roasGood": 2.5,
      "roiMin": 50,
      "roiGood": 140,
      "cpaMax": 50,
      "dailyRevenueGoal": 3500,
      "dailySalesGoal": 30,
      "monthlyRevenueGoal": 100000,
      "monthlyProfitGoal": 65000,
      "currency": "BRL"
    }
  };

  const defaultSettings = DEFAULT_BACKUP.settings;

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      console.warn('Falha ao ler localStorage', key, error);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeEntry(entry) {
    return {
      id: entry.id || uuid(),
      date: entry.date,
      adSpend: Number(entry.adSpend) || 0,
      iofPercent: Number(entry.iofPercent) || 0,
      sales: Math.max(0, Math.round(Number(entry.sales) || 0)),
      revenue: Number(entry.revenue) || 0,
      notes: entry.notes || '',
      sample: Boolean(entry.sample),
      createdAt: entry.createdAt || new Date().toISOString(),
      updatedAt: entry.updatedAt || new Date().toISOString(),
    };
  }

  // --- Função Auxiliar de Autenticação ---
  function getAuthHeaders(extraHeaders = {}) {
    const password = localStorage.getItem(AUTH_TOKEN_KEY) || '';
    return {
      'Authorization': password,
      ...extraHeaders
    };
  }

  // --- Módulo de API com cabeçalho de Autenticação ---
  const api = {
    async fetchEntries() {
      const res = await fetch('/api/entries', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao buscar lançamentos da API');
      return res.json();
    },
    async upsertEntry(entry) {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(entry),
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao salvar lançamento na API');
      return res.json();
    },
    async deleteEntry(id) {
      const res = await fetch(`/api/entries?id=${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao excluir lançamento na API');
      return res.json();
    },
    async clearAllEntries() {
      const res = await fetch('/api/entries?all=true', {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao limpar lançamentos na API');
      return res.json();
    },
    async fetchSettings() {
      const res = await fetch('/api/settings', {
        headers: getAuthHeaders()
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao buscar configurações da API');
      return res.json();
    },
    async saveSettings(settings) {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(settings),
      });
      if (res.status === 401) throw new Error('AUTH_ERROR');
      if (!res.ok) throw new Error('Falha ao salvar configurações na API');
      return res.json();
    },
  };

  // --- Filas e Sincronização em Background ---
  function getPendingDeletes() { return readJSON(PENDING_DELETES_KEY, []); }
  function savePendingDeletes(ids) { writeJSON(PENDING_DELETES_KEY, ids); }
  function getPendingUpserts() { return readJSON(PENDING_UPSERTS_KEY, []); }
  function savePendingUpserts(entries) { writeJSON(PENDING_UPSERTS_KEY, entries); }

  function queueUpsert(entry) {
    if (entry.sample) return;
    const upserts = getPendingUpserts();
    if (!upserts.some(x => x.id === entry.id)) {
      upserts.push(entry);
      savePendingUpserts(upserts);
    }
    api.upsertEntry(entry)
      .then(() => {
        savePendingUpserts(getPendingUpserts().filter(x => x.id !== entry.id));
      })
      .catch(() => {});
  }

  function queueDelete(id) {
    const deletes = getPendingDeletes();
    if (!deletes.includes(id)) {
      deletes.push(id);
      savePendingDeletes(deletes);
    }
    savePendingUpserts(getPendingUpserts().filter(x => x.id !== id));
    api.deleteEntry(id)
      .then(() => {
        savePendingDeletes(getPendingDeletes().filter(x => x !== id));
      })
      .catch(() => {});
  }

  // Migrar dados locais para a fila de sincronização na primeira vez
  function migrateLocalToPending() {
    if (localStorage.getItem(MIGRATED_KEY)) return;

    const localEntries = readJSON(ENTRY_KEY, []).map(normalizeEntry).filter(e => !e.sample);
    if (localEntries.length > 0) {
      const upserts = getPendingUpserts();
      for (const entry of localEntries) {
        if (!upserts.some(x => x.id === entry.id)) {
          upserts.push(entry);
        }
      }
      savePendingUpserts(upserts);
    }
    localStorage.setItem(MIGRATED_KEY, 'true');
  }

  // Forçar aplicação do backup real do usuário na primeira execução do novo código
  const BACKUP_APPLIED_KEY = 'painelOperacao.backupApplied.v2';

  function forceApplyUserBackup() {
    if (localStorage.getItem(BACKUP_APPLIED_KEY)) return;

    console.log('[Migration] Forçando aplicação do backup real do usuário...');
    writeJSON(ENTRY_KEY, DEFAULT_BACKUP.entries);
    writeJSON(SETTINGS_KEY, DEFAULT_BACKUP.settings);
    localStorage.setItem(SEEDED_KEY, 'default-backup-seeded');

    // Forçar envio para a nuvem colocando todos na fila de pendências
    const upserts = DEFAULT_BACKUP.entries.filter(e => !e.sample);
    savePendingUpserts(upserts);

    localStorage.setItem(BACKUP_APPLIED_KEY, 'true');
    localStorage.setItem(MIGRATED_KEY, 'true'); // Marca migrado como feito
  }

  function deduplicateEntriesByDate(entries) {
    const map = new Map();
    const sorted = [...entries].sort((a, b) => {
      const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return aTime - bTime;
    });
    for (const entry of sorted) {
      map.set(entry.date, entry);
    }
    return Array.from(map.values());
  }

  let isSyncing = false;

  async function syncWithCloud() {
    if (location.protocol === 'file:' || isSyncing) return;
    
    // Se a senha for exigida e não estivermos logados, não sincroniza
    const authInfo = await storage.checkAuthRequired();
    if (authInfo.required && !storage.isAuthenticated()) {
      console.warn('[Sync] Sincronização bloqueada: Senha necessária.');
      return;
    }

    isSyncing = true;
    console.log('[Sync] Iniciando sincronização com o Supabase...');

    try {
      // 1. Processar exclusões pendentes
      const deletes = getPendingDeletes();
      for (const id of [...deletes]) {
        try {
          await api.deleteEntry(id);
          savePendingDeletes(getPendingDeletes().filter(x => x !== id));
        } catch (err) {
          if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
          console.warn('[Sync] Falha ao enviar exclusão pendente para ID:', id, err);
        }
      }

      // 2. Processar inserções/edições pendentes
      const upserts = getPendingUpserts();
      for (const entry of [...upserts]) {
        try {
          await api.upsertEntry(entry);
          savePendingUpserts(getPendingUpserts().filter(x => x.id !== entry.id));
        } catch (err) {
          if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
          console.warn('[Sync] Falha ao enviar lançamento pendente para ID:', entry.id, err);
        }
      }

      let dataChanged = false;

      // 3. Sincronizar configurações
      try {
        const cloudSettings = await api.fetchSettings();
        if (cloudSettings && typeof cloudSettings === 'object' && Object.keys(cloudSettings).length > 0) {
          const localSettings = readJSON(SETTINGS_KEY, {});
          if (JSON.stringify(cloudSettings) !== JSON.stringify(localSettings)) {
            writeJSON(SETTINGS_KEY, { ...defaultSettings, ...cloudSettings });
            dataChanged = true;
          }
        } else {
          const localSettings = readJSON(SETTINGS_KEY, null);
          if (localSettings) {
            await api.saveSettings(localSettings);
          }
        }
      } catch (err) {
        if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
        console.warn('[Sync] Erro ao sincronizar configurações da nuvem:', err);
      }

      // 4. Sincronizar lançamentos (Entries)
      try {
        const cloudEntries = await api.fetchEntries();
        if (Array.isArray(cloudEntries)) {
          const localEntries = readJSON(ENTRY_KEY, []).map(normalizeEntry);
          const merged = [...localEntries];
          const cloudMap = new Map(cloudEntries.map(e => [e.id, e]));
          const localMap = new Map(localEntries.map(e => [e.id, e]));

          // Processar lançamentos da nuvem
          for (const cloudEntry of cloudEntries) {
            const local = localMap.get(cloudEntry.id);
            if (!local) {
              if (!getPendingDeletes().includes(cloudEntry.id)) {
                merged.push(cloudEntry);
                dataChanged = true;
              }
            } else {
              const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
              const cloudTime = new Date(cloudEntry.updatedAt || cloudEntry.createdAt || 0).getTime();

              if (cloudTime > localTime) {
                const idx = merged.findIndex(x => x.id === cloudEntry.id);
                if (idx >= 0) {
                  merged[idx] = cloudEntry;
                  dataChanged = true;
                }
              } else if (localTime > cloudTime && !local.sample) {
                queueUpsert(local);
              }
            }
          }

          // Processar lançamentos locais que não estão na nuvem
          for (const localEntry of localEntries) {
            if (localEntry.sample) continue;

            if (!cloudMap.has(localEntry.id)) {
              if (getPendingDeletes().includes(localEntry.id)) continue;

              const upserts = getPendingUpserts();
              const isPending = upserts.some(x => x.id === localEntry.id);

              if (!isPending) {
                const idx = merged.findIndex(x => x.id === localEntry.id);
                if (idx >= 0) {
                  merged.splice(idx, 1);
                  dataChanged = true;
                }
              } else {
                queueUpsert(localEntry);
              }
            }
          }

          const deduplicated = deduplicateEntriesByDate(merged);
          if (deduplicated.length !== localEntries.length || dataChanged) {
            deduplicated.sort((a, b) => a.date.localeCompare(b.date));
            writeJSON(ENTRY_KEY, deduplicated.map(normalizeEntry));
            dataChanged = true;
          }
        }
      } catch (err) {
        if (err.message === 'AUTH_ERROR') { handleAuthError(); return; }
        console.warn('[Sync] Erro ao sincronizar lançamentos da nuvem:', err);
      }

      // 5. Se houve mudanças, recarrega a UI
      if (dataChanged && window.PainelOperacao && typeof window.PainelOperacao.refreshData === 'function') {
        console.log('[Sync] Dados atualizados. Atualizando interface...');
        window.PainelOperacao.refreshData();
        window.PainelOperacao.render();
      }
    } catch (error) {
      console.error('[Sync] Erro geral na sincronização:', error);
    } finally {
      isSyncing = false;
    }
  }

  function handleAuthError() {
    isSyncing = false;
    console.warn('[Sync] Senha incorreta detectada durante a chamada de API. Expulsando sessão...');
    localStorage.removeItem(AUTH_TOKEN_KEY);
    if (typeof window !== 'undefined' && typeof window.showLoginOverlay === 'function') {
      window.showLoginOverlay(true, 'Sessão expirada. Insira a senha novamente.');
    }
  }

  // --- Objeto de Armazenamento Principal ---
  const storage = {
    defaultSettings,
    getEntries() {
      return readJSON(ENTRY_KEY, []).map(normalizeEntry).sort((a, b) => a.date.localeCompare(b.date));
    },
    saveEntries(entries) {
      writeJSON(ENTRY_KEY, entries.map(normalizeEntry));
    },
    upsertEntry(entry) {
      const entries = this.getEntries();
      const normalized = normalizeEntry(entry);
      const index = entries.findIndex((item) => item.id === normalized.id);
      if (index >= 0) entries[index] = { ...entries[index], ...normalized };
      else entries.push(normalized);
      this.saveEntries(entries);

      if (location.protocol !== 'file:') {
        queueUpsert(normalized);
      }

      return normalized;
    },
    deleteEntry(id) {
      const entries = this.getEntries().filter((item) => item.id !== id);
      this.saveEntries(entries);

      if (location.protocol !== 'file:') {
        queueDelete(id);
      }
    },
    getSettings() {
      return { ...defaultSettings, ...readJSON(SETTINGS_KEY, {}) };
    },
    saveSettings(settings) {
      const clean = { ...defaultSettings, ...settings };
      writeJSON(SETTINGS_KEY, clean);

      if (location.protocol !== 'file:') {
        api.saveSettings(clean).catch(err => {
          if (err.message === 'AUTH_ERROR') handleAuthError();
          console.warn('Falha imediata ao salvar configurações na API:', err);
        });
      }
      return clean;
    },
    exportBackup() {
      return {
        app: 'Painel de Operação',
        version: 1,
        exportedAt: new Date().toISOString(),
        entries: this.getEntries(),
        settings: this.getSettings(),
      };
    },
    importBackup(backup) {
      if (!backup || !Array.isArray(backup.entries) || typeof backup.settings !== 'object') {
        throw new Error('Arquivo inválido. O JSON precisa conter entries[] e settings.');
      }
      this.saveEntries(backup.entries.map(normalizeEntry));
      this.saveSettings({ ...defaultSettings, ...backup.settings });
      localStorage.setItem(SEEDED_KEY, 'manual-import');

      if (location.protocol !== 'file:') {
        const entries = this.getEntries().filter(e => !e.sample);
        for (const entry of entries) {
          queueUpsert(entry);
        }
        api.saveSettings(this.getSettings()).catch(() => {});
      }
    },
    seedSampleData(force = false) {
      const current = this.getEntries();
      if (!force && (current.length || localStorage.getItem(SEEDED_KEY))) return 0;
      const today = new Date();
      const entries = [];
      for (let i = 14; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
        const date = root.FinCalc.toISODate(d);
        const wave = Math.sin((15 - i) / 2.2);
        const adSpend = Math.round((850 + (14 - i) * 38 + wave * 160) * 100) / 100;
        const sales = Math.max(8, Math.round(20 + (14 - i) * 0.9 + wave * 7));
        const ticket = 104 + ((i % 5) * 5) + (wave * 6);
        const revenue = Math.round(sales * ticket * 100) / 100;
        entries.push(normalizeEntry({
          date,
          adSpend,
          iofPercent: i % 4 === 0 ? 4.38 : 3.5,
          sales,
          revenue,
          notes: i === 0 ? 'Dados fictícios para testar o dashboard.' : 'Exemplo automático.',
          sample: true,
        }));
      }
      this.saveEntries([...current.filter((item) => !item.sample), ...entries]);
      localStorage.setItem(SEEDED_KEY, new Date().toISOString());
      return entries.length;
    },
    deleteSampleData() {
      const before = this.getEntries();
      const after = before.filter((entry) => !entry.sample);
      this.saveEntries(after);
      localStorage.setItem(SEEDED_KEY, 'deleted');
      return before.length - after.length;
    },
    wipeAll() {
      localStorage.removeItem(ENTRY_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem(SEEDED_KEY);
      localStorage.removeItem(MIGRATED_KEY);
      localStorage.removeItem(PENDING_DELETES_KEY);
      localStorage.removeItem(PENDING_UPSERTS_KEY);
      localStorage.removeItem(AUTH_TOKEN_KEY);

      if (location.protocol !== 'file:') {
        api.clearAllEntries().catch(err => {
          console.warn('Falha ao limpar banco de dados na nuvem:', err);
        });
      }
    },
    async login(username, password) {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      
      if (!res.ok) {
        throw new Error('Usuário ou senha incorretos.');
      }
      
      const data = await res.json();
      localStorage.setItem(AUTH_TOKEN_KEY, password);
      
      // Forçar sincronização imediata
      syncWithCloud();
      return data;
    },
    logout() {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      location.reload();
    },
    isAuthenticated() {
      return !!localStorage.getItem(AUTH_TOKEN_KEY);
    },
    async checkAuthRequired() {
      if (location.protocol === 'file:') return { required: false };
      try {
        const res = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: '' }),
        });
        if (res.ok) {
          return { required: false }; // APP_PASSWORD está vazio, não exige senha
        }
        return { required: true }; // Retorna 401, então exige senha
      } catch (err) {
        console.warn('Erro ao verificar se senha é exigida:', err);
        return { required: false }; // Fallback local
      }
    },
    triggerSync() {
      syncWithCloud();
    }
  };

  // Inicializar dados e agendar sincronizações
  if (typeof window !== 'undefined') {
    forceApplyUserBackup();
    migrateLocalToPending();

    if (location.protocol !== 'file:') {
      window.addEventListener('load', () => {
        setTimeout(syncWithCloud, 1000);
      });
      window.addEventListener('focus', syncWithCloud);
      window.addEventListener('online', syncWithCloud);
      setInterval(syncWithCloud, 60000);
    }
  }

  root.FinStorage = storage;
})(window);
