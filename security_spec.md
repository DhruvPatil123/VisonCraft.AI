# Security Specification: VisionCraft AI

## Data Invariants
1. A generation must belong to the logged-in user.
2. Public generations are readable by everyone; private ones only by the owner.
3. Users cannot change the `userId` or `createdAt` of a generation once created.
4. Users cannot modify `likesCount` or `commentsCount` directly (must use transactions/functions-like logic via rules gating).
5. Admins (bootstrapped by email) have full access.

## The Dirty Dozen Payloads
1. **The Identity Spoof**: Creating a generation with someone else's `userId`.
2. **The Shadow Edit**: Updating a generation's `imageUrl` that you don't own.
3. **The Metadata Poisoning**: Injecting a 1MB string into the `prompt`.
4. **The Public/Private Leak**: Reading a private generation as another user.
5. **The ID Injection**: Using a long, malicious string as a `userId`.
6. **The Admin Escalation**: Trying to update own `role` to 'admin'.
7. **The Terminal State Break**: Changing `createdAt` on an existing generation.
8. **The Orphaned Comment**: Adding a comment to a non-existent generation.
9. **The Like Bomb**: Adding multiple likes from the same user (enforced by subcollection ID = userId).
10. **The PII Scraping**: Trying to list all users' private emails.
11. **The System Field Overwrite**: Directly incrementing `likesCount` without a corresponding `Like` document.
12. **The Verification Bypass**: Writing without a verified email (if strict verification is enabled).

## Verification Strategy
- Use `isValidId()` for all document IDs.
- Use `isValid[Entity]()` helpers for all writes.
- Enforce relational sync (e.g., getting the generation to check ownership).
- Use `affectedKeys().hasOnly()` for all updates.
