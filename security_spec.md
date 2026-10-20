# Security Specification - Bashar Youtube Grow

## 1. Data Invariants

1. **User Ownership & Balance Integrity**:
   - `/users/{userId}` can only be read or written by the authenticated user whose `request.auth.uid == userId`.
   - Users cannot arbitrarily grant themselves infinite credits or impersonate another user UID.
   - Initial user profile creation is bounded to 500 starting credits.

2. **Video View Campaigns**:
   - Campaigns must have valid videoId (format safe), targetSeconds within the allowlist `[30, 45, 60, 120, 180, 300, 600]`, costPerView == targetSeconds.
   - Target views must be positive integer (>= 1).
   - Only the campaign creator (`userId == request.auth.uid`) can edit configuration, pause, or delete the campaign.
   - Other users can ONLY increment `completedViews` when marking a view completed.

3. **Subscribe Campaigns**:
   - Cost per subscriber is strictly 100 credits (`costPerSub == 100`).
   - Only the campaign creator can edit status or delete.
   - Other users can ONLY increment `completedSubs` when verifying a subscription.

4. **Reward Records (Views & Subscribes)**:
   - ViewRecord and SubscribeRecord documents can only be created by the viewer/subscriber (`userId == request.auth.uid`).
   - Credits earned in ViewRecord must equal secondsWatched (1 credit per second).
   - Credits earned in SubscribeRecord must equal 100.
   - Users cannot list or inspect other users' private record histories.

5. **Transactions Ledger**:
   - Users can only read and create transaction logs associated with their own `userId == request.auth.uid`.

## 2. The "Dirty Dozen" Threat Payloads (Must be blocked)

1. **Impersonate User Profile Creation**: Creating `/users/target_victim_123` with `request.auth.uid = attacker_456`.
2. **Arbitrary Credit Elevation**: Direct update of `/users/{userId}` adding 1,000,000 credits without valid action.
3. **Ghost Field Poisoning**: Injecting `{ "isAdmin": true, "superUser": true }` into user doc.
4. **Invalid Duration Injection**: Creating a VideoCampaign with `targetSeconds: 1` or `targetSeconds: 999999` to cheat reward math.
5. **Campaign Hijacking**: User B modifying User A's campaign `userId` or `videoUrl`.
6. **False Completion Spoofing**: An attacker updating a VideoCampaign's `completedViews` by jumping from 0 to 1,000,000 instantly.
7. **Negative or Zero Target Views**: Creating a campaign with `-50` views or `0` views.
8. **View Record Credit Inflation**: Creating a ViewRecord with `secondsWatched: 30` but claiming `creditsEarned: 5000`.
9. **Subscribe Record Credit Inflation**: Creating a SubscribeRecord with `creditsEarned: 5000` instead of 100.
10. **Foreign View Record Snooping**: Attacker listing another user's view and subscribe records.
11. **ID Length / Resource Exhaustion**: Injecting a 2MB string as document ID or video title.
12. **Unauthenticated Access**: Reading or writing any collection when `request.auth == null`.
