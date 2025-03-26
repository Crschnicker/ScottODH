// Validate required fields
export const validateRequired = (value) => {
  return value && value.trim() !== '';
};

// Validate email format
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(String(email).toLowerCase());
};

// Validate phone number format
export const validatePhone = (phone) => {
  const re = /^\(?([0-9]{3})\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$/;
  return re.test(String(phone));
};

// Validate numeric value
export const validateNumeric = (value) => {
  return !isNaN(parseFloat(value)) && isFinite(value);
};

// Validate positive numeric value
export const validatePositiveNumber = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && isFinite(num) && num > 0;
};

// Validate date format (YYYY-MM-DD)
export const validateDateFormat = (date) => {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(date)) return false;
  
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  
  return d.toISOString().slice(0, 10) === date;
};

// Validate form data
export const validateForm = (data, validations) => {
  const errors = {};
  
  for (const field in validations) {
    if (validations.hasOwnProperty(field)) {
      const value = data[field];
      const validation = validations[field];
      
      if (validation.required && !validateRequired(value)) {
        errors[field] = validation.requiredMessage || 'This field is required';
      } else if (value && validation.validator && !validation.validator(value)) {
        errors[field] = validation.message || 'Invalid value';
      }
    }
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};
