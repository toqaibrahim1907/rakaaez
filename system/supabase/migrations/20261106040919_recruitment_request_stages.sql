alter table public.operations_recruitment
  drop constraint operations_recruitment_stage_check,
  add constraint operations_recruitment_stage_check check (
    stage in (
      'request', 'visa', 'cv', 'screening', 'travel', 'arrival', 'handover',
      'completed', 'cancelled', 'worker_selected', 'medical_passed', 'paperwork_fingerprint_done'
    )
  );
