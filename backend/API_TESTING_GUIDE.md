# API Testing Guide

## Quick Start

### 1. Import Postman Collection
1. Open Postman
2. Click "Import" → Choose `postman-collection.json`
3. Collection "Abnehmen im Liegen - Lead Kanban API" will appear

### 2. Test Flow Sequence

Follow this order to test the complete system:

## Step 1: Studio Setup
```
1. Register Studio (no auth needed)
   → Note: Email verification required in production
   
2. Login as Studio Owner
   → JWT token automatically saved to collection
   
3. Check API Status
   → Verify connection
```

## Step 2: Lead Management Flow
```
1. Create a Lead (use existing endpoint or create via frontend)

2. Get Kanban View
   → See lead in "new" column
   
3. Move Lead to "working"
   → Lead moves to working column
   
4. Add Note to Lead
   → Activity logged
   
5. Record Contact Attempt
   → Updates contact counter
   
6. Move Lead to "qualified"
   → Lead progresses
   
7. Move Lead to "trial_scheduled" 
   → Include appointment_data
   → Creates trial appointment
```

## Step 3: Lead to Customer Conversion
```
1. Convert Lead to Customer
   → MUST include sessionPackage (10/20/30/40)
   → Returns registration_code (e.g., BER-789)
   
2. Get Customer Details
   → Verify customer created
   → Check registration_code
   → Verify sessions added
```

## Step 4: Customer Management
```
1. Create New Customer (Direct)
   → MUST include sessionPackage
   → Auto-generates registration_code
   
2. Add More Sessions
   → Top up existing customer
   
3. Get Registration Info
   → Shows code and instructions
   
4. Update Customer Info
   → Change contact details
```

## Step 5: Customer App Registration
```
1. Validate Registration Code
   → Check code before registration
   
2. Register Customer (Enhanced)
   → Use registration_code
   → Optional email verification
   → Customer gets app access
```

## Step 6: Search & Discovery
```
1. Search Persons
   → Search across leads AND customers
   → Returns unified results
   
2. Quick Search
   → Optimized for appointment booking
```

## Step 7: Appointments
```
1. Create Lead Appointment
   → Only trial appointments (type_id: 3)
   
2. Create Customer Appointment
   → Any appointment type
   → Requires active sessions
```

---

## Testing with cURL

### Quick Authentication Test
```bash
# 1. Register Studio
curl -X POST http://localhost:3001/api/v1/auth/register-studio \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@studio.com",
    "password": "Test123456",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+49176123456",
    "studioName": "Test Studio Berlin",
    "studioAddress": "Test St 1",
    "studioCity": "Berlin",
    "studioPhone": "+493012345678"
  }'

# 2. Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@studio.com",
    "password": "Test123456"
  }'

# Save the JWT token from response
export JWT_TOKEN="your_token_here"

# 3. Test Authenticated Endpoint
curl -X GET http://localhost:3001/api/v1/kanban \
  -H "Authorization: Bearer $JWT_TOKEN"
```

### Lead Conversion Test
```bash
# Convert lead to customer (requires JWT)
curl -X POST http://localhost:3001/api/v1/leads/1/convert \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sessionPackage": 20,
    "paymentMethod": "cash"
  }'
```

---

## Common Test Scenarios

### Scenario 1: New Lead Journey
1. Lead created (status: new)
2. First contact attempt → Move to working
3. Multiple contacts → Add notes
4. Qualification → Move to qualified
5. Schedule trial → Move to trial_scheduled with appointment
6. After trial → Convert to customer with sessions

### Scenario 2: Direct Walk-in Customer
1. Create customer with session package
2. Get registration code
3. Customer downloads app
4. Customer registers with code
5. Customer books appointments

### Scenario 3: Lead Archive & Reactivation
1. Move lead to unreachable/not_interested
2. Lead goes to archive
3. Later reactivate lead
4. Lead returns to active pipeline

---

## Validation Rules to Test

### Lead Status Transitions
- ✅ new → working
- ✅ working → qualified
- ✅ qualified → trial_scheduled
- ✅ trial_scheduled → converted
- ❌ new → converted (not allowed)
- ❌ converted → any (terminal state)

### Customer Creation Rules
- ❌ Create customer without sessions (fails)
- ✅ Create customer with 10/20/30/40 sessions
- ❌ Create customer with 15 sessions (invalid)
- ✅ Registration code auto-generated

### Appointment Rules
- ✅ Lead can book trial only
- ❌ Lead cannot book regular appointment
- ✅ Customer can book any appointment type
- ❌ Customer without sessions cannot book

---

## Error Testing

### Test Invalid Requests
1. Missing required fields
2. Invalid email formats
3. Weak passwords
4. Invalid session packages
5. Invalid status transitions
6. Missing JWT token
7. Expired JWT token
8. Wrong role permissions

### Expected Error Responses
- 400: Bad Request (validation errors)
- 401: Unauthorized (no/invalid token)
- 403: Forbidden (wrong role)
- 404: Not Found (resource doesn't exist)
- 500: Internal Server Error

---

## Performance Testing

### Load Test Endpoints
```bash
# Install Apache Bench (ab)
# Mac: brew install httpd
# Linux: apt-get install apache2-utils

# Test Kanban endpoint (100 requests, 10 concurrent)
ab -n 100 -c 10 -H "Authorization: Bearer $JWT_TOKEN" \
   http://localhost:3001/api/v1/kanban

# Test Search endpoint
ab -n 100 -c 10 -H "Authorization: Bearer $JWT_TOKEN" \
   "http://localhost:3001/api/v1/search/persons?query=test&type=all"
```

---

## Database Verification

### Check Data Integrity
```sql
-- Verify lead status transitions
SELECT status, COUNT(*) FROM leads GROUP BY status;

-- Check customers have sessions
SELECT c.id, c.registration_code, 
       SUM(cs.total_sessions) as total,
       SUM(cs.remaining_sessions) as remaining
FROM customers c
LEFT JOIN customer_sessions cs ON c.id = cs.customer_id
GROUP BY c.id;

-- Verify registration codes are unique
SELECT registration_code, COUNT(*) 
FROM customers 
GROUP BY registration_code 
HAVING COUNT(*) > 1;

-- Check lead activities
SELECT lead_id, activity_type, COUNT(*) 
FROM lead_activities 
GROUP BY lead_id, activity_type;
```

---

## Monitoring & Logs

### Server Logs
```bash
# Watch server output
npm start

# Check for errors
grep "error" server.log

# Monitor API calls
tail -f server.log | grep "::1"
```

### Database Queries
```bash
# Enable MySQL query log
SET GLOBAL general_log = 'ON';

# Check slow queries
SHOW PROCESSLIST;
```

---

## Next Steps After Testing

1. **Frontend Integration**
   - Use API endpoints in React/Vue/Angular
   - Implement drag-and-drop for Kanban
   - Create modals for conversion

2. **Email Configuration**
   - Add Gmail credentials to .env
   - Test email verification flow
   - Monitor email delivery

3. **Production Deployment**
   - Set NODE_ENV=production
   - Configure MySQL connection pool
   - Set up SSL/HTTPS
   - Configure rate limiting
   - Set up monitoring

---

*Testing Guide Version: 1.0.0*
*Last Updated: 2025-01-10*