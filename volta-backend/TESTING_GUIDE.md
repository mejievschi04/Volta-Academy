# Testing Guide for LMS Architecture

## Step 3: Test Test Creation

This guide provides detailed steps and examples for testing the standalone test creation functionality.

## Prerequisites

1. Run migrations:
```bash
php artisan migrate
```

2. Ensure you have an admin user account
3. Have API testing tool ready (Postman, cURL, or similar)

## Test Creation API Endpoints

### 1. Create a Test (Draft)

**Endpoint**: `POST /api/admin/tests`

**Headers**:
```
Content-Type: application/json
Accept: application/json
Authorization: Bearer {token} (if using token auth)
```

**Request Body**:
```json
{
  "title": "Introduction to PHP Basics",
  "description": "Test your knowledge of PHP fundamentals",
  "type": "graded",
  "status": "draft",
  "time_limit_minutes": 30,
  "max_attempts": 3,
  "randomize_questions": false,
  "randomize_answers": false,
  "show_results_immediately": true,
  "show_correct_answers": false,
  "allow_review": true,
  "question_source": "direct",
  "questions": [
    {
      "type": "multiple_choice",
      "content": "What does PHP stand for?",
      "answers": [
        {
          "text": "PHP: Hypertext Preprocessor",
          "is_correct": true
        },
        {
          "text": "Personal Home Page",
          "is_correct": false
        },
        {
          "text": "Preprocessed Hypertext Protocol",
          "is_correct": false
        },
        {
          "text": "Programmed Hypertext Processor",
          "is_correct": false
        }
      ],
      "points": 10,
      "order": 0,
      "explanation": "PHP originally stood for Personal Home Page, but now stands for PHP: Hypertext Preprocessor"
    },
    {
      "type": "true_false",
      "content": "PHP is a server-side scripting language",
      "answers": [
        {
          "text": "True",
          "is_correct": true
        },
        {
          "text": "False",
          "is_correct": false
        }
      ],
      "points": 5,
      "order": 1
    }
  ]
}
```

**Expected Response** (201 Created):
```json
{
  "message": "Test created successfully",
  "test": {
    "id": 1,
    "title": "Introduction to PHP Basics",
    "description": "Test your knowledge of PHP fundamentals",
    "type": "graded",
    "status": "draft",
    "time_limit_minutes": 30,
    "max_attempts": 3,
    "randomize_questions": false,
    "randomize_answers": false,
    "show_results_immediately": true,
    "show_correct_answers": false,
    "allow_review": true,
    "question_source": "direct",
    "created_by": 1,
    "version": "1.0.0",
    "questions": [
      {
        "id": 1,
        "type": "multiple_choice",
        "content": "What does PHP stand for?",
        "points": 10,
        "order": 0
      },
      {
        "id": 2,
        "type": "true_false",
        "content": "PHP is a server-side scripting language",
        "points": 5,
        "order": 1
      }
    ],
    "created_at": "2025-01-22T10:00:00.000000Z",
    "updated_at": "2025-01-22T10:00:00.000000Z"
  }
}
```

### 2. List All Tests

**Endpoint**: `GET /api/admin/tests`

**Query Parameters** (optional):
- `status` - Filter by status (draft, published, archived)
- `type` - Filter by type (practice, graded, final)
- `created_by` - Filter by creator ID
- `search` - Search in title/description

**Example**:
```
GET /api/admin/tests?status=draft&type=graded
```

