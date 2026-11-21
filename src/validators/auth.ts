import { z } from "zod";
import { emailSchema, passwordSchema } from "@/validators/common";

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required."),
});

export const signupSchema = z.object({
  firstname: z.string().trim().min(2, "First name must be at least 2 characters."),
  lastname: z.string().trim().min(2, "Last name must be at least 2 characters."),
  email: emailSchema,
  password: passwordSchema,
  gender: z.string().trim().optional(),
  phone_number: z.string().trim().optional(),
});

export const pinCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "PIN must be exactly 6 digits.");

export const forgotPasswordSchema = z.object({
  action: z.literal("request"),
  email: emailSchema,
});

export const confirmResetPasswordSchema = z
  .object({
    action: z.literal("confirm"),
    token: z.string().trim().min(16, "Invalid or missing reset token."),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your new password."),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const resetPasswordRequestSchema = z.discriminatedUnion("action", [
  forgotPasswordSchema,
  confirmResetPasswordSchema,
]);

export const forgotPinSchema = z.object({
  action: z.literal("request"),
  email: emailSchema,
});

export const confirmResetPinSchema = z
  .object({
    action: z.literal("confirm"),
    token: z.string().trim().min(16, "Invalid or missing reset token."),
    pin: pinCodeSchema,
    confirm_pin: z.string().trim().min(1, "Please confirm your new PIN."),
  })
  .refine((d) => d.pin === d.confirm_pin, {
    message: "PINs do not match.",
    path: ["confirm_pin"],
  });

export const resetPinRequestSchema = z.discriminatedUnion("action", [
  forgotPinSchema,
  confirmResetPinSchema,
]);

export const qrGenerateSchema = z.object({
  action: z.literal("generate"),
});

export const qrConfirmSchema = z.object({
  action: z.literal("confirm"),
  token: z.string().trim().min(16, "Invalid or missing QR token."),
});

export const qrPostSchema = z.discriminatedUnion("action", [
  qrGenerateSchema,
  qrConfirmSchema,
]);

export const qrCheckQuerySchema = z.object({
  token: z.string().trim().min(16, "Invalid or missing QR token."),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPinInput = z.infer<typeof resetPinRequestSchema>;
export type QrPostInput = z.infer<typeof qrPostSchema>;
