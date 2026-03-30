# Auto-magic 'login' / 'authentication'

1. We need to support a mechanism whereby students are given a unique URL to the web app such that it has encoded information for first name, last name and email address to avoid having them do an explicit login (although we don't want to remove the current login mechanism)
2. We'll be using an external AI agent to get a course's enrollment and from that enrollment generate unique URLs for each student therein, and use a new POST API we develop to populate this web app's course-to-student enrollment information (this API will require teacher/professor credentials)
3. We'll then have our external AI agent do a get on the enrollment and post messages to each of the enrolled students (of the course) that includes their own unique URL to use the personal finance app

## Ask me any necessary questions, but keep in mind that we don't want to remove any functionality... we just want a pseudo-authentication scheme so students don't have to do a manual login