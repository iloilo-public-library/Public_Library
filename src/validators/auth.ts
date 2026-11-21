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

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
