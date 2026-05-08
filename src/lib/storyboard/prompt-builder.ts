/**
 * Prompt builder for AI storyboard image generation.
 *
 * Constructs a DALL-E 3 prompt from two parts:
 * 1. A locked illustration style recipe (constant for every frame)
 * 2. A dynamic image brief built from the step's card data
 */

import type { StoryboardPromptContext } from './service';

// ---------------------------------------------------------------------------
// Part 1 — Locked storyboard illustration style (verbatim from designer)
// ---------------------------------------------------------------------------

// Compressed from ~3950 to ~2200 chars to stay within DALL-E 3's 4000-char
// prompt limit with room for the image brief. Preserves all creative direction.
const LOCKED_STYLE = `STYLE: Warm editorial illustration for a service-design storyboard. Calm, explanatory, human, approachable — not corporate, clinical, cartoonish or playful. Inspired by recycling, waste collection, manufacturing of materials, and everyday street/home use.

LINE WORK: Clean, deliberate drawn lines. Not loose, hand-sketched, watercolour or brushy.

COLOUR: Full colour required — never black-and-white, grayscale or monochrome. Muted palette of sky blues, countryside greens, weathered greys, sand and stone. Warm ochre/mustard/rust accents used sparingly. Safety colours restrained. Spring-time town-centre and light-industrial feel. No flat UI colours. Negative space is pure white.

TEXTURE: Subtle light paper/grain texture, even and consistent. No heavy noise, canvas, or brushstrokes. Soft tonal variation. Crafted, not photoreal or glossy.

LIGHTING: Soft, diffuse, ambient. Gentle shading for depth. No dramatic shadows or cinematic contrast.

COMPOSITION: Landscape, wide cinematic frame (~21:9). Main subject in central 60–70% of frame at eye level or working height. Balanced, observational — viewer is a quiet bystander. Breathing space at edges.

BACKGROUND: Pure white by default. No environmental fills, atmospheric colour fields or paper backdrops. Ground with cropped partial elements only (deck edge, table surface, railing) drawn as part of the illustration.

SIMPLICITY: Uncluttered. Only objects that support the focal activity. No duplicate artefacts. Empty space encouraged.

PEOPLE: Everyday professionals at work. Realistic, slightly simplified proportions. Natural unposed postures. Neutral or thoughtful expressions. PPE, uniforms, branding accurate but understated. Keep character appearance consistent across frames where a character recurs.

ENVIRONMENTS: Real-world waste and recycling settings — bins, bin lorries, waste treatment and recycling sites, waste exports. Atmospheric but specific, not over-detailed.

INTERFACES/DOCUMENTS: Simplified and illustrative. GOV.UK-inspired layouts. No dense text. Maps, charts and forms abstracted. Screens read instantly.

TEXT: Do not render any text, labels, captions, titles or interface text inside the image.

AVOID: cartoon proportions, exaggerated expressions, painterly/watercolour, dramatic lighting, technical UI line work, cluttered scenes, photoreal or glossy finishes.`;

// ---------------------------------------------------------------------------
// Diversity rotation — cycles through attributes across frames
// ---------------------------------------------------------------------------

const GENDER_ROTATION = ['female', 'male', 'female', 'male', 'female', 'male'] as const;
const ETHNICITY_ROTATION = [
  'White British',
  'South Asian',
  'Black British',
  'East Asian',
  'Mixed heritage',
  'Middle Eastern',
] as const;
const AGE_ROTATION = ['late 20s', 'early 40s', 'mid 50s', 'early 30s', 'late 40s', 'mid 20s'] as const;
const DISABILITY_FRAME = 3; // Frame index that gets a visible disability note

