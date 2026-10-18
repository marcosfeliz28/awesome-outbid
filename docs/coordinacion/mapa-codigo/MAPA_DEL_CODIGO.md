> Mapa del código generado con Graphify v0.9.87 (solo análisis local de apps/ y packages/, sin IA ni datos de la tienda). Fecha: 12-oct-2026. Regenerar con: `graphify update .` sobre una copia de apps y packages.

# Graph Report - gmap  (2026-10-12)

## Corpus Check
- 139 files · ~191,114 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 7 file(s) not represented in the graph (top: .css 5, .toml 1, .prisma 1)

## Summary
- 1716 nodes · 5229 edges · 74 communities (59 shown, 15 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 45 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- index.ts
- .changePassword
- inventory-import-core.ts
- POS.tsx
- audit
- Permit
- Management.tsx
- drive-backup-core.ts
- reports.ts
- inventory.ts
- Prints.tsx
- dependencies
- sales.ts
- app.ts
- incentives.ts
- Merchandise.tsx
- invoice.ts
- common.ts
- api.ts
- admin.ts
- AlertEngine
- Actor
- InventoryImport.tsx
- Database
- security.ts
- App.tsx
- parse
- drive-backup.ts
- credit-reminder.ts
- notifications.ts
- ui/package.json
- BackupError
- web/package.json
- bad
- RealtimeController
- Tienda.tsx
- ref_node_crypto
- matchInvoiceLines
- dependencies
- escapeHtml
- tauri.conf.json
- DriveBackupService
- cartDraft.ts
- Incentives.tsx
- NotificationWorker
- useStore
- retention.ts
- xlsx-guard.ts
- compilerOptions
- .callback
- DriveBackupWorker
- devDependencies
- compilerOptions
- MerchandiseController
- RealtimeHub
- readInvoiceTable
- tokens
- .importInvoice
- compilerOptions
- DriveBackupController
- shared/tsconfig.json
- NotificationsController
- SecurityMaintenance
- vite.config.ts
- scripts
- capacitor.config.ts
- vite-env.d.ts
- fitstore-pos

## God Nodes (most connected - your core abstractions)
1. `Actor` - 153 edges
2. `Permit()` - 138 edges
3. `CurrentUser` - 135 edges
4. `parse()` - 107 edges
5. `bad()` - 93 edges
6. `audit()` - 84 edges
7. `api()` - 58 edges
8. `toast()` - 54 edges
9. `Database` - 47 edges
10. `post()` - 45 edges

## Surprising Connections (you probably didn't know these)
- `apply()` --calls--> `toast()`  [EXTRACTED]
  apps/web/src/InventoryImport.tsx → apps/web/src/helpers.tsx
- `Catalog()` --indirect_call--> `loadCatalog()`  [INFERRED]
  apps/web/src/Management.tsx → apps/web/src/api.ts
- `Purchases()` --indirect_call--> `loadCatalog()`  [INFERRED]
  apps/web/src/Management.tsx → apps/web/src/api.ts
- `Merchandise()` --indirect_call--> `loadCatalog()`  [INFERRED]
  apps/web/src/Merchandise.tsx → apps/web/src/api.ts
- `POS()` --indirect_call--> `loadCatalog()`  [INFERRED]
  apps/web/src/POS.tsx → apps/web/src/api.ts

## Import Cycles
- None detected.

## Communities (74 total, 15 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.06
Nodes (69): dependencies, decimal.js, zod, zod, main, name, private, scripts (+61 more)

### Community 1 - ".changePassword"
Cohesion: 0.06
Nodes (28): db, main(), HealthController, AuthController, credentialAttemptIdentity(), normalizeUsername(), passwordHash(), Public() (+20 more)

### Community 2 - "inventory-import-core.ts"
Cohesion: 0.06
Nodes (53): main(), activeForImport(), at(), ATTRIBUTES, blockedError(), brandOf(), CategoryLine, CategoryPlan (+45 more)

### Community 3 - "POS.tsx"
Cohesion: 0.08
Nodes (52): discountLocalStock(), refreshCart(), cancelPending(), discardCartDraft(), rememberAttempt(), restoredAttempt(), customerEditValue(), customerPrivateDisplay() (+44 more)

### Community 4 - "audit"
Cohesion: 0.11
Nodes (21): cashExpected(), refreshClosedCash(), audit(), conflict(), denied(), lockActiveCustomer(), RequireTerminal(), moneyDb() (+13 more)

### Community 5 - "Permit"
Cohesion: 0.12
Nodes (8): AdminController, auditSettings(), cashMovementLimit(), idempotent(), receivableShiftLimit(), CurrentUser, Permit(), temporaryPasswordExpiry()

### Community 6 - "Management.tsx"
Cohesion: 0.17
Nodes (49): api(), post(), ConfirmModal(), dateLabel(), FormModal(), submit(), mutate(), toast() (+41 more)

### Community 7 - "drive-backup-core.ts"
Cohesion: 0.07
Nodes (40): attemptsToday(), BackupFormatError, backupName(), ByteQueue, chunkNonce(), createDecryptStream(), createEncryptStream(), decodeHeader() (+32 more)

### Community 8 - "reports.ts"
Cohesion: 0.09
Nodes (31): alertForActor(), cashCloseRequiresNote(), canViewCashExpected(), INVENTORY_LOSS_SQL, SUPPLIER_RETURN_SQL, addTo(), count(), dateRange() (+23 more)

### Community 9 - "inventory.ts"
Cohesion: 0.12
Nodes (34): productSchema, sellable(), variantSchema, amount, cost, json(), checkDamage(), damagedCostOf() (+26 more)

### Community 10 - "Prints.tsx"
Cohesion: 0.09
Nodes (29): queryClient, sanitizeRequest(), sanitizeUrl(), scrubText(), BusinessHeader(), COUNT_KEYS, CuadrePrint(), DailyUserReportPrint() (+21 more)

### Community 11 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, @anthropic-ai/sdk, bcryptjs, cookie-parser, dotenv, exceljs, express, @fitstore/shared (+31 more)

### Community 12 - "sales.ts"
Cohesion: 0.07
Nodes (32): ALERT_EVALUATION_TTL_MS, AlertEvent, AlertWrite, discountCountMessage(), Evaluation, MANUAL_ALERT_TYPES, SESSION_CONTROLLERS, StoredAlert (+24 more)

### Community 13 - "app.ts"
Cohesion: 0.08
Nodes (29): @fitstore/shared, @types/node, typescript, zod, name, private, createAppModule(), ApiExceptionFilter (+21 more)

### Community 14 - "incentives.ts"
Cohesion: 0.10
Nodes (26): businessMonth(), closeLock(), DEFAULT_RATES, defaultIncentiveRate(), EntryLike, firstOpenPeriod(), incentiveAmount(), IncentivesController (+18 more)

### Community 15 - "Merchandise.tsx"
Cohesion: 0.11
Nodes (32): download(), syncMerchandise(), Field, Barcode(), managementQueryError(), cachedReference(), CatalogVariant, ContinuousScanner() (+24 more)

### Community 16 - "invoice.ts"
Cohesion: 0.06
Nodes (33): positive, aiInvoiceSchema, CatalogVariant, COLOR_EN, COLOR_MODIFIERS, COLORS, COLUMN_LABELS, COLUMN_SYNONYMS (+25 more)

### Community 17 - "common.ts"
Cohesion: 0.11
Nodes (25): AuthGuard, canViewCustomerPii(), CUSTOMER_HISTORY_FIELDS, customerForActor(), FIELD_NAMES, fieldLabel(), isUnexpectedError(), isZodError() (+17 more)

### Community 18 - "api.ts"
Cohesion: 0.11
Nodes (29): ANSWER_TIMEOUT, apiBlob(), cachedApi(), DOWNLOAD_FAILED, endSession(), fetchCatalog(), forgetSessionData(), isNetworkError() (+21 more)

### Community 19 - "admin.ts"
Cohesion: 0.09
Nodes (26): anonymizeCustomerSchema, cashierNumber, checkLogo(), configSchema, customerSchema, literalPattern(), newPinSchema, redactKnownCustomerPii() (+18 more)

### Community 20 - "AlertEngine"
Cohesion: 0.10
Nodes (7): AlertCacheInterceptor, AlertEngine, AlertsController, cashDifferenceMessage(), chunks(), sqlTimestamp(), variantLabel()

### Community 21 - "Actor"
Cohesion: 0.17
Nodes (8): Actor, safe(), describeReceipts(), InventoryController, keepHiddenItbis(), receiptAccess(), receiptPeriod(), seesCost()

### Community 22 - "InventoryImport.tsx"
Cohesion: 0.10
Nodes (24): Dashboard(), DRIVE_RESULT, DriveBackupCard(), DriveBackupPanel(), DriveBackupStatus, sizeLabel(), when(), QueryState() (+16 more)

### Community 23 - "Database"
Cohesion: 0.08
Nodes (9): Database, databaseUrlWithPool(), DEFAULT_POOL, positiveInt(), checkDatabaseTimeZone(), isUtcTimeZone(), timeZoneWarning(), UTC_NAMES (+1 more)

### Community 24 - "security.ts"
Cohesion: 0.10
Nodes (25): ActorRequest, amount, discardSchema, Listener, openStreams, ATTEMPT_LIMIT, ATTEMPT_LOCK_MINUTES, AttemptBudget (+17 more)

### Community 25 - "App.tsx"
Cohesion: 0.15
Nodes (25): saveSession(), sessionDeadline(), About(), App(), ChangeOwnPassword(), IDLE_WARNING_MS, IdleWarning(), Login() (+17 more)

### Community 26 - "parse"
Cohesion: 0.19
Nodes (5): assertCategoriesInBranch(), assertCodesFree(), CatalogController, explainCodeConflict(), parse()

### Community 27 - "drive-backup.ts"
Cohesion: 0.11
Nodes (20): ALERT_AFTER_FAILURES, maskAccount(), pkceChallenge(), pkceVerifier(), RETRY_DELAYS_MS, sameText(), sha256Hex(), signState() (+12 more)

### Community 28 - "credit-reminder.ts"
Cohesion: 0.12
Nodes (15): age(), CREDIT_REMINDER_HOUR, CREDIT_REMINDER_LIST, CREDIT_REMINDER_TYPE, CreditReminderService, isoWeekKey(), OpenCredit, parts() (+7 more)

### Community 29 - "notifications.ts"
Cohesion: 0.10
Nodes (23): saleIncentive(), BACKOFF_SECONDS, CashCloseView, CollectionView, customerName(), dateFormat, Db, EventType (+15 more)

### Community 30 - "ui/package.json"
Cohesion: 0.08
Nodes (17): dependencies, lucide-react, @radix-ui/react-dialog, react, devDependencies, @types/react, lucide-react, react (+9 more)

### Community 31 - "BackupError"
Cohesion: 0.27
Nodes (8): accessToken(), BackupError, sanitizeBackupError(), Drive, dumpEncrypted(), googleFetch(), pgEnvironment(), summarize()

### Community 32 - "web/package.json"
Cohesion: 0.09
Nodes (21): @fitstore/shared, lucide-react, react, @types/node, @types/react, typescript, name, private (+13 more)

### Community 33 - "bad"
Cohesion: 0.22
Nodes (4): CashController, closeDifferences(), bad(), terminalName()

### Community 34 - "RealtimeController"
Cohesion: 0.19
Nodes (4): bump(), publicTerminal(), RealtimeController, terminalStatus()

### Community 35 - "Tienda.tsx"
Cohesion: 0.14
Nodes (18): closeCashIntro(), pendingCloseMessage(), ageText(), CloseCashModal(), COD_METHOD_LABEL, CodPending(), CollectLine, CREDIT_STATUS (+10 more)

### Community 36 - "ref_node_crypto"
Cohesion: 0.16
Nodes (12): ago(), db, ean(), future(), main(), names, db, credential() (+4 more)

### Community 37 - "matchInvoiceLines"
Cohesion: 0.16
Nodes (18): attributeValues(), attrKind(), matchInvoiceLines(), measureAgree(), measureConflict(), measureConflicts(), measuresIn(), nameSegments() (+10 more)

### Community 38 - "dependencies"
Cohesion: 0.11
Nodes (18): dependencies, @capacitor/android, @capacitor/core, @capacitor/ios, dexie, @fitstore/shared, @fitstore/ui, @fontsource-variable/inter (+10 more)

### Community 39 - "escapeHtml"
Cohesion: 0.38
Nodes (17): amount(), cleanText(), customerLine(), differenceLabel(), escapeHtml(), formatDate(), itemsLine(), methodLabel() (+9 more)

### Community 40 - "tauri.conf.json"
Cohesion: 0.12
Nodes (16): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+8 more)

