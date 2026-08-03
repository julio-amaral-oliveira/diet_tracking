# 🏋️ Controle de Peso — Backend API

Backend API para controle de peso e composição corporal. Rastreia peso, medidas corporais (antropometria), nutrição e a evolução de cada métrica ao longo do tempo. Suporta múltiplos perfis (uma pessoa por perfil).

## Tech Stack

- **Python 3.11+** com **FastAPI**
- **PostgreSQL 16** (banco de dados)
- **SQLAlchemy Async** (ORM)
- **Pydantic V2** (validação de dados)
- **Docker & Docker Compose** (containerização)
- **Pandas** (processamento de CSV)

---

## 🚀 Como Rodar

### Com Docker (Recomendado)

```bash
# Construir e iniciar todos os serviços
docker-compose up --build

# A API estará disponível em: http://localhost:8000
# Docs (Swagger UI): http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

### Sem Docker (Desenvolvimento Local)

```bash
# 1. Crie um ambiente virtual
python -m venv venv
source venv/bin/activate  # Linux/Mac

# 2. Instale as dependências
pip install -r requirements.txt

# 3. Configure o banco PostgreSQL e atualize o .env
# DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/weight_db

# 4. Inicie o servidor
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

---

## 📁 Estrutura do Projeto

```
diet_tracking/
├── docker-compose.yml          # Orquestração dos containers
├── Dockerfile                  # Imagem da aplicação
├── requirements.txt            # Dependências Python
├── .env                        # Variáveis de ambiente
├── .gitignore
├── readme.md
└── app/
    ├── __init__.py
    ├── main.py                 # Entry point do FastAPI
    ├── models.py               # Modelos SQLAlchemy (tabelas do banco)
    ├── schemas.py              # Schemas Pydantic (request/response)
    ├── core/
    │   ├── __init__.py
    │   ├── config.py           # Configurações da aplicação
    │   └── database.py         # Engine async e session factory
    ├── routers/
    │   ├── __init__.py
    │   ├── profiles.py         # Perfis (multi-pessoa)
    │   ├── foods.py            # CRUD de alimentos + importação CSV
    │   ├── diet.py             # Planos de dieta, refeições e itens
    │   ├── body_logs.py        # Registro de medidas corporais
    │   └── dashboard.py        # Estatísticas e dados para gráficos
    └── services/
        ├── __init__.py
        ├── profiles.py         # Lógica de negócio dos perfis
        ├── importer.py         # Parser e limpeza do CSV TACO
        ├── body_fat.py         # Cálculo de gordura corporal (Pollock 7 dobras)
        └── diet_calculator.py  # Cálculos de macros da dieta
```

---

## 🔗 Endpoints da API

### Profiles (Perfis)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/profiles/` | Listar perfis |
| `POST` | `/profiles/` | Criar perfil |
| `PATCH` | `/profiles/{id}` | Renomear perfil |
| `DELETE` | `/profiles/{id}` | Excluir perfil e todos os seus dados |

### Foods (Alimentos)
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/foods/` | Listar/buscar alimentos |
| `POST` | `/foods/` | Criar alimento manualmente (valores por 100g) |
| `GET` | `/foods/{id}` | Buscar alimento por ID |
| `POST` | `/foods/import-taco` | Importar CSV da tabela TACO |

### Diet (Dieta)
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/diet/plans` | Criar plano de dieta com metas |
| `GET` | `/diet/current` | Obter plano atual completo (hierarquia) |
| `POST` | `/diet/plans/{id}/meals` | Adicionar refeição ao plano |
| `POST` | `/diet/meals/{id}/add_item` | Adicionar alimento à refeição |
| `DELETE` | `/diet/meal-items/{id}` | Remover alimento da refeição |

### Body Logs (Medidas Corporais)
| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/body-logs/` | Registrar peso, dobras e/ou medidas |
| `GET` | `/body-logs/` | Listar registros (com filtro de data) |
| `GET` | `/body-logs/{id}` | Buscar registro por ID |

### Dashboard
| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/dashboard/stats` | Dados de séries temporais para gráficos |

---

## 🧮 Lógica de Negócio

### Cálculo de Macros por Refeição
Todos os alimentos armazenam valores **por 100g**. O cálculo real é:
```
Total = (quantidade_gramas / 100) × valor_por_100g
```

### Cálculo de Gordura Corporal (Pollock 7 Dobras)
Usa a equação de **Jackson & Pollock (1978)** para homens:
```
Densidade = 1.112 - (0.00043499 × S) + (0.00000055 × S²) - (0.00028826 × Idade)
Gordura % = (495 / Densidade) - 450  (Equação de Siri)
```
Onde S = soma das 7 dobras cutâneas em mm.

---

## 📊 Importação CSV (Tabela TACO)

O endpoint `POST /foods/import-taco` aceita arquivos CSV da tabela TACO com as colunas:
- `Nome` → nome do alimento
- `Energia (kcal)` → calorias
- `Proteína (g)` → proteína
- `Carboidrato (g)` → carboidratos
- `Lipídeos (g)` → gordura

**Regras de processamento:**
- Valores já são por 100g — **NÃO** são divididos
- "NA", "Tr", "*", vazio → convertidos para **0.0**
- Linhas malformadas são ignoradas automaticamente
- Suporta encoding UTF-8 e Latin-1

---

## 🗄️ Modelo do Banco de Dados

```
FoodItem (1) ──── (N) MealItem (N) ──── (1) Meal (N) ──── (1) DietPlan
                                                               
BodyLog (standalone — um registro por data)
Profile (1) ──── dono de DietPlans e BodyLogs (via user_id)
```

- **Profile**: Pessoa que usa o app (ex: "João", "Maria"). Cada perfil tem seus próprios planos e registros.
- **FoodItem**: Dados nutricionais por 100g (compartilhado entre perfis)
- **DietPlan**: Metas diárias de macros (apenas um ativo por vez por perfil)
- **Meal**: Refeição dentro do plano (ex: "Café da Manhã", "Pré-Treino")
- **MealItem**: Liga FoodItem a Meal com quantidade em gramas
- **BodyLog**: Peso, bioimpedância, dobras cutâneas e circunferências
