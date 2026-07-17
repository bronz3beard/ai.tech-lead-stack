Feature: Login
Scenario: User logs in
Given a user is on the login page
When they type their username
And they click the login button
Then they should see the dashboard
