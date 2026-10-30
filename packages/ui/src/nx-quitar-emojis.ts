// Quita emojis y símbolos pictográficos; conserva letras con acento y la ñ.
const EMOJI =
  /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\u200D|\uFE0F/gu;

export function quitarEmojis(s: string): string {
  return s.replace(EMOJI, "");
}
