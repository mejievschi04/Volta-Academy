Create a modern LMS Question Bank page with a clean SaaS UI (Notion + Linear style).

STYLE:
- Light background (#F8FAFC), white cards
- Accent: #FFEE00
- Rounded corners (12-16px)
- Soft shadows
- Minimal, airy layout

STRUCTURE:

1. FOLDERS PAGE
- Vertical card list (not table)
- Each folder card:
  - Name (bold)
  - Tags (pill style)
  - Question count
  - Starred questions count (⭐)
- Hover:
  - subtle highlight
  - "Open →"

Top bar:
- Search
- "+ New Folder"

2. FOLDER DETAILS PAGE

HEADER:
- Back button
- Folder name
- Tags
- Edit icon

QUESTION LIST:

Each row:
- Checkbox (left)
- ⭐ toggle (star / unstar)
- Question text (max 2 lines)
- Tags (under text)

Right side:
- Question type (MCQ, Open, etc)
- Actions menu (⋯)

STYLES:
- Starred questions:
  - very light yellow background (#FFEE00 low opacity)
  - filled star icon
- Hover:
  - light gray background
  - show actions

BOTTOM:
- "+ Add Question"
- "✨ Generate with AI"

3. TEST BUILDER

Options:
- Select by:
  ( ) Folders
  ( ) Tags

If Tags:
- checkbox list

Toggle:
- "Include starred questions" (ON by default)

SUMMARY:
- Total questions
- "+ X starred (required)"

4. UX:

- Click question → open right drawer
- Multi-select enabled
- Bulk actions:
  - Delete
  - Move to folder

5. TAG SYSTEM:

- Tags reusable
- Used on folders and questions

6. LOGIC:

- Starred questions always included in tests

OUTPUT:
- React components:
  - FolderCard
  - QuestionRow
  - Tag
  - Drawer