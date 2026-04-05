# Backend Integration Checklist

## Purpose
Use this checklist to replace frontend mock data and hardcoded flows with real backend APIs and database persistence.

## Suggested API Surface

### Auth
- `POST /api/auth/signup`: Create user account.
- `POST /api/auth/login`: Validate credentials, issue session/JWT.
- `GET /api/auth/me`: Return current authenticated user profile.
- `POST /api/auth/logout`: Invalidate session/token.

### Datasets
- `GET /api/datasets`: List datasets for current user.
- `POST /api/datasets`: Upload dataset file and create dataset record.
- `GET /api/datasets/:datasetId/features`: Return parsed schema/features for selected dataset.

### Analyses
- `GET /api/analyses`: List analysis history for current user.
- `POST /api/analyses`: Submit analysis request (dataset + target + frozen features).
- `GET /api/analyses/:analysisId`: Get analysis metadata and status.
- `GET /api/analyses/:analysisId/results`: Get SHAP summary/features and DiCE counterfactuals.

## Suggested Database Entities
- `users`: id, name, email, password_hash, created_at.
- `sessions` (or token store): id, user_id, token_hash, expires_at, created_at.
- `datasets`: id, user_id, name, storage_uri, row_count, uploaded_at.
- `dataset_features`: id, dataset_id, name, data_type, is_target_candidate.
- `analyses`: id, user_id, dataset_id, model_name, target_feature, status, created_at, completed_at.
- `analysis_shap_features`: id, analysis_id, feature_name, importance.
- `analysis_counterfactuals`: id, analysis_id, feature_name, original_value, suggested_value.

## TODO-to-Backend Mapping

| Frontend TODO | Current Mock Purpose | Backend Replacement |
|---|---|---|
| `Dashboard` seeded analyses in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L40) | Demo analysis history + details in UI | Fetch from `GET /api/analyses` and `GET /api/analyses/:analysisId/results` backed by `analyses`, `analysis_shap_features`, `analysis_counterfactuals`. |
| `Dashboard` existing datasets in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L112) | Demo dataset picker content | Fetch from `GET /api/datasets` backed by `datasets`. |
| `Dashboard` user profile state in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L154) | Show profile modal without auth backend | Use `GET /api/auth/me` backed by `users` and active `sessions`. |
| Upload mock features in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L175) | Keep feature config usable after upload | After `POST /api/datasets`, call `GET /api/datasets/:datasetId/features` backed by `dataset_features`. |
| Dataset feature fallback in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L196) | Guard against missing schema in mocks | Remove fallback once schema is required/validated in `dataset_features`. |
| Local synthesized analysis payload in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L211) | Simulate completed analysis output | Submit `POST /api/analyses`, then poll/get `GET /api/analyses/:analysisId` and results endpoint. |
| Client-side ID generation in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L214) | Temporary unique key | Use server-generated analysis IDs from `analyses.id`. |
| Synthetic SHAP importances in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L224) | Demo explainability section | Persist and return real SHAP values via `analysis_shap_features`. |
| Placeholder counterfactuals in [src/app/components/Dashboard.tsx](src/app/components/Dashboard.tsx#L235) | Demo DiCE section | Persist and return real DiCE output via `analysis_counterfactuals`. |
| Mock login in [src/app/components/Login.tsx](src/app/components/Login.tsx#L15) | Allow navigation without auth | Replace with `POST /api/auth/login`; store token/session and handle errors. |
| Mock signup in [src/app/components/Signup.tsx](src/app/components/Signup.tsx#L18) | Allow registration flow demo | Replace with `POST /api/auth/signup`; validate conflicts and password policy. |
| Root route hardcoded in [src/app/routes.ts](src/app/routes.ts#L9) | Bypass auth guard | Route by auth state from `GET /api/auth/me` or token presence + validation. |

## Execution Checklist

### Phase 1: Auth Foundation
- [ ] Implement signup/login/logout/me endpoints.
- [ ] Add password hashing and secure session or JWT strategy.
- [ ] Add frontend auth service and replace mock navigation in login/signup.
- [ ] Add route guard for `/dashboard` and default route decision.

### Phase 2: Dataset Integration
- [ ] Implement dataset upload endpoint and file storage strategy.
- [ ] Parse and persist dataset schema/features.
- [ ] Replace hardcoded dataset list with API-driven list.
- [ ] Replace upload mock feature generation with backend schema retrieval.

### Phase 3: Analysis Pipeline Integration
- [ ] Implement analysis submission endpoint.
- [ ] Persist analysis records with lifecycle status (`queued`, `running`, `completed`, `failed`).
- [ ] Integrate SHAP and DiCE outputs into persistent tables.
- [ ] Replace local synthetic analysis object creation with API flow.

### Phase 4: Hardening and Cleanup
- [ ] Remove all mock fallbacks and hardcoded profile/demo entries.
- [ ] Add loading, empty, and error states for each API call.
- [ ] Add backend validation and frontend input/schema guards.
- [ ] Add audit logging and monitoring for auth, upload, and analysis jobs.

## Acceptance Criteria
- No UI view depends on seeded in-memory domain data for normal dashboard/auth flows.
- User/session identity is backend-validated.
- Dataset and analysis records survive refresh/restart (database-backed).
- SHAP and DiCE sections render backend-provided values only.
- Route access to dashboard is protected by auth state.
