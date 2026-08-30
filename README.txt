PAINEL DE OPERAÇÃO

Como abrir:
1. Abra a pasta: C:\Users\tiago\Downloads\APP DE CUSTO
2. Dê dois cliques no arquivo index.html
3. O aplicativo abre direto no navegador, sem servidor, login, API ou banco online.

Arquivos principais:
- index.html: estrutura da interface
- style.css: tema escuro responsivo
- calculations.js: fórmulas financeiras
- storage.js: persistência local com LocalStorage e backup
- charts.js: gráficos em Canvas sem dependência externa
- app.js: dashboard, lançamentos, calendário, relatórios, metas e configurações
- tests/calculations.test.js: testes automatizados das fórmulas

Dados:
- Os dados ficam salvos no próprio navegador via LocalStorage.
- Ao abrir pela primeira vez, o app cria 15 dias de dados fictícios para teste.
- Use o botão "Apagar dados de exemplo" antes de começar com dados reais.
- Use "Exportar backup JSON" regularmente para manter uma cópia fora do navegador.

Backup e CSV:
- Exportar backup JSON: salva lançamentos + configurações.
- Importar backup: restaura um arquivo JSON e substitui os dados atuais após confirmação.
- Exportar CSV: gera a tabela diária com métricas para abrir no Excel.

Rodar testes das fórmulas, se quiser:
1. Abra um terminal na pasta do projeto.
2. Execute: node tests/calculations.test.js

Observação:
O app não usa Chart.js/CDN. Os gráficos são desenhados localmente em Canvas para funcionar offline ao abrir index.html.
