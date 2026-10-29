Borrador sin verificar, hecho por script (grep sobre origin/nexora-cloud, solo lectura). Fecha: 2026-10-29. Fuente: apps/api/prisma/schema.prisma.

# Modelos de datos (lista de campos tal como aparecen)

## Role

Campos (5): id, name, permissions, users, updatedAt

## User

Campos (24): id, name, username, usernameKey, email, passwordHash, mustChangePassword, passwordExpiresAt, pinHash, roleId, role, active, authVersion, failedAttempts, lockedUntil, branchId, cashierNumber, createdAt, updatedAt, voidRequestsMade, voidRequestsReviewed, courierPaymentsMade, courierPayouts, cashierSurveys

## RefreshToken

Campos (7): id, userId, authVersion, sessionId, hash, expiresAt, createdAt

## Category

Campos (11): id, name, requiresLot, requiresExpiry, color, attributes, products, branchId, createdBy, createdAt, updatedAt

## Brand

Campos (2): id, name

## Supplier

Campos (12): id, name, legalId, phone, email, paymentTermsDays, leadTimeDays, active, branchId, createdBy, createdAt, updatedAt

## Product

Campos (21): id, name, sku, categoryId, category, brand, supplierId, description, imageUrl, taxRate, minStock, maxStock, unit, location, active, isKit, variants, branchId, createdBy, createdAt, updatedAt

## Variant

Campos (23): id, productId, product, sku, barcode, attributes, costAvg, price, wholesalePrice, stock, active, lots, warehouseStocks, transferLines, movements, saleItems, purchaseItems, kitComponents, usedInKits, branchId, createdBy, createdAt, updatedAt

## KitComponent

Campos (6): id, kitVariantId, kitVariant, componentVariantId, componentVariant, qty

## Lot

Campos (16): id, variantId, variant, lotNumber, lotNumberNormalized, expiryDate, qty, cost, branchId, createdBy, createdAt, updatedAt, movements, warehouseStocks, transferLines, saleItems

## LotIdentityConflict

Campos (9): conflictKey, variantId, lotNumberNormalized, keeperLotId, sourceLotIds, expiryDates, chosenExpiryDate, resolution, createdAt

## InventoryMovement

Campos (16): id, variantId, variant, lotId, lot, type, qty, unitCost, balanceAfter, refId, reason, userId, branchId, warehouseId, warehouse, createdAt

## Warehouse

Campos (12): id, branchId, name, kind, active, sellable, stocks, lotStocks, outgoingTransfers, incomingTransfers, movements, counts

## VariantStock

Campos (5): variantId, warehouseId, qty, variant, warehouse

## LotStock

Campos (5): lotId, warehouseId, qty, lot, warehouse

## StockTransfer

Campos (11): id, operationId, branchId, fromId, toId, from, to, reason, userId, createdAt, lines

## StockTransferLine

Campos (8): id, transferId, variantId, lotId, lot, qty, transfer, variant

## Customer

Campos (15): id, creditLimit, name, phone, email, legalId, notes, active, anonymizedAt, branchId, createdBy, createdAt, updatedAt, sales, creditNotes

## Sale

Campos (48): id, number, status, offlineUuid, requestHash, customerId, customer, sellerId, cashSessionId, cashSession, subtotal, discountTotal, discountReason, discountRule, discountApprovedBy, discountApprovedName, discountApprovedRole, taxTotal, taxIncluded, total, costTotal, courierFee, courierName, courierPaidAt, courierPaidById, courierPaidBy, courierPayoutItem, creditBalance, creditDueDate, creditClosedAt, creditClosedById, incentiveOnCollection, receivableKind, ncf, ncfType, recipientLegalId, fiscalStatus, notes, voidedReason, voidedBy, wholesale, items, payments, returns, voidRequests, branchId, createdAt, updatedAt

## SaleVoidRequest

Campos (17): id, saleId, sale, requestedById, requester, reviewedById, reviewer, operationId, reasonCode, reason, status, resolutionNote, requestedAt, reviewedAt, cancelledAt, updatedAt, branchId

## CourierPayout

Campos (9): operationId, branchId, actorId, actor, note, requestHash, total, createdAt, items

## CourierPayoutItem

Campos (6): id, payoutId, payout, saleId, sale, fee

## SaleItem

Campos (16): id, saleId, sale, variantId, variant, lotId, lot, qty, returnedQty, unitPrice, unitCost, discount, tax, lineTotal, stockAllocations, promotionName

## Payment

Campos (27): id, saleId, sale, cashSessionId, cashSession, creditNoteId, creditNote, entryType, idempotencyKey, createdAt, method, amount, tendered, change, bank, reference, cardBrand, cardLast4, approvalCode, cardType, feeAmount, status, proofUrl, receivedById, currency, amountUsd, usdRate

## CreditAllocationOperation

Campos (7): operationId, branchId, customerId, actorId, requestHash, result, createdAt

## SaleReturn

Campos (20): id, saleId, sale, number, reason, total, taxTotal, costTotal, wasteQty, wasteCostTotal, refundAmount, refundMethod, cashSessionId, cashSession, creditNote, userId, items, branchId, operationId, createdAt

## CreditNote

Campos (10): id, redemptionCode, returnId, saleReturn, customerId, customer, amount, balance, createdAt, payments

## Quote

Campos (12): id, type, customerId, userId, items, notes, globalDiscount, wholesale, status, branchId, createdAt, updatedAt

## PurchaseOrder

