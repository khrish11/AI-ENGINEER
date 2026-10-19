# Privacy

Guest learning data remains in the browser's IndexedDB until the learner
chooses to export, reset, or sign in and synchronize. Authenticated sync is
scoped to the session user and returns private data with `no-store`.

Public portfolios use an explicit allow-list serializer. Email addresses,
provider identifiers, internal user IDs, device IDs, notes, quiz answers,
study sessions, conflicts, weakness signals, and unpublished evidence are not
public fields.

Authenticated learners can permanently delete their application account and
synchronized learning data from Settings. The deletion is performed
transactionally and removes the application user, Auth.js sessions and account
links, devices, portfolio data, progress, notes, study history, assessments,
project evidence, roadmap state, review history, and synchronization records.
Local IndexedDB data is reset after the cloud deletion succeeds. OAuth provider
accounts are external and are never implied to be deleted by this application.
