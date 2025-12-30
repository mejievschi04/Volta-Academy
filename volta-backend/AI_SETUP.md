# Configurare AI pentru Generare Cursuri

## Opțiuni disponibile

### 1. Groq (Recomandat pentru TEST - GRATUIT) ⭐

Groq este perfect pentru testare - complet gratuit, foarte rapid (folosește GPU-uri specializate), și suportă modele puternice.

#### Configurare:

1. Obține un API key gratuit de la [Groq](https://console.groq.com/keys) (cont gratuit, fără card)
2. Adaugă în `.env`:
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your-api-key-here
GROQ_MODEL=llama-3.2-11b-versatile
```

**Modele Groq disponibile (toate gratuite):**
- `llama-3.2-11b-versatile` - Recomandat, echilibrat între performanță și viteză
- `llama-3.1-8b-instant` - Mai rapid, mai mic, bun pentru răspunsuri rapide
- `mixtral-8x7b-32768` - Alternativă bună, context mare
- `gemma-7b-it` - Model Google

**Notă:** `llama-3.1-70b-versatile` a fost decomisionat. Folosește `llama-3.2-11b-versatile` sau unul dintre modelele de mai sus.

**Avantaje Groq:**
- ✅ Complet gratuit (fără limită de credit inițial)
- ✅ Foarte rapid (răspunsuri în secunde)
- ✅ API identic cu OpenAI (ușor de migrat)
- ✅ Modele puternice (Llama 3.1 70B)

### 2. OpenAI (Pentru PRODUCȚIE) 🚀

OpenAI API este ideal pentru producție - stabil, suport excelent pentru JSON.

#### Configurare:

1. Obține un API key de la [OpenAI](https://platform.openai.com/api-keys)
2. Adaugă în `.env`:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
```

**Modele recomandate:**
- `gpt-4o-mini` - Rapid, ieftin, perfect pentru generarea de cursuri
- `gpt-4o` - Mai puternic, mai scump
- `gpt-3.5-turbo` - Alternativă mai ieftină

### 3. Hugging Face (Alternativă)

⚠️ **NOTĂ**: API-ul vechi `api-inference.huggingface.co` este deprecated (eroare 410).
Trebuie să folosești inference endpoints personalizate.

#### Configurare:

1. Obține un API key de la [Hugging Face](https://huggingface.co/settings/tokens)
2. Creează un inference endpoint pentru modelul dorit
3. Adaugă în `.env`:
```env
AI_PROVIDER=huggingface
HUGGINGFACE_API_KEY=your-api-key-here
HUGGINGFACE_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct
HUGGINGFACE_API_URL=https://your-inference-endpoint-url
```

## Setup rapid pentru test (Groq)

1. Creează cont gratuit la [Groq Console](https://console.groq.com)
2. Generează API key
3. Adaugă în `volta-backend/.env`:
```env
AI_PROVIDER=groq
GROQ_API_KEY=gsk_your-key-here
```

> ⚠️ **Security note:** If you or anyone accidentally committed a real API key (e.g., in `.env`), rotate it immediately and remove it from repository history.

4. Gata! Poți testa generarea de cursuri.

## Verificare configurare

După configurare, testează generarea unui curs prin interfața admin.

## Migrare de la Groq la OpenAI

Când ești gata pentru producție, schimbă doar în `.env`:
```env
AI_PROVIDER=openai
OPENAI_API_KEY=sk-your-key-here
```

Codul rămâne același - ambele folosesc același format API!

## Troubleshooting

### Eroare: "API key not configured"
- Verifică că ai adăugat cheia API în `.env`
- Verifică că ai setat `AI_PROVIDER` corect

### Eroare: "410 - API deprecated" (Hugging Face)
- API-ul vechi nu mai funcționează
- Creează un inference endpoint personalizat pe Hugging Face
- Sau treci la Groq (gratuit) sau OpenAI

### Cursul generat are doar 1 modul și 1 lecție
- Verifică log-urile din `storage/logs/laravel.log`
- Verifică dacă AI-ul returnează JSON valid
- Verifică dacă prompt-ul este trimis corect

## Logging

Toate request-urile și răspunsurile sunt loggate în `storage/logs/laravel.log`.
Caută după:
- "Groq API Request" / "OpenAI API Request" / "Hugging Face API Request"
- "API Success" / "API Error"
- "Processed response text"
