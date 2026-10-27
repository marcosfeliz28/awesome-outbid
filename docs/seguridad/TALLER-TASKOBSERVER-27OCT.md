# Task Observer 3.8.1 instalado en el Taller: nombres y sha256 (solo lectura)

Fecha: 27-oct-2026. Sin contenido de archivos ni credenciales.

| sha256 | archivo | ruta sensible del candado |
|---|---|---|
| f2716bed7cdceeb118479e561faca26fcc1acbd297628193d45a0aaa824e025f | .claude-plugin/marketplace.json | sí |
| 7599bb30eb46a0bfb63dd0638f5d641a91e915cd7481517320eab49d113df57c | .claude-plugin/plugin.json | sí |
| f1d310682072ad358b7b68e8b6988813296ef7edf6713da64e3d3b0e5e656d0e | .gitattributes | no |
| 8b72101d16d6e6b0141e5c612645f38ca2a88cf605e64913587bc7732b223de4 | .github/ISSUE_TEMPLATE/config.yml | no |
| 00aee07e6299d2f78a8608f8fab5efcd2cd5f3ff5417f4ee3d76e2c32ce6b82a | .github/ISSUE_TEMPLATE/propose-a-change.md | no |
| a66417ec27abf5265dc498c48cbb18b7f2e58d9c8af2b685547ed12f03935808 | .github/ISSUE_TEMPLATE/report-a-failure.md | no |
| 5535f2e34bac41cc2e3b1f2b4ba83b56a5fbd967385b988e112bb87155dc123e | .github/pull_request_template.md | no |
| a9caf31a5570881fdc22c0335d45e3083ac3ff2b383351f38921574e8c49dd00 | .github/workflows/release-bundle.yml | no |
| 2b13b117bfb917014f3d4bf8502aedc2f19413e2961907535a25dea882f467c7 | .in_use/95 | no |
| 5b705b59ff7657e9bd857bc787920aa39e7fbbc33657f886761cb06de5f0f873 | CODE_OF_CONDUCT.md | no |
| 0ca4ec109fc9a536455319ef372e0e86672542e0f3e0deba95dbd879bd890d0c | CONTRIBUTING.md | no |
| 50bfbf25300f4b6c06f5c286bc9f63b2fe43a548233d633a6798a78a785bdb98 | LICENSE | no |
| bba9d186dfa1551bc2a502575bcb8129d47f952c1f214093c7de93908c36b218 | README.md | no |
| 5d9f250768c30125d498930daa61378c9febaf7ebfb1fa7262126f9dbf8de071 | SECURITY.md | no |
| 49db530ceeb72dcf127a19c43bddfec9dc6d9df5af6469bdd535e465bd4d929a | SKILL.md | no |
| 1afd3ab29666f23acad3ca90d8be3dd32fef10c0c74bc5c65006d14e4176eb1c | SUPPORT.md | no |
| 67dc283a4deab150f335530de4bd733914c494e63cb2c1c1bcc1dee82a1a9b3e | USER-GUIDE.md | no |
| b3e470041701fb71e867c12ff1f72100735f415e44b03c1d555147c52dd67b10 | references/ceilings.txt | no |
| 830ab473c3ceac69af35b8c071f89844158c0cc5150479082e85de9cc48a4a17 | references/environments.md | no |
| 88a13afb7aa51c1522e20ac1fddacf5e7cb68883477bda17494600a4193e69cc | references/migration.md | no |
| d3cf7c44db01458e7a156092503d566524e77af29322a246e937509ffe9b8279 | references/observation-log.md | no |
| 6d27cdd1e80a7c86786fda25a9039bd36249967a0930fa690ac729363ef80134 | references/signals.md | no |
| 051ef77818a3a36d76a96ae4bccf813d4140169013345ad3b35c947db7897997 | references/skill-authoring.md | no |
| f25767399f7e0b21fd655da08e652deaeceac24e0efa38dfe7470ef0702351ff | references/starter-principles.md | no |
| 2d9cc20305ca2dc27f0ec5fa83b3cb20565601e2b42831da7707b59785cd4068 | references/weekly-review.md | no |
| ce4418ecac5e12b00d4f4cce9ddc5ef5cdceb4a18988de6089a14930dd277975 | scripts/migrate-log.py | sí |
| f2844d0c99b1f313477c9963a217699861086afe5b1f71ba14bafb04461bbe08 | scripts/new-observation.sh | sí |
| e1b761fb73634d1f58f68f3b3ff67a771739c47ab5ad9236750e06843670bab7 | scripts/session-start-scan.sh | sí |
| 3546be4182e70a031ec9aebaf0c0a96c374869f28dfb4ea577473f37e178ce95 | scripts/skill-load.sh | sí |
| 35bd1118ff73280ff16387abb6bc3da4f56c82d05e1bdb5bc09182cac93fae8d | scripts/validate-skill-bundle.py | sí |

## Lectura
- Los 7 archivos de rutas sensibles (2 en .claude-plugin, 5 en scripts) tienen los mismos primeros 16 caracteres de sha256 que la tabla del Revisor.
- Los 23 restantes están fuera de las rutas sensibles del candado (README, SKILL.md, references, .github, .in_use, LICENSE, etc.). Ningún archivo extra está en hooks/, bin/, bridge/, dist/ ni .mcp.json.
- No pude hacer el diff completo contra ba696b2: no hay clon de ese repo en el Taller y no lo traje (fuera del alcance de este repo).
- Task Observer queda desactivado en .claude/settings.json hasta que el Revisor cierre.