function getDiversityNote(frameIndex: number, totalFrames: number): string {
  const gender = GENDER_ROTATION[frameIndex % GENDER_ROTATION.length];
  const ethnicity = ETHNICITY_ROTATION[frameIndex % ETHNICITY_ROTATION.length];
  const age = AGE_ROTATION[frameIndex % AGE_ROTATION.length];

  let note = `${gender}, ${age}, ${ethnicity}`;

  // Add visible disability to one frame in the storyboard
  if (totalFrames > 1 && frameIndex === DISABILITY_FRAME % totalFrames) {
    note += '. This character uses a hearing aid (visible behind one ear)';
  }

  return note;
}

// ---------------------------------------------------------------------------
// Card data extraction helpers
// ---------------------------------------------------------------------------

function getCardsByLane(
  cards: StoryboardPromptContext['cards'],
  laneKey: string,
): string[] {
  return cards
    .filter((c) => c.laneKey === laneKey)
    .map((c) => [c.title, c.body].filter(Boolean).join(' — '))
    .filter(Boolean);
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '…';
}

// ---------------------------------------------------------------------------
// Main prompt builder
// ---------------------------------------------------------------------------

export function buildStoryboardPrompt(context: StoryboardPromptContext): string {
  const { stageTitle, stepTitle, cards, frameIndex, totalFrames } = context;

  // Extract card data by lane
  const actors = getCardsByLane(cards, 'actor');
  const actions = getCardsByLane(cards, 'user_action_event');
  const needs = getCardsByLane(cards, 'user_need');
  const painPoints = getCardsByLane(cards, 'pain_point');
  const touchpoints = getCardsByLane(cards, 'frontstage_touchpoint');
  const backstage = getCardsByLane(cards, 'backstage_process');
  const systems = getCardsByLane(cards, 'system');

  // Build PURPOSE from needs and pain points
  const purposeParts = [...needs, ...painPoints];
  const purpose = purposeParts.length > 0
    ? truncate(purposeParts.join('. '), 200)
    : `Show what happens during the "${stepTitle}" step of "${stageTitle}"`;

  // PRIMARY ROLE from actor cards
  const primaryRole = actors.length > 0
    ? truncate(actors[0], 100)
    : 'A service user or professional appropriate to this step';

  // CHARACTER NOTE
  const characterNote = actors.length > 0 && actors[0].length > 20
    ? truncate(actors[0], 150)
    : 'A new character appropriate to this step';

  // CORE ACTIVITY from user actions
  const coreActivity = actions.length > 0
    ? truncate(actions.join('. '), 200)
    : `Engaging with the "${stepTitle}" step of the service`;

  // SETTING from touchpoints
  const setting = touchpoints.length > 0
    ? truncate(touchpoints[0], 150)
    : `A setting appropriate to "${stageTitle}"`;

  // KEY ARTEFACTS from touchpoints, backstage, systems (max 3)
  const artefactSources = [...touchpoints.slice(1), ...backstage, ...systems];
  const artefacts = artefactSources.slice(0, 3).map((a) => truncate(a, 80));
  const artefactsList = artefacts.length > 0
    ? artefacts.map((a) => `* ${a}`).join('\n')
    : '* Objects relevant to this service step';

  // DIVERSITY NOTE
  const diversityNote = getDiversityNote(frameIndex, totalFrames);

  // Assemble the image brief
  const brief = `
--- IMAGE BRIEF FOR ${stageTitle} ---

Please create an image using the locked storyboard illustration style above. This is the image brief.

SERVICE STAGE:
${stageTitle} — ${stepTitle}

PURPOSE OF IMAGE:
${purpose}

PRIMARY ROLE:
${primaryRole}

CHARACTER NOTE:
${characterNote}

DIVERSITY NOTE:
${diversityNote}

CORE ACTIVITY:
${coreActivity}

SETTING:
${setting}

KEY ARTEFACTS:
${artefactsList}

THINGS TO AVOID:
* No text, labels or captions in the image
* No cluttered scenes with excessive detail
* No duplicate artefacts`;

  // Combine locked style + brief into the final prompt
  return `${LOCKED_STYLE}\n\n${brief.trim()}`;
}
