# Design System Guide - Volta Academy
## Ghid complet pentru utilizarea design system-ului

---

## 🎨 **1. CULORI**

### **Accent Color (Unified)**
```css
/* Folosit pentru ambele teme (dark/light) */
--color-primary: #3B82F6;
--color-primary-hover: #2563EB;
--color-primary-light: #60A5FA;
--color-primary-dark: #1D4ED8;
```

### **Status Colors**
```css
--color-success: #10B981;  /* Light: #10B981, Dark: #22C55E */
--color-warning: #F59E0B;
--color-error: #EF4444;
--color-info: #3B82F6;
```

---

## 🔘 **2. BUTOANE**

### **Variante Disponibile**
```html
<!-- Primary Button -->
<button class="btn btn-primary">Primary</button>

<!-- Secondary Button -->
<button class="btn btn-secondary">Secondary</button>

<!-- Ghost Button -->
<button class="btn btn-ghost">Ghost</button>

<!-- Outline Button -->
<button class="btn btn-outline">Outline</button>

<!-- Text Button -->
<button class="btn btn-text">Text</button>

<!-- Danger Button -->
<button class="btn btn-danger">Delete</button>
```

### **Size Variants**
```html
<button class="btn btn-primary btn-sm">Small</button>
<button class="btn btn-primary btn-md">Medium (default)</button>
<button class="btn btn-primary btn-lg">Large</button>
```

### **States**
```html
<!-- Loading State -->
<button class="btn btn-primary btn-loading">Loading...</button>

<!-- Disabled State -->
<button class="btn btn-primary" disabled>Disabled</button>

<!-- Full Width -->
<button class="btn btn-primary btn-block">Full Width</button>
```

---

## 📝 **3. FORM INPUTS**

### **Input Standardizat**
```html
<div class="form-group">
  <label class="va-input-label">Email</label>
  <input type="email" class="va-input" placeholder="email@example.com" />
  <span class="va-input-helper">We'll never share your email</span>
</div>
```

### **Input States**
```html
<!-- Error State -->
<input class="va-input error" />
<span class="va-input-error">This field is required</span>

<!-- Success State -->
<input class="va-input success" />

<!-- Disabled State -->
<input class="va-input" disabled />
```

### **Input Types**
```html
<!-- Text Input -->
<input type="text" class="va-input" />

<!-- Textarea -->
<textarea class="va-input"></textarea>

<!-- Select -->
<select class="va-input">
  <option>Option 1</option>
</select>
```

---

## 📐 **4. SPACING**

### **Base Spacing (8px system)**
```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

### **Component-Specific Spacing**
```css
--space-card: 24px;      /* Card padding */
--space-section: 32px;   /* Section spacing */
--space-page: 40px;      /* Page padding */
--space-container: 48px; /* Container padding */
```

---

## 📏 **5. BORDER RADIUS**

### **Standardizat - Folosește tokens**
```css
--radius-sm: 6px;   /* Small elements */
--radius-md: 8px;   /* Medium elements */
--radius-lg: 12px;  /* Cards, buttons (default) */
--radius-xl: 16px;  /* Large cards */
--radius-2xl: 20px; /* Extra large */
--radius-full: 9999px; /* Pills, badges */
```

**⚠️ IMPORTANT**: Nu folosi valori hardcodate! Folosește întotdeauna tokens.

---

## 🎭 **6. SHADOWS**

### **Elevation System**
```css
--shadow-sm: /* Subtle elevation */
--shadow-md: /* Default cards */
--shadow-lg: /* Elevated cards */
--shadow-xl: /* Modals, dropdowns */
--shadow-2xl: /* Maximum elevation */
```

### **State-Specific Shadows**
```css
--shadow-hover: /* Hover states */
--shadow-active: /* Active states */
--shadow-focus: /* Focus rings */
--shadow-inset: /* Inset shadows */
```

---

## 📱 **7. RESPONSIVE BREAKPOINTS**

### **Breakpoint Tokens**
```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

### **Usage in Media Queries**
```css
@media (min-width: 768px) {
  /* Tablet and up */
}

@media (min-width: 1024px) {
  /* Desktop and up */
}
```

### **Utility Classes**
```html
<div class="md:hidden">Hidden on tablet+</div>
<div class="lg:flex">Flex on desktop+</div>
```

---

## ✍️ **8. TYPOGRAPHY**

### **Font Sizes**
```css
--font-size-xs: 12px;
--font-size-sm: 14px;
--font-size-base: 16px;
--font-size-lg: 18px;
--font-size-xl: 20px;
--font-size-2xl: 24px;
--font-size-3xl: 30px;
--font-size-4xl: 36px;
--font-size-5xl: 40px;
--font-size-6xl: 48px;
--font-size-display: 48px; /* Hero headings */
--font-size-caption: 11px;  /* Caption text */
```

