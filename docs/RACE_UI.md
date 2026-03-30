# Course Instructer - Race UI

1. We want to add an exportable (via API) component to the instructor's dashboard such that for a given course, s/he can see all enrolled students and current progress.
2. We'll have to define milestones for each course, and using those milestones determine where each student is.
3. The personal finance course will have no quizzes, so student activity in the web app will be the primary gauge, but we need to identify the milestones we want to use to measure progress on the instructor dashboard
4. We'll want a GET API that can be called from an external AI agent, possibly rendering an image like the lanes of a horse/car race (horizontal) or a spaceship (vertical) that incldues each of the enrolled students and their respective position to each other