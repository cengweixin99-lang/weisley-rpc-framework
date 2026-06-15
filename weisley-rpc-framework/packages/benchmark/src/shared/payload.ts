export function createPayload(sizeBytes: number): string {
    return "x".repeat(sizeBytes);
}

export const PAYLOAD_SIZES = {
    small: 100,
    medium: 10 * 1024,
    large: 100 *1024
} as const
