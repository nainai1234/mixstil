export type VoiceQaDecision = 'approved' | 'needs_review' | 'rejected';

export type VoiceQaInput = {
  decision: VoiceQaDecision;
  reviewerId: string;
  scriptSafetyPassed?: boolean;
  pronunciationPassed?: boolean;
  rightsPassed?: boolean;
  commercialUseAllowed?: boolean;
  derivativeUseAllowed?: boolean;
  notes?: string;
};

export const validateVoiceQaInput = (input: VoiceQaInput) => {
  const errors: string[] = [];
  if (!['approved', 'needs_review', 'rejected'].includes(input.decision)) {
    errors.push('decision must be approved, needs_review, or rejected');
  }
  if (!input.reviewerId.trim()) errors.push('reviewerId is required');
  if (input.decision === 'approved') {
    if (!input.scriptSafetyPassed) errors.push('script_safety_not_passed');
    if (!input.pronunciationPassed) errors.push('pronunciation_not_passed');
    if (!input.rightsPassed) errors.push('rights_not_passed');
    if (!input.commercialUseAllowed) errors.push('commercial_use_not_allowed');
    if (!input.derivativeUseAllowed) errors.push('derivative_use_not_allowed');
  }
  return errors;
};

export const voiceQaStemUpdate = (input: VoiceQaInput) => {
  const approved = input.decision === 'approved';
  return {
    qaStatus: input.decision,
    commercialUseAllowed: approved && Boolean(input.commercialUseAllowed),
    derivativeUseAllowed: approved && Boolean(input.derivativeUseAllowed),
    qaNotes: input.notes?.trim()
      || (approved
        ? 'Voice QA approved for controlled published works.'
        : input.decision === 'rejected'
          ? 'Voice QA rejected.'
          : 'Voice QA remains in review.'),
  };
};
