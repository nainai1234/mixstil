import { validateVoiceQaInput, voiceQaStemUpdate } from './voiceQa';

const incompleteApproval = validateVoiceQaInput({
  decision: 'approved',
  reviewerId: 'user_alex',
  scriptSafetyPassed: true,
  pronunciationPassed: true,
  rightsPassed: false,
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
});

if (!incompleteApproval.includes('rights_not_passed')) {
  throw new Error('Voice QA must block approval when rights review has not passed.');
}

const previewOnlyApproval = validateVoiceQaInput({
  decision: 'approved',
  reviewerId: 'user_alex',
  scriptSafetyPassed: true,
  pronunciationPassed: true,
  rightsPassed: true,
  commercialUseAllowed: false,
  derivativeUseAllowed: true,
});

if (!previewOnlyApproval.includes('commercial_use_not_allowed')) {
  throw new Error('Voice QA must block approval when commercial use is not allowed.');
}

const completeApproval = {
  decision: 'approved' as const,
  reviewerId: 'user_alex',
  scriptSafetyPassed: true,
  pronunciationPassed: true,
  rightsPassed: true,
  commercialUseAllowed: true,
  derivativeUseAllowed: true,
  notes: 'Pronunciation, script safety, and rights passed.',
};

const completeErrors = validateVoiceQaInput(completeApproval);
if (completeErrors.length > 0) {
  throw new Error(`Complete voice QA approval should pass: ${completeErrors.join(', ')}`);
}

const approvedUpdate = voiceQaStemUpdate(completeApproval);
if (approvedUpdate.qaStatus !== 'approved' || !approvedUpdate.commercialUseAllowed || !approvedUpdate.derivativeUseAllowed) {
  throw new Error('Approved voice QA must make the stem export eligible.');
}

const rejectedUpdate = voiceQaStemUpdate({
  decision: 'rejected',
  reviewerId: 'user_alex',
  notes: 'Pronunciation failed.',
});

if (rejectedUpdate.qaStatus !== 'rejected' || rejectedUpdate.commercialUseAllowed || rejectedUpdate.derivativeUseAllowed) {
  throw new Error('Rejected voice QA must keep the stem blocked from export.');
}

console.log('Voice QA workflow validation passed.');