### **Usage**
```html
<h1>Heading 1</h1>
<h2>Heading 2</h2>
<p class="display-text">Hero Heading</p>
<span class="caption">CAPTION TEXT</span>
```

---

## 🃏 **9. CARDS**

### **Unified Card System**
```html
<div class="va-unified-card">
  <div class="va-unified-card-header">
    <h3 class="va-unified-card-title">Card Title</h3>
  </div>
  <div class="va-unified-card-body">
    Card content
  </div>
  <div class="va-unified-card-footer">
    Footer content
  </div>
</div>
```

### **Card Variants**
```html
<!-- Compact -->
<div class="va-unified-card compact">...</div>

<!-- Elevated -->
<div class="va-unified-card elevated">...</div>

<!-- Interactive -->
<div class="va-unified-card interactive">...</div>

<!-- Bordered -->
<div class="va-unified-card bordered">...</div>
```

---

## ✅ **10. BEST PRACTICES**

### **DO ✅**
- ✅ Folosește design tokens pentru toate valorile
- ✅ Folosește clase standardizate (`.btn`, `.va-input`, `.va-unified-card`)
- ✅ Respectă spacing system (8px base)
- ✅ Folosește breakpoint tokens pentru responsive
- ✅ Testează în ambele teme (dark/light)

### **DON'T ❌**
- ❌ Nu folosi valori hardcodate (ex: `padding: 16px`)
- ❌ Nu creezi clase noi când există deja una standardizată
- ❌ Nu folosi culori hardcodate (ex: `color: #3B82F6`)
- ❌ Nu ignora breakpoint tokens
- ❌ Nu folosi border-radius hardcodat

---

## 🚀 **11. EXEMPLE COMPLETE**

### **Form Complet**
```html
<form>
  <div class="form-group">
    <label class="va-input-label">Email Address</label>
    <input type="email" class="va-input" placeholder="email@example.com" />
    <span class="va-input-helper">We'll never share your email</span>
  </div>
  
  <div class="form-group">
    <label class="va-input-label">Password</label>
    <input type="password" class="va-input error" />
    <span class="va-input-error">Password is required</span>
  </div>
  
  <button type="submit" class="btn btn-primary btn-block">
    Submit
  </button>
</form>
```

### **Card cu Butoane**
```html
<div class="va-unified-card">
  <div class="va-unified-card-header">
    <h3 class="va-unified-card-title">Settings</h3>
  </div>
  <div class="va-unified-card-body">
    <p>Manage your account settings</p>
  </div>
  <div class="va-unified-card-footer">
    <button class="btn btn-ghost btn-sm">Cancel</button>
    <button class="btn btn-primary btn-sm">Save</button>
  </div>
</div>
```

---

## 🎬 **12. MICRO-INTERACȚIUNI**

### **Animații Disponibile**
```html
<!-- Fade In -->
<div class="va-animate-fadeIn">Content</div>

<!-- Slide Up -->
<div class="va-animate-slideUp">Content</div>

<!-- Scale In -->
<div class="va-animate-scaleIn">Content</div>
```

### **Hover Effects**
```html
<!-- Lift on Hover -->
<div class="va-hover-lift">Card</div>

<!-- Scale on Hover -->
<div class="va-hover-scale">Icon</div>

<!-- Glow on Hover -->
<div class="va-hover-glow">Button</div>
```

### **Stagger Animations**
```html
<div class="va-animate-fadeIn va-stagger-1">Item 1</div>
<div class="va-animate-fadeIn va-stagger-2">Item 2</div>
<div class="va-animate-fadeIn va-stagger-3">Item 3</div>
```

---

## 📭 **13. EMPTY STATES**

### **Empty State Standardizat**
```html
<div class="va-empty-state">
  <div class="va-empty-state-icon">📭</div>
  <h3 class="va-empty-state-title">No items found</h3>
  <p class="va-empty-state-description">
    Get started by creating your first item.
  </p>
  <div class="va-empty-state-action">
    <button class="btn btn-primary">Create Item</button>
  </div>
</div>
```

### **Compact Variant**
```html
<div class="va-empty-state compact">
  <!-- Same structure, smaller size -->
</div>
```

---

## ⏳ **14. LOADING STATES**

