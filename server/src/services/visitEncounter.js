import { Visit } from '../models/Visit.js';
import { Payment } from '../models/Payment.js';
import { User } from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { VISIT_STATUS, PAYMENT_STATUS } from '../config/constants.js';

/**
 * Create an unpaid visit + consultation payment for a patient/doctor pair.
 * Optionally link to an appointment record.
 */
export async function createVisitWithPayment({ patient, doctor, appointmentId = null }) {
  const docUser = await User.findById(doctor).select('visitFee role').lean();
  if (!docUser || docUser.role !== ROLES.DOCTOR) {
    const err = new Error('Invalid doctor');
    err.statusCode = 400;
    throw err;
  }

  const visitFee = Number(docUser.visitFee) || 0;

  const visit = await Visit.create({
    patient,
    doctor,
    appointment: appointmentId || null,
    visit_status: VISIT_STATUS.SENT_TO_CASHIER,
    payment_status: PAYMENT_STATUS.UNPAID,
  });

  await Payment.create({
    visit: visit._id,
    amount: visitFee,
    status: PAYMENT_STATUS.UNPAID,
    charge_type: 'consultation',
  });

  return visit;
}

/** Return existing visit for an appointment, if any. */
export async function findVisitForAppointment(appointmentId) {
  return Visit.findOne({ appointment: appointmentId });
}
