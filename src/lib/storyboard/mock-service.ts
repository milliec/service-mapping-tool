/**
 * MockStoryboardService — generates placeholder storyboard images
 * using an offscreen canvas. No API calls required.
 *
 * Used as a fallback when NEXT_PUBLIC_OPENAI_API_KEY is not set,
 * and for development/testing of the generation pipeline.
 */

import type { StoryboardGenerationService, StoryboardPromptContext } from './service';

// Muted colours that match the locked storyboard style palette
const PALETTE = [
  '#A8C4D8', // sky blue
  '#8FB896', // countryside green
  '#B8AFA0', // weathered grey
  '#D4C5A0', // sand
  '#C4A882', // stone
  '#D4A96A', // ochre
  '#C9A44C', // mustard
  '#B87C5A', // rust
] as const;

export class MockStoryboardService implements StoryboardGenerationService {
  async generateImage(context: StoryboardPromptContext): Promise<string> {
    // Simulate network delay (200–400ms)
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 200));

    // Pick a colour based on the frame index
    const bgColor = PALETTE[context.frameIndex % PALETTE.length];

    // Create an offscreen canvas at the DALL-E output size (1792x1024)
    const canvas = document.createElement('canvas');
    canvas.width = 1792;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');

    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw step title in the centre
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(context.stepTitle, canvas.width / 2, canvas.height / 2 - 30);

    // Draw stage title below
    ctx.font = '32px system-ui, sans-serif';
    ctx.globalAlpha = 0.7;
    ctx.fillText(context.stageTitle, canvas.width / 2, canvas.height / 2 + 30);
    ctx.globalAlpha = 1;

    // Draw "MOCK" label in corner
    ctx.font = '24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.globalAlpha = 0.4;
    ctx.fillText('MOCK IMAGE', 24, 24);
    ctx.globalAlpha = 1;

    // Return as base64 PNG (strip the data URL prefix — service returns raw base64)
    const dataUrl = canvas.toDataURL('image/png');
    return dataUrl.replace(/^data:image\/png;base64,/, '');
  }
}
