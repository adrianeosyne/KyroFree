import { cronJobs, makeFunctionReference } from "convex/server";
import {
  cleanupEmailRecordsRef,
  kickDueEmailsRef,
  notifyExpiredBansRef,
} from "./emailRefs";

const crons = cronJobs();
crons.interval(
  "reconcile Premium warnings and expiry",
  { minutes: 5 },
  makeFunctionReference<"mutation">("premium:reconcileExpirations"),
  {},
);
crons.interval(
  "expire presence leases",
  { minutes: 1 },
  makeFunctionReference<"mutation">("presence:expire"),
  {},
);
crons.interval(
  "deliver bot webhooks",
  { minutes: 1 },
  makeFunctionReference<"action">("botWebhooks:deliverDue"),
  {},
);
crons.interval(
  "expire bot events",
  { hours: 1 },
  makeFunctionReference<"mutation">("botDelivery:cleanup"),
  {},
);

crons.interval(
  "retry transactional emails",
  { minutes: 5 },
  kickDueEmailsRef,
  {},
);
crons.interval(
  "clean expired verification records",
  { hours: 1 },
  cleanupEmailRecordsRef,
  {},
);
crons.interval(
  "email expired-ban restorations",
  { minutes: 15 },
  notifyExpiredBansRef,
  {},
);

export default crons;
