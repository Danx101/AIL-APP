# Testing & Deployment Guide - Autonomous Appointment Scheduling

This guide covers comprehensive testing and deployment procedures for the Twilio + Dialogflow CX integration.

## Testing Strategy

### Phase 1: Unit Testing

#### 1.1 Dialogflow Service Tests

Create test file: `backend/tests/dialogflow/dialogflowService.test.js`

```javascript
const dialogflowService = require('../../src/dialogflow/services/dialogflowService');

describe('DialogflowService', () => {
  beforeEach(() => {
    // Mock Dialogflow CX client
    jest.mock('@google-cloud/dialogflow-cx');
  });

  test('should create session successfully', () => {
    const sessionId = dialogflowService.createSession('+49123456789', 1);
    expect(sessionId).toBeDefined();
    expect(sessionId).toContain('phone-+49123456789');
  });

  test('should detect intent from text', async () => {
    const mockResponse = {
      intent: { displayName: 'BookAppointment', confidence: 0.9 },
      parameters: { date: '2024-01-15', time: '14:00' },
      fulfillmentText: 'Test response'
    };

    // Mock the detectIntentText method
    dialogflowService.detectIntentText = jest.fn().mockResolvedValue(mockResponse);

    const result = await dialogflowService.detectIntentText('test-session', 'Ich möchte einen Termin');
    expect(result.intent.displayName).toBe('BookAppointment');
    expect(result.parameters.date).toBe('2024-01-15');
  });

  test('should handle session cleanup', () => {
    const sessionId = dialogflowService.createSession('+49123456789');
    const cleaned = dialogflowService.endSession(sessionId);
    expect(cleaned).toBe(true);
  });
});
```

#### 1.2 Appointment Handler Tests

```javascript
const appointmentHandler = require('../../src/dialogflow/handlers/appointmentHandler');

describe('AppointmentHandler', () => {
  test('should parse date correctly', () => {
    const date = appointmentHandler.parseDate('2024-01-15');
    expect(date).toBe('2024-01-15');
  });

  test('should parse time correctly', () => {
    const time = appointmentHandler.parseTime('14:30');
    expect(time).toEqual({
      start: '14:30',
      end: '15:30',
      hours: 14,
      minutes: 870
    });
  });

  test('should handle booking request', async () => {
    const result = await appointmentHandler.handleBookAppointment(
      'test-session',
      { date: '2024-01-15', time: '14:00' },
      1, // leadId
      1  // studioId
    );
    
    expect(result.fulfillmentText).toBeDefined();
    expect(result.parameters).toBeDefined();
  });
});
```

#### 1.3 Response Builder Tests

```javascript
const responseBuilder = require('../../src/dialogflow/utils/responseBuilder');

describe('ResponseBuilder', () => {
  test('should build text response', () => {
    const response = responseBuilder.buildTextResponse('Hello {name}', { name: 'Max' });
    expect(response.fulfillmentText).toBe('Hello Max');
  });

  test('should build welcome response', () => {
    const response = responseBuilder.buildWelcomeResponse('Anna');
    expect(response.fulfillmentText).toContain('Anna');
  });

  test('should build confirmation response', () => {
    const response = responseBuilder.buildConfirmationResponse({
      date: '2024-01-15',
      time: '14:00',
      service: 'Behandlung'
    });
    expect(response.fulfillmentText).toContain('2024-01-15');
    expect(response.fulfillmentText).toContain('14:00');
  });
});
```

### Phase 2: Integration Testing

#### 2.1 Database Integration Tests

```javascript
const DialogflowConversation = require('../../src/models/DialogflowConversation');

describe('DialogflowConversation Integration', () => {
  beforeEach(async () => {
    // Set up test database
    await setupTestDatabase();
  });

  afterEach(async () => {
    // Clean up test data
    await cleanupTestDatabase();
  });

  test('should create conversation record', async () => {
    const conversation = await DialogflowConversation.create({
      lead_id: 1,
      session_id: 'test-session',
      intent_name: 'BookAppointment',
      confidence_score: 0.9,
      user_message: 'Ich möchte einen Termin',
      bot_response: 'Gerne helfe ich Ihnen'
    });

    expect(conversation.id).toBeDefined();
    expect(conversation.intent_name).toBe('BookAppointment');
  });

  test('should retrieve conversation by session', async () => {
    const conversations = await DialogflowConversation.findBySessionId('test-session');
    expect(conversations).toBeInstanceOf(Array);
  });
});
```

#### 2.2 Twilio Integration Tests

