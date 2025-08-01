const express = require('express');
const twilioService = require('../services/twilioService');

// TODO: Dialogflow integration temporarily disabled
// Uncomment when Dialogflow is properly configured
// const twilioDialogflowBridge = require('../dialogflow/webhooks/twilioDialogflowBridge');
// const dialogflowConfig = require('../dialogflow/config/dialogflowConfig');

const router = express.Router();

// Twilio webhook routes (no authentication required for webhooks)

/**
 * Twilio Voice webhook endpoint with enhanced call type support
 * POST /api/v1/twilio/voice/webhook?leadId=123&callLogId=456&callType=appointment_booking
 */
router.post('/voice/webhook', async (req, res) => {
  try {
    const { leadId, callLogId, callType = 'appointment_booking', useDialogflow } = req.query;
    
    console.log(`📞 Voice webhook called:`, {
      leadId,
      callLogId,
      callType,
      useDialogflow,
      from: req.body.From,
      to: req.body.To
    });

    // TODO: Uncomment when Dialogflow is configured
    // if (useDialogflow && dialogflowConfig.isConfigured() && process.env.ENABLE_DIALOGFLOW !== 'false') {
    //   // Use Dialogflow integration for intelligent conversation
    //   console.log('📞 Using Dialogflow integration');
    //   await twilioDialogflowBridge.handleVoiceWebhook(req, res);
    //   return;
    // }

    // Enhanced basic Twilio service with call type awareness
    console.log(`📞 Using basic Twilio service for ${callType} call`);
    await twilioService.handleVoiceWebhook(req, res);
    
  } catch (error) {
    console.error('Error in voice webhook:', error);
    
    // Fallback TwiML response
    const fallbackTwiML = twilioService.generateTwiML({
      message: 'Entschuldigung, es ist ein technischer Fehler aufgetreten. Ein Mitarbeiter wird sich bei Ihnen melden.'
    });
    
    res.type('text/xml');
    res.send(fallbackTwiML);
  }
});

/**
 * Twilio Voice gather endpoint (for collecting user input)
 * POST /api/v1/twilio/voice/gather
 * Note: This is now handled by the Dialogflow bridge in the main webhook
 */
router.post('/voice/gather', async (req, res) => {
  try {
    const { SpeechResult, Digits, CallSid } = req.body;
    
    console.log(`🎙️ Gather result for ${CallSid}: Speech="${SpeechResult}", Digits="${Digits}"`);
    
    // If Dialogflow is configured, this should be handled by the bridge
    if (dialogflowConfig.isConfigured() && process.env.ENABLE_DIALOGFLOW !== 'false') {
      // Re-route to voice webhook with gather data
      req.body.isGatherRequest = true;
      await twilioDialogflowBridge.handleVoiceWebhook(req, res);
      return;
    }
    
    // Fallback to basic gather handling
    let twimlResponse;
    
    if (Digits === '1') {
      // User pressed 1 for callback
      twimlResponse = twilioService.generateTwiML({
        message: 'Vielen Dank! Wir werden Sie in Kürze zurückrufen. Auf Wiederhören!'
      });
    } else if (SpeechResult && SpeechResult.length > 0) {
      // User spoke a message
      twimlResponse = twilioService.generateTwiML({
        message: `Vielen Dank für Ihre Nachricht: "${SpeechResult}". Wir werden uns bei Ihnen melden. Auf Wiederhören!`
      });
    } else {
      // No clear input received
      twimlResponse = twilioService.generateTwiML({
        message: 'Entschuldigung, ich habe Sie nicht verstanden. Vielen Dank für Ihren Anruf. Auf Wiederhören!'
      });
    }

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    console.error('Error in voice gather:', error);
    
    // Return basic TwiML response
    const twiml = twilioService.generateTwiML({
      message: 'Entschuldigung, es ist ein Fehler aufgetreten. Auf Wiederhören!'
    });
    
    res.type('text/xml');
    res.send(twiml);
  }
});

/**
 * Twilio call status callback endpoint
 * POST /api/v1/twilio/status/callback
 */
router.post('/status/callback', async (req, res) => {
  try {
    await twilioService.handleStatusCallback(req, res);
  } catch (error) {
    console.error('Error in status callback:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Twilio recording callback endpoint
 * POST /api/v1/twilio/recording/callback
 */
router.post('/recording/callback', async (req, res) => {
  try {
    await twilioService.handleRecordingCallback(req, res);
  } catch (error) {
    console.error('Error in recording callback:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Test TwiML generation endpoint (for development)
 * GET /api/v1/twilio/test-twiml?callType=cold_calling
 */
router.get('/test-twiml', (req, res) => {
  try {
    const { callType = 'appointment_booking' } = req.query;
    
    const callMessages = {
      'cold_calling': {
        message: 'Test: Cold Calling - Guten Tag! Wir haben gesehen, dass Sie sich für unsere Behandlung interessieren.',
        prompt: 'Drücken Sie 1 wenn Sie interessiert sind.'
      },
      'appointment_booking': {
        message: 'Test: Appointment Booking - Guten Tag! Möchten Sie einen Termin vereinbaren?',
        prompt: 'Drücken Sie 1 für einen Termin.'
      }
    };

    const messageConfig = callMessages[callType] || callMessages['appointment_booking'];
    
    const twimlResponse = twilioService.generateTwiML({
      message: messageConfig.message,
      gatherInput: {
        prompt: messageConfig.prompt
      }
    });

    res.type('text/xml');
    res.send(twimlResponse);

  } catch (error) {
    console.error('Error generating test TwiML:', error);
    res.status(500).send('Internal Server Error');
  }
});

/**
 * Test outbound call status endpoint (for development)
 * GET /api/v1/twilio/test-call-status
 */
router.get('/test-call-status', (req, res) => {
  try {
    res.json({
      message: 'Outbound calling system ready',
      features: {
        callTypes: ['cold_calling', 'appointment_booking'],
        dialogflowReady: false, // Set to true when Dialogflow is configured
        basicTwilioReady: true
      },
      testEndpoints: {
        testTwiML: '/api/v1/twilio/test-twiml?callType=cold_calling',
        initiateCall: 'POST /api/v1/leads/:id/call'
      }
    });
  } catch (error) {
    console.error('Error getting call status:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;