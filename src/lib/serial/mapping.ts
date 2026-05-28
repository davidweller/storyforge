export interface SerialMappingChapterInput {
  ordinal: number;
  title: string;
  sceneIds: string[];
  estimatedWordCount: number;
  boundaryHookScore: number;
}

export interface SerialMappingValidationResult {
  valid: boolean;
  validationErrors: string[];
}

export function validateSerialMapping(
  chapters: SerialMappingChapterInput[],
  targetMin: number,
  targetMax: number,
  hardMax: number
): SerialMappingValidationResult {
  const validationErrors: string[] = [];
  if (targetMin <= 0 || targetMax <= 0 || hardMax <= 0) {
    validationErrors.push('targetMin, targetMax, and hardMax must be positive.');
  }
  if (targetMin > targetMax) {
    validationErrors.push('targetMin cannot exceed targetMax.');
  }
  if (targetMax > hardMax) {
    validationErrors.push('targetMax cannot exceed hardMax.');
  }

  chapters.forEach((chapter) => {
    if (chapter.sceneIds.length === 0) {
      validationErrors.push(`Chapter ${chapter.ordinal} has no scenes.`);
    }
    if (chapter.estimatedWordCount > hardMax) {
      validationErrors.push(
        `Chapter ${chapter.ordinal} exceeds hardMax (${chapter.estimatedWordCount} > ${hardMax}).`
      );
    }
    if (chapter.estimatedWordCount < Math.floor(targetMin / 2)) {
      validationErrors.push(
        `Chapter ${chapter.ordinal} is below minimum floor (${chapter.estimatedWordCount} < ${Math.floor(targetMin / 2)}).`
      );
    }
  });

  return { valid: validationErrors.length === 0, validationErrors };
}