### **Skeleton Loading**
```html
<!-- Text Skeleton -->
<div class="va-skeleton va-skeleton-text"></div>
<div class="va-skeleton va-skeleton-text"></div>
<div class="va-skeleton va-skeleton-text"></div>

<!-- Title Skeleton -->
<div class="va-skeleton va-skeleton-title"></div>

<!-- Avatar Skeleton -->
<div class="va-skeleton va-skeleton-avatar"></div>

<!-- Card Skeleton -->
<div class="va-skeleton va-skeleton-card"></div>
```

### **Spinner**
```html
<!-- Default Spinner -->
<div class="va-spinner"></div>

<!-- Size Variants -->
<div class="va-spinner va-spinner-sm"></div>
<div class="va-spinner va-spinner-md"></div>
<div class="va-spinner va-spinner-lg"></div>

<!-- Color Variants -->
<div class="va-spinner va-spinner-primary"></div>
<div class="va-spinner va-spinner-white"></div>
```

### **Loading Overlay**
```html
<div class="va-loading-overlay">
  <div class="va-loading-overlay-content">
    <div class="va-spinner va-spinner-lg"></div>
    <p class="va-loading-overlay-text">Loading...</p>
  </div>
</div>
```

---

## 🔔 **15. TOAST NOTIFICATIONS**

### **Toast Container**
```html
<div class="va-toast-container">
  <!-- Toasts appear here -->
</div>
```

### **Toast Variants**
```html
<!-- Success Toast -->
<div class="va-toast va-toast-success">
  <div class="va-toast-icon">✓</div>
  <div class="va-toast-content">
    <div class="va-toast-title">Success!</div>
    <div class="va-toast-message">Your changes have been saved.</div>
  </div>
  <button class="va-toast-close">×</button>
</div>

<!-- Error Toast -->
<div class="va-toast va-toast-error">
  <div class="va-toast-icon">✕</div>
  <div class="va-toast-content">
    <div class="va-toast-title">Error</div>
    <div class="va-toast-message">Something went wrong.</div>
  </div>
  <button class="va-toast-close">×</button>
</div>

<!-- Warning Toast -->
<div class="va-toast va-toast-warning">
  <div class="va-toast-icon">⚠</div>
  <div class="va-toast-content">
    <div class="va-toast-title">Warning</div>
    <div class="va-toast-message">Please check your input.</div>
  </div>
  <button class="va-toast-close">×</button>
</div>

<!-- Info Toast -->
<div class="va-toast va-toast-info">
  <div class="va-toast-icon">ℹ</div>
  <div class="va-toast-content">
    <div class="va-toast-title">Info</div>
    <div class="va-toast-message">New update available.</div>
  </div>
  <button class="va-toast-close">×</button>
</div>
```

---

## 🎨 **16. COMMON PATTERNS**

### **Pattern-uri Reutilizabile**
```html
<!-- Card Pattern -->
<div class="va-pattern-card">Card content</div>

<!-- Section Pattern -->
<div class="va-pattern-section">
  <div class="va-pattern-section-header">
    <h2 class="va-pattern-section-title">Section Title</h2>
    <p class="va-pattern-section-subtitle">Subtitle</p>
  </div>
</div>

<!-- Grid Patterns -->
<div class="va-pattern-grid va-pattern-grid-auto">Auto grid</div>
<div class="va-pattern-grid va-pattern-grid-2">2 columns</div>
<div class="va-pattern-grid va-pattern-grid-3">3 columns</div>
<div class="va-pattern-grid va-pattern-grid-4">4 columns</div>

<!-- Loading Pattern -->
<div class="va-pattern-loading">
  <div class="va-pattern-loading-spinner"></div>
  <p>Loading...</p>
</div>

<!-- Error Pattern -->
<div class="va-pattern-error">
  <div class="va-pattern-error-icon">✕</div>
  <p class="va-pattern-error-message">Error message</p>
</div>

<!-- Header Pattern -->
<div class="va-pattern-header">
  <h1 class="va-pattern-header-title">Page Title</h1>
  <p class="va-pattern-header-subtitle">Page subtitle</p>
</div>

<!-- List Pattern -->
<div class="va-pattern-list">
  <div class="va-pattern-list-item">Item 1</div>
  <div class="va-pattern-list-item">Item 2</div>
</div>

<!-- Badge Pattern -->
<span class="va-pattern-badge va-pattern-badge-primary">Primary</span>
<span class="va-pattern-badge va-pattern-badge-success">Success</span>
<span class="va-pattern-badge va-pattern-badge-warning">Warning</span>
<span class="va-pattern-badge va-pattern-badge-error">Error</span>
```

---

**Ultima actualizare**: Faza 4 completă
**Status**: Design system complet, optimizat și documentat