Campos (18): id, number, supplierId, status, expectedDate, total, supplierInvoice, supplierNcf, invoiceDate, paymentType, creditDays, itbis, items, receipts, branchId, createdBy, createdAt, updatedAt

## PurchaseItem

Campos (9): id, orderId, order, variantId, variant, qty, receivedQty, damagedQty, unitCost

## GoodsReceipt

Campos (23): id, orderId, order, supplierId, total, attachmentId, attachment, operationId, freight, otherCosts, items, supplierInvoice, supplierNcf, invoiceDate, paymentType, creditDays, itbis, damagedCost, invoiceTotal, invoiceDifference, userId, branchId, createdAt

## SupplierPayment

Campos (9): id, supplierId, amount, method, reference, branchId, createdBy, createdAt, operationId

## InventoryCount

Campos (9): id, items, status, userId, appliedBy, branchId, warehouseId, warehouse, createdAt

## CashSession

Campos (23): id, registerId, userId, openingAmount, openedAt, closedAt, expectedCash, countedCash, expectedCard, countedCard, expectedTransfer, countedTransfer, differenceCash, differenceCard, differenceTransfer, difference, notes, closeDetails, branchId, sales, payments, returns, movements

## CashMovement

Campos (9): id, operationId, sessionId, session, type, amount, reason, userId, createdAt

## ExpenseCategory

Campos (4): id, name, monthlyBudget, expenses

## Expense

Campos (16): id, categoryId, category, date, amount, method, supplierId, description, receiptUrl, recurring, voided, branchId, createdBy, createdAt, updatedAt, operationId

## Promotion

Campos (13): id, name, type, value, startsAt, endsAt, scope, active, isClearance, branchId, createdBy, createdAt, updatedAt

## Alert

Campos (10): id, key, type, severity, entityId, message, status, branchId, createdAt, updatedAt

## AlertRule

Campos (5): id, type, threshold, active, updatedAt

## AuditLog

Campos (11): terminalId, id, userId, action, entity, entityId, before, after, ip, branchId, createdAt

## Settings

Campos (3): id, data, updatedAt

## Counter

Campos (2): key, value

## AuthAttempt

Campos (5): key, failedAttempts, lockedUntil, windowStartedAt, updatedAt

## AuthSession

Campos (4): terminalId, id, userId, lastActivityAt

## Terminal

Campos (14): id, name, branchId, revokedAt, lastActivityAt, createdAt, approvedAt, approvedBy, secretHash, createdBy, lastUserId, legacy, registerNumber, registerName

## RealtimeEvent

Campos (5): id, branchId, type, data, createdAt

## MerchandiseOperation

Campos (7): id, branchId, userId, terminalId, requestHash, result, createdAt

## SupplierImportProfile

Campos (4): id, supplierId, branchId, mapping

## SupplierCode

Campos (5): id, supplierId, branchId, code, variantId

## InvoiceDraft

Campos (9): id, branchId, userId, supplierId, lines, total, attachmentId, confirmedOperationId, createdAt

## InvoiceAttachment

Campos (7): id, branchId, userId, mime, data, createdAt, goodsReceipts

## NotificationOutbox

Campos (11): id, eventType, refId, payload, status, attempts, nextAttemptAt, lastError, createdAt, sentAt, branchId

## IncentiveRate

Campos (6): id, branchId, categoryId, amount, updatedBy, updatedAt

## IncentiveEntry

Campos (17): id, kind, refId, saleId, saleItemId, userId, categoryId, categoryName, qty, rateAtSale, wholesale, amount, period, originPeriod, note, branchId, createdAt

## IncentivePeriodClose

Campos (5): id, branchId, period, closedBy, closedAt

## IncentiveSettlement

Campos (17): id, branchId, period, userId, userName, units, salesCount, wholesaleSales, gross, deductions, net, pendingCollection, priorDeductions, entryCount, closedBy, closedByName, closedAt

## DriveBackup

Campos (25): id, refreshTokenEnc, accountEmail, folderId, branchId, connectedAt, connectedBy, authError, lockId, lockedUntil, runningSince, lastRunAt, lastTrigger, lastStatus, lastError, lastDurationMs, lastSuccessAt, lastSize, lastFileName, consecutiveFailures, dayKey, dayAttempts, nextRetryAt, lastAlertAt, updatedAt

## GvCourse

Campos (13): id, branchId, externalId, name, type, date, price, capacity, active, createdBy, createdAt, updatedAt, enrollments

## GvEnrollment

Campos (20): id, branchId, externalId, operationId, courseId, course, clientName, phone, instagram, agreedPrice, status, attended, boughtBrushSet, note, refundAmount, refundDate, createdBy, createdAt, updatedAt, payments

## GvPayment

Campos (22): id, branchId, externalId, operationId, enrollmentId, enrollment, appointmentId, appointment, date, amount, concept, method, bank, reference, verified, verifiedBy, verifiedAt, rejectedAt, rejectedBy, rejectReason, createdBy, createdAt

## GvAppointment

Campos (23): id, branchId, date, clientName, phone, instagram, service, artists, afterHours, total, tip, status, note, weddingQuote, venue, people, refundAmount, refundDate, externalId, createdBy, createdAt, updatedAt, payments

## GvLead

Campos (12): id, branchId, name, phone, interest, action, status, note, externalId, createdBy, createdAt, updatedAt

## CashierSurvey

Campos (7): id, userId, user, branchId, answers, createdAt, updatedAt

Total de modelos: 64. Descripción en palabras simples: NO ENCONTRADO (no se redactó con modelo).
