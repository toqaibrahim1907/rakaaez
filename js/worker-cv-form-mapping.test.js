const test = require('node:test');
const assert = require('node:assert/strict');
const { applyExtractedFields, resetReviewEdits } = require('./worker-cv-form-mapping.js');

function fakeInput() {
  const listeners = {};
  return {
    value: '', dataset: {},
    addEventListener(name, handler) { listeners[name] = handler; },
    dispatch(name) { listeners[name]?.(); }
  };
}

function fakeForm() {
  const inputs = new Map(['workerSalary', 'workerNationality', 'workerReligion', 'workerAge', 'workerProfession', 'workerPassport', 'workerExperience'].map(id => [id, fakeInput()]));
  return { inputs, querySelector(selector) { return inputs.get(selector.slice(1)); } };
}

test('normalized fields populate the review form, and later extraction fills do not replace staff edits', () => {
  const form = fakeForm();
  applyExtractedFields(form, { nationality: 'كينيا', age: 38, experience: 2.5 });
  assert.equal(form.inputs.get('workerNationality').value, 'كينيا');
  assert.equal(form.inputs.get('workerAge').value, '38');
  assert.equal(form.inputs.get('workerExperience').value, '2.5');

  const nationality = form.inputs.get('workerNationality');
  nationality.value = 'الفلبين';
  nationality.dispatch('input');
  applyExtractedFields(form, { nationality: 'كينيا', age: 39 });
  assert.equal(nationality.value, 'الفلبين');
  assert.equal(form.inputs.get('workerAge').value, '39');
});

test('a new CV review resets edit guards before applying its own result', () => {
  const form = fakeForm();
  applyExtractedFields(form, { nationality: 'كينيا' });
  const input = form.inputs.get('workerNationality');
  input.value = 'تعديل الموظف';
  input.dispatch('input');
  resetReviewEdits(form);
  applyExtractedFields(form, { nationality: 'الفلبين' });
  assert.equal(input.value, 'الفلبين');
});
