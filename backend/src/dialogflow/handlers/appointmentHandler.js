const Appointment = require('../../models/Appointment');
const Lead = require('../../models/Lead');
const Studio = require('../../models/Studio');
const dialogflowConfig = require('../config/dialogflowConfig');

/**
 * Appointment Handler
 * Handles appointment-related intents and business logic
 */
class AppointmentHandler {
  constructor() {
    this.intents = dialogflowConfig.getIntentNames();
    this.contexts = dialogflowConfig.getContexts();
  }

  /**
   * Handle appointment booking intent
   */
  async handleBookAppointment(sessionId, parameters, leadId, studioId) {
    try {
      const { date, time, serviceType } = parameters;
      
      // Validate required parameters
      if (!date || !time) {
        return {
          fulfillmentText: 'Um einen Termin zu vereinbaren, benötige ich das Datum und die Uhrzeit. Wann hätten Sie gerne einen Termin?',
          parameters: { missingInfo: ['date', 'time'] }
        };
      }

      // Check if we have a valid lead
      if (!leadId) {
        return {
          fulfillmentText: 'Bevor ich einen Termin vereinbaren kann, benötige ich Ihre Kontaktdaten. Wie ist Ihr Name?',
          parameters: { needsContactInfo: true }
        };
      }

      // Parse date and time
      const appointmentDate = this.parseDate(date);
      const appointmentTime = this.parseTime(time);

      if (!appointmentDate || !appointmentTime) {
        return {
          fulfillmentText: 'Das Datum oder die Uhrzeit konnte ich nicht verstehen. Können Sie das bitte wiederholen?',
          parameters: { invalidDateTime: true }
        };
      }

      // Check availability
      const isAvailable = await this.checkAvailability(
        studioId, 
        appointmentDate, 
        appointmentTime.start, 
        appointmentTime.end
      );

      if (!isAvailable) {
        const alternatives = await this.suggestAlternativeTimes(studioId, appointmentDate);
        return {
          fulfillmentText: `Leider ist dieser Termin bereits vergeben. Hätten Sie Zeit am ${alternatives.join(' oder ')}?`,
          parameters: { 
            unavailable: true,
            alternatives: alternatives
          }
        };
      }

      // Create appointment
      const appointment = new Appointment({
        studio_id: studioId,
        customer_id: leadId, // Lead will be converted to customer
        appointment_date: appointmentDate,
        start_time: appointmentTime.start,
        end_time: appointmentTime.end,
        status: 'pending',
        notes: `Gebucht über Dialogflow CX - Session: ${sessionId}`,
        created_by_user_id: 1 // System user, could be made configurable
      });

      const appointmentId = await appointment.create();

      // Update lead status
      const lead = await Lead.findById(leadId);
      if (lead) {
        await lead.updateStatus('appointment_scheduled', 'Termin vereinbart über automatischen Anruf');
      }

      return {
        fulfillmentText: `Perfekt! Ich habe einen Termin für Sie am ${this.formatDate(appointmentDate)} um ${appointmentTime.start} Uhr vorgemerkt. Möchten Sie diesen Termin bestätigen?`,
        parameters: {
          appointmentId: appointmentId,
          appointmentDate: appointmentDate,
          appointmentTime: appointmentTime.start,
          serviceType: serviceType,
          needsConfirmation: true
        }
      };

    } catch (error) {
      console.error('Error handling book appointment:', error);
      return {
        fulfillmentText: 'Entschuldigung, bei der Terminbuchung ist ein Fehler aufgetreten. Können Sie es bitte erneut versuchen?',
        parameters: { error: true }
      };
    }
  }

  /**
   * Handle appointment confirmation
   */
  async handleConfirmBooking(sessionId, parameters, confirmed) {
    try {
      const { appointmentId } = parameters;

      if (!appointmentId) {
        return {
          fulfillmentText: 'Es scheint, als hätten wir keinen Termin zum Bestätigen. Möchten Sie einen neuen Termin vereinbaren?',
          parameters: { noAppointmentToConfirm: true }
        };
      }

      if (confirmed) {
        // Update appointment status to confirmed
        const appointment = await Appointment.findById(appointmentId);
        if (appointment) {
          appointment.status = 'confirmed';
          await appointment.update();

          return {
            fulfillmentText: 'Vielen Dank! Ihr Termin ist jetzt bestätigt. Sie erhalten eine SMS-Bestätigung mit allen Details. Wir freuen uns auf Ihren Besuch!',
            parameters: { 
              confirmed: true,
              appointmentId: appointmentId
            }
          };
        }
      } else {
        // Cancel the appointment
        const appointment = await Appointment.findById(appointmentId);
        if (appointment) {
          await appointment.delete();
        }

        return {
          fulfillmentText: 'Kein Problem! Der Termin wurde nicht bestätigt. Möchten Sie einen anderen Zeitpunkt vereinbaren?',
          parameters: { 
            cancelled: true,
            needsNewAppointment: true
          }
        };
      }

    } catch (error) {
      console.error('Error handling confirm booking:', error);
      return {
        fulfillmentText: 'Bei der Bestätigung ist ein Fehler aufgetreten. Können Sie bitte noch einmal bestätigen?',
        parameters: { error: true }
      };
    }
  }

