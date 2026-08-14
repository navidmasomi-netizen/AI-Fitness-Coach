export function validateName(value: string): string | null {
  if (!value.trim()) {
    return "Full name is required.";
  }

  return null;
}

export function validateEmail(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Email is required.";
  }

  const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  if (!isValid) {
    return "Enter a valid email address.";
  }

  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) {
    return "Password is required.";
  }

  return null;
}
