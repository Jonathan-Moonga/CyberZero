# SpacetimeDB module contract

The desktop MVP uses a local durable mirror until `CYBERZERO_SPACETIMEDB_URI` and a deployed module are available. The production module must expose these tables:

- `User(id, name, role, department, contact, status)`
- `Invitation(id, invited_by_user_id, invited_user_name, contact, department, role, status, expires_at, photon_message_id, created_at)`
- `RecoveryGrant(id, invitation_id, backup_id, department, wrapped_data_key, salt, iv, auth_tag, used_at, revoked_at)`
- `BackupVersion(id, version, created_by_user_id, created_at, encrypted_path, manifest_hash, size_bytes, status, departments_json, last_verified_at)`
- `DetectionEvent(id, occurred_at, category, severity, source_ip, destination_ip, account, workstation, room, description, status)`
- `BreachSimulation(id, scenario, current_state, transfer_rate_gb_per_minute, transferred_gb, started_at, isolated_at)`
- `AgentMessage(id, role, content, source, created_at)`
- `AuditEntry(id, actor, action, details, created_at)`

Required reducers: `create_backup_metadata`, `verify_backup`, `create_invitation`, `mark_invitation_sent`, `accept_invitation`, `revoke_invitation`, `create_recovery_grant`, `mark_grant_used`, `create_detection_event`, `start_breach_simulation`, `update_breach_state`, `record_agent_message`, and `append_audit_entry`.

Large encrypted archives stay on the local filesystem. SpacetimeDB stores metadata and wrapped key material only.
