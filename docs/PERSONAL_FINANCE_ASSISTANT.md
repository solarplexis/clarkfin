# Personal Finance AI Assistant

 1. On the budget builder page, we want to introduce a personal finance AI assistant chatbot such that it can use natural language to:
  a. Modify the budget
  b. Answer questions about financial planning
  c. Make projections about retirement planning

 2. The interface should be a left-drawer chatbot interface (so as to not disrupt the existing manual budget entry UI)

 3. We already have the OPEN_AI_KEY in our .env.local

 4. We'll need a classifier to understand the category of user input. Then we'll need an execution environment for each valid input which should use the student's course budget as the underlying data structure for requested changes. Changes should be implemented as auto-save operations by the AI using the existing APIs (i.e. as if the user had done so manually)