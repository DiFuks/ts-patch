import * as fs from 'fs';
import * as path from 'path';
import chai, { expect } from 'chai';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';
import { ScriptTarget } from 'typescript/lib/tsserverlibrary';
import { newFiles } from '../transforms/program-transformer';


chai.use(sinonChai);


/* ********************************************************************************************************************
 * Constants
 * ********************************************************************************************************************/

declare const ts: typeof import('typescript');

const safelyCode = fs.readFileSync(path.join(__dirname, '../assets/safely-code.ts')).toString();
const safelyExpected =
  /^var a = { b: 1 };*[\s\r\n]*function abc\(\) {[\s\r\n]*var c = a && a.b;*[\s\r\n]*}[\s\r\n]*console.log\(abc.toString\(\)\);*$/m;

const basicCode = 'var a = 1';
const basicExpected = /^[\s\r\n]*var a = 1;*[\s\r\n]*$/m;


/* ********************************************************************************************************************
 * Tests
 * ********************************************************************************************************************/

export default function suite() {
  it('Applies transformer from legacy config', () => {
    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          customTransformers: { before: [ path.join(__dirname, '../transforms/safely.ts') ] },
        } ] as any,
      },
    });

    expect(res.outputText).to.match(safelyExpected);
  });

  it('Applies transformer from default config', () => {
    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          transform: path.join(__dirname, '../transforms/safely.ts'),
        } ] as any,
      },
    });

    expect(res.outputText).to.match(safelyExpected);
  });

  it('Merges transformers', () => {
    const customTransformer = sinon.spy((sf: any) => sf);

    const res = ts.transpileModule(safelyCode, {
      compilerOptions: {
        plugins: [ {
          transform: path.join(__dirname, '../transforms/safely.ts'),
        } ] as any,
      },
      transformers: { before: [ () => customTransformer ] },
    });

    expect(res.outputText).to.match(safelyExpected);
    expect(customTransformer.calledOnce).to.be.true;
  });

  it('Custom Diagnostics Merge in EmitResult', () => {
    const compilerOptions = {
      target: ScriptTarget.ES5,
      plugins: [ {
        transform: path.join(__dirname, '../transforms/alter-diagnostics.ts'),
      } ] as any,
    };

    const program = ts.createProgram([], compilerOptions);
    const res = program.emit(ts.createSourceFile('a', '', ScriptTarget.ES5), /* writeFile */ () => {});

    expect(Boolean(res.diagnostics.find(({ code }) => code === 1337))).to.be.true;
  });

  it('Runs 3rd party transformers', () => {
    const res = ts.transpileModule(basicCode, {
      compilerOptions: {
        plugins: [
          { transform: 'ts-transformer-keys/transformer' },
          { transform: 'ts-transformer-enumerate/transformer' },
          { transform: 'ts-transform-graphql-tag/dist/transformer' },
          { transform: 'ts-transform-img/dist/transform', type: 'config' },
          { transform: 'ts-transform-css-modules/dist/transform', type: 'config' },
          { transform: 'ts-transform-react-intl/dist/transform', type: 'config', import: 'transform' },
          { transform: 'ts-nameof', type: 'raw' },
        ] as any,
      },
    });

    expect(res.outputText).to.match(basicExpected);
  });

  it('Skips ts plugin without errors', () => {
    const res = ts.transpileModule(basicCode, {
      compilerOptions: {
        plugins: [ { name: 'foobar' } ],
      },
    });
    expect(res.outputText).to.match(basicExpected)
  });

  it('transformProgram transforms Program', () => {
    const safelyFile = path.join(__dirname, '../assets/safely-code.ts');
    const plugins: any[] = [
      { transform: path.join(__dirname, '../transforms/program-transformer.ts'), beforeEmit: true, import: 'progTransformer1' },
      { transform: path.join(__dirname, '../transforms/program-transformer.ts'), beforeEmit: true, import: 'progTransformer2' }
    ];
    const compilerOptions: ts.CompilerOptions = {
      ...ts.getDefaultCompilerOptions(),
      lib: undefined,
      types: undefined,
      noEmit: undefined,
      noEmitOnError: undefined,
      paths: undefined,
      rootDirs: undefined,
      composite: undefined,
      declarationDir: undefined,
      out: undefined,
      outFile: undefined,
      noResolve: true,
      noLib: true
    }

    /* Transform once */
    let program = ts.createProgram([ safelyFile ], { ...compilerOptions, plugins: plugins.slice(0, 1) });
    expect(!!program.getSourceFile(newFiles[0])).to.be.true;
    expect(!!program.getSourceFile(newFiles[1])).to.be.false;

    /* Transform twice */
    program = ts.createProgram([ safelyFile ], { ...compilerOptions, plugins });
    expect(!!program.getSourceFile(newFiles[0])).to.be.false;
    expect(!!program.getSourceFile(newFiles[1])).to.be.true;
  });
}
