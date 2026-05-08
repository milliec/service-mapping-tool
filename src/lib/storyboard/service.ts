/**
 * Storyboard generation service interface.
 *
 * Implementations:
 * - OpenAIStoryboardService  — DALL-E 3 image generation (requires API key)
 * - MockStoryboardService    — canvas-generated placeholder (no API calls)
 */

// ---------------------------------------------------------------------------
// Context passed to the service for each frame
// ---------------------------------------------------------------------------

export interface StoryboardCardContext {
  laneKey: string;
  laneTitle: string;
  title: string;
  body: string;
}

export interface StoryboardPromptContext {
  stepTitle: string;
  stageTitle: string;
  serviceName: string;
  cards: StoryboardCardContext[];
  /** 0-based position of this frame in the current generation batch. */
  frameIndex: number;
  /** Total number of frames being generated in this batch. */
  totalFrames: number;
}

// ---------------------------------------------------------------------------
// Service interface
// ---------------------------------------------------------------------------

export interface StoryboardGenerationService {
  /**
   * Generate a single storyboard image for a given step context.
   * Returns a raw base64-encoded PNG string (NOT a data URL).
   * The caller is responsible for converting/resizing to the final format.
   */
  generateImage(context: StoryboardPromptContext): Promise<string>;
}
