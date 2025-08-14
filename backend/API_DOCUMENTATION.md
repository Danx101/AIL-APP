# Abnehmen im Liegen - API Documentation

## Base URL
- Development: `http://localhost:3001/api/v1`
- Production: `https://your-domain.com/api/v1`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Table of Contents
1. [Authentication Endpoints](#authentication-endpoints)
2. [Lead Kanban Endpoints](#lead-kanban-endpoints)
3. [Customer Management Endpoints](#customer-management-endpoints)
4. [Search Endpoints](#search-endpoints)
5. [Appointment Endpoints](#appointment-endpoints)

---

## Authentication Endpoints

### 1. Studio Registration (Email Verification)
**POST** `/auth/register-studio`

Creates a new studio account with email verification required.

**Request Body:**
```json
{
  "email": "owner@studio.com",
  "password": "SecurePassword123",
  "firstName": "Max",
  "lastName": "Mustermann",
  "phone": "+49176123456",
  "studioName": "AiL Berlin Mitte",
  "studioAddress": "Hauptstraße 1, 10115 Berlin",
  "studioCity": "Berlin",
  "studioPhone": "+493012345678"
}
```

**Response (201):**
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "requiresVerification": true,
  "emailSent": true
}
```

**Notes:**
- Studio identifier (BER, MUC, etc.) automatically assigned based on city
- Studio inactive until email verified
- Verification email expires in 24 hours

---

### 2. Email Verification
**GET** `/auth/verify-email/:token`

Verifies email and activates studio account.

**Parameters:**
- `token` (string): Verification token from email

**Response (200):**
```json
{
  "message": "Email verified successfully. Your studio is now active!",
  "token": "jwt_token_here",
  "user": {
    "id": 1,
    "email": "owner@studio.com",
    "role": "studio_owner",
    "firstName": "Max",
    "lastName": "Mustermann"
  },
  "studio": {
    "id": 1,
    "name": "AiL Berlin Mitte",
    "unique_identifier": "BER",
    "is_active": true
  }
}
```

---

### 3. Customer Registration (With Code)
**POST** `/auth/register-customer-enhanced`

Register customer using registration code with optional email verification.

**Request Body:**
```json
{
  "registrationCode": "BER-456",
  "email": "customer@email.com",
  "password": "password123",
  "sendVerificationEmail": true
}
```

**Response (201):**
```json
{
  "message": "Registration successful!",
  "token": "jwt_token_here",
  "user": {
    "id": 2,
    "email": "customer@email.com",
    "role": "customer",
    "firstName": "Anna",
    "lastName": "Schmidt",
    "emailVerified": false
  },
  "customer": {
    "id": 456,
    "studio_id": 1,
    "studio_name": "AiL Berlin Mitte",
    "registration_code": "BER-456",
    "total_sessions_purchased": 20,
    "remaining_sessions": 18
  }
}
```

---

### 4. Validate Registration Code
**GET** `/auth/validate-code?code=BER-456`

Check if a registration code is valid before registration.

**Query Parameters:**
- `code` (string): Registration code to validate

**Response (200):**
```json
{
  "valid": true,
  "customer_name": "Anna Schmidt",
  "studio_name": "AiL Berlin Mitte",
  "active_sessions": 18,
  "can_register": true
}
```

---

### 5. Login
**POST** `/auth/login`

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@email.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "email": "user@email.com",
    "role": "studio_owner",
    "firstName": "Max",
    "lastName": "Mustermann"
  },
  "token": "jwt_token_here"
}
```

---

## Lead Kanban Endpoints

### 1. Get Kanban View
**GET** `/kanban?studio_id=1`

Get all leads organized by Kanban status.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `studio_id` (optional): Filter by studio (defaults to user's studio)

**Response (200):**
```json
{
  "active": {
    "new": [
      {
        "id": 1,
        "name": "John Doe",
        "phone_number": "+49176123456",
        "email": "john@email.com",
        "status": "new",
        "contact_attempts": 0,
        "appointment_count": 0,
        "stage_entered_at": "2025-01-10T10:00:00Z"
      }
    ],
    "working": [],
    "qualified": [],
    "trial_scheduled": []
  },
  "archived": {
    "positive": {
      "converted": []
    },
    "negative": {
      "unreachable": [],
      "wrong_number": [],
      "not_interested": [],
      "lost": []
    }
  },
  "metrics": {
    "conversion_rate": 0.42,
    "avg_time_to_convert": "5 days",
    "total_active": 28,
    "total_archived": 168,
    "total_converted": 70
  }
}
```

---

### 2. Move Lead Between Stages
**PUT** `/leads/:id/move`

Move lead to different Kanban stage with validation.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "to_status": "trial_scheduled",
  "appointment_data": {
    "date": "2025-01-15",
    "time": "14:00",
    "end_time": "15:00"
  }
}
```

**Response (200):**
```json
{
  "message": "Lead moved successfully",
  "lead": {
    "id": 1,
    "status": "trial_scheduled",
    "is_archived": false
  }
}
```

**Valid Status Transitions:**
- `new` → `working`, `unreachable`, `wrong_number`
- `working` → `qualified`, `not_interested`, `unreachable`
- `qualified` → `trial_scheduled`, `not_interested`
- `trial_scheduled` → `converted`, `lost`

---

### 3. Convert Lead to Customer
**POST** `/leads/:id/convert`

Convert lead to customer with mandatory session package.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "sessionPackage": 20,
  "paymentMethod": "cash",
  "notes": "Converted after successful trial"
}
```

**Response (201):**
```json
{
  "customer": {
    "id": 789,
    "registration_code": "BER-789",
    "name": "John Doe",
    "total_sessions_purchased": 20,
    "remaining_sessions": 20,
    "has_app_access": false,
    "customer_since": "2025-01-10T14:00:00Z",
    "acquisition_type": "lead_conversion"
  },
  "session_package": {
    "total": 20,
    "remaining": 20
  },
  "message": "Lead converted to customer with 20 sessions. Registration code: BER-789"
}
```

**Error Response (400):**
```json
{
  "error": "Cannot convert lead to customer without session package purchase",
  "code": "SESSION_REQUIRED"
}
```

---

### 4. Reactivate Archived Lead
**POST** `/leads/:id/reactivate`

Bring archived lead back to active pipeline.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "target_status": "working"
}
```

**Response (200):**
```json
{
  "message": "Lead reactivated successfully",
  "lead": {
    "id": 1,
    "status": "working",
    "is_archived": false
  }
}
```

---

### 5. Get Lead Activities
**GET** `/leads/:id/activities?limit=50`

Get activity history for a lead.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `limit` (optional): Number of activities to return (default: 50)

**Response (200):**
```json
{
  "activities": [
    {
      "id": 1,
      "lead_id": 1,
      "activity_type": "status_change",
      "description": "Status changed from new to working",
      "from_status": "new",
      "to_status": "working",
      "created_at": "2025-01-10T10:00:00Z",
      "first_name": "Max",
      "last_name": "Mustermann"
    }
  ]
}
```

---

### 6. Add Note to Lead
**POST** `/leads/:id/notes`

Add a note to lead's history.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "note": "Interested in 20-session package, will call back next week"
}
```

**Response (200):**
```json
{
  "message": "Note added successfully",
  "note": "[2025-01-10T10:00:00Z] Interested in 20-session package, will call back next week"
}
```

---

### 7. Update Contact Attempts
**POST** `/leads/:id/contact`

Record a contact attempt for a lead.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "contact_type": "call"
}
```

**Response (200):**
```json
{
  "message": "Contact attempt recorded",
  "contact_attempts": 3,
  "suggest_archive": false,
  "suggested_status": null
}
```

---

## Customer Management Endpoints

### 1. Create Customer (With Mandatory Sessions)
**POST** `/studios/:studioId/customers`

Create new customer with required session package.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "Anna",
  "lastName": "Schmidt",
  "phone": "+49176987654",
  "email": "anna@example.com",
  "sessionPackage": 20,
  "paymentMethod": "cash",
  "notes": "Prefers morning appointments"
}
```

**Response (201):**
```json
{
  "message": "Customer created with 20 sessions",
  "customer": {
    "id": 789,
    "registration_code": "BER-789",
    "name": "Anna Schmidt",
    "phone": "+49176987654",
    "email": "anna@example.com",
    "total_sessions_purchased": 20,
    "remaining_sessions": 20,
    "has_app_access": false,
    "customer_since": "2025-01-10T10:00:00Z"
  },
  "instructions": "Customer can register on app with code: BER-789"
}
```

**Notes:**
- `sessionPackage` must be 10, 20, 30, or 40
- Registration code generated automatically
- Customer can immediately register on app

---

### 2. Add Sessions to Customer
**POST** `/customers/:id/sessions`

Add additional session package to existing customer.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "total_sessions": 20,
  "payment_method": "card",
  "notes": "20er Block Nachkauf"
}
```

**Response (200):**
```json
{
  "message": "Added 20 sessions successfully",
  "session_package": {
    "total": 20,
    "remaining": 20
  },
  "registration_code": "BER-789",
  "total_sessions_purchased": 40,
  "current_remaining": 35
}
```

---

### 3. Get Customer Registration Info
**GET** `/customers/:id/registration-info`

Get registration details for customer.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "customer_id": 789,
  "customer_name": "Anna Schmidt",
  "registration_code": "BER-789",
  "has_app_access": false,
  "total_sessions_purchased": 20,
  "remaining_sessions": 18,
  "status": "Ready to register",
  "instructions": "Download the app and register with code: BER-789"
}
```

---

### 4. Get Studio Customers
**GET** `/studios/:studioId/customers?page=1&limit=20&search=anna`

Get paginated list of studio customers.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name, phone, or registration code

**Response (200):**
```json
{
  "customers": [
    {
      "id": 789,
      "name": "Anna Schmidt",
      "phone": "+49176987654",
      "email": "anna@example.com",
      "registration_code": "BER-789",
      "has_app_access": false,
      "total_sessions_purchased": 20,
      "remaining_sessions": 18,
      "customer_since": "2025-01-10T10:00:00Z",
      "status_badge": "Not Registered"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

### 5. Get Customer Details
**GET** `/customers/:id`

Get detailed customer information including session history.

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "customer": {
    "id": 789,
    "name": "Anna Schmidt",
    "phone": "+49176987654",
    "email": "anna@example.com",
    "registration_code": "BER-789",
    "has_app_access": false,
    "total_sessions_purchased": 20,
    "remaining_sessions": 18,
    "customer_since": "2025-01-10T10:00:00Z",
    "studio_name": "AiL Berlin Mitte",
    "stats": {
      "total_appointments": 2,
      "upcoming_appointments": 1
    }
  },
  "session_history": [
    {
      "id": 1,
      "total_sessions": 20,
      "remaining_sessions": 18,
      "payment_method": "cash",
      "is_active": true,
      "created_at": "2025-01-10T10:00:00Z"
    }
  ]
}
```

---

### 6. Update Customer Information
**PUT** `/customers/:id`

Update customer contact details.

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "contact_first_name": "Anna",
  "contact_last_name": "Schmidt-Meyer",
  "contact_phone": "+49176987655",
  "contact_email": "anna.new@example.com",
  "notes": "Updated contact information"
}
```

**Response (200):**
```json
{
  "message": "Customer updated successfully"
}
```

---

## Search Endpoints

### 1. Unified Person Search
**GET** `/search/persons?type=all&query=max&studio_id=1`

Search across both leads and customers.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `query` (required): Search term (min 2 characters)
- `type` (optional): Filter by type - `all`, `lead`, or `customer`
- `studio_id` (optional): Filter by studio

**Response (200):**
```json
{
  "results": [
    {
      "id": "lead_123",
      "type": "lead",
      "name": "Max Mustermann",
      "phone": "0176-1234567",
      "email": "max@example.com",
      "badge": "Lead - Qualifiziert",
      "can_book_trial": true,
      "status": "qualified",
      "color": "#007bff"
    },
    {
      "id": "customer_456",
      "type": "customer",
      "name": "Max Meyer",
      "phone": "0176-9876543",
      "email": "max.meyer@example.com",
      "registration_code": "BER-456",
      "badge": "Kunde - App-Nutzer",
      "sessions": {
        "total_purchased": 30,
        "remaining": 12
      },
      "has_app_access": true,
      "can_book": true,
      "color": "#28a745"
    }
  ],
  "total": 2,
  "query": "max",
  "type": "all"
}
```

---

### 2. Quick Search (For Appointment Booking)
**GET** `/search/quick?query=anna&studio_id=1`

Fast search optimized for appointment booking.

**Headers:** `Authorization: Bearer <token>`

**Query Parameters:**
- `query` (required): Search term (min 2 characters)
- `studio_id` (optional): Filter by studio

**Response (200):**
```json
{
  "results": [
    {
      "value": "lead_123",
      "label": "Anna Schmidt",
      "subtitle": "Lead - +49176123456",
      "type": "lead",
      "can_book_trial": true
    },
    {
      "value": "customer_789",
      "label": "Anna Meyer",
      "subtitle": "Kunde - BER-789 (18 Sessions)",
      "type": "customer",
      "can_book": true,
      "remaining_sessions": 18
    }
  ]
}
```

---

## Appointment Endpoints

### 1. Create Appointment
**POST** `/appointments`

Create appointment for lead (trial only) or customer (any type).

**Headers:** `Authorization: Bearer <token>`

**For Lead (Trial Only):**
```json
{
  "studio_id": 1,
  "person_type": "lead",
  "lead_id": 123,
  "appointment_type_id": 3,
  "appointment_date": "2025-01-15",
  "start_time": "14:00",
  "end_time": "15:00"
}
```

**For Customer (Any Type):**
```json
{
  "studio_id": 1,
  "person_type": "customer",
  "customer_id": 456,
  "appointment_type_id": 1,
  "appointment_date": "2025-01-15",
  "start_time": "14:00",
  "end_time": "15:00"
}
```

**Response (201):**
```json
{
  "message": "Appointment created successfully",
  "appointment": {
    "id": 999,
    "person_type": "customer",
    "customer_id": 456,
    "appointment_date": "2025-01-15",
    "start_time": "14:00",
    "end_time": "15:00",
    "status": "confirmed"
  }
}
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Please provide a valid email address"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "Invalid or expired token"
}
```

### 403 Forbidden
```json
{
  "message": "You don't have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "message": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "message": "Internal server error"
}
```

---

## Rate Limiting

- Rate limit: 100 requests per minute per IP
- Headers returned:
  - `X-RateLimit-Limit`: 100
  - `X-RateLimit-Remaining`: 95
  - `X-RateLimit-Reset`: 1610000000

---

## Webhook Events (Future)

The system can emit these webhook events:

- `lead.created` - New lead added
- `lead.status_changed` - Lead moved between stages
- `lead.converted` - Lead converted to customer
- `customer.created` - New customer created
- `customer.registered` - Customer registered on app
- `sessions.added` - Session package added
- `appointment.created` - New appointment scheduled
- `appointment.completed` - Appointment marked complete

---

## Testing with cURL

### Create Studio
```bash
curl -X POST http://localhost:3001/api/v1/auth/register-studio \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@studio.com",
    "password": "TestPassword123",
    "firstName": "Max",
    "lastName": "Mustermann",
    "phone": "+49176123456",
    "studioName": "AiL Berlin Test",
    "studioAddress": "Test Street 123",
    "studioCity": "Berlin",
    "studioPhone": "+493012345678"
  }'
```

### Get Kanban View
```bash
curl -X GET http://localhost:3001/api/v1/kanban \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Convert Lead to Customer
```bash
curl -X POST http://localhost:3001/api/v1/leads/1/convert \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionPackage": 20,
    "paymentMethod": "cash"
  }'
```

---

## Postman Collection

Import this collection to Postman for easy testing:

```json
{
  "info": {
    "name": "Abnehmen im Liegen API",
    "description": "Lead Kanban & Customer Management API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{jwt_token}}",
        "type": "string"
      }
    ]
  },
  "variable": [
    {
      "key": "base_url",
      "value": "http://localhost:3001/api/v1"
    },
    {
      "key": "jwt_token",
      "value": ""
    }
  ]
}
```

---

*Last Updated: 2025-01-10*
*Version: 1.0.0*