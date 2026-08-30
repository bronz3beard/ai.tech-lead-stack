#!/bin/bash
git checkout -b fix/pipeline-repair || true
git add .
git commit --allow-empty -m "fix(pipeline): repair visual evidence capturing, validation, and PR publishing with deterministic labeling, and fix CI test flakiness"
