// Format currency values
export const formatCurrency = (value) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2
  }).format(value);
};

// Format date values
export const formatDate = (dateString) => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
};

// Format job number
export const formatJobNumber = (date, count) => {
  const month = date.toLocaleString('en-US', { month: 'short' }).substring(0, 1);
  const year = date.getFullYear().toString().substring(2);
  const paddedCount = count.toString().padStart(2, '0');
  
  return `${month}${paddedCount}${year}`;
};

// Calculate total for line items
export const calculateLineItemTotal = (item) => {
  return (item.price * item.quantity) + item.hardware;
};

// Calculate labor cost
export const calculateLaborCost = (hours) => {
  const laborRate = 47.02; // $47.02 per hour
  return hours * laborRate;
};

// Format phone number
export const formatPhoneNumber = (phoneNumberString) => {
  let cleaned = ('' + phoneNumberString).replace(/\D/g, '');
  
  if (cleaned.length === 10) {
    return `(${cleaned.substring(0, 3)}) ${cleaned.substring(3, 6)}-${cleaned.substring(6, 10)}`;
  } else if (cleaned.length > 10) {
    return `+${cleaned.substring(0, 1)} (${cleaned.substring(1, 4)}) ${cleaned.substring(4, 7)}-${cleaned.substring(7, 11)}`;
  }
  
  return phoneNumberString;
};
