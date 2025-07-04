# Quizitt API Endpoints Documentation

## Authentication Endpoints (`/api/v1/auth`)

### Register User

```http
POST /api/v1/auth/register
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "securePassword123",
    "name": "John Doe"
}

Response (201 Created):
{
    "success": true,
    "message": "User registered successfully",
    "data": {
        "id": "user123",
        "email": "user@example.com",
        "name": "John Doe"
    }
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
    "email": "user@example.com",
    "password": "securePassword123"
}

Response (200 OK):
{
    "success": true,
    "token": "jwt_token_here",
    "user": {
        "id": "user123",
        "email": "user@example.com",
        "name": "John Doe"
    }
}
```

## Quiz Endpoints (`/api/v1/quiz`)

### Create Quiz

```http
POST /api/v1/quiz
Authorization: Bearer <token>
Content-Type: application/json

{
    "title": "Physics Quiz 1",
    "description": "Basic physics concepts",
    "questions": [
        {
            "question": "What is Newton's First Law?",
            "options": [
                "An object in motion stays in motion",
                "Force equals mass times acceleration",
                "For every action there is an equal reaction"
            ],
            "correctAnswer": 0
        }
    ],
    "category": "physics",
    "difficulty": "beginner"
}

Response (201 Created):
{
    "success": true,
    "quizId": "quiz123",
    "message": "Quiz created successfully"
}
```

### Get Quiz

```http
GET /api/v1/quiz/:quizId
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "quiz": {
        "id": "quiz123",
        "title": "Physics Quiz 1",
        "description": "Basic physics concepts",
        "questions": [...],
        "category": "physics",
        "difficulty": "beginner",
        "createdBy": "user123"
    }
}
```

## User Endpoints (`/api/v1/user`)

### Get User Profile

```http
GET /api/v1/user/profile
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "profile": {
        "id": "user123",
        "name": "John Doe",
        "email": "user@example.com",
        "stats": {
            "quizzesTaken": 15,
            "averageScore": 85,
            "streak": 5
        }
    }
}
```

### Update Profile

```http
PUT /api/v1/user/profile
Authorization: Bearer <token>
Content-Type: application/json

{
    "name": "John Updated",
    "preferences": {
        "notifications": true,
        "theme": "dark"
    }
}

Response (200 OK):
{
    "success": true,
    "message": "Profile updated successfully"
}
```

## Community Endpoints (`/api/v1/community`)

### Get Friends

```http
GET /api/v1/friend
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "friends": [
        {
            "id": "user456",
            "name": "Jane Smith",
            "status": "online"
        }
    ]
}
```

### Send Friend Request

```http
POST /api/v1/friend/request
Authorization: Bearer <token>
Content-Type: application/json

{
    "userId": "user456"
}

Response (200 OK):
{
    "success": true,
    "message": "Friend request sent successfully"
}
```

## Material Endpoints (`/api/v1/material`)

### Upload Study Material

```http
POST /api/v1/material
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
    "title": "Physics Notes",
    "description": "Chapter 1 notes",
    "file": <file>,
    "category": "physics"
}

Response (201 Created):
{
    "success": true,
    "materialId": "mat123",
    "url": "https://storage.example.com/materials/mat123.pdf"
}
```

## Subscription Endpoints (`/api/v1/subscription`)

### Get Subscription Plans

```http
GET /api/v1/subscription/plans
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "plans": [
        {
            "id": "basic",
            "name": "Basic Plan",
            "price": 9.99,
            "features": ["Unlimited quizzes", "Basic analytics"]
        },
        {
            "id": "premium",
            "name": "Premium Plan",
            "price": 19.99,
            "features": ["Unlimited quizzes", "Advanced analytics", "AI features"]
        }
    ]
}
```

### Subscribe to Plan

```http
POST /api/v1/subscription/subscribe
Authorization: Bearer <token>
Content-Type: application/json

{
    "planId": "premium",
    "paymentMethod": "card_123"
}

Response (200 OK):
{
    "success": true,
    "subscription": {
        "id": "sub123",
        "plan": "premium",
        "status": "active",
        "nextBillingDate": "2024-04-01"
    }
}
```

## Analytics Endpoints

### Get Monthly Stats

```http
GET /api/v1/monthly-time
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "stats": {
        "totalTime": 3600,
        "quizzesTaken": 12,
        "averageScore": 85,
        "streak": 5
    }
}
```

### Get Quiz Scores

```http
GET /api/v1/score
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "scores": [
        {
            "quizId": "quiz123",
            "score": 90,
            "timeTaken": 1200,
            "date": "2024-03-15"
        }
    ]
}
```

## Admin Endpoints (`/api/v1/admin`)

### Get Dashboard Stats

```http
GET /api/v1/admin/dashboard
Authorization: Bearer <token>

Response (200 OK):
{
    "success": true,
    "stats": {
        "totalUsers": 1000,
        "activeUsers": 500,
        "totalQuizzes": 200,
        "revenue": 5000
    }
}
```

## Content Moderation (`/api/v1/nsfw`)

### Check Content

```http
POST /api/v1/nsfw/check
Authorization: Bearer <token>
Content-Type: multipart/form-data

{
    "image": <file>
}

Response (200 OK):
{
    "success": true,
    "isSafe": true,
    "confidence": 0.95
}
```

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

```json
{
    "success": false,
    "error": "Invalid input data",
    "details": {
        "field": "email",
        "message": "Invalid email format"
    }
}
```

### 401 Unauthorized

```json
{
    "success": false,
    "error": "Authentication required"
}
```

### 403 Forbidden

```json
{
    "success": false,
    "error": "Insufficient permissions"
}
```

### 404 Not Found

```json
{
    "success": false,
    "error": "Resource not found"
}
```

### 500 Internal Server Error

```json
{
    "success": false,
    "error": "Internal server error"
}
```

## Rate Limiting

All endpoints are rate-limited:

- 100 requests per minute for authenticated users
- 20 requests per minute for unauthenticated users

## Authentication

Most endpoints require authentication using JWT tokens:

1. Include the token in the Authorization header:
    ```
    Authorization: Bearer <your_jwt_token>
    ```
2. Tokens expire after 24 hours
3. Refresh tokens are available for extending sessions

## Best Practices

1. Always include proper error handling
2. Use appropriate HTTP methods
3. Include pagination for list endpoints
4. Implement proper validation
5. Use HTTPS for all requests
6. Include proper CORS headers
7. Implement proper logging
8. Use proper status codes
