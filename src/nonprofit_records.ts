import { z } from "zod";

export const COLLECTION = "nonprofit-content";

/** The three kinds of text a small nonprofit actually accumulates. */
export const recordKind = z.enum(["donor_receipt", "volunteer_reminder", "campaign_report"]);
export type RecordKind = z.infer<typeof recordKind>;

export const nonprofitRecord = z.object({
  id: z.string().min(1),
  kind: recordKind,
  program: z.string().min(1),
  text: z.string().min(1),
});
export type NonprofitRecord = z.infer<typeof nonprofitRecord>;

/** Who is asking. A program volunteer must never see a donor's receipt. */
export const viewerRole = z.enum(["volunteer", "program_lead", "finance"]);
export type ViewerRole = z.infer<typeof viewerRole>;

export const searchRequest = z.object({
  query: z.string().min(3).max(400),
  role: viewerRole,
  program: z.string().min(1).optional(),
  limit: z.number().int().min(1).max(20).default(5),
});
export type SearchRequest = z.infer<typeof searchRequest>;

const VISIBLE_KINDS: Record<ViewerRole, RecordKind[]> = {
  volunteer: ["volunteer_reminder"],
  program_lead: ["volunteer_reminder", "campaign_report"],
  finance: ["donor_receipt", "volunteer_reminder", "campaign_report"],
};

/**
 * The business decision this service exists for: the caller's role, not the
 * caller's query, decides which kinds of content can come back. The result is
 * a metadata filter that goes straight into the vector query.
 */
export function scopeFilter(req: SearchRequest): { kind: { $in: RecordKind[] }; program?: string } {
  const filter: { kind: { $in: RecordKind[] }; program?: string } = {
    kind: { $in: VISIBLE_KINDS[req.role] },
  };
  if (req.program) filter.program = req.program;
  return filter;
}
