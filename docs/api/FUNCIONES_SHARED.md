# Funciones exportadas de packages/shared/src (tarea 90)

Borrador hecho por script. Fuente: `origin/producto-nexora` (`d6adc554`), rama `claude-pc/cola-b14-resto`. Una fila por línea `export` con `git grep -n -E "^export " -- packages/shared/src`. La firma se copia literal de esa línea, sin interpretar.

| Archivo:línea | Firma literal |
|---|---|
| `packages/shared/src/index.ts:6` | `export { z, ZodError } from "zod";` |
| `packages/shared/src/index.ts:9` | `export const d = (value: Decimal.Value) => new Decimal(value);` |
| `packages/shared/src/index.ts:10` | `export const money = (value: Decimal.Value) =>` |
| `packages/shared/src/index.ts:12` | `export const paymentReceiptLine = (payment: {` |
| `packages/shared/src/index.ts:21` | `export const isWalkInCustomer = (name: unknown) =>` |
| `packages/shared/src/index.ts:23` | `export const quantity = (value: Decimal.Value) =>` |
| `packages/shared/src/index.ts:27` | `export const isStockQty = (value: number) =>` |
| `packages/shared/src/index.ts:32` | `export const stockQty = (max = 1000000) =>` |
| `packages/shared/src/index.ts:41` | `export const isMoneyAmount = (value: number) =>` |
| `packages/shared/src/index.ts:45` | `export const moneyAmount = (max = 100000000, allowZero = false) =>` |
| `packages/shared/src/index.ts:54` | `export const derivedStockQty = (...factors: Decimal.Value[]) => {` |
| `packages/shared/src/index.ts:65` | `export function returnShares(` |
| `packages/shared/src/index.ts:101` | `export function allocationCost(line: {` |
| `packages/shared/src/index.ts:141` | `export const returnedAt = (` |
| `packages/shared/src/index.ts:147` | `export function splitCents(total: Decimal.Value, weights: Decimal.Value[]) {` |
| `packages/shared/src/index.ts:180` | `export function bookedLineCosts(sale: {` |
| `packages/shared/src/index.ts:202` | `export function replayReturns(` |
| `packages/shared/src/index.ts:290` | `export const countedQty = (max = 1000000) =>` |
| `packages/shared/src/index.ts:293` | `export const signedStockQty = (max = 100000) =>` |
| `packages/shared/src/index.ts:298` | `export const weightedCost = (` |
| `packages/shared/src/index.ts:311` | `export const landedCosts = (` |
| `packages/shared/src/index.ts:326` | `export const lineTotals = (` |
| `packages/shared/src/index.ts:359` | `export const paymentTotals = (` |
| `packages/shared/src/index.ts:382` | `export const RECEIVABLE_SHIFT_LIMIT = 3000;` |
| `packages/shared/src/index.ts:388` | `export const DEFAULT_SETTINGS = {` |
| `packages/shared/src/index.ts:446` | `export type ReceivableApprovalReason =` |
| `packages/shared/src/index.ts:448` | `export const receivableApprovalReason = (` |
| `packages/shared/src/index.ts:491` | `export const receivableNeedsApproval = (` |
| `packages/shared/src/index.ts:505` | `export const receivableApprovalMessage = (` |
| `packages/shared/src/index.ts:526` | `export const grossProfit = (net: number, cost: number) =>` |
| `packages/shared/src/index.ts:530` | `export const margin = (price: Decimal.Value, cost: Decimal.Value) =>` |
| `packages/shared/src/index.ts:532` | `export const markup = (price: number, cost: number) =>` |
| `packages/shared/src/index.ts:535` | `export const netProfit = (` |
| `packages/shared/src/index.ts:541` | `export const breakEven = (fixedExpenses: number, marginPercent: number) =>` |
| `packages/shared/src/index.ts:545` | `export const turnover = (costOfSales: number, averageInventory: number) =>` |
| `packages/shared/src/index.ts:547` | `export const inventoryDays = (stock: number, averageDaily: number) =>` |
| `packages/shared/src/index.ts:549` | `export const reorderPoint = (` |
| `packages/shared/src/index.ts:554` | `export const averageTicket = (sales: number, invoices: number) =>` |
| `packages/shared/src/index.ts:556` | `export const abc = <T extends { revenue: number }>(items: T[]) => {` |
| `packages/shared/src/index.ts:566` | `export const clearanceScore = (` |
| `packages/shared/src/index.ts:579` | `export const safeDiscount = (price: number, cost: number, minMargin = 15) =>` |
| `packages/shared/src/index.ts:599` | `export function clearanceDiscountLimit(` |
| `packages/shared/src/index.ts:616` | `export const saleSchema = z.object({` |
| `packages/shared/src/index.ts:712` | `export type SaleInput = z.infer<typeof saleSchema>;` |
| `packages/shared/src/index.ts:714` | `export const usdToDop = (amountUsd: Decimal.Value, rate: Decimal.Value) =>` |
| `packages/shared/src/index.ts:720` | `export const CASH_DENOMINATIONS = [` |
| `packages/shared/src/index.ts:724` | `export const denominationCountsSchema = z` |
| `packages/shared/src/index.ts:734` | `export type DenominationCounts = Partial<Record<string, number>>;` |
| `packages/shared/src/index.ts:740` | `export function countDenominations(` |
| `packages/shared/src/index.ts:758` | `export const cashDifference = (v: {` |
| `packages/shared/src/index.ts:765` | `export function deliveredSplit(` |
| `packages/shared/src/index.ts:783` | `export const cashCloseSchema = z` |
| `packages/shared/src/index.ts:810` | `export type CashCloseInput = z.infer<typeof cashCloseSchema>;` |
| `packages/shared/src/index.ts:812` | `export const PAYMENT_GROUPS = [` |
| `packages/shared/src/index.ts:820` | `export const formatAmount = (value: Decimal.Value) =>` |
| `packages/shared/src/index.ts:825` | `export const LOGO_MAX_BYTES = 200 * 1024;` |
| `packages/shared/src/index.ts:827` | `export function isImageDataUrl(value: string, maxBytes = LOGO_MAX_BYTES) {` |
| `packages/shared/src/index.ts:839` | `export const permissions: Record<string, string[]> = {` |
| `packages/shared/src/index.ts:863` | `export const can = (grants: string[], permission: string) =>` |
| `packages/shared/src/index.ts:865` | `export const categories = [` |
| `packages/shared/src/index.ts:872` | `export const formatMoney = (value: number | string) =>` |
| `packages/shared/src/index.ts:879` | `export const BUSINESS_TIME_ZONE = "America/Santo_Domingo";` |
| `packages/shared/src/index.ts:888` | `export const businessDate = (value: Date | string | number = new Date()) =>` |
| `packages/shared/src/index.ts:891` | `export const expired = (` |
| `packages/shared/src/index.ts:895` | `export const expiryDays = (value: Date | string, now: Date = new Date()) =>` |
| `packages/shared/src/index.ts:904` | `export const daysSince = (` |
| `packages/shared/src/index.ts:910` | `export const courierCharge = (sale: {` |
| `packages/shared/src/index.ts:923` | `export const isService = (product: unknown) =>` |
| `packages/shared/src/index.ts:927` | `export const lastDaysStart = (days: number, value: Date = new Date()) => {` |
| `packages/shared/src/index.ts:932` | `export const weekStart = (value: Date = new Date()) => {` |
| `packages/shared/src/index.ts:953` | `export function returnPolicyText(config: any) {` |
| `packages/shared/src/index.ts:965` | `export function privacyNoticeText(config: any) {` |
| `packages/shared/src/index.ts:978` | `export const foldSearch = (value: string) =>` |
| `packages/shared/src/index.ts:1048` | `export const searchTerms = (query: string): string[][] =>` |
| `packages/shared/src/index.ts:1054` | `export const searchHaystack = (text: string) =>` |
| `packages/shared/src/index.ts:1057` | `export const matchesSearch = (text: string, query: string) => {` |
| `packages/shared/src/index.ts:1073` | `export const searchHits = (text: string, query: string) => {` |
| `packages/shared/src/index.ts:1079` | `export const searchVariantsForDb = (term: string): string[] => {` |
| `packages/shared/src/index.ts:1090` | `export type SurveyQuestion = {` |
| `packages/shared/src/index.ts:1111` | `export const CASHIER_SURVEY: readonly SurveyQuestion[] = [` |
| `packages/shared/src/index.ts:1172` | `export function surveyAnswers(input: unknown) {` |
