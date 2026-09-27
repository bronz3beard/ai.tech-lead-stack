@setup @npx @agent-setup
Feature: Setting up Tech-Lead Stack with an AI assistant
  As someone who wants the toolbox in their coding apps
  I want an AI assistant to set it up from scratch with me
  So that it is fully working without me learning the installer

  Background:
    Given the AI setup prompt has been given to an AI assistant in one of my projects

  Rule: The assistant checks before it asks, and never handles secrets

    Scenario: The assistant reports what is already on the computer
      Given my computer has Node.js and at least one supported app
      When the assistant looks around
      Then it reports my apps, their connections and my features in plain words
      And it asks me to confirm that list before changing anything

    Scenario: Keys stay out of the conversation
      Given my chosen tier needs API keys
      When the assistant sets up my keys
      Then it points me to the line in my settings file to fill in
      And no key or database address appears in the conversation

  Rule: A missing prerequisite pauses the setup until I am ready

    Scenario: Node.js is too old
      Given my Node.js version is older than 22.5
      When the assistant looks around
      Then it explains why a newer Node.js is needed and links the official download
      And it resumes only after I say I am ready

  Rule: A move from a downloaded folder ends in a fresh npm install

    Scenario: An app is still connected to a downloaded folder
      Given an app is connected to Tech-Lead Stack from a downloaded folder
      When the assistant sets it up
      Then the old setup is removed from my projects and my apps, keeping my gateway
      And a fresh npm install connects every app
      And the health check reports everything needed is in place

  Rule: The prompt only names things that exist

    Scenario: The toolbox changes after the prompt was written
      Given a tool, option, app, tier, command or guide in the prompt no longer exists
      When the checks run in continuous integration
      Then the build fails and names what is out of date
