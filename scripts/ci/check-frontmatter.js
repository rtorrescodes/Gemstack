const fs = require('fs');
const path = require('path');

const skillsDir = path.resolve(__dirname, '../../.agents/skills');
if (!fs.existsSync(skillsDir)) {
    console.error(`Skills directory not found at ${skillsDir}`);
    process.exit(1);
}

let hasError = false;

fs.readdirSync(skillsDir).forEach(folder => {
    const stat = fs.statSync(path.join(skillsDir, folder));
    if (!stat.isDirectory()) return;

    const skillPath = path.join(skillsDir, folder, 'SKILL.md');
    if (!fs.existsSync(skillPath)) {
        console.error(`[FAIL] ${folder} missing SKILL.md`);
        hasError = true;
        return;
    }

    const content = fs.readFileSync(skillPath, 'utf8');
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!frontmatterMatch) {
        console.error(`[FAIL] ${folder} missing valid frontmatter`);
        hasError = true;
        return;
    }

    const frontmatter = frontmatterMatch[1];
    const nameMatch = frontmatter.match(/name:\s*(.+)/);
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    const triggersMatch = frontmatter.match(/triggers:\s*\n((\s+-\s+.+\n?)+)/);

    if (!nameMatch || nameMatch[1].trim() !== folder) {
        console.error(`[FAIL] ${folder} name mismatch or missing. Expected: ${folder}`);
        hasError = true;
    }
    if (!descMatch || descMatch[1].trim() === '') {
        console.error(`[FAIL] ${folder} missing description`);
        hasError = true;
    }
    if (!triggersMatch) {
        console.error(`[FAIL] ${folder} missing triggers array`);
        hasError = true;
    }
});

if (hasError) {
    process.exit(1);
} else {
    console.log('[OK] All skills have valid frontmatter.');
}
