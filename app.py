"""
FastAPI backend for the RAG Banking Assistant.
Serves /api/query, /api/health and the frontend.
"""

import os
import json
import time
import faiss
import torch
import numpy as np
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModel
from groq import Groq

# ── Load .env ─────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

# ── Config ────────────────────────────────────────────────────────────────────
FAISS_INDEX_FILE = str(BASE_DIR / "rag_vector_index.faiss")
PDF_CHUNKS_FILE  = str(BASE_DIR / "preprocessed_pdf_chunks.json")
HF_MODEL_NAME    = "sentence-transformers/all-MiniLM-L6-v2"
LLM_MODEL_NAME   = "llama-3.3-70b-versatile"
TOP_K            = 7        # retrieve more context for better answers
MAX_TOKENS       = 1024     # allow longer answers

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(title="RAG Banking Assistant")

# ── Global state ──────────────────────────────────────────────────────────────
faiss_index  = None
pdf_chunks   = []
tokenizer    = None
embed_model  = None
groq_client  = None
unique_docs  = set()  # track document names


class QueryRequest(BaseModel):
    question: str


class QueryResponse(BaseModel):
    answer: str
    sources: list[str] = []


# ── Helpers ───────────────────────────────────────────────────────────────────
def mean_pooling(model_output, attention_mask):
    token_embeddings = model_output.last_hidden_state
    mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
    return torch.sum(token_embeddings * mask_expanded, dim=1) / torch.clamp(
        mask_expanded.sum(dim=1), min=1e-9
    )


def embed_query(query: str) -> np.ndarray:
    with torch.no_grad():
        encoded = tokenizer(query, return_tensors="pt", truncation=True, max_length=256)
        output = embed_model(**encoded)
        embedding = mean_pooling(output, encoded["attention_mask"])
        return embedding.numpy().astype("float32")


def retrieve_documents(query: str, top_k: int = TOP_K):
    query_vec = embed_query(query)
    distances, indices = faiss_index.search(query_vec, top_k)
    results = []
    for i in indices[0]:
        if 0 <= i < len(pdf_chunks):
            results.append(pdf_chunks[i])
    return results


SYSTEM_PROMPT = """You are BankRAG, an expert banking documentation assistant.

IMPORTANT RULES:
1. Answer ONLY from the provided context. Never make up information.
2. If the answer is not in the context, say "Sorry, I couldn't find this in the available documents."
3. Use clear formatting: bullet points, numbered lists, bold for key terms.
4. Cite the source document name when relevant.
5. Be concise but thorough. Explain banking jargon when it appears.
6. If the question is vague, provide the most helpful interpretation."""


def build_prompt(query: str, chunks: list[dict]) -> str:
    context_parts = []
    for c in chunks:
        source = c.get("policy_name", "Unknown")
        context_parts.append(f"[Source: {source}]\n{c['text']}")
    context = "\n\n---\n\n".join(context_parts)

    return f"""Context from banking documents:

{context}

---

User Question: {query}

Provide a clear, well-formatted answer based on the above context."""


def call_llm(prompt: str) -> str:
    response = groq_client.chat.completions.create(
        model=LLM_MODEL_NAME,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_completion_tokens=MAX_TOKENS,
        temperature=0.2,  # lower = more factual
    )
    return response.choices[0].message.content


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global faiss_index, pdf_chunks, tokenizer, embed_model, groq_client, unique_docs

    # Groq client
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        print("WARNING: GROQ_API_KEY not set. LLM calls will fail.")
    groq_client = Groq(api_key=api_key or "")

    # Embedding model
    print("Loading embedding model …")
    tokenizer = AutoTokenizer.from_pretrained(HF_MODEL_NAME)
    embed_model = AutoModel.from_pretrained(HF_MODEL_NAME)
    embed_model.eval()
    print("Embedding model ready.")

    # FAISS index + chunks
    if os.path.exists(FAISS_INDEX_FILE) and os.path.exists(PDF_CHUNKS_FILE):
        print("Loading FAISS index …")
        faiss_index = faiss.read_index(FAISS_INDEX_FILE)
        with open(PDF_CHUNKS_FILE, "r", encoding="utf-8") as f:
            pdf_chunks = json.load(f)
        unique_docs = {c.get("policy_name", "") for c in pdf_chunks}
        print(f"Loaded {faiss_index.ntotal} vectors, {len(pdf_chunks)} chunks from {len(unique_docs)} documents.")
    else:
        print("WARNING: FAISS index or chunks JSON not found. Run preprocessing scripts first.")


# ── API routes ────────────────────────────────────────────────────────────────
@app.post("/api/query", response_model=QueryResponse)
async def query_endpoint(req: QueryRequest):
    if faiss_index is None:
        raise HTTPException(status_code=503, detail="Index not loaded. Run preprocessing scripts first.")

    question = req.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")
    if len(question) > 2000:
        raise HTTPException(status_code=400, detail="Question too long (max 2000 chars).")

    t0 = time.time()

    # Retrieve
    chunks = retrieve_documents(question)
    sources = list({c.get("policy_name", "Unknown") for c in chunks})

    # Generate
    prompt = build_prompt(question, chunks)
    answer = call_llm(prompt)

    elapsed = round(time.time() - t0, 2)
    print(f"[Query] '{question[:60]}…' → {len(chunks)} chunks, {elapsed}s")

    return QueryResponse(answer=answer, sources=sources)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "index_loaded": faiss_index is not None,
        "chunks_count": len(pdf_chunks),
        "documents_count": len(unique_docs),
    }


# ── Serve frontend ───────────────────────────────────────────────────────────
STATIC_DIR = str(BASE_DIR / "static")
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
async def root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))
