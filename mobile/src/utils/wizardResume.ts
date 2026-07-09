import type { UserProfile } from "../api/profile";
import { getWizardStepNumber } from "../constants/wizardLabels";

export type WizardRoute =
  | "/(profile)/wizard/step-1"
  | "/(profile)/wizard/step-2"
  | "/(profile)/wizard/step-3"
  | "/(profile)/wizard/step-4"
  | "/(profile)/wizard/step-5"
  | "/(profile)/wizard/step-6"
  | "/(profile)/wizard/step-7"
  | "/(profile)/wizard/step-8"
  | "/(profile)/wizard/step-9"
  | "/(profile)/wizard/step-10"
  | "/(profile)/wizard/step-11"
  | "/(profile)/wizard/step-12"
  | "/(profile)/wizard/step-13"
  | "/(profile)/wizard/step-14"
  | "/(profile)/wizard/step-15"
  | "/(profile)/wizard/step-15b"
  | "/(profile)/wizard/step-16"
  | "/(profile)/wizard/step-17"
  | "/(profile)/wizard/step-18";

type WizardSequenceEntry = {
  stepNumber: number;
  route: WizardRoute;
};

function hasSupplementOther(supplementUse: string[]) {
  return supplementUse.includes("other");
}

function hasRealInjuryFlags(injuryFlags: string[]) {
  return injuryFlags.some((flag) => flag !== "none");
}

export function buildWizardResumeSequence(profile: Pick<UserProfile, "supplementUse" | "injuryFlags"> | null) {
  const supplementUse = profile?.supplementUse || [];
  const injuryFlags = profile?.injuryFlags || [];

  const sequence: WizardSequenceEntry[] = [
    { stepNumber: 1, route: "/(profile)/wizard/step-1" },
    { stepNumber: 2, route: "/(profile)/wizard/step-2" },
    { stepNumber: 3, route: "/(profile)/wizard/step-3" },
    { stepNumber: 4, route: "/(profile)/wizard/step-4" },
    { stepNumber: 5, route: "/(profile)/wizard/step-5" },
    { stepNumber: 6, route: "/(profile)/wizard/step-6" },
    { stepNumber: 7, route: "/(profile)/wizard/step-7" },
    { stepNumber: 8, route: "/(profile)/wizard/step-8" },
    { stepNumber: 9, route: "/(profile)/wizard/step-9" },
    { stepNumber: 10, route: "/(profile)/wizard/step-10" },
    { stepNumber: 11, route: "/(profile)/wizard/step-11" },
    { stepNumber: 12, route: "/(profile)/wizard/step-12" },
    { stepNumber: 13, route: "/(profile)/wizard/step-13" },
    { stepNumber: 14, route: "/(profile)/wizard/step-14" },
    { stepNumber: 15, route: "/(profile)/wizard/step-15" },
  ];

  if (hasSupplementOther(supplementUse)) {
    sequence.push({ stepNumber: 16, route: "/(profile)/wizard/step-15b" });
  }

  sequence.push({
    stepNumber: getWizardStepNumber(16, supplementUse),
    route: "/(profile)/wizard/step-16",
  });

  if (hasRealInjuryFlags(injuryFlags)) {
    sequence.push({
      stepNumber: getWizardStepNumber(17, supplementUse),
      route: "/(profile)/wizard/step-17",
    });
  }

  sequence.push({
    stepNumber: getWizardStepNumber(18, supplementUse),
    route: "/(profile)/wizard/step-18",
  });

  return sequence;
}

export function resolveWizardResumeRoute(profile: UserProfile | null): WizardRoute {
  if (!profile || !profile.lastCompletedStep || profile.lastCompletedStep <= 0) {
    return "/(profile)/wizard/step-1";
  }

  const sequence = buildWizardResumeSequence(profile);
  const nextEntry = sequence.find((entry) => entry.stepNumber > profile.lastCompletedStep);

  if (nextEntry) {
    return nextEntry.route;
  }

  return sequence[sequence.length - 1].route;
}
