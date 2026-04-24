export function validatePasswordConfirmation(nextPassword: string, confirmPassword: string) {
  return nextPassword === confirmPassword;
}
