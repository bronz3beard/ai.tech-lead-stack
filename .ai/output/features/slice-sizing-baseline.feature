@plan @vertical-slice @slice-baseline
Feature: Sizing vertical slices from the repository's own history
  As a tech lead breaking stories into vertical slices
  I want slices sized against how my team's merged work actually behaved
  So that each story gets the fewest slices that still ship in two working days

  Rule: The baseline is optional and never blocks slicing

    Scenario: The repository has enough merged history
      Given the repository has merged pull requests in the last 180 days
      When the slicer gathers the sizing baseline
      Then it reports working days, changed files and open work per developer
      And it sizes each slice against the history of similar changes

    Scenario: No usable history is available
      Given the slicer cannot run commands, or the repository has too little merged history
      When the slicer gathers the sizing baseline
      Then it says that no baseline is available
      And it slices with the defaults of two working days, 24 files and three open per developer

    Scenario: The baseline never loosens the limits
      Given the team's typical pull request is larger than 24 files
      When the slicer sizes a story
      Then each slice still stays within 24 files

  Rule: A story gets the fewest slices that each deploy on their own

    Scenario: A small story stays one slice
      Given a story that already fits two working days and 24 files
      When the slicer decomposes it
      Then it produces one slice whose scenarios and design states are tasks inside it

    Scenario: A larger story gets slices in proportion to its size
      Given a story estimated at 28 changed files
      When the slicer decomposes it
      Then it produces about two slices
      And any slice beyond double that count carries a written reason in the Ledger

    Scenario: Slices that belong together are merged
      Given two slices of one story share a flag and mostly the same files
      And together they still fit two working days and 24 files
      When the slicer runs its merge pass
      Then the two slices become one
      And the merge is recorded in the Ledger

  Rule: No developer holds more than three open slices

    Scenario: The slice order would overload one developer
      Given a developer already has three slices open
      When the slicer orders and assigns the remaining slices
      Then that developer is not given a fourth open slice
      And slices are merged instead of queued when the count would force it

  Rule: The wide pull request allowance stays rare

    Scenario: A wide but shallow change uses the allowance
      Given a rename touches 38 files with no new behaviour
      And fewer than 1 in 10 recent pull requests went over 24 files
      When the planner sizes the pull request
      Then the pull request may hold up to 45 files with a one-line reason

    Scenario: The allowance is already used up
      Given more than 1 in 10 recent pull requests went over 24 files
      When the planner sizes a pull request over 24 files
      Then it splits the pull request at a deployable seam instead