**Expected Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "title": "Introduction to PHP Basics",
      "type": "graded",
      "status": "draft",
      "created_by": 1,
      "created_at": "2025-01-22T10:00:00.000000Z"
    }
  ],
  "current_page": 1,
  "per_page": 20,
  "total": 1
}
```

### 3. Get Test Details

**Endpoint**: `GET /api/admin/tests/{id}`

**Expected Response** (200 OK):
```json
{
  "id": 1,
  "title": "Introduction to PHP Basics",
  "description": "Test your knowledge of PHP fundamentals",
  "type": "graded",
  "status": "draft",
  "time_limit_minutes": 30,
  "max_attempts": 3,
  "questions": [
    {
      "id": 1,
      "type": "multiple_choice",
      "content": "What does PHP stand for?",
      "answers": [...],
      "points": 10,
      "order": 0
    }
  ],
  "creator": {
    "id": 1,
    "name": "John Doe",
    "email": "john@example.com"
  },
  "courses": []
}
```

### 4. Update a Test

**Endpoint**: `PUT /api/admin/tests/{id}`

**Request Body**:
```json
{
  "title": "Introduction to PHP Basics - Updated",
  "description": "Updated description",
  "time_limit_minutes": 45
}
```

**Expected Response** (200 OK):
```json
{
  "message": "Test updated successfully",
  "test": {
    "id": 1,
    "title": "Introduction to PHP Basics - Updated",
    "time_limit_minutes": 45,
    ...
  }
}
```

### 5. Publish a Test

**Endpoint**: `POST /api/admin/tests/{id}/publish`

**Expected Response** (200 OK):
```json
{
  "message": "Test published successfully",
  "test": {
    "id": 1,
    "status": "published",
    ...
  }
}
```

**Error Response** (422 Unprocessable Entity) - If test has no questions:
```json
{
  "error": "Cannot publish test without questions"
}
```

### 6. Link Test to Course

**Endpoint**: `POST /api/admin/tests/{id}/link-to-course`

**Request Body**:
```json
{
  "course_id": 1,
  "scope": "course",
  "scope_id": null,
  "required": true,
  "passing_score": 70,
  "order": 0,
  "unlock_after_previous": false,
  "unlock_after_test_id": null
}
```

**Expected Response** (200 OK):
```json
{
  "message": "Test linked to course successfully"
}
```

**Error Response** (422) - If test is not published:
```json
{
  "error": "Cannot attach unpublished test to course"
}
```

### 7. Unlink Test from Course

**Endpoint**: `POST /api/admin/tests/{id}/unlink-from-course`

**Request Body**:
```json
{
  "course_id": 1,
  "scope": "course",
  "scope_id": null
}
```

**Expected Response** (200 OK):
```json
{
  "message": "Test unlinked from course successfully"
}
```

### 8. Delete a Test

**Endpoint**: `DELETE /api/admin/tests/{id}`

**Expected Response** (200 OK):
```json
{
  "message": "Test deleted successfully"
}
```

**Error Response** (422) - If test is linked to courses:
```json
{
  "error": "Cannot delete test that is linked to courses. Unlink it first."
}
```

## Test Scenarios

### Scenario 1: Complete Test Creation Flow

1. **Create test in draft mode**
   ```bash
   POST /api/admin/tests
   # Save test ID from response
   ```

2. **Add more questions** (if needed)
   ```bash
   PUT /api/admin/tests/{id}
   # Include questions array in request
   ```

3. **Review test**
   ```bash
   GET /api/admin/tests/{id}
   ```

4. **Publish test**
   ```bash
   POST /api/admin/tests/{id}/publish
   ```

5. **Link to course**
   ```bash
   POST /api/admin/tests/{id}/link-to-course
   ```

### Scenario 2: Test with Question Bank

1. **Create question bank** (if using QuestionBankAdminController)
2. **Create test with question_source: "bank"**
   ```json
   {
     "title": "Advanced PHP Test",
     "question_source": "bank",
     "question_set_id": 1
   }
   ```
3. **Publish test**
4. **Link to course**

### Scenario 3: Test Versioning

1. **Create original test**
2. **Create new version**
   ```bash
   POST /api/admin/tests/{id}/create-version
   # (This endpoint may need to be added)
   ```
3. **Update new version**
4. **Publish new version**
5. **Link new version to course**

## Validation Tests

### Test 1: Cannot Publish Empty Test
- Create test without questions
- Try to publish
- Should fail with error: "Cannot publish test without questions"

### Test 2: Cannot Link Unpublished Test
- Create test in draft mode
- Try to link to course
- Should fail with error: "Cannot attach unpublished test to course"

### Test 3: Cannot Delete Linked Test
- Create and publish test
- Link to course
- Try to delete
- Should fail with error: "Cannot delete test that is linked to courses"

### Test 4: Cannot Modify Published Test Questions
- Create and publish test
- Link to course
- Try to update questions
- Should fail with error: "Cannot modify questions of a published test that is linked to courses"

## cURL Examples

### Create Test
```bash
curl -X POST http://localhost:8000/api/admin/tests \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "title": "Test Title",
    "description": "Test Description",
    "type": "graded",
    "status": "draft",
    "questions": [
      {
        "type": "multiple_choice",
        "content": "Question 1?",
        "answers": [
          {"text": "Answer 1", "is_correct": true},
          {"text": "Answer 2", "is_correct": false}
        ],
        "points": 10
      }
    ]
  }'
```

### Publish Test
```bash
curl -X POST http://localhost:8000/api/admin/tests/1/publish \
  -H "Accept: application/json"
```

### Link Test to Course
```bash
curl -X POST http://localhost:8000/api/admin/tests/1/link-to-course \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{
    "course_id": 1,
    "scope": "course",
    "required": true,
    "passing_score": 70
  }'
```

## Postman Collection

You can create a Postman collection with these endpoints:

1. **Collection**: "LMS Test Management"
2. **Environment Variables**:
   - `base_url`: `http://localhost:8000`
   - `test_id`: (set after creating test)
   - `course_id`: (set after creating course)

3. **Requests**:
   - Create Test
   - List Tests
   - Get Test
   - Update Test
   - Publish Test
   - Link Test to Course
   - Unlink Test from Course
   - Delete Test

## Troubleshooting

### Issue: 401 Unauthorized
- **Solution**: Ensure you're authenticated as admin user
- Check authentication middleware is working

### Issue: 422 Validation Error
- **Solution**: Check request body matches expected format
- Verify all required fields are present
- Check field types match (e.g., boolean vs string)

### Issue: 500 Server Error
- **Solution**: Check Laravel logs: `storage/logs/laravel.log`
- Verify database migrations are run
- Check model relationships are correct

## Next Steps

After testing test creation:
1. Test course creation (Step 2)
2. Test test linking (Step 4)
3. Test progression rules (Step 5)
4. Test complete course flow (Step 6)