```javascript
const request = require('supertest');
const app = require('../../server');

describe('Twilio Webhook Integration', () => {
  test('should handle voice webhook', async () => {
    const response = await request(app)
      .post('/api/v1/twilio/voice/webhook')
      .send({
        CallSid: 'test-call-sid',
        From: '+49123456789',
        To: '+49987654321'
      })
      .expect(200);

    expect(response.text).toContain('<Response>');
    expect(response.text).toContain('<Say>');
  });

  test('should handle gather input', async () => {
    const response = await request(app)
      .post('/api/v1/twilio/voice/gather')
      .send({
        CallSid: 'test-call-sid',
        SpeechResult: 'Ich möchte einen Termin',
        From: '+49123456789'
      })
      .expect(200);

    expect(response.text).toContain('<Response>');
  });

  test('should handle status callback', async () => {
    const response = await request(app)
      .post('/api/v1/twilio/status/callback')
      .send({
        CallSid: 'test-call-sid',
        CallStatus: 'completed',
        CallDuration: '120'
      })
      .expect(200);

    expect(response.text).toBe('OK');
  });
});
```

### Phase 3: End-to-End Testing

#### 3.1 Full Conversation Flow Test

```javascript
describe('Complete Appointment Booking Flow', () => {
  test('should complete appointment booking conversation', async () => {
    // Step 1: Initial call
    let response = await request(app)
      .post('/api/v1/twilio/voice/webhook')
      .send({
        CallSid: 'test-flow-call',
        From: '+49123456789',
        To: '+49987654321'
      });

    expect(response.text).toContain('Guten Tag');

    // Step 2: Book appointment request
    response = await request(app)
      .post('/api/v1/twilio/voice/gather')
      .send({
        CallSid: 'test-flow-call',
        SpeechResult: 'Ich möchte einen Termin morgen um 14 Uhr',
        From: '+49123456789'
      });

    expect(response.text).toContain('prüfe');

    // Step 3: Confirmation
    response = await request(app)
      .post('/api/v1/twilio/voice/gather')
      .send({
        CallSid: 'test-flow-call',
        SpeechResult: 'Ja, das passt',
        From: '+49123456789'
      });

    expect(response.text).toContain('bestätigt');

    // Verify appointment was created
    const appointments = await Appointment.findByStudio(1, {
      from_date: new Date().toISOString().split('T')[0]
    });
    expect(appointments.length).toBeGreaterThan(0);
  });
});
```

## Testing Scripts

### 3.2 Create Test Runner

Create `backend/package.json` scripts:

```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:integration": "jest --testPathPattern=integration",
    "test:e2e": "jest --testPathPattern=e2e",
    "test:dialogflow": "jest --testPathPattern=dialogflow"
  }
}
```

### 3.3 Jest Configuration

Create `backend/jest.config.js`:

```javascript
module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/database/migrations/**',
    '!src/**/*.test.js'
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ]
};
```

## Manual Testing Procedures

### 4.1 Dialogflow CX Agent Testing

**Test in Dialogflow Console:**

1. **Welcome Intent Test:**
   - Input: "Hallo"
   - Expected: Welcome message with appointment offer

2. **Appointment Booking Test:**
   - Input: "Ich möchte einen Termin morgen um 14 Uhr"
   - Expected: Availability check, confirmation request

3. **Availability Check Test:**
   - Input: "Haben Sie morgen Zeit?"
   - Expected: List of available time slots

4. **Confirmation Test:**
   - Input: "Ja, das passt"
   - Expected: Appointment confirmation

5. **Fallback Test:**
   - Input: "Banana"
   - Expected: Fallback response asking for clarification

### 4.2 Twilio Voice Testing

**Test Call Flow:**

1. **Call Twilio Number:**
   - Expected: Welcome message in German
   - System should recognize speech input

2. **Say Appointment Request:**
   - Input: "Ich möchte einen Termin"
   - Expected: System asks for date/time

3. **Provide Date/Time:**
   - Input: "Morgen um zwei Uhr"
   - Expected: Availability check, confirmation request

4. **Confirm Appointment:**
   - Input: "Ja, bestätigen"
   - Expected: Appointment confirmed, call ends

### 4.3 Database Verification

After each test call, verify:

```sql
-- Check conversation logs
SELECT * FROM dialogflow_conversations 
WHERE session_id LIKE '%test%' 
ORDER BY created_at DESC;

-- Check appointment creation
SELECT * FROM appointments 
WHERE notes LIKE '%Dialogflow%' 
ORDER BY created_at DESC;

-- Check lead updates
SELECT * FROM leads 
WHERE source = 'dialogflow_call' 
ORDER BY updated_at DESC;

-- Check call logs
SELECT * FROM lead_call_logs 
WHERE twilio_call_sid LIKE '%test%' 
ORDER BY created_at DESC;
```

## Load Testing

### 5.1 Concurrent Call Testing

Use tools like Artillery.io for load testing:

Create `load-test.yml`:

```yaml
config:
  target: 'https://your-domain.com'
  phases:
    - duration: 60
      arrivalRate: 5
  headers:
    Content-Type: 'application/x-www-form-urlencoded'

scenarios:
  - name: 'Twilio Webhook Load Test'
    requests:
      - post:
          url: '/api/v1/twilio/voice/webhook'
          form:
            CallSid: 'test-{{ $uuid }}'
            From: '+49123456789'
            To: '+49987654321'
      - post:
          url: '/api/v1/twilio/voice/gather'
          form:
            CallSid: 'test-{{ $uuid }}'
            SpeechResult: 'Ich möchte einen Termin'
            From: '+49123456789'
```

Run: `artillery run load-test.yml`

### 5.2 Dialogflow API Quota Testing

Monitor API usage:
- Requests per minute: 1000 (default)
- Requests per day: 1,000,000 (default)
- Concurrent requests: 10 (default)

## Deployment Procedures

### 6.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] Environment variables configured
- [ ] SSL certificate valid
- [ ] Database migrations applied
- [ ] Dialogflow agent deployed
- [ ] Twilio webhooks configured
- [ ] Load balancer configured (if applicable)
- [ ] Monitoring alerts set up

### 6.2 Railway Deployment

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Deploy backend
cd backend
railway up

# Set environment variables
railway variables:set DIALOGFLOW_PROJECT_ID=your-project-id
railway variables:set DIALOGFLOW_AGENT_ID=your-agent-id
railway variables:set TWILIO_ACCOUNT_SID=your-account-sid
railway variables:set TWILIO_AUTH_TOKEN=your-auth-token
railway variables:set ENABLE_DIALOGFLOW=true

# Check deployment
railway logs
```

### 6.3 Environment-Specific Configurations

**Development:**
```env
NODE_ENV=development
ENABLE_DIALOGFLOW=false  # Use basic Twilio only
LOG_LEVEL=debug
```

**Staging:**
```env
NODE_ENV=staging
ENABLE_DIALOGFLOW=true
DIALOGFLOW_ENVIRONMENT=staging
LOG_LEVEL=info
```

**Production:**
```env
NODE_ENV=production
ENABLE_DIALOGFLOW=true
DIALOGFLOW_ENVIRONMENT=production
LOG_LEVEL=warn
```

### 6.4 Database Migration Strategy

```bash
# Run migrations
npm run migrate

# Seed test data (staging only)
npm run seed:staging

# Backup before deployment
npm run backup:create

# Rollback if needed
npm run backup:restore
```

## Monitoring & Maintenance

### 7.1 Health Check Endpoints

Create health check endpoints:

```javascript
// Health check for basic functionality
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: db.isConnected(),
      dialogflow: dialogflowConfig.isConfigured(),
      twilio: twilioService.isConfigured()
    }
  });
});

// Detailed system status
app.get('/status', auth, async (req, res) => {
  const stats = {
    activeSessions: twilioDialogflowBridge.getActiveSessionsCount(),
    recentCalls: await getRecentCallStats(),
    appointmentBookings: await getRecentAppointmentStats(),
    systemHealth: await checkSystemHealth()
  };
  
  res.json(stats);
});
```

### 7.2 Monitoring Metrics

Track these key metrics:
- Call answer rate
- Appointment booking success rate
- Average conversation duration
- Intent recognition accuracy
- System response time
- Error rates

### 7.3 Automated Testing Schedule

Set up automated testing:
- **Daily**: Basic health checks
- **Weekly**: Full integration tests
- **Monthly**: Load testing
- **Quarterly**: Security audits

### 7.4 Maintenance Tasks

**Weekly:**
- Review error logs
- Check API quotas
- Verify webhook deliveries
- Update training phrases based on usage

**Monthly:**
- Clean up old conversation logs
- Review and optimize database queries
- Update Dialogflow intents based on patterns
- Performance optimization

**Quarterly:**
- Security updates
- Dependency updates
- Architecture review
- Cost optimization

## Troubleshooting Guide

### Common Issues & Solutions

**1. Webhooks Not Receiving Calls**
```bash
# Test webhook accessibility
curl -X POST https://your-domain.com/api/v1/twilio/voice/webhook

# Check SSL certificate
curl -I https://your-domain.com

# Verify in Twilio Console → Debugger
```

**2. Dialogflow Not Responding**
```bash
# Test Dialogflow configuration
npm run test:dialogflow

# Check service account permissions
gcloud iam service-accounts get-iam-policy your-service-account@project.iam.gserviceaccount.com

# Verify API quotas
gcloud services list --enabled | grep dialogflow
```

**3. Database Connection Issues**
```bash
# Test database connection
npm run db:test

# Check connection pool
npm run db:status

# Review migration status
npm run migrate:status
```

**4. High Error Rates**
- Review application logs
- Check Dialogflow training data
- Verify intent confidence thresholds
- Test with different voice inputs

This comprehensive testing and deployment guide ensures reliable operation of your autonomous appointment scheduling system.