### Community 41 - "DriveBackupService"
Cohesion: 0.34
Nodes (3): localDay(), DriveBackupService, telegramSettings

### Community 42 - "cartDraft.ts"
Cohesion: 0.22
Nodes (13): CartItem, localDB, Variant, CartDraft, draftKey(), keepCartDraft(), keepDraftThrough(), lean() (+5 more)

### Community 43 - "Incentives.tsx"
Cohesion: 0.18
Nodes (14): currentMonth(), IncentivesIcon, IncentivesPage(), MyIncentives(), netUnits(), Rate, Report, Row (+6 more)

### Community 44 - "NotificationWorker"
Cohesion: 0.23
Nodes (5): backoffSeconds(), NotificationWorker, sanitizeError(), sendTelegram(), sleep()

### Community 45 - "useStore"
Cohesion: 0.32
Nodes (12): useStore, CashElsewhere(), cashOnOtherDevice(), defaultDeviceName(), DeviceGate(), forgetIdentity(), Identity, randomSecret() (+4 more)

### Community 46 - "retention.ts"
Cohesion: 0.23
Nodes (5): batched(), purgeExpiredData(), RETENTION, RetentionWorker, SECURITY_AUDIT_ACTIONS

### Community 47 - "xlsx-guard.ts"
Cohesion: 0.24
Nodes (10): assertSafeXlsx(), cellCodeText(), corrupt(), countXmlElements(), findEndOfCentralDirectory(), tooBig(), XLSX_MAX_ENTRIES, XLSX_MAX_SHEET_CELLS (+2 more)

