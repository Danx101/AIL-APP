const dialogflowConfig = require('../config/dialogflowConfig');

/**
 * Response Builder
 * Utility class for building Dialogflow responses and TwiML
 */
class ResponseBuilder {
  constructor() {
    this.templates = dialogflowConfig.getResponseTemplates();
  }

  /**
   * Build a text response
   */
  buildTextResponse(text, parameters = {}) {
    return {
      fulfillmentText: this.replaceVariables(text, parameters),
      fulfillmentMessages: [
        {
          text: {
            text: [this.replaceVariables(text, parameters)]
          }
        }
      ]
    };
  }

  /**
   * Build a response with quick replies (for web/mobile)
   */
  buildQuickReplyResponse(text, quickReplies, parameters = {}) {
    return {
      fulfillmentText: this.replaceVariables(text, parameters),
      fulfillmentMessages: [
        {
          text: {
            text: [this.replaceVariables(text, parameters)]
          }
        },
        {
          quickReplies: {
            title: 'Wählen Sie eine Option:',
            quickReplies: quickReplies
          }
        }
      ]
    };
  }

  /**
   * Build a response with custom payload (for Twilio)
   */
  buildTwilioResponse(text, twilioOptions = {}, parameters = {}) {
    const response = {
      fulfillmentText: this.replaceVariables(text, parameters),
      fulfillmentMessages: [
        {
          text: {
            text: [this.replaceVariables(text, parameters)]
          }
        }
      ]
    };

    // Add Twilio-specific payload
    if (Object.keys(twilioOptions).length > 0) {
      response.fulfillmentMessages.push({
        payload: {
          twilio: twilioOptions
        }
      });
    }

    return response;
  }

  /**
   * Build welcome response with random variation
   */
  buildWelcomeResponse(leadName = null) {
    const welcomes = this.templates.WELCOME;
    const randomWelcome = welcomes[Math.floor(Math.random() * welcomes.length)];
    
    let text = randomWelcome;
    if (leadName) {
      text = `Guten Tag, ${leadName}! ` + randomWelcome.replace('Guten Tag! ', '');
    }

    return this.buildTextResponse(text);
  }

  /**
   * Build service selection response
   */
  buildServiceSelectionResponse() {
    const services = [
      'Abnehmen im Liegen - Behandlung',
      'Beratungsgespräch',
      'Probebehandlung'
    ];

    const askService = this.templates.ASK_SERVICE;
    const text = askService[Math.floor(Math.random() * askService.length)];

    return this.buildQuickReplyResponse(text, services);
  }

  /**
   * Build date selection response
   */
  buildDateSelectionResponse() {
    const askDate = this.templates.ASK_DATE;
    const text = askDate[Math.floor(Math.random() * askDate.length)];

    const quickReplies = [
      'Heute',
      'Morgen',
      'Übermorgen',
      'Nächste Woche'
    ];

    return this.buildQuickReplyResponse(text, quickReplies);
  }

  /**
   * Build time selection response
   */
  buildTimeSelectionResponse(availableSlots = []) {
    const askTime = this.templates.ASK_TIME;
    const text = askTime[Math.floor(Math.random() * askTime.length)];

    const quickReplies = availableSlots.length > 0 
      ? availableSlots.slice(0, 4) // Show first 4 available slots
      : ['Vormittags', 'Nachmittags', 'Abends'];

    return this.buildQuickReplyResponse(text, quickReplies);
  }

  /**
   * Build appointment confirmation response
   */
  buildConfirmationResponse(appointmentDetails) {
    const confirmTemplates = this.templates.CONFIRM_APPOINTMENT;
    const template = confirmTemplates[Math.floor(Math.random() * confirmTemplates.length)];

    const text = this.replaceVariables(template, appointmentDetails);
    const quickReplies = ['Ja, bestätigen', 'Nein, anderen Termin'];

    return this.buildQuickReplyResponse(text, quickReplies);
  }

  /**
   * Build appointment confirmed response
   */
  buildAppointmentConfirmedResponse(appointmentDetails) {
    const confirmedTemplates = this.templates.APPOINTMENT_CONFIRMED;
    const template = confirmedTemplates[Math.floor(Math.random() * confirmedTemplates.length)];

    const text = this.replaceVariables(template, appointmentDetails);

    return this.buildTwilioResponse(text, {
      action: 'end_call',
      message: 'appointment_confirmed'
    });
  }

