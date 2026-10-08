# Myfnt 2.14.11 — Smart UI Timing & Focus

- Install banner waits 40 seconds and only appears when no window/dialog is open.
- Install banner hides again if another blocking surface opens.
- Automatic usage hints wait 80 seconds of clear foreground use.
- Hints never appear over an open window/dialog.
- Strong viewport spotlight/focus ring for guided hints.
- Visitor onboarding redesigned more compactly; business types use small chips.
- Extra compact layout for short mobile screens with no internal scrolling.
- Central `MyfntUiState` blocking-surface check shared by automatic UI prompts.
