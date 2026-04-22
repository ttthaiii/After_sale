import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import traversePkg from '@babel/traverse';
import generatePkg from '@babel/generator';
import * as t from '@babel/types';
import { fileURLToPath } from 'url';

const traverse = traversePkg.default || traversePkg;
const generate = generatePkg.default || generatePkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fileContent = fs.readFileSync(path.join(__dirname, 'src', 'pages', 'Dashboard.tsx'), 'utf-8');

const ast = parse(fileContent, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  // Use exit to process children first
  CallExpression: {
    exit(path) {
      if (path.node.callee.name === 'jsxDEV' || path.node.callee.name === '_jsxDEV') {
        const args = path.node.arguments;
        if (args.length < 2) return;
        
        const typeArg = args[0];
        const propsArg = args[1];
        
        let elementName;
        if (t.isStringLiteral(typeArg)) {
          elementName = t.jsxIdentifier(typeArg.value);
        } else if (t.isIdentifier(typeArg)) {
          elementName = t.jsxIdentifier(typeArg.name);
        } else if (t.isMemberExpression(typeArg)) {
          elementName = t.jsxMemberExpression(
            t.jsxIdentifier(typeArg.object.name),
            t.jsxIdentifier(typeArg.property.name)
          );
        } else {
          return;
        }

        const attributes = [];
        const children = [];

        if (t.isObjectExpression(propsArg)) {
          propsArg.properties.forEach(prop => {
            if (t.isObjectProperty(prop) && t.isIdentifier(prop.key)) {
              if (prop.key.name === 'children') {
                if (t.isArrayExpression(prop.value)) {
                  prop.value.elements.forEach(el => {
                    if (el) {
                      if (t.isStringLiteral(el)) {
                        children.push(t.jsxText(el.value));
                      } else if (t.isJSXElement(el)) {
                        children.push(el);
                      } else {
                        children.push(t.jsxExpressionContainer(el));
                      }
                    }
                  });
                } else {
                  if (t.isStringLiteral(prop.value)) {
                    children.push(t.jsxText(prop.value.value));
                  } else if (t.isJSXElement(prop.value)) {
                    children.push(prop.value);
                  } else {
                    children.push(t.jsxExpressionContainer(prop.value));
                  }
                }
              } else {
                let attrValue;
                if (t.isStringLiteral(prop.value)) {
                  attrValue = prop.value;
                } else if (t.isJSXElement(prop.value)) {
                  attrValue = t.jsxExpressionContainer(prop.value);
                } else {
                  attrValue = t.jsxExpressionContainer(prop.value);
                }
                attributes.push(t.jsxAttribute(t.jsxIdentifier(prop.key.name), attrValue));
              }
            } else if (t.isSpreadElement(prop)) {
              attributes.push(t.jsxSpreadAttribute(prop.argument));
            } else if (t.isObjectProperty(prop) && t.isStringLiteral(prop.key)) {
              // handle string attributes like 'data-tip'
              let attrValue;
              if (t.isStringLiteral(prop.value)) {
                attrValue = prop.value;
              } else if (t.isJSXElement(prop.value)) {
                attrValue = t.jsxExpressionContainer(prop.value);
              } else {
                attrValue = t.jsxExpressionContainer(prop.value);
              }
              attributes.push(t.jsxAttribute(t.jsxIdentifier(prop.key.value), attrValue));
            }
          });
        }

        const openingElement = t.jsxOpeningElement(elementName, attributes, children.length === 0);
        const closingElement = children.length === 0 ? null : t.jsxClosingElement(elementName);
        const jsxElement = t.jsxElement(openingElement, closingElement, children, openingElement.selfClosing);
        path.replaceWith(jsxElement);
      }
    }
  }
});

const output = generate(ast, {}, fileContent);
fs.writeFileSync(path.join(__dirname, 'src', 'pages', 'Dashboard_ast.tsx'), output.code);
console.log('AST translation completed inside Dashboard_ast.tsx');
