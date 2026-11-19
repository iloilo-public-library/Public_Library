"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  HelpCircle,
  LogIn,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface MembershipModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STEPS = [
  {
    num: 1,
    title: "Go to the Iloilo City Public Library",
    desc: "Visit the Iloilo City Public Library — Dr. Graciano Lopez Jaena Learning Resource Center and Museum in person to begin your membership registration.",
    extra: { label: "Address:", value: "Arguelles-Fajardo Street, Jaro, Iloilo City" },
  },
  {
    num: 2,
    title: "Request a Membership Application Form",
    desc: "Approach the library staff at the front desk or information counter and ask for a membership application form. The staff will be happy to assist you.",
  },
  {
    num: 3,
    title: "Fill Out the Application Form",
    desc: "Carefully provide all required personal information accurately and completely. Make sure all fields are filled in correctly before proceeding.",
  },
  {
    num: 4,
    title: "Prepare Membership Requirements",
    desc: "Secure and bring the following documents and materials:",
    requirements: [
      "2 pieces of latest 1×1 ID picture",
      "Photocopy of any valid government-issued ID",
      "Proof of enrollment or school ID (if applicable)",
    ],
  },
  {
    num: 5,
    title: "Submit Application and Requirements",
    desc: "Submit the accomplished application form together with all the required documents to the library staff. Double-check that everything is complete before submission.",
  },
  {
    num: 6,
    title: "Proceed to Waiting Area",
    desc: "After submitting your application and requirements, proceed to the designated waiting area as directed by the library staff.",
  },
  {
    num: 7,
    title: "Wait for Your Name to be Called",
    desc: "Stay alert and listen for your name to be called by the library staff for identity verification or release of your membership card.",
  },
  {
    num: 8,
    title: "Claim Your Library Membership Card",
    desc: "Receive your official membership card and verify that all printed details are correct.",
    successNote: "You're now a registered library member!",
  },
];

export function MembershipModal({ open, onOpenChange }: MembershipModalProps) {
  const [panel, setPanel] = useState<"main" | "steps">("main");
  const [stepIndex, setStepIndex] = useState(0);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setTimeout(() => {
        setPanel("main");
        setStepIndex(0);
      }, 200);
    }
  };

  const step = STEPS[stepIndex];
  const pct = Math.round(((stepIndex + 1) / STEPS.length) * 100);
  const isLast = stepIndex === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="p-0">
        {panel === "main" ? (
          <div className="px-8 pb-7 pt-9 text-center">
            <div className="mx-auto mb-5 flex h-[68px] w-[68px] items-center justify-center rounded-[18px] border border-[#FFD700]/25 bg-[#FFD700]/8 text-[#FFD700] shadow-[0_0_28px_rgba(255,215,0,0.1)]">
              <AlertCircle className="h-8 w-8" />
            </div>
            <DialogTitle className="mb-2.5 text-[1.1rem] font-bold text-white">
              Library Membership Required
            </DialogTitle>
            <DialogDescription className="mb-6 text-[0.84rem] leading-[1.7] text-white/52">
              This feature is available to registered library members only. You need a valid Iloilo
              City Public Library membership card to access this.
            </DialogDescription>

            <div className="flex flex-col gap-2.5">
              <Button variant="accent" size="lg" className="w-full" asChild>
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  I&apos;m a Member — Log In
                </Link>
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => {
                  setPanel("steps");
                  setStepIndex(0);
                }}
              >
                <HelpCircle className="h-4 w-4" />
                How do I become a member?
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => handleClose(false)}
              >
                Maybe Later
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 border-b border-white/7 px-6 pb-4 pt-5">
              <button
                type="button"
                onClick={() => setPanel("main")}
                aria-label="Back"
                className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[10px] border border-white/10 bg-white/7 text-white/65 transition hover:bg-white/13 hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <DialogTitle className="text-[0.9rem] font-bold text-white">
                  How to Become a Member
                </DialogTitle>
                <DialogDescription className="text-[0.72rem] text-white/35">
                  Follow these steps to get your library card
                </DialogDescription>
              </div>
            </div>

            <div className="px-6 pt-4">
              <div className="h-1 overflow-hidden rounded bg-white/8">
                <motion.div
                  className="h-full rounded bg-gradient-to-r from-accent to-[#6aafde]"
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[0.67rem] font-semibold tracking-[0.04em] text-white/30">
                <span>
                  Step {stepIndex + 1} of {STEPS.length}
                </span>
                <span>{pct}%</span>
              </div>
            </div>

            <div className="min-h-[190px] px-6 pb-3 pt-5">
              <AnimatePresence mode="wait">
                <motion.div
                  key={step.num}
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22 }}
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-accent/22 bg-accent/12 text-[0.78rem] font-bold text-accent">
                    {step.num}
                  </div>
                  <h6
                    className={cn(
                      "mb-2 text-[0.95rem] font-bold leading-snug",
                      isLast ? "text-accent2" : "text-white"
                    )}
                  >
                    {step.title}
                  </h6>
                  <p className="text-[0.82rem] leading-[1.75] text-white/50">{step.desc}</p>

                  {step.extra && (
                    <p className="mt-3 text-[0.82rem]">
                      <strong className="text-white/65">{step.extra.label}</strong>{" "}
                      <span className="text-white/45">{step.extra.value}</span>
                    </p>
                  )}

                  {step.requirements && (
                    <ul className="mt-3 space-y-1.5 rounded-[11px] border border-white/6 bg-white/4 px-3.5 py-3">
                      {step.requirements.map((req) => (
                        <li
                          key={req}
                          className="flex items-start gap-2 text-[0.79rem] leading-relaxed text-white/55"
                        >
                          <span className="mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border border-accent2/30 bg-accent2/12 text-accent2">
                            <Check className="h-2.5 w-2.5" />
                          </span>
                          <span>{req}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {step.successNote && (
                    <p className="mt-3 text-[0.82rem] font-semibold text-accent2/85">
                      {step.successNote}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-2.5 border-t border-white/6 px-6 pb-5 pt-3.5">
              <div className="flex items-center gap-1.5">
                {STEPS.map((s, idx) => (
                  <span
                    key={s.num}
                    className={cn(
                      "h-1.5 rounded-full transition-all duration-300",
                      idx === stepIndex
                        ? "w-[18px] bg-accent"
                        : idx < stepIndex
                          ? "w-1.5 bg-accent2/55"
                          : "w-1.5 bg-white/18"
                    )}
                  />
                ))}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={stepIndex === 0}
                  onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Prev
                </Button>

                {!isLast ? (
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => setStepIndex((i) => Math.min(STEPS.length - 1, i + 1))}
                  >
                    Next
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="accent2" size="sm" onClick={() => handleClose(false)}>
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Got it!
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
