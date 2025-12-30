# LMS Architecture Documentation

## Overview

This document describes the refactored LMS architecture that clearly separates:
- **Course & Lesson Creation** - Content-focused builder
- **Test / Assessment Creation** - Standalone test builder
- **Course Progression & Rules Logic** - Rule-based progression engine

## Core Architecture Principles

1. **Separation of Concerns**: Each module has a single, well-defined responsibility
2. **Tests are Standalone**: Tests are created independently and can be reused across multiple courses
3. **Courses Reference Tests**: Courses only reference tests via pivot table, never embed them
4. **Lessons are Content-First**: Lessons focus on content delivery, not assessment
5. **Rules Drive Progression**: Progression is controlled by rules, not hardcoded flows

## Entity Structure

### 1. Course
- `id` - Primary key
- `title` - Course title
- `description` - Full description
- `category` - Course category
- `level` - beginner, intermediate, advanced
- `status` - draft, published, archived
- `settings` (JSON) - Modular settings:
  - `access` - Access type, price, currency
  - `drip` - Drip content settings
  - `certificate` - Certificate requirements
- `progression_rules` (JSON) - Quick access to rule summaries
- `teacher_id` - Instructor reference

### 2. Module
- `id` - Primary key
- `course_id` - Parent course
- `title` - Module title
- `order` - Display order
- `status` - published, draft

### 3. Lesson
- `id` - Primary key
- `module_id` - Parent module
- `course_id` - Parent course (for quick access)
- `title` - Lesson title
- `type` - video, text, resource
- `content` - Lesson content
- `duration_minutes` - Estimated duration
- `order` - Display order
- `is_preview` - Preview flag
- `status` - published, draft

### 4. Test (Standalone)
- `id` - Primary key
- `title` - Test title
- `description` - Test description
- `type` - practice, graded, final
- `status` - draft, published, archived
- `settings` (via columns):
  - `time_limit_minutes` - Time limit
  - `max_attempts` - Maximum attempts
  - `randomize_questions` - Randomize question order
  - `randomize_answers` - Randomize answer order
  - `show_results_immediately` - Show results immediately
  - `show_correct_answers` - Show correct answers
  - `allow_review` - Allow review after submission
- `question_set_id` - Question bank reference (if using bank)
- `question_source` - direct, bank
- `created_by` - Creator reference
- `version` - Version string

### 5. Question
- `id` - Primary key
- `test_id` - Direct test reference (nullable)
- `question_bank_id` - Question bank reference (nullable)
- `type` - multiple_choice, true_false, short_answer, etc.
- `content` - Question content
- `answers` (JSON) - Answer options with correct flags
- `points` - Points value
- `order` - Display order
- `explanation` - Answer explanation

### 6. Course-Test Link (Pivot)
- `id` - Primary key
- `course_id` - Course reference
- `test_id` - Test reference
- `scope` - lesson, module, course
- `scope_id` - Lesson/Module ID (if scope is lesson/module)
- `required` - Boolean: is test required?
- `passing_score` - Minimum passing score (0-100)
- `order` - Display order within scope
- `unlock_after_previous` - Unlock after previous test
- `unlock_after_test_id` - Unlock after specific test

### 7. ProgressionRule
- `id` - Primary key
- `course_id` - Course reference
- `type` - Rule type (lesson_completion, test_passing, etc.)
- `target_type` - What this rule applies to (lesson, module, test, course)
- `target_id` - Target entity ID
- `condition_type` - Condition type (lesson, module, test, score, time)
- `condition_id` - Condition entity ID
- `condition_value` - Condition value (score threshold, etc.)
- `action` - unlock, lock, require, optional
- `priority` - Rule priority (lower = higher priority)
- `active` - Is rule active?

## Service Layer

### CourseBuilderService
**Purpose**: Handles course creation and management
**Focus**: Content & Structure
**Responsibilities**:
- Create/update/delete courses
- Create/update modules and lessons
- Attach/detach tests to courses
- Reorder modules and lessons
- Manage course settings

**Key Methods**:
- `createCourse()` - Create new course
- `updateCourse()` - Update course
- `attachTest()` - Link test to course
- `detachTest()` - Unlink test from course
- `createModule()` - Create module
- `createLesson()` - Create lesson

### TestBuilderService
**Purpose**: Handles standalone test creation and management
**Focus**: Assessment & Questions
**Responsibilities**:
- Create/update/delete tests
- Add/update/delete questions
- Manage question banks
- Publish/unpublish tests
- Create test versions

