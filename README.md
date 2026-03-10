---
title: RAG Banking Assistant
emoji: 🏦
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
---

# RAG Banking Assistant

Ask questions about banking docs and get answers backed by actual sources. It searches through 27 banking PDFs (RBI guidelines, Basel frameworks, KYC, loans, etc.) using FAISS vector search, then sends the relevant chunks to Llama 3.3 70B to generate an answer.

**Live demo:** [lazerai-rag-banking-assistant.hf.space](https://lazerai-rag-banking-assistant.hf.space)

## How it works

1. PDFs get split into text chunks and embedded using sentence-transformers (MiniLM-L6-v2)
2. Embeddings stored in a FAISS index (4,157 chunks from 27 documents)
3. User asks a question → embed it → find top 7 matching chunks
4. Send those chunks + the question to Llama 3.3 70B via Groq API
5. Get back a grounded answer with source document names

## Stack

- Python 3.11
- FastAPI + Uvicorn
- FAISS for vector search
- sentence-transformers for embeddings
- Groq API (Llama 3.3 70B)
- PyPDF2 + NLTK for preprocessing
- Vanilla HTML/CSS/JS frontend

## Getting started

```bash
git clone https://github.com/LAZERAI/rag-banking-assistant.git
cd rag-banking-assistant
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

Create a `.env` file:

```
GROQ_API_KEY=your_key_here
```

Get a free key at [console.groq.com](https://console.groq.com)

Run it:

```bash
uvicorn app:app --reload --port 8000
```

Open http://localhost:8000

## Reprocessing documents (optional)

The FAISS index and chunks JSON are already included. If you want to add more PDFs, drop them in `data/` and run:

```bash
cd src
python preprocess_pdfs.py
python create_faiss_index.py
```

## API

| Method | Endpoint | What it does |
|--------|----------|--------------|
| POST | `/api/query` | Send a question, get an answer with sources |
| GET | `/api/health` | Health check + index stats |

```bash
curl -X POST http://localhost:8000/api/query \
  -H "Content-Type: application/json" \
  -d '{"question": "What are the Basel III capital requirements?"}'
```

## Project structure

```
├── app.py                        # FastAPI backend + LLM calls
├── static/
│   ├── index.html                # Chat UI
│   ├── style.css                 # Dark/light theme
│   └── script.js                 # Frontend logic + chat history
├── src/
│   ├── preprocess_pdfs.py        # PDF → text chunks
│   ├── create_faiss_index.py     # Chunks → FAISS index
│   └── retrieval.py              # Retrieval utils
├── data/                         # 27 banking PDFs
├── preprocessed_pdf_chunks.json  # Processed chunks
├── rag_vector_index.faiss        # Vector index
└── .env                          # API key (not committed)
```

## What's in the document set

27 banking documents covering RBI guidelines (NEFT, counterfeit detection, customer service), Basel II/III frameworks, KYC, ALM, deposit/loan policies, risk management, transaction limits, and more.

## License

MIT

