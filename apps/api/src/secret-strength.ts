// Fuerza mínima de un secreto (JWT_SECRET, BACKUP_ENCRYPTION_KEY). Sin
// dependencias de Nest ni de la base: lo usan security.ts y el módulo de
// respaldos. Un secreto débil es el que se repite (aaaa…, abcabc…), tiene
// pocos símbolos distintos o poca entropía de Shannon, o es un texto de
// ejemplo.

/** Entropía de Shannon por carácter, en bits. */
export function shannonEntropy(secret: string): number {
  const frequencies = new Map<string, number>();
  for (const char of secret)
    frequencies.set(char, (frequencies.get(char) ?? 0) + 1);
  return [...frequencies.values()].reduce(
    (sum, n) => sum - (n / secret.length) * Math.log2(n / secret.length),
    0,
  );
}

/** El secreto es un bloque corto repetido (p. ej. «abcabcabc…»). */
export function isRepeated(secret: string): boolean {
  return Array.from(
    { length: Math.floor(secret.length / 2) },
    (_, i) => i + 1,
  ).some(
    (length) =>
      secret ===
      secret
        .slice(0, length)
        .repeat(Math.ceil(secret.length / length))
        .slice(0, secret.length),
  );
}

/**
 * Casi todo el secreto sube o baja de uno en uno (p. ej. «abcdefgh…»,
 * «1234…», «zyxw…»): cuenta como secuencia si al menos 70 % de los pasos lo es.
 */
export function isSequential(secret: string): boolean {
  const codes = [...secret].map((char) => char.codePointAt(0)!);
  const steps = codes.slice(1).map((code, i) => code - codes[i]);
  if (!steps.length) return false;
  const runs = steps.filter((step) => step === 1 || step === -1).length;
  return runs / steps.length >= 0.7;
}

const SAMPLE_WORDS =
  /replace|example|changeme|fitstore|nexora|secret-of|password|contrase|qwerty/i;

/**
 * Motivo por el que el secreto es demasiado simple, o null si pasa. Exige
 * al menos 12 símbolos distintos y 3,5 bits de entropía por carácter; así
 * una frase de 32 letras con palabras reales de un diccionario corto pasa
 * sólo si tiene variedad suficiente, y «aaaa…», «abcabc…» o «1234…» no.
 */
export function weakSecretReason(secret: string): string | null {
  const distinct = new Set(secret).size;
  if (isRepeated(secret)) return "se repite";
  if (isSequential(secret)) return "es una secuencia";
  if (SAMPLE_WORDS.test(secret)) return "contiene un texto de ejemplo";
  if (distinct < 12) return "tiene pocos caracteres distintos";
  if (shannonEntropy(secret) < 3.5) return "tiene poca entropía";
  return null;
}