  /**
   * Build no availability response
   */
  buildNoAvailabilityResponse(alternatives = []) {
    const noAvailTemplates = this.templates.NO_AVAILABILITY;
    const template = noAvailTemplates[Math.floor(Math.random() * noAvailTemplates.length)];

    let text = template;
    if (alternatives.length > 0) {
      text += ` Verfügbare Alternativen: ${alternatives.join(', ')}`;
    }

    const quickReplies = alternatives.length > 0 
      ? alternatives.slice(0, 3)
      : ['Anderen Tag vorschlagen', 'Zurückrufen lassen'];

    return this.buildQuickReplyResponse(text, quickReplies);
  }

  /**
   * Build fallback response
   */
  buildFallbackResponse(context = null) {
    const fallbackResponses = [
      'Entschuldigung, das habe ich nicht verstanden. Können Sie das bitte wiederholen?',
      'Könnten Sie das anders formulieren? Ich bin nicht sicher, was Sie meinen.',
      'Das verstehe ich leider nicht. Möchten Sie einen Termin vereinbaren?'
    ];

    let text = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];

    // Add context-specific help
    if (context === 'appointment_booking') {
      text += ' Sagen Sie mir einfach, wann Sie einen Termin möchten.';
    } else if (context === 'service_selection') {
      text += ' Welche Behandlung interessiert Sie?';
    }

    return this.buildTextResponse(text);
  }

  /**
   * Build error response
   */
  buildErrorResponse(error = null) {
    const errorResponses = [
      'Entschuldigung, es ist ein technisches Problem aufgetreten. Bitte versuchen Sie es erneut.',
      'Es gab einen Fehler bei der Verarbeitung. Können wir noch einmal von vorne beginnen?',
      'Leider ist ein Fehler aufgetreten. Möchten Sie es noch einmal versuchen?'
    ];

    const text = errorResponses[Math.floor(Math.random() * errorResponses.length)];

    return this.buildTwilioResponse(text, {
      action: 'transfer_to_human',
      reason: 'system_error'
    });
  }

  /**
   * Build end conversation response
   */
  buildEndConversationResponse(reason = 'completed') {
    const endResponses = {
      completed: [
        'Vielen Dank für Ihren Anruf! Auf Wiederhören.',
        'Haben Sie noch einen schönen Tag! Auf Wiederhören.',
        'Bis bald! Auf Wiederhören.'
      ],
      transfer: [
        'Ich verbinde Sie mit einem Mitarbeiter. Einen Moment bitte.',
        'Ein Kollege wird sich um Ihr Anliegen kümmern. Bitte bleiben Sie dran.'
      ],
      timeout: [
        'Da Sie nicht geantwortet haben, beende ich das Gespräch. Rufen Sie gerne wieder an!',
        'Das Gespräch wird beendet. Vielen Dank und auf Wiederhören!'
      ]
    };

    const responses = endResponses[reason] || endResponses.completed;
    const text = responses[Math.floor(Math.random() * responses.length)];

    return this.buildTwilioResponse(text, {
      action: 'end_call',
      reason: reason
    });
  }

  /**
   * Replace variables in text with actual values
   */
  replaceVariables(text, parameters) {
    let result = text;
    
    for (const [key, value] of Object.entries(parameters)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }

    return result;
  }

  /**
   * Build response for collecting contact information
   */
  buildContactInfoResponse(missingInfo = []) {
    if (missingInfo.includes('name')) {
      return this.buildTextResponse('Bevor ich einen Termin vereinbaren kann, wie ist Ihr Name?');
    }
    
    if (missingInfo.includes('phone')) {
      return this.buildTextResponse('Unter welcher Telefonnummer kann ich Sie erreichen?');
    }

    if (missingInfo.includes('email')) {
      return this.buildTextResponse('Möchten Sie auch Ihre E-Mail-Adresse hinterlassen?');
    }

    return this.buildTextResponse('Vielen Dank für Ihre Angaben. Jetzt können wir einen Termin vereinbaren.');
  }
}

module.exports = new ResponseBuilder();