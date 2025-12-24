# Setup ngrok pentru Volta Academy

Acest ghid te ajută să expui aplicația Volta Academy cu un singur link ngrok.

## 📋 Prerechizite

1. **ngrok instalat** - Descarcă de la https://ngrok.com/download
2. **Cont ngrok** (opțional, dar recomandat) - Creează cont gratuit la https://dashboard.ngrok.com

## 🚀 Metoda 1: Script automat (Recomandat)

Cel mai simplu mod este să folosești scriptul PowerShell:

```powershell
.\start-ngrok.ps1
```

Acest script va:
- ✅ Porni backend-ul pe portul 8000
- ✅ Porni frontend-ul pe portul 5173
- ✅ Porni ngrok pentru frontend
- ✅ Afișa link-ul ngrok

**Notă:** Frontend-ul folosește deja un proxy pentru API, deci expunând doar portul 5173, totul va funcționa!

## 🔧 Metoda 2: Manual

Dacă preferi să pornești manual:

### Pasul 1: Pornește backend-ul

Într-un terminal PowerShell:
```powershell
cd volta-backend
php artisan serve
```

### Pasul 2: Pornește frontend-ul

Într-un alt terminal PowerShell:
```powershell
cd volta-frontend
npm run dev
```

### Pasul 3: Pornește ngrok

Într-un al treilea terminal PowerShell:
```powershell
ngrok http 5173
```

Sau dacă ai configurat `ngrok.yml`:
```powershell
ngrok start volta-academy
```

## 🌐 Configurare domeniu static (Opțional)

Dacă ai un plan ngrok care suportă domenii statice:

1. Obține un domeniu static de la https://dashboard.ngrok.com/cloud-edge/domains
2. Editează `ngrok.yml` și adaugă domeniul:
   ```yaml
   tunnels:
     volta-academy:
       proto: http
       addr: 5173
       domain: your-domain.ngrok-free.app
   ```
3. Folosește: `ngrok start volta-academy`

## ⚙️ Configurare authtoken (Opțional)

Pentru a evita limitările planului gratuit:

1. Obține token-ul de la https://dashboard.ngrok.com/get-started/your-authtoken
2. Rulează: `ngrok config add-authtoken YOUR_TOKEN`
3. Sau adaugă în `ngrok.yml`:
   ```yaml
   authtoken: YOUR_TOKEN
   ```

## 🔍 Verificare

După ce pornești ngrok, vei vedea un output similar cu:

```
Forwarding   https://abc123.ngrok-free.app -> http://localhost:5173
```

Folosește link-ul `https://abc123.ngrok-free.app` pentru a accesa aplicația!

## ⚠️ Note importante

1. **CORS** - Am actualizat configurația CORS pentru a permite domeniile ngrok
2. **Proxy** - Frontend-ul folosește Vite proxy pentru API, deci nu trebuie să expui și portul 8000
3. **HTTPS** - ngrok oferă automat HTTPS, ceea ce este perfect pentru testare
4. **Limitări plan gratuit**:
   - Link-ul se schimbă la fiecare restart (folosește domeniu static pentru link permanent)
   - Limită de timp pentru sesiuni
   - Limită de bandwidth

## 🛑 Oprire

Pentru a opri totul:
- Apasă `Ctrl+C` în terminalul unde rulează ngrok
- Scriptul `start-ngrok.ps1` va opri automat backend-ul și frontend-ul

Sau manual:
- Oprește procesele PHP și Node.js din Task Manager
- Sau folosește `Get-Job | Stop-Job` pentru job-urile PowerShell

## 🐛 Troubleshooting

### Portul este deja folosit
```powershell
# Verifică ce proces folosește portul
Get-NetTCPConnection -LocalPort 5173 | Select-Object OwningProcess
# Oprește procesul sau schimbă portul în vite.config.js
```

### ngrok nu pornește
- Verifică dacă ngrok este instalat: `ngrok version`
- Verifică dacă ai authtoken configurat: `ngrok config check`

### CORS errors
- Verifică că ai actualizat `volta-backend/config/cors.php`
- Verifică că backend-ul rulează pe portul 8000

