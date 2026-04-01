# Hybrid Search API

## Endpoint: `POST /api/rag-hybrid/search`

エージェントが「知識」を検索するためのゲートウェイです。

### Request
```json
{
  "query": "検索文字列",
  "topK": 5,
  "vectorWeight": 0.6
}
```

### Response
```json
{
  "query": "...",
  "results": [
    {
      "doc_path": "docs/example.md",
      "heading_path": "...",
      "content": "...",
      "final_score": 0.85,
      "recommended_action": "read_file('docs/example.md')"
    }
  ]
}
```
