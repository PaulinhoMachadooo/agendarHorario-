# Agendar Horário

Aplicação Vite/React com uma API PHP compatível com as chamadas usadas pelo app. A API PHP deve ser publicada na Hostinger e conecta em um banco MySQL.

## Configuração da API PHP na Hostinger

1. Publique o conteúdo da pasta `hostinger-api/` no caminho configurado em `VITE_HOSTINGER_API_URL`.
   - No ambiente atual, o frontend aponta para `https://agendarhorarios.online/api/barber`.
   - Portanto, `hostinger-api/db/query.php` precisa ficar acessível como `https://agendarhorarios.online/api/barber/db/query.php`.
2. No servidor, copie `hostinger-api/.env.example` para `hostinger-api/.env` e preencha com os dados reais do banco MySQL do hPanel:

```ini
DB_HOST=localhost
DB_PORT=3306
DB_DATABASE=u000000000_nome_do_banco
DB_USERNAME=u000000000_usuario
DB_PASSWORD=senha_do_banco
```

> Na Hostinger, quando o site e o MySQL estão no mesmo plano, o host normalmente é `localhost`. Se o hPanel informar outro host, use exatamente o valor exibido lá.

3. Importe os SQLs de `database/hostinger/` no banco MySQL, em ordem numérica. A migration `008_create_quitados.sql` cria a tabela `quitados`, usada para salvar dados da quitação e forma de pagamento quando um serviço é quitado.
4. Abra o diagnóstico da API no navegador ou via cURL:

```bash
curl https://agendarhorarios.online/api/barber/health.php
```

A resposta esperada é `status: "ok"`, `database.connected: true` e as tabelas principais, incluindo `quitados`, marcadas como `true`. Se aparecer `status: "error"`, confira a mensagem em `error.message` e os campos em `database.settings.sources` para saber se a API está usando variáveis do `.env` ou valores padrão.

## Problemas comuns de conexão

- `VITE_HOSTINGER_API_URL` aponta para um caminho diferente do local onde os arquivos PHP foram publicados.
- O arquivo `hostinger-api/.env` não existe no servidor ou está com nome/caminho incorreto.
- `DB_HOST` está como IP, mas o usuário do MySQL só tem permissão para `localhost`.
- Nome do banco, usuário ou senha no hPanel foram alterados e a API ainda está usando valores antigos.
- As tabelas ainda não foram importadas pelo phpMyAdmin.
