const fs = require('fs');
const data = JSON.parse(fs.readFileSync('Ortho_Chatflow_latest.json', 'utf8'));

console.log('=== Full Chatflow Template Analysis ===\n');

// Recursively search all string values for template patterns
function findTemplatePatterns(obj, path = '') {
  const results = [];

  if (typeof obj === 'string') {
    // Look for single brace patterns that look like variables
    const varPattern = /\{([a-zA-Z_$][a-zA-Z0-9_$.-]*)\}/g;
    let m;
    while ((m = varPattern.exec(obj)) !== null) {
      // Skip if it's part of {{ }} (valid template)
      const before = obj.substring(Math.max(0, m.index - 1), m.index);
      const after = obj.substring(m.index + m[0].length, m.index + m[0].length + 1);
      if (before !== '{' && after !== '}') {
        results.push({
          path,
          pattern: m[0],
          context: obj.substring(Math.max(0, m.index - 20), Math.min(obj.length, m.index + m[0].length + 20))
        });
      }
    }

    // Also check for unbalanced braces in short strings (not the huge systemMessage)
    if (obj.length < 1000) {
      const opens = (obj.match(/\{/g) || []).length;
      const closes = (obj.match(/\}/g) || []).length;
      if (opens !== closes) {
        results.push({
          path,
          issue: 'Unbalanced braces',
          opens,
          closes,
          content: obj.length > 100 ? obj.substring(0, 100) + '...' : obj
        });
      }
    }
  } else if (Array.isArray(obj)) {
    obj.forEach((item, idx) => {
      results.push(...findTemplatePatterns(item, `${path}[${idx}]`));
    });
  } else if (obj && typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      results.push(...findTemplatePatterns(obj[key], path ? `${path}.${key}` : key));
    }
  }

  return results;
}

const patterns = findTemplatePatterns(data);

console.log('Found', patterns.length, 'potential issues:\n');
for (let i = 0; i < patterns.length; i++) {
  const p = patterns[i];
  console.log((i + 1) + '. Path:', p.path);
  if (p.pattern) {
    console.log('   Pattern:', p.pattern);
    console.log('   Context:', p.context);
  }
  if (p.issue) {
    console.log('   Issue:', p.issue);
    console.log('   Opens:', p.opens, 'Closes:', p.closes);
    console.log('   Content:', p.content);
  }
  console.log('');
}

// Also specifically look at the tool descriptions and schemas
console.log('\n=== Checking Tool Configurations ===');
data.nodes.forEach(node => {
  if (node.data.name === 'customTool') {
    console.log('\nTool Node:', node.id);
    console.log('  Selected Tool:', node.data.inputs.selectedTool);
    if (node.data.inputs.customToolName) {
      console.log('  Custom Name:', node.data.inputs.customToolName);
    }
    if (node.data.inputs.customToolDesc) {
      console.log('  Custom Desc:', node.data.inputs.customToolDesc);
    }
    if (node.data.inputs.customToolFunc) {
      console.log('  Has Custom Func: true');
      // Check for template patterns in the function
      const func = node.data.inputs.customToolFunc;
      if (func) {
        const funcPatterns = func.match(/\{[a-zA-Z_$][a-zA-Z0-9_$.-]*\}/g) || [];
        if (funcPatterns.length > 0) {
          console.log('  Template patterns in func:', funcPatterns);
        }
      }
    }
  }
});

// Check the inputParams descriptions
console.log('\n=== Checking Input Parameter Descriptions ===');
data.nodes.forEach(node => {
  if (node.data.inputParams) {
    node.data.inputParams.forEach(param => {
      if (param.description && param.description.includes('{')) {
        console.log('Node:', node.id, '- Param:', param.name);
        console.log('  Description:', param.description);
        // Check for unescaped template patterns
        const matches = param.description.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
        if (matches.length > 0) {
          console.log('  Potential template patterns:', matches);
        }
      }
    });
  }
});
