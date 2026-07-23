import { z } from 'zod';
import { noteRejectionReason } from './domain/sanitize.js';

const optionalTrimmedText = (maximum: number) =>
  z.string().trim().max(maximum).nullable().optional();

const noteSchema = optionalTrimmedText(280).superRefine((note, context) => {
  if (note === null || note === undefined || note.length === 0) return;
  const reason = noteRejectionReason(note);
  if (reason !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `La nota contiene un patrón no permitido (${reason}). No incluyas datos personales, HTML ni enlaces.`,
    });
  }
});

const evidenceSchema = z
  .object({
    licenseNumber: optionalTrimmedText(80).superRefine((licenseNumber, context) => {
      if (licenseNumber === null || licenseNumber === undefined || licenseNumber.length === 0) {
        return;
      }
      if (!/^(?=.*\p{L})(?=.*\p{N})[\p{L}\p{N}._/-]+$/u.test(licenseNumber)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'La licencia debe contener letras y números, sin espacios ni datos personales.',
        });
      }
    }),
    platform: z.enum(['airbnb', 'booking', 'otra']).nullable().optional(),
    note: noteSchema,
  })
  .strict()
  // The web SDK encodes `undefined` as null in transit, so both must be valid.
  .nullable()
  .optional();

const locationSchema = z
  .object({
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
  })
  .strict();

export const createListingSchema = z
  .object({
    type: z.enum(['unit', 'building', 'commercial']),
    dwellingsCount: z.number().int().min(1).max(500),
    location: locationSchema.optional(),
    address: z.string().trim().min(3).max(500).optional(),
    placeId: z.string().trim().min(3).max(300).optional(),
    evidence: evidenceSchema,
    commercialUnitsCount: z.number().int().min(0).max(50).nullable().optional(),
    streetViewHeading: z.number().finite().min(-180).max(360).nullable().optional(),
    streetViewPanoId: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[\w-]+$/u, 'El identificador de panorama no es válido.')
      .nullable()
      .optional(),
    duplicateAcknowledged: z.boolean().optional(),
    officialMatchAcknowledged: z.boolean().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    const hasLocation = input.location !== undefined;
    const hasAddress = input.address !== undefined;
    const hasPlaceId = input.placeId !== undefined;
    // Coordinates may accompany an address/placeId: the address names the
    // portal and the coordinates pin it exactly (pedestrian streets often
    // have misplaced address anchors in Google's database).
    if ((!hasLocation && !hasAddress && !hasPlaceId) || (hasAddress && hasPlaceId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Indica una ubicación, una dirección o un placeId (los dos últimos no juntos).',
        path: ['location'],
      });
    }
    if (input.type !== 'building' && input.dwellingsCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Un apartamento individual o un local comercial debe representar exactamente una unidad.',
        path: ['dwellingsCount'],
      });
    }
    if (
      input.type === 'unit' &&
      input.commercialUnitsCount !== undefined &&
      input.commercialUnitsCount !== null &&
      input.commercialUnitsCount !== 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un apartamento individual no puede declarar locales comerciales.',
        path: ['commercialUnitsCount'],
      });
    }
    if (
      input.type === 'commercial' &&
      input.commercialUnitsCount !== undefined &&
      input.commercialUnitsCount !== null &&
      input.commercialUnitsCount < 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un local comercial convertido debe representar al menos un local.',
        path: ['commercialUnitsCount'],
      });
    }
  });

export type CreateListingInput = z.infer<typeof createListingSchema>;

const firestoreIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(256)
  .refine((value) => !value.includes('/'), 'El id no es válido.');

const deviceFingerprintHashSchema = z
  .string()
  .trim()
  .regex(/^[a-fA-F0-9]{64}$/u, 'El hash de dispositivo debe ser SHA-256 hexadecimal.');

export const voteListingSchema = z
  .object({
    listingId: firestoreIdSchema,
    kind: z.enum(['confirm', 'report']),
    deviceFingerprintHash: deviceFingerprintHashSchema,
  })
  .strict();

export type VoteListingInput = z.infer<typeof voteListingSchema>;

// 4 MiB binary ≈ 5.6M base64 characters; the byte limit is re-checked after decoding.
export const submitListingPhotoSchema = z
  .object({
    listingId: firestoreIdSchema,
    deviceFingerprintHash: deviceFingerprintHashSchema,
    imageBase64: z
      .string()
      .min(200)
      .max(5_800_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/u, 'La imagen debe llegar en base64.'),
  })
  .strict();

export type SubmitListingPhotoInput = z.infer<typeof submitListingPhotoSchema>;

export const pendingPhotoSchema = z.object({ photoId: firestoreIdSchema }).strict();

export const reviewListingPhotoSchema = z
  .object({
    photoId: firestoreIdSchema,
    decision: z.enum(['approve', 'reject']),
  })
  .strict();

export type ReviewListingPhotoInput = z.infer<typeof reviewListingPhotoSchema>;

export const adminUpdateListingSchema = z
  .object({
    listingId: firestoreIdSchema,
    type: z.enum(['unit', 'building', 'commercial']),
    dwellingsCount: z.number().int().min(1).max(500),
    commercialUnitsCount: z.number().int().min(0).max(50).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.type !== 'building' && input.dwellingsCount !== 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Solo un edificio puede declarar más de una vivienda.',
        path: ['dwellingsCount'],
      });
    }
    if (input.type === 'unit' && (input.commercialUnitsCount ?? 0) !== 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un apartamento individual no puede declarar locales comerciales.',
        path: ['commercialUnitsCount'],
      });
    }
    if (input.type === 'commercial' && (input.commercialUnitsCount ?? 1) < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Un local comercial convertido debe representar al menos un local.',
        path: ['commercialUnitsCount'],
      });
    }
  });

export const adminDeleteListingSchema = z.object({ listingId: firestoreIdSchema }).strict();

export const adminResolveOfficialMatchSchema = z.object({ listingId: firestoreIdSchema }).strict();

export const adminSetListingPhotoSchema = z
  .object({
    listingId: firestoreIdSchema,
    imageBase64: z
      .string()
      .min(200)
      .max(5_800_000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/u, 'La imagen debe llegar en base64.')
      .nullable(),
  })
  .strict();
