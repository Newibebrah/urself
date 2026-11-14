/**
 * Token counter using rough character counting.
 * DeepSeek typically charges ~1 token per ~4 characters of English text.
 * For UI prompts, a rough estimate is sufficient for quota tracking.
 * 
 * @param text - The text to count tokens for
 * @returns Estimated token count
 */
export function countTokens(text: string): number {
  if (!text || text.trim().length === 0) return 0;
  // Rough estimate: 1 token ≈ 4 characters for English text
  // Include a small buffer for special characters
  return Math.ceil(text.length / 4);
}

/**
 * Count tokens for both prompt and response.
 * 
 * @param prompt - The user's prompt
 * @param completion - The model's response/completion
 * @returns { promptTokens, completionTokens }
 */
export function countTokensBoth(prompt: string, completion: string): {
  promptTokens: number;
  completionTokens: number;
} {
  return {
    promptTokens: countTokens(prompt),
    completionTokens: countTokens(completion),
  };
}