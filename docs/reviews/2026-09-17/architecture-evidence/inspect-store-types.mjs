import ts from 'typescript';

// Run from the repository root with node. Inspect the compiler's inferred API,
// rather than counting occurrences of `any` in source text.
const configPath = ts.findConfigFile('.', ts.sys.fileExists, 'tsconfig.json');
if (!configPath) throw new Error('Run this probe from the repository root.');
const config = ts.readConfigFile(configPath, ts.sys.readFile);
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
const program = ts.createProgram(parsed.fileNames, parsed.options);
const checker = program.getTypeChecker();
const source = program.getSourceFile('src/state/store.ts');
if (!source) throw new Error('Store source not found.');
const declaration = source.statements.find(
  (statement) => ts.isFunctionDeclaration(statement) && statement.name?.text === 'useStore'
);
if (!declaration) throw new Error('useStore declaration not found.');
const signature = checker.getSignatureFromDeclaration(declaration);
if (!signature) throw new Error('useStore signature not found.');
const returnType = checker.getReturnTypeOfSignature(signature);
for (const property of returnType.getProperties()) {
  const type = checker.getTypeOfSymbolAtLocation(property, declaration);
  console.log(`${property.name}: ${checker.typeToString(type)}`);
}
