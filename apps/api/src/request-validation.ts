import { z } from "@fitstore/shared";

// Defensa adicional al límite HTTP: también cubre multipart, query y entradas
// validadas por separado (por ejemplo, cada venta de la cola sin conexión).
// Los límites específicos de cada operación siguen siendo más estrechos.
export const INPUT_LIMITS = {
  depth: 20,
  nodes: 100000,
  list: 1000,
  keys: 1000,
  keyLength: 200,
  text: 300000,
} as const;

function inputError(path: (string | number)[], message: string): never {
  throw new z.ZodError([{ code: "custom", path, message }]);
}

export function assertInputSize(input: unknown) {
  const pending = [{ value: input, path: [] as (string | number)[], depth: 0 }];
  let nodes = 0;
  while (pending.length) {
    const { value, path, depth } = pending.pop()!;
    if (++nodes > INPUT_LIMITS.nodes)
      inputError([], "superan el tamaño permitido");
    if (depth > INPUT_LIMITS.depth)
      inputError([], "superan la profundidad permitida");
    if (typeof value === "string" && value.length > INPUT_LIMITS.text)
      inputError(path, `admite como máximo ${INPUT_LIMITS.text} caracteres`);
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      if (value.length > INPUT_LIMITS.list)
        inputError(path, `admite como máximo ${INPUT_LIMITS.list} elementos`);
      for (let i = 0; i < value.length; i++)
        pending.push({ value: value[i], path: [...path, i], depth: depth + 1 });
    } else {
      const keys = Object.keys(value);
      if (keys.length > INPUT_LIMITS.keys)
        inputError(path, `admite como máximo ${INPUT_LIMITS.keys} campos`);
      for (const key of keys) {
        if (key.length > INPUT_LIMITS.keyLength)
          inputError(path, "contiene un nombre de campo demasiado largo");
        pending.push({
          value: (value as Record<string, unknown>)[key],
          path: [...path, key],
          depth: depth + 1,
        });
      }
    }
  }
}

const hardened = new WeakMap<z.ZodTypeAny, z.ZodTypeAny>();

// Zod elimina campos desconocidos por omisión. La API debe rechazarlos,
// incluidos objetos dentro de arrays, optional/default, unions y refinements.
// Se clona el esquema; nunca se altera el compartido con la web ni sus reglas
// de dinero. Sólo un passthrough explícito conserva campos para una segunda
// validación (el sobre de ventas/sync, no la venta que finalmente se guarda).
export function strictInputSchema<T extends z.ZodTypeAny>(schema: T): T {
  const cached = hardened.get(schema);
  if (cached) return cached as T;
  const def = { ...schema._def } as Record<string, any>;
  const child = (value: z.ZodTypeAny) => strictInputSchema(value);
  switch (def.typeName) {
    case "ZodObject": {
      const shape = Object.fromEntries(
        Object.entries((schema as unknown as z.AnyZodObject).shape).map(
          ([key, value]) => [key, child(value as z.ZodTypeAny)],
        ),
      );
      def.shape = () => shape;
      if (def.unknownKeys !== "passthrough") def.unknownKeys = "strict";
      def.catchall = child(def.catchall);
      break;
    }
    case "ZodArray":
      def.type = child(def.type);
      break;
    case "ZodEffects":
      def.schema = child(def.schema);
      break;
    case "ZodOptional":
    case "ZodNullable":
    case "ZodDefault":
    case "ZodCatch":
    case "ZodReadonly":
      def.innerType = child(def.innerType);
      break;
    case "ZodRecord":
      def.keyType = child(def.keyType);
      def.valueType = child(def.valueType);
      break;
    case "ZodUnion":
      def.options = def.options.map(child);
      break;
    case "ZodDiscriminatedUnion":
      def.options = def.options.map(child);
      def.optionsMap = new Map(
        [...def.optionsMap].map(([key, value]) => [
          key,
          child(value as z.ZodTypeAny),
        ]),
      );
      break;
    case "ZodIntersection":
      def.left = child(def.left);
      def.right = child(def.right);
      break;
    case "ZodTuple":
      def.items = def.items.map(child);
      if (def.rest) def.rest = child(def.rest);
      break;
    case "ZodLazy": {
      const getter = def.getter;
      def.getter = () => child(getter());
      break;
    }
    case "ZodBranded":
      def.type = child(def.type);
      break;
    case "ZodPipeline":
      def.in = child(def.in);
      def.out = child(def.out);
      break;
  }
  const result = new (schema.constructor as new (def: unknown) => T)(def);
  hardened.set(schema, result);
  return result;
}

export function parseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
): z.infer<T> {
  assertInputSize(input);
  return strictInputSchema(schema).parse(input);
}

export function safeParseInput<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown,
) {
  try {
    assertInputSize(input);
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error };
    throw error;
  }
  return strictInputSchema(schema).safeParse(input);
}

// Fechas de calendario: Date acepta 2026-02-31 y lo pasa a marzo; eso no es
// una fecha válida enviada por el cliente.
export const inputDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(value + "T12:00:00Z");
    return Number.isFinite(+date) && date.toISOString().slice(0, 10) === value;
  }, "debe ser una fecha válida AAAA-MM-DD");

// La query de Express puede contener arrays/objetos. Validar primero el tipo
// string impide que una lista repetida se convierta silenciosamente a número.
export const inputPage = (max = 1000000) =>
  z
    .string()
    .regex(/^\d{1,7}$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(max));
