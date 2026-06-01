import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Validates Mercado Pago webhook signature using HMAC-SHA256.
 * 
 * The x-signature header contains: ts={timestamp},v1={hash}
 * The manifest format is: id:{dataId};request-id:{xRequestId};ts:{ts};
 * 
 * @see https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 */
export function validateWebhookSignature(
    xSignature: string,
    xRequestId: string,
    dataId: string,
    secret: string
): boolean {
    try {
        // Parse "ts=123456,v1=abcdef..." into { ts, v1 }
        const parts: Record<string, string> = {};
        xSignature.split(',').forEach(part => {
            const eqIdx = part.indexOf('=');
            if (eqIdx > 0) {
                const key = part.substring(0, eqIdx).trim();
                const value = part.substring(eqIdx + 1);
                parts[key] = value;
            }
        });

        const { ts, v1 } = parts;
        if (!ts || !v1) {
            console.error('[MP Webhook] Missing ts or v1 in x-signature');
            return false;
        }

        // Build the manifest string exactly as Mercado Pago expects
        const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;

        // Calculate HMAC-SHA256
        const hmac = createHmac('sha256', secret);
        hmac.update(manifest);
        const expectedSignature = hmac.digest('hex');

        // Constant-time comparison to prevent timing attacks
        if (v1.length !== expectedSignature.length) {
            return false;
        }

        return timingSafeEqual(
            Buffer.from(v1, 'hex'),
            Buffer.from(expectedSignature, 'hex')
        );
    } catch (error) {
        console.error('[MP Webhook] Signature validation error:', error);
        return false;
    }
}

/**
 * Parses the external_reference string to extract group and user IDs.
 * Format: "entry_fee:{groupId}:{userId}"
 */
export function parseExternalReference(ref: string): {
    type: string;
    groupId: string;
    userId: string;
} | null {
    if (!ref) return null;

    const parts = ref.split(':');
    if (parts.length !== 3) return null;

    return {
        type: parts[0],    // 'entry_fee'
        groupId: parts[1],
        userId: parts[2],
    };
}
