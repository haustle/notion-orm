// Type declarations for Babel modules
declare module '@babel/generator' {
  import { Node } from '@babel/types';
  
  interface GeneratorOptions {
    auxiliaryCommentBefore?: string;
    auxiliaryCommentAfter?: string;
    shouldPrintComment?: (comment: string) => boolean;
    retainLines?: boolean;
    retainFunctionParens?: boolean;
    comments?: boolean;
    compact?: boolean | 'auto';
    minified?: boolean;
    concise?: boolean;
    quotes?: 'single' | 'double';
    filename?: string;
    sourceMaps?: boolean;
    sourceMapTarget?: string;
    sourceRoot?: string;
    sourceFileName?: string;
  }

  interface GeneratorResult {
    code: string;
    map?: object;
    rawMappings?: object;
  }

  function generate(
    ast: Node,
    options?: GeneratorOptions,
    code?: string | { [filename: string]: string }
  ): GeneratorResult;

  export default generate;
}

