#!/usr/bin/env python3
"""Explain a failed release without changing its status or rerunning assertions."""
import os
from pathlib import Path


def classify(outcomes):
    if any(outcomes.get(key) == 'failure' for key in
           ('PYTHON_DEPS', 'NODE_TOOLS', 'NODE_DEPS', 'BROWSER_ENVIRONMENT')):
        return ('TEST ENVIRONMENT UNAVAILABLE',
                'Dependency setup or browser readiness failed. This is not a site-regression result. '
                'Check the setup log; image downloads receive at most three bounded attempts.')
    return ('SITE BUILD OR CHECK FAILED',
            'Inspect the failed build, data, functional, or visual step and its evidence. '
            'Assertions are not automatically retried and screenshot references are not rewritten.')


if __name__ == '__main__':
    title, explanation = classify(os.environ)
    message = f'## {title}\n\n{explanation}\n\nPublication remains blocked; the previous live release is unchanged.\n'
    print(message)
    if os.environ.get('GITHUB_STEP_SUMMARY'):
        with Path(os.environ['GITHUB_STEP_SUMMARY']).open('a') as summary:
            summary.write(message)