### Community 48 - "compilerOptions"
Cohesion: 0.17
Nodes (11): compilerOptions, declaration, emitDecoratorMetadata, experimentalDecorators, module, moduleResolution, outDir, rootDir (+3 more)

### Community 49 - ".callback"
Cohesion: 0.24
Nodes (6): driveBackupSettings(), num(), isRepeated(), isSequential(), shannonEntropy(), weakSecretReason()

### Community 51 - "devDependencies"
Cohesion: 0.18
Nodes (11): devDependencies, @capacitor/cli, tailwindcss, @tailwindcss/vite, @types/node, @types/react, @types/react-dom, typescript (+3 more)

### Community 52 - "compilerOptions"
Cohesion: 0.18
Nodes (10): compilerOptions, jsx, lib, module, moduleResolution, noEmit, types, extends (+2 more)

### Community 56 - "readInvoiceTable"
Cohesion: 0.25
Nodes (9): blank(), cellText(), cellValue(), decodeCsv(), parseInvoiceNumber(), readInvoiceNumber(), readInvoiceTable(), resolveColumns() (+1 more)

### Community 57 - "tokens"
Cohesion: 0.28
Nodes (9): contains(), coreText(), EXPLAINED, keyTokens(), nameConfidence(), productScore(), tokenize(), tokens() (+1 more)

