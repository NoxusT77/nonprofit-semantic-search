import { call } from "../src/infrai.ts";
import { EMBEDDING_DIMENSION } from "../src/embed.ts";
import { COLLECTION, nonprofitRecord, type NonprofitRecord } from "../src/nonprofit_records.ts";
import { indexRecords } from "../src/search_nonprofit_content.ts";

const CORPUS: NonprofitRecord[] = [
  {
    id: "receipt-2026-0417",
    kind: "donor_receipt",
    program: "winter-meals",
    text: "Receipt 2026-0417: Dana Okafor gave $250 to the winter meals program on 3 January. No goods or services were exchanged; the full amount is deductible.",
  },
  {
    id: "receipt-2026-0418",
    kind: "donor_receipt",
    program: "tutoring",
    text: "Receipt 2026-0418: a recurring monthly gift of $40 toward after-school tutoring, charged on the first of each month.",
  },
  {
    id: "reminder-saturday-kitchen",
    kind: "volunteer_reminder",
    program: "winter-meals",
    text: "Saturday kitchen shift starts at 07:30 at the Fremont depot. Bring closed shoes. Reply STOP to pause reminders for this program.",
  },
  {
    id: "reminder-tutoring-intake",
    kind: "volunteer_reminder",
    program: "tutoring",
    text: "Tutor intake session moves to Thursday 18:00. Bring your background check confirmation number if you have not sent it yet.",
  },
  {
    id: "report-q1-winter-meals",
    kind: "campaign_report",
    program: "winter-meals",
    text: "Winter meals served 12,400 hot meals in Q1 across three depots. Volunteer hours rose 18% after we moved reminders to SMS.",
  },
  {
    id: "report-q1-tutoring",
    kind: "campaign_report",
    program: "tutoring",
    text: "After-school tutoring matched 96 students with 41 tutors in Q1. Retention past week six was 74%, the highest since the program began.",
  },
];

const records = CORPUS.map((r) => nonprofitRecord.parse(r));

await call("/vector/collection/create", {
  collection: COLLECTION,
  dimension: EMBEDDING_DIMENSION,
  metric: "cosine",
  metadata: { owner: "programs-team" },
});

const count = await indexRecords(records);
console.log(`indexed ${count} records into ${COLLECTION}`);
