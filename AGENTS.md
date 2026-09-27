# Project workflow

- The user requests that each completed, validated update be committed and pushed to the existing GitHub origin. Never commit secrets, local configuration, or personal chat data. Do not force-push.
- Test selector changes against the user's observed ChatGPT DOM shape; simulated page tests alone do not establish compatibility with the live site.
- Default to the ChatGPT web-session path; never use private endpoints or read login cookies. API mode is opt-in and separately billed. Distinguish fixture tests from actual live-site verification.