### Community 58 - ".importInvoice"
Cohesion: 0.22
Nodes (4): extractAnthropic(), parseExtraction(), parseModelJson(), purgeStaleInvoiceDrafts()

### Community 59 - "compilerOptions"
Cohesion: 0.22
Nodes (8): compilerOptions, jsx, module, moduleResolution, noEmit, extends, include, ../../tsconfig.base.json

### Community 62 - "shared/tsconfig.json"
Cohesion: 0.25
Nodes (7): compilerOptions, module, moduleResolution, noEmit, extends, include, ../../tsconfig.base.json

### Community 65 - "vite.config.ts"
Cohesion: 0.29
Nodes (5): appCommit, @tailwindcss/vite, vite, vite-plugin-pwa, @vitejs/plugin-react

### Community 67 - "scripts"
Cohesion: 0.40
Nodes (5): scripts, build, dev, preview, typecheck

## Knowledge Gaps
- **31 isolated node(s):** `@fitstore/shared`, `zod`, `@types/cookie-parser`, `@types/express`, `@types/node` (+26 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 535 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Actor` connect `Actor` to `.changePassword`, `inventory-import-core.ts`, `audit`, `Permit`, `reports.ts`, `inventory.ts`, `sales.ts`, `incentives.ts`, `common.ts`, `admin.ts`, `AlertEngine`, `security.ts`, `parse`, `drive-backup.ts`, `credit-reminder.ts`, `notifications.ts`, `bad`, `RealtimeController`, `DriveBackupService`, `MerchandiseController`, `.receipt`, `.importInvoice`, `DriveBackupController`, `.receipt`, `.state`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `@fitstore/shared`, `zod`, `@types/cookie-parser` to the rest of the system?**
  _31 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05777345017851347 - nodes in this community are weakly interconnected._
- **Why does `Permit()` connect `Permit` to `inventory-import-core.ts`, `audit`, `reports.ts`, `inventory.ts`, `sales.ts`, `incentives.ts`, `common.ts`, `admin.ts`, `AlertEngine`, `Actor`, `security.ts`, `parse`, `drive-backup.ts`, `credit-reminder.ts`, `notifications.ts`, `bad`, `RealtimeController`, `MerchandiseController`, `.receipt`, `.importInvoice`, `DriveBackupController`, `.receipt`, `NotificationsController`, `.state`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `.changePassword` be split into smaller, more focused modules?**
  _Cohesion score 0.056049213943950786 - nodes in this community are weakly interconnected._
- **Why does `CurrentUser` connect `Permit` to `.changePassword`, `inventory-import-core.ts`, `audit`, `reports.ts`, `inventory.ts`, `sales.ts`, `incentives.ts`, `common.ts`, `admin.ts`, `AlertEngine`, `Actor`, `security.ts`, `parse`, `drive-backup.ts`, `credit-reminder.ts`, `notifications.ts`, `bad`, `RealtimeController`, `MerchandiseController`, `.receipt`, `.importInvoice`, `DriveBackupController`, `.receipt`, `.state`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Should `inventory-import-core.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.055905220288781934 - nodes in this community are weakly interconnected._