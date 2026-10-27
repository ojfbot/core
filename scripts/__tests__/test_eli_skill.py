"""Check eli's portable package and the factual integrity of its worked example."""
from pathlib import Path
import re
import unittest


SKILL = Path(__file__).resolve().parents[2] / '.claude/skills/eli'


class EliContract(unittest.TestCase):
    def test_supporting_reference_resolves_from_skill_not_cwd(self):
        body = (SKILL / 'SKILL.md').read_text()
        references = re.findall(r'Load `([^`]+\.md)`', body)
        self.assertTrue(references, 'The register contracts must remain discoverable')
        for reference in references:
            target = (SKILL / reference).resolve()
            self.assertTrue(target.is_relative_to(SKILL.resolve()))
            self.assertTrue(target.is_file(), reference)

    def test_instruction_only_package_has_no_provider_macro_dependency(self):
        files = {str(p.relative_to(SKILL)) for p in SKILL.rglob('*') if p.is_file()}
        self.assertEqual(files, {'SKILL.md', 'knowledge/registers.md'})
        self.assertNotIn('$ARGUMENTS', (SKILL / 'SKILL.md').read_text())

    def test_example_quantities_are_grounded_in_declared_fact_base(self):
        text = (SKILL / 'knowledge/registers.md').read_text()
        facts, rendered = text.split('Established fact base:', 1)[1].split('**Intern:**', 1)
        intern, executive = rendered.split('**Exec:**', 1)
        executive = executive.split('\nThe intern version', 1)[0]
        established = set(re.findall(r'\b\d+(?:\.\d+)?\b', facts))
        self.assertTrue(established)
        for label, output in [('intern', intern), ('executive', executive)]:
            output = re.sub(r'\b\d+\)', '', output)  # list ordinals are not facts
            quantities = set(re.findall(r'\b\d+(?:\.\d+)?\b', output))
            self.assertFalse(quantities - established, (label, quantities - established))

    def test_example_executive_word_budget_excludes_risk_table(self):
        text = (SKILL / 'knowledge/registers.md').read_text()
        output = text.split('**Exec:**', 1)[1].split('\nThe intern version', 1)[0]
        prose = '\n'.join(line for line in output.splitlines() if not line.startswith('|'))
        self.assertLessEqual(len(prose.split()), 120)


if __name__ == '__main__':
    unittest.main()
