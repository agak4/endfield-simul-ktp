const fs = require('fs');
const recast = require('recast');
const b = recast.types.builders;
const n = recast.types.namedTypes;

const code = fs.readFileSync('data_operators.js', 'utf8');

const ast = recast.parse(code);

recast.visit(ast, {
    visitVariableDeclarator(path) {
        if (n.Identifier.check(path.node.id) && path.node.id.name === 'DATA_OPERATORS') {
            const arr = path.node.init;
            if (n.ArrayExpression.check(arr)) {
                arr.elements.forEach(op => {
                    if (!n.ObjectExpression.check(op)) return;

                    const props = op.properties;

                    // 1. Process skill array
                    const skillProp = props.find(p => p.key && p.key.name === 'skill');
                    if (skillProp && n.ArrayExpression.check(skillProp.value)) {
                        skillProp.value.elements.forEach(skillObj => {
                            if (!n.ObjectExpression.check(skillObj)) return;

                            const sProps = skillObj.properties;

                            // Process type
                            const typeProp = sProps.find(p => p.key && p.key.name === 'type');
                            if (typeProp && !n.ArrayExpression.check(typeProp.value)) {
                                typeProp.value = b.arrayExpression([typeProp.value]);
                            }

                            // Process bonus
                            const bonusProp = sProps.find(p => p.key && p.key.name === 'bonus');
                            if (bonusProp && !n.ArrayExpression.check(bonusProp.value)) {
                                bonusProp.value = b.arrayExpression([bonusProp.value]);
                            }
                        });
                    }

                    // 2. Process talents array
                    const talentsProp = props.find(p => p.key && p.key.name === 'talents');
                    if (talentsProp && n.ArrayExpression.check(talentsProp.value)) {
                        talentsProp.value.elements = talentsProp.value.elements.map(talentObj => {
                            if (n.ObjectExpression.check(talentObj)) {
                                if (talentObj.properties.length === 0) {
                                    return b.arrayExpression([]);
                                } else {
                                    return b.arrayExpression([talentObj]);
                                }
                            }
                            return talentObj;
                        });
                    }

                    // 3. Process potential array
                    const potentialProp = props.find(p => p.key && p.key.name === 'potential');
                    if (potentialProp && n.ArrayExpression.check(potentialProp.value)) {
                        potentialProp.value.elements = potentialProp.value.elements.map(potObj => {
                            if (n.ObjectExpression.check(potObj)) {
                                if (potObj.properties.length === 0) {
                                    return b.arrayExpression([]);
                                } else {
                                    return b.arrayExpression([potObj]);
                                }
                            }
                            return potObj;
                        });
                    }
                });
            }
        }
        this.traverse(path);
    }
});

const newCode = recast.print(ast).code;
fs.writeFileSync('data_operators.js', newCode, 'utf8');
console.log('Successfully refactored data_operators.js');
