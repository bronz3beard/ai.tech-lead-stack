import { z } from 'zod';
import { MODEL_CATALOG, type KeySlot } from './model-registry';

export const RESPONSIBILITIES = [
  'planner',
  'implementer',
  'auditor',
  'adjudicator',
] as const;

export type Responsibility = (typeof RESPONSIBILITIES)[number];

const validModelId = z
  .string()
  .optional()
  .superRefine((val, ctx) => {
    if (val && !MODEL_CATALOG.some((m) => m.id === val)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Unknown model id "${val}". Must be an id from MODEL_CATALOG.`,
      });
    }
  });

export const ModelRoutingSchema = z
  .object({
    planner: validModelId,
    implementer: validModelId,
    auditor: validModelId,
    adjudicator: validModelId,
  })
  .partial();

export type ModelRouting = z.infer<typeof ModelRoutingSchema>;

export interface ModelOption {
  value: string;
  label: string;
  keySlot?: KeySlot;
}

export function getModelOptions(): ModelOption[] {
  return [
    { value: '', label: 'Inherit / system default' },
    ...MODEL_CATALOG.map((m) => ({
      value: m.id,
      label: m.label,
      keySlot: m.keySlot,
    })),
  ];
}
