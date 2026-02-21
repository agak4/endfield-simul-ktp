const fs = require('fs');
const recast = require('recast');
const b = recast.types.builders;
const n = recast.types.namedTypes;

function wrapInArrayField(objNode, fieldName) {
    if (!n.ObjectExpression.check(objNode)) return;
    const prop = objNode.properties.find(p => p.key && p.key.name === fieldName);
    if (prop && !n.ArrayExpression.check(prop.value)) {
        prop.value = b.arrayExpression([prop.value]);
    }
}

function processEffectNode(node) {
    if (!n.ObjectExpression.check(node)) return;
    wrapInArrayField(node, 'type');
    wrapInArrayField(node, 'skilltype');
    wrapInArrayField(node, 'trigger');
    wrapInArrayField(node, 'bonus');

    // Process nested bonus if exists
    const bonusProp = node.properties.find(p => p.key && p.key.name === 'bonus');
    if (bonusProp && n.ArrayExpression.check(bonusProp.value)) {
        bonusProp.value.elements.forEach(processEffectNode);
    }
}

function processDataFile(filename, arrayName, propsToProcess) {
    if (!fs.existsSync(filename)) return;
    const code = fs.readFileSync(filename, 'utf8');
    const ast = recast.parse(code);

    recast.visit(ast, {
        visitVariableDeclarator(path) {
            if (n.Identifier.check(path.node.id) && path.node.id.name === arrayName) {
                const arr = path.node.init;
                if (n.ArrayExpression.check(arr)) {
                    arr.elements.forEach(entry => {
                        if (!n.ObjectExpression.check(entry)) return;
                        propsToProcess.forEach(propName => {
                            const prop = entry.properties.find(p => p.key && p.key.name === propName);
                            if (prop && n.ArrayExpression.check(prop.value)) {
                                prop.value.elements.forEach(el => {
                                    if (n.ArrayExpression.check(el)) {
                                        el.elements.forEach(processEffectNode);
                                    } else {
                                        processEffectNode(el);
                                    }
                                });
                            } else if (prop && n.ObjectExpression.check(prop.value)) {
                                processEffectNode(prop.value);
                            }
                        });
                    });
                }
            }
            this.traverse(path);
        }
    });

    const newCode = recast.print(ast).code;
    fs.writeFileSync(filename, newCode, 'utf8');
    console.log(`Successfully refactored ${filename}`);
}

processDataFile('data_operators.js', 'DATA_OPERATORS', ['skill', 'talents', 'potential']);
processDataFile('data_gears.js', 'DATA_GEAR', ['traits', 'trait']);
processDataFile('data_gears.js', 'DATA_SETS', ['effects']);
processDataFile('data_weapons.js', 'DATA_WEAPONS', ['traits']);
