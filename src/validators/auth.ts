import { z } from "zod";
import { emailSchema, passwordSchema } from "@/validators/common";

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1, "Password is required.").max(128, "Password is too long."),
    captcha_token: z
      .string()
      .trim()
      .min(10, "CAPTCHA verification is required.")
      .max(512, "Invalid CAPTCHA verification token."),
  })
  .strict();

export const checkEmailQuerySchema = z
  .object({
    email: z.string().trim().toLowerCase().min(1, "Enter a valid email address.").max(255),
  })
  .strict();

export const signupSchema = z
  .object({
    firstname: z
      .string()
      .trim()
      .min(2, "First name and last name must each be at least 2 characters.")
      .max(64, "First name must be 64 characters or fewer."),
    lastname: z
      .string()
      .trim()
      .min(2, "First name and last name must each be at least 2 characters.")
      .max(64, "Last name must be 64 characters or fewer."),
    age: z.union([z.string(), z.number()]).optional(),
    gender: z.string().trim().max(20).optional().default(""),
    phone: z.string().trim().max(30).optional().default(""),
    phone_number: z.string().trim().max(30).optional(),
    school: z.string().trim().max(120).optional().default(""),
    city: z.string().trim().max(80).optional().default(""),
    province: z.string().trim().max(80).optional().default(""),
    education_level: z.string().trim().max(80).optional().default(""),
    occupation: z.string().trim().max(100).optional().default(""),
    is_government: z.union([z.boolean(), z.string(), z.number()]).optional().default(false),
    office_phone: z.string().trim().max(30).optional().default(""),
    valid_id_name: z.string().trim().max(480).optional().default(""),
    email: emailSchema,
    password: passwordSchema,
    confirm_password: z.string().optional(),
    role: z.enum(["user", "librarian", "admin"]).optional().default("user"),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.confirm_password !== undefined && data.password !== data.confirm_password) {
      ctx.addIssue({
        code: "custom",
        path: ["confirm_password"],
        message: "Password and Confirm Password do not match.",
      });
    }
    const isStaff = data.role === "admin" || data.role === "librarian";
    if (!isStaff) {
      if (!["Male", "Female", "Others"].includes(data.gender || "")) {
        ctx.addIssue({
          code: "custom",
          path: ["gender"],
          message: "Please select a gender (Male, Female, or Others).",
        });
      }
      const rawAge = data.age !== undefined && data.age !== null ? String(data.age).trim() : "";
      const numAge = Number(rawAge);
      if (!rawAge || !Number.isInteger(numAge) || numAge < 7 || numAge > 120) {
        ctx.addIssue({
          code: "custom",
          path: ["age"],
          message: "Please enter a valid whole-number age between 7 and 120.",
        });
      }
      const phoneStr = (data.phone || data.phone_number || "").trim();
      const digits = phoneStr.replace(/\D/g, "");
      if (!phoneStr || digits.length < 7 || digits.length > 15) {
        ctx.addIssue({
          code: "custom",
          path: ["phone"],
          message: "Please enter a valid phone number.",
        });
      }
    }
  });

export const pinCodeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "PIN must be exactly 6 digits.");

export const forgotPasswordSchema = z
  .object({
    action: z.literal("request"),
    email: emailSchema,
  })
  .strict();

export const confirmResetPasswordSchema = z
  .object({
    action: z.literal("confirm"),
    token: z.string().trim().min(16, "Invalid or missing reset token.").max(256),
    new_password: passwordSchema,
    confirm_password: z.string().min(1, "Please confirm your new password.").max(64),
  })
  .strict()
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords do not match.",
    path: ["confirm_password"],
  });

export const resetPasswordRequestSchema = z.discriminatedUnion("action", [
  forgotPasswordSchema,
  confirmResetPasswordSchema,
]);

export const forgotPinSchema = z
  .object({
    action: z.literal("request"),
    email: emailSchema,
  })
  .strict();

export const confirmResetPinSchema = z
  .object({
    action: z.literal("confirm"),
    token: z.string().trim().min(16, "Invalid or missing reset token.").max(256),
    pin: pinCodeSchema,
    confirm_pin: z.string().trim().min(1, "Please confirm your new PIN.").max(16),
  })
  .strict()
  .refine((d) => d.pin === d.confirm_pin, {
    message: "PINs do not match.",
    path: ["confirm_pin"],
  });

export const resetPinRequestSchema = z.discriminatedUnion("action", [
  forgotPinSchema,
  confirmResetPinSchema,
]);

export const qrGenerateSchema = z
  .object({
    action: z.literal("generate"),
  })
  .strict();

export const qrConfirmSchema = z
  .object({
    action: z.literal("confirm"),
    token: z.string().trim().min(16, "Invalid or missing QR token.").max(256),
  })
  .strict();

export const qrPostSchema = z.discriminatedUnion("action", [
  qrGenerateSchema,
  qrConfirmSchema,
]);

export const qrCheckQuerySchema = z
  .object({
    token: z.string().trim().min(16, "Invalid or missing QR token.").max(256),
  })
  .strict();

export const otpCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Verification code must be 6 characters.");

export const verifyCaptchaSchema = z
  .object({
    token: z.string().trim().min(10, "Invalid CAPTCHA challenge token.").max(512),
    answer: z.string().trim().min(1, "Please enter the CAPTCHA answer.").max(64),
  })
  .strict();

export const verifyOtpSchema = z
  .object({
    otp: otpCodeSchema,
  })
  .strict();

export const verifyPinSchema = z
  .object({
    pin: pinCodeSchema,
  })
  .strict();

export const resendOtpSchema = z.object({}).strict();

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordRequestSchema>;
export type ResetPinInput = z.infer<typeof resetPinRequestSchema>;
export type QrPostInput = z.infer<typeof qrPostSchema>;
