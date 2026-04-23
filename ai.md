P

# 🧠 🏗️ ARHITECTURA AVANSATĂ (ce implementăm)

Pipeline complet:

```
lecții → chunking → embeddings → vector search → ranking → context → Volt → output validat
```

---

# ⚙️ 1. STRUCTURA CONTEXTULUI (foarte important)

NU mai trimiți text brut.

👉 trimiți context structurat:

```json
{
  "chunks": [
    {
      "id": 1,
      "text": "Generatorul electric transformă energia mecanică...",
      "lesson_id": 12,
      "score": 0.92
    },
    {
      "id": 2,
      "text": "Rotorul este partea mobilă...",
      "lesson_id": 12,
      "score": 0.87
    }
  ]
}
```

---

# 🧠 2. SYSTEM PROMPT AVANSAT – VOLT

```text
You are Volt, an advanced AI assistant inside an LMS.

MISSION:
Provide accurate educational responses strictly based on ranked context chunks.

----------------------------------------
CRITICAL RULES (HARD CONSTRAINTS):
- Use ONLY the provided context chunks.
- Each statement MUST be supported by at least one chunk.
- You MUST internally verify that the answer exists in the context.
- If not found → respond EXACTLY:
  "Nu există informația în curs."

- Do NOT infer beyond text.
- Do NOT generalize.
- Do NOT complete missing information.

----------------------------------------
CONTEXT CHUNKS:
{{context_chunks}}

----------------------------------------
CONTEXT USAGE STRATEGY:
- Prioritize chunks with higher "score"
- Prefer combining multiple chunks only if they agree
- Ignore low-relevance chunks (<0.5 if present)

----------------------------------------
MODES:

1. ANSWER MODE
- Answer strictly from context
- Cite chunk ids internally (do not display unless requested)

2. QUIZ MODE
- Generate ONLY from context
- Avoid duplication
- Focus on key concepts (definitions, processes, roles)

Return JSON:
[
  {
    "question": "...",
    "options": ["A", "B", "C", "D"],
    "correct": "A",
    "source_chunk_id": 1
  }
]

3. EVALUATION MODE
- Compare student answer with context

Return JSON:
{
  "score": 1-10,
  "correct": true/false,
  "missing_points": ["..."],
  "explanation": "based strictly on context"
}

----------------------------------------
ANTI-HALLUCINATION LAYER:
Before answering:
1. Check if answer exists in context
2. Check if fully supported
3. If partial → answer partial only
4. If unsupported → refuse

----------------------------------------
FAIL-SAFE:
- Empty context → "Nu există context disponibil."
- Conflict in context → "Informațiile din curs sunt contradictorii."
```

---

# 🔍 3. RANKING (diferența dintre basic și PRO)

După embeddings, NU lua doar top 5.

👉 aplică:

### scor final:

```
final_score = similarity * 0.7 + recency * 0.1 + lesson_match * 0.2
```

---

### filtre:

* elimină duplicate
* elimină chunkuri prea mici (<100 chars)
* max 5–8 chunks

---

# 🧪 4. VALIDARE OUTPUT (CRUCIAL)

După ce AI răspunde, verifici:

### ✔ verificare simplă:

```php
foreach ($chunks as $chunk) {
    if (str_contains($aiAnswer, substr($chunk['text'], 0, 50))) {
        $valid = true;
    }
}
```

---

### ❌ dacă NU e valid:

```php
return "Nu există informația în curs.";
```

---

# ⚙️ 5. REQUEST FINAL (Laravel)

```php
$response = Http::post('http://localhost:11434/api/generate', [
    'model' => 'gemma:2b-instruct',
    'prompt' => $systemPrompt . "\n\nUser: " . $userInput,
    'options' => [
        'temperature' => 0.2,
        'top_p' => 0.9,
        'num_predict' => 500
    ]
]);
```

---

# 🚀 6. OPTIMIZĂRI AVANSATE

## 🔥 A. Context compression

→ scurtezi chunkurile:

* elimini propoziții inutile
* păstrezi definiții

---

## ⚡ B. Caching

* hash(context + întrebare)
* salvezi răspuns

---

## 🧠 C. Multi-step reasoning (light)

Pentru întrebări complexe:

1. extragi facts din chunks
2. apoi generezi răspuns

---

## 🎯 D. Prompt routing

Dacă:

* conține “generează” → QUIZ MODE
* conține “evaluează” → EVALUATION
* altfel → ANSWER MODE

---

# ⚠️ 7. GREȘELI CRITICE

❌ prea mult context → degradează
❌ fără ranking → răspunsuri slabe
❌ fără validare → halucinații
❌ temperature mare → haos

---

# 🧠 CONCLUZIE

Acum ai un sistem:

✔ controlat (zero invenții)
✔ scalabil
✔ perfect pentru LMS
✔ optim pentru **Gemma 2B**

---

# 👉 Următorul pas (recomand)

Pot să-ți dau:

1. **schema DB completă (embeddings + chunks + AI logs)**
2. **serviciu Laravel: `AIService.php` gata de producție**
3. **flow complet: upload lecție → devine automat quiz**

Spune-mi ce vrei și mergem mai deep.
