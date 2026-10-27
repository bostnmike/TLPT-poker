#!/usr/bin/env python3
"""Pinned, disposable CI browser environment. Retry downloads, NEVER assertions."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]


def environment():
    config = json.loads((ROOT/'tests/visual/environment.json').read_text())
    version = json.loads((ROOT/'package.json').read_text())['devDependencies']['playwright']
    if config['playwrightVersion'] != version or not re.fullmatch(
            r'mcr\.microsoft\.com/playwright:v' + re.escape(version) + r'-noble@sha256:[a-f0-9]{64}', config['image']):
        raise ValueError('Browser image must match the exact locked Playwright version and immutable digest')
    if config['platform'] != 'linux/amd64':
        raise ValueError('Reviewed browser architecture must remain linux/amd64')
    for name, digest in config['fonts'].items():
        font = ROOT/'tests/visual/fonts'/name
        if font.name != name or hashlib.sha256(font.read_bytes()).hexdigest() != digest:
            raise ValueError('Reviewed browser font checksum mismatch: ' + name)
    return config


def container_command(config, command):
    return ['docker', 'run', '--rm', '--init', '--platform', config['platform'],
            '--shm-size=1g', '--user', f'{os.getuid()}:{os.getgid()}',
            '--env', 'HOME=/tmp', '--env', 'CI=true', '--env', 'TZ=America/New_York',
            '--env', 'TLPT_BROWSER_IMAGE=' + config['image'],
            '--volume', f'{ROOT}/tests/visual/fonts:/usr/local/share/fonts/tlpt-reference:ro',
            '--volume', f'{ROOT}:/work', '--workdir', '/work', config['image'], *command]


def pull(config, run=subprocess.run, sleep=time.sleep):
    # Same immutable image on all attempts. A partial pull can reuse Docker layers.
    for attempt in range(1, 4):
        try:
            result = run(['docker', 'pull', '--platform', config['platform'], config['image']],
                         cwd=ROOT, timeout=180, check=False)
            if result.returncode == 0:
                return
        except subprocess.TimeoutExpired:
            pass
        if attempt < 3:
            print(f'::warning::Browser environment download attempt {attempt}/3 failed; retrying the same pinned image.', flush=True)
            sleep(10 * attempt)
    raise RuntimeError('Browser environment download failed after three bounded attempts')


def execute(mode, config, run=subprocess.run, repeats=1):
    commands = {
        'prepare': ['node', 'scripts/browser-preflight.cjs'],
        'functional': ['node', 'scripts/run-browser-gates.cjs'],
        'visual': ['node', 'node_modules/playwright/cli.js', 'test', '--config', 'tests/visual/playwright.config.cjs'],
    }
    command = commands[mode]
    if mode == 'visual' and repeats != 1:
        command = [*command, '--repeat-each', str(repeats)]
    # No test retries: a failed assertion is a release failure, not infrastructure.
    return run(container_command(config, command), cwd=ROOT, check=False).returncode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('mode', choices=['prepare', 'functional', 'visual'])
    parser.add_argument('--repeat-each', type=int, choices=range(1, 4), default=1)
    args = parser.parse_args()
    try:
        config = environment()
        if args.mode == 'prepare':
            pull(config)
        code = execute(args.mode, config, repeats=args.repeat_each)
        if code:
            category = 'TEST ENVIRONMENT UNAVAILABLE' if args.mode == 'prepare' else 'SITE CHECK FAILED'
            print(f'::error title={category}::{args.mode} failed (exit {code}); publishing remains blocked.', flush=True)
        return code
    except (OSError, ValueError, RuntimeError) as error:
        print(f'::error title=TEST ENVIRONMENT UNAVAILABLE::{error}; publishing remains blocked.', flush=True)
        return 1


if __name__ == '__main__':
    sys.exit(main())
