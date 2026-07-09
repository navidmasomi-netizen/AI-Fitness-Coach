import { useState } from "react";
import { ApiError } from "../api/client";
import { patchProfile } from "../api/profile";

const DEFAULT_SAVE_ERROR = "Couldn't save. Check your connection and try again.";

export function useWizardStepSave() {
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const saveStep = async (fields: Record<string, unknown>, lastCompletedStep: number) => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await patchProfile({
        ...fields,
        lastCompletedStep,
      });
      return true;
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage(DEFAULT_SAVE_ERROR);
      }
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isSaving,
    errorMessage,
    saveStep,
  };
}
