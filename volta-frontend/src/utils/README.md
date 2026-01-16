# Utilities

## Logger (`logger.js`)

Utility pentru logging condiționat bazat pe environment.

```javascript
import { logger } from './utils/logger';

// Logging doar în development
logger.log('Debug info');
logger.error('Error message');
logger.warn('Warning message');

// API logging (poate fi controlat prin VITE_ENABLE_API_LOGGING)
logger.api.log('API Request');
logger.api.error('API Error');
```

## Error Handler (`errorHandler.js`)

Utility pentru gestionare standardizată a erorilor.

```javascript
import { handleApiError, getErrorMessage, formatValidationErrors } from './utils/errorHandler';

// În catch blocks
try {
  await api.post('/endpoint', data);
} catch (error) {
  const message = handleApiError(error, 'saveData');
  showError(message);
}

// Formatare erori de validare Laravel
const validationErrors = formatValidationErrors(error.response?.data?.errors);
```

### Funcții disponibile:
- `getErrorMessage(error)` - Extrage mesaj user-friendly
- `handleApiError(error, context)` - Gestionează erori API cu logging
- `formatValidationErrors(errors)` - Formatează erori Laravel
- `isNetworkError(error)` - Verifică dacă e eroare de rețea
- `isAuthError(error)` - Verifică dacă e eroare de autentificare
