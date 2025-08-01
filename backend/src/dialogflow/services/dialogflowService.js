const dialogflowConfig = require('../config/dialogflowConfig');
const { v4: uuidv4 } = require('uuid');
const { struct } = require('pb-util');

/**
 * Dialogflow CX Service
 * Core service for interacting with Dialogflow CX API
 */
class DialogflowService {
  constructor() {
    this.config = dialogflowConfig;
    this.sessions = new Map(); // Track active sessions
  }

  /**
   * Detect intent from text input
   */
  async detectIntentText(sessionId, text, contextParameters = {}) {
    if (!this.config.isConfigured()) {
      throw new Error('Dialogflow CX is not configured');
    }

    try {
      const sessionsClient = this.config.getSessionsClient();
      const sessionPath = this.config.getSessionPath(sessionId);

      const request = {
        session: sessionPath,
        queryInput: {
          text: {
            text: text
          },
          languageCode: this.config.languageCode
        },
        queryParams: {
          parameters: struct.encode(contextParameters)
        }
      };

      const [response] = await sessionsClient.detectIntent(request);
      return this.processResponse(response);

    } catch (error) {
      console.error('Error detecting intent:', error);
      throw new Error(`Failed to detect intent: ${error.message}`);
    }
  }

  /**
   * Detect intent from audio input (for Twilio integration)
   */
  async detectIntentAudio(sessionId, audioBuffer, audioConfig, contextParameters = {}) {
    if (!this.config.isConfigured()) {
      throw new Error('Dialogflow CX is not configured');
    }

    try {
      const sessionsClient = this.config.getSessionsClient();
      const sessionPath = this.config.getSessionPath(sessionId);

      const request = {
        session: sessionPath,
        queryInput: {
          audio: {
            config: {
              audioEncoding: audioConfig.encoding || 'AUDIO_ENCODING_MULAW',
              sampleRateHertz: audioConfig.sampleRate || 8000,
              languageCode: this.config.languageCode
            },
            audio: audioBuffer
          }
        },
        queryParams: {
          parameters: struct.encode(contextParameters)
        }
      };

      const [response] = await sessionsClient.detectIntent(request);
      return this.processResponse(response);

    } catch (error) {
      console.error('Error detecting intent from audio:', error);
      throw new Error(`Failed to detect intent from audio: ${error.message}`);
    }
  }

  /**
   * Process Dialogflow response
   */
  processResponse(response) {
    const queryResult = response.queryResult;
    
    const processedResponse = {
      sessionId: response.sessionId,
      text: queryResult.text,
      intent: {
        displayName: queryResult.intent?.displayName || 'Unknown',
        confidence: queryResult.intentDetectionConfidence || 0
      },
      parameters: struct.decode(queryResult.parameters),
      responseMessages: [],
      currentPage: queryResult.currentPage?.displayName || 'Unknown',
      webhookPayloads: queryResult.webhookPayloads || [],
      diagnosticInfo: struct.decode(queryResult.diagnosticInfo || {})
    };

    // Process response messages
    if (queryResult.responseMessages) {
      queryResult.responseMessages.forEach(message => {
        if (message.text) {
          processedResponse.responseMessages.push({
            type: 'text',
            text: message.text.text[0]
          });
        } else if (message.payload) {
          processedResponse.responseMessages.push({
            type: 'payload',
            payload: struct.decode(message.payload)
          });
        }
      });
    }

    return processedResponse;
  }

  /**
   * Create or get session for a phone number
   */
  createSession(phoneNumber, leadId = null) {
    const sessionId = `phone-${phoneNumber}-${uuidv4()}`;
    
    this.sessions.set(sessionId, {
      phoneNumber,
      leadId,
      startTime: new Date(),
      lastActivity: new Date()
    });

    return sessionId;
  }

  /**
   * Get session info
   */
  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * End session
   */
  endSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  /**
   * Clean up inactive sessions (call periodically)
   */
  cleanupInactiveSessions(maxInactivityMinutes = 30) {
    const now = new Date();
    const maxInactivityMs = maxInactivityMinutes * 60 * 1000;

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactivityMs = now - session.lastActivity;
      if (inactivityMs > maxInactivityMs) {
        console.log(`Cleaning up inactive session: ${sessionId}`);
        this.sessions.delete(sessionId);
      }
    }
  }

  /**
   * Send event to Dialogflow (e.g., WELCOME event)
   */
  async sendEvent(sessionId, eventName, parameters = {}) {
    if (!this.config.isConfigured()) {
      throw new Error('Dialogflow CX is not configured');
    }

    try {
      const sessionsClient = this.config.getSessionsClient();
      const sessionPath = this.config.getSessionPath(sessionId);

      const request = {
        session: sessionPath,
        queryInput: {
          event: {
            event: eventName
          },
          languageCode: this.config.languageCode
        },
        queryParams: {
          parameters: struct.encode(parameters)
        }
      };

      const [response] = await sessionsClient.detectIntent(request);
      return this.processResponse(response);

    } catch (error) {
      console.error('Error sending event:', error);
      throw new Error(`Failed to send event: ${error.message}`);
    }
  }

  /**
   * Match intent from user input (for testing)
   */
  async matchIntent(text) {
    if (!this.config.isConfigured()) {
      throw new Error('Dialogflow CX is not configured');
    }

    try {
      const intentsClient = this.config.getIntentsClient();
      const agentPath = this.config.getAgentPath();

      // List all intents
      const [intents] = await intentsClient.listIntents({
        parent: agentPath
      });

      // Simple matching logic (in production, use ML-based matching)
      const normalizedText = text.toLowerCase();
      let bestMatch = null;
      let bestScore = 0;

      for (const intent of intents) {
        // Check training phrases
        if (intent.trainingPhrases) {
          for (const phrase of intent.trainingPhrases) {
            const phraseText = phrase.parts.map(p => p.text).join('').toLowerCase();
            if (normalizedText.includes(phraseText) || phraseText.includes(normalizedText)) {
              const score = phraseText.length / Math.abs(phraseText.length - normalizedText.length + 1);
              if (score > bestScore) {
                bestScore = score;
                bestMatch = intent;
              }
            }
          }
        }
      }

      return bestMatch;

    } catch (error) {
      console.error('Error matching intent:', error);
      throw new Error(`Failed to match intent: ${error.message}`);
    }
  }

  /**
   * Get conversation transcript
   */
  async getConversationTranscript(sessionId) {
    // This would typically fetch from a conversation history store
    // For now, return a placeholder
    return {
      sessionId,
      messages: [],
      startTime: this.sessions.get(sessionId)?.startTime,
      endTime: new Date()
    };
  }
}

module.exports = new DialogflowService();