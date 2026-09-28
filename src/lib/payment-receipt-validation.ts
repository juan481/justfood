import { prisma } from '@/lib/prisma';
import { ReceiptAutoValidationStatus } from '@prisma/client';

// Deterministic pre-validation — runs regardless of whether the extracted
// fields came from a human typing them in (today) or Gemini Vision (Fase
// 2d once GEMINI_API_KEY is configured). This code never decides "paid or
// not" on its own; it only flags for the human reviewer (plan section 6.4:
// "la automatización hace el pre-ordenamiento y marca evidencia, no
// autoriza dinero").
export async function autoValidateReceipt(
  tenantId: string,
  orderTotal: number,
  extractedAmount: number | null,
  extractedAliasOrCvu: string | null,
  extractedOperationNumber: string | null
): Promise<ReceiptAutoValidationStatus> {
  if (extractedAmount === null && extractedAliasOrCvu === null && extractedOperationNumber === null) {
    return ReceiptAutoValidationStatus.PENDING_EXTRACTION;
  }

  if (extractedOperationNumber) {
    const duplicate = await prisma.paymentReceipt.findFirst({
      where: { tenantId, extractedOperationNumber, finalStatus: 'APPROVED' },
    });
    if (duplicate) return ReceiptAutoValidationStatus.DUPLICATE;
  }

  if (extractedAmount !== null && extractedAmount !== orderTotal) {
    return ReceiptAutoValidationStatus.AMOUNT_MISMATCH;
  }

  if (extractedAliasOrCvu) {
    const paymentConfig = await prisma.paymentConfig.findUnique({ where: { tenantId } });
    const configuredAliasOrCvu = [paymentConfig?.paymentAlias, paymentConfig?.paymentCvu]
      .filter(Boolean)
      .map((s) => s!.toLowerCase().trim());
    if (configuredAliasOrCvu.length && !configuredAliasOrCvu.includes(extractedAliasOrCvu.toLowerCase().trim())) {
      return ReceiptAutoValidationStatus.ALIAS_MISMATCH;
    }
  }

  return ReceiptAutoValidationStatus.MATCH;
}
