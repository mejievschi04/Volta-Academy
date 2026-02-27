
## 🎯 CONTEXT

You are working on an existing SaaS Learning Management System project.

Your task is to **design and implement an enterprise-grade Course Creation and Quiz Creation system**, both technically robust and visually modern, comparable to top LMS platforms.

The goal is to create a **fast, intuitive, scalable, and modular course builder** that allows administrators to create structured courses, lessons, and assessments efficiently.

The solution must be designed with **clean architecture, reusable components, and future scalability** in mind.

---

# 🧠 CORE OBJECTIVE

Implement a complete system that includes:

1. Course creation wizard
2. Curriculum structure management
3. Lesson content builder (block-based editor)
4. Quiz creation engine
5. Learning progression logic
6. Course publishing workflow
7. Progress tracking support

Both **backend logic and frontend UX** must be designed at enterprise quality.

---

# 🏗️ SYSTEM ARCHITECTURE REQUIREMENTS

The system must be modular and separated into logical domains:

## Core Modules

### 1. Course Management Module

Responsible for:

* Creating courses
* Managing metadata
* Assigning categories/tags
* Course publishing status

---

### 2. Curriculum Structure Module

Handles hierarchical structure:

Course
→ Modules
→ Lessons

Must support:

* Drag & drop ordering
* Nested hierarchy
* Reordering without reload
* Dynamic updates

---

### 3. Lesson Content Module

Each lesson must support multiple content types.

Use a **block-based architecture**, similar to Notion editors.

Lesson block types:

* Text / Rich text
* Video embed
* File attachment
* Image gallery
* Interactive content block
* Assignment block

Blocks must:

* Be reorderable
* Be editable inline
* Store data as structured JSON

---

### 4. Assessment Engine

This must be implemented as a separate logic layer.

Quiz features:

* Multiple question types:

  * Single choice
  * Multiple choice
  * True/false
  * Short answer
  * Essay
  * Matching
  * Ordering
* Automatic grading rules
* Manual grading support
* Time limits
* Attempt limits
* Passing score logic

---

### 5. Learning Flow Logic Module

Supports learning progression rules:

* Sequential lesson unlocking
* Completion requirements
* Mandatory lessons
* Conditional progression

Must be flexible for future adaptive learning logic.

---

# 🧭 COURSE CREATION WIZARD FLOW

The UI must use a step-by-step wizard with clear progress indicators.

---

## STEP 1 — Course Setup

Fields:

* Title
* Description
* Category
* Tags
* Difficulty level
* Estimated duration
* Visibility settings

---

## STEP 2 — Curriculum Builder

Interface must include:

Left side:

* Tree structure of modules and lessons

Center:

* Editor area

Actions:

* Add module
* Add lesson
* Drag reorder
* Rename inline

---

## STEP 3 — Lesson Builder

User selects lesson → opens editor.

Layout:

Left: Block list
Center: Content editor
Right: Settings panel

Features:

* Add new content blocks
* Reorder blocks
* Preview mode

---

## STEP 4 — Quiz Builder

Separate wizard for assessments.

Sections:

### Quiz Settings

* Passing score
* Time limit
* Attempts allowed

### Question Editor

* Inline question creation
* Drag reorder
* Answer options editor

### Scoring Logic

* Auto grading rules
* Manual grading flags

---

## STEP 5 — Completion Rules

Define course completion logic:

* Required lessons
* Required quiz score
* Completion certificate trigger

---

## STEP 6 — Publishing

Settings:

* Draft vs Published
* Access permissions
* Enrollment type

---

# 🎨 UI / UX REQUIREMENTS

The interface must follow modern SaaS UX standards:

### Design Principles

* Clean minimal layout
* Clear hierarchy
* No clutter
* Fast interaction
* Inline editing
* Smooth transitions

---

### Layout Patterns

Course Builder:

* Left sidebar navigation
* Center editing workspace
* Right contextual settings panel

Quiz Builder:

* Google Forms style interface
* Inline editing
* Live preview

---

### Performance Requirements

* No full page reloads
* Optimistic UI updates
* Lazy loading of heavy content

---

# 🗄️ DATA MODEL REQUIREMENTS

Design normalized relational structure.

Core entities:

* courses
* modules
* lessons
* lesson_blocks
* quizzes
* questions
* answers
* quiz_attempts
* user_progress

Content blocks must store structured JSON payloads.

---

# ⚙️ TECHNICAL IMPLEMENTATION RULES

* Must be modular and extensible
* Follow clean architecture principles
* Separate business logic from UI
* Use reusable UI components
* Ensure API consistency
* Support multi-tenant architecture

---

# 🚀 FUTURE-READY DESIGN CONSIDERATIONS

The implementation must allow easy extension for:

* AI content generation
* Adaptive learning paths
* Gamification
* Advanced analytics
* Automation workflows

---

# 🎯 FINAL GOAL

The resulting system should feel:

* Fast
* Professional
* Intuitive
* Enterprise-grade
* Comparable to top LMS platforms

Administrators must be able to create a full course with lessons and quizzes quickly without technical knowledge.
