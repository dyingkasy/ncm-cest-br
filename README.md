# 📦 Tabela NCM Brasil

> Tabela NCM (Nomenclatura Comum do Mercosul) atualizada automaticamente todos os dias via GitHub Actions.

🌐 **Acesse:** `https://<seu-usuario>.github.io/<nome-do-repo>/`

---

## 🚀 Funcionalidades

- **+11.000 códigos NCM** com descrição oficial
- **Pesquisa em tempo real** por código ou descrição
- **Atualização automática diária** (06:00 UTC / 03:00 BRT)
- **Fonte oficial:** [BrasilAPI](https://brasilapi.com.br/api/ncm/v1)
- **Paginação** com 100 itens por página

---

## 🏗️ Estrutura

```
├── index.html                    # Página principal (GitHub Pages)
├── data/
│   └── ncm.json                  # Dados NCM (atualizado pelo Action)
├── scripts/
│   └── fetch.js                  # Script Node.js de atualização
├── .github/
│   └── workflows/
│       └── update-ncm.yml        # GitHub Actions (cron diário)
└── package.json
```

---

## ⚙️ Como usar este repositório

### 1. Fork ou clone
```bash
git clone https://github.com/seu-usuario/ncm-cest-br.git
cd ncm-cest-br
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Rode o script manualmente (opcional)
```bash
npm run fetch
```

### 4. Configure o GitHub Pages
1. Vá em **Settings → Pages**
2. Source: **Deploy from branch**
3. Branch: `main` → pasta `/` (root)
4. Salve e aguarde o deploy

### 5. Ativar as Actions
- Vá em **Actions** no seu repositório
- Se precisar, clique em **"Enable GitHub Actions"**
- O cron roda automaticamente todo dia às 06:00 UTC
- Para rodar manualmente: **Actions → Atualizar NCM Diariamente → Run workflow**

---

## 🔄 Como funciona a atualização

```
GitHub Actions (cron diário)
        ↓
  node scripts/fetch.js
        ↓
  GET brasilapi.com.br/api/ncm/v1
        ↓
  Salva em data/ncm.json
        ↓
  git commit & push (só se houver mudanças)
        ↓
  GitHub Pages serve o index.html atualizado
```

---

## 📡 Fonte dos dados

| Dado | Fonte | Endpoint |
|------|-------|----------|
| NCM  | BrasilAPI | `https://brasilapi.com.br/api/ncm/v1` |

---

## 📄 Licença

MIT — Dados públicos do governo brasileiro via BrasilAPI.
