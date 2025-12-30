# LMS Architecture Refactor - Documentation

## Overview

This document describes the refactored LMS architecture that clearly separates:
- **Course & Lesson Creation** - Content-focused, structure-driven
- **Test/Assessment Creation** - Standalone, reusable assessments
- **Course Progression & Rules Logic** - Rule-based progression engine

## Core Principles

1. **Separation of Concerns**: Each module has a single, clear responsibility
2. **Tests are Standalone**: Tests are created independently and can be reused across multiple courses
3. **Courses Reference Tests**: Courses link to tests via pivot table, not direct ownership
4. **Content-First Lessons**: Lessons focus on content delivery, not assessment
5. **Rule-Based Progression**: Progression is driven by configurable rules, not hardcoded flows

## Entity Structure

### 1. Course
- **Purpose**: Defines course structure and settings
- **Key Fields**:
  - `id`, `title`, `description`, `category`, `level`, `status`
  - `progression_rules` (JSON) - Quick access to rules
  - `settings` (access, drip, certificate)
- **Relationships**:
  - Has many Modules
  - Has many Lessons (through modules)
  - Belongs to many Tests (via `course_test` pivot)
  - Has many ProgressionRules

### 2. Module
- **Purpose**: Organizes lessons within a course
- **Key Fields**: `id`, `course_id`, `title`, `order`
- **Relationships**:
  - Belongs to Course
  - Has many Lessons
  - Can have Tests linked (via `course_test` with scope='module')

### 3. Lesson
- **Purpose**: Content delivery (video, text, resources)
- **Key Fields**:
  - `id`, `module_id`, `title`, `type` (video/text/resource)
  - `content`, `duration`
- **Relationships**:
  - Belongs to Module
  - Can have Tests linked (via `course_test` with scope='lesson')
- **Note**: Lessons are content-first, not assessment-first

### 4. Test (Standalone)
- **Purpose**: Standalone assessment entity
- **Key Fields**:
  - `id`, `title`, `description`
  - `type` (practice/graded/final)
  - `status` (draft/published/archived)
  - `settings` (time, attempts, randomization)
  - `question_set_id` (for question banks)
- **Relationships**:
  - Has many Questions (if question_source='direct')
  - Belongs to QuestionBank (if question_source='bank')
  - Belongs to many Courses (via `course_test` pivot)
- **Note**: Tests are created independently in Test Builder

### 5. Question
- **Purpose**: Individual question items
- **Key Fields**:
  - `id`, `type`, `content`, `answers` (JSON), `points`
  - `test_id` OR `question_bank_id` (mutually exclusive)
- **Relationships**:
  - Belongs to Test (if direct)
  - Belongs to QuestionBank (if reusable)

### 6. QuestionBank
- **Purpose**: Reusable question sets
- **Key Fields**: `id`, `title`, `description`, `status`
- **Relationships**:
  - Has many Questions
  - Has many Tests (that use this bank)

### 7. CourseTest (Pivot)
- **Purpose**: Links courses to tests with scope and rules
- **Key Fields**:
  - `course_id`, `test_id`
  - `scope` (lesson/module/course)
  - `scope_id` (lesson_id or module_id if scope is lesson/module)
  - `required` (boolean)
  - `passing_score`
  - `order`
  - `unlock_after_previous`, `unlock_after_test_id`

### 8. ProgressionRule
- **Purpose**: Rule-based progression system
- **Key Fields**:
  - `course_id`, `type`, `target_type`, `target_id`
  - `condition_type`, `condition_id`, `condition_value`
  - `action` (unlock/lock/require/optional)
  - `priority`, `active`

## Logic Flow

### Course Creation Flow
1. Create Course with basic info
2. Create Modules and organize them
3. Create Lessons within Modules (content-focused)
4. Create Tests independently in Test Builder
5. Link Tests to Course via `course_test` pivot
6. Define ProgressionRules for course

### Test Creation Flow
1. Create Test in Test Builder (standalone)
2. Add Questions directly OR use QuestionBank
3. Configure test settings (time, attempts, etc.)
4. Publish test
5. Link to courses as needed

### Progression Flow
1. User enrolls in course
2. ProgressionEngine evaluates rules
3. Rules check:
   - Lesson completion
   - Test results
   - Minimum scores
   - Order constraints
4. System unlocks content based on rule evaluation

## Services

### ProgressionEngine
- Evaluates progression rules
- Checks unlock conditions
- Determines if user can access content
- Methods:
  - `isLessonUnlocked()`
  - `isModuleUnlocked()`
  - `isTestUnlocked()`
  - `evaluateRule()`

### TestService
- Manages standalone test creation
- Handles question management
- Links/unlinks tests to courses
- Methods:
  - `createTest()`
  - `publishTest()`
  - `linkTestToCourse()`
  - `createQuestionBank()`

### CourseProgressService
- Calculates user progress
- Uses ProgressionEngine for unlock checks
- Updates progress percentages
- Methods:
  - `calculateCourseProgress()`
  - `calculateModuleProgress()`
  - `isModuleComplete()`
  - `isCourseComplete()`

## API Structure

### Test Builder APIs
- `GET /api/admin/tests` - List tests
- `POST /api/admin/tests` - Create test
- `GET /api/admin/tests/{id}` - Get test details
- `PUT /api/admin/tests/{id}` - Update test
- `DELETE /api/admin/tests/{id}` - Delete test
- `POST /api/admin/tests/{id}/publish` - Publish test
- `POST /api/admin/tests/{id}/link` - Link to course
- `POST /api/admin/tests/{id}/unlink` - Unlink from course

### Question Bank APIs
- `GET /api/admin/question-banks` - List banks
- `POST /api/admin/question-banks` - Create bank
- `GET /api/admin/question-banks/{id}` - Get bank details
- `PUT /api/admin/question-banks/{id}` - Update bank
- `DELETE /api/admin/question-banks/{id}` - Delete bank
- `POST /api/admin/question-banks/{id}/questions` - Add questions

### Course APIs (Updated)
- Course creation remains the same
- Test linking is done via Test Builder, not course editor
- Progression rules can be managed via course settings

## Migration Path

1. **New Tables Created**:
   - `tests` - Standalone test entity
   - `questions` - Question items
   - `question_banks` - Reusable question sets
   - `course_test` - Pivot linking courses to tests
   - `progression_rules` - Rule-based progression

2. **Data Migration**:
   - Existing `exams` → `tests`
   - Existing `exam_questions` → `questions`
   - Existing `exam_results` → `test_results`
   - Create `course_test` links from old exam relationships

3. **Model Updates**:
   - Course: Remove `exams()` relationship, add `tests()` via pivot
   - Lesson: Remove `exams()` relationship, add `tests()` via pivot
   - Module: Remove `exams()` relationship, add `tests()` via pivot

## Benefits

1. **Modularity**: Clear separation between content and assessment
2. **Reusability**: Tests can be used across multiple courses
3. **Scalability**: Easy to add new features (AI, proctoring, etc.)
4. **Maintainability**: Clear boundaries make code easier to understand
5. **Flexibility**: Rule-based progression allows complex scenarios
6. **User Experience**: Separate Test Builder optimized for assessment creation

## Future Extensions

- **AI Question Generation**: Add to TestService
- **Proctoring**: Add to Test model
- **Certificates**: Use test results in certificate logic
- **Analytics**: Track test performance across courses
- **Versioning**: Test versioning support already in place

## Notes

- Old `Exam` model can be kept for backward compatibility during migration
- Frontend will need updates to use new Test Builder UI
- Course Builder should focus on content, not test editing
- Test Builder should be a separate, optimized interface

