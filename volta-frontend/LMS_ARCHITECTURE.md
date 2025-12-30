# LMS Professional Architecture

## Structură Ierarhică

```
Course
├── Module 1
│   ├── Lesson 1.1
│   │   └── Exam 1.1.1 (optional)
│   ├── Lesson 1.2
│   └── Exam 1.1 (optional)
├── Module 2
│   ├── Lesson 2.1
│   └── Lesson 2.2
└── Exam (course-level, optional)
```

## Reguli de Progres

### Progres Secvențial
- **Module**: Se deblochează secvențial (Module 2 după finalizarea Module 1)
- **Lessons**: Se deblochează secvențial în cadrul modulului
- **Exams**: Pot debloca module/lecții după trecere

### Calcul Progres
1. **Lesson Progress**: `completed` / `total_lessons_in_module`
2. **Module Progress**: Media progresului lecțiilor + teste
3. **Course Progress**: Media progresului modulelor

### Condiții de Deblocare
- **Module**: `unlock_after_module_id` sau `unlock_after_lesson_id`
- **Lesson**: `unlock_after_lesson_id`
- **Exam**: `unlock_after_completion` + `unlock_target_id` + `unlock_target_type`

## Flux de Creare Curs

### Step 1: Informații Curs
- Titlu, descriere, categorie, nivel
- Preț, tip acces, instructor
- Auto-save la fiecare modificare

### Step 2: Structură
- Adăugare module (drag & drop pentru ordonare)
- Adăugare lecții per modul
- Atașare teste la module sau lecții
- Auto-save structură

### Step 3: Conținut
- Upload/editor pentru fiecare lecție
- Setări preview (free/locked)
- Durată estimată
- Auto-save conținut

### Step 4: Reguli
- Condiții de progres
- Blocare/deblocare secvențială
- Praguri test (passing_score)
- Auto-save reguli

### Step 5: Review & Publish
- Validări automate
- Checklist completare
- Preview final
- Publish sau salvare ca draft

## API Endpoints

### Course Management
- `GET /admin/courses/{id}` - Detalii curs cu structură completă
- `PUT /admin/courses/{id}` - Actualizare curs
- `POST /admin/courses/{id}/auto-save` - Auto-save incremental
- `POST /admin/courses/{id}/publish` - Publicare curs
- `POST /admin/courses/{id}/duplicate` - Duplicare curs

### Structure Management
- `POST /admin/courses/{id}/modules` - Adăugare modul
- `PUT /admin/courses/{id}/modules/{moduleId}` - Actualizare modul
- `POST /admin/courses/{id}/modules/reorder` - Reordonare module (drag & drop)
- `POST /admin/courses/{id}/modules/{moduleId}/lessons` - Adăugare lecție
- `PUT /admin/lessons/{lessonId}` - Actualizare lecție
- `POST /admin/courses/{id}/modules/{moduleId}/lessons/reorder` - Reordonare lecții

### Progress Calculation
- `GET /admin/courses/{id}/progress` - Calcul progres curs
- `POST /admin/courses/{id}/recalculate-progress` - Recalculare progres

## Componente Frontend

### Course Detail View
- `CourseOverview` - Overview cu KPI-uri și informații
- `CourseStructureBuilder` - Builder cu drag & drop
- `ModuleCard` - Card modul cu lecții și teste
- `LessonCard` - Card lecție cu status și progres
- `ExamCard` - Card test cu statistici

### Course Builder
- `CourseBuilderStep1` - Informații curs
- `CourseBuilderStep2` - Structură
- `CourseBuilderStep3` - Conținut
- `CourseBuilderStep4` - Reguli
- `CourseBuilderStep5` - Review & Publish
- `AutoSaveIndicator` - Indicator auto-save

## Logică de Progres (Backend)

### Service: CourseProgressService
```php
class CourseProgressService {
    public function calculateModuleProgress($moduleId, $userId)
    public function calculateCourseProgress($courseId, $userId)
    public function checkUnlockConditions($moduleId, $userId)
    public function unlockNextModule($courseId, $userId)
    public function recalculateAllProgress($courseId)
}
```

### Events
- `ModuleCompleted` - Trigger când modul este completat
- `LessonCompleted` - Trigger când lecția este completată
- `ExamPassed` - Trigger când testul este trecut
- `CourseStructureChanged` - Trigger când structura se modifică (recalculare progres)

## Validări

### Curs
- Titlu obligatoriu
- Instructor obligatoriu
- Preț obligatoriu dacă `access_type = 'paid'`
- Minimum 1 modul pentru publicare

### Modul
- Titlu obligatoriu
- Minimum 1 lecție pentru publicare

### Lecție
- Titlu obligatoriu
- Conținut sau video_url obligatoriu
- Durată estimată recomandată

### Test
- Titlu obligatoriu
- Minimum 1 întrebare
- `passing_score` <= `max_score`

## Auto-Save

### Strategie
- Debounce 2 secunde după ultima modificare
- Salvare incrementală (doar câmpurile modificate)
- Indicator vizual (saving/saved/error)
- Retry automat la eroare

### Implementare
```javascript
const useAutoSave = (data, saveFn, debounceMs = 2000) => {
  // Auto-save logic
}
```

## Versiuni și Istoric

### Course Versions
- Salvare snapshot la fiecare publicare
- Istoric modificări (who, when, what)
- Rollback la versiune anterioară

### Lesson Versions
- Versiuni pentru lecții (pentru cursuri active)
- Cursurile active nu pierd progresul utilizatorilor

