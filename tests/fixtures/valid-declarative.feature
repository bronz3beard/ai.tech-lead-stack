Feature: Login
Scenario: User logs in successfully
Given the user has valid credentials
When the user authenticates
Then the user is granted access to their account
