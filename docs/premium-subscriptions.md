# Premium subscriptions

Only the configured founder account can manage subscriptions in Admin Portal →
Premium. Authority uses the immutable founder user id, rather than the username.

- **Grant duration** adds the selected number of days to an active subscription,
  or starts a new subscription if it has expired. Presets remain available;
  Custom days accepts whole numbers from 1 to 36,500.
- **Premium since** edits the history date shown in the badge tooltip. Editing
  this date alone preserves the existing expiry and consecutive streak.
- **Subscription duration** sets the total length of the uninterrupted
  subscription. **Days in a row** sets how much of that period has elapsed.
  The form previews the resulting expiry before saving. A 30-day duration with
  29 elapsed days leaves one day; 30 elapsed days ends it immediately.
- **Premium badge tier** can still be assigned independently of the streak.
  It clears when Premium expires or is removed.
- **Premium code duration** supports the same custom whole-day durations. Code
  redemption windows continue to control when an unused code can be redeemed.

A day is 24 hours, and the one-month preset is 30 days. Renewal is manual;
there is no automatic billing. Extending an active subscription preserves its
history and streak. Starting again after expiry resets the streak.

An inbox notification and in-app banner warn members during the final 24 hours.
Plans saved with one day or less remaining receive the notification immediately.
Each expiry has one notification; renewal clears the previous unread warning.

At expiry, the Premium badge, its assigned tier and Premium-only perks stop
automatically. The member account and its original Premium since history remain.
Server-side entitlement checks use the actual expiry, including upload/message
limits and Premium lounge access. Old scheduled warning and expiry jobs cannot
cancel a renewed subscription. A five-minute recovery job covers existing
subscriptions and missed scheduled jobs in bounded batches.

Premium tooltip headings use only the tier name, such as Premium or Ember.
Gifter tooltips share the appearance and keyboard focus support of other profile
badges. Completed gift counts remain independent of an active subscription.
