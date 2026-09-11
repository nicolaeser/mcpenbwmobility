import type { LoginField } from "./fields.js";

export function loginFields(): readonly LoginField[] {
  return [
    {
      name: "email",
      label: "myEnergyKey email",
      type: "text",
      required: true,
      secret: true,
      envFallback: "ENBW_EMAIL",
      prompt: "if-missing",
      autocomplete: "username",
      placeholder: "you@example.com",
      help: "EnBW mobility+ / myEnergyKey account email."
    },
    {
      name: "password",
      label: "myEnergyKey password",
      type: "password",
      required: true,
      secret: true,
      envFallback: "ENBW_PASSWORD",
      prompt: "if-missing",
      autocomplete: "current-password",
      placeholder: "Password"
    }
  ];
}

export function credentialsFromBag(
  bag: { readonly secrets: Readonly<Record<string, string>> },
  env: { email?: string; password?: string }
): { email: string; password: string } | undefined {
  const email = (bag.secrets.email ?? env.email ?? "").trim();
  const password = bag.secrets.password ?? env.password ?? "";
  if (email.length === 0 || password.length === 0) return undefined;
  return { email, password };
}
