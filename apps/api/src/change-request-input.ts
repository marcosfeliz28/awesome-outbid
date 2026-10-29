import { z } from "zod";

// Lo que escribe la persona. El estado y la autora nunca vienen del cuerpo: los pone el servidor.
export const changeRequestInput = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(2000),
});
