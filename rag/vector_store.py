"""RAG vector store — sentence-transformers + Chroma for local retrieval."""

from pathlib import Path
from typing import Optional

import chromadb
from sentence_transformers import SentenceTransformer

CORPUS_DIR = Path(__file__).parent / "corpus"
_model: Optional[SentenceTransformer] = None
_collection = None


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def _get_collection():
    global _collection
    if _collection is None:
        client = chromadb.Client()
        _collection = client.get_or_create_collection("climate_narratives", metadata={"hnsw:space": "cosine"})
        # Auto-index corpus on first access so retrieve() always has data
        index_corpus()
    return _collection


def index_corpus(corpus_dir: Path = CORPUS_DIR) -> int:
    """Index all .txt files. Returns chunk count."""
    model = _get_model()
    col = _get_collection()
    chunks, ids, metas = [], [], []

    for f in sorted(corpus_dir.glob("*.txt")):
        paras = [p.strip() for p in f.read_text().split("\n\n") if p.strip()]
        for i, p in enumerate(paras):
            chunks.append(p)
            ids.append(f"{f.stem}_{i}")
            metas.append({"source": f.name, "chunk_index": i})

    if chunks:
        embeddings = model.encode(chunks).tolist()
        col.upsert(ids=ids, documents=chunks, embeddings=embeddings, metadatas=metas)
    return len(chunks)


def retrieve(query: str, top_k: int = 3) -> list[dict]:
    """Retrieve top-k relevant chunks."""
    model = _get_model()
    col = _get_collection()
    q_emb = model.encode([query]).tolist()
    results = col.query(query_embeddings=q_emb, n_results=top_k)
    return [{"text": results["documents"][0][i], "source": results["metadatas"][0][i]["source"],
             "score": 1 - results["distances"][0][i]} for i in range(len(results["ids"][0]))]
