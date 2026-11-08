(() => {
  const FIELD_IDS = {
    salary: 'workerSalary', nationality: 'workerNationality', religion: 'workerReligion',
    age: 'workerAge', job: 'workerProfession', passport_number: 'workerPassport',
    experience: 'workerExperience'
  };

  function resetReviewEdits(form) {
    for (const id of Object.values(FIELD_IDS)) {
      const input = form?.querySelector?.('#' + id);
      if (input) delete input.dataset.reviewUserEdited;
    }
  }

  function applyExtractedFields(form, fields = {}) {
    for (const [source, id] of Object.entries(FIELD_IDS)) {
      const input = form?.querySelector?.('#' + id);
      if (!input) continue;
      if (!input.dataset.reviewEditListener) {
        input.addEventListener('input', () => { input.dataset.reviewUserEdited = 'true'; });
        input.dataset.reviewEditListener = 'true';
      }
      if (input.dataset.reviewUserEdited === 'true') continue;
      const value = fields[source];
      input.value = value == null ? '' : String(value);
    }
  }

  const api = { FIELD_IDS, resetReviewEdits, applyExtractedFields };
  if (typeof window !== 'undefined') window.RakaezCVFormMapping = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();
