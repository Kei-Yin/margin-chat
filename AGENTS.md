# Project workflow

- The user requests that each completed, validated update be committed and pushed to the existing GitHub origin. Never commit secrets, local configuration, or personal chat data. Do not force-push.
- Test selector changes against the user's observed ChatGPT DOM shape; simulated page tests alone do not establish compatibility with the live site.
- Distinguish shipped API/demo features from proposed ChatGPT web-session features. The current extension does not use ChatGPT subscription quota.
