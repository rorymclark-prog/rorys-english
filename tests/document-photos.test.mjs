import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(file, dependencies = {}) {
  const exports = {};
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(source, {exports, require: name => dependencies[name] || {}});
  return exports;
}
const documents = load('src/lib/documents.ts');
const photos = load('src/lib/document-photos.ts', {'./documents': documents});
const photo = (size, type = 'image/jpeg', name = 'page.jpg') => ({size,type,name});
test('large phone photos are accepted for preparation while transport still refuses raw originals', () => {
  const pages = Array.from({length:6}, () => photo(8_000_000));
  assert.equal(photos.validateDocumentSelection(pages), '');
  assert.ok(documents.validateDocumentFiles(pages));
  assert.equal(photos.validateDocumentSelection([photo(20_000_000)]), '');
  assert.ok(photos.validateDocumentSelection([photo(20_000_001)]));
});
test('photo selection keeps file count, empty file and non-image limits enforced', () => {
  for (const files of [[], Array.from({length:7}, () => photo(100)), [photo(0)], [photo(3_000_000,'application/pdf','work.pdf')], [photo(100,'text/html','work.html')], [photo(100),photo(100,'application/pdf','work.pdf')]]) {
    assert.ok(photos.validateDocumentSelection(files));
  }
  assert.equal(photos.validateDocumentSelection([photo(100,'image/heic','phone.heic')]), '');
});
test('small supported photo originals and valid non-image documents pass through unchanged', async () => {
  for (const files of [[photo(200_000),photo(200_000,'image/png','page2.png')], [photo(200_000,'application/pdf','work.pdf')]]) {
    assert.equal(await photos.prepareDocumentFiles(files), files);
  }
  await assert.rejects(photos.prepareDocumentFiles([photo(30_000_000)]), /20 MB/);
});
const source = load('src/lib/work-source.ts');
test('school, tutoring and independent sources persist with task context for analysis and revisions', () => {
  for (const kind of ['school','tutor','practice','unspecified']) {
    const task = 'Photo 1 is the school prompt; photos 2 and 3 are the completed essay.';
    const saved = source.workContext(kind,task), read = source.readWorkContext(saved);
    assert.equal(read.source,kind); assert.equal(read.task,task);
    assert.equal(source.workContext(kind,saved),saved,'a revision must not duplicate the source label');
    assert.ok(source.workContext(kind,'a'.repeat(2200)).length<=2000);
  }
  assert.equal(source.readWorkContext('Older source context').source,'unspecified');
});
