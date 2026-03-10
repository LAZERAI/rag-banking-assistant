# BankRAG — AI Banking Document Assistant

A production-ready **Retrieval-Augmented Generation (RAG)** system that answers banking & finance questions by searching through 27 real banking documents (4,100+ indexed chunks) using semantic search and LLM-powered answers.

> **Live Demo:** [rag-banking-assistant.onrender.com](https://rag-banking-assistant.onrender.com) *(free tier — first load may take ~30s)*

---

## Features

- **Semantic Search** — FAISS vector index with sentence-transformers embeddings for accurate document retrieval
- **LLM Answers** — Groq-hosted Llama 3.3 70B generates grounded, cited responses
- **27 Banking Documents** — RBI guidelines, Basel frameworks, KYC, loans, NEFT, deposit policies, and more
- **Modern Chat UI** — Dark/light theme, markdown rendering, code copy, source document tags
- **Chat History** — Persistent conversations stored in localStorage with auto-titling
- **FastAPI Backend** — Async API with health checks and structured error handling

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **LLM** | Llama 3.3 70B Versatile (via Groq API) |
| **Embeddings** | sentence-transformers/all-MiniLM-L6-v2 |
| **Vector DB** | FAISS (faiss-cpu) |
| **Backend** | FastAPI + Uvicorn |
| **Frontend** | Vanilla HTML/CSS/JS (no framework) |
| **Preprocessing** | PyPDF2, NLTK |

## Architecture

```
User Question
     │
     ▼
┌─────────────┐     ┌──────────────────┐
│  FastAPI     │────▶│ Embed query      │
│  /api/query  │     │ (MiniLM-L6-v2)   │
└─────────────┘     └──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ FAISS search     │
                    │ (top-7 chunks)   │
                    └──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ Build prompt +   │
                    │ Call Groq LLM    │
                    └──────────────────┘
                           │
                           ▼
                    ┌──────────────────┐
                    │ Return answer +  │
                    │ source documents │
                    └──────────────────┘
```

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/LAZERAI/rag-banking-assistant.git
cd rag-banking-assistant
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Set your API key

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
```

Get a free key at [console.groq.com](https://console.groq.com)

### 3. Preprocess documents (optional — index is included)

```bash
cd src
python preprocess_pdfs.py
python create_faiss_index.py
```

### 4. Run the server

```bash
uvicorn app:app --reload --port 8000
```

Open [http://localhost:8000](http://localhost:8000)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/query` | Send a question, get an AI answer with sources |
| `GET` | `/api/health` | Health check with index stats |

**Example request:**

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the Basel III capital requirements?"}'
```

## Project Structure

```
rag-banking-assistant/
├── app.py                        # FastAPI backend
├── static/
│   ├── index.html                # Chat UI
│   ├── style.css                 # Styles (dark/light theme)
│   └── script.js                 # Frontend logic + chat history
├── src/
│   ├── preprocess_pdfs.py        # PDF → text chunks
│   ├── create_faiss_index.py     # Chunks → FAISS index
│   └── retrieval.py              # Retrieval utilities
├── data/                         # 27 banking PDF documents
├── preprocessed_pdf_chunks.json  # 4,157 processed chunks
├── rag_vector_index.faiss        # FAISS vector index
├── render.yaml                   # Render deployment config
├── requirements.txt
└── .env                          # API key (not in repo)
```

## Deploy on Render (Free)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New Web Service**
3. Connect your GitHub repo
4. Render auto-detects `render.yaml` settings
5. Add environment variable: `GROQ_API_KEY`
6. Deploy — done!

## Documents Indexed

The system indexes 27 real banking documents including:

- **RBI Guidelines** — NEFT, counterfeit detection, customer service, lead bank scheme
- **Basel Frameworks** — Basel II, Basel III capital requirements, liquidity coverage
- **Banking Policies** — KYC, ALM, deposits, loans, risk management, data protection
- **Operations** — Transaction limits, approval matrix, customer onboarding, account types

## License

MIT

