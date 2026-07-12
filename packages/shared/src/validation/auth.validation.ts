import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .email("Invalid email format")
  .max(254);

export const passwordPolicySchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[A-Z]/, "Password must include an uppercase English letter")
  .regex(/[a-z]/, "Password must include a lowercase English letter")
  .regex(/[0-9]/, "Password must include a number")
  .regex(/[^A-Za-z0-9]/, "Password must include a special character");

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordPolicySchema,
  name: z.string().trim().min(1).max(100),
  phone: z.string().trim().max(30).optional(),
  roleCode: z.string().trim().max(50).optional(),
  tenantCode: z.string().trim().max(50).optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(20).max(500),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20).max(500),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(500),
  password: passwordPolicySchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;