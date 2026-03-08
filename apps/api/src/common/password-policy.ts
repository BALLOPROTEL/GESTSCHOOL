export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{12,128}$/;
export const PASSWORD_POLICY_MESSAGE =
  "Le mot de passe doit contenir au moins 12 caracteres, une majuscule, une minuscule, un chiffre et un caractere special, sans espace.";

export function findPasswordPolicyViolation(password: string, username?: string): string | null {
  if (!PASSWORD_POLICY_REGEX.test(password)) {
    return PASSWORD_POLICY_MESSAGE;
  }

  const normalizedUsername = username?.trim().toLowerCase();
  if (!normalizedUsername) {
    return null;
  }

  const normalizedPassword = password.trim().toLowerCase();
  const identifier = normalizedUsername.split("@")[0] ?? normalizedUsername;
  const tokens = identifier.split(/[^a-z0-9]+/).filter((token) => token.length >= 4);

  for (const token of tokens) {
    if (normalizedPassword.includes(token)) {
      return "Le mot de passe ne doit pas contenir votre identifiant.";
    }
  }

  return null;
}
