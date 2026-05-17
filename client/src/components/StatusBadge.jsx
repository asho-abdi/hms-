import { VISIT_STATUS, PAYMENT_STATUS, LAB_ORDER_STATUS } from '../constants/roles.js';

/** Saturated pastel chips for light theme */
const styles = {
  default: { bg: '#e2e8f0', color: '#475569' },
  primary: { bg: 'linear-gradient(135deg, #dbeafe, #e0e7ff)', color: '#3730a3' },
  success: { bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)', color: '#047857' },
  warning: { bg: 'linear-gradient(135deg, #fef3c7, #fde68a)', color: '#b45309' },
  danger: { bg: 'linear-gradient(135deg, #fee2e2, #fecaca)', color: '#b91c1c' },
  purple: { bg: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)', color: '#6b21a8' },
  cyan: { bg: 'linear-gradient(135deg, #cffafe, #a5f3fc)', color: '#0e7490' },
};

function mapVisitStatus(v) {
  switch (v) {
    case VISIT_STATUS.COMPLETED:
      return styles.success;
    case VISIT_STATUS.SENT_TO_CASHIER:
      return styles.warning;
    case VISIT_STATUS.PENDING_DOCTOR:
      return styles.primary;
    case VISIT_STATUS.LAB_REQUESTED:
      return styles.purple;
    case VISIT_STATUS.LAB_COMPLETED:
      return styles.cyan;
    default:
      return styles.default;
  }
}

function mapPaymentStatus(p) {
  switch (p) {
    case PAYMENT_STATUS.PAID:
      return styles.success;
    case PAYMENT_STATUS.UNPAID:
      return styles.danger;
    default:
      return styles.default;
  }
}

function mapLabStatus(s) {
  switch (s) {
    case LAB_ORDER_STATUS.COMPLETED:
      return styles.success;
    case LAB_ORDER_STATUS.IN_PROGRESS:
      return styles.primary;
    case LAB_ORDER_STATUS.PENDING:
      return styles.warning;
    default:
      return styles.default;
  }
}

function mapAppointmentStatus(s) {
  switch (s) {
    case 'SCHEDULED':
      return styles.primary;
    case 'CHECKED_IN':
      return styles.success;
    case 'CANCELLED':
      return styles.danger;
    default:
      return styles.default;
  }
}

export function StatusBadge({ type = 'visit', value, label }) {
  const text = label || value || '—';
  let palette = styles.default;
  if (type === 'visit') palette = mapVisitStatus(value);
  else if (type === 'payment') palette = mapPaymentStatus(value);
  else if (type === 'lab') palette = mapLabStatus(value);
  else if (type === 'appointment') palette = mapAppointmentStatus(value);

  return (
    <span
      className="status-badge"
      style={{
        background: palette.bg,
        color: palette.color,
      }}
    >
      {text.replace(/_/g, ' ')}
    </span>
  );
}
