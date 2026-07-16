# Security Specification - Biftu Beri Exam System

## Data Invariants
- A user profile must have a valid UID matching their Auth ID.
- An exam can only be created by an admin.
- Only the creator of an exam can modify or delete it.
- An attempt must be tied to the authenticated user.
- Answers can only be added to an "ongoing" attempt.
- Once an attempt is "completed" or "timed-out", it becomes immutable except for score calculation (which is handled in the final update).

## The Dirty Dozen (Test Cases)
1. **Identity Theft**: User A tries to create a profile with User B's UID. (Fails at `incoming().uid == request.auth.uid`)
2. **Role Escalation**: Student tries to change their role to 'admin' via `update`. (Fails at `affectedKeys().hasOnly(['name', 'grade', 'school'])`)
3. **Ghost Admin**: User tries to register as 'admin' with a non-allowed email. (Fails at `isValidUser` email check)
4. **Unauthorized Exam Creation**: Student tries to create an exam. (Fails at `isAdmin()`)
5. **Exam Hijacking**: Admin A tries to delete Admin B's exam. (Fails at `isOwner(existing().creatorId)`)
6. **Question Poisoning**: Student tries to read/write questions directly. (Fails at `isAdmin()` for write)
7. **Attempt Forgery**: User A starts an attempt on behalf of User B. (Fails at `incoming().userId == request.auth.uid`)
8. **Double Submission**: User tries to update a 'completed' attempt. (Fails at `existing().status == 'ongoing'`)
9. **Score Injection**: Student tries to update their own score without finishing. (Fails at `affectedKeys()` gate)
10. **Resource Exhaustion**: User sends a 1MB string as a question ID. (Fails at `isValidId()`)
11. **Shadow Writing**: User adds fields not in the blueprint to an exam. (Fails at `isValidExam` key size check)
12. **Orphaned Results**: User tries to list all results. (Fails at default deny or missing list rule)

## 평가 (Evaluation)
| Identity Spoofing | Pass | Enforced by `uid == auth.uid` and `isOwner()` |
| State Shortcutting | Pass | Enforced by `status` enum and terminal logic |
| Resource Poisoning | Pass | `isValidId` and `.size()` checks on all strings |
| PII Protection | Pass | Default deny on broad reads, `isOwner` for profiles |
