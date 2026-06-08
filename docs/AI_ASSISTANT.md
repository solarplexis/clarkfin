# AI Assistant

1. We previously (before the major refactor) had an AI assitant, and now we want to resurrect that but with a different scope. It should:
  a. Answer general personal finance questions
  b. Have guardrails that prevent it from discussing other subjects
  c. Update student financial data supported in the app. E.g. 'I just spent $10 at Starbuck' and it figures out how to categorize the expenditure
    i. Whoops, I meant $12
    ii. I just paid my rent
    iii. My friend just loaned me 50 bucks
    iv. Other financially impacting actions
  d. Answer questions about ClarkFin navigation with 'links' to the appropriate page so the user can navigate directly there from the chat panel
  e. Answer questions about the course syllabus
2. The AI assistant chat panel should be accessible from all student pages. There should be a floating icon widget at the lower right of each screen (common component)
  a. Pushes all page content to the left
  b. Similar design as the end drawer component (Title | Content | Button Bar)
  c. Should function similar to the Chat agents in VS Code (not chat history for now)
  d. Navigating away from a page dismisses the agent and the context of a conversation (probably want to add a header in the chat panel with language informing the students that chat histories are not retained / ephemeral).