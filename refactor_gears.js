const fs = require('fs');
const recast = require('recast');
const b = recast.types.builders;
const n = recast.types.namedTypes;

const code = fs.readFileSync('data_gears.js', 'utf8');

const ast = recast.parse(code);

recast.visit(ast, {
    visitVariableDeclarator(path) {
        if (n.Identifier.check(path.node.id) && path.node.id.name === 'DATA_GEAR') {
            const arr = path.node.init;
            if (n.ArrayExpression.check(arr)) {
                arr.elements.forEach(op => {
                    if (!n.ObjectExpression.check(op)) return;

                    const props = op.properties;

                    // Process trait array
                    const traitProp = props.find(p => p.key && p.key.name === 'trait');
                    if (traitProp && !n.ArrayExpression.check(traitProp.value)) {
                        traitProp.value = b.arrayExpression([traitProp.value]);
                    }
                });
            }
        }
        this.traverse(path);
    }
});

const newCode = recast.print(ast).code;
fs.writeFileSync('data_gears.js', newCode, 'utf8');
console.log('Successfully refactored data_gears.js');
