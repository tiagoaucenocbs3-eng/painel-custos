(function (root) {
  'use strict';

  const ENTRY_KEY = 'painelOperacao.entries.v1';
  const SETTINGS_KEY = 'painelOperacao.settings.v1';
  const SEEDED_KEY = 'painelOperacao.seeded.v1';

  // Chaves para sincronização com banco de dados
  const PENDING_DELETES_KEY = 'painelOperacao.pendingDeletes.v1';
  const PENDING_UPSERTS_KEY = 'painelOperacao.pendingUpserts.v1';
  const MIGRATED_KEY = 'painelOperacao.migratedToCloud.v1';

  const defaultSettings = {
    defaultIof: 3.5,
    roasMin: 1.8,
    roasGood: 2.5,
    roiMin: 50,
    roiGood: 140,
    cpaMax: 50,
    dailyRevenueGoal: 3500,
    dailySalesGoal: 30,
    monthlyRevenueGoal: 100000,
    monthlyProfitGoal: 65000,
    currency: 'BRL',
  };

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

  // --- Módulo de API ---
  const api = {
    async fetchEntries() {
      const res = await fetch('/api/entries');
      if (!res.ok) throw new Error('Falha ao buscar lançamentos da API');
      return res.json();
    },
    async upsertEntry(entry) {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      if (!res.ok) throw new Error('Falha ao salvar lançamento na API');
      return res.json();
    },
    async deleteEntry(id) {
      const res = await fetch(`/api/entries?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao excluir lançamento na API');
      return res.json();
    },
    async clearAllEntries() {
      const res = await fetch('/api/entries?all=true', {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Falha ao limpar lançamentos na API');
      return res.json();
    },
    async fetchSettings() {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Falha ao buscar configurações da API');
      return res.json();
    },
    async saveSettings(settings) {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
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
    // Tenta enviar em background imediatamente
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
    // Remove da fila de upserts se estiver lá
    savePendingUpserts(getPendingUpserts().filter(x => x.id !== id));
    // Tenta excluir em background imediatamente
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

  // Variável para evitar requisições de sincronização simultâneas
  let isSyncing = false;

  async function syncWithCloud() {
    if (location.protocol === 'file:' || isSyncing) return;
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
          console.warn('[Sync] Falha ao enviar lançamento pendente para ID:', entry.id, err);
        }
      }

      let dataChanged = false;

      // 3. Sincronizar configurações
      try {
        const cloudSettings = await api.fetchSettings();
        if (cloudSettings && typeof cloudSettings === 'object' && Object.keys(cloudSettings).length > 0) {
          const localSettings = readJSON(SETTINGS_KEY, {});
          
          // Se as configurações da nuvem forem diferentes das locais, sobrescreve local
          if (JSON.stringify(cloudSettings) !== JSON.stringify(localSettings)) {
            writeJSON(SETTINGS_KEY, { ...defaultSettings, ...cloudSettings });
            dataChanged = true;
          }
        } else {
          // Se não há nada na nuvem, sobe as configurações locais
          const localSettings = readJSON(SETTINGS_KEY, null);
          if (localSettings) {
            await api.saveSettings(localSettings);
          }
        }
      } catch (err) {
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
              // Se não existe localmente e não foi excluído localmente nesta aba
              if (!getPendingDeletes().includes(cloudEntry.id)) {
                merged.push(cloudEntry);
                dataChanged = true;
              }
            } else {
              const localTime = new Date(local.updatedAt || local.createdAt || 0).getTime();
              const cloudTime = new Date(cloudEntry.updatedAt || cloudEntry.createdAt || 0).getTime();

              if (cloudTime > localTime) {
                // Nuvem é mais recente, atualiza local
                const idx = merged.findIndex(x => x.id === cloudEntry.id);
                if (idx >= 0) {
                  merged[idx] = cloudEntry;
                  dataChanged = true;
                }
              } else if (localTime > cloudTime && !local.sample) {
                // Local é mais recente, envia para a nuvem
                queueUpsert(local);
              }
            }
          }

          // Processar lançamentos locais que não estão na nuvem
          for (const localEntry of localEntries) {
            if (localEntry.sample) continue;

            if (!cloudMap.has(localEntry.id)) {
              if (getPendingDeletes().includes(localEntry.id)) continue;

              // Se não está na fila de upsert pendente e não está na nuvem,
              // significa que foi excluído na nuvem por outro dispositivo, logo deleta localmente
              const upserts = getPendingUpserts();
              const isPending = upserts.some(x => x.id === localEntry.id);

              if (!isPending) {
                const idx = merged.findIndex(x => x.id === localEntry.id);
                if (idx >= 0) {
                  merged.splice(idx, 1);
                  dataChanged = true;
                }
              } else {
                // Está na fila de pendências, então tenta enviar
                queueUpsert(localEntry);
              }
            }
          }

          if (dataChanged) {
            merged.sort((a, b) => a.date.localeCompare(b.date));
            writeJSON(ENTRY_KEY, merged.map(normalizeEntry));
          }
        }
      } catch (err) {
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

      // Sincronizar em background
      if (location.protocol !== 'file:') {
        queueUpsert(normalized);
      }

      return normalized;
    },
    deleteEntry(id) {
      const entries = this.getEntries().filter((item) => item.id !== id);
      this.saveEntries(entries);

      // Sincronizar em background
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

      // Sincronizar em background
      if (location.protocol !== 'file:') {
        api.saveSettings(clean).catch(err => {
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

      // Sincronizar tudo para a nuvem
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

      // Limpar banco na nuvem
      if (location.protocol !== 'file:') {
        api.clearAllEntries().catch(err => {
          console.warn('Falha ao limpar banco de dados na nuvem:', err);
        });
      }
    },
  };

  // Inicializar migração e agendar sincronizações
  if (typeof window !== 'undefined') {
    migrateLocalToPending();

    if (location.protocol !== 'file:') {
      // Sincronizar após carregamento completo
      window.addEventListener('load', () => {
        setTimeout(syncWithCloud, 1000);
      });
      // Sincronizar ao focar na janela/aba ou voltar online
      window.addEventListener('focus', syncWithCloud);
      window.addEventListener('online', syncWithCloud);
      // Sincronização periódica a cada 1 minuto
      setInterval(syncWithCloud, 60000);
    }
  }

  root.FinStorage = storage;
})(window);
