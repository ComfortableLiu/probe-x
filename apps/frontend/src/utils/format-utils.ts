import * as prettier from 'prettier/standalone';
import * as parserBabel from 'prettier/parser-babel';
import * as parserHtml from 'prettier/parser-html';
import * as parserMarkdown from 'prettier/parser-markdown';
import * as parserTypescript from 'prettier/parser-typescript';
import prettierPluginEstree from "prettier/plugins/estree";

/**
 * 格式化代码
 * @param text
 * @param parser - 'babel' | 'json' | 'html' | 'css' | 'markdown' | 'text' | 'typescript'
 */
export async function formatCode(text: string, parser: 'babel' | 'json' | 'html' | 'css' | 'markdown' | 'text' | 'typescript') {
  if (!parser || parser === 'text') return text
  return prettier.format(text, {
    parser: parser,
    tabWidth: 2,
    singleQuote: true,
    semi: false,
    plugins: [
      parserBabel,
      parserHtml,
      parserMarkdown,
      prettierPluginEstree,
      parserTypescript,
    ],
  });
}
