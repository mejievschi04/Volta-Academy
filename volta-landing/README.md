# Formely Landing Page

Landing page modern, premium și profesional pentru platforma LMS Formely.

## 🎨 Design

- **Culori**: 
  - Cyprus Green (#004643) - culoare principală
  - Cloud White (#FAFAFA) - fundal
- **Stil**: Design SaaS premium (inspirat de Notion, Webflow, Linear, AcademyOcean)
- **Efecte**: 3D subtile, animații fluide, hover effects, scroll reveal

## 📁 Structură

```
volta-landing/
├── index.html      # Structura HTML a landing page-ului
├── styles.css      # Stiluri CSS cu efecte 3D și animații
├── script.js       # JavaScript pentru interacțiuni și animații
├── package.json    # Configurare proiect
└── README.md       # Documentație
```

## 🚀 Utilizare

### Rulare locală simplă

Deschideți `index.html` direct în browser sau folosiți un server local:

```bash
# Opțiunea 1: Folosind Python
python -m http.server 8000

# Opțiunea 2: Folosind Node.js (npx)
npx serve .

# Opțiunea 3: Folosind live-server (pentru auto-reload)
npx live-server --port=3000
```

### Cu npm scripts

```bash
# Instalare (opțional, nu sunt dependențe necesare)
npm install

# Rulare cu serve
npm start

# Rulare cu live-server (auto-reload)
npm run dev
```

## ✨ Funcționalități

### Secțiuni

1. **Hero Section**
   - Titlu și subtitlu impactant
   - 2 CTA-uri (Vezi demo, Creează curs)
   - Mockup 3D cu ecrane plutitoare (dashboard, cursuri, teste)

2. **Beneficii Cheie**
   - Grid cu 4 carduri 3D
   - Hover effects cu transform 3D
   - Iconuri minimaliste

3. **Integrare AI**
   - Section highlight cu accent #004643
   - Cards cu efect "AI glow"
   - Statistici animate

4. **Pricing**
   - 4 carduri premium (Starter, Pro, Business, Enterprise)
   - Card "Pro" featured cu accent vizual
   - Hover effects cu lift și shadow

5. **Cum funcționează**
   - Timeline cu 3 pași
   - Animații la scroll

6. **Screenshots**
   - Galerie cu imagini din aplicație
   - Efecte 3D layered
   - Overlay la hover

7. **CTA Final**
   - Fundal #004643
   - Text alb
   - Buton mare și impactant

8. **Footer**
   - Minimal și curat
   - Link-uri organizate

### Efecte Vizuale

- **3D Tilt**: Carduri cu efect de rotație 3D la hover
- **Scroll Reveal**: Animații fade-up la scroll
- **Parallax**: Efect parallax subtil pentru hero gradient
- **Micro-interacțiuni**: Ripple effects pe butoane
- **Smooth Transitions**: Tranziții fluide pentru toate elementele
- **Hover Effects**: Transform, shadow și depth la hover

## 🎯 Tehnologii

- HTML5 semantic
- CSS3 cu:
  - CSS Variables
  - Flexbox & Grid
  - Transform 3D
  - Animations & Transitions
  - Backdrop filters
- JavaScript vanilla:
  - Intersection Observer API
  - Event listeners
  - Class-based architecture

## 📱 Responsive

Landing page-ul este complet responsive și optimizat pentru:
- Desktop (1280px+)
- Tablet (768px - 1024px)
- Mobile (480px - 768px)
- Mobile small (< 480px)

## 🔧 Customizare

### Culori

Culorile sunt definite în CSS variables în `styles.css`:

```css
:root {
    --color-cyprus-green: #004643;
    --color-cloud-white: #FAFAFA;
}
```

### Animații

Viteza și stilul animațiilor pot fi ajustate în variabilele CSS:

```css
:root {
    --transition-fast: 150ms;
    --transition-base: 300ms;
    --transition-slow: 500ms;
}
```

### 3D Tilt

Efectul 3D tilt poate fi configurat în `script.js`:

```javascript
const settings = {
    max: 15,              // Unghi maxim de rotație
    perspective: 1000,    // Perspectiva 3D
    scale: 1.05,         // Scale la hover
    speed: 1000          // Viteza tranziției
};
```

## 🌐 Browser Support

- Chrome (ultimele 2 versiuni)
- Firefox (ultimele 2 versiuni)
- Safari (ultimele 2 versiuni)
- Edge (ultimele 2 versiuni)

## 📝 Note

- Landing page-ul este static și nu necesită backend
- Toate animațiile sunt optimizate pentru performanță
- Codul este curat, comentat și ușor de extins
- Ready pentru dark mode ulterior (variabilele CSS sunt pregătite)

## 🎨 Design System

Landing page-ul folosește un design system consistent:
- Spacing: 8px base unit
- Typography: Inter font family
- Border radius: 8px, 12px, 16px, 24px, 32px
- Shadows: Multiple levels pentru depth
- Transitions: Cubic bezier pentru smooth animations

## 📄 Licență

MIT License

---

**Formely** - Platformă LMS inteligentă pentru educație modernă

