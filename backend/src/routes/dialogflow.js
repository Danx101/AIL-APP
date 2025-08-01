const express = require('express');
const twilioDialogflowBridge = require('../dialogflow/webhooks/twilioDialogflowBridge');
const dialogflowService = require('../dialogflow/services/dialogflowService');
const responseBuilder = require('../dialogflow/utils/responseBuilder');
const auth = require('../middleware/auth');

const router = express.Router();

/**
 * Dialogflow webhook endpoint for fulfillment
 * POST /api/v1/dialogflow/webhook
 */
router.post('/webhook', async (req, res) => {
  try {
    const { sessionInfo, fulfillmentInfo, intentInfo, pageInfo, parameters } = req.body;
    
    console.log('📨 Dialogflow webhook called:', {
      intent: intentInfo?.displayName,
      page: pageInfo?.displayName,
      session: sessionInfo?.session
    });

    // Extract session and parameters
    const sessionId = sessionInfo?.session?.split('/').pop();
    const intentName = intentInfo?.displayName;
    const queryParameters = parameters || {};

    let response;

    // Handle different intents
    switch (intentName) {
      case 'BookAppointment':
        response = await handleBookAppointmentWebhook(sessionId, queryParameters);
        break;
      
      case 'CheckAvailability':
        response = await handleAvailabilityWebhook(sessionId, queryParameters);
        break;
      
      case 'ConfirmBooking':
        response = await handleConfirmBookingWebhook(sessionId, queryParameters);
        break;
      
      default:
        response = {
          fulfillmentResponse: {
            messages: [
              {
                text: {
                  text: ['Ich verstehe. Wie kann ich Ihnen weiter helfen?']
                }
              }
            ]
          }
        };
    }

    res.json(response);

  } catch (error) {
    console.error('Error in Dialogflow webhook:', error);
    
    res.json({
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: ['Entschuldigung, es ist ein Fehler aufgetreten. Können Sie es bitte erneut versuchen?']
            }
          }
        ]
      }
    });
  }
});

/**
 * Test Dialogflow integration endpoint
 * POST /api/v1/dialogflow/test
 */
router.post('/test', auth, async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const testSessionId = sessionId || `test-${Date.now()}`;
    
    // Test text detection
    const response = await dialogflowService.detectIntentText(testSessionId, message);
    
    res.json({
      success: true,
      sessionId: testSessionId,
      response: response
    });

  } catch (error) {
    console.error('Error testing Dialogflow:', error);
    res.status(500).json({ 
      error: 'Failed to test Dialogflow integration',
      details: error.message 
    });
  }
});

/**
 * Get conversation transcript
 * GET /api/v1/dialogflow/transcript/:sessionId
 */
router.get('/transcript/:sessionId', auth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const transcript = await dialogflowService.getConversationTranscript(sessionId);
    
    res.json({
      success: true,
      sessionId: sessionId,
      transcript: transcript
    });

  } catch (error) {
    console.error('Error getting transcript:', error);
    res.status(500).json({ 
      error: 'Failed to get conversation transcript',
      details: error.message 
    });
  }
});

/**
 * Get active sessions
 * GET /api/v1/dialogflow/sessions
 */
router.get('/sessions', auth, async (req, res) => {
  try {
    const activeSessionsCount = twilioDialogflowBridge.getActiveSessionsCount();
    
    res.json({
      success: true,
      activeSessions: activeSessionsCount
    });

  } catch (error) {
    console.error('Error getting sessions:', error);
    res.status(500).json({ 
      error: 'Failed to get session information',
      details: error.message 
    });
  }
});

/**
 * Clean up inactive sessions
 * POST /api/v1/dialogflow/cleanup
 */
router.post('/cleanup', auth, async (req, res) => {
  try {
    const { maxInactivityMinutes = 30 } = req.body;
    
    dialogflowService.cleanupInactiveSessions(maxInactivityMinutes);
    
    res.json({
      success: true,
      message: 'Session cleanup completed'
    });

  } catch (error) {
    console.error('Error cleaning up sessions:', error);
    res.status(500).json({ 
      error: 'Failed to cleanup sessions',
      details: error.message 
    });
  }
});

// Helper functions for webhook handling

async function handleBookAppointmentWebhook(sessionId, parameters) {
  try {
    // This would integrate with your appointment booking logic
    const { date, time, serviceType } = parameters;
    
    if (!date || !time) {
      return {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Um einen Termin zu vereinbaren, benötige ich das Datum und die Uhrzeit. Wann hätten Sie gerne einen Termin?']
              }
            }
          ]
        }
      };
    }

    return {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [`Perfekt! Ich prüfe die Verfügbarkeit für ${date} um ${time} Uhr.`]
            }
          }
        ]
      },
      sessionInfo: {
        parameters: {
          appointmentDate: date,
          appointmentTime: time,
          serviceType: serviceType
        }
      }
    };

  } catch (error) {
    console.error('Error in book appointment webhook:', error);
    throw error;
  }
}

async function handleAvailabilityWebhook(sessionId, parameters) {
  try {
    const { date } = parameters;
    
    if (!date) {
      return {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Für welchen Tag möchten Sie die Verfügbarkeit prüfen?']
              }
            }
          ]
        }
      };
    }

    // Mock availability check - in production, this would check your calendar
    const availableSlots = ['09:00', '11:00', '14:00', '16:00'];
    
    return {
      fulfillmentResponse: {
        messages: [
          {
            text: {
              text: [`Am ${date} haben wir freie Termine um ${availableSlots.join(', ')} Uhr. Welche Uhrzeit würde Ihnen passen?`]
            }
          }
        ]
      },
      sessionInfo: {
        parameters: {
          availableSlots: availableSlots,
          requestedDate: date
        }
      }
    };

  } catch (error) {
    console.error('Error in availability webhook:', error);
    throw error;
  }
}

async function handleConfirmBookingWebhook(sessionId, parameters) {
  try {
    const { confirmation, appointmentDate, appointmentTime } = parameters;
    
    if (confirmation && confirmation.toLowerCase().includes('ja')) {
      return {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: [`Vielen Dank! Ihr Termin am ${appointmentDate} um ${appointmentTime} Uhr ist bestätigt. Sie erhalten eine SMS-Bestätigung.`]
              }
            }
          ]
        }
      };
    } else {
      return {
        fulfillmentResponse: {
          messages: [
            {
              text: {
                text: ['Kein Problem! Möchten Sie einen anderen Termin vereinbaren?']
              }
            }
          ]
        }
      };
    }

  } catch (error) {
    console.error('Error in confirm booking webhook:', error);
    throw error;
  }
}

module.exports = router;