  /**
   * Handle availability check
   */
  async handleCheckAvailability(sessionId, parameters, studioId) {
    try {
      const { date, time } = parameters;

      if (!date) {
        return {
          fulfillmentText: 'Für welchen Tag möchten Sie die Verfügbarkeit prüfen?',
          parameters: { needsDate: true }
        };
      }

      const appointmentDate = this.parseDate(date);
      if (!appointmentDate) {
        return {
          fulfillmentText: 'Das Datum konnte ich nicht verstehen. Können Sie es bitte wiederholen?',
          parameters: { invalidDate: true }
        };
      }

      const availableSlots = await this.getAvailableSlots(studioId, appointmentDate);

      if (availableSlots.length === 0) {
        return {
          fulfillmentText: `Am ${this.formatDate(appointmentDate)} haben wir leider keine freien Termine. Würde ein anderer Tag passen?`,
          parameters: { noAvailability: true }
        };
      }

      const slotsText = availableSlots.slice(0, 3).join(', '); // Show first 3 slots
      return {
        fulfillmentText: `Am ${this.formatDate(appointmentDate)} haben wir freie Termine um ${slotsText}. Welche Uhrzeit würde Ihnen passen?`,
        parameters: { 
          availableSlots: availableSlots,
          date: appointmentDate
        }
      };

    } catch (error) {
      console.error('Error checking availability:', error);
      return {
        fulfillmentText: 'Bei der Verfügbarkeitsprüfung ist ein Fehler aufgetreten. Können Sie es bitte erneut versuchen?',
        parameters: { error: true }
      };
    }
  }

  /**
   * Check if appointment slot is available
   */
  async checkAvailability(studioId, date, startTime, endTime) {
    try {
      return !(await Appointment.checkConflicts(studioId, date, startTime, endTime));
    } catch (error) {
      console.error('Error checking availability:', error);
      return false;
    }
  }

  /**
   * Get available time slots for a specific date
   */
  async getAvailableSlots(studioId, date) {
    try {
      // Get studio business hours (would be configurable per studio)
      const businessHours = {
        start: '09:00',
        end: '18:00',
        slotDuration: 60 // minutes
      };

      const slots = [];
      let currentTime = this.parseTime(businessHours.start);
      const endTime = this.parseTime(businessHours.end);

      while (currentTime.minutes < endTime.minutes) {
        const slotStart = this.formatTime(currentTime);
        const slotEnd = this.formatTime({
          hours: currentTime.hours,
          minutes: currentTime.minutes + businessHours.slotDuration
        });

        // Check if slot is available
        const isAvailable = await this.checkAvailability(studioId, date, slotStart, slotEnd);
        if (isAvailable) {
          slots.push(slotStart);
        }

        // Move to next slot
        currentTime.minutes += businessHours.slotDuration;
        if (currentTime.minutes >= 60) {
          currentTime.hours += Math.floor(currentTime.minutes / 60);
          currentTime.minutes = currentTime.minutes % 60;
        }
      }

      return slots;
    } catch (error) {
      console.error('Error getting available slots:', error);
      return [];
    }
  }

  /**
   * Suggest alternative appointment times
   */
  async suggestAlternativeTimes(studioId, originalDate) {
    try {
      const alternatives = [];
      
      // Check next 7 days
      for (let i = 1; i <= 7; i++) {
        const date = new Date(originalDate);
        date.setDate(date.getDate() + i);
        
        const availableSlots = await this.getAvailableSlots(studioId, date.toISOString().split('T')[0]);
        if (availableSlots.length > 0) {
          alternatives.push(`${this.formatDate(date.toISOString().split('T')[0])} um ${availableSlots[0]} Uhr`);
          
          if (alternatives.length >= 3) break; // Limit to 3 alternatives
        }
      }

      return alternatives;
    } catch (error) {
      console.error('Error suggesting alternatives:', error);
      return ['morgen', 'übermorgen'];
    }
  }

  /**
   * Parse date string to YYYY-MM-DD format
   */
  parseDate(dateString) {
    try {
      // Handle various date formats from Dialogflow
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return null;
      }
      return date.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  }

  /**
   * Parse time string to start/end times
   */
  parseTime(timeString) {
    try {
      // Handle time formats like "14:30", "2:30 PM", etc.
      const timeMatch = timeString.match(/(\d{1,2}):(\d{2})/);
      if (!timeMatch) {
        return null;
      }

      const hours = parseInt(timeMatch[1]);
      const minutes = parseInt(timeMatch[2]);

      return {
        start: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        end: `${(hours + 1).toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        hours: hours,
        minutes: hours * 60 + minutes
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('de-DE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * Format time object to HH:MM string
   */
  formatTime(timeObj) {
    return `${timeObj.hours.toString().padStart(2, '0')}:${(timeObj.minutes % 60).toString().padStart(2, '0')}`;
  }
}

module.exports = new AppointmentHandler();