**Key Methods**:
- `createTest()` - Create new test
- `updateTest()` - Update test
- `publishTest()` - Publish test
- `addQuestionsToTest()` - Add questions
- `createQuestionBank()` - Create question bank
- `createTestVersion()` - Create new version

### ProgressionEngine
**Purpose**: Evaluates progression rules
**Focus**: Rule Evaluation
**Responsibilities**:
- Check if lessons/modules/tests are unlocked
- Evaluate progression rules
- Check prerequisites
- Validate order constraints

**Key Methods**:
- `isLessonUnlocked()` - Check lesson access
- `isModuleUnlocked()` - Check module access
- `isTestUnlocked()` - Check test access
- `evaluateRule()` - Evaluate a rule

### CourseProgressService
**Purpose**: Tracks and calculates course progress
**Focus**: Progress Tracking
**Responsibilities**:
- Calculate course/module progress
- Mark lessons as completed
- Check completion status
- Recalculate progress after changes

## Logic Flow

### Course Creation Flow
1. Instructor creates course via CourseBuilderService
2. Instructor adds modules and lessons (content-focused)
3. Instructor creates tests separately via TestBuilderService
4. Instructor attaches tests to course via CourseBuilderService
5. Instructor defines progression rules via ProgressionRulesController

### Test Creation Flow
1. Instructor creates test via TestBuilderService
2. Instructor adds questions directly or uses question bank
3. Instructor publishes test
4. Test can now be attached to courses

### Progression Flow
1. User accesses course
2. ProgressionEngine evaluates rules
3. Rules check:
   - Lesson completion
   - Test results
   - Minimum scores
   - Order constraints
4. Access granted/denied based on rule evaluation

## API Structure

### Course Management
- `GET /api/admin/courses` - List courses
- `POST /api/admin/courses` - Create course
- `PUT /api/admin/courses/{id}` - Update course
- `DELETE /api/admin/courses/{id}` - Delete course

### Test Management (Standalone)
- `GET /api/admin/tests` - List tests
- `POST /api/admin/tests` - Create test
- `PUT /api/admin/tests/{id}` - Update test
- `POST /api/admin/tests/{id}/publish` - Publish test
- `POST /api/admin/tests/{id}/link-to-course` - Link test to course

### Progression Rules
- `GET /api/admin/courses/{courseId}/progression-rules` - List rules
- `POST /api/admin/courses/{courseId}/progression-rules` - Create rule
- `PUT /api/admin/courses/{courseId}/progression-rules/{ruleId}` - Update rule
- `DELETE /api/admin/courses/{courseId}/progression-rules/{ruleId}` - Delete rule

## UI/UX Structure

### Admin/Instructor Menu
- **Courses** - Course builder (content & structure)
- **Tests** - Test builder (assessments)
- **Question Bank** - Reusable questions
- **Rules & Progression** - Progression rules management
- **Analytics** - Course analytics

### Course Builder UX
- Focus on content & structure
- No test editing inside course builder
- Only attach existing tests via selector
- Drag-and-drop module/lesson ordering

### Test Builder UX
- Pure assessment experience
- Optimized for fast test creation
- AI-assisted question generation (future)
- Independent publish lifecycle

## Best Practices

### Course Creation
1. Create course structure first (modules & lessons)
2. Create tests separately
3. Attach tests to course after both are ready
4. Define progression rules last

### Test Creation
1. Create test in draft mode
2. Add questions
3. Review and validate
4. Publish when ready
5. Link to courses

### Progression Rules
1. Start with simple rules
2. Use priority to control evaluation order
3. Test rules thoroughly
4. Document complex rule logic

## Future Extensions

The architecture supports easy extension for:
- **Certificates** - Already supported via settings
- **AI Features** - Can be added to TestBuilderService
- **Proctoring** - Can be added to Test model
- **Analytics** - Can be added as separate service
- **Versioning** - Already supported in Test model

## Migration Notes

### From Old Architecture
- Tests are now standalone (no longer embedded in courses)
- Progression is rule-based (no hardcoded flows)
- Settings are modular (JSON structure)
- Services are separated (CourseBuilder vs TestBuilder)

### Backward Compatibility
- Legacy fields are maintained for compatibility
- Settings JSON merges with legacy fields
- Old API endpoints still work (deprecated)

## Testing Strategy

### Unit Tests
- Test each service independently
- Mock dependencies
- Test rule evaluation logic

### Integration Tests
- Test course creation with tests
- Test progression rule evaluation
- Test test linking/unlinking

### E2E Tests
- Test complete course creation flow
- Test student progression through course
- Test test taking and results

