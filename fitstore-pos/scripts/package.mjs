// Genera un archivo fuente reproducible sin secretos, datos locales ni dependencias.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
const output = resolve(process.argv[2] || "../fitstore-pos-corregido.zip");
// En Windows suele llamarse "python"; en Linux/macOS, "python3".
const python = ["python3", "python"].find(
  (bin) => !spawnSync(bin, ["--version"]).error,
);
const result = spawnSync(
  python ?? "python",
  [
    "-c",
    `
import pathlib,zipfile,sys
root=pathlib.Path.cwd()
excluded={'node_modules','.local-db','.pnpm-store','.git','dist','test-results','playwright-report','coverage','target','build','.gradle'}
with zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED,compresslevel=9) as archive:
    for path in sorted(root.rglob('*')):
        rel=path.relative_to(root)
        if not path.is_file() or path.is_symlink() or any(p in excluded for p in rel.parts): continue
        if (path.name.startswith('.env') and path.name!='.env.example') or path.suffix in {'.log','.pem','.key','.p12','.keystore'}: continue
        info=zipfile.ZipInfo(str(pathlib.Path('fitstore-pos')/rel),date_time=(2026,10,5,0,0,0))
        info.compress_type=zipfile.ZIP_DEFLATED
        info.external_attr=(0o100644 << 16)
        archive.writestr(info,path.read_bytes())
print('ZIP:',sys.argv[1])
`,
    output,
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
