import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

const gv = readFileSync("apps/web/src/Gv.tsx", "utf8");

it("EnrollmentForm permite cambiar el curso de una inscripción existente", () => {
  expect(gv).toMatch(/import \{ cursosDestino \} from "\.\/gvCursos"/);
  expect(gv).toMatch(/const \[cursoId, setCursoId\] = useState\(courseId\)/);
  expect(gv).toMatch(/\.\.\.\(enrollment && cursoId !== courseId \? \{ courseId: cursoId \} : \{\}\)/);
  expect(gv).toMatch(/queryKey: \["gv-course", cursoId\]/);
});
