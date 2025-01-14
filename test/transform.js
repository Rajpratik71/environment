const assert = require('assert');
const path = require('path');
const sinon = require('sinon');
const {pipeline, passthrough} = require('p-transform');
const {
  fileIsModified,
  getConflicterStatusForFile,
  createEachFileTransform,
  createYoRcTransform,
  createConflicterStatusTransform
} = require('yeoman-environment/transform');

describe('Transform stream', () => {
  let unmodifiedFile;
  let newFile;
  let modifiedFile;
  let newDeletedFile;
  let yoRcFile;
  let yoRcGlobalFile;
  let yoResolveFile;
  let conflicterSkippedFile;

  let stream;
  let files;
  const unmodifiedFilesCount = 2;

  let sinonTransformPre;
  let sinonTransformPost;

  beforeEach(() => {
    unmodifiedFile = {path: 'unmodifiedFile'};
    newFile = {state: 'modified', isNew: true, path: 'newFile'};
    modifiedFile = {state: 'modified', path: 'modifiedFile'};
    newDeletedFile = {state: 'deleted', isNew: true, path: 'newDeletedFile'};
    yoRcFile = {state: 'modified', path: '.yo-rc.json'};
    yoRcGlobalFile = {state: 'modified', path: '.yo-rc-global.json'};
    yoResolveFile = {state: 'modified', path: '.yo-resolve'};
    conflicterSkippedFile = {state: 'modified', path: 'conflicterSkippedFile', conflicter: 'skip'};

    files = [
      unmodifiedFile,
      newFile,
      modifiedFile,
      newDeletedFile,
      yoRcFile,
      yoRcGlobalFile,
      yoResolveFile,
      conflicterSkippedFile
    ];

    sinonTransformPre = sinon.stub().callsFake(() => {});
    sinonTransformPost = sinon.stub().callsFake(() => {});

    stream = passthrough();
    for (const file of files) {
      stream.write(file);
    }
    stream.end();
  });

  describe('fileIsModified()', () => {
    it('should return false for unmodified file', () => {
      assert.equal(fileIsModified(unmodifiedFile), false);
    });

    it('should return true for modified file', () => {
      assert.equal(fileIsModified(modifiedFile), true);
    });

    it('should return true for new file', () => {
      assert.equal(fileIsModified(newFile), true);
    });

    it('should return false for new file that have been deleted', () => {
      assert.equal(fileIsModified(newFile), true);
    });
  });

  describe('createEachFileTransform()', () => {
    let sinonTransform;

    describe('sync functions', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform);
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every modified file and forward them through', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length - unmodifiedFilesCount);
        assert.equal(sinonTransformPost.callCount, files.length);
      });
    });

    describe('executeUnmodified option', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform, {executeUnmodified: true});
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every file and forward every file', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length);
        assert.equal(sinonTransformPost.callCount, files.length);
      });
    });

    describe('false forwardUmodified option', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform, {forwardUmodified: false});
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every modified file and forward modified files', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length - unmodifiedFilesCount);
        assert.equal(sinonTransformPost.callCount, files.length - unmodifiedFilesCount);
      });
    });

    describe('executeUnmodified and false forwardUmodified options', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform, {passUmodified: true, executeUnmodified: true});
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every modified file and forward every file', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length);
        assert.equal(sinonTransformPost.callCount, files.length);
      });
    });

    describe('false autoForward option', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform, {autoForward: false});
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every modified file and forward every file', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length - unmodifiedFilesCount);
        assert.equal(sinonTransformPost.callCount, 0);
      });
    });

    describe('false autoForward and executeUnmodified option', () => {
      beforeEach(async () => {
        sinonTransform = sinon.stub();

        const transform = createEachFileTransform(sinonTransform, {autoForward: false, executeUnmodified: true});
        await pipeline(stream, passthrough(sinonTransformPre), transform, passthrough(sinonTransformPost));
      });

      it('should call the function for every modified file and forward every file', () => {
        assert.equal(sinonTransformPre.callCount, files.length);
        assert.equal(sinonTransform.callCount, files.length);
        assert.equal(sinonTransformPost.callCount, 0);
      });
    });
  });

  describe('createYoRcTransform()', () => {
    beforeEach(async () => {
      for (const file of [yoRcFile, yoRcGlobalFile, yoResolveFile]) {
        assert.equal(file.conflicter, undefined);
      }
      await pipeline(stream, passthrough(sinonTransformPre), createYoRcTransform(), passthrough(sinonTransformPost));
    });

    it('should call the function for every modified file and forward them through', () => {
      assert.equal(sinonTransformPre.callCount, files.length);
      assert.equal(sinonTransformPost.callCount, files.length);
      for (const file of files) {
        if ([yoRcFile, yoRcGlobalFile, yoResolveFile].includes(file)) {
          assert.equal(file.conflicter, 'force');
        }
      }
    });
  });

  describe('createConflicterStatusTransform()', () => {
    let adapter;
    beforeEach(async () => {
      adapter = {skip: sinon.fake()};
      await pipeline(stream, passthrough(sinonTransformPre), createConflicterStatusTransform(adapter), passthrough(sinonTransformPost));
    });

    it('should forward modified and not skipped files', () => {
      assert.equal(sinonTransformPre.callCount, files.length);
      assert.equal(sinonTransformPost.callCount, files.length - 1);
      for (const file of files) {
        assert.equal(file.conflicter, undefined);
        assert.equal(file.binary, undefined);
        assert.equal(file.conflicterChanges, undefined);
        assert.equal(file.conflicterLog, undefined);
      }
    });

    it('should clear the state of skipped file', () => {
      assert.equal(conflicterSkippedFile.state, undefined);
      assert.equal(conflicterSkippedFile.isNew, undefined);
      assert.equal(conflicterSkippedFile.stateCleared, 'modified');
    });
  });

  describe('getConflicterStatusForFile()', () => {
    const yoResolveRoot = path.join(__dirname, 'fixtures', 'yo-resolve');
    const yoResolveSub = path.join(yoResolveRoot, 'sub');
    const rootToSkipFile = path.join(yoResolveRoot, 'root-to-skip');
    const subToSkipFile = path.join(yoResolveSub, 'sub-to-skip');
    const sub2ToForceFile = path.join(yoResolveSub, 'sub2-to-force');
    const noResolveFile = path.join(yoResolveSub, 'no-resolve');
    const matchToSkipFile = path.join(yoResolveSub, 'match-to-skip');

    it('should return correct status for root-to-skip', () => {
      assert.strictEqual(getConflicterStatusForFile({}, rootToSkipFile), 'skip');
    });

    it('should return correct status for sub-to-skip', () => {
      assert.strictEqual(getConflicterStatusForFile({}, subToSkipFile), 'skip');
    });

    it('should return correct status for sub2-to-force', () => {
      assert.strictEqual(getConflicterStatusForFile({}, sub2ToForceFile), 'force');
    });

    it('should return correct status for no-resolve', () => {
      assert.strictEqual(getConflicterStatusForFile({}, noResolveFile), undefined);
    });

    it('should return correct status for match-to-skip', () => {
      assert.strictEqual(getConflicterStatusForFile({}, matchToSkipFile), 'skip');
    });
  });